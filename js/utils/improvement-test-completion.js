/* Physics Lover 2.0
 * Improvement Test Completion Bridge
 * Connects a completed improvement attempt with its request lifecycle.
 * Does not change official exam results.
 */

import { db, auth } from "../firebase/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const ADMIN_EMAIL = "physicslover2312@gmail.com";

function isAdmin() {
  return auth.currentUser?.email === ADMIN_EMAIL;
}

export async function completeImprovementAttempt({
  attemptId,
  testId,
  studentId,
  requestId = null,
  result = {}
}) {
  if (!attemptId || !testId || !studentId) {
    throw new Error("attemptId, testId এবং studentId প্রয়োজন।");
  }

  const attemptRef = doc(db, "improvementAttempts", attemptId);
  const attemptSnap = await getDoc(attemptRef);

  if (!attemptSnap.exists()) {
    throw new Error("Improvement attempt পাওয়া যায়নি।");
  }

  const attempt = attemptSnap.data();

  if (attempt.studentId !== studentId) {
    throw new Error("এই attempt এই শিক্ষার্থীর নয়।");
  }

  const completedAt = serverTimestamp();

  const completedId = `${testId}_${studentId}_${Date.now()}`;
  const completedRef = doc(db, "improvementAttempts", completedId);
  const completedData = {
    ...attempt,
    status: "completed",
    completedAt,
    correct: Number(result.correct ?? attempt.correct ?? 0),
    total: Number(result.total ?? attempt.total ?? 0),
    accuracy: Number(result.accuracy ?? attempt.accuracy ?? 0),
    improvementPercent: Number(result.improvementPercent ?? attempt.improvementPercent ?? 0),
    xpEarned: Number(result.xpEarned ?? attempt.xpEarned ?? 0),
    targetReached: Boolean(result.targetReached),
    submittedAt: completedAt
  };
  await setDoc(completedRef, completedData);
  if (attemptId.endsWith("_active")) {
    await deleteDoc(attemptRef);
  }

  let resolvedRequestId = requestId || attempt.requestId || null;

  if (!resolvedRequestId) {
    resolvedRequestId = await findRequestIdFromTest(testId, studentId);
  }

  if (resolvedRequestId) {
    await updateImprovementRequestAfterCompletion(
      resolvedRequestId,
      result
    );
  }

  return {
    attemptId: completedId,
    testId,
    studentId,
    requestId: resolvedRequestId,
    status: "completed"
  };
}

async function findRequestIdFromTest(testId, studentId) {
  const testSnap = await getDoc(doc(db, "improvementTests", testId));

  if (!testSnap.exists()) return null;

  const test = testSnap.data();

  if (test.studentId && test.studentId !== studentId) return null;

  return test.requestId || null;
}

export async function updateImprovementRequestAfterCompletion(
  requestId,
  result = {}
) {
  if (!requestId) return;

  const requestRef = doc(db, "improvementRequests", requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) return;

  const request = requestSnap.data();

  const improvement = Number(result.improvementPercent ?? 0);
  const targetReached =
    result.targetReached === true ||
    improvement >= Number(request.targetImprovement ?? 0);

  await updateDoc(requestRef, {
    status: targetReached ? "resolved" : "completed",
    lastAttemptAt: serverTimestamp(),
    lastAccuracy: Number(result.accuracy ?? 0),
    lastImprovementPercent: improvement,
    targetReached,
    completedAt: serverTimestamp()
  });
}

export async function reopenImprovementRequest(requestId) {
  if (!isAdmin()) {
    throw new Error("শুধু Admin এই request আবার খুলতে পারবেন।");
  }

  if (!requestId) throw new Error("requestId প্রয়োজন।");

  await updateDoc(doc(db, "improvementRequests", requestId), {
    status: "test_required",
    targetReached: false,
    reopenedAt: serverTimestamp(),
    reopenedBy: auth.currentUser.email
  });

  return true;
}

export async function markImprovementRequestResolved(requestId) {
  if (!isAdmin()) {
    throw new Error("শুধু Admin এই request resolve করতে পারবেন।");
  }

  await updateDoc(doc(db, "improvementRequests", requestId), {
    status: "resolved",
    targetReached: true,
    resolvedAt: serverTimestamp(),
    resolvedBy: auth.currentUser.email
  });

  return true;
}

/*
 * Removes an old active-attempt marker after successful submission.
 * The test runner can call this after the completed attempt is safely written.
 */
export async function clearImprovementActiveAttempt(testId, studentId) {
  if (!testId || !studentId) return;

  const activeId = `${testId}_${studentId}_active`;
  const ref = doc(db, "improvementAttempts", activeId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  await updateDoc(ref, {
    status: "closed",
    closedAt: serverTimestamp()
  });
}
