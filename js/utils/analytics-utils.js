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

// ---------- Per-question record builder ----------
// Combines each approved result with its (already-fetched) exam snapshot to
// produce one row per question actually seen by the student. This is the
// foundation for every analysis below that the aggregated *Breakdown arrays
// can't answer on their own (they only carry subject/chapter/topic totals,
// not per-question selected-option, timing, or marked-for-review).
// snapshotsByExamId: result of getExamSnapshotsMap() in results-utils.js.
export function buildQuestionRecords(results, snapshotsByExamId) {
  const records = [];
  results.forEach(r => {
    const snapshot = snapshotsByExamId[r.examId];
    if (!snapshot) return; // snapshot missing (e.g. exam later deleted) — skip, never fabricate
    const questionTimes = r.questionTimes || {};
    const markedForReview = r.markedForReview || {};
    const answers = r.answers || {};
    (snapshot.questions || []).forEach(q => {
      const selected = answers[q.questionId] || null;
      records.push({
        examId: r.examId,
        examName: r.examName || "",
        submittedAt: r.submittedAt,
        questionId: q.questionId,
        question_bn: q.question_bn || "",
        subjectId: q.subjectId || null,
        chapterId: q.chapterId || null,
        topicId: q.topicId || null,
        selected,
        correctAnswer: q.correctAnswer,
        isAnswered: !!selected,
        isCorrect: selected ? selected === q.correctAnswer : null,
        timeSeconds: questionTimes[q.questionId] ?? null,
        isMarked: !!markedForReview[q.questionId]
      });
    });
  });
  return records;
}

const MIN_RECORDS_FOR_TIME_STATS = 5;

// ---------- Time-management analysis ----------
// Where time is going (by subject/topic) and whether answering fast
// correlates with getting it wrong (a "rushing" signal), never claimed
// from too few timed questions.
export function computeTimeManagementStats(records, subjectNameMap, topicNameMap) {
  const timed = records.filter(r => r.timeSeconds !== null && r.timeSeconds > 0);
  if (timed.length < MIN_RECORDS_FOR_TIME_STATS) return null;

  function bucketBy(idKey, nameMap) {
    const bucket = {};
    timed.forEach(r => {
      const id = r[idKey];
      if (!id) return;
      if (!bucket[id]) bucket[id] = { id, name: nameMap[id] || "—", totalTime: 0, count: 0 };
      bucket[id].totalTime += r.timeSeconds;
      bucket[id].count += 1;
    });
    return Object.values(bucket)
      .map(b => ({ ...b, avgSeconds: Math.round(b.totalTime / b.count) }))
      .sort((a, b) => b.avgSeconds - a.avgSeconds);
  }

  const bySubject = bucketBy("subjectId", subjectNameMap);
  const byTopic = bucketBy("topicId", topicNameMap);

  // Speed vs accuracy: split answered, timed questions at the median time;
  // compare the wrong-rate of the faster half against the slower half.
  const answered = timed.filter(r => r.isAnswered);
  let speedAccuracy = null;
  if (answered.length >= MIN_RECORDS_FOR_TIME_STATS) {
    const sorted = [...answered].sort((a, b) => a.timeSeconds - b.timeSeconds);
    const mid = Math.floor(sorted.length / 2);
    const faster = sorted.slice(0, mid);
    const slower = sorted.slice(mid);
    const wrongRate = arr => {
      if (arr.length === 0) return null;
      const wrong = arr.filter(r => r.isCorrect === false).length;
      return Math.round((wrong / arr.length) * 1000) / 10;
    };
    const fasterWrongRate = wrongRate(faster);
    const slowerWrongRate = wrongRate(slower);
    speedAccuracy = {
      medianSeconds: sorted[mid]?.timeSeconds ?? null,
      fasterWrongRate, slowerWrongRate,
      rushingLikely: fasterWrongRate !== null && slowerWrongRate !== null && fasterWrongRate > slowerWrongRate
    };
  }

  return { bySubject, byTopic, speedAccuracy };
}

const MIN_REPEATS_FOR_MISCONCEPTION = 2;

// ---------- Wrong-option pattern detection ----------
// Flags questions where the SAME wrong option keeps getting picked across
// attempts (the question must have appeared in more than one exam for this
// to be possible) — a signal of a specific misconception rather than a
// random slip. Requires at least MIN_REPEATS_FOR_MISCONCEPTION identical
// wrong picks before flagging, never from a single wrong answer.
export function computeWrongOptionPatterns(records) {
  const bucket = {};
  records.forEach(r => {
    if (!r.selected || r.isCorrect !== false) return;
    if (!bucket[r.questionId]) {
      bucket[r.questionId] = {
        questionId: r.questionId, question_bn: r.question_bn,
        subjectId: r.subjectId, chapterId: r.chapterId, topicId: r.topicId,
        correctAnswer: r.correctAnswer, optionCounts: {}
      };
    }
    const b = bucket[r.questionId];
    b.optionCounts[r.selected] = (b.optionCounts[r.selected] || 0) + 1;
  });

  return Object.values(bucket)
    .map(b => {
      const top = Object.entries(b.optionCounts).sort((x, y) => y[1] - x[1])[0];
      return { ...b, repeatedOption: top[0], repeatedCount: top[1] };
    })
    .filter(b => b.repeatedCount >= MIN_REPEATS_FOR_MISCONCEPTION)
    .sort((a, b) => b.repeatedCount - a.repeatedCount);
}

// ---------- Marked-for-review accuracy ----------
// Compares accuracy on self-flagged "uncertain" questions against everything
// else — lets a student see whether their own uncertainty judgment tracks
// their actual performance.
export function computeMarkedForReviewStats(records) {
  const markedAnswered = records.filter(r => r.isMarked && r.isAnswered);
  if (markedAnswered.length === 0) return null;

  const correct = markedAnswered.filter(r => r.isCorrect).length;
  const wrong = markedAnswered.length - correct;
  const accuracy = Math.round((correct / markedAnswered.length) * 1000) / 10;

  const unmarkedAnswered = records.filter(r => !r.isMarked && r.isAnswered);
  const unmarkedCorrect = unmarkedAnswered.filter(r => r.isCorrect).length;
  const unmarkedAccuracy = unmarkedAnswered.length
    ? Math.round((unmarkedCorrect / unmarkedAnswered.length) * 1000) / 10
    : null;

  return { markedCount: markedAnswered.length, correct, wrong, accuracy, unmarkedAccuracy };
}

const MIN_ATTEMPTS_FOR_TOPIC_TREND = 3;
const TREND_FLAT_THRESHOLD = 5; // percentage points — smaller moves read as "flat", not noise-driven up/down

// ---------- Per-topic trend direction (rising / falling / flat) ----------
// Compares the average of the earliest half of a topic's per-exam accuracy
// readings against the most recent half — same minimum-data discipline as
// the rest of this file (never declared from too few attempts).
export function computeTopicTrends(results, topicNameMap) {
  const chronological = [...results].reverse(); // oldest -> newest
  const bucket = {};
  chronological.forEach(r => {
    (r.topicBreakdown || []).forEach(t => {
      const denom = (t.correct || 0) + (t.wrong || 0);
      if (denom === 0) return;
      if (!bucket[t.topicId]) bucket[t.topicId] = { topicId: t.topicId, name: topicNameMap[t.topicId] || "—", series: [] };
      bucket[t.topicId].series.push(Math.round((t.correct / denom) * 100));
    });
  });

  return Object.values(bucket).map(t => {
    if (t.series.length < MIN_ATTEMPTS_FOR_TOPIC_TREND) {
      return { ...t, direction: "unknown", diff: null };
    }
    const half = Math.floor(t.series.length / 2);
    const earlyAvg = t.series.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const recentAvg = t.series.slice(-half).reduce((a, b) => a + b, 0) / half;
    const diff = Math.round((recentAvg - earlyAvg) * 10) / 10;
    let direction = "flat";
    if (diff >= TREND_FLAT_THRESHOLD) direction = "up";
    else if (diff <= -TREND_FLAT_THRESHOLD) direction = "down";
    return { ...t, direction, diff };
  });
}

// ---------- Exam history timeline ----------
// Results are already fetched newest-first; this just picks the fields the
// timeline needs so the page doesn't reach into raw result docs directly.
export function buildExamHistoryTimeline(results) {
  return results.map(r => ({
    examId: r.examId,
    examName: r.examName || "—",
    submittedAt: r.submittedAt,
    percentage: r.percentage,
    accuracy: r.accuracy
  }));
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
