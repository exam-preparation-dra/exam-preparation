/* =========================================================
   FRIEND SYSTEM — students can send/accept friend requests with any other
   student (own class or a different one). Max 50 accepted friends per
   student. There's no student auth (same convention as attempts/results
   elsewhere in this app — matched by studentId, trusted by browser
   convention, not a real security boundary), and admin never reads this
   collection from any admin page, so who's-friends-with-who stays
   between students.

   Single collection `friendRequests`, doc shape:
     { fromStudentId, toStudentId, status: "pending"|"accepted", createdAt }
   A rejected request is just deleted rather than kept as "rejected" —
   nothing needs that history, and it lets the same two people try again
   later without a stale doc blocking it.
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const MAX_FRIENDS = 50;

// All accepted friendships involving this student (either direction),
// returned as the OTHER student's id for each.
export async function getMyFriendIds(studentId) {
  const [asFrom, asTo] = await Promise.all([
    getDocs(query(collection(db, "friendRequests"), where("fromStudentId", "==", studentId), where("status", "==", "accepted"))),
    getDocs(query(collection(db, "friendRequests"), where("toStudentId", "==", studentId), where("status", "==", "accepted")))
  ]);
  const ids = new Set();
  asFrom.docs.forEach(d => ids.add(d.data().toStudentId));
  asTo.docs.forEach(d => ids.add(d.data().fromStudentId));
  return [...ids];
}

// Incoming requests still awaiting THIS student's decision.
export async function getIncomingRequests(studentId) {
  const snap = await getDocs(query(collection(db, "friendRequests"), where("toStudentId", "==", studentId), where("status", "==", "pending")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Requests THIS student sent that are still awaiting the other side.
export async function getOutgoingRequests(studentId) {
  const snap = await getDocs(query(collection(db, "friendRequests"), where("fromStudentId", "==", studentId), where("status", "==", "pending")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function sendFriendRequest(fromStudentId, toStudentId) {
  if (fromStudentId === toStudentId) throw new Error("নিজেকে বন্ধুর অনুরোধ পাঠানো যায় না।");

  const [myFriends, outgoing, incoming] = await Promise.all([
    getMyFriendIds(fromStudentId),
    getOutgoingRequests(fromStudentId),
    getIncomingRequests(fromStudentId)
  ]);
  if (myFriends.length >= MAX_FRIENDS) throw new Error(`সর্বোচ্চ ${MAX_FRIENDS} জন বন্ধু রাখা যায় — আগে কাউকে সরাও।`);
  if (myFriends.includes(toStudentId)) throw new Error("সে ইতিমধ্যেই তোমার বন্ধু।");
  if (outgoing.some(r => r.toStudentId === toStudentId)) throw new Error("আগেই অনুরোধ পাঠানো হয়েছে — উত্তরের অপেক্ষায় আছে।");
  if (incoming.some(r => r.fromStudentId === toStudentId)) throw new Error("সে তোমাকে অনুরোধ পাঠিয়েছে — বরং সেটাই গ্রহণ করো।");

  await addDoc(collection(db, "friendRequests"), {
    fromStudentId, toStudentId, status: "pending", createdAt: serverTimestamp()
  });
}

export async function acceptFriendRequest(requestId, toStudentId) {
  // Re-check the recipient's own cap right before accepting — they could
  // have accepted several requests in quick succession.
  const myFriends = await getMyFriendIds(toStudentId);
  if (myFriends.length >= MAX_FRIENDS) throw new Error(`সর্বোচ্চ ${MAX_FRIENDS} জন বন্ধু রাখা যায় — আগে কাউকে সরাও।`);
  await updateDoc(doc(db, "friendRequests", requestId), { status: "accepted" });
}

export async function rejectFriendRequest(requestId) {
  await deleteDoc(doc(db, "friendRequests", requestId));
}

// Removing a friend just deletes the (now-accepted) request doc — frees a
// slot for both people.
export async function removeFriend(studentId, friendStudentId) {
  const [asFrom, asTo] = await Promise.all([
    getDocs(query(collection(db, "friendRequests"), where("fromStudentId", "==", studentId), where("toStudentId", "==", friendStudentId), where("status", "==", "accepted"))),
    getDocs(query(collection(db, "friendRequests"), where("fromStudentId", "==", friendStudentId), where("toStudentId", "==", studentId), where("status", "==", "accepted")))
  ]);
  const docs = [...asFrom.docs, ...asTo.docs];
  await Promise.all(docs.map(d => deleteDoc(doc(db, "friendRequests", d.id))));
}

/* =========================================================
   RIVAL — a student can mark exactly ONE friend as their "rival".
   Just a spotlight on top of data that already exists (friendship +
   head-to-head challenge record) — it doesn't change scoring, it just
   pins one friend to the top of the friends tab with their h2h record
   front and center.

   Collection `rivals`, one doc per student: { studentId, rivalId, createdAt }.
   NOTE: this is a NEW collection — add this to firestore.rules (same
   open pattern as friendRequests/examChallenges) for it to work:

     match /rivals/{id} {
       allow read, write: if true;
     }
   ========================================================= */

export async function getRival(studentId) {
  if (!studentId) return null;
  const snap = await getDocs(query(collection(db, "rivals"), where("studentId", "==", studentId)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// Set (or replace) my rival. Only friends can be set as a rival.
export async function setRival(studentId, rivalId) {
  if (!studentId || !rivalId) throw new Error("রাইভাল বেছে নেওয়া যায়নি।");
  if (studentId === rivalId) throw new Error("নিজেকে রাইভাল বানানো যাবে না।");

  const friendIds = await getMyFriendIds(studentId);
  if (!friendIds.includes(rivalId)) throw new Error("শুধু বন্ধুদেরই রাইভাল বানানো যায়।");

  const existing = await getRival(studentId);
  if (existing) {
    await updateDoc(doc(db, "rivals", existing.id), { rivalId, createdAt: serverTimestamp() });
  } else {
    await addDoc(collection(db, "rivals"), { studentId, rivalId, createdAt: serverTimestamp() });
  }
}

export async function clearRival(studentId) {
  const existing = await getRival(studentId);
  if (existing) await deleteDoc(doc(db, "rivals", existing.id));
}
