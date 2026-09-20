/* =========================================================
   RESULTS & EXAM READ UTILITIES (student-facing & Admin helpers)
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import { collection, doc, getDoc, getDocs, query, where, onSnapshot, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getActiveStudents, buildReferralCountMap } from "./student-utils.js";
import { computeStudentXP, compareRank } from "./xp-utils.js";

// ---------- SMART AUTO APPROVAL LOGIC (Error Proof) ----------
export async function autoApproveOldResults() {
  try {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const q = query(collection(db, "results"), where("status", "==", "pending"));
    const snap = await getDocs(q);

    if (snap.empty) return 0;

    const batch = writeBatch(db);
    let count = 0;

    snap.docs.forEach(d => {
      const data = d.data();
      // Safely check if it's a valid Firebase Timestamp
      if (data.submittedAt && typeof data.submittedAt.toMillis === 'function') {
        const elapsed = now - data.submittedAt.toMillis();
        if (elapsed >= ONE_DAY_MS) {
          batch.update(d.ref, { status: "approved", approvedAt: serverTimestamp(), autoApproved: true });
          count++;
        }
      }
    });

    if (count > 0) {
      await batch.commit();
    }
    return count;
  } catch(err) {
    console.error("Auto approval background task failed:", err);
    return 0; // Prevent crash
  }
}

export async function getStudentResultStatusMap(studentId) {
  const q = query(collection(db, "results"), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  const map = {};
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  snap.docs.forEach(d => { 
    const data = d.data(); 
    let status = data.status;
    // Virtual approval for students if 24 hours have passed
    if (status === "pending" && data.submittedAt && typeof data.submittedAt.toMillis === 'function' && (now - data.submittedAt.toMillis()) >= ONE_DAY_MS) {
      status = "approved";
    }
    map[data.examId] = { status: status, resultId: d.id }; 
  });
  return map;
}

export async function getUpcomingExams() {
  const q = query(collection(db, "exams"), where("status", "in", ["upcoming", "published"]));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.examDate?.toMillis?.() ?? 0) - (b.examDate?.toMillis?.() ?? 0));
}

export function subscribeToUpcomingExams(onChange, onError) {
  const q = query(collection(db, "exams"), where("status", "in", ["upcoming", "published"]));
  return onSnapshot(q, (snap) => {
      const exams = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.examDate?.toMillis?.() ?? 0) - (b.examDate?.toMillis?.() ?? 0));
      onChange(exams);
    }, (err) => { if (onError) onError(err); }
  );
}

export async function getAllApprovedResults() {
  // Using 'in' is safer and doesn't require composite indexes
  const q = query(collection(db, "results"), where("status", "in", ["approved", "pending"]));
  const snap = await getDocs(q);
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.status === "approved" || (r.status === "pending" && r.submittedAt && typeof r.submittedAt.toMillis === 'function' && (now - r.submittedAt.toMillis()) >= ONE_DAY_MS))
    .sort((a, b) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0));
}

export async function getApprovedResults(studentId) {
  const q = query(collection(db, "results"), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.status === "approved" || (r.status === "pending" && r.submittedAt && typeof r.submittedAt.toMillis === 'function' && (now - r.submittedAt.toMillis()) >= ONE_DAY_MS))
    .sort((a, b) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0));
}

export async function getResultById(resultId) {
  const snap = await getDoc(doc(db, "results", resultId)); 
  if (!snap.exists()) return null;
  const data = snap.data();
  // Virtual Approval Check
  if (data.status === "pending" && data.submittedAt && typeof data.submittedAt.toMillis === 'function') {
    if (Date.now() - data.submittedAt.toMillis() >= 24 * 60 * 60 * 1000) {
      data.status = "approved";
      data.autoApproved = true;
    }
  }
  return { id: snap.id, ...data };
}

// ---------- GAMING XP LOGIC ----------
// All the maths lives in xp-utils.js (one source of truth). This file only
// gathers the data and turns it into leaderboard rows.
export { REFERRAL_XP } from "./xp-utils.js";

// results (everyone's) + active students -> { studentId: computeStudentXP(...) }
// A student appears if they have counted results, or if they are an active
// student who referred someone (so the referral XP is never lost).
function buildStatsByStudent(results, studentsList) {
  const referralCounts = buildReferralCountMap(studentsList);
  const activeIds = new Set(studentsList.map(s => s.studentId));
  const grouped = {};
  for (const r of results) { (grouped[r.studentId] ||= []).push(r); }
  Object.keys(referralCounts).forEach(sid => {
    if (activeIds.has(sid) && !grouped[sid]) grouped[sid] = [];
  });
  const stats = {};
  for (const [sid, list] of Object.entries(grouped)) {
    stats[sid] = computeStudentXP(list, { referralCount: referralCounts[sid] || 0 });
  }
  return stats;
}

export async function getLeaderboardData(studentsList) {
  const results = await getAllApprovedResults();
  const stats = buildStatsByStudent(results, studentsList);

  const infoOf = {};
  studentsList.forEach(s => { infoOf[s.studentId] = s; });

  const rows = Object.entries(stats).map(([studentId, st]) => ({
    studentId, name: infoOf[studentId]?.name || studentId, photoURL: infoOf[studentId]?.photoURL || null, className: infoOf[studentId]?.className || null,
    avgPercentage: st.avgPercentage, examsTaken: st.examsTaken, totalPoints: st.totalXP, level: st.level,
    referralCount: st.referralCount, referralBonus: st.referralXP, xpBreakdown: st.breakdown
  }));

  rows.sort(compareRank);
  return rows;
}

// studentsList is optional — pass the already-loaded list (e.g. from
// getActiveStudents()) to avoid a duplicate fetch when the caller has one;
// otherwise this fetches it itself so referral counts are always included.
export async function getStudentRank(studentId, classOf = null, studentsList = null) {
  const [all, students] = await Promise.all([
    getAllApprovedResults(),
    studentsList || getActiveStudents()
  ]);
  const byStudent = buildStatsByStudent(all, students);
  if (!byStudent[studentId]) return null;

  const nameOf = {};
  students.forEach(s => { nameOf[s.studentId] = s.name; });
  const stats = Object.entries(byStudent).map(([sid, st]) => ({
    studentId: sid, name: nameOf[sid] || sid, average: st.avgPercentage, avgPercentage: st.avgPercentage, examsTaken: st.examsTaken,
    totalPoints: st.totalXP, level: st.level, referralCount: st.referralCount, referralBonus: st.referralXP
  }));

  stats.sort(compareRank);
  const rank = stats.findIndex(a => a.studentId === studentId) + 1;
  const mine = stats.find(a => a.studentId === studentId);
  const result = { rank, totalStudents: stats.length, averagePercentage: mine.average, totalPoints: mine.totalPoints, level: mine.level, referralCount: mine.referralCount, referralBonus: mine.referralBonus };

  if (classOf) {
    const myClass = classOf[studentId];
    if (myClass) {
      const classStats = stats.filter(a => classOf[a.studentId] === myClass);
      const classRank = classStats.findIndex(a => a.studentId === studentId) + 1;
      if (classRank > 0) { result.classRank = classRank; result.classTotalStudents = classStats.length; result.className = myClass; }
    }
  }
  return result;
}

export async function getExamById(examId) { const snap = await getDoc(doc(db, "exams", examId)); return snap.exists() ? { id: snap.id, ...snap.data() } : null; }
export async function getExamSnapshot(examId) { const snap = await getDoc(doc(db, "examSnapshots", examId)); return snap.exists() ? snap.data() : null; }
export async function getExamSnapshotsMap(examIds) { const uniqueIds = [...new Set(examIds)]; const snaps = await Promise.all(uniqueIds.map(id => getExamSnapshot(id))); const map = {}; uniqueIds.forEach((id, i) => { if (snaps[i]) map[id] = snaps[i]; }); return map; }
export async function getChapterExamFrequencyMap(chapterIds) {
  const freq = {}; chapterIds.forEach(id => { freq[id] = 0; }); if (chapterIds.length === 0) return freq;
  const chunks = []; for (let i = 0; i < chapterIds.length; i += 10) chunks.push(chapterIds.slice(i, i + 10));
  for (const chunk of chunks) {
    const q = query(collection(db, "exams"), where("chapterIds", "array-contains-any", chunk));
    const snap = await getDocs(q);
    snap.docs.forEach(d => { const data = d.data(); if (data.status === "draft") return; (data.chapterIds || []).forEach(cid => { if (chunk.includes(cid)) freq[cid] = (freq[cid] || 0) + 1; }); });
  }
  return freq;
                    }
       
