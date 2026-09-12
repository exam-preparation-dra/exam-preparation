/* =========================================================
   STUDENT JOIN REQUESTS — a prospective student submits their name
   (English letters are fine) + class from the public join page. It sits
   as "pending" until the admin reviews it (converts/fixes the Bengali
   spelling, then approves or rejects) in admin/students.html. Approving
   creates a real student via createStudent() in student-utils.js —
   this file only manages the request queue itself.
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, addDoc, getDocs, query, where, doc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export async function submitStudentRequest(rawName, className) {
  const trimmedName = (rawName || "").trim();
  const trimmedClass = (className || "").trim();
  if (!trimmedName) throw new Error("নাম দিতে হবে।");
  if (!trimmedClass) throw new Error("ক্লাস দিতে হবে।");
  await addDoc(collection(db, "studentRequests"), {
    rawName: trimmedName,
    className: trimmedClass,
    status: "pending",
    createdAt: serverTimestamp()
  });
}

export async function getPendingRequests() {
  const snap = await getDocs(query(collection(db, "studentRequests"), where("status", "==", "pending")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Both "approved" and "rejected" end the same way — the request is done
// with, so it's simply removed from the pending queue rather than kept
// around as a permanent status history.
export async function deleteStudentRequest(requestId) {
  await deleteDoc(doc(db, "studentRequests", requestId));
}
