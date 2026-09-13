/* =========================================================
   RESULTS & EXAM READ UTILITIES (student-facing)
   Matches collections defined in firestore-schema.md exactly.
   Question snapshots / correct answers are never fetched here —
   this file only reads exam metadata and already-graded results.
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, getDoc, getDocs, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export async function getStudentResultStatusMap(studentId) {
  const q = query(collection(db, "results"), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  const map = {};
  snap.docs.forEach(d => {
    const data = d.data();
    map[data.examId] = { status: data.status, resultId: d.id };
  });
  return map;
}

export async function getUpcomingExams() {
  const q = query(collection(db, "exams"), where("status", "in", ["upcoming", "published"]));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.examDate?.toMillis?.() ?? 0) - (b.examDate?.toMillis?.() ?? 0));
}

export function subscribeToUpcomingExams(onChange, onError) {
  const q = query(collection(db, "exams"), where("status", "in", ["upcoming", "published"]));
  return onSnapshot(
    q,
    (snap) => {
      const exams = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.examDate?.toMillis?.() ?? 0) - (b.examDate?.toMillis?.() ?? 0));
      onChange(exams);
    },
    (err) => {
      console.error("subscribeToUpcomingExams error:", err);
      if (onError) onError(err);
    }
  );
}

export async function getAllApprovedResults() {
  const q = query(collection(db, "results"), where("status", "==", "approved"));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0));
}

export async function getApprovedResults(studentId) {
  const q = query(
    collection(db, "results"),
    where("studentId", "==", studentId),
    where("status", "==", "approved")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0));
}

export async function getResultById(resultId) {
  const snap = await getDoc(doc(db, "results", resultId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------- ADVANCED POINT SYSTEM ----------
// Points = Sum of % + (Exams * 50) + (Total Correct Answers * 2)
export async function getLeaderboardData(studentsList) {
  const results = await getAllApprovedResults();
  const byStudent = {};
  for (const r of results) {
    if (!byStudent[r.studentId]) byStudent[r.studentId] = { pcts: [], correctCount: 0 };
    byStudent[r.studentId].pcts.push(Number(r.percentage) || 0);
    byStudent[r.studentId].correctCount += (Number(r.correctCount) || 0);
  }
  const infoOf = {};
  studentsList.forEach(s => { infoOf[s.studentId] = s; });

  const rows = Object.entries(byStudent).map(([studentId, data]) => {
    const sumPct = data.pcts.reduce((a, b) => a + b, 0);
    const avgPercentage = Math.round((sumPct / data.pcts.length) * 10) / 10;
    
    // Dynamic Point Calculation
    const totalPoints = Math.round(sumPct + (data.pcts.length * 50) + (data.correctCount * 2));
    
    return {
      studentId,
      name: infoOf[studentId]?.name || studentId,
      photoURL: infoOf[studentId]?.photoURL || null,
      className: infoOf[studentId]?.className || null,
      avgPercentage,
      examsTaken: data.pcts.length,
      totalPoints: totalPoints || 0
    };
  });
  
  rows.sort((a, b) => b.totalPoints - a.totalPoints);
  return rows;
}

export async function getStudentRank(studentId, classOf = null) {
  const all = await getAllApprovedResults();
  if (all.length === 0) return null;

  const byStudent = {};
  for (const r of all) {
    if (!byStudent[r.studentId]) byStudent[r.studentId] = { pcts: [], correctCount: 0 };
    byStudent[r.studentId].pcts.push(Number(r.percentage) || 0);
    byStudent[r.studentId].correctCount += (Number(r.correctCount) || 0);
  }

  const stats = Object.entries(byStudent).map(([sid, data]) => {
    const sumPct = data.pcts.reduce((sum, p) => sum + p, 0);
    return {
      studentId: sid,
      average: sumPct / data.pcts.length,
      totalPoints: Math.round(sumPct + (data.pcts.length * 50) + (data.correctCount * 2)) || 0
    };
  });

  if (!stats.some(a => a.studentId === studentId)) return null;

  stats.sort((a, b) => b.totalPoints - a.totalPoints);
  const rank = stats.findIndex(a => a.studentId === studentId) + 1;
  const mine = stats.find(a => a.studentId === studentId);
  const result = { rank, totalStudents: stats.length, averagePercentage: Math.round(mine.average * 10) / 10, totalPoints: mine.totalPoints };

  if (classOf) {
    const myClass = classOf[studentId];
    if (myClass) {
      const classStats = stats.filter(a => classOf[a.studentId] === myClass);
      const classRank = classStats.findIndex(a => a.studentId === studentId) + 1;
      if (classRank > 0) {
        result.classRank = classRank;
        result.classTotalStudents = classStats.length;
        result.className = myClass;
      }
    }
  }
  return result;
}

export async function getExamById(examId) {
  const snap = await getDoc(doc(db, "exams", examId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getExamSnapshot(examId) {
  const snap = await getDoc(doc(db, "examSnapshots", examId));
  return snap.exists() ? snap.data() : null;
}

export async function getExamSnapshotsMap(examIds) {
  const uniqueIds = [...new Set(examIds)];
  const snaps = await Promise.all(uniqueIds.map(id => getExamSnapshot(id)));
  const map = {};
  uniqueIds.forEach((id, i) => { if (snaps[i]) map[id] = snaps[i]; });
  return map;
}

export async function getChapterExamFrequencyMap(chapterIds) {
  const freq = {};
  chapterIds.forEach(id => { freq[id] = 0; });
  if (chapterIds.length === 0) return freq;

  const chunks = [];
  for (let i = 0; i < chapterIds.length; i += 10) chunks.push(chapterIds.slice(i, i + 10));

  for (const chunk of chunks) {
    const q = query(collection(db, "exams"), where("chapterIds", "array-contains-any", chunk));
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.status === "draft") return;
      (data.chapterIds || []).forEach(cid => {
        if (chunk.includes(cid)) freq[cid] = (freq[cid] || 0) + 1;
      });
    });
  }
  return freq;
     }
