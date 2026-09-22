/* Physics Lover 2.0 — Final XP Integration
 * Official exam XP remains the existing XP source.
 * Improvement Practice XP is added exactly once from completed attempts.
 */
import { db } from "/js/firebase/firebase-config.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { computeStudentXP } from "./xp-utils.js";

const n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;

export async function getCompletedImprovementPractices(studentId) {
  if (!studentId) return [];
  const q = query(
    collection(db, "improvementAttempts"),
    where("studentId", "==", studentId),
    where("status", "==", "completed")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function buildStudentXP({
  officialResults = [],
  studentId,
  referralCount = 0,
  challengeBonusXP = 0
} = {}) {
  const practices = await getCompletedImprovementPractices(studentId);

  const improvementPracticeResults = practices.map(p => ({
    ...p,
    totalQuestions: n(p.totalQuestions, n(p.total)),
    attempted: n(p.attempted, n(p.total)),
    correctCount: n(p.correctCount, n(p.correct)),
    percentage: n(p.accuracy),
    targetReached: p.targetReached === true,
    improvementPoints: n(p.improvementPercent),
    attemptNumber: n(p.attemptNumber, 1),
    status: "completed"
  }));

  return computeStudentXP(officialResults, {
    referralCount,
    challengeBonusXP,
    improvementPracticeResults
  });
}
