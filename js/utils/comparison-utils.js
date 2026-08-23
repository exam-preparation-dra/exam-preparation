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

// ---------- Ranked leaderboard by average percentage ----------
export function computeLeaderboard(summaries) {
  return [...summaries]
    .filter(s => s.hasData)
    .sort((a, b) => (b.avgPercentage ?? -1) - (a.avgPercentage ?? -1))
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

// ---------- Diff one stat array (subjectStats/chapterStats/topicStats shape)
// between two students into side-by-side rows with a gap + who's ahead. ----------
function diffStatRows(rowsA, rowsB, idKey) {
  const map = new Map();
  (rowsA || []).forEach(r => map.set(r[idKey], { id: r[idKey], name: r.name, a: r.accuracy ?? null, b: null }));
  (rowsB || []).forEach(r => {
    if (map.has(r[idKey])) map.get(r[idKey]).b = r.accuracy ?? null;
    else map.set(r[idKey], { id: r[idKey], name: r.name, a: null, b: r.accuracy ?? null });
  });
  return [...map.values()].map(row => {
    let gap = null, ahead = null;
    if (row.a !== null && row.b !== null) {
      gap = Math.round((row.a - row.b) * 10) / 10;
      ahead = gap > 0 ? "a" : gap < 0 ? "b" : "tie";
    }
    return { ...row, gap, ahead };
  });
}

// ---------- Head-to-head comparison between exactly two student summaries ----------
// (computeStudentSummary() output — needs subjectStats/chapterStats/topicStats
// already attached). Returns per-level rows plus the biggest gaps each side
// is behind on, for a "you're furthest behind here" highlight.
export function computeHeadToHead(summaryA, summaryB) {
  if (!summaryA?.hasData || !summaryB?.hasData) return null;

  const subjectRows = diffStatRows(summaryA.subjectStats, summaryB.subjectStats, "subjectId");
  const chapterRows = diffStatRows(summaryA.chapterStats, summaryB.chapterStats, "chapterId");
  const topicRows = diffStatRows(summaryA.topicStats, summaryB.topicStats, "topicId");

  const allGaps = [...subjectRows.map(r => ({ ...r, level: "subject" })),
                   ...chapterRows.map(r => ({ ...r, level: "chapter" })),
                   ...topicRows.map(r => ({ ...r, level: "topic" }))]
    .filter(r => r.gap !== null && r.ahead !== "tie");

  const biggestGapsForA = [...allGaps].filter(r => r.ahead === "b").sort((x, y) => x.gap - y.gap).slice(0, 3);
  const biggestGapsForB = [...allGaps].filter(r => r.ahead === "a").sort((x, y) => y.gap - x.gap).slice(0, 3);

  return {
    subjectRows, chapterRows, topicRows,
    overall: {
      aPercentage: summaryA.avgPercentage, bPercentage: summaryB.avgPercentage,
      ahead: summaryA.avgPercentage === summaryB.avgPercentage ? "tie"
        : (summaryA.avgPercentage > summaryB.avgPercentage ? "a" : "b")
    },
    biggestGapsForA, // topics/chapters/subjects where A trails B most
    biggestGapsForB  // ...and where B trails A most
  };
}

// ---------- Exams attempted by 2+ students, for the exam-comparison selector ----------
// studentsResults: [{ student, results }]
export function getCommonExamOptions(studentsResults) {
  const examMap = new Map();
  studentsResults.forEach(({ results }) => {
    (results || []).forEach(r => {
      if (!examMap.has(r.examId)) {
        examMap.set(r.examId, { examId: r.examId, examName: r.examName || "—", count: 0, submittedAt: r.submittedAt });
      }
      examMap.get(r.examId).count += 1;
    });
  });
  return [...examMap.values()]
    .filter(e => e.count >= 2)
    .sort((a, b) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0));
}

// ---------- Every student's result for one specific exam, side by side ----------
export function computeExamComparison(studentsResults, examId) {
  return studentsResults.map(({ student, results }) => {
    const r = (results || []).find(x => x.examId === examId);
    return {
      studentId: student.studentId, name: student.name,
      percentage: r?.percentage ?? null, accuracy: r?.accuracy ?? null,
      hasAttempt: !!r
    };
  }).sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1));
}

// ---------- Time-efficiency ranking: who scores well without spending long per question ----------
export function computeTimeEfficiency(summaries) {
  return summaries
    .filter(s => s.hasData && s.avgTimePerQuestionSeconds !== null && s.avgAccuracy !== null)
    .map(s => ({
      studentId: s.studentId, name: s.name,
      avgTimePerQuestionSeconds: s.avgTimePerQuestionSeconds,
      avgAccuracy: s.avgAccuracy
    }))
    .sort((a, b) => a.avgTimePerQuestionSeconds - b.avgTimePerQuestionSeconds);
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
