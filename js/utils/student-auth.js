/* =========================================================
   STUDENT AUTH — password-only login for students.
   Firebase Auth needs an email, so each student gets a hidden fake email
   built from their studentId (STU-0001 -> stu-0001@students.exam-prep.local).
   Students only ever see/type a password.

   Flow:
   1. Admin clicks "Setup code" on admin/students.html -> an account is created
      with a random one-time setup code as its password (adminCreateStudentAccount).
   2. Student selects their name on index.html, types the setup code, and is
      forced to choose their own password (studentLogin -> setNewPassword).
   3. From then on they log in with their own password.
   Forgot password: admin deletes the user in Firebase Console (Authentication),
   then clicks "Setup code" again.
   ========================================================= */
import { app, auth, db } from "../firebase/firebase-config.js";
import {
  initializeApp, deleteApp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updatePassword, signOut, onAuthStateChanged,
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
  return { needsNewPassword: snap.exists() && snap.data().passwordSet === false };
}

export async function setNewPassword(studentId, newPassword) {
  if (!auth.currentUser) throw new Error("আবার লগইন করো।");
  await updatePassword(auth.currentUser, newPassword);
  await setDoc(doc(db, "studentAuthState", studentId),
    { passwordSet: true, updatedAt: serverTimestamp() }, { merge: true });
}

export async function studentLogout() {
  localStorage.removeItem("activeStudent");
  await signOut(auth);
}

export function friendlyStudentAuthError(err) {
  const c = err?.code || "";
  if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found")
    return "পাসওয়ার্ড ভুল, অথবা অ্যাডমিন এখনো তোমার সেটআপ কোড দেয়নি।";
  if (c === "auth/too-many-requests") return "অনেকবার ভুল হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করো।";
  if (c === "auth/weak-password") return "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।";
  if (c === "auth/network-request-failed") return "ইন্টারনেট সংযোগ নেই।";
  if (c === "auth/operation-not-allowed") return "Firebase Console-এ Email/Password sign-in চালু করা হয়নি।";
  return err?.message || "কিছু একটা ভুল হয়েছে।";
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
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
function genCode(len = 8) {
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, n => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
}

// Creates the student's account with a one-time setup code as password.
// Uses a throwaway secondary Firebase app so the admin stays signed in.
// Throws auth/email-already-in-use if an account already exists
// (delete it in Firebase Console first to reset).
export async function adminCreateStudentAccount(studentId) {
  const code = genCode();
  const secondary = initializeApp(app.options, "secondary-" + Date.now());
  try {
    const secAuth = getAuth(secondary);
    await createUserWithEmailAndPassword(secAuth, studentEmail(studentId), code);
    await signOut(secAuth);
  } finally {
    await deleteApp(secondary);
  }
  await setDoc(doc(db, "studentAuthState", studentId),
    { passwordSet: false, createdAt: serverTimestamp() });
  return code;
}
