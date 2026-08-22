/* =========================================================
   EXAM UTILITIES (admin-facing create/edit/publish)
   Matches `exams/{examId}` and `examSnapshots/{examId}` in
   firestore-schema.md exactly.
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, setDoc,
  query, where, orderBy, serverTimestamp, Timestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getQuestionsByIds } from "./question-utils.js";

// ---------- Create a new exam (status: draft) ----------
export async function createExam(data) {
  const totalMarks = (data.questionIds?.length || 0) * (data.marksPerQuestion || 1);
  return addDoc(collection(db, "exams"), {
    name: data.name,
    description: data.description || "",
    examDate: data.examDate ? Timestamp.fromDate(new Date(data.examDate)) : null,
    informationalTime: data.informationalTime || "",
    durationMinutes: data.durationMinutes,
    marksPerQuestion: data.marksPerQuestion || 1,
    totalMarks,
    subjectIds: data.subjectIds || [],
    chapterIds: data.chapterIds || [],
    questionIds: data.questionIds || [],   // ordered — no randomization (requirement #9)
    negativeMarking: false,
    status: "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// ---------- Update a draft/upcoming exam (blocked once published — see below) ----------
export async function updateExam(examId, data) {
  const exam = await getExamById(examId);
  if (!exam) throw new Error("পরীক্ষা পাওয়া যায়নি।");
  if (["published", "active", "completed", "archived"].includes(exam.status)) {
    throw new Error("প্রকাশিত পরীক্ষা সরাসরি সম্পাদনা করা যাবে না। এটি duplicate করে সম্পাদনা করুন।");
  }
  const merged = { ...exam, ...data };
  const totalMarks = (merged.questionIds?.length || 0) * (merged.marksPerQuestion || 1);
  return updateDoc(doc(db, "exams", examId), {
    ...data,
    totalMarks,
    examDate: data.examDate ? Timestamp.fromDate(new Date(data.examDate)) : exam.examDate,
    updatedAt: serverTimestamp()
  });
}

// ---------- Delete/archive a draft (never delete a published exam — historical integrity) ----------
export async function deleteDraftExam(examId) {
  const exam = await getExamById(examId);
  if (!exam) return;
  if (exam.status !== "draft") {
    throw new Error("শুধুমাত্র খসড়া (draft) পরীক্ষা মুছে ফেলা যায়। প্রকাশিত পরীক্ষা archive করুন।");
  }
  return deleteDoc(doc(db, "exams", examId));
}

// ---------- Permanently delete ANY exam (draft, published, completed — any status),
// along with every record tied to it: the frozen question snapshot, every
// student's attempt, and every student's result for this exam. This is the
// admin's explicit "delete this exam and wipe its history" action — unlike
// deleteDraftExam above, it does NOT preserve historical integrity, by design.
// There is no undo once this runs. ----------
export async function deleteExamPermanently(examId) {
  const exam = await getExamById(examId);
  if (!exam) return;

  const [attemptsSnap, resultsSnap] = await Promise.all([
    getDocs(query(collection(db, "attempts"), where("examId", "==", examId))),
    getDocs(query(collection(db, "results"), where("examId", "==", examId)))
  ]);

  const batch = writeBatch(db);
  attemptsSnap.docs.forEach(d => batch.delete(d.ref));
  resultsSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, "examSnapshots", examId));
  batch.delete(doc(db, "exams", examId));
  await batch.commit();
}

export async function archiveExam(examId) {
  return updateDoc(doc(db, "exams", examId), { status: "archived", updatedAt: serverTimestamp() });
}

// ---------- Duplicate an existing exam (requirement #26) ----------
export async function duplicateExam(examId) {
  const source = await getExamById(examId);
  if (!source) throw new Error("মূল পরীক্ষা পাওয়া যায়নি।");
  const { id, status, createdAt, updatedAt, ...rest } = source;
  const docRef = await addDoc(collection(db, "exams"), {
    ...rest,
    name: `${source.name} (কপি)`,
    status: "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

// ---------- Read ----------
export async function getExamById(examId) {
  const snap = await getDoc(doc(db, "exams", examId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllExams({ status = null } = {}) {
  // NOTE: no Firestore orderBy() when a status filter is applied — equality
  // filter + orderBy on a different field needs a composite index that
  // doesn't exist here, and a missing index makes the query fail instead of
  // just returning results (see results-utils.js / syllabus-utils.js for the
  // same fix). Sort client-side so no index is ever required.
  const clauses = [];
  if (status) clauses.push(where("status", "==", status));
  if (!status) clauses.push(orderBy("createdAt", "desc"));
  const snap = await getDocs(query(collection(db, "exams"), ...clauses));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return status ? items.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)) : items;
}

// ---------- PUBLISH: freeze an immutable question snapshot, then flip status.
// This is the single most important integrity step in the whole system —
// after this point, editing/deleting a question in the bank must never
// change what this exam's students see or how their results are graded. ----------
export async function publishExam(examId) {
  const exam = await getExamById(examId);
  if (!exam) throw new Error("পরীক্ষা পাওয়া যায়নি।");
  if (exam.status !== "draft") throw new Error("শুধু খসড়া পরীক্ষা প্রকাশ করা যায়।");
  if (!exam.questionIds || exam.questionIds.length === 0) throw new Error("প্রকাশ করার আগে অন্তত একটি প্রশ্ন যোগ করুন।");

  const questions = await getQuestionsByIds(exam.questionIds);
  // Preserve exact admin-selected order, not Firestore fetch order.
  const orderedQuestions = exam.questionIds
    .map(id => questions.find(q => q.id === id))
    .filter(Boolean)
    .map(q => ({
      questionId: q.id,
      question_en: q.question_en,
      question_bn: q.question_bn,
      options_bn: q.options_bn,
      correctAnswer: q.correctAnswer,
      marks: exam.marksPerQuestion || q.marks || 1,
      subjectId: q.subjectId,
      chapterId: q.chapterId,
      topicId: q.topicId,
      imageUrl: q.imageUrl || null,
      explanation_bn: q.explanation_bn || null
    }));

  if (orderedQuestions.length !== exam.questionIds.length) {
    throw new Error("কিছু নির্বাচিত প্রশ্ন প্রশ্ন ব্যাংকে আর পাওয়া যাচ্ছে না। প্রকাশের আগে তালিকা যাচাই করুন।");
  }

  await setDoc(doc(db, "examSnapshots", examId), {
    examId,
    questions: orderedQuestions,
    lockedAt: serverTimestamp()
  });

  await updateDoc(doc(db, "exams", examId), { status: "published", updatedAt: serverTimestamp() });
}

// ---------- Marks calculation preview (used live while admin is building the exam) ----------
export function calculateTotalMarks(questionCount, marksPerQuestion) {
  return (questionCount || 0) * (marksPerQuestion || 0);
}
   
