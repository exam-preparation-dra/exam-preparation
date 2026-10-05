/* =========================================================
   BATCH UTILITIES  (single source of truth for batch rules)

   Student  : students/{id}.className      e.g. "Batch 8", "Batch 12"
   Exam     : exams/{id}.targetBatch       "Batch 8" | "all"
              exams/{id}.batchConfirmed    true once the admin has
                                           deliberately chosen the batch
   Every page used to compare these strings by hand ("Batch 8" vs
   "batch 8" vs "ব্যাচ ৮" all failed). Everything now goes through here.
   Pure module: no Firebase imports.
   ========================================================= */

export const KNOWN_BATCHES = ["Batch 6", "Batch 7", "Batch 8", "Batch 9", "Batch 10", "Batch 11", "Batch 12"];
export const NO_BATCH = "ব্যাচ নেই";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const BATCH_RE = /^(?:batch|ব্যাচ|class|ক্লাস|শ্রেণি|শ্রেণী)?\s*[-:]?\s*(\d{1,2})$/i;

// "batch 8" / "Batch8" / "ব্যাচ ৮" / "Class 8" / "8"  ->  "Batch 8"
// "all" / "সকল ব্যাচ"                                  ->  "all"
// anything else is returned trimmed ("Other"); empty -> ""
export function normalizeBatch(value) {
  if (value === null || value === undefined) return "";
  let s = String(value).trim();
  if (!s) return "";
  s = s.replace(/[০-৯]/g, d => String(BN_DIGITS.indexOf(d)));
  if (/^(all|সব|সকল)/i.test(s)) return "all";
  const m = s.match(BATCH_RE);
  if (m) return `Batch ${Number(m[1])}`;
  return s;
}

export function sameBatch(a, b) {
  const x = normalizeBatch(a).toLowerCase();
  const y = normalizeBatch(b).toLowerCase();
  return !!x && x === y;
}

export function batchSortKey(b) {
  const m = String(b).match(/(\d+)/);
  return m ? Number(m[1]) : 9999;
}
export function sortBatches(list) {
  return [...list].sort((a, b) => batchSortKey(a) - batchSortKey(b) || String(a).localeCompare(String(b)));
}

// Distinct, normalized, sorted batches from a list of students
export function batchesFromStudents(students) {
  return sortBatches([...new Set((students || []).map(s => normalizeBatch(s.className)).filter(b => b && b !== "all"))]);
}

// Batches an admin can pick for an exam: known list + any batch that has students
export function batchChoices(students) {
  return sortBatches([...new Set([...KNOWN_BATCHES, ...batchesFromStudents(students)])]);
}

/* ---------------- syllabus ---------------- */

// Top-level syllabus nodes named after a batch ("Batch 8", "ব্যাচ ১২") belong
// to that batch only. Nodes with any other name stay visible to everyone.
// If the student's batch has no node of its own, nothing is hidden.
export function filterSyllabusForBatch(tree, className) {
  const nodeBatch = (n) => {
    const b = normalizeBatch(n.name_bn) || normalizeBatch(n.name_en) || normalizeBatch(n.name);
    return /^Batch \d+$/.test(b) ? b : "";
  };
  const mine = normalizeBatch(className);
  const list = tree || [];
  if (!mine || !list.some(n => nodeBatch(n) === mine)) return list;
  return list.filter(n => { const b = nodeBatch(n); return !b || b === mine; });
}

/* ---------------- exams ---------------- */

// Normalized list of batches an exam targets. ["all"] means everyone.
// (history.html used to read a legacy `targetBatches` array — still supported.)
export function examBatchList(exam) {
  if (!exam) return ["all"];
  if (Array.isArray(exam.targetBatches) && exam.targetBatches.length) {
    const l = exam.targetBatches.map(normalizeBatch).filter(Boolean);
    if (l.length) return l;
  }
  return [normalizeBatch(exam.targetBatch) || "all"];
}

export function examTargetBatch(exam) {
  const l = examBatchList(exam);
  return l.length === 1 ? l[0] : l.join(", ");
}

// true when the exam is open to everyone (shared exam)
export function isSharedExam(exam) {
  return examBatchList(exam).includes("all");
}

// Batch rule only (no allowed-students rule)
export function examMatchesBatch(exam, className) {
  const l = examBatchList(exam);
  if (l.includes("all")) return true;
  if (!normalizeBatch(className)) return false;
  return l.some(b => sameBatch(b, className));
}

// Full "can this student see / take this exam?" rule: batch AND allowedStudents
export function isExamForStudent(exam, student) {
  if (!exam || !student) return false;
  if (!examMatchesBatch(exam, student.className)) return false;
  const allowed = exam.allowedStudents || [];
  if (allowed.length > 0 && !allowed.includes(student.studentId)) return false;
  return true;
}

// Old exams were saved with targetBatch "all" by default, so they would show
// to every batch. They need the admin to pick the batch once.
export function needsBatchReview(exam) {
  if (!exam || exam.batchConfirmed) return false;
  return isSharedExam(exam);
}

export function examMarks(exam) {
  const t = Number(exam?.totalMarks);
  if (Number.isFinite(t) && t > 0) return t;
  return (exam?.questionIds?.length || 0) * (Number(exam?.marksPerQuestion) || 1);
}

/* ---------------- balance report (admin) ----------------
   Exams that are live for students (published → archived) are "given";
   drafts are "pending". A shared exam (batchConfirmed + "all") adds its
   marks to EVERY batch. Un-reviewed "all" exams are reported separately
   because nobody knows which batch they belong to yet.
   xpOf(exam) is optional (pass computeMaxExamXP wrapper from xp-utils).
*/
const LIVE = ["upcoming", "published", "active", "completed", "archived"];

export function computeBatchBalance(exams, students, xpOf = null) {
  const batches = sortBatches([...new Set([
    ...batchesFromStudents(students),
    ...(exams || []).flatMap(examBatchList).filter(b => b !== "all")
  ])]);

  const blank = () => ({ liveCount: 0, liveMarks: 0, liveXP: 0, draftCount: 0, draftMarks: 0, draftXP: 0 });
  const per = {}; batches.forEach(b => { per[b] = { batch: b, students: 0, own: blank(), shared: blank() }; });
  (students || []).forEach(s => { const b = normalizeBatch(s.className); if (per[b]) per[b].students++; });
  const unassigned = blank();

  (exams || []).forEach(exam => {
    const isLive = LIVE.includes(exam.status);
    const isDraft = exam.status === "draft";
    if (!isLive && !isDraft) return;
    const marks = examMarks(exam);
    const xp = xpOf ? (Number(xpOf(exam)) || 0) : 0;
    const add = (bucket) => {
      if (isLive) { bucket.liveCount++; bucket.liveMarks += marks; bucket.liveXP += xp; }
      else { bucket.draftCount++; bucket.draftMarks += marks; bucket.draftXP += xp; }
    };
    if (needsBatchReview(exam)) { add(unassigned); return; }
    const list = examBatchList(exam);
    if (list.includes("all")) { batches.forEach(b => add(per[b].shared)); return; }
    list.forEach(b => { if (per[b]) add(per[b].own); });
  });

  const rows = batches.map(b => {
    const r = per[b];
    const totalLiveMarks = r.own.liveMarks + r.shared.liveMarks;
    const totalLiveCount = r.own.liveCount + r.shared.liveCount;
    const totalLiveXP = r.own.liveXP + r.shared.liveXP;
    const pendingMarks = r.own.draftMarks + r.shared.draftMarks;
    const pendingCount = r.own.draftCount + r.shared.draftCount;
    return { batch: b, students: r.students, own: r.own, shared: r.shared,
      totalLiveMarks, totalLiveCount, totalLiveXP, pendingMarks, pendingCount };
  });

  // Leader = batch (with students) that has had the most marks so far
  const withStudents = rows.filter(r => r.students > 0);
  const pool = withStudents.length ? withStudents : rows;
  const leader = pool.reduce((best, r) => (!best || r.totalLiveMarks > best.totalLiveMarks ? r : best), null);
  const leaderMarks = leader ? leader.totalLiveMarks : 0;
  const leaderCount = leader ? leader.totalLiveCount : 0;
  const avgExamMarks = leaderCount ? Math.round(leaderMarks / leaderCount) : 0;

  rows.forEach(r => {
    r.gapMarks = Math.max(0, leaderMarks - r.totalLiveMarks);
    r.afterDraftGap = Math.max(0, r.gapMarks - r.pendingMarks);
    r.extraExamsNeeded = r.afterDraftGap > 0 && avgExamMarks > 0 ? Math.ceil(r.afterDraftGap / avgExamMarks) : 0;
    r.status = r.gapMarks === 0 ? "ok"
      : (leaderMarks > 0 && r.gapMarks / leaderMarks <= 0.05 ? "close" : (r.afterDraftGap === 0 ? "draft-fix" : "behind"));
    r.isLeader = leader && r.batch === leader.batch;
  });

  return { rows, leaderBatch: leader ? leader.batch : null, leaderMarks, avgExamMarks, unassigned };
}
