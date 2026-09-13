/* =========================================================
   CHALLENGE SYSTEM UTILITIES (1v1 Friend Battles)
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// যে চ্যালেঞ্জগুলো এই স্টুডেন্টকে করা হয়েছে (Pending)
export async function getIncomingChallenges(studentId) {
  const snap = await getDocs(query(collection(db, "examChallenges"), where("toStudentId", "==", studentId), where("status", "==", "pending")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// যে চ্যালেঞ্জগুলো এই স্টুডেন্ট অন্যদের পাঠিয়েছে
export async function getOutgoingChallenges(studentId) {
  const snap = await getDocs(query(collection(db, "examChallenges"), where("fromStudentId", "==", studentId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// নতুন চ্যালেঞ্জ পাঠানো
export async function sendChallenge(fromStudentId, toStudentId, examId, examName) {
  await addDoc(collection(db, "examChallenges"), {
    fromStudentId, toStudentId, examId, examName,
    status: "pending",
    createdAt: serverTimestamp()
  });
}

// চ্যালেঞ্জ গ্রহণ করা
export async function acceptChallenge(challengeId) {
  await updateDoc(doc(db, "examChallenges", challengeId), { status: "accepted" });
}

// চ্যালেঞ্জ বাতিল করা
export async function rejectChallenge(challengeId) {
  await deleteDoc(doc(db, "examChallenges", challengeId));
}
