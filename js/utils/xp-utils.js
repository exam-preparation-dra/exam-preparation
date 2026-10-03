/* =========================================================
   XP ENGINE — the single source of truth for every point in the app.
   Pure functions only (no Firestore, no DOM), so the dashboard, the
   leaderboard, history, admin pages and the profile all show the SAME
   number. Change a rule here and it changes everywhere.

   Why this replaced the old formula
   ---------------------------------
   Old: marks*10 + 50 per exam + 5 per correct + 100 per perfect exam.
   Problem: two students with the same marks got the same points, and a
   10-question exam and a 50-question exam felt alike. Now every exam is
   built from many small, automatic components that scale with the
   number of questions, and results are never tied: see compareRank().

   Per-exam components (all derived from the stored result doc)
   ------------------------------------------------------------
   participation  base + per-question-in-exam (bigger exam = more)
                  scaled down if the student barely touched the paper
   effort         1 XP for every question actually attempted
   correct        8 XP per mark earned (marks-weighted)
   accuracy       up to 40 XP, curved (90% accuracy >> 70% accuracy),
                  damped when fewer than 10 questions were attempted
   tier           score bonus: >=90% +40, >=75% +25, >=60% +12, >=40% +5
   flawless       perfect paper +60 / zero-wrong paper +20
                  (needs at least 5 questions, so 1-question exams
                  can't be farmed)
   mastery        +4 per topic fully correct (>=2 Qs), +6 per chapter
                  >=80% (>=3 Qs); capped at 40 per exam
   improvement    beat your own earlier average by 10 pts: +15, 20 pts: +30
   streak         first exam of a week that continues a run of weekly
                  attendance: +8 x (run-1), max 4 weeks
   Account-level: referral  +250 for EVERY friend who joins via your link.
   ========================================================= */

export const REFERRAL_XP = 250;

/* ---------- Per-exam XP ceiling + early-bird bonus ----------
   A perfect paper earns EXAM_MAX_XP (1500) no matter how big the exam is.
   On top of that, whoever takes a freshly published exam early gets an
   extra bonus: day 1 = +500, then it drops each day (see days[]).
   Not taking the exam in its 7-day window costs missPenalty once.
   Only exams that start on/after launchMs are affected, so old exams
   don't suddenly change anyone's XP. */
export const EXAM_MAX_XP = 1500;
export const EXAM_BONUS = {
  launchMs: Date.UTC(2026, 9, 3),            // 3 Oct 2026
  days: [500, 450, 400, 350, 300, 250, 200], // bonus for day 1..7
  windowDays: 7,
  missPenalty: 500,
  penaltyGraceMs: 24 * 60 * 60 * 1000        // results may wait up to 24h for approval
};
const DAY_MS = 24 * 60 * 60 * 1000;

// Exams are loaded once by results-utils.js (ensureXPExams) and kept here so
// every page's computeStudentXP() sees the same exam windows.
let _xpExams = new Map();
export function setXPExams(list) { _xpExams = new Map((list || []).map(e => [e.id, e])); }
export function getXPExams() { return [..._xpExams.values()]; }

// { startMs, endMs } of the 7-day window in which an exam can be taken.
export function getExamWindow(exam) {
  const examMs = tms(exam?.examDate), pubMs = tms(exam?.publishDate);
  if (!examMs) return null;
  const startMs = Math.max(examMs, pubMs || examMs);
  return { startMs, endMs: examMs + EXAM_BONUS.windowDays * DAY_MS };
}
// Bonus for taking `exam` at time atMs -> { day, bonus, daysLeft } or null.
export function getEarlyBonus(exam, atMs = Date.now()) {
  const w = getExamWindow(exam);
  if (!w || w.startMs < EXAM_BONUS.launchMs) return null;
  if (atMs < w.startMs || atMs >= w.endMs) return null;
  const day = Math.min(EXAM_BONUS.days.length, Math.floor((atMs - w.startMs) / DAY_MS) + 1);
  return { day, bonus: EXAM_BONUS.days[day - 1], daysLeft: Math.max(0, Math.ceil((w.endMs - atMs) / DAY_MS)) };
}
function tms(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
}

export const XP_RULES = {
  participationBase: 20,
  participationPerQuestion: 2,
  perAttempted: 1,
  perMark: 8,
  accuracyMax: 40,
  accuracyFullSample: 10,
  tiers: [[90, 40], [75, 25], [60, 12], [40, 5]],
  perfect: 60,
  clean: 20,
  minQuestionsForFlawless: 5,
  topicMastery: 4,
  chapterMastery: 6,
  masteryCap: 40,
  improvementSmall: 15,
  improvementBig: 30,
  streakPerWeek: 8,
  streakCapWeeks: 4,

  // Improvement Practice XP. This is intentionally separate from official-exam XP.
  // A completed practice can earn XP, but repeated submissions of the same
  // practice are capped so students cannot farm XP indefinitely.
  practiceBase: 8,
  practicePerQuestion: 1,
  practiceCorrect: 3,
  practiceAccuracyMax: 20,
  practiceTargetBonus: 15,
  practiceImprovementBonus: 10,
  practiceMaxXP: 80,
  practiceRepeatMultiplier: 0   // 2nd attempt onwards: exam can be retaken, but earns no XP
};

// Bengali labels + display order for every category (used by the UI).
export const XP_CATEGORIES = [
  { key: "correct",       label: "সঠিক উত্তর",            hint: "প্রতিটি সঠিক মার্কে XP" },
  { key: "participation", label: "পরীক্ষায় অংশগ্রহণ",     hint: "বড় পরীক্ষা = বেশি XP" },
  { key: "effort",        label: "প্রশ্নে চেষ্টা",         hint: "প্রতিটি চেষ্টা করা প্রশ্নে XP" },
  { key: "accuracy",      label: "নির্ভুলতা বোনাস",        hint: "যত কম ভুল, তত বেশি" },
  { key: "tier",          label: "স্কোর বোনাস",            hint: "40% / 60% / 75% / 90% ধাপ" },
  { key: "flawless",      label: "পারফেক্ট ও ক্লিন রান",    hint: "100% হলে বা শূন্য ভুলে বোনাস" },
  { key: "mastery",       label: "টপিক ও চ্যাপ্টার দক্ষতা", hint: "টপিকে সব সঠিক বা চ্যাপ্টারে 80%+ হলে" },
  { key: "improvement",   label: "উন্নতি বোনাস",           hint: "নিজের গড়ের চেয়ে ভালো করলে" },
  { key: "streak",        label: "সাপ্তাহিক ধারাবাহিকতা",   hint: "টানা সপ্তাহে পরীক্ষা দিলে" },
  { key: "early",         label: "দ্রুত পরীক্ষা বোনাস",     hint: "পরীক্ষা প্রকাশের প্রথম দিনে সর্বোচ্চ বোনাস" },
  { key: "referral",      label: "বন্ধু রেফার",             hint: "প্রতি বন্ধুতে 250 XP" },
  { key: "challenge",     label: "চ্যালেঞ্জ বোনাস",         hint: "বন্ধুর সাথে challenge জিতলে/হারলে বোনাস XP" },
  { key: "improvementPractice", label: "উন্নতি প্র্যাকটিস", hint: "দুর্বল জায়গা ঠিক করার প্র্যাকটিসে XP" },
  { key: "battle", label: "ব্যাটল মোড", hint: "ব্যাটল ম্যাচ জিতলে/MVP হলে XP" },
  { key: "missed", label: "পরীক্ষা মিস পেনাল্টি", hint: "৭ দিনে পরীক্ষা না দিলে -500 XP" }
];

export const LEVEL_THRESHOLDS = [0, 1000, 3000, 6000, 10000, 15000, 25000, 40000, 60000];

// ---------- helpers ----------
const num = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
}

// Monday-based week index (whole number, consecutive weeks differ by 1).
function weekIndex(ms) {
  const d = new Date(ms);
  const days = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
  return Math.floor((days + 3) / 7);
}

function tierBonus(pct) {
  for (const [min, xp] of XP_RULES.tiers) if (pct >= min) return xp;
  return 0;
}

// ---------- level ----------
export function getLevelInfo(xp) {
  const t = LEVEL_THRESHOLDS;
  let level = 1;
  for (let i = 0; i < t.length; i++) if (xp >= t[i]) level = i + 1;
  const isMax = level === t.length;
  const floor = t[level - 1];
  const ceil = isMax ? t[t.length - 1] : t[level];
  const span = ceil - floor;
  const pct = isMax || span <= 0 ? 100 : Math.min(100, Math.max(0, ((xp - floor) / span) * 100));
  return { level, nextLevel: level + 1, isMax, xpNeeded: isMax ? 0 : ceil - xp, percentage: Math.round(pct), floor, ceil };
}

// ---------- one exam ----------
// prev: { avgPct, count } of this student's EARLIER exams (for improvement)
// streakRun: how many consecutive weeks (including this one) the student has
//            attended, only when this is the first exam of its week; else 0.
export function computeExamXP(result, { prevAvgPct = null, streakRun = 0 } = {}) {
  const R = XP_RULES;
  const totalQ = Math.max(0, num(result.totalQuestions));
  const correctCount = Math.max(0, num(result.correctCount));
  const wrongCount = Math.max(0, num(result.wrongCount));
  // attempted should be >= correct+wrong (a question can't be "correct"
  // without being attempted); trust whichever source is larger, but never
  // let it exceed the exam's actual question count.
  let attempted = Math.max(0, num(result.attempted, correctCount + wrongCount));
  attempted = Math.max(attempted, correctCount + wrongCount);
  if (totalQ > 0) attempted = Math.min(attempted, totalQ);
  const obtained = Math.max(0, num(result.obtainedMarks));
  const pct = num(result.percentage, num(result.totalMarks) > 0 ? (obtained / num(result.totalMarks)) * 100 : 0);

  const parts = { correct: 0, participation: 0, effort: 0, accuracy: 0, tier: 0, flawless: 0, mastery: 0, improvement: 0, streak: 0 };

  parts.correct = obtained * R.perMark;
  parts.effort = attempted * R.perAttempted;

  // A blank paper earns nothing for "showing up"; touching half the paper earns it all.
  const touchRatio = totalQ > 0 ? Math.min(1, (attempted / totalQ) * 2) : (attempted > 0 ? 1 : 0);
  parts.participation = (R.participationBase + R.participationPerQuestion * totalQ) * touchRatio;

  if (attempted > 0) {
    const acc = correctCount / attempted;
    const sample = Math.min(1, attempted / R.accuracyFullSample);
    parts.accuracy = R.accuracyMax * acc * acc * sample;
  }

  parts.tier = tierBonus(pct);

  // "Perfect"/"clean" are judged from the actual answer counts, not the
  // stored percentage — a fractional marking scheme (e.g. partial credit,
  // negative marking) can leave `percentage` a hair under 100 by floating-
  // point rounding even when every question was answered correctly.
  if (totalQ >= R.minQuestionsForFlawless) {
    if (wrongCount === 0 && correctCount >= totalQ) parts.flawless = R.perfect;
    else if (wrongCount === 0 && correctCount >= R.minQuestionsForFlawless) parts.flawless = R.clean;
  }

  let mastery = 0;
  (result.topicBreakdown || []).forEach(t => {
    const q = num(t.totalQuestions);
    if (q >= 2 && num(t.correct) === q) mastery += R.topicMastery;
  });
  (result.chapterBreakdown || []).forEach(c => {
    const q = num(c.totalQuestions);
    if (q >= 3 && num(c.correct) / q >= 0.8) mastery += R.chapterMastery;
  });
  parts.mastery = Math.min(R.masteryCap, mastery);

  if (prevAvgPct != null) {
    const gain = pct - prevAvgPct;
    if (gain >= 20) parts.improvement = R.improvementBig;
    else if (gain >= 10) parts.improvement = R.improvementSmall;
  }

  if (streakRun > 1) parts.streak = R.streakPerWeek * Math.min(streakRun - 1, R.streakCapWeeks);

  // Scale so a perfect paper of ANY size is worth EXAM_MAX_XP (1500), then
  // clamp so the exam itself (before the early-bird bonus) never exceeds it.
  const rawMax = rawMaxExamXP({ questionCount: totalQ, totalMarks: num(result.totalMarks) });
  const scale = rawMax > 0 ? EXAM_MAX_XP / rawMax : 1;
  let sum = Object.values(parts).reduce((a, b) => a + num(b), 0) * scale;
  const k = sum > EXAM_MAX_XP ? (EXAM_MAX_XP / sum) * scale : scale;
  Object.keys(parts).forEach(key => { parts[key] = parts[key] * k; });
  const xp = Math.round(Object.values(parts).reduce((a, b) => a + num(b), 0));
  return { xp, parts };
}

// ---------- one exam -> readable calculation lines ----------
// Takes the `parts` object returned by computeExamXP() / computeStudentXP().exams[i]
// and returns only the components that earned XP, in display order, so the
// history page can show "how this exam's points were calculated". The lines
// always add up exactly to that exam's xp (referral is account-level, so it
// is never part of an exam).
export function getExamXPLines(parts = {}) {
  return XP_CATEGORIES
    .filter(c => c.key !== "referral")
    .map(c => ({ key: c.key, label: c.label, hint: c.hint, xp: Math.round(num(parts[c.key])) }))
    .filter(line => line.xp > 0);
}

// ---------- the highest a single exam can give (before improvement/streak/mastery) ----------
// Used on the "upcoming exam" cards. Mastery/improvement/streak depend on the
// student, so they're shown as extra "+ বোনাস" rather than folded in.
export function computeMaxExamXP({ questionCount = 0, totalMarks = 0 } = {}) {
  return Math.max(0, num(questionCount)) > 0 || num(totalMarks) > 0 ? EXAM_MAX_XP : 0;
}
function rawMaxExamXP({ questionCount = 0, totalMarks = 0 } = {}) {
  const R = XP_RULES;
  const q = Math.max(0, num(questionCount));
  const marks = Math.max(0, num(totalMarks));
  const total =
    R.participationBase + R.participationPerQuestion * q +
    q * R.perAttempted +
    marks * R.perMark +
    Math.round(R.accuracyMax * Math.min(1, q / R.accuracyFullSample)) +
    R.tiers[0][1] +
    (q >= R.minQuestionsForFlawless ? R.perfect : 0);
  return Math.round(total);
}

// ---------- improvement practice ----------
// Practice XP is deliberately independent from official exam XP.
// Expected result fields: totalQuestions, attempted, correctCount, percentage,
// targetReached, improvementPoints, attemptNumber.
// The first completed attempt of a practice gets full XP. Repeats of the SAME
// practice (attemptNumber > 1) are allowed but earn 0 XP (practiceRepeatMultiplier).
export function computeImprovementPracticeXP(practice = {}) {
  const R = XP_RULES;
  const totalQ = Math.max(0, num(practice.totalQuestions));
  const correct = Math.max(0, num(practice.correctCount));
  const attempted = Math.min(totalQ || correct, Math.max(correct, num(practice.attempted, correct)));
  const pct = Math.max(0, Math.min(100, num(practice.percentage, attempted > 0 ? (correct / attempted) * 100 : 0)));
  const attemptNumber = Math.max(1, Math.floor(num(practice.attemptNumber, 1)));

  if (totalQ <= 0 || attempted <= 0) return { xp: 0, parts: { improvementPractice: 0 }, percentage: pct };

  let xp = R.practiceBase + Math.min(totalQ, attempted) * R.practicePerQuestion;
  xp += correct * R.practiceCorrect;

  const accuracySample = Math.min(1, attempted / 10);
  xp += R.practiceAccuracyMax * (pct / 100) * accuracySample;

  if (practice.targetReached === true) xp += R.practiceTargetBonus;
  if (num(practice.improvementPoints) >= 20) xp += R.practiceImprovementBonus;

  xp = Math.min(R.practiceMaxXP, Math.round(xp));
  if (attemptNumber > 1) xp = Math.round(xp * R.practiceRepeatMultiplier);

  return {
    xp,
    parts: { improvementPractice: xp },
    percentage: Math.round(pct * 10) / 10,
    targetReached: practice.targetReached === true,
    attemptNumber
  };
}

// Computes the total XP contributed by completed improvement practices.
// Only records explicitly marked completed/approved are counted.
export function computeImprovementPracticeTotalXP(practiceResults = []) {
  return (practiceResults || []).reduce((total, practice) => {
    const status = String(practice.status || "completed").toLowerCase();
    if (!["completed", "approved", "published"].includes(status)) return total;
    return total + computeImprovementPracticeXP(practice).xp;
  }, 0);
}

// ---------- whole student ----------
// results: this student's counted (approved / auto-approved) results, any order.
export function computeStudentXP(results, { referralCount = 0, challengeBonusXP = 0, improvementPracticeResults = [], battleXP = 0, spentXP = 0, student = null } = {}) {
  const sorted = [...(results || [])].sort((a, b) => toMillis(a.submittedAt) - toMillis(b.submittedAt));

  const weeksAttended = new Set(sorted.map(r => weekIndex(toMillis(r.submittedAt))));
  const seenWeeks = new Set();
  const breakdown = Object.fromEntries(XP_CATEGORIES.map(c => [c.key, 0]));
  const exams = [];

  let pctSum = 0, perfectExams = 0;
  sorted.forEach((r, i) => {
    const ms = toMillis(r.submittedAt);
    const wk = weekIndex(ms);

    let streakRun = 0;
    if (!seenWeeks.has(wk)) {
      seenWeeks.add(wk);
      streakRun = 1;
      while (weeksAttended.has(wk - streakRun)) streakRun++;
    }

    const prevAvgPct = i > 0 ? pctSum / i : null;
    const { xp: baseXP, parts } = computeExamXP(r, { prevAvgPct, streakRun });
    // Early-bird bonus: depends on which day of the exam's 7-day window it was submitted.
    const eb = r.examId && _xpExams.has(r.examId) ? getEarlyBonus(_xpExams.get(r.examId), ms) : null;
    parts.early = eb ? eb.bonus : 0;
    const xp = baseXP + parts.early;
    Object.entries(parts).forEach(([k, v]) => { breakdown[k] += v; });

    const pct = num(r.percentage);
    pctSum += pct;
    if (pct >= 100) perfectExams++;

    exams.push({
      resultId: r.id || null, examId: r.examId || null, examName: r.examName || "পরীক্ষা",
      submittedAtMs: ms, percentage: pct, xp, parts
    });
  });

  const refCount = Math.max(0, Math.floor(num(referralCount)));
  const referralXP = refCount * REFERRAL_XP;
  breakdown.referral = referralXP;

  const challengeXP = Math.max(0, Math.round(num(challengeBonusXP)));
  breakdown.challenge = challengeXP;

  const improvementPracticeXP = computeImprovementPracticeTotalXP(improvementPracticeResults);
  breakdown.improvementPractice = improvementPracticeXP;

  const battleXPRounded = Math.max(0, Math.round(num(battleXP)));
  breakdown.battle = battleXPRounded;

  Object.keys(breakdown).forEach(k => { breakdown[k] = Math.round(breakdown[k]); });

  // Missed-exam penalty: -missPenalty once per exam whose 7-day window is over
  // (plus a 24h grace for result approval) and that this student never took.
  let missedXP = 0, missedExams = [];
  if (student && student.studentId) {
    const taken = new Set(sorted.map(r => r.examId));
    const joinedMs = tms(student.createdAt);
    const now = Date.now();
    _xpExams.forEach(exam => {
      if (!exam || ["draft", "archived"].includes(exam.status)) return;
      const w = getExamWindow(exam);
      if (!w || w.startMs < EXAM_BONUS.launchMs) return;
      if (now < w.endMs + EXAM_BONUS.penaltyGraceMs) return;
      if (taken.has(exam.id)) return;
      if (joinedMs && joinedMs > w.startMs) return;
      const target = exam.targetBatch || "all";
      if (target !== "all" && student.className && target !== student.className) return;
      const allowed = exam.allowedStudents || [];
      if (allowed.length > 0 && !allowed.includes(student.studentId)) return;
      missedXP += EXAM_BONUS.missPenalty;
      missedExams.push({ examId: exam.id, examName: exam.name || "পরীক্ষা" });
    });
  }
  breakdown.missed = missedXP;

  const examXP = exams.reduce((a, e) => a + e.xp, 0);
  const totalXP = Math.max(0, examXP + referralXP + challengeXP + improvementPracticeXP + battleXPRounded - missedXP);
  const avgPercentage = sorted.length ? Math.round((pctSum / sorted.length) * 10) / 10 : 0;

  // Lifetime XP (totalXP, above) never shrinks -- it's what drives level and
  // leaderboard rank. Spending XP in the store only reduces what's left to
  // SPEND, tracked separately here as spendableXP; see store-utils.js.
  const spentXPRounded = Math.max(0, Math.round(num(spentXP)));
  const spendableXP = Math.max(0, totalXP - spentXPRounded);

  return {
    totalXP, examXP, missedXP, missedExams, referralXP, referralCount: refCount, challengeXP, improvementPracticeXP, battleXP: battleXPRounded,
    spentXP: spentXPRounded, spendableXP,
    breakdown, exams: exams.reverse(),   // newest first
    examsTaken: sorted.length, perfectExams, avgPercentage,
    ...getLevelInfo(totalXP), levelInfo: getLevelInfo(totalXP)
  };
}

// ---------- ranking with tie-breakers ----------
// Two students with identical XP are separated by: higher average %,
// then more exams taken, then name (so the order is always stable).
export function compareRank(a, b) {
  return (num(b.totalPoints) - num(a.totalPoints))
    || (num(b.avgPercentage ?? b.average) - num(a.avgPercentage ?? a.average))
    || (num(b.examsTaken) - num(a.examsTaken))
    || String(a.name || a.studentId || "").localeCompare(String(b.name || b.studentId || ""), "bn");
}
