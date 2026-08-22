/* =========================================================
   SYLLABUS UTILITIES — Subject → Chapter → Topic
   Matches collections defined in firestore-schema.md exactly.
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, getDocs, getDoc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------- Subjects ----------
// NOTE: no Firestore orderBy() when activeOnly filter is used — an equality
// filter (isActive) combined with orderBy() on a different field (order)
// needs a manually-created composite index, and a missing index makes the
// query fail silently from the caller's point of view (see results-utils.js
// fix). Sorting client-side avoids needing any index here, ever.
export async function getSubjects(activeOnly = false) {
  const base = collection(db, "subjects");
  const q = activeOnly ? query(base, where("isActive", "==", true)) : query(base, orderBy("order"));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return activeOnly ? items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : items;
}

export async function addSubject({ name_en, name_bn, order }) {
  return addDoc(collection(db, "subjects"), {
    name_en, name_bn, order: order ?? 0, isActive: true, createdAt: serverTimestamp()
  });
}

export async function updateSubject(id, data) {
  return updateDoc(doc(db, "subjects", id), data);
}

export async function setSubjectActive(id, isActive) {
  return updateDoc(doc(db, "subjects", id), { isActive });
}

// ---------- Chapters ----------
// Same reasoning as getSubjects() above: no Firestore orderBy() combined
// with the equality filters (subjectId/isActive) — sort client-side instead
// so no composite index is ever required.
export async function getChapters(subjectId = null, activeOnly = false) {
  const base = collection(db, "chapters");
  const clauses = [];
  if (subjectId) clauses.push(where("subjectId", "==", subjectId));
  if (activeOnly) clauses.push(where("isActive", "==", true));
  const snap = await getDocs(query(base, ...clauses));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function addChapter({ subjectId, name_en, name_bn, order }) {
  return addDoc(collection(db, "chapters"), {
    subjectId, name_en, name_bn, order: order ?? 0, isActive: true, createdAt: serverTimestamp()
  });
}

export async function updateChapter(id, data) {
  return updateDoc(doc(db, "chapters", id), data);
}

export async function setChapterActive(id, isActive) {
  return updateDoc(doc(db, "chapters", id), { isActive });
}

// ---------- Topics ----------
export async function getTopics(chapterId = null, activeOnly = false) {
  const base = collection(db, "topics");
  const clauses = [];
  if (chapterId) clauses.push(where("chapterId", "==", chapterId));
  if (activeOnly) clauses.push(where("isActive", "==", true));
  const snap = await getDocs(query(base, ...clauses));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addTopic({ chapterId, subjectId, name_en, name_bn }) {
  return addDoc(collection(db, "topics"), {
    chapterId, subjectId, name_en, name_bn, isActive: true, createdAt: serverTimestamp()
  });
}

export async function updateTopic(id, data) {
  return updateDoc(doc(db, "topics", id), data);
}

export async function setTopicActive(id, isActive) {
  return updateDoc(doc(db, "topics", id), { isActive });
}

// ---------- Convenience: full tree, for admin syllabus page + student progress page ----------
export async function getFullSyllabusTree() {
  const [subjects, chapters, topics] = await Promise.all([
    getSubjects(), getChapters(), getTopics()
  ]);
  return subjects.map(subject => ({
    ...subject,
    chapters: chapters
      .filter(c => c.subjectId === subject.id)
      .map(chapter => ({
        ...chapter,
        topics: topics.filter(t => t.chapterId === chapter.id)
      }))
  }));
}

// ---------- Lookup maps (id -> bn name) — used to label results/exams without extra reads ----------
export function buildNameMap(items) {
  const map = {};
  items.forEach(i => { map[i.id] = i.name_bn; });
  return map;
}
   
