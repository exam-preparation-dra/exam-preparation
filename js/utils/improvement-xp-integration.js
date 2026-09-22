/* Physics Lover 2.0
 * Improvement XP Integration
 * Keeps Improvement Practice XP separate from official exam XP
 * while providing one safe profile-level XP total.
 */

import { db } from "/js/firebase/firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getImprovementEarnedXP(studentId) {
  if (!studentId) return 0;

  const q = query(
    collection(db, "improvementAttempts"),
    where("studentId", "==", studentId),
    where("status", "==", "completed")
  );

  const snap = await getDocs(q);

  let total = 0;

  snap.forEach((item) => {
    const data = item.data();
    total += Math.max(0, num(data.xpEarned));
  });

  return total;
}

export async function getProfileXPBreakdown(student) {
  if (!student) {
    return {
      officialXP: 0,
      improvementXP: 0,
      totalXP: 0
    };
  }

  /*
   * Existing student XP remains the source of truth for official
   * exams and other existing XP activities.
   */
  const officialXP = Math.max(
    0,
    num(
      student.xp ??
      student.totalXP ??
      student.totalXp ??
      student.points
    )
  );

  const improvementXP = await getImprovementEarnedXP(
    student.studentId
  );

  return {
    officialXP,
    improvementXP,
    totalXP: officialXP + improvementXP
  };
}

export async function refreshProfileXP({
  student,
  totalXPElement = "#profileTotalXP",
  improvementXPElement = "#profileImprovementXP"
} = {}) {
  if (!student) return null;

  const breakdown = await getProfileXPBreakdown(student);

  const totalEl = document.querySelector(totalXPElement);
  if (totalEl) {
    totalEl.textContent = String(breakdown.totalXP);
  }

  const improvementEl = document.querySelector(improvementXPElement);
  if (improvementEl) {
    improvementEl.textContent = String(breakdown.improvementXP);
  }

  window.dispatchEvent(
    new CustomEvent("improvement:xp-refreshed", {
      detail: breakdown
    })
  );

  return breakdown;
}

export function initImprovementXPIntegration() {
  if (window.__improvementXPIntegrationReady) return;

  window.__improvementXPIntegrationReady = true;

  window.addEventListener("improvement:completed", async (event) => {
    try {
      const { getActiveStudent } = await import(
        "./student-utils.js"
      );

      const student = await getActiveStudent();

      if (student) {
        await refreshProfileXP({ student });
      }
    } catch (error) {
      console.error("Improvement XP refresh failed:", error);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initImprovementXPIntegration,
    { once: true }
  );
} else {
  initImprovementXPIntegration();
}
