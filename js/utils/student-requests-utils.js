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
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// referredBy: the STU-XXXX id read from the ?ref= link (see join.html). Carried
// through to the real student doc when the admin approves this request.
// pin: the 6-digit PIN the applicant chose. Returns the application id.
export async function submitStudentRequest(rawName, className, referredBy = null, pin = "") {
  const trimmedName = (rawName || "").trim();
  const trimmedClass = (className || "").trim();
  if (!trimmedName) throw new Error("নাম দিতে হবে।");
  if (!trimmedClass) throw new Error("ক্লাস দিতে হবে।");
  const badPin = validatePin(String(pin || ""));
  if (badPin) throw new Error(badPin);

  const ref = await addDoc(collection(db, "studentRequests"), {
    rawName: trimmedName,
    className: trimmedClass,
    referredBy: referredBy || null,
    pin: String(pin),
    status: "pending",
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "applicationStatus", ref.id), {
    status: "pending",
    name: trimmedName,
    className: trimmedClass,
    createdAt: serverTimestamp()
  });
  return ref.id;
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
