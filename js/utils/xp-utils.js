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
  streakCapWeeks: 4
};

// Bengali labels + display order for every category (used by the UI).
export const XP_CATEGORIES = [
  { key: "correct",       label: "সঠিক উত্তর",            hint: "প্রতি মার্কে 8 XP" },
  { key: "participation", label: "পরীক্ষায় অংশগ্রহণ",     hint: "বড় পরীক্ষা = বেশি XP" },
  { key: "effort",        label: "প্রশ্নে চেষ্টা",         hint: "প্রতিটি চেষ্টা করা প্রশ্নে 1 XP" },
  { key: "accuracy",      label: "নির্ভুলতা বোনাস",        hint: "যত কম ভুল, তত বেশি" },
  { key: "tier",          label: "স্কোর বোনাস",            hint: "40% / 60% / 75% / 90% ধাপ" },
  { key: "flawless",      label: "পারফেক্ট ও ক্লিন রান",    hint: "100% হলে +60, শূন্য ভুলে +20" },
  { key: "mastery",       label: "টপিক ও চ্যাপ্টার দক্ষতা", hint: "টপিকে সব সঠিক হলে +4, চ্যাপ্টারে 80%+ হলে +6" },
  { key: "improvement",   label: "উন্নতি বোনাস",           hint: "নিজের গড়ের চেয়ে ভালো করলে" },
  { key: "streak",        label: "সাপ্তাহিক ধারাবাহিকতা",   hint: "টানা সপ্তাহে পরীক্ষা দিলে" },
  { key: "referral",      label: "বন্ধু রেফার",             hint: "প্রতি বন্ধুতে 250 XP" }
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
  const attempted = Math.max(0, num(result.attempted, num(result.correctCount) + num(result.wrongCount)));
  const correctCount = Math.max(0, num(result.correctCount));
  const wrongCount = Math.max(0, num(result.wrongCount));
  const obtained = Math.max(0, num(result.obtainedMarks));
  const pct = num(result.percentage, num(result.totalMarks) > 0 ? (obtained / num(result.totalMarks)) * 100 : 0);

  const parts = { correct: 0, participation: 0, effort: 0, accuracy: 0, tier: 0, flawless: 0, mastery: 0, improvement: 0, streak: 0 };

  parts.correct = Math.round(obtained * R.perMark);
  parts.effort = Math.round(attempted * R.perAttempted);

  // A blank paper earns nothing for "showing up"; touching half the paper earns it all.
  const touchRatio = totalQ > 0 ? Math.min(1, (attempted / totalQ) * 2) : (attempted > 0 ? 1 : 0);
  parts.participation = Math.round((R.participationBase + R.participationPerQuestion * totalQ) * touchRatio);

  if (attempted > 0) {
    const acc = correctCount / attempted;
    const sample = Math.min(1, attempted / R.accuracyFullSample);
    parts.accuracy = Math.round(R.accuracyMax * acc * acc * sample);
  }

  parts.tier = tierBonus(pct);

  if (totalQ >= R.minQuestionsForFlawless) {
    if (pct >= 100) parts.flawless = R.perfect;
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

  const xp = Object.values(parts).reduce((a, b) => a + b, 0);
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

// ---------- whole student ----------
// results: this student's counted (approved / auto-approved) results, any order.
export function computeStudentXP(results, { referralCount = 0 } = {}) {
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
    const { xp, parts } = computeExamXP(r, { prevAvgPct, streakRun });
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

  const examXP = exams.reduce((a, e) => a + e.xp, 0);
  const totalXP = examXP + referralXP;
  const avgPercentage = sorted.length ? Math.round((pctSum / sorted.length) * 10) / 10 : 0;

  return {
    totalXP, examXP, referralXP, referralCount: refCount,
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
