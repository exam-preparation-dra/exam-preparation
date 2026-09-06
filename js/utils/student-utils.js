/* =========================================================
   STUDENT UTILITIES
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, getDocs, getDoc, query, where, orderBy,
  runTransaction, addDoc, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------- Generate permanent Student ID (requirement #7) ----------
// Uses a counter document + transaction so IDs never collide, even with
// concurrent admin sessions, and are never manually editable afterward.
export async function createStudent(name) {
  const counterRef = doc(db, "counters", "studentCounter");
  const newSequence = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const last = counterSnap.exists() ? counterSnap.data().lastSequence : 0;
    const next = last + 1;
    tx.set(counterRef, { lastSequence: next }, { merge: true });
    return next;
  });

  const studentId = `STU-${String(newSequence).padStart(4, "0")}`;
  const docRef = await addDoc(collection(db, "students"), {
    studentId,
    name,
    isActive: true,
    sequenceNumber: newSequence,
    createdAt: serverTimestamp()
  });
  return { docId: docRef.id, studentId, name };
}

// ---------- Set/replace a student's profile photo (feature #2) ----------
// Link-based, same no-Storage approach as question images: the admin pastes
// a direct image URL or a Google Drive share link (normalized by
// toDirectImageUrl() in image-utils.js before this is called). Storing just
// the URL avoids Firebase Storage entirely — no Blaze plan needed.
// Pass an empty/null url to remove the photo.
export async function updateStudentPhoto(docId, photoUrl) {
  return updateDoc(doc(db, "students", docId), { photoURL: photoUrl || null });
}

// ---------- Check for an in-progress attempt so the student can resume (#18) ----------
export async function findActiveAttempt(studentId) {
  const q = query(
    collection(db, "attempts"),
    where("studentId", "==", studentId),
    where("status", "==", "in-progress")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ---------- Session: which student is currently "logged in" (no auth, just selection) ----------
export async function getActiveStudents() {
  // ডাটাবেস থেকে আগে সবাইকে আনছি, তারপর জাভাস্ক্রিপ্ট দিয়ে ফিল্টার করছি (ইনডেক্স লাগবে না!)
  const q = query(collection(db, "students"), orderBy("sequenceNumber"));
  const snap = await getDocs(q);
  const allStudents = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  return allStudents.filter(s => s.isActive === true);
}

// ---------- Session: which student is currently "logged in" (no auth, just selection) ----------
// getActiveStudent() (singular) returns the ONE student currently
// selected/logged in, read synchronously from localStorage -- every
// student-facing page (dashboard/exam/profile/history/result/etc.) calls
// this directly (no await). It was missing entirely before, which broke
// every page that imported it.
export function getActiveStudent() {
  try {
    const raw = localStorage.getItem("activeStudent");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveStudent(student) {
  localStorage.setItem("activeStudent", JSON.stringify(student));
}

// ---------- Refresh the cached activeStudent from Firestore ----------
// getActiveStudent() only ever reads the localStorage snapshot taken once
// at student-selection time — it never updates itself. So when the admin
// later changes a student's name/photo, the student's browser keeps
// showing the OLD cached copy forever, even though Firestore has the new
// data. Student-facing pages call this once on load (see dashboard.html)
// to silently pull the latest doc and refresh the cache. Returns the fresh
// student object, or null on any failure (caller just keeps using the old
// cached data in that case — never breaks the page).
export async function refreshActiveStudent(docId) {
  if (!docId) return null;
  try {
    const snap = await getDoc(doc(db, "students", docId));
    if (!snap.exists()) return null;
    const fresh = { docId: snap.id, ...snap.data() };
    setActiveStudent(fresh);
    return fresh;
  } catch {
    return null;
  }
}

export function clearActiveStudent() {
  localStorage.removeItem("activeStudent");
}

