/* Physics Lover 2.0 — Final Admin Improvement Workflow
 * One clear flow: review -> create draft -> publish -> assign.
 */
import { db, auth } from "/js/firebase/firebase-config.js";
import {
  doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  createImprovementTestFromRequest
} from "./improvement-admin-workflow.js";

const ADMIN = "physicslover2312@gmail.com";

function assertAdmin() {
  if ((auth.currentUser?.email || "").toLowerCase() !== ADMIN) {
    throw new Error("Admin access required.");
  }
}

export async function reviewRequest(requestId, note = "") {
  assertAdmin();
  await updateDoc(doc(db, "improvementRequests", requestId), {
    status: "reviewed",
    adminNote: note,
    reviewedBy: auth.currentUser.uid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function createDraftFromRequest(requestId, options = {}) {
  assertAdmin();
  return createImprovementTestFromRequest(requestId, options);
}

export async function publishTest(testId) {
  assertAdmin();
  const ref = doc(db, "improvementTests", testId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Improvement test পাওয়া যায়নি।");
  await updateDoc(ref, {
    status: "published",
    published: true,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function assignPublishedTest(testId, studentId) {
  assertAdmin();
  const ref = doc(db, "improvementTests", testId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Improvement test পাওয়া যায়নি।");

  const test = snap.data();
  if (test.published !== true || test.status !== "published") {
    throw new Error("আগে test publish করতে হবে।");
  }

  const studentIds = Array.isArray(test.studentIds) ? test.studentIds : [];
  if (!studentIds.includes(studentId)) studentIds.push(studentId);

  await updateDoc(ref, {
    studentIds,
    updatedAt: serverTimestamp()
  });

  if (test.requestId) {
    await updateDoc(doc(db, "improvementRequests", test.requestId), {
      status: "assigned",
      assignedTestId: testId,
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}
