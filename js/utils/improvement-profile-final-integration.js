/* Physics Lover 2.0 — Final Profile Integration
 * Correct relative imports for a file stored in /js/utils.
 */
import { getActiveStudent } from "./student-utils.js";
import {
  loadStudentImprovementJourney,
  renderImprovementJourney,
  renderImprovementHistory,
  injectImprovementJourneyStyles
} from "./improvement-profile-utils.js";

async function refresh() {
  const student = await getActiveStudent();
  if (!student) return;

  injectImprovementJourneyStyles();

  const journey = await loadStudentImprovementJourney(student.studentId);

  const journeyEl = document.querySelector("#studentImprovementJourney");
  if (journeyEl) {
    renderImprovementJourney(journeyEl, journey, {
      onPractice: (request) => {
        const testId = request?.improvementTestId || request?.assignedTestId;
        if (testId) location.href = `/improvement-test.html?testId=${encodeURIComponent(testId)}`;
      },
      onDetails: (request) => {
        window.dispatchEvent(new CustomEvent("improvement:details", {
          detail: { request }
        }));
      }
    });
  }

  const historyEl = document.querySelector("#studentImprovementHistory");
  if (historyEl) {
    renderImprovementHistory(historyEl, journey);
  }
}

export function initFinalImprovementProfileIntegration() {
  if (window.__finalImprovementProfileReady) return;
  window.__finalImprovementProfileReady = true;

  window.addEventListener("improvement:completed", () => {
    refresh().catch(console.error);
  });

  refresh().catch(console.error);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFinalImprovementProfileIntegration, { once: true });
} else {
  initFinalImprovementProfileIntegration();
}
