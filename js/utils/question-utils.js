/* =========================================================
   QUESTION BANK UTILITIES
   Matches `questions/{questionId}` in firestore-schema.md exactly.
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit, startAfter, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const PAGE_SIZE = 20;

// ---------- Create ----------
export async function addQuestion(data) {
  return addDoc(collection(db, "questions"), {
    question_en: data.question_en,
    question_bn: data.question_bn,
    options_bn: data.options_bn,          // { A, B, C, D }
    correctAnswer: data.correctAnswer,     // "A" | "B" | "C" | "D"
    marks: data.marks ?? 1,
    subjectId: data.subjectId,
    chapterId: data.chapterId,
    topicId: data.topicId,
    imageUrl: data.imageUrl ?? null,
    explanation_bn: data.explanation_bn ?? null,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// ---------- Update ----------
export async function updateQuestion(id, data) {
  return updateDoc(doc(db, "questions", id), { ...data, updatedAt: serverTimestamp() });
}

// ---------- Soft disable / re-enable (safer than hard delete — see requirement #17) ----------
export async function setQuestionActive(id, isActive) {
  return updateDoc(doc(db, "questions", id), { isActive, updatedAt: serverTimestamp() });
}

// ---------- Hard delete — only safe for questions never used in any exam snapshot.
// Caller (UI) is responsible for the "not referenced anywhere" check before calling this. ----------
export async function deleteQuestion(id) {
  return deleteDoc(doc(db, "questions", id));
}

// ---------- Duplicate an existing question ----------
export async function duplicateQuestion(question) {
  const { id, createdAt, updatedAt, ...rest } = question;
  return addQuestion(rest);
}

// ---------- Single question ----------
export async function getQuestionById(id) {
  const snap = await getDoc(doc(db, "questions", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------- Paginated, filterable list (performance: requirement #58/#18) ----------
// Firestore has no native full-text search, so free-text search is applied client-side
// on the currently loaded page — documented here rather than pretending it's
// server-side full-text search. Subject/chapter/topic filters ARE server-side (indexed).
export async function getQuestionsPage({ subjectId, chapterId, topicId, activeOnly = true, cursor = null } = {}) {
  const clauses = [];
  if (activeOnly) clauses.push(where("isActive", "==", true));
  if (subjectId) clauses.push(where("subjectId", "==", subjectId));
  if (chapterId) clauses.push(where("chapterId", "==", chapterId));
  if (topicId) clauses.push(where("topicId", "==", topicId));
  clauses.push(orderBy("createdAt", "desc"));
  clauses.push(limit(PAGE_SIZE));
  if (cursor) clauses.push(startAfter(cursor));

  const snap = await getDocs(query(collection(db, "questions"), ...clauses));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const nextCursor = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;
  return { items, nextCursor };
}

// ---------- Client-side text filter over an already-loaded page ----------
export function filterByText(items, text) {
  if (!text || !text.trim()) return items;
  const t = text.trim().toLowerCase();
  return items.filter(q =>
    (q.question_en || "").toLowerCase().includes(t) ||
    (q.question_bn || "").toLowerCase().includes(t)
  );
}

// ---------- Fetch a specific set of question IDs (exam creation: selected list) ----------
export async function getQuestionsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const results = [];
  const snaps = await Promise.all(ids.map(id => getDoc(doc(db, "questions", id))));
  snaps.forEach(s => { if (s.exists()) results.push({ id: s.id, ...s.data() }); });
  return results;
}
