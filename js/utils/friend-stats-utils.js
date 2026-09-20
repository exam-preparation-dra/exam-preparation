/* =========================================================
   FRIEND / LEADERBOARD STATS — derived numbers for the leaderboard page.

   Everything here is calculated from data the app already has
   (approved results + completed challenges). Nothing new is stored, so no
   new Firestore collection or rule is needed.

     - weeklyStreak     consecutive weeks (Mon-based) with at least one exam
     - buildStudentExtras   per-student weekly XP, streak, recent scores
     - computeRankMovement  rank change vs. an earlier snapshot of the board
     - getHeadToHeadMap     win / loss / draw record from completed challenges
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { computeStudentXP, compareRank } from "./xp-utils.js";

export const DAY_MS = 24 * 60 * 60 * 1000;

export function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
}

// Monday-based week number (consecutive weeks differ by exactly 1) — same
// convention the XP engine uses for its weekly-streak bonus.
function weekIndex(ms) {
  const d = new Date(ms);
  const days = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;
  return Math.floor((days + 3) / 7);
}

// 00:00 on the Monday of the week containing `now` (device local time).
export function startOfWeekMs(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

// Consecutive weeks with an exam, counted back from this week. If nothing
// has been taken yet THIS week the streak is still alive (counted from last
// week), so it only resets after a whole week is missed.
export function weeklyStreak(results, now = Date.now()) {
  const weeks = new Set((results || []).map(r => toMillis(r.submittedAt)).filter(Boolean).map(weekIndex));
  let w = weekIndex(now);
  if (!weeks.has(w)) w -= 1;
  let n = 0;
  while (weeks.has(w)) { n += 1; w -= 1; }
  return n;
}

// results: everyone's counted results. Returns { [studentId]: extras }.
//   weeklyXP / weeklyExams  XP and exams since Monday
//   streak                  weekly streak (see above)
//   recent                  last 6 exam scores, oldest -> newest: [{ name, pct }]
//   last                    most recent result (or null)
//   perfectExams            number of 100% exams
export function buildStudentExtras(results, now = Date.now()) {
  const grouped = {};
  (results || []).forEach(r => { if (r.studentId) (grouped[r.studentId] ||= []).push(r); });
  const weekStart = startOfWeekMs(now);
  const out = {};

  for (const [sid, list] of Object.entries(grouped)) {
    const sorted = [...list].sort((a, b) => toMillis(a.submittedAt) - toMillis(b.submittedAt));
    const xp = computeStudentXP(sorted, { referralCount: 0 });
    const thisWeek = xp.exams.filter(e => e.submittedAtMs >= weekStart);
    out[sid] = {
      weeklyXP: thisWeek.reduce((a, e) => a + e.xp, 0),
      weeklyExams: thisWeek.length,
      streak: weeklyStreak(sorted, now),
      recent: sorted.slice(-6).map(r => ({ name: r.examName || "পরীক্ষা", pct: Number(r.percentage) || 0 })),
      last: sorted[sorted.length - 1] || null,
      perfectExams: xp.perfectExams
    };
  }
  return out;
}

// currentRows / previousRows: leaderboard rows (both already sorted with
// compareRank). Returns { [studentId]: change } where change > 0 means the
// student climbed. Students who were not on the earlier board get `null`
// (they are new, so there is nothing honest to compare against).
export function computeRankMovement(currentRows, previousRows) {
  const prevRank = {};
  [...(previousRows || [])].sort(compareRank).forEach((r, i) => { prevRank[r.studentId] = i + 1; });
  const out = {};
  (currentRows || []).forEach((r, i) => {
    out[r.studentId] = prevRank[r.studentId] ? prevRank[r.studentId] - (i + 1) : null;
  });
  return out;
}

// Win / loss / draw record against every other student, from completed
// challenges. Returns { [otherStudentId]: { wins, losses, draws } }.
export async function getHeadToHeadMap(studentId) {
  if (!studentId) return {};
  const [asFrom, asTo] = await Promise.all([
    getDocs(query(collection(db, "examChallenges"), where("fromStudentId", "==", studentId), where("status", "==", "completed"))),
    getDocs(query(collection(db, "examChallenges"), where("toStudentId", "==", studentId), where("status", "==", "completed")))
  ]);
  const map = {};
  [...asFrom.docs, ...asTo.docs].forEach(d => {
    const c = d.data();
    const other = c.fromStudentId === studentId ? c.toStudentId : c.fromStudentId;
    if (!other) return;
    const rec = (map[other] ||= { wins: 0, losses: 0, draws: 0 });
    if (c.winnerStudentId === studentId) rec.wins += 1;
    else if (c.loserStudentId === studentId) rec.losses += 1;
    else rec.draws += 1;
  });
  return map;
}

// ---------- Hall of Fame awards ----------
// rows: leaderboard rows of the CURRENT scope. Every award is derived from
// existing data; ties go to whoever is higher on the leaderboard.
// Returns [{ key, student, value }] — only awards that someone actually earned.
export function buildAwards(rows, extras, movement) {
  const list = rows || [];
  const best = (filter, score) => {
    let winner = null, top = -Infinity;
    for (const r of list) {
      const v = score(r);
      if (filter(r, v) && v > top) { top = v; winner = r; }
    }
    return winner ? { student: winner, value: top } : null;
  };
  const ex = id => (extras && extras[id]) || {};
  const out = [];
  const push = (key, res) => { if (res) out.push({ key, ...res }); };

  push("accuracy", best((r) => Number(r.examsTaken) >= 2, r => Number(r.avgPercentage) || 0));
  push("streak",   best((r, v) => v >= 2, r => ex(r.studentId).streak || 0));
  push("weekly",   best((r, v) => v > 0, r => ex(r.studentId).weeklyXP || 0));
  push("perfect",  best((r, v) => v > 0, r => ex(r.studentId).perfectExams || 0));
  push("active",   best((r, v) => v >= 2, r => Number(r.examsTaken) || 0));
  push("climber",  best((r, v) => v > 0, r => (movement && movement[r.studentId]) || 0));
  return out;
}

// ---------- Cheers (friend-only encouragement) ----------
// One doc per (sender, receiver, day): doc id = `${from}_${to}_${YYYY-MM-DD}`,
// so a student can cheer each friend once a day without any extra reads.
// Collection `friendCheers` — see firestore.rules for the (optional) rule.
export const CHEER_TYPES = [
  { key: "clap", label: "দারুণ!" },
  { key: "fire", label: "আগুন!" },
  { key: "book", label: "পড়তে বসো" }
];

export function dayKey(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function sendCheer(fromId, toId, type) {
  if (!fromId || !toId || fromId === toId) throw new Error("নিজেকে উৎসাহ পাঠানো যায় না।");
  if (!CHEER_TYPES.some(t => t.key === type)) throw new Error("অজানা উৎসাহ।");
  const day = dayKey();
  await setDoc(doc(db, "friendCheers", `${fromId}_${toId}_${day}`), {
    fromStudentId: fromId, toStudentId: toId, type, dayKey: day, createdAt: serverTimestamp()
  });
}

// received: cheers from the last 7 days, newest first
// sentToday: Set of friend ids this student already cheered today
export async function getCheerData(studentId) {
  const [rec, sent] = await Promise.all([
    getDocs(query(collection(db, "friendCheers"), where("toStudentId", "==", studentId))),
    getDocs(query(collection(db, "friendCheers"), where("fromStudentId", "==", studentId)))
  ]);
  const from7 = dayKey(Date.now() - 6 * DAY_MS);
  const today = dayKey();
  const received = rec.docs.map(d => d.data()).filter(c => (c.dayKey || "") >= from7)
    .sort((a, b) => String(b.dayKey).localeCompare(String(a.dayKey)));
  const sentToday = new Set(sent.docs.map(d => d.data()).filter(c => c.dayKey === today).map(c => c.toStudentId));
  return { received, sentToday };
}
