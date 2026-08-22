/* =========================================================
   STUDENT UTILITIES
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, getDocs, getDoc, query, where, orderBy,
  runTransaction, addDoc, serverTimestamp
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

export function clearActiveStudent() {
  localStorage.removeItem("activeStudent");
}

