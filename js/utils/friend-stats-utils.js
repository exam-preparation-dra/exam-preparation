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

// ---------- Cheers (ready-made messages to friends) ----------
// No typing: a student picks one of the preset messages below.
// One doc per message: `${from}_${to}_${timestamp}` in collection `friendCheers`.
// Limit: one message per CHEER_COOLDOWN_MS (checked on the client).
export const CHEER_COOLDOWN_MS = 30 * 1000;

// Website-style line icons for the preset messages (no native emoji).
const _i = p => `<svg class="cheer-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const CHEER_ICONS = {
  smile: _i(`<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>`),
  heart: _i(`<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>`),
  star: _i(`<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1z"/>`),
  flame: _i(`<path d="M12 3c1 4-4 5-4 10a4 4 0 0 0 8 0c0-2-1-3-1.5-4.5C13.5 9 13 6 12 3z"/>`),
  book: _i(`<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`),
  trophy: _i(`<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>`),
  clap: _i(`<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M13 10V6a1.5 1.5 0 0 1 3 0v6"/><path d="M7 11a1.5 1.5 0 0 0-3 0v3a8 8 0 0 0 8 8h1a6 6 0 0 0 6-6v-3a1.5 1.5 0 0 0-3 0"/>`),
  check: _i(`<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`),
  sun: _i(`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`),
  moon: _i(`<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>`),
  zap: _i(`<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>`),
  target: _i(`<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`),
  swords: _i(`<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4"/><path d="M7 17l-3 3"/><path d="M3 19l2 2"/>`),
  thumbs: _i(`<path d="M7 10v12"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.5l-2.3 8a2 2 0 0 1-1.9 1.5H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z"/>`),
  up: _i(`<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>`),
  pencil: _i(`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`),
  clock: _i(`<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`),
  users: _i(`<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>`),
  help: _i(`<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`),
  alert: _i(`<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>`),
  sparkles: _i(`<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17v4M17 19h4"/>`),
  gift: _i(`<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>`),
  ban: _i(`<circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/>`),
  flask: _i(`<path d="M9 3h6"/><path d="M10 3v6L4 20h16l-6-11V3"/>`),
  school: _i(`<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>`),
  leaf: _i(`<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>`),
  message: _i(`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`)
};
export const cheerIcon = key => CHEER_ICONS[key] || "";
export const stripEmoji = t => String(t || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{2764}\u{FE0F}\u{200D}]+/gu, "").replace(/\s+/g, " ").trim();
export const CHEER_TYPES = [
  { key: "m01", icon: "smile", text: "Hello" },
  { key: "m02", icon: "smile", text: "কেমন আছো?" },
  { key: "m03", icon: "star", text: "Tomorrow exam, best of luck" },
  { key: "m04", icon: "trophy", text: "All the best!" },
  { key: "m05", icon: "clap", text: "দারুণ করেছো!" },
  { key: "m06", icon: "flame", text: "আগুন!" },
  { key: "m07", icon: "book", text: "পড়তে বসো" },
  { key: "m08", icon: "book", text: "আজ পড়া হলো?" },
  { key: "m09", icon: "trophy", text: "অসাধারণ রেজাল্ট!" },
  { key: "m10", icon: "sparkles", text: "Congratulations" },
  { key: "m11", icon: "zap", text: "তুমি পারবে" },
  { key: "m12", icon: "heart", text: "চিন্তা করো না, ঠিক হয়ে যাবে" },
  { key: "m13", icon: "sun", text: "Good morning" },
  { key: "m14", icon: "moon", text: "Good night" },
  { key: "m15", icon: "sun", text: "শুভ সকাল" },
  { key: "m16", icon: "moon", text: "শুভ রাত্রি" },
  { key: "m17", icon: "thumbs", text: "Keep it up" },
  { key: "m18", icon: "up", text: "লিডারবোর্ডে এগিয়ে যাও" },
  { key: "m19", icon: "target", text: "আমি তোমাকে ধরে ফেলবো" },
  { key: "m20", icon: "swords", text: "Rival, ready?" },
  { key: "m21", icon: "target", text: "চ্যালেঞ্জ নেবে?" },
  { key: "m22", icon: "swords", text: "Battle-এ আসো" },
  { key: "m23", icon: "pencil", text: "Revision শুরু করো" },
  { key: "m24", icon: "check", text: "আজকের টার্গেট শেষ?" },
  { key: "m25", icon: "flask", text: "Mock test দাও" },
  { key: "m26", icon: "school", text: "Exam hall-এ দেখা হবে" },
  { key: "m27", icon: "leaf", text: "শান্ত থেকো, ভালো করবে" },
  { key: "m28", icon: "heart", text: "Thanks বন্ধু" },
  { key: "m29", icon: "heart", text: "Sorry" },
  { key: "m30", icon: "users", text: "Welcome" },
  { key: "m31", icon: "gift", text: "শুভ জন্মদিন" },
  { key: "m32", icon: "sparkles", text: "শুভ উৎসব" },
  { key: "m33", icon: "heart", text: "ভালো থেকো" },
  { key: "m34", icon: "heart", text: "Miss you" },
  { key: "m35", icon: "clock", text: "পরে কথা বলবো" },
  { key: "m36", icon: "help", text: "আজ exam কেমন হলো?" },
  { key: "m37", icon: "alert", text: "Question কঠিন ছিলো" },
  { key: "m38", icon: "smile", text: "Question সোজা ছিলো" },
  { key: "m39", icon: "pencil", text: "Notes দেবে?" },
  { key: "m40", icon: "users", text: "একসাথে পড়বো?" },
  { key: "m41", icon: "flame", text: "Study streak ধরে রাখো" },
  { key: "m42", icon: "clock", text: "সময় নষ্ট করো না ⏰" },
  { key: "m43", icon: "ban", text: "Phone রাখো, পড়ো" },
  { key: "m44", icon: "up", text: "Top 10-এ আসছো" },
  { key: "m45", icon: "star", text: "Proud of you" },
  { key: "m46", icon: "zap", text: "Don't give up" },
  { key: "m47", icon: "alert", text: "Wow!" },
  { key: "m48", icon: "smile", text: "হাহা" },
  { key: "m49", icon: "zap", text: "জলদি আসো" },
  { key: "m50", icon: "star", text: "Result-এর জন্য best of luck" }
];

export function dayKey(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const lastKey = (id) => `cheerLast_${id}`;
export function cheerWaitMs(fromId, serverLastMs = 0) {
  let local = 0;
  try { local = Number(localStorage.getItem(lastKey(fromId))) || 0; } catch (e) {}
  const last = Math.max(local, serverLastMs || 0);
  return Math.max(0, last + CHEER_COOLDOWN_MS - Date.now());
}

export async function sendCheer(fromId, toId, type, serverLastMs = 0) {
  if (!fromId || !toId || fromId === toId) throw new Error("নিজেকে বার্তা পাঠানো যায় না।");
  const t = CHEER_TYPES.find(x => x.key === type);
  if (!t) throw new Error("অজানা বার্তা।");
  const wait = cheerWaitMs(fromId, serverLastMs);
  if (wait > 0) throw new Error(`আরও ${Math.ceil(wait / 1000)} সেকেন্ড পরে পাঠাও।`);
  const now = Date.now();
  await setDoc(doc(db, "friendCheers", `${fromId}_${toId}_${now}`), {
    fromStudentId: fromId, toStudentId: toId, type, text: t.text, dayKey: dayKey(now), createdAt: serverTimestamp()
  });
  try { localStorage.setItem(lastKey(fromId), String(now)); } catch (e) {}
}

// received: messages from the last 7 days, newest first
// lastSentMs: time of this student's most recent sent message
export async function getCheerData(studentId) {
  const [rec, sent] = await Promise.all([
    getDocs(query(collection(db, "friendCheers"), where("toStudentId", "==", studentId))),
    getDocs(query(collection(db, "friendCheers"), where("fromStudentId", "==", studentId)))
  ]);
  const from7 = dayKey(Date.now() - 6 * DAY_MS);
  const ms = (c) => toMillis(c.createdAt) || 0;
  const received = rec.docs.map(d => d.data()).filter(c => (c.dayKey || "") >= from7)
    .sort((a, b) => ms(b) - ms(a) || String(b.dayKey).localeCompare(String(a.dayKey)));
  const lastSentMs = sent.docs.reduce((m, d) => Math.max(m, ms(d.data())), 0);
  return { received, sentToday: new Set(), lastSentMs };
}
