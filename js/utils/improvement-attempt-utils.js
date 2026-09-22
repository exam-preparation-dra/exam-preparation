/* Physics Lover 2.0
 * Improvement Attempt Utilities
 * Handles active-attempt lifecycle and reliable attempt counting.
 */

import { db } from "../firebase/firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

function activeAttemptId(testId, studentId) {
  return `${testId}_${studentId}_active`;
}

export async function getActiveImprovementAttempt(testId, studentId) {
  if (!testId || !studentId) return null;

  const ref = doc(
    db,
    "improvementAttempts",
    activeAttemptId(testId, studentId)
  );

  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();

  if (data.status === "closed" || data.status === "completed") {
    return null;
  }

  return { id: snap.id, ...data };
}

export async function createOrResumeImprovementAttempt({
  testId,
  studentId,
  requestId = null,
  total = 0,
  durationMinutes = null
}) {
  if (!testId || !studentId) {
    throw new Error("testId এবং studentId প্রয়োজন।");
  }

  const id = activeAttemptId(testId, studentId);
  const ref = doc(db, "improvementAttempts", id);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const data = existing.data();

    if (data.status !== "closed" && data.status !== "completed") {
      return { id, ...data, resumed: true };
    }
  }

  const attemptNumber = await getNextImprovementAttemptNumber(
    testId,
    studentId
  );

  const payload = {
    testId,
    studentId,
    requestId,
    attemptNumber,
    total: Number(total || 0),
    answers: {},
    status: "in_progress",
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (durationMinutes != null) {
    payload.durationMinutes = Number(durationMinutes);
  }

  await setDoc(ref, payload);

  return {
    id,
    ...payload,
    resumed: false
  };
}

export async function getNextImprovementAttemptNumber(testId, studentId) {
  const q = query(
    collection(db, "improvementAttempts"),
    where("testId", "==", testId),
    where("studentId", "==", studentId)
  );

  const snap = await getDocs(q);

  let maxNumber = 0;

  snap.forEach((item) => {
    const data = item.data();

    if (item.id.endsWith("_active")) return;

    const n = Number(data.attemptNumber || 0);
    if (Number.isFinite(n) && n > maxNumber) {
      maxNumber = n;
    }
  });

  return maxNumber + 1;
}

export async function saveImprovementAttemptProgress(
  testId,
  studentId,
  answers
) {
  if (!testId || !studentId) return;

  const ref = doc(
    db,
    "improvementAttempts",
    activeAttemptId(testId, studentId)
  );

  await updateDoc(ref, {
    answers: answers || {},
    updatedAt: serverTimestamp()
  });
}

export async function closeActiveImprovementAttempt(testId, studentId) {
  if (!testId || !studentId) return;

  const ref = doc(
    db,
    "improvementAttempts",
    activeAttemptId(testId, studentId)
  );

  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  await updateDoc(ref, {
    status: "closed",
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
