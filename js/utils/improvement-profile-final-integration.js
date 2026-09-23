/* Physics Lover 2.0 — Final Profile Integration
 * Correct relative imports for a file stored in /js/utils.
 */
import { getActiveStudent } from "./student-utils.js";
import {
  loadStudentImprovementJourney,
  renderImprovementJourney,
  renderImprovementHistory,
  injectImprovementJourneyStyles,
  getImprovementExplanation
} from "./improvement-profile-utils.js";

function ensureContainers() {
  let section = document.querySelector("#improvementSection");
  if (!section) return null;
  if (!section.querySelector("#studentImprovementJourney")) {
    section.innerHTML = `
      <div id="studentImprovementJourney"></div>
      <div id="studentImprovementHistory" style="margin-top:14px"></div>
    `;
  }
  return section;
}

async function refresh() {
  const student = getActiveStudent();
  if (!student?.studentId) return;

  const section = ensureContainers();
  if (!section) return;
  injectImprovementJourneyStyles();

  const journey = await loadStudentImprovementJourney(student.studentId);

  const journeyEl = document.querySelector("#studentImprovementJourney");
  if (journeyEl) {
    renderImprovementJourney(journeyEl, journey, {
      // renderImprovementJourney calls onPractice(testIdString, activeRequestObject) —
      // the first argument is already the test id, not a request object.
      onPractice: (testId, request) => {
        const resolvedTestId = testId || request?.improvementTestId || request?.assignedTestId;
        if (resolvedTestId) location.href = `./exam.html?improvementTestId=${encodeURIComponent(resolvedTestId)}`;
      },
      onDetails: (_id, request) => {
        window.alert(getImprovementExplanation(request));
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
    refresh().catch(error => console.warn("Improvement profile refresh failed:", error));
  });

  let lastSection = null;
  const observer = new MutationObserver(() => {
    const section = document.querySelector("#improvementSection");
    if (section && section !== lastSection) {
      lastSection = section;
      refresh().catch(error => console.warn("Improvement profile load failed:", error));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  refresh().catch(error => console.warn("Improvement profile load failed:", error));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFinalImprovementProfileIntegration, { once: true });
} else {
  initFinalImprovementProfileIntegration();
}
