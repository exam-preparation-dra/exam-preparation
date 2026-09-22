/*
  IMPROVEMENT TEST UTILS
  ----------------------
  Keeps Improvement Test question data separate from the Admin-only
  question bank.

  Why this file exists:
  - /questions is Admin-only.
  - A student must NOT receive direct access to the whole question bank.
  - When an Improvement Test is published, its selected questions are copied
    into a dedicated immutable snapshot.
  - The student runner reads only this snapshot.

  Collections:
    improvementTests/{testId}
    improvementTestSnapshots/{testId}

  No emoji.
*/

import { db, auth } from "../firebase/firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const cleanId = value => String(value || "").trim();

function requireAdmin() {
  if (!auth.currentUser) {
    throw new Error("অ্যাডমিন হিসেবে লগইন করা প্রয়োজন।");
  }
  return auth.currentUser;
}

function cleanQuestion(q = {}) {
  return {
    questionId: cleanId(q.id || q.questionId),
    question_en: String(q.question_en || ""),
    question_bn: String(q.question_bn || ""),
    options_bn: Array.isArray(q.options_bn) ? q.options_bn : [],
    options_en: Array.isArray(q.options_en) ? q.options_en : [],
    correctAnswer: q.correctAnswer || null,
    explanation_bn: q.explanation_bn || null,
    imageUrl: q.imageUrl || null,
    marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
    subjectId: q.subjectId || null,
    chapterId: q.chapterId || null,
    topicId: q.topicId || null
  };
}

/*
  Admin-only:
  Builds a snapshot from the question bank IDs stored on the improvement test.
*/
export async function buildImprovementTestSnapshot(testId) {
  requireAdmin();

  const tid = cleanId(testId);
  if (!tid) throw new Error("Improvement Test ID প্রয়োজন।");

  const testSnap = await getDoc(doc(db, "improvementTests", tid));
  if (!testSnap.exists()) {
    throw new Error("Improvement Test পাওয়া যায়নি।");
  }

  const test = testSnap.data();
  const questionIds = [...new Set(
    (Array.isArray(test.questionIds) ? test.questionIds : [])
      .map(cleanId)
      .filter(Boolean)
  )];

  if (!questionIds.length) {
    throw new Error("এই Improvement Test-এ কোনো প্রশ্ন নেই।");
  }

  const questions = [];

  for (const questionId of questionIds) {
    const qSnap = await getDoc(doc(db, "questions", questionId));

    if (!qSnap.exists()) {
      continue;
    }

    const question = cleanQuestion({
      id: qSnap.id,
      ...qSnap.data()
    });

    if (question.questionId && question.correctAnswer) {
      questions.push(question);
    }
  }

  if (!questions.length) {
    throw new Error("প্রশ্ন ব্যাংক থেকে কোনো বৈধ প্রশ্ন পাওয়া যায়নি।");
  }

  return {
    testId: tid,
    type: "improvement_practice",
    title: String(test.title || "উন্নতির অনুশীলন"),
    description: String(test.description || ""),
    subjectId: test.subjectId || null,
    chapterId: test.chapterId || null,
    topicId: test.topicId || null,
    questionCount: questions.length,
    questions
  };
}

/*
  Admin-only:
  Writes/replaces the dedicated snapshot.
  This should be called before making an Improvement Test visible to students.
*/
export async function createImprovementTestSnapshot(testId) {
  const admin = requireAdmin();
  const snapshot = await buildImprovementTestSnapshot(testId);

  await setDoc(
    doc(db, "improvementTestSnapshots", snapshot.testId),
    {
      ...snapshot,
      sourceTestId: snapshot.testId,
      createdBy: admin.uid,
      createdAt: serverTimestamp()
    }
  );

  return snapshot;
}

/*
  Student-side:
  Reads only the dedicated snapshot, never /questions.
*/
export async function getImprovementTestSnapshot(testId) {
  const tid = cleanId(testId);
  if (!tid) return null;

  const snap = await getDoc(
    doc(db, "improvementTestSnapshots", tid)
  );

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data()
  };
}

/*
  Student-side:
  Checks whether a published test is actually assigned to this student.
  This prevents a student from opening an arbitrary Improvement Test ID.
*/
export async function getAssignedImprovementTest(testId, studentId) {
  const tid = cleanId(testId);
  const sid = cleanId(studentId);

  if (!tid || !sid) return null;

  const testSnap = await getDoc(doc(db, "improvementTests", tid));

  if (!testSnap.exists()) return null;

  const test = {
    id: testSnap.id,
    ...testSnap.data()
  };

  const assignedStudents = Array.isArray(test.studentIds)
    ? test.studentIds.map(cleanId)
    : [];

  if (test.status !== "published") return null;
  if (!assignedStudents.includes(sid)) return null;

  const snapshot = await getImprovementTestSnapshot(tid);

  if (!snapshot) return null;

  return {
    ...test,
    snapshot
  };
}

/*
  Optional helper for Admin:
  Returns all published Improvement Tests assigned to a student.
*/
export async function getAssignedImprovementTests(studentId) {
  const sid = cleanId(studentId);
  if (!sid) return [];

  const snap = await getDocs(
    query(
      collection(db, "improvementTests"),
      where("status", "==", "published")
    )
  );

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(test =>
      Array.isArray(test.studentIds) &&
      test.studentIds.map(cleanId).includes(sid)
    );
}
