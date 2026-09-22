/* Physics Lover 2.0
 * Improvement Profile Refresh
 * Refreshes the existing profile Improvement Journey after a completed practice.
 * Does not replace the existing theme, profile shell, XP system, or navigation.
 */

import { getActiveStudent } from "./student-utils.js";
import {
  loadStudentImprovementJourney,
  renderImprovementJourney,
  renderImprovementHistory
} from "./improvement-profile-utils.js";

let refreshTimer = null;

export async function refreshImprovementProfile({
  student = null,
  requestId = null,
  testId = null
} = {}) {
  const activeStudent = student || await getActiveStudent();

  if (!activeStudent) {
    return { refreshed: false, reason: "student_not_found" };
  }

  const journey = await loadStudentImprovementJourney(activeStudent.studentId);

  const journeyRoot = document.querySelector("#studentImprovementJourney");
  if (journeyRoot) {
    renderImprovementJourney(journeyRoot, journey);
  }

  const historyRoot = document.querySelector("#studentImprovementHistory");
  if (historyRoot) {
    renderImprovementHistory(historyRoot, journey);
  }

  window.dispatchEvent(
    new CustomEvent("improvement:profile-refreshed", {
      detail: {
        studentId: activeStudent.studentId,
        requestId,
        testId
      }
    })
  );

  return {
    refreshed: true,
    studentId: activeStudent.studentId
  };
}

export function initImprovementProfileRefresh() {
  if (window.__improvementProfileRefreshReady) return;

  window.__improvementProfileRefreshReady = true;

  window.addEventListener("improvement:completed", (event) => {
    const detail = event.detail || {};

    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshImprovementProfile({
        requestId: detail.requestId || null,
        testId: detail.testId || null
      }).catch((error) => {
        console.error("Improvement profile refresh failed:", error);
      });
    }, 150);
  });
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initImprovementProfileRefresh,
    { once: true }
  );
} else {
  initImprovementProfileRefresh();
}
