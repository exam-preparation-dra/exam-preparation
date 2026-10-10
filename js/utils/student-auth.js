/* =========================================================
   STUDENT AUTH — PIN-only login for students.
   Firebase Auth needs an email, so each student gets a hidden fake email
   built from their studentId (STU-0001 -> stu-0001@students.exam-prep.local).
   Students only ever see/type a 6-digit PIN.

   Flow (new):
   1. A new student applies on join.html (name + batch + referral) and picks
      their OWN PIN right there. The PIN travels inside the studentRequests
      doc (admin-only readable) and is never shown in the admin UI.
   2. Admin approves -> createStudent() + adminCreateStudentWithPin():
      the Firebase Auth account is created with that PIN as its password.
      The applicant sees "approved" live (applicationStatus doc) and logs in.
   3. Admin adding a student by hand types the PIN in the add form — same path.
   Existing students keep the PIN they already have.

   PIN correction (forgot PIN) is the ONLY place the 8-digit code is used:
   admin deletes the user in Firebase Console (Authentication), then clicks
   the key button -> adminCreateStudentAccount() makes a one-time 8-digit
   code; the student enters it and is forced to choose a new PIN.
   ========================================================= */
import { app, auth, db } from "../firebase/firebase-config.js";
import {
  initializeApp, deleteApp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updatePassword, signOut, onAuthStateChanged,
  reauthenticateWithCredential, EmailAuthProvider,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const STUDENT_EMAIL_DOMAIN = "students.exam-prep.local";
export const studentEmail = (studentId) => `${String(studentId).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;

const persistenceReady = setPersistence(auth, browserLocalPersistence);

// Resolves with the studentId of whoever is signed in as a student, else null.
export function currentStudentSession() {
  return new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (user) => {
      off();
      const email = user?.email || "";
      if (email.endsWith("@" + STUDENT_EMAIL_DOMAIN)) {
        resolve(email.split("@")[0].toUpperCase());
      } else resolve(null);
    });
  });
}

export async function requireStudentSession(studentId) {
  return (await currentStudentSession()) === String(studentId).toUpperCase();
}

// Returns { needsNewPassword }. Throws on wrong password / no account yet.
export async function studentLogin(studentId, password) {
  await persistenceReady;
  await signInWithEmailAndPassword(auth, studentEmail(studentId), password);
  const snap = await getDoc(doc(db, "studentAuthState", studentId));
  const d = snap.exists() ? snap.data() : {};
  // Needs a new PIN if: first time (setup code) OR still on an old letter password (no pinSet flag yet).
  return { needsNewPassword: snap.exists() && (d.passwordSet === false || d.pinSet !== true) };
}

/* ---------- 6-DIGIT PIN RULES (client-side) ---------- */
export const PIN_LENGTH = 6;
export function validatePin(pin) {
  if (!/^\d+$/.test(pin) || pin.length !== PIN_LENGTH) return `PIN ঠিক ${PIN_LENGTH} সংখ্যার হতে হবে।`;
  if (/^(\d)\1+$/.test(pin)) return "একই সংখ্যা বারবার দেওয়া যাবে না (যেমন 111111)।";
  const asc = "0123456789", desc = "9876543210";
  if (asc.includes(pin) || desc.includes(pin)) return "পরপর সংখ্যা দেওয়া যাবে না (যেমন 123456)।";
  return "";
}

export async function setNewPassword(studentId, newPassword) {
  if (!auth.currentUser) throw new Error("আবার লগইন করো।");
  await updatePassword(auth.currentUser, newPassword);
  await setDoc(doc(db, "studentAuthState", studentId),
    { passwordSet: true, pinSet: true, updatedAt: serverTimestamp() }, { merge: true });
}

export async function studentLogout() {
  localStorage.removeItem("activeStudent");
  await signOut(auth);
}

export function friendlyStudentAuthError(err) {
  const c = err?.code || "";
  if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found")
    return "PIN ভুল, অথবা অ্যাডমিন এখনো তোমার সেটআপ কোড দেয়নি।";
  if (c === "auth/too-many-requests") return "অনেকবার ভুল হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করো।";
  if (c === "auth/weak-password") return "PIN ঠিক ৬ সংখ্যার হতে হবে।";
  if (c === "auth/network-request-failed") return "ইন্টারনেট সংযোগ নেই।";
  if (c === "auth/operation-not-allowed") return "Firebase Console-এ Email/Password sign-in চালু করা হয়নি।";
  return err?.message || "কিছু একটা ভুল হয়েছে।";
}

/* ---------- CHANGE PASSWORD + PRIVACY SETTINGS ---------- */
export async function changeMyPassword(studentId, oldPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("আবার লগইন করো।");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(studentEmail(studentId), oldPassword));
  await updatePassword(user, newPassword);
  await setDoc(doc(db, "studentAuthState", studentId),
    { passwordSet: true, pinSet: true, updatedAt: serverTimestamp() }, { merge: true });
}

// What OTHER students may see on my profile. Stored in `studentPrivacy/{studentId}`.
//  records / subjects / badges -> visible to friends only
//  publicStats                 -> rank + exam count visible even to non-friends
export const DEFAULT_PRIVACY = { records: true, subjects: true, badges: true, publicStats: false };

export async function getPrivacy(studentId) {
  try {
    const snap = await getDoc(doc(db, "studentPrivacy", studentId));
    return { ...DEFAULT_PRIVACY, ...(snap.exists() ? snap.data() : {}) };
  } catch { return { ...DEFAULT_PRIVACY }; }
}

export async function savePrivacy(studentId, p) {
  await setDoc(doc(db, "studentPrivacy", studentId), {
    records: !!p.records, subjects: !!p.subjects, badges: !!p.badges, publicStats: !!p.publicStats,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// Up to 3 badge ids the student wants to show on their profile / share card.
// Stored on the same studentPrivacy doc (merge) so savePrivacy never wipes it.
export async function savePinnedBadges(studentId, ids) {
  await setDoc(doc(db, "studentPrivacy", studentId), {
    pinnedBadges: (Array.isArray(ids) ? ids : []).slice(0, 3).map(String),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/* ---------- FIRST-TIME DETECTION + "APPLY FOR SETUP CODE" ---------- */
// Public, non-secret info used by the login screen to decide what to show:
//  hasAccount=false            -> first time, student can apply for a setup code
//  hasAccount && !passwordSet  -> admin already issued a code, student must enter it
//  hasAccount && passwordSet   -> normal password login
export async function getStudentAuthStatus(studentId) {
  const [a, r] = await Promise.all([
    getDoc(doc(db, "studentAuthState", studentId)),
    getDoc(doc(db, "setupRequests", studentId))
  ]);
  return {
    hasAccount: a.exists(),
    passwordSet: a.exists() && a.data().passwordSet === true,
    pinSet: a.exists() && a.data().pinSet === true,
    pending: r.exists() ? r.data() : null
  };
}

// type: "setup" (first time) or "reset" (forgot password). One doc per student.
export async function requestSetupCode(student, type = "setup") {
  const ref = doc(db, "setupRequests", student.studentId);
  if ((await getDoc(ref)).exists()) return; // already pending
  await setDoc(ref, {
    studentId: student.studentId,
    name: student.name || "",
    className: student.className || "",
    type,
    status: "pending",
    createdAt: serverTimestamp()
  });
}

/* ---------- ADMIN SIDE ---------- */
const CODE_ALPHABET = "0123456789"; // digits only, so students can type it on the on-screen keypad
function genCode(len = 8) {
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, n => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
}

// Creates the Firebase Auth account for a student with the given password.
// Uses a throwaway secondary Firebase app so the admin stays signed in.
// Throws auth/email-already-in-use if an account already exists.
async function createAuthAccount(studentId, password) {
  const secondary = initializeApp(app.options, "secondary-" + Date.now());
  try {
    const secAuth = getAuth(secondary);
    await createUserWithEmailAndPassword(secAuth, studentEmail(studentId), password);
    await signOut(secAuth);
  } finally {
    await deleteApp(secondary);
  }
}

// NEW STUDENTS: account is created with the PIN the student (or admin) chose,
// and marked as already set — no setup code, no forced PIN change.
export async function adminCreateStudentWithPin(studentId, pin) {
  const bad = validatePin(String(pin || ""));
  if (bad) throw new Error(bad);
  await createAuthAccount(studentId, String(pin));
  await setDoc(doc(db, "studentAuthState", studentId),
    { passwordSet: true, pinSet: true, createdAt: serverTimestamp() });
}

// PIN CORRECTION ONLY: account gets a random one-time 8-digit code as password;
// the student must enter it and then choose a new PIN.
// (Delete the old user in Firebase Console first to reset.)
export async function adminCreateStudentAccount(studentId) {
  const code = genCode();
  await createAuthAccount(studentId, code);
  await setDoc(doc(db, "studentAuthState", studentId),
    { passwordSet: false, createdAt: serverTimestamp() });
  return code;
}
