/* =========================================================
   ANALYTICS COMPUTATION (read-side, client-computed from approved results)
   Nothing here is manually entered by admin — every number is derived
   from results.subjectBreakdown / chapterBreakdown / topicBreakdown,
   which are themselves written only by the (future) grading Cloud
   Function. This file just aggregates what already exists.

   Minimum-data rule (requirement #43): any metric without enough
   underlying data returns null so the UI can show "পর্যাপ্ত তথ্য নেই"
   instead of a fabricated number.
   ========================================================= */

const MIN_ATTEMPTS_FOR_TREND = 2;
const MIN_ATTEMPTS_FOR_WEAK_TOPIC = 3;
const WEAK_TOPIC_ACCURACY_THRESHOLD = 50;

// ---------- Overall stats across all approved results ----------
export function computeOverallStats(results) {
  if (!results || results.length === 0) return null;

  const examsTaken = results.length;
  let totalObtained = 0, totalMarks = 0, totalCorrect = 0, totalWrong = 0, totalUnanswered = 0;
  results.forEach(r => {
    totalObtained += r.obtainedMarks || 0;
    totalMarks += r.totalMarks || 0;
    totalCorrect += r.correctCount || 0;
    totalWrong += r.wrongCount || 0;
    totalUnanswered += r.unansweredCount || 0;
  });

  const avgPercentage = totalMarks > 0 ? Math.round((totalObtained / totalMarks) * 1000) / 10 : null;
  const totalAnswered = totalCorrect + totalWrong;
  const avgAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 1000) / 10 : null;

  // Trend: oldest → newest percentage, for a simple sparkline/line chart
  const trend = [...results]
    .reverse()
    .map(r => ({ label: r.examName || "", value: r.percentage ?? null }));

  return {
    examsTaken, totalCorrect, totalWrong, totalUnanswered,
    avgPercentage, avgAccuracy,
    trend: examsTaken >= MIN_ATTEMPTS_FOR_TREND ? trend : null,
    mostRecent: results[0]
  };
}

// ---------- Subject-wise aggregation ----------
export function computeSubjectStats(results, subjectNameMap) {
  const bucket = {};
  results.forEach(r => {
    (r.subjectBreakdown || []).forEach(s => {
      if (!bucket[s.subjectId]) {
        bucket[s.subjectId] = { subjectId: s.subjectId, name: subjectNameMap[s.subjectId] || "—", correct: 0, wrong: 0, marks: 0, attempts: 0 };
      }
      bucket[s.subjectId].correct += s.correct || 0;
      bucket[s.subjectId].wrong += s.wrong || 0;
      bucket[s.subjectId].marks += s.marks || 0;
      bucket[s.subjectId].attempts += 1;
    });
  });
  return Object.values(bucket).map(s => ({
    ...s,
    accuracy: (s.correct + s.wrong) > 0 ? Math.round((s.correct / (s.correct + s.wrong)) * 1000) / 10 : null
  }));
}

// ---------- Chapter-wise aggregation (student performance side only —
// exam-frequency side comes from getChapterExamFrequencyMap in results-utils.js) ----------
export function computeChapterStats(results, chapterNameMap) {
  const bucket = {};
  results.forEach(r => {
    (r.chapterBreakdown || []).forEach(c => {
      if (!bucket[c.chapterId]) {
        bucket[c.chapterId] = { chapterId: c.chapterId, name: chapterNameMap[c.chapterId] || "—", correct: 0, wrong: 0, attempts: 0 };
      }
      bucket[c.chapterId].correct += c.correct || 0;
      bucket[c.chapterId].wrong += c.wrong || 0;
      bucket[c.chapterId].attempts += 1;
    });
  });
  return Object.values(bucket).map(c => ({
    ...c,
    accuracy: (c.correct + c.wrong) > 0 ? Math.round((c.correct / (c.correct + c.wrong)) * 1000) / 10 : null,
    tested: c.attempts > 0
  }));
}

// ---------- Topic-wise aggregation + cautious weak-topic flagging ----------
export function computeTopicStats(results, topicNameMap) {
  const bucket = {};
  // iterate newest-first (results already sorted desc) so "recent" = first N seen per topic
  results.forEach(r => {
    (r.topicBreakdown || []).forEach(t => {
      if (!bucket[t.topicId]) {
        bucket[t.topicId] = { topicId: t.topicId, name: topicNameMap[t.topicId] || "—", correct: 0, wrong: 0, attempts: 0, recentAccuracies: [] };
      }
      const b = bucket[t.topicId];
      b.correct += t.correct || 0;
      b.wrong += t.wrong || 0;
      b.attempts += 1;
      const denom = (t.correct || 0) + (t.wrong || 0);
      if (denom > 0) b.recentAccuracies.push(Math.round(((t.correct || 0) / denom) * 100));
    });
  });

  return Object.values(bucket).map(t => {
    const accuracy = (t.correct + t.wrong) > 0 ? Math.round((t.correct / (t.correct + t.wrong)) * 1000) / 10 : null;
    const recentThree = t.recentAccuracies.slice(0, 3);
    const recentAvg = recentThree.length ? recentThree.reduce((a, b) => a + b, 0) / recentThree.length : null;

    // Weak topic only declared with enough attempts AND consistent low recent accuracy —
    // never from a single exam (requirement #42).
    const isWeak = t.attempts >= MIN_ATTEMPTS_FOR_WEAK_TOPIC
      && recentAvg !== null
      && recentAvg < WEAK_TOPIC_ACCURACY_THRESHOLD;

    return { ...t, accuracy, isWeak, hasEnoughData: t.attempts >= MIN_ATTEMPTS_FOR_WEAK_TOPIC };
  });
}

// ---------- Tiered Bengali performance labels (Part 18) ----------
// Distinct from the boolean isWeak flag above (kept for backward compatibility
// with existing dashboard code) — this gives a 5-tier label for richer display
// on the analytics/comparison pages, still refusing to label on thin data.
export function getPerformanceLabel(stat) {
  if (!stat || stat.attempts < MIN_ATTEMPTS_FOR_WEAK_TOPIC || stat.accuracy === null) {
    return { label: "পর্যাপ্ত তথ্য নেই", tier: "unknown" };
  }
  const acc = stat.accuracy;
  if (acc < 40) return { label: "দুর্বল", tier: "weak" };
  if (acc < 60) return { label: "উন্নতি প্রয়োজন", tier: "needs-improvement" };
  if (acc < 75) return { label: "স্থিতিশীল", tier: "stable" };
  if (acc < 90) return { label: "ভালো", tier: "good" };
  return { label: "অত্যন্ত ভালো", tier: "excellent" };
}
