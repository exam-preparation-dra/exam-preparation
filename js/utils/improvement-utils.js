/* =========================================================
   IMPROVEMENT ENGINE
   ---------------------------------------------------------
   Single source of truth for the Improvement Journey.

   Design rules:
   - Uses only approved/auto-approved exam results.
   - Does not invent performance data.
   - A single mistake never makes a chapter/topic "weak".
   - Uses repeated evidence, minimum sample size and recent data.
   - Keeps official exam results separate from improvement practice.
   - Admin remains in control of publishing/assigning improvement tests.
   ========================================================= */

import { db } from "../firebase/firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getApprovedResults } from "./results-utils.js";

const NUM = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const TS_MS = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : 0;
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const IMPROVEMENT_CONFIG = Object.freeze({
  // Minimum evidence before a weakness can become a mission/request.
  minRelevantAttempts: 3,
  minRelevantQuestions: 5,
  minAccuracyForWeakness: 60,
  severeAccuracy: 40,
  criticalAccuracy: 30,

  // Recent results matter more than very old results.
  recentResultWindow: 5,

  // Target is deliberately realistic rather than always 90/100.
  defaultTarget: 65,
  severeTarget: 60,
  moderateTarget: 70,

  // Do not create a new request every time the profile loads.
  requestCooldownDays: 7,

  // A resolved weakness must have a meaningful improvement.
  minImprovementToResolve: 8
});

export const IMPROVEMENT_STATUS = Object.freeze({
  DETECTED: "detected",
  REVIEWED: "reviewed",
  TEST_REQUIRED: "test_required",
  TEST_CREATED: "test_created",
  ASSIGNED: "assigned",
  COMPLETED: "completed",
  RESOLVED: "resolved",
  DISMISSED: "dismissed"
});

export const IMPROVEMENT_PRIORITY = Object.freeze({
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low"
});

function normalizeBreakdownItem(item = {}) {
  const totalQuestions = Math.max(0, NUM(item.totalQuestions));
  const correct = clamp(NUM(item.correct), 0, totalQuestions || Number.MAX_SAFE_INTEGER);
  const wrong = Math.max(0, NUM(item.wrong));
  const unanswered = Math.max(0, NUM(item.unanswered));
  const attempted = Math.max(0, correct + wrong);
  const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
  const percentage = totalQuestions > 0 ? (correct / totalQuestions) * 100 : accuracy;

  return {
    ...item,
    totalQuestions,
    correct,
    wrong,
    unanswered,
    attempted,
    accuracy,
    percentage
  };
}

function groupApprovedResults(results = []) {
  return [...results]
    .filter(result => {
      const status = result?.status;
      return status === "approved" || (
        status === "pending" && TS_MS(result.submittedAt) > 0 &&
        Date.now() - TS_MS(result.submittedAt) >= 24 * 60 * 60 * 1000
      );
    })
    .sort((a, b) => TS_MS(a.submittedAt) - TS_MS(b.submittedAt));
}

function buildEntityHistory(results, breakdownKey, idKey) {
  const map = new Map();

  for (const result of results) {
    const submittedAt = TS_MS(result.submittedAt);
    const breakdown = Array.isArray(result[breakdownKey]) ? result[breakdownKey] : [];

    for (const rawItem of breakdown) {
      const id = rawItem?.[idKey];
      if (!id) continue;
      const item = normalizeBreakdownItem(rawItem);
      if (!map.has(id)) map.set(id, []);
      map.get(id).push({
        ...item,
        resultId: result.id || null,
        examId: result.examId || null,
        examName: result.examName || "পরীক্ষা",
        submittedAt,
        submittedAtMs: submittedAt
      });
    }
  }

  return map;
}

function weightedRecentAccuracy(history, windowSize) {
  const recent = history.slice(-windowSize);
  let correct = 0;
  let attempted = 0;
  let totalQuestions = 0;

  recent.forEach(item => {
    correct += item.correct;
    attempted += item.attempted;
    totalQuestions += item.totalQuestions;
  });

  return {
    recent,
    correct,
    attempted,
    totalQuestions,
    accuracy: attempted > 0 ? (correct / attempted) * 100 : 0,
    percentage: totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0
  };
}

function calculateTrend(history) {
  if (history.length < 2) return 0;
  const recent = history.slice(-Math.min(2, history.length));
  const previous = history.slice(-Math.min(4, history.length), -2);

  const recentAttempted = recent.reduce((sum, x) => sum + x.attempted, 0);
  const previousAttempted = previous.reduce((sum, x) => sum + x.attempted, 0);
  if (!previous.length || !previousAttempted || !recentAttempted) return 0;

  const recentAcc = recent.reduce((sum, x) => sum + x.correct, 0) / recentAttempted * 100;
  const previousAcc = previous.reduce((sum, x) => sum + x.correct, 0) / previousAttempted * 100;
  return recentAcc - previousAcc;
}

function getPriority(accuracy, trend) {
  if (accuracy < IMPROVEMENT_CONFIG.criticalAccuracy && trend <= 0) return IMPROVEMENT_PRIORITY.CRITICAL;
  if (accuracy < IMPROVEMENT_CONFIG.severeAccuracy || trend <= -12) return IMPROVEMENT_PRIORITY.HIGH;
  if (accuracy < IMPROVEMENT_CONFIG.minAccuracyForWeakness || trend < -5) return IMPROVEMENT_PRIORITY.MEDIUM;
  return IMPROVEMENT_PRIORITY.LOW;
}

function getTarget(accuracy) {
  if (accuracy < IMPROVEMENT_CONFIG.severeAccuracy) return IMPROVEMENT_CONFIG.severeTarget;
  if (accuracy < 50) return IMPROVEMENT_CONFIG.defaultTarget;
  return IMPROVEMENT_CONFIG.moderateTarget;
}

function buildWeaknessRecord({ entityId, entityType, history, name = "" }) {
  const recent = weightedRecentAccuracy(history, IMPROVEMENT_CONFIG.recentResultWindow);
  if (history.length < IMPROVEMENT_CONFIG.minRelevantAttempts) return null;
  if (recent.totalQuestions < IMPROVEMENT_CONFIG.minRelevantQuestions) return null;
  if (recent.accuracy >= IMPROVEMENT_CONFIG.minAccuracyForWeakness) return null;

  const trend = calculateTrend(history);
  const target = getTarget(recent.accuracy);
  const priority = getPriority(recent.accuracy, trend);

  const wrongQuestionCount = history.reduce((sum, x) => sum + x.wrong, 0);
  const attempted = recent.attempted;
  const improvementNeeded = Math.max(0, target - recent.accuracy);

  return {
    entityId,
    entityType,
    name,
    attempts: history.length,
    relevantQuestions: recent.totalQuestions,
    attemptedQuestions: attempted,
    correctQuestions: recent.correct,
    wrongQuestions: wrongQuestionCount,
    currentAccuracy: Math.round(recent.accuracy * 10) / 10,
    currentPercentage: Math.round(recent.percentage * 10) / 10,
    targetAccuracy: target,
    improvementNeeded: Math.round(improvementNeeded * 10) / 10,
    trend: Math.round(trend * 10) / 10,
    priority,
    recentResultIds: recent.map(x => x.resultId).filter(Boolean),
    wrongQuestionSources: history
      .filter(x => x.wrong > 0)
      .map(x => ({ resultId: x.resultId, examId: x.examId, submittedAtMs: x.submittedAtMs }))
  };
}

/**
 * Analyze one student's approved result history.
 * `nameMaps` is optional and can contain subject/chapter/topic names.
 */
export function analyzeStudentImprovement(results = [], nameMaps = {}) {
  const approved = groupApprovedResults(results);

  const subjectHistory = buildEntityHistory(approved, "subjectBreakdown", "subjectId");
  const chapterHistory = buildEntityHistory(approved, "chapterBreakdown", "chapterId");
  const topicHistory = buildEntityHistory(approved, "topicBreakdown", "topicId");

  const subjects = [];
  const chapters = [];
  const topics = [];

  for (const [id, history] of subjectHistory.entries()) {
    const record = buildWeaknessRecord({
      entityId: id,
      entityType: "subject",
      history,
      name: nameMaps.subjects?.[id] || id
    });
    if (record) subjects.push(record);
  }

  for (const [id, history] of chapterHistory.entries()) {
    const record = buildWeaknessRecord({
      entityId: id,
      entityType: "chapter",
      history,
      name: nameMaps.chapters?.[id] || id
    });
    if (record) chapters.push(record);
  }

  for (const [id, history] of topicHistory.entries()) {
    const record = buildWeaknessRecord({
      entityId: id,
      entityType: "topic",
      history,
      name: nameMaps.topics?.[id] || id
    });
    if (record) topics.push(record);
  }

  const all = [...topics, ...chapters, ...subjects]
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] - priorityOrder[b.priority]) ||
        (a.currentAccuracy - b.currentAccuracy) ||
        (b.attempts - a.attempts);
    });

  return {
    resultsCount: approved.length,
    subjects,
    chapters,
    topics,
    all,
    topPriority: all[0] || null,
    analyzedAt: Date.now()
  };
}

/**
 * Build a request payload. This does not write anything to Firestore.
 * The caller can compare it with existing requests before writing.
 */
export function buildImprovementRequest(studentId, weakness, extra = {}) {
  if (!studentId || !weakness?.entityId) throw new Error("Invalid improvement request data");

  return {
    studentId,
    entityType: weakness.entityType,
    entityId: weakness.entityId,
    entityName: weakness.name || weakness.entityId,
    priority: weakness.priority,
    reason: "repeated_low_performance",
    currentAccuracy: weakness.currentAccuracy,
    targetAccuracy: weakness.targetAccuracy,
    improvementNeeded: weakness.improvementNeeded,
    attempts: weakness.attempts,
    relevantQuestions: weakness.relevantQuestions,
    wrongQuestions: weakness.wrongQuestions,
    trend: weakness.trend,
    recentResultIds: weakness.recentResultIds || [],
    wrongQuestionSources: weakness.wrongQuestionSources || [],
    status: IMPROVEMENT_STATUS.DETECTED,
    testRequired: true,
    ...extra
  };
}

/**
 * Create one improvement request after the UI has checked for duplicates.
 * This function intentionally does not silently create duplicates.
 */
export async function createImprovementRequest(payload) {
  if (!payload?.studentId || !payload?.entityId) {
    throw new Error("Student এবং weakness তথ্য প্রয়োজন");
  }

  const ref = await addDoc(collection(db, "improvementRequests"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return { id: ref.id, ...payload };
}

function normalizeImprovementRequest(request = {}) {
  const entityType = request.entityType || (request.topicId ? "topic" : request.chapterId ? "chapter" : request.subjectId ? "subject" : null);
  const entityId = request.entityId || (entityType === "topic" ? request.topicId : entityType === "chapter" ? request.chapterId : entityType === "subject" ? request.subjectId : null);
  const entityName = request.entityName || request.topicName || request.chapterName || request.subjectName || entityId || "উন্নতির ক্ষেত্র";
  const wrongQuestionIds = Array.isArray(request.wrongQuestionIds)
    ? request.wrongQuestionIds.filter(Boolean)
    : (Array.isArray(request.wrongQuestionSources) ? request.wrongQuestionSources.map(x => typeof x === "string" ? x : x?.questionId).filter(Boolean) : []);
  return {
    ...request,
    entityType, entityId, entityName,
    subjectId: request.subjectId || (entityType === "subject" ? entityId : null),
    chapterId: request.chapterId || (entityType === "chapter" ? entityId : null),
    topicId: request.topicId || (entityType === "topic" ? entityId : null),
    subjectName: request.subjectName || (entityType === "subject" ? entityName : ""),
    chapterName: request.chapterName || (entityType === "chapter" ? entityName : ""),
    topicName: request.topicName || (entityType === "topic" ? entityName : ""),
    wrongQuestionIds,
    wrongQuestionCount: wrongQuestionIds.length
  };
}

export async function getImprovementRequests({ status = null, studentId = null, limitCount = 100 } = {}) {
  const constraints = [];
  if (status) constraints.push(where("status", "==", status));
  if (studentId) constraints.push(where("studentId", "==", studentId));
  const snap = await getDocs(query(collection(db, "improvementRequests"), ...constraints));
  return snap.docs
    .map(d => normalizeImprovementRequest({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const am = a.createdAt?.toMillis?.() || 0;
      const bm = b.createdAt?.toMillis?.() || 0;
      return bm - am;
    })
    .slice(0, Math.max(1, Math.min(200, Number(limitCount) || 100)));
}

// Backwards-compatible API used by the Profile and Admin modules.
export async function getImprovementRequestsForStudent(studentId) {
  return getImprovementRequests({ studentId, limitCount: 100 });
}

// Canonical Admin analyzer. It uses the same Improvement Engine as Profile,
// then enriches the result with stable subject/chapter/topic fields.
export async function detectWeakAreas(studentId, options = {}) {
  if (!studentId) return [];
  const results = await getApprovedResults(studentId);

  const [subjectsSnap, chaptersSnap, topicsSnap] = await Promise.all([
    getDocs(collection(db, "subjects")),
    getDocs(collection(db, "chapters")),
    getDocs(collection(db, "topics"))
  ]);
  const subjects = {}, chapters = {}, topics = {};
  subjectsSnap.forEach(d => { const x = d.data(); subjects[d.id] = x.name_bn || x.name_en || d.id; });
  chaptersSnap.forEach(d => { const x = d.data(); chapters[d.id] = x.name_bn || x.name_en || d.id; });
  topicsSnap.forEach(d => { const x = d.data(); topics[d.id] = x.name_bn || x.name_en || d.id; });

  const analysis = analyzeStudentImprovement(results, { subjects, chapters, topics });
  const selected = Array.isArray(options.entityTypes) && options.entityTypes.length
    ? analysis.all.filter(x => options.entityTypes.includes(x.entityType))
    : analysis.all;

  // Recover the actual previous-mistake question IDs from immutable exam snapshots.
  // The result stores answers; the snapshot stores question metadata + correct answer.
  const mistakeCache = new Map();
  for (const result of results) {
    if (!result?.examId || !result?.answers) continue;
    try {
      let questions = mistakeCache.get(result.examId);
      if (!questions) {
        const snap = await getDoc(doc(db, "examSnapshots", result.examId));
        questions = snap.exists() && Array.isArray(snap.data().questions) ? snap.data().questions : [];
        mistakeCache.set(result.examId, questions);
      }
      for (const w of selected) {
        const ids = [];
        for (const q of questions) {
          const answer = result.answers?.[q.questionId];
          const wrong = answer && answer !== q.correctAnswer;
          if (!wrong) continue;
          const matches = w.entityType === "subject" ? q.subjectId === w.entityId
            : w.entityType === "chapter" ? q.chapterId === w.entityId
            : q.topicId === w.entityId;
          if (matches) ids.push(q.questionId);
        }
        if (!w.__wrongIds) w.__wrongIds = new Set();
        ids.forEach(qid => w.__wrongIds.add(qid));
      }
    } catch (error) {
      console.warn("Improvement wrong-question enrichment skipped:", error);
    }
  }

  return selected.map(w => {
    const wrongQuestionIds = [...(w.__wrongIds || new Set())];
    const { __wrongIds, ...cleanWeakness } = w;
    const subjectId = w.entityType === "subject" ? w.entityId : null;
    const chapterId = w.entityType === "chapter" ? w.entityId : null;
    const topicId = w.entityType === "topic" ? w.entityId : null;
    return {
      ...cleanWeakness,
      subjectId, chapterId, topicId,
      subjectName: subjectId ? subjects[subjectId] || subjectId : "",
      chapterName: chapterId ? chapters[chapterId] || chapterId : "",
      topicName: topicId ? topics[topicId] || topicId : "",
      wrongQuestionIds,
      wrongQuestionCount: wrongQuestionIds.length,
      relevantAttempts: w.attempts,
      testRequired: true
    };
  });
}

export async function getImprovementRequest(requestId) {
  if (!requestId) return null;
  const snap = await getDoc(doc(db, "improvementRequests", requestId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateImprovementRequest(requestId, patch = {}) {
  if (!requestId) throw new Error("Request ID প্রয়োজন");
  await updateDoc(doc(db, "improvementRequests", requestId), {
    ...patch,
    updatedAt: serverTimestamp()
  });
}

/**
 * Build a practice question plan from the student's actual mistakes.
 * It returns question IDs from existing exam snapshots/question data; it does
 * not generate fictional questions.
 */
export function buildPracticePlan({ wrongQuestionIds = [], relatedQuestionIds = [], adminQuestionIds = [], questionCount = 10 } = {}) {
  const limitCount = Math.max(1, Math.min(50, Number(questionCount) || 10));
  const result = [];
  const seen = new Set();

  const append = (ids, source) => {
    for (const id of ids || []) {
      if (!id || seen.has(id) || result.length >= limitCount) continue;
      seen.add(id);
      result.push({ questionId: id, source });
    }
  };

  // Personal mistakes first, then related bank questions, then Admin choices.
  append(wrongQuestionIds, "previous_mistake");
  append(relatedQuestionIds, "related_question");
  append(adminQuestionIds, "admin_selected");

  return result;
}

/**
 * Compare a student's baseline and improvement practice result.
 * Improvement is expressed in percentage points, never as a misleading
 * relative percentage.
 */
export function calculateImprovement({ previousAccuracy = 0, practiceAccuracy = 0, targetAccuracy = 0 } = {}) {
  const before = NUM(previousAccuracy);
  const after = NUM(practiceAccuracy);
  const target = NUM(targetAccuracy);
  const gain = after - before;

  return {
    previousAccuracy: Math.round(before * 10) / 10,
    practiceAccuracy: Math.round(after * 10) / 10,
    improvementPoints: Math.round(gain * 10) / 10,
    targetAccuracy: Math.round(target * 10) / 10,
    targetReached: target > 0 ? after >= target : false,
    meaningfulImprovement: gain >= IMPROVEMENT_CONFIG.minImprovementToResolve
  };
}

export function getPriorityLabel(priority) {
  return ({
    critical: "অতি জরুরি",
    high: "জরুরি",
    medium: "মনোযোগ প্রয়োজন",
    low: "পর্যবেক্ষণ"
  })[priority] || "পর্যবেক্ষণ";
}

export function getStatusLabel(status) {
  return ({
    detected: "সনাক্ত হয়েছে",
    reviewed: "পর্যালোচনা হয়েছে",
    test_required: "পরীক্ষা প্রয়োজন",
    test_created: "পরীক্ষা তৈরি হয়েছে",
    assigned: "বরাদ্দ হয়েছে",
    completed: "সম্পন্ন হয়েছে",
    resolved: "সমাধান হয়েছে",
    dismissed: "বাতিল করা হয়েছে"
  })[status] || status || "অজানা";
}
