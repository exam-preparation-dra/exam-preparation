/* =========================================================
   GAMIFICATION — monthly/weekly toppers (overall + per-class) and exam-
   attendance milestones. Everything here is computed on the fly from
   results-utils.js's getAllApprovedResults() + student-utils.js's
   getActiveStudents() — there's no Cloud Function/cron job on this
   project's Spark plan, so nothing is "awarded" and stored ahead of time.
   Instead, every distinct month/week that ever had an approved result is
   re-evaluated each time this runs, which is exactly equivalent to having
   awarded it at the time — just computed lazily. Cheap enough for a
   small class's worth of data.
   ========================================================= */
import { getAllApprovedResults } from "./results-utils.js";
import { getActiveStudents } from "./student-utils.js";

function toDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts);
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ISO 8601 week key, e.g. "2026-W37".
function getWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function currentMonthLabel() {
  return new Date().toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
}
export function currentWeekLabel() {
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay());
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString("bn-BD", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function bucketByPeriod(results, keyFn) {
  const byPeriod = {}; // periodKey -> { studentId -> [percentages] }
  for (const r of results) {
    const date = toDate(r.submittedAt);
    if (!date) continue;
    const key = keyFn(date);
    if (!byPeriod[key]) byPeriod[key] = {};
    if (!byPeriod[key][r.studentId]) byPeriod[key][r.studentId] = [];
    byPeriod[key][r.studentId].push(Number(r.percentage) || 0);
  }
  return byPeriod;
}

function findTopper(periodBucket, filterFn) {
  let best = null;
  for (const [sid, pcts] of Object.entries(periodBucket)) {
    if (filterFn && !filterFn(sid)) continue;
    const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    if (!best || avg > best.avg) best = { studentId: sid, avg: Math.round(avg * 10) / 10 };
  }
  return best;
}

function buildToppersForPeriodType(byPeriod, classOf) {
  const overallByPeriod = {};   // periodKey -> { studentId, avg }
  const classByPeriod = {};     // periodKey -> { className -> { studentId, avg } }
  for (const [periodKey, bucketData] of Object.entries(byPeriod)) {
    const overall = findTopper(bucketData);
    if (overall) overallByPeriod[periodKey] = overall;

    const classesInPeriod = [...new Set(Object.keys(bucketData).map(sid => classOf[sid]).filter(Boolean))];
    classByPeriod[periodKey] = {};
    for (const cls of classesInPeriod) {
      const top = findTopper(bucketData, sid => classOf[sid] === cls);
      if (top) classByPeriod[periodKey][cls] = top;
    }
  }
  return { overallByPeriod, classByPeriod };
}

// Milestone thresholds for "attended N exams" badges.
export const ATTENDANCE_MILESTONES = [3, 6, 10, 20, 30];

export function attendanceBadgesEarned(examCount) {
  return ATTENDANCE_MILESTONES.filter(m => examCount >= m);
}

// ---------- The main entry point. Returns everything needed to render
// both the "this month/week's topper" banner and the badge shelf for any
// student. Do this once per page load and reuse the result — it's one
// pass over all approved results, not one query per student. ----------
export async function computeGamificationData() {
  const [results, students] = await Promise.all([getAllApprovedResults(), getActiveStudents()]);

  const classOf = {}, nameOf = {};
  students.forEach(s => { classOf[s.studentId] = s.className || null; nameOf[s.studentId] = s.name; });

  const monthlyBuckets = bucketByPeriod(results, getMonthKey);
  const weeklyBuckets = bucketByPeriod(results, getWeekKey);
  const monthly = buildToppersForPeriodType(monthlyBuckets, classOf);
  const weekly = buildToppersForPeriodType(weeklyBuckets, classOf);

  // Tally how many periods each student has topped, by category.
  const badgeCounts = {}; // studentId -> { monthlyOverall, monthlyClass, weeklyOverall, weeklyClass }
  function ensure(sid) {
    if (!badgeCounts[sid]) badgeCounts[sid] = { monthlyOverall: 0, monthlyClass: 0, weeklyOverall: 0, weeklyClass: 0 };
    return badgeCounts[sid];
  }
  Object.values(monthly.overallByPeriod).forEach(t => ensure(t.studentId).monthlyOverall++);
  Object.values(monthly.classByPeriod).forEach(perClass => Object.values(perClass).forEach(t => ensure(t.studentId).monthlyClass++));
  Object.values(weekly.overallByPeriod).forEach(t => ensure(t.studentId).weeklyOverall++);
  Object.values(weekly.classByPeriod).forEach(perClass => Object.values(perClass).forEach(t => ensure(t.studentId).weeklyClass++));

  const examCounts = {};
  results.forEach(r => { examCounts[r.studentId] = (examCounts[r.studentId] || 0) + 1; });

  const currentMonthKey = getMonthKey(new Date());
  const currentWeekKey = getWeekKey(new Date());

  return {
    nameOf,
    classOf,
    currentMonthTopper: monthly.overallByPeriod[currentMonthKey] || null,
    currentMonthClassToppers: monthly.classByPeriod[currentMonthKey] || {},
    currentWeekTopper: weekly.overallByPeriod[currentWeekKey] || null,
    currentWeekClassToppers: weekly.classByPeriod[currentWeekKey] || {},
    badgeCounts,          // per-student topper tallies (for badge shelf + admin view)
    examCounts            // per-student total approved exams (for attendance badges)
  };
}
