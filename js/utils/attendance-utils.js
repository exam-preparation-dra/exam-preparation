/* =========================================================
   ATTENDANCE UTILITIES

   Collections (all plain strings, no composite indexes needed):
     attendanceDays/{Batch_8_2026-10-11}   one doc per (batch, date) = a class or
                                           exam day the admin has set. These are the
                                           "100%" the percentage is measured against.
        { batch, date, month, type: "class"|"exam", note?, createdAt }
     attendance/{2026-10-11_STU-0001}      one doc per (date, student) = present
        { studentId, name, batch, date, month, method: "qr"|"manual", markedAt }
        (absent = no doc, so a student can never be marked twice)
     attendanceAwards/{2026-09}            written by the admin once a month is over
        { month, xp, winners:[{studentId,name,batch,present,total,pct}] }
        -> xp-utils.js reads these, so the 1000 XP shows on every page.

   Student QR text:  EPATT:STU-0001
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { normalizeBatch } from "./batch-utils.js";
import { ATTENDANCE_MONTHLY_XP } from "./xp-utils.js";

export { ATTENDANCE_MONTHLY_XP };
export const QR_PREFIX = "EPATT:";
export const DAY_TYPES = { class: "ক্লাস", exam: "পরীক্ষা" };

/* ---------------- pure helpers ---------------- */
export const attendanceQrText = (student) => QR_PREFIX + String(student?.studentId || "").toUpperCase();

// "EPATT:STU-0001" (or a bare "STU-0001" typed by hand) -> "STU-0001", else null
export function parseAttendanceQr(text) {
  const m = String(text || "").trim().match(/^(?:EPATT:)?\s*(STU-\d{1,6})\s*$/i);
  return m ? m[1].toUpperCase() : null;
}

export const batchKey = (b) => (normalizeBatch(b) || "NoBatch").replace(/\s+/g, "_");
export const dayDocId = (batch, date) => `${batchKey(batch)}_${date}`;
export const attDocId = (date, studentId) => `${date}_${studentId}`;

const p2 = (n) => String(n).padStart(2, "0");
export function dateStr(d = new Date()) { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
export const monthOf = (date) => String(date).slice(0, 7);
export const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

const BN = "০১২৩৪৫৬৭৮৯";
export const bn = (v) => String(v).replace(/\d/g, d => BN[d]);
export function fmtDate(date, opts = { day: "numeric", month: "short" }) {
  if (!isDateStr(date)) return String(date || "");
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("bn-BD", opts);
}
export function fmtMonth(month) {
  const [y, m] = String(month).split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
}

/* Percentage for one student.
   days    : attendanceDays docs of the student's batch
   records : attendance docs of the student
   Only days up to `today` count (future days are not "absent" yet).
   -> { total, present, absent, pct|null, rows:[{date,type,present}] newest first } */
export function computeAttendanceStats(days, records, { today = dateStr(), month = null } = {}) {
  const presentDates = new Set((records || []).filter(r => r && r.date).map(r => r.date));
  const sched = (days || [])
    .filter(d => d && isDateStr(d.date) && d.date <= today && (!month || monthOf(d.date) === month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const rows = sched.map(d => ({ date: d.date, type: d.type || "class", note: d.note || "", present: presentDates.has(d.date) }));
  const present = rows.filter(r => r.present).length;
  const total = rows.length;
  return { total, present, absent: total - present, pct: total ? Math.round((present / total) * 100) : null, rows };
}

/* Winner(s) of ONE finished month, per batch (each batch has its own class days,
   so comparing across batches wouldn't be fair).
   Best = highest % , then most present days. Exact ties all win.
   Needs at least 1 present day. */
export function computeMonthWinners(month, students, days, records) {
  const dayList = (days || []).filter(d => monthOf(d.date) === month);
  const byBatchTotal = {};
  dayList.forEach(d => { const b = normalizeBatch(d.batch); byBatchTotal[b] = (byBatchTotal[b] || 0) + 1; });
  const presentBy = {};
  (records || []).filter(r => monthOf(r.date) === month).forEach(r => {
    const key = r.studentId;
    (presentBy[key] ||= new Set()).add(r.date);
  });
  const winners = [];
  Object.keys(byBatchTotal).forEach(batch => {
    const total = byBatchTotal[batch];
    const batchDates = new Set(dayList.filter(d => normalizeBatch(d.batch) === batch).map(d => d.date));
    const rows = (students || [])
      .filter(s => normalizeBatch(s.className) === batch)
      .map(s => {
        const present = [...(presentBy[s.studentId] || [])].filter(dt => batchDates.has(dt)).length;
        return { studentId: s.studentId, name: s.name || s.studentId, batch, present, total, pct: Math.round((present / total) * 100) };
      })
      .filter(r => r.present > 0)
      .sort((a, b) => b.pct - a.pct || b.present - a.present);
    if (!rows.length) return;
    const best = rows[0];
    rows.filter(r => r.pct === best.pct && r.present === best.present).forEach(r => winners.push(r));
  });
  return winners;
}

/* Live ranking of a (possibly running) month, for the leaderboard card. */
export function rankMonth(month, students, days, records) {
  const dayList = (days || []).filter(d => monthOf(d.date) === month);
  const dates = {};
  dayList.forEach(d => { (dates[normalizeBatch(d.batch)] ||= new Set()).add(d.date); });
  const presentBy = {};
  (records || []).filter(r => monthOf(r.date) === month).forEach(r => { (presentBy[r.studentId] ||= new Set()).add(r.date); });
  return (students || []).map(s => {
    const b = normalizeBatch(s.className);
    const set = dates[b] || new Set();
    const present = [...(presentBy[s.studentId] || [])].filter(d => set.has(d)).length;
    const total = set.size;
    return { studentId: s.studentId, name: s.name || s.studentId, batch: b, present, total, pct: total ? Math.round((present / total) * 100) : 0 };
  }).filter(r => r.total > 0).sort((a, b) => b.pct - a.pct || b.present - a.present || String(a.name).localeCompare(String(b.name), "bn"));
}

/* ---------------- Firestore: reads ---------------- */
const mapDocs = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

export async function getBatchDays(batch) {
  const b = normalizeBatch(batch);
  if (!b) return [];
  return mapDocs(await getDocs(query(collection(db, "attendanceDays"), where("batch", "==", b))));
}
export async function getStudentAttendance(studentId) {
  return mapDocs(await getDocs(query(collection(db, "attendance"), where("studentId", "==", studentId))));
}
export async function getDateAttendance(date) {
  return mapDocs(await getDocs(query(collection(db, "attendance"), where("date", "==", date))));
}
export async function getMonthAttendance(month) {
  return mapDocs(await getDocs(query(collection(db, "attendance"), where("month", "==", month))));
}
export async function getMonthDays(month) {
  return mapDocs(await getDocs(query(collection(db, "attendanceDays"), where("month", "==", month))));
}
export async function getAllDays() { return mapDocs(await getDocs(collection(db, "attendanceDays"))); }
export async function getAwards() {
  return mapDocs(await getDocs(collection(db, "attendanceAwards"))).sort((a, b) => String(b.month).localeCompare(String(a.month)));
}

/* ---------------- Firestore: admin writes ---------------- */
export async function ensureDay(batch, date, type) {
  const b = normalizeBatch(batch);
  const ref = doc(db, "attendanceDays", dayDocId(b, date));
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const data = { batch: b, date, month: monthOf(date), type: type === "exam" ? "exam" : "class", createdAt: serverTimestamp() };
  await setDoc(ref, data);
  return data;
}

// Mark a student present. Safe to call twice: returns { already: true } the 2nd time.
export async function markPresent(student, date, { type = "class", method = "qr" } = {}) {
  if (!student?.studentId) throw new Error("শিক্ষার্থী পাওয়া যায়নি।");
  if (!isDateStr(date)) throw new Error("তারিখ ঠিক নেই।");
  const batch = normalizeBatch(student.className);
  if (!batch) throw new Error("এই শিক্ষার্থীর ব্যাচ সেট করা নেই।");
  const ref = doc(db, "attendance", attDocId(date, student.studentId));
  const snap = await getDoc(ref);
  await ensureDay(batch, date, type);
  if (snap.exists()) return { already: true, batch };
  await setDoc(ref, {
    studentId: student.studentId, name: student.name || "", batch, date, month: monthOf(date),
    method, markedAt: serverTimestamp()
  });
  return { already: false, batch };
}

// Fast path for the admin page: one write, no read-before-write (caller already knows the state).
export function markPresentFast(student, date, method = "manual") {
  const batch = normalizeBatch(student.className);
  return setDoc(doc(db, "attendance", attDocId(date, student.studentId)), {
    studentId: student.studentId, name: student.name || "", batch, date, month: monthOf(date),
    method, markedAt: serverTimestamp()
  });
}

export async function unmarkPresent(studentId, date) {
  await deleteDoc(doc(db, "attendance", attDocId(date, studentId)));
}

// Mark many at once (batch-wise list). `presentIds` = ids that should be present;
// `allStudents` = the whole batch list, so the others are cleared.
export async function saveBatchAttendance(batch, date, type, allStudents, presentIds) {
  const b = normalizeBatch(batch);
  await ensureDay(b, date, type);
  const want = new Set(presentIds);
  const existing = new Set(mapDocs(await getDocs(query(collection(db, "attendance"), where("date", "==", date)))).map(r => r.studentId));
  const wb = writeBatch(db);
  let n = 0;
  allStudents.forEach(s => {
    const ref = doc(db, "attendance", attDocId(date, s.studentId));
    if (want.has(s.studentId) && !existing.has(s.studentId)) {
      wb.set(ref, { studentId: s.studentId, name: s.name || "", batch: b, date, month: monthOf(date), method: "manual", markedAt: serverTimestamp() }); n++;
    } else if (!want.has(s.studentId) && existing.has(s.studentId)) {
      wb.delete(ref); n++;
    }
  });
  if (n) await wb.commit();
  return n;
}

export async function setDay(batch, date, type, note = "") {
  const b = normalizeBatch(batch);
  await setDoc(doc(db, "attendanceDays", dayDocId(b, date)), {
    batch: b, date, month: monthOf(date), type: type === "exam" ? "exam" : "class", note: String(note || "").slice(0, 80), createdAt: serverTimestamp()
  });
}
export async function removeDay(batch, date) {
  await deleteDoc(doc(db, "attendanceDays", dayDocId(batch, date)));
}

/* Finished months that don't have an award doc yet get one (admin page calls this
   on open). Only months strictly before the current month are finalised. */
export async function finalizeMonths(students) {
  const today = dateStr();
  const thisMonth = monthOf(today);
  const [days, awards] = await Promise.all([getAllDays(), getAwards()]);
  const done = new Set(awards.map(a => a.month));
  const months = [...new Set(days.map(d => d.month || monthOf(d.date)))].filter(m => m < thisMonth && !done.has(m)).sort();
  const created = [];
  for (const m of months) {
    const records = await getMonthAttendance(m);
    const winners = computeMonthWinners(m, students, days, records);
    await setDoc(doc(db, "attendanceAwards", m), { month: m, xp: ATTENDANCE_MONTHLY_XP, winners, createdAt: serverTimestamp() });
    created.push({ month: m, xp: ATTENDANCE_MONTHLY_XP, winners });
  }
  return created;
}
