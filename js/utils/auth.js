/* =========================================================
   ADMIN AUTHENTICATION (password-only login)
   Admin email fixed; login page-e shudhu password lage.
   Students never use this — they use student-auth.js.
   ========================================================= */
import { auth } from "../firebase/firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Ei email firestore.rules-er isAdmin()-er email-er sathe mile thakte hobe.
export const ADMIN_EMAIL = "diptendu769@gmail.com";

const persistenceReady = setPersistence(auth, browserLocalPersistence);

const isAdminUser = (user) =>
  String(user?.email || "").toLowerCase() === ADMIN_EMAIL;

export async function adminLogin(password) {
  await persistenceReady;
  const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  if (!isAdminUser(cred.user)) {
    await signOut(auth);
    const err = new Error("এই অ্যাকাউন্ট দিয়ে অ্যাডমিন প্যানেলে ঢোকা যাবে না।");
    err.code = "auth/not-admin";
    throw err;
  }
  return cred.user;
}

export async function adminLogout() {
  await signOut(auth);
  window.location.href = "../admin/index.html";
}

// Redirects to login if not the admin. Call at the top of every admin page.
export function requireAdmin(onReady) {
  onAuthStateChanged(auth, (user) => {
    if (!user || !isAdminUser(user)) {
      window.location.href = "../admin/index.html";
    } else {
      onReady(user);
    }
  });
}

// For the login page itself: if admin already logged in, skip to dashboard.
export function redirectIfLoggedIn() {
  onAuthStateChanged(auth, (user) => {
    if (user && isAdminUser(user)) window.location.href = "../admin/dashboard.html";
  });
}
