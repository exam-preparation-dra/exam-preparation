/* =========================================================
   STUDENT DATA ERASURE (admin only)
   Deletes a student's own records from every collection that stores them,
   so "delete my data" requests (see privacy.html) are really honoured.
   Best-effort: every step is independent; the returned report lists what was
   removed and which steps failed (e.g. blocked by security rules).

   NOT removable from the browser: the hidden Firebase Authentication login
   (stu-XXXX@students.exam-prep.local). The admin must delete it in the
   Firebase console (Authentication > Users). Shared battle records involving
   other students (battleMatches) are left in place.
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, getDocs, deleteDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// [collection, field] pairs: delete every doc where field == studentId
const BY_FIELD = [
  ["attempts", "studentId"], ["results", "studentId"], ["improvementAttempts", "studentId"],
  ["friendRequests", "fromStudentId"], ["friendRequests", "toStudentId"],
  ["rivals", "studentId"], ["rivals", "rivalId"],
  ["examChallenges", "fromStudentId"], ["examChallenges", "toStudentId"],
  ["friendCheers", "fromStudentId"], ["friendCheers", "toStudentId"],
  ["friendActivity", "studentId"],
  ["storePurchases", "studentId"], ["storeCardUsage", "studentId"],
  ["battleRoomCards", "studentId"], ["examCardClaims", "studentId"],
  ["applicationStatus", "studentId"],
];
// collections whose document id IS the student id
const BY_ID = ["storeInventory", "studentPrivacy", "studentAuthState", "studentNotifState", "setupRequests", "setupCodes", "chatMeta"];

export async function eraseStudentData(studentId, studentDocId) {
  const report = { removed: 0, failed: [] };
  const sid = String(studentId || "").trim();
  if (!sid) throw new Error("studentId missing");

  for (const [col, field] of BY_FIELD) {
    try {
      const snap = await getDocs(query(collection(db, col), where(field, "==", sid)));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      report.removed += snap.size;
    } catch (e) { report.failed.push(`${col}.${field}`); }
  }
  for (const col of BY_ID) {
    try { await deleteDoc(doc(db, col, sid)); } catch (e) { report.failed.push(col); }
  }
  // chat rooms the student belongs to (leave / close); needs rules that allow admin
  try {
    const rooms = await getDocs(query(collection(db, "chatRooms"), where("members", "array-contains", sid)));
    for (const r of rooms.docs) {
      const members = r.data().members || [];
      try {
        if (members.length <= 1) {
          const msgs = await getDocs(collection(r.ref, "messages"));
          await Promise.all(msgs.docs.map(m => deleteDoc(m.ref)));
          await deleteDoc(r.ref);
        }
      } catch (e) { report.failed.push("chatRooms"); }
    }
  } catch (e) { report.failed.push("chatRooms"); }

  // the student record itself goes last
  if (studentDocId) await deleteDoc(doc(db, "students", studentDocId));
  report.removed += 1;
  return report;
}
