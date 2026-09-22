/* =========================================================
   STUDENT PROFILE — IMPROVEMENT JOURNEY INTEGRATION
   ---------------------------------------------------------
   This is the bridge between the existing profile-final.html
   and the Improvement Journey utilities.

   It does not replace the profile page, theme system, exam
   analytics, rank, badges, or existing Firebase data flow.

   It:
   - reads the existing active student
   - loads Improvement Journey data from improvement-utils.js
   - inserts the Bengali Improvement Journey into the profile
   - keeps the existing Day/Night theme untouched
   - survives profile re-renders caused by student refresh
   - emits events for the future Improvement Test page
   - never creates fake student performance data

   Required files:
   - ../js/utils/student-utils.js
   - ../js/utils/improvement-profile-utils.js
   - ../js/utils/improvement-utils.js

   No emoji is used.
   ========================================================= */

import { getActiveStudent } from "./student-utils.js";

import {
  loadStudentImprovementJourney,
  renderImprovementJourney,
  renderImprovementHistory,
  injectImprovementJourneyStyles
} from "./improvement-profile-utils.js";

const INTEGRATION_STYLE_ID = "improvement-journey-integration-style";
const JOURNEY_ID = "studentImprovementJourney";
const HISTORY_ID = "studentImprovementHistory";

let lastStudentId = null;
let renderInProgress = false;

function getStudentId(student) {
  return (
    student?.studentId ||
    student?.id ||
    student?.docId ||
    null
  );
}

function ensureIntegrationStyles() {
  if (document.getElementById(INTEGRATION_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = INTEGRATION_STYLE_ID;
  style.textContent = `
    .improvement-profile-integration {
      margin-top: 0;
      margin-bottom: 16px;
    }

    .improvement-history-integration {
      margin-top: 0;
      margin-bottom: 16px;
    }

    .improvement-profile-loading {
      padding: 22px;
      text-align: center;
      color: var(--text-muted);
      font-size: .78rem;
      font-weight: 750;
      border: 1px solid var(--surface-border);
      border-radius: 20px;
      background: var(--surface);
    }

    .improvement-profile-error {
      padding: 18px;
      color: var(--text-muted);
      font-size: .78rem;
      font-weight: 750;
      border: 1px solid var(--surface-border);
      border-radius: 20px;
      background: var(--surface);
    }

    @media (max-width: 640px) {
      .improvement-profile-integration,
      .improvement-history-integration {
        margin-bottom: 12px;
      }
    }
  `;

  document.head.appendChild(style);
}

function createContainer(id, className) {
  const existing = document.getElementById(id);
  if (existing) return existing;

  const el = document.createElement("div");
  el.id = id;
  el.className = className;
  return el;
}

function findOverviewTab() {
  return (
    document.getElementById("tab-overview") ||
    document.querySelector(".tab-content.active") ||
    document.querySelector(".profile-premium")
  );
}

function insertContainers() {
  const overview = findOverviewTab();
  if (!overview) return null;

  let journey = document.getElementById(JOURNEY_ID);
  let history = document.getElementById(HISTORY_ID);

  if (!journey) {
    journey = createContainer(
      JOURNEY_ID,
      "improvement-profile-integration"
    );
  }

  if (!history) {
    history = createContainer(
      HISTORY_ID,
      "improvement-history-integration"
    );
  }

  /*
   * Put Improvement Journey near the top of the overview.
   * Do not move or rewrite any existing profile section.
   */
  const firstProfileSection =
    overview.querySelector(".profile-section, .glass-card");

  if (!journey.isConnected) {
    if (firstProfileSection) {
      overview.insertBefore(journey, firstProfileSection);
    } else {
      overview.prepend(journey);
    }
  }

  /*
   * History stays immediately after the journey.
   * If an existing profile section is already there, it is not touched.
   */
  if (!history.isConnected) {
    if (journey.nextSibling) {
      overview.insertBefore(history, journey.nextSibling);
    } else {
      overview.appendChild(history);
    }
  }

  return { journey, history };
}

function emitPracticeEvent(testId, request) {
  window.dispatchEvent(
    new CustomEvent("improvement:practice", {
      detail: {
        testId: testId || null,
        requestId: request?.id || null,
        request
      }
    })
  );
}

function emitDetailsEvent(request) {
  window.dispatchEvent(
    new CustomEvent("improvement:details", {
      detail: {
        requestId: request?.id || null,
        request
      }
    })
  );
}

function attachJourneyActions(container) {
  if (!container) return;

  container.querySelectorAll("[data-improvement-practice]").forEach((button) => {
    if (button.dataset.integrationBound === "1") return;

    button.dataset.integrationBound = "1";

    button.addEventListener("click", () => {
      const testId = button.dataset.improvementPractice || null;

      /*
       * The actual Improvement Test page will be connected later.
       * For now we expose a clean event instead of sending the student
       * to a page that does not exist yet.
       */
      emitPracticeEvent(testId, window.__activeImprovementRequest || null);

      if (typeof window.showToast === "function") {
        window.showToast(
          "এই অনুশীলনটি প্রস্তুত আছে। অনুশীলন পেজ সংযুক্ত হলে এখান থেকেই শুরু হবে।",
          "info"
        );
      }
    });
  });

  container.querySelectorAll("[data-improvement-details]").forEach((button) => {
    if (button.dataset.integrationBound === "1") return;

    button.dataset.integrationBound = "1";

    button.addEventListener("click", () => {
      emitDetailsEvent(window.__activeImprovementRequest || null);
    });
  });
}

async function renderJourney() {
  if (renderInProgress) return;

  const student = getActiveStudent();
  const studentId = getStudentId(student);

  if (!studentId) return;

  const containers = insertContainers();
  if (!containers) return;

  renderInProgress = true;

  containers.journey.innerHTML = `
    <div class="improvement-profile-loading">
      তোমার উন্নতির তথ্য বিশ্লেষণ করা হচ্ছে...
    </div>
  `;

  containers.history.innerHTML = "";

  try {
    const journey = await loadStudentImprovementJourney(studentId);

    window.__studentImprovementJourney = journey;
    window.__activeImprovementRequest = journey?.active || null;

    renderImprovementJourney(containers.journey, journey, {
      onPractice: (testId, request) => {
        window.__activeImprovementRequest = request || journey?.active || null;
        emitPracticeEvent(testId, window.__activeImprovementRequest);

        if (typeof window.showToast === "function") {
          window.showToast(
            "অনুশীলন শুরু করার সংযোগ প্রস্তুত হয়েছে।",
            "info"
          );
        }
      },

      onDetails: (request) => {
        window.__activeImprovementRequest =
          request || journey?.active || null;

        emitDetailsEvent(window.__activeImprovementRequest);
      }
    });

    renderImprovementHistory(containers.history, journey);

    attachJourneyActions(containers.journey);
    attachJourneyActions(containers.history);

    lastStudentId = studentId;
  } catch (error) {
    console.warn("Improvement Journey integration skipped:", error);

    containers.journey.innerHTML = `
      <div class="improvement-profile-error">
        এই মুহূর্তে উন্নতির তথ্য লোড করা যাচ্ছে না। পরে আবার চেষ্টা করো।
      </div>
    `;

    containers.history.innerHTML = "";
  } finally {
    renderInProgress = false;
  }
}

function scheduleRender() {
  window.setTimeout(() => {
    const student = getActiveStudent();
    const studentId = getStudentId(student);

    if (!studentId) return;

    /*
     * A profile refresh replaces #shell.innerHTML. Therefore the containers
     * may disappear even when the student ID has not changed.
     */
    if (
      studentId !== lastStudentId ||
      !document.getElementById(JOURNEY_ID)
    ) {
      renderJourney();
    }
  }, 0);
}

function startProfileObserver() {
  const shell = document.getElementById("shell");

  if (!shell) {
    scheduleRender();
    return;
  }

  const observer = new MutationObserver(() => {
    scheduleRender();
  });

  observer.observe(shell, {
    childList: true,
    subtree: true
  });

  /*
   * Keep the observer reference available for debugging without making it
   * part of the profile's existing global API.
   */
  window.__improvementProfileObserver = observer;

  scheduleRender();
}

export function initImprovementProfileIntegration() {
  ensureIntegrationStyles();

  /*
   * injectImprovementJourneyStyles() belongs to the UI utility and is
   * responsible for the actual Journey card styling.
   */
  injectImprovementJourneyStyles();

  startProfileObserver();
}

/*
 * Auto-start when this module is loaded.
 * This lets profile-final.html add one script tag and nothing else.
 */
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initImprovementProfileIntegration,
    { once: true }
  );
} else {
  initImprovementProfileIntegration();
}
