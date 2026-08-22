/* =========================================================
   ADMIN AUTHENTICATION
   Students never use this — they only use student-utils.js selection flow.
   ========================================================= */
import { auth } from "../firebase/firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Fire this at module load, but explicitly await it before any sign-in call
// below — otherwise on a slow connection, adminLogin() could race ahead of
// persistence being configured, silently falling back to session-only
// persistence for that login.
const persistenceReady = setPersistence(auth, browserLocalPersistence);

export async function adminLogin(email, password) {
  await persistenceReady;
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function adminLogout() {
  await signOut(auth);
  window.location.href = "../admin/index.html";
}

// Redirects to login if not authenticated. Call at the top of every admin page.
export function requireAdmin(onReady) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "../admin/index.html";
    } else {
      onReady(user);
    }
  });
}

// For the login page itself: if already logged in, skip straight to dashboard.
export function redirectIfLoggedIn() {
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "../admin/dashboard.html";
  });
}
