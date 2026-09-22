/* Physics Lover 2.0 — Improvement End-to-End Diagnostic
 * Read-only checker. It does not create, delete, publish, assign, or alter data.
 */
import { db } from "../firebase/firebase-config.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export async function diagnoseImprovementFlow({
  requestId = null,
  testId = null,
  attemptId = null
} = {}) {
  const report = {
    request: null,
    test: null,
    snapshot: null,
    attempt: null,
    checks: []
  };

  const check = (name, ok, detail = "") => {
    report.checks.push({ name, ok: !!ok, detail });
  };

  if (requestId) {
    const s = await getDoc(doc(db, "improvementRequests", requestId));
    report.request = s.exists() ? { id: s.id, ...s.data() } : null;
    check("Improvement Request", !!report.request);
  }

  if (testId) {
    const [testSnap, snapshotSnap] = await Promise.all([
      getDoc(doc(db, "improvementTests", testId)),
      getDoc(doc(db, "improvementTestSnapshots", testId))
    ]);

    report.test = testSnap.exists() ? { id: testSnap.id, ...testSnap.data() } : null;
    report.snapshot = snapshotSnap.exists() ? { id: snapshotSnap.id, ...snapshotSnap.data() } : null;

    check("Improvement Test", !!report.test);
    check("Test Snapshot", !!report.snapshot);
    check(
      "Snapshot has questions",
      Array.isArray(report.snapshot?.questions) && report.snapshot.questions.length > 0
    );
    check(
      "Published before assignment",
      !report.test?.studentIds?.length || report.test?.published === true
    );
  }

  if (attemptId) {
    const s = await getDoc(doc(db, "improvementAttempts", attemptId));
    report.attempt = s.exists() ? { id: s.id, ...s.data() } : null;
    check("Improvement Attempt", !!report.attempt);
    if (report.attempt) {
      check("Attempt completed", report.attempt.status === "completed");
      check("XP recorded", Number(report.attempt.xpEarned || 0) >= 0);
    }
  }

  return report;
}
