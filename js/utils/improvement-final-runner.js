/* Physics Lover 2.0 — Final Improvement Runner Bridge */
import {
  createOrResumeImprovementAttempt,
  saveImprovementAttemptProgress,
  closeActiveImprovementAttempt
} from "./improvement-attempt-utils.js";
import { finalizeStudentImprovement } from "./improvement-student-completion.js";
import { computeImprovementPracticeXP } from "./xp-utils.js";

let state = null;

export async function startImprovementRun({
  testId, studentId, requestId = null, total = 0, durationMinutes = null
}) {
  state = await createOrResumeImprovementAttempt({
    testId, studentId, requestId, total, durationMinutes
  });
  return state;
}

export async function saveImprovementRunProgress(testId, studentId, answers) {
  await saveImprovementAttemptProgress(testId, studentId, answers);
  if (state) state.answers = answers || {};
}

export async function submitImprovementRun({
  attemptId, testId, studentId, requestId = null,
  correct = 0, total = 0, attempted = 0,
  previousAccuracy = 0, accuracy = 0, targetAccuracy = 0,
  attemptNumber = 1
}) {
  const improvementPercent = Math.max(
    0, Number(accuracy || 0) - Number(previousAccuracy || 0)
  );

  const xp = computeImprovementPracticeXP({
    totalQuestions: total,
    attempted,
    correctCount: correct,
    percentage: accuracy,
    targetReached: Number(accuracy || 0) >= Number(targetAccuracy || 0),
    improvementPoints: improvementPercent,
    attemptNumber
  });

  const result = await finalizeStudentImprovement({
    attemptId, testId, requestId,
    correct, total, accuracy, improvementPercent,
    xpEarned: xp.xp,
    targetReached: Number(accuracy || 0) >= Number(targetAccuracy || 0)
  });

  await closeActiveImprovementAttempt(testId, studentId);
  state = null;

  return { ...result, xp, improvementPercent };
}

export function getImprovementRunState() {
  return state;
}
