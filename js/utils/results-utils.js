/* =========================================================
   RESULTS & EXAM READ UTILITIES (student-facing)
   Matches collections defined in firestore-schema.md exactly.
   Question snapshots / correct answers are never fetched here —
   this file only reads exam metadata and already-graded results.
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------- Upcoming exams (dashboard card) ----------
export async function getUpcomingExams() {
  const q = query(
    collection(db, "exams"),
    where("status", "in", ["upcoming", "published"]),
    orderBy("examDate", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---------- All approved results for a student, newest first ----------
export async function getApprovedResults(studentId) {
  const q = query(
    collection(db, "results"),
    where("studentId", "==", studentId),
    where("status", "==", "approved"),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---------- Single result detail (history drill-down) ----------
export async function getResultById(resultId) {
  const snap = await getDoc(doc(db, "results", resultId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------- Exam metadata lookup (name, date, etc. for a given examId) ----------
export async function getExamById(examId) {
  const snap = await getDoc(doc(db, "exams", examId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------- Immutable question snapshot for an exam (student-facing, needed to
// actually render/grade the exam client-side — see Part 10/34 security note in
// grading-utils.js and firestore.rules for why this must be publicly readable
// on a Spark-only, no-Cloud-Function architecture). ----------
export async function getExamSnapshot(examId) {
  const snap = await getDoc(doc(db, "examSnapshots", examId));
  return snap.exists() ? snap.data() : null;
}

// ---------- How many exams (of any status) reference a given chapter ----------
// Used for syllabus/chapter test-frequency — independent of any one student's results.
export async function getChapterExamFrequencyMap(chapterIds) {
  const freq = {};
  chapterIds.forEach(id => { freq[id] = 0; });
  if (chapterIds.length === 0) return freq;

  // Firestore array-contains-any supports up to 10 values per query.
  const chunks = [];
  for (let i = 0; i < chapterIds.length; i += 10) chunks.push(chapterIds.slice(i, i + 10));

  for (const chunk of chunks) {
    const q = query(collection(db, "exams"), where("chapterIds", "array-contains-any", chunk));
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      const data = d.data();
      // Only count exams that were actually delivered (or are on their way to
      // being delivered) — an unpublished draft sitting in the admin's
      // workspace hasn't "appeared in an exam" yet.
      if (data.status === "draft") return;
      (data.chapterIds || []).forEach(cid => {
        if (chunk.includes(cid)) freq[cid] = (freq[cid] || 0) + 1;
      });
    });
  }
  return freq;
}
