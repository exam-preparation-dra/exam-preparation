/* =========================================================
   STAGES — one named stage per dashboard level (LEVEL_THRESHOLDS in
   xp-utils.js). Names are subject-neutral on purpose: the app covers every
   subject, so the profile prefixes the student's auto-detected main subject
   (e.g. "রসায়ন Master"). Edit names / colours here and the profile,
   stage collection, compare and activity feed all follow.
   ========================================================= */
import { getLevelInfo } from "./xp-utils.js";

export const STAGES = [
  { name: "Explorer",         color: "#8b95a5", bn: "যাত্রা শুরু — পড়াশোনার জগৎ চেনার ধাপ" },
  { name: "Concept Builder",  color: "#0ea5e9", bn: "ধারণা গড়ে তোলার ধাপ" },
  { name: "Problem Solver",   color: "#14b8a6", bn: "সমস্যা সমাধানে হাত পাকানোর ধাপ" },
  { name: "Master",           color: "#8b5cf6", bn: "বিষয়ের ওপর দখল তৈরির ধাপ" },
  { name: "Legend",           color: "#d99a1f", bn: "কিংবদন্তির আসন" },
  { name: "Deep Thinker",     color: "#ec4899", bn: "গভীর চিন্তার ধাপ" },
  { name: "Visionary",        color: "#f97316", bn: "দূরদর্শী মননের ধাপ" },
  { name: "Grandmaster",      color: "#ef4444", bn: "শীর্ষ কয়েকজনের ধাপ" },
  { name: "Ultimate Scholar", color: "#6366f1", bn: "সর্বোচ্চ স্টেজ — চূড়ান্ত পণ্ডিত" }
];

export function stageOf(xp) {
  const lv = getLevelInfo(Number(xp) || 0).level;
  return { ...STAGES[Math.min(lv, STAGES.length) - 1], level: lv };
}

/* Auto-detect a student's main subject from computeSubjectStats() rows
   ({ name, attempts, accuracy }): the subject they practise most, with
   better accuracy breaking ties. Returns { name, attempts, accuracy } or
   null when there is no subject data yet. */
export function detectMainSubject(subjectStats) {
  const list = (subjectStats || []).filter(s => s && s.name && s.name !== "--" && Number(s.attempts) > 0);
  if (!list.length) return null;
  list.sort((a, b) => (b.attempts - a.attempts) || ((b.accuracy ?? -1) - (a.accuracy ?? -1)));
  return { name: list[0].name, attempts: list[0].attempts, accuracy: list[0].accuracy };
}

export const stageTitle = (stage, subject) => (subject ? `${subject} ${stage.name}` : stage.name);
