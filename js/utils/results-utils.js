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

// ---------- Which exams has this student already submitted a result for?
// (dashboard "Enter Exam" gating — once submitted, don't invite re-entry) ----------
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

// ---------- Upcoming exams (dashboard card) ----------
// NOTE: no Firestore orderBy() here — combining an "in" filter (status) with
// orderBy() on a different field (examDate) needs a manually-created
// composite index in the Firebase console. If that index is missing,
// Firestore throws instead of returning results, and this whole card fails
// with "লোড করা যায়নি" — exactly the bug this fixes. Sort client-side instead.
export async function getUpcomingExams() {
  const q = query(collection(db, "exams"), where("status", "in", ["upcoming", "published"]));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.examDate?.toMillis?.() ?? 0) - (b.examDate?.toMillis?.() ?? 0));
}

// ---------- LIVE SYNC version of getUpcomingExams() above — same exact
// filter ("upcoming"/"published" status) and same client-side sort by
// examDate, just delivered via onSnapshot instead of a one-time getDocs().
// This fixes: admin publishes/creates an exam -> student dashboard updates
// instantly, no manual refresh needed.
//
// Usage (dashboard.html):
//   const unsubscribe = subscribeToUpcomingExams((exams) => { ...render... });
//   // optionally call unsubscribe() when leaving the page
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

// ---------- All approved results for a student, newest first ----------
// Same reasoning as above: two equality filters (studentId, status) PLUS
// orderBy(submittedAt) needs a composite index. Fetch with filters only,
// sort here.
// ---------- ALL approved results across every student (admin class-wide analytics) ----------
// Same no-orderBy reasoning as everywhere else in this file — sort client-side.
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

// ---------- Single result detail (history drill-down) ----------
export async function getResultById(resultId) {
  const snap = await getDoc(doc(db, "results", resultId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------- Full leaderboard: Sorted by POINTS now instead of just average ----------
export async function getLeaderboardData(studentsList) {
  const results = await getAllApprovedResults();
  const byStudent = {};
  for (const r of results) {
    if (!byStudent[r.studentId]) byStudent[r.studentId] = [];
    byStudent[r.studentId].push(Number(r.percentage) || 0);
  }
  const infoOf = {};
  studentsList.forEach(s => { infoOf[s.studentId] = s; });

  const rows = Object.entries(byStudent).map(([studentId, pcts]) => {
    const sumPct = pcts.reduce((a, b) => a + b, 0);
    const avgPercentage = Math.round((sumPct / pcts.length) * 10) / 10;
    // Point formula: 1 point per 1% scored, plus 50 bonus points per exam taken
    const totalPoints = Math.round(sumPct + (pcts.length * 50));
    
    return {
      studentId,
      name: infoOf[studentId]?.name || studentId,
      photoURL: infoOf[studentId]?.photoURL || null,
      className: infoOf[studentId]?.className || null,
      avgPercentage,
      examsTaken: pcts.length,
      totalPoints
    };
  });
  
  // Sort by Points
  rows.sort((a, b) => b.totalPoints - a.totalPoints);
  return rows;
}

export async function getStudentRank(studentId, classOf = null) {
  const all = await getAllApprovedResults();
  if (all.length === 0) return null;

  const byStudent = {};
  for (const r of all) {
    if (!byStudent[r.studentId]) byStudent[r.studentId] = [];
    byStudent[r.studentId].push(Number(r.percentage) || 0);
  }

  const stats = Object.entries(byStudent).map(([sid, pcts]) => {
    const sumPct = pcts.reduce((sum, p) => sum + p, 0);
    return {
      studentId: sid,
      average: sumPct / pcts.length,
      totalPoints: Math.round(sumPct + (pcts.length * 50))
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

// ---------- Batch snapshot fetch for a set of results, keyed by examId.
// Needed for any per-question analysis (time management, wrong-option
// patterns, marked-for-review accuracy) since results only store the
// student's answers/times/marks by questionId — subjectId/chapterId/topicId
// and correctAnswer live only in the frozen snapshot. Missing snapshots
// (e.g. an exam later deleted) are simply omitted rather than thrown. ----------
export async function getExamSnapshotsMap(examIds) {
  const uniqueIds = [...new Set(examIds)];
  const snaps = await Promise.all(uniqueIds.map(id => getExamSnapshot(id)));
  const map = {};
  uniqueIds.forEach((id, i) => { if (snaps[i]) map[id] = snaps[i]; });
  return map;
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
