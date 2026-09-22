/* Physics Lover 2.0
 * Improvement Test Runner Integration
 * Connects the existing improvement-test.html runner with the
 * attempt lifecycle, completion bridge, XP refresh, and profile refresh.
 *
 * This file is an integration helper. It does not replace the runner UI.
 */

import {
  createOrResumeImprovementAttempt,
  saveImprovementAttemptProgress,
  closeActiveImprovementAttempt
} from "./improvement-attempt-utils.js";

import { finalizeStudentImprovement } from "./improvement-student-completion.js";

import { computeImprovementPracticeXP } from "./xp-utils.js";

let currentAttempt = null;

export async function startIntegratedImprovementAttempt({
  testId,
  studentId,
  requestId = null,
  total = 0,
  durationMinutes = null
}) {
  currentAttempt = await createOrResumeImprovementAttempt({
    testId,
    studentId,
    requestId,
    total,
    durationMinutes
  });

  return currentAttempt;
}

export async function saveIntegratedProgress({
  testId,
  studentId,
  answers
}) {
  await saveImprovementAttemptProgress(
    testId,
    studentId,
    answers
  );

  if (currentAttempt) {
    currentAttempt.answers = answers || {};
  }

  return true;
}

export async function finishIntegratedImprovementAttempt({
  attemptId,
  testId,
  requestId = null,
  studentId,
  correct,
  total,
  previousAccuracy = 0,
  accuracy = 0,
  targetAccuracy = 0,
  repeatAttempt = false
}) {
  const xpResult = computeImprovementPracticeXP({
    correct: Number(correct || 0),
    total: Number(total || 0),
    accuracy: Number(accuracy || 0),
    targetReached: Number(accuracy || 0) >= Number(targetAccuracy || 0),
    improvementPercent: Math.max(
      0,
      Number(accuracy || 0) - Number(previousAccuracy || 0)
    ),
    repeatAttempt: Boolean(repeatAttempt)
  });

  const improvementPercent = Math.max(
    0,
    Number(accuracy || 0) - Number(previousAccuracy || 0)
  );

  const completed = await finalizeStudentImprovement({
    attemptId,
    testId,
    requestId,
    correct,
    total,
    accuracy,
    improvementPercent,
    xpEarned: Number(xpResult?.xp || 0),
    targetReached:
      Number(accuracy || 0) >= Number(targetAccuracy || 0)
  });

  await closeActiveImprovementAttempt(
    testId,
    studentId
  );

  currentAttempt = null;

  return {
    ...completed,
    xp: xpResult,
    improvementPercent
  };
}

export function getCurrentIntegratedAttempt() {
  return currentAttempt;
}

export function clearIntegratedAttemptState() {
  currentAttempt = null;
}
