/* =========================================================
   COMPARISON UTILITIES
   Works for any number of active students — nothing here assumes
   exactly two, even though only two exist today (Part 21).
   ========================================================= */
import { computeOverallStats, computeSubjectStats, computeChapterStats, computeTopicStats } from "./analytics-utils.js";

const MIN_FOR_IMPROVEMENT = 4; // need at least 2+2 exams to compare halves meaningfully

// ---------- Per-student summary block, used by both comparison pages ----------
export function computeStudentSummary(student, results, subjectNameMap, chapterNameMap, topicNameMap) {
  const overall = computeOverallStats(results);
  if (!overall) {
    return {
      studentId: student.studentId, name: student.name,
      examsTaken: 0, hasData: false
    };
  }

  const percentages = [...results].reverse().map(r => r.percentage ?? 0); // oldest -> newest
  const bestExam = results.reduce((best, r) => (!best || (r.percentage ?? 0) > (best.percentage ?? 0)) ? r : best, null);
  const lowestExam = results.reduce((low, r) => (!low || (r.percentage ?? 0) < (low.percentage ?? 0)) ? r : low, null);

  // Consistency: standard deviation of percentage — lower is more consistent.
  const mean = percentages.reduce((a, b) => a + b, 0) / percentages.length;
  const variance = percentages.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / percentages.length;
  const consistencyStdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  // Improvement rate: average of the most recent half vs the earliest half.
  let improvementRate = null;
  if (percentages.length >= MIN_FOR_IMPROVEMENT) {
    const half = Math.floor(percentages.length / 2);
    const earlyAvg = percentages.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const recentAvg = percentages.slice(-half).reduce((a, b) => a + b, 0) / half;
    improvementRate = Math.round((recentAvg - earlyAvg) * 10) / 10;
  }

  return {
    studentId: student.studentId, name: student.name, hasData: true,
    examsTaken: overall.examsTaken,
    avgPercentage: overall.avgPercentage,
    avgAccuracy: overall.avgAccuracy,
    totalCorrect: overall.totalCorrect,
    totalWrong: overall.totalWrong,
    totalUnanswered: overall.totalUnanswered,
    bestExam: bestExam ? { name: bestExam.examName, percentage: bestExam.percentage } : null,
    lowestExam: lowestExam ? { name: lowestExam.examName, percentage: lowestExam.percentage } : null,
    consistencyStdDev,
    improvementRate,
    subjectStats: computeSubjectStats(results, subjectNameMap),
    chapterStats: computeChapterStats(results, chapterNameMap),
    topicStats: computeTopicStats(results, topicNameMap),
    avgTimePerQuestionSeconds: results.length
      ? Math.round(results.reduce((sum, r) => sum + (r.avgTimePerQuestionSeconds || 0), 0) / results.length)
      : null
  };
}

// ---------- Merge per-student subject/chapter stats into side-by-side rows ----------
export function mergeStatsForDisplay(studentSummaries, statKey, idKey) {
  const allIds = new Set();
  studentSummaries.forEach(s => (s[statKey] || []).forEach(item => allIds.add(item[idKey])));

  return [...allIds].map(id => {
    const row = { id };
    let name = "—";
    studentSummaries.forEach(s => {
      const match = (s[statKey] || []).find(item => item[idKey] === id);
      if (match) name = match.name;
      row[s.studentId] = match ? match.accuracy : null;
    });
    row.name = name;
    return row;
  });
}
