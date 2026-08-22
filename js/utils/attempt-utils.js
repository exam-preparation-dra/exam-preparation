/* =========================================================
   ATTEMPT UTILITIES — exam-taking state machine
   Matches `attempts/{examId_studentId}` and `results/{examId_studentId}`
   in firestore-schema.md. Additive fields used here beyond the base
   schema (documented in firestore-schema.md): startedAtMillis,
   endAtMillis, currentIndex — needed for a refresh-proof, timestamp-
   based timer without a server clock (Spark-plan constraint).

   TIMER NOTE: startedAtMillis/endAtMillis use the STUDENT's device
   clock, not a trusted server clock (no Cloud Functions on Spark).
   Remaining time is always recomputed from these timestamps, never
   from a decrementing JS variable — this survives page refresh, but
   a student who changes their system clock could in principle affect
   it. Documented, not hidden — see grading-utils.js header.
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { gradeAttempt } from "./grading-utils.js";

export function attemptDocId(examId, studentId) {
  return `${examId}_${studentId}`;
}

function localKey(examId, studentId) {
  return `examAttempt_${attemptDocId(examId, studentId)}`;
}

// ---------- Local persistence (always the fastest, most reliable copy) ----------
export function saveLocalAttempt(examId, studentId, state) {
  try {
    localStorage.setItem(localKey(examId, studentId), JSON.stringify({ ...state, lastSavedAt: Date.now() }));
  } catch {
    // localStorage full/unavailable — Firestore sync below is the fallback.
  }
}

export function loadLocalAttempt(examId, studentId) {
  try {
    const raw = localStorage.getItem(localKey(examId, studentId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocalAttempt(examId, studentId) {
  try { localStorage.removeItem(localKey(examId, studentId)); } catch { /* ignore */ }
}

// ---------- Look for an existing in-progress attempt WITHOUT creating one.
// Used on page load so the intro screen can decide "resume" vs "start fresh"
// — the timer must never begin until the student explicitly presses start. ----------
export async function peekInProgressAttempt(examId, studentId) {
  const local = loadLocalAttempt(examId, studentId);
  if (local && local.status !== "submitted") return { ...local, source: "local" };

  try {
    const snap = await getDoc(doc(db, "attempts", attemptDocId(examId, studentId)));
    if (snap.exists() && snap.data().status === "in-progress") {
      const data = snap.data();
      const restored = {
        examId, studentId,
        answers: data.answers || {},
        currentIndex: data.currentIndex || 0,
        startedAtMillis: data.startedAtMillis,
        endAtMillis: data.endAtMillis,
        status: "in-progress"
      };
      saveLocalAttempt(examId, studentId, restored);
      return { ...restored, source: "firestore" };
    }
  } catch {
    // Offline — nothing to resume from remotely; local check above already covered this device.
  }
  return null;
}

// ---------- Get existing in-progress attempt, or start a fresh one.
// Only call this AFTER the student has explicitly pressed "পরীক্ষা শুরু করুন"
// (or when peekInProgressAttempt() already confirmed one exists to resume). ----------
export async function getOrStartAttempt(examId, studentId, durationMinutes) {
  const existing = await peekInProgressAttempt(examId, studentId);
  if (existing) return existing;

  const startedAtMillis = Date.now();
  const endAtMillis = startedAtMillis + durationMinutes * 60 * 1000;
  const fresh = { examId, studentId, answers: {}, currentIndex: 0, startedAtMillis, endAtMillis, status: "in-progress" };
  saveLocalAttempt(examId, studentId, fresh);

  try {
    await setDoc(doc(db, "attempts", attemptDocId(examId, studentId)), {
      examId, studentId, durationMinutes,
      startedAtMillis, endAtMillis,
      answers: {}, currentIndex: 0,
      status: "in-progress",
      lastSyncedAt: serverTimestamp()
    });
  } catch {
    // Offline at start time — local copy above is enough to continue.
  }

  return { ...fresh, source: "new" };
}

// ---------- Debounced Firestore sync (Part 6: never write every keystroke) ----------
let syncTimer = null;
export function syncToFirestoreDebounced(examId, studentId, partialData, delayMs = 2500) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      await updateDoc(doc(db, "attempts", attemptDocId(examId, studentId)), {
        ...partialData,
        lastSyncedAt: serverTimestamp()
      });
    } catch {
      // Offline — local copy already has the latest state; will retry on next change.
    }
  }, delayMs);
}

// ---------- Final submission: grade, write pending result, lock the attempt ----------
export async function submitAttempt({ examId, studentId, examName, snapshotQuestions, answers, startedAtMillis }) {
  const submittedAtMillis = Date.now();
  const grade = gradeAttempt({ snapshotQuestions, answers, startedAtMillis, submittedAtMillis });
  const id = attemptDocId(examId, studentId);

  await setDoc(doc(db, "results", id), {
    examId, studentId, examName: examName || "",
    submittedAt: serverTimestamp(),
    totalQuestions: grade.totalQuestions,
    attempted: grade.attempted,
    correctCount: grade.correctCount,
    wrongCount: grade.wrongCount,
    unansweredCount: grade.unansweredCount,
    obtainedMarks: grade.obtainedMarks,
    totalMarks: grade.totalMarks,
    percentage: grade.percentage,
    accuracy: grade.accuracy,
    timeTakenSeconds: grade.timeTakenSeconds,
    avgTimePerQuestionSeconds: grade.avgTimePerQuestionSeconds,
    subjectBreakdown: grade.subjectBreakdown,
    chapterBreakdown: grade.chapterBreakdown,
    topicBreakdown: grade.topicBreakdown,
    answers,
    status: "pending",
    approvedAt: null
  });

  await setDoc(doc(db, "attempts", id), {
    examId, studentId, answers,
    status: "submitted",
    submittedAtMillis,
    lastSyncedAt: serverTimestamp()
  }, { merge: true });

  clearLocalAttempt(examId, studentId);
  return { resultId: id, ...grade };
}

// ---------- Has this student already submitted this exam? (prevents second attempt) ----------
export async function getExistingResult(examId, studentId) {
  const snap = await getDoc(doc(db, "results", attemptDocId(examId, studentId)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
