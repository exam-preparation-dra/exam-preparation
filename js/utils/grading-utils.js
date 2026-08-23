/* =========================================================
   GRADING UTILITIES — centralized calculation only.
   No Firestore reads/writes happen in this file — pure functions.

   IMPORTANT (Spark-plan / Part 10 requirement):
   This grading runs entirely in the student's browser because the
   project has no Cloud Function and stays on the Firebase free plan.
   That means it is NOT tamper-proof — a technically sophisticated
   student could in principle alter the calculation client-side.
   This is a documented, deliberate trade-off for a small private
   preparation platform, not a claim of secure/enterprise-grade
   grading. See firestore.rules and README for the full explanation.
   ========================================================= */

// ---------- Core grading, given the immutable snapshot + student answers ----------
// snapshotQuestions: examSnapshots/{examId}.questions (ordered array)
// answers: { questionId: "A"|"B"|"C"|"D"|null }
export function gradeAttempt({ snapshotQuestions, answers, startedAtMillis, submittedAtMillis }) {
  let correctCount = 0, wrongCount = 0, unansweredCount = 0;
  let obtainedMarks = 0, totalMarks = 0;

  const subjectMap = {};
  const chapterMap = {};
  const topicMap = {};

  function bump(map, key, isCorrect, isWrong, marks, questionMarks) {
    if (!key) return;
    if (!map[key]) map[key] = { correct: 0, wrong: 0, unanswered: 0, marks: 0, totalMarks: 0, totalQuestions: 0 };
    map[key].totalQuestions += 1;
    map[key].totalMarks += questionMarks;
    if (isCorrect) { map[key].correct += 1; map[key].marks += marks; }
    else if (isWrong) { map[key].wrong += 1; }
    else { map[key].unanswered += 1; }
  }

  snapshotQuestions.forEach(q => {
    const studentAnswer = answers[q.questionId] || null;
    const questionMarks = q.marks || 1;
    totalMarks += questionMarks;

    const isCorrect = studentAnswer && studentAnswer === q.correctAnswer;
    const isWrong = studentAnswer && studentAnswer !== q.correctAnswer;
    const isUnanswered = !studentAnswer;

    if (isCorrect) { correctCount += 1; obtainedMarks += questionMarks; }
    else if (isWrong) { wrongCount += 1; } // wrong = 0 marks, no negative marking
    else { unansweredCount += 1; }

    bump(subjectMap, q.subjectId, isCorrect, isWrong, questionMarks, questionMarks);
    bump(chapterMap, q.chapterId, isCorrect, isWrong, questionMarks, questionMarks);
    bump(topicMap, q.topicId, isCorrect, isWrong, questionMarks, questionMarks);
  });

  const totalQuestions = snapshotQuestions.length;
  const attempted = correctCount + wrongCount;
  const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 1000) / 10 : 0;
  const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 1000) / 10 : null;
  const timeTakenSeconds = Math.max(0, Math.round((submittedAtMillis - startedAtMillis) / 1000));
  const avgTimePerQuestionSeconds = totalQuestions > 0 ? Math.round(timeTakenSeconds / totalQuestions) : null;

  const toBreakdown = (map, keyName) => Object.entries(map).map(([id, v]) => ({
    [keyName]: id,
    correct: v.correct, wrong: v.wrong, unanswered: v.unanswered,
    marks: v.marks, totalMarks: v.totalMarks, totalQuestions: v.totalQuestions
  }));

  return {
    totalQuestions, attempted, correctCount, wrongCount, unansweredCount,
    obtainedMarks, totalMarks, percentage, accuracy,
    timeTakenSeconds, avgTimePerQuestionSeconds,
    subjectBreakdown: toBreakdown(subjectMap, "subjectId"),
    chapterBreakdown: toBreakdown(chapterMap, "chapterId"),
    topicBreakdown: toBreakdown(topicMap, "topicId"),
    answers
  };
}

// ---------- Build a per-question review (used on result.html) ----------
// Combines the immutable snapshot with the student's stored answers —
// never stored duplicated in the result document itself (Part 28: avoid
// duplicating large question data; the snapshot is re-fetched instead).
export function buildQuestionReview(snapshotQuestions, answers, questionTimes = {}) {
  return snapshotQuestions.map(q => {
    const studentAnswer = answers[q.questionId] || null;
    let status = "unanswered";
    if (studentAnswer) status = studentAnswer === q.correctAnswer ? "correct" : "wrong";
    return {
      questionId: q.questionId,
      question_en: q.question_en,
      question_bn: q.question_bn,
      options_bn: q.options_bn,
      imageUrl: q.imageUrl || null,
      explanation_bn: q.explanation_bn || null,
      studentAnswer, correctAnswer: q.correctAnswer, status,
      marks: q.marks || 1,
      timeSeconds: questionTimes[q.questionId] ?? null,
      subjectId: q.subjectId, chapterId: q.chapterId, topicId: q.topicId
    };
  });
}

// ---------- Top N slowest-answered questions (per-question time analysis) ----------
export function getSlowestQuestions(review, limit = 3) {
  return review
    .filter(q => q.timeSeconds !== null && q.timeSeconds > 0)
    .sort((a, b) => b.timeSeconds - a.timeSeconds)
    .slice(0, limit);
}

// ---------- Formatting helpers shared by result/history/PDF pages ----------
export function formatSeconds(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined) return "—";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m} মিনিট ${s} সেকেন্ড`;
}

export function formatHms(remainingMs) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
