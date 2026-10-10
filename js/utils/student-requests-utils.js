/* =========================================================
   STUDENT JOIN REQUESTS — a prospective student submits their name
   (English letters are fine) + batch + their own PIN from the public join
   page. It sits as "pending" until the admin reviews it (fixes the Bengali
   spelling, then approves or rejects) in admin/students.html. Approving
   creates a real student via createStudent() in student-utils.js and the
   Auth account via adminCreateStudentWithPin() in student-auth.js — this
   file only manages the request queue + the public status the applicant
   watches.

   Two docs per application (same id):
   - studentRequests/{id}   admin-only readable. Holds the PIN.
   - applicationStatus/{id} public. { status: pending | approved | rejected,
                            studentId?, name, needsCode? } — the applicant's
                            join page listens to it live. NEVER holds the PIN.
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import { validatePin } from "./student-auth.js";
import {
  collection, addDoc, getDocs, query, where, doc, deleteDoc, setDoc, getDoc,
  onSnapshot, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------- Term / semester options (depend on the batch) ----------
// Batch 6–10  -> 1st Summative · 2nd Summative · Final
// Batch 11    -> 1st Semester · 2nd Semester
// Batch 12    -> 3rd Semester · 4th Semester
// "Other"     -> no term question.
// The chosen term is saved together with the join date (termSetAt).
export function termOptionsForBatch(className) {
  const m = String(className || "").match(/(\d+)/);
  const n = m ? Number(m[1]) : 0;
  if (n >= 6 && n <= 10) return ["1st Summative", "2nd Summative", "Final"];
  if (n === 11) return ["1st Semester", "2nd Semester"];
  if (n === 12) return ["3rd Semester", "4th Semester"];
  return [];
}

// Reserves the next STU-XXXX id right when the applicant applies (same counter the
// admin side uses, so ids never collide). If the admin rejects, the id is voided
// (it is simply never used again); if approved, the student gets exactly this id.
async function reserveStudentId() {
  const counterRef = doc(db, "counters", "studentCounter");
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists() ? Number(snap.data().lastSequence) || 0 : 0) + 1;
    tx.set(counterRef, { lastSequence: next }, { merge: true });
    return next;
  });
  return { sequenceNumber: seq, studentId: `STU-${String(seq).padStart(4, "0")}` };
}

// referredBy: the STU-XXXX id read from the ?ref= link (see join.html). Carried
// through to the real student doc when the admin approves this request.
// pin: the 6-digit PIN the applicant chose.
// term: chosen term/semester (see termOptionsForBatch) or "" for none.
// Returns { id, studentId, sequenceNumber } — the application id + reserved student id.
export async function submitStudentRequest(rawName, className, referredBy = null, pin = "", term = "") {
  const trimmedName = (rawName || "").trim();
  const trimmedClass = (className || "").trim();
  const trimmedTerm = (term || "").trim();
  if (!trimmedName) throw new Error("নাম দিতে হবে।");
  if (!trimmedClass) throw new Error("ক্লাস দিতে হবে।");
  const opts = termOptionsForBatch(trimmedClass);
  if (opts.length && !opts.includes(trimmedTerm)) throw new Error("চলতি টার্ম/সেমিস্টার বেছে নিতে হবে।");
  const badPin = validatePin(String(pin || ""));
  if (badPin) throw new Error(badPin);

  const reserved = await reserveStudentId();
  const ref = await addDoc(collection(db, "studentRequests"), {
    rawName: trimmedName,
    className: trimmedClass,
    referredBy: referredBy || null,
    pin: String(pin),
    status: "pending",
    studentId: reserved.studentId,
    sequenceNumber: reserved.sequenceNumber,
    term: trimmedTerm || null,
    termSetAt: serverTimestamp(),
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "applicationStatus", ref.id), {
    status: "pending",
    name: trimmedName,
    className: trimmedClass,
    studentId: reserved.studentId,
    term: trimmedTerm || null,
    termSetAt: serverTimestamp(),
    createdAt: serverTimestamp()
  });
  return { id: ref.id, studentId: reserved.studentId, sequenceNumber: reserved.sequenceNumber };
}

// All applications still waiting for the admin (public, no secrets). Used by the
// login page to show the applicants' names blurred. Returns the unsubscribe fn.
export function watchPendingApplications(cb) {
  return onSnapshot(
    query(collection(db, "applicationStatus"), where("status", "==", "pending")),
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })), null),
    (err) => cb(null, err));
}

// Live status for the applicant's waiting screen. Returns the unsubscribe fn.
// cb(null) is called if the status doc doesn't exist (or can't be read).
export function watchApplication(applicationId, cb) {
  return onSnapshot(doc(db, "applicationStatus", applicationId),
    (snap) => cb(snap.exists() ? snap.data() : null),
    () => cb(null));
}

export async function getApplication(applicationId) {
  const snap = await getDoc(doc(db, "applicationStatus", applicationId));
  return snap.exists() ? snap.data() : null;
}

// Admin: tell the applicant the outcome. Called right before the request is removed.
export async function publishApplicationResult(applicationId, result) {
  await setDoc(doc(db, "applicationStatus", applicationId), {
    ...result,
    decidedAt: serverTimestamp()
  }, { merge: true });
}

export async function getPendingRequests() {
  const snap = await getDocs(query(collection(db, "studentRequests"), where("status", "==", "pending")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Both "approved" and "rejected" end the same way — the request is done
// with (and its PIN is gone with it), so it's simply removed from the queue.
export async function deleteStudentRequest(requestId) {
  await deleteDoc(doc(db, "studentRequests", requestId));
}
