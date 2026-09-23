/* =========================================================
   STUDENT IMPROVEMENT JOURNEY UI HELPERS
   ---------------------------------------------------------
   Connects the Student Profile to the Improvement Engine.

   This file intentionally does not create fake performance data.
   It only renders data supplied by the existing Improvement Engine
   and the approved-result system.

   No emoji is used.
   ========================================================= */

import {
  getImprovementRequestsForStudent,
  IMPROVEMENT_STATUS,
  IMPROVEMENT_PRIORITY
} from "./improvement-utils.js";

const NUM = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (n, min = 0, max = 100) =>
  Math.min(max, Math.max(min, NUM(n)));

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

function priorityLabel(priority) {
  return {
    [IMPROVEMENT_PRIORITY.CRITICAL]: "জরুরি",
    [IMPROVEMENT_PRIORITY.HIGH]: "উচ্চ অগ্রাধিকার",
    [IMPROVEMENT_PRIORITY.MEDIUM]: "মনোযোগ প্রয়োজন",
    [IMPROVEMENT_PRIORITY.LOW]: "অনুশীলন প্রয়োজন"
  }[priority] || "উন্নতির প্রয়োজন";
}

function statusLabel(status) {
  return {
    [IMPROVEMENT_STATUS.DETECTED]: "বিশ্লেষণ সম্পন্ন",
    [IMPROVEMENT_STATUS.REVIEWED]: "অ্যাডমিন পর্যালোচনা করেছেন",
    [IMPROVEMENT_STATUS.TEST_REQUIRED]: "অনুশীলন প্রয়োজন",
    [IMPROVEMENT_STATUS.TEST_CREATED]: "অনুশীলন প্রস্তুত",
    [IMPROVEMENT_STATUS.ASSIGNED]: "অনুশীলন দেওয়া হয়েছে",
    [IMPROVEMENT_STATUS.COMPLETED]: "অনুশীলন সম্পন্ন",
    [IMPROVEMENT_STATUS.RESOLVED]: "উন্নতি সম্পন্ন",
    [IMPROVEMENT_STATUS.DISMISSED]: "বন্ধ করা হয়েছে"
  }[status] || "পর্যবেক্ষণে";
}

function getTarget(request) {
  const current = clamp(request?.currentAccuracy);
  const target = clamp(request?.targetAccuracy || 65);
  return {
    current,
    target: Math.max(current, target)
  };
}

function progressFor(request) {
  const { current, target } = getTarget(request);

  if (target <= 0) return 100;

  const start = Math.min(current, target);
  const progress = (current / target) * 100;

  return clamp(progress);
}

function sortRequests(requests) {
  const priorityOrder = {
    [IMPROVEMENT_PRIORITY.CRITICAL]: 4,
    [IMPROVEMENT_PRIORITY.HIGH]: 3,
    [IMPROVEMENT_PRIORITY.MEDIUM]: 2,
    [IMPROVEMENT_PRIORITY.LOW]: 1
  };

  return [...requests].sort((a, b) => {
    const p =
      (priorityOrder[b.priority] || 0) -
      (priorityOrder[a.priority] || 0);

    if (p !== 0) return p;

    return (
      NUM(a.currentAccuracy, 101) -
      NUM(b.currentAccuracy, 101)
    );
  });
}

/* ---------------------------------------------------------
   LOAD
   --------------------------------------------------------- */

export async function loadStudentImprovementJourney(studentId) {
  if (!studentId) {
    return {
      requests: [],
      active: null,
      completed: [],
      availableTests: []
    };
  }

  const requests = await getImprovementRequestsForStudent(studentId);

  const sorted = sortRequests(Array.isArray(requests) ? requests : []);

  const active = sorted.find((request) => {
    return ![
      IMPROVEMENT_STATUS.RESOLVED,
      IMPROVEMENT_STATUS.DISMISSED
    ].includes(request.status);
  }) || null;

  const completed = sorted.filter((request) =>
    [
      IMPROVEMENT_STATUS.COMPLETED,
      IMPROVEMENT_STATUS.RESOLVED
    ].includes(request.status)
  );

  const availableTests = sorted.filter((request) =>
    [
      IMPROVEMENT_STATUS.TEST_CREATED,
      IMPROVEMENT_STATUS.ASSIGNED
    ].includes(request.status)
  );

  return {
    requests: sorted,
    active,
    completed,
    availableTests
  };
}

/* ---------------------------------------------------------
   MAIN CARD
   --------------------------------------------------------- */

export function renderImprovementJourney(
  container,
  journey,
  options = {}
) {
  if (!container) return;

  const {
    onPractice = null,
    onDetails = null
  } = options;

  const active = journey?.active || null;

  if (!active) {
    container.innerHTML = `
      <section class="improvement-journey empty">
        <div class="improvement-journey-header">
          <div>
            <p class="improvement-eyebrow">MY IMPROVEMENT JOURNEY</p>
            <h2>এখন কোনো সক্রিয় উন্নতি মিশন নেই</h2>
            <p>
              পর্যাপ্ত approved exam data পাওয়া গেলে তোমার জন্য
              প্রয়োজনীয় improvement লক্ষ্য এখানে automatically তৈরি হবে।
            </p>
          </div>
        </div>
        <div class="improvement-empty-state">
          <strong>তোমার বর্তমান অবস্থাই আগে দেখা হবে</strong>
          <span>
            একটি মাত্র ভুলের ভিত্তিতে কোনো chapter বা topic-কে দুর্বল
            ঘোষণা করা হবে না।
          </span>
        </div>
      </section>
    `;
    return;
  }

  const { current, target } = getTarget(active);
  const progress = progressFor(active);
  const wrongCount = Array.isArray(active.wrongQuestionIds)
    ? active.wrongQuestionIds.length
    : NUM(active.wrongQuestionCount);

  const canPractice = [
    IMPROVEMENT_STATUS.TEST_CREATED,
    IMPROVEMENT_STATUS.ASSIGNED
  ].includes(active.status);

  container.innerHTML = `
    <section class="improvement-journey">
      <div class="improvement-journey-header">
        <div>
          <p class="improvement-eyebrow">MY IMPROVEMENT JOURNEY</p>
          <h2>তোমার পরবর্তী লক্ষ্য</h2>
          <p>
            তোমার approved performance data থেকে এই লক্ষ্যটি তৈরি হয়েছে।
          </p>
        </div>

        <span class="improvement-priority priority-${esc(active.priority || "medium")}">
          ${esc(priorityLabel(active.priority))}
        </span>
      </div>

      <div class="improvement-mission">
        <div class="improvement-mission-top">
          <div>
            <span class="improvement-label">উন্নতির ক্ষেত্র</span>
            <h3>
              ${esc(
                active.topicName ||
                active.chapterName ||
                active.subjectName ||
                "তোমার পড়াশোনার একটি নির্দিষ্ট অংশ"
              )}
            </h3>

            <p class="improvement-path">
              ${esc(active.subjectName || "")}
              ${active.chapterName ? ` / ${esc(active.chapterName)}` : ""}
              ${active.topicName ? ` / ${esc(active.topicName)}` : ""}
            </p>
          </div>

          <div class="improvement-score">
            <strong>${Math.round(current)}%</strong>
            <span>বর্তমান</span>
          </div>
        </div>

        <div class="improvement-progress">
          <div class="improvement-progress-track">
            <div
              class="improvement-progress-fill"
              style="width:${progress}%"
            ></div>
          </div>

          <div class="improvement-progress-meta">
            <span>বর্তমান ${Math.round(current)}%</span>
            <span>লক্ষ্য ${Math.round(target)}%</span>
          </div>
        </div>

        <div class="improvement-facts">
          <div>
            <strong>${wrongCount}</strong>
            <span>ভুল প্রশ্ন</span>
          </div>

          <div>
            <strong>${esc(statusLabel(active.status))}</strong>
            <span>বর্তমান অবস্থা</span>
          </div>

          <div>
            <strong>+${Math.max(0, Math.round(target - current))}%</strong>
            <span>লক্ষ্য পর্যন্ত</span>
          </div>
        </div>

        <div class="improvement-actions">
          ${
            canPractice
              ? `
                <button
                  type="button"
                  class="improvement-primary-btn"
                  data-improvement-practice="${esc(active.improvementTestId || active.id)}"
                >
                  অনুশীলন শুরু করো
                </button>
              `
              : ""
          }

          <button
            type="button"
            class="improvement-secondary-btn"
            data-improvement-details="${esc(active.id)}"
          >
            কেন এই লক্ষ্য
          </button>
        </div>
      </div>
    </section>
  `;

  container.querySelectorAll("[data-improvement-practice]").forEach((button) => {
    button.addEventListener("click", () => {
      if (typeof onPractice === "function") {
        onPractice(button.dataset.improvementPractice, active);
      }
    });
  });

  container.querySelectorAll("[data-improvement-details]").forEach((button) => {
    button.addEventListener("click", () => {
      if (typeof onDetails === "function") {
        onDetails(button.dataset.improvementDetails, active);
      }
    });
  });
}

/* ---------------------------------------------------------
   COMPLETED HISTORY
   --------------------------------------------------------- */

export function renderImprovementHistory(container, journey) {
  if (!container) return;

  const completed = journey?.completed || [];

  if (!completed.length) {
    container.innerHTML = `
      <section class="improvement-history">
        <div class="improvement-history-header">
          <h3>সম্পন্ন উন্নতি</h3>
          <span>এখনও কোনো mission সম্পন্ন হয়নি</span>
        </div>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="improvement-history">
      <div class="improvement-history-header">
        <div>
          <p class="improvement-eyebrow">HISTORY</p>
          <h3>সম্পন্ন উন্নতি</h3>
        </div>
        <span>${completed.length}টি</span>
      </div>

      <div class="improvement-history-list">
        ${completed.slice(0, 8).map((item) => {
          // updateImprovementRequestAfterCompletion() (improvement-test-completion.js)
          // writes lastAccuracy / lastImprovementPercent / targetReached on
          // completion -- "improvementAccuracy" was never a real field, which
          // is why this always fell back to showing "pending" before.
          const before = NUM(item.currentAccuracy);
          const hasResult = item.lastAccuracy !== undefined && item.lastAccuracy !== null;
          const after = hasResult ? NUM(item.lastAccuracy) : before;
          const delta = hasResult ? NUM(item.lastImprovementPercent ?? (after - before)) : 0;

          return `
            <article class="improvement-history-item">
              <div>
                <strong>
                  ${esc(
                    item.topicName ||
                    item.chapterName ||
                    item.subjectName ||
                    "উন্নতির লক্ষ্য"
                  )}
                </strong>
                <span>
                  ${esc(item.subjectName || "")}
                  ${item.chapterName ? ` / ${esc(item.chapterName)}` : ""}
                  ${hasResult ? ` · আগে ${Math.round(before)}%` : ""}
                </span>
              </div>

              <div class="improvement-history-score">
                <strong>${hasResult ? `${Math.round(after)}%` : "—"}</strong>
                <span>
                  ${
                    !hasResult
                      ? "উন্নতির data অপেক্ষমাণ"
                      : delta > 0
                        ? `+${Math.round(delta)}% ${item.targetReached ? "· লক্ষ্য পূর্ণ" : ""}`
                        : delta < 0
                          ? `${Math.round(delta)}%`
                          : "কোনো পরিবর্তন হয়নি"
                  }
                </span>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

/* ---------------------------------------------------------
   DETAIL TEXT
   --------------------------------------------------------- */

export function getImprovementExplanation(request) {
  if (!request) return "";

  const parts = [];

  if (request.currentAccuracy != null) {
    parts.push(
      `এই অংশে তোমার বর্তমান accuracy ${Math.round(
        NUM(request.currentAccuracy)
      )}%।`
    );
  }

  if (request.relevantAttempts != null) {
    parts.push(
      `বিশ্লেষণে ${Math.round(
        NUM(request.relevantAttempts)
      )}টি relevant attempt বিবেচনা করা হয়েছে।`
    );
  }

  const wrongCount = Array.isArray(request.wrongQuestionIds)
    ? request.wrongQuestionIds.length
    : NUM(request.wrongQuestionCount);

  if (wrongCount > 0) {
    parts.push(
      `${wrongCount}টি relevant প্রশ্নে ভুলের evidence পাওয়া গেছে।`
    );
  }

  parts.push(
    "একটি মাত্র ভুলের ভিত্তিতে এই লক্ষ্য তৈরি করা হয়নি; repeated performance data বিবেচনা করা হয়েছে।"
  );

  return parts.join(" ");
}

/* ---------------------------------------------------------
   CSS
   --------------------------------------------------------- */

export function injectImprovementJourneyStyles() {
  if (document.getElementById("improvement-journey-styles")) return;

  const style = document.createElement("style");
  style.id = "improvement-journey-styles";

  style.textContent = `
    .improvement-journey,
    .improvement-history {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--surface-border, rgba(255,255,255,.10));
      background: var(--surface, rgba(255,255,255,.035));
      border-radius: 22px;
      padding: 22px;
      color: var(--text-primary, #fff);
    }

    .improvement-journey-header,
    .improvement-history-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .improvement-eyebrow {
      margin: 0 0 6px;
      font-size: .68rem;
      font-weight: 850;
      letter-spacing: .12em;
      color: var(--accent, #8ab4ff);
    }

    .improvement-journey h2,
    .improvement-history h3,
    .improvement-mission h3 {
      margin: 0;
    }

    .improvement-journey-header p:not(.improvement-eyebrow) {
      margin: 7px 0 0;
      color: var(--text-muted, #94a3b8);
      font-size: .85rem;
      line-height: 1.55;
    }

    .improvement-priority {
      flex: 0 0 auto;
      padding: 7px 10px;
      border-radius: 999px;
      font-size: .68rem;
      font-weight: 800;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.10);
    }

    .improvement-mission {
      border-radius: 18px;
      padding: 18px;
      background: rgba(0,0,0,.10);
      border: 1px solid rgba(255,255,255,.07);
    }

    .improvement-mission-top {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }

    .improvement-label {
      display: block;
      margin-bottom: 6px;
      font-size: .72rem;
      color: var(--text-muted, #94a3b8);
    }

    .improvement-path {
      margin: 7px 0 0;
      font-size: .78rem;
      color: var(--text-muted, #94a3b8);
    }

    .improvement-score {
      text-align: right;
      flex: 0 0 auto;
    }

    .improvement-score strong {
      display: block;
      font-size: 1.65rem;
      line-height: 1;
    }

    .improvement-score span {
      display: block;
      margin-top: 5px;
      color: var(--text-muted, #94a3b8);
      font-size: .7rem;
    }

    .improvement-progress {
      margin-top: 20px;
    }

    .improvement-progress-track {
      height: 9px;
      border-radius: 99px;
      overflow: hidden;
      background: rgba(255,255,255,.08);
    }

    .improvement-progress-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--accent, #6ea8fe), #a78bfa);
      transition: width .35s ease;
    }

    .improvement-progress-meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 7px;
      color: var(--text-muted, #94a3b8);
      font-size: .7rem;
      font-weight: 700;
    }

    .improvement-facts {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 9px;
      margin-top: 18px;
    }

    .improvement-facts > div {
      min-width: 0;
      padding: 12px;
      border-radius: 13px;
      background: rgba(255,255,255,.035);
      border: 1px solid rgba(255,255,255,.06);
    }

    .improvement-facts strong,
    .improvement-facts span {
      display: block;
    }

    .improvement-facts strong {
      font-size: .95rem;
    }

    .improvement-facts span {
      margin-top: 4px;
      color: var(--text-muted, #94a3b8);
      font-size: .68rem;
    }

    .improvement-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin-top: 18px;
    }

    .improvement-actions button {
      min-height: 42px;
      border-radius: 12px;
      padding: 0 15px;
      cursor: pointer;
      font: inherit;
      font-weight: 800;
    }

    .improvement-primary-btn {
      border: 0;
      color: #fff;
      background: var(--accent, #6ea8fe);
    }

    .improvement-secondary-btn {
      color: var(--text-primary, #fff);
      background: transparent;
      border: 1px solid var(--surface-border, rgba(255,255,255,.12));
    }

    .improvement-empty-state {
      padding: 18px;
      border-radius: 15px;
      background: rgba(255,255,255,.035);
    }

    .improvement-empty-state strong,
    .improvement-empty-state span {
      display: block;
    }

    .improvement-empty-state span {
      margin-top: 5px;
      color: var(--text-muted, #94a3b8);
      font-size: .8rem;
      line-height: 1.5;
    }

    .improvement-history {
      margin-top: 16px;
    }

    .improvement-history-header span {
      color: var(--text-muted, #94a3b8);
      font-size: .75rem;
    }

    .improvement-history-list {
      display: grid;
      gap: 8px;
    }

    .improvement-history-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      padding: 12px;
      border-radius: 13px;
      background: rgba(255,255,255,.035);
    }

    .improvement-history-item strong,
    .improvement-history-item span {
      display: block;
    }

    .improvement-history-item span {
      margin-top: 3px;
      color: var(--text-muted, #94a3b8);
      font-size: .68rem;
    }

    .improvement-history-score {
      text-align: right;
      flex: 0 0 auto;
    }

    .improvement-history-score span {
      color: #7dd3a7;
      font-weight: 800;
    }

    @media (max-width: 600px) {
      .improvement-journey,
      .improvement-history {
        padding: 16px;
        border-radius: 18px;
      }

      .improvement-journey-header {
        display: block;
      }

      .improvement-priority {
        display: inline-block;
        margin-top: 10px;
      }

      .improvement-mission-top {
        align-items: flex-start;
      }

      .improvement-facts {
        grid-template-columns: 1fr;
      }

      .improvement-actions {
        flex-direction: column;
      }

      .improvement-actions button {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);
}
