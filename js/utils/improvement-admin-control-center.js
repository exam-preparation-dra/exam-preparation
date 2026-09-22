/* =========================================================
   ADMIN — IMPROVEMENT CONTROL CENTER
   ---------------------------------------------------------
   UI/integration layer for the Improvement Engine.

   Connects:
   - improvement-admin-utils.js
   - improvement-utils.js
   - existing Admin page
   - Firestore improvementRequests / improvementTests

   This file does not replace the existing Admin page.
   It creates a self-contained Control Center section that can
   be mounted into any Admin page.

   Bengali UI only.
   No fake student data.
   No emoji.
   ========================================================= */

import {
  getImprovementRequestQueue,
  getImprovementQueueSummary,
  reviewImprovementRequest,
  dismissImprovementRequest,
  buildImprovementAlerts,
  getQuestionPoolForImprovement,
  buildImprovementTestDraft,
  createImprovementTest,
  setImprovementTestPublished,
  assignImprovementTest
} from "./improvement-admin-utils.js";

import {
  getPriorityLabel,
  getStatusLabel,
  IMPROVEMENT_STATUS
} from "./improvement-utils.js";

const ROOT_ID = "improvementAdminControlCenter";
const STYLE_ID = "improvement-admin-control-center-style";

let state = {
  requests: [],
  summary: null,
  alerts: [],
  selectedRequest: null,
  loading: false
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;

  style.textContent = `
    #${ROOT_ID} {
      --iac-border: var(--surface-border, rgba(127,127,127,.18));
      --iac-card: var(--surface, rgba(255,255,255,.04));
      --iac-muted: var(--text-muted, #7c8494);
      --iac-text: var(--text-primary, #171a21);
      width: 100%;
    }

    .iac-wrap {
      display: grid;
      gap: 16px;
    }

    .iac-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .iac-eyebrow {
      margin: 0 0 5px;
      font-size: 10px;
      letter-spacing: .14em;
      font-weight: 850;
      color: var(--iac-muted);
      text-transform: uppercase;
    }

    .iac-title {
      margin: 0;
      font-size: clamp(20px, 3vw, 28px);
      font-weight: 900;
      color: var(--iac-text);
    }

    .iac-subtitle {
      margin: 7px 0 0;
      color: var(--iac-muted);
      font-size: 13px;
      line-height: 1.6;
      max-width: 680px;
    }

    .iac-btn {
      border: 1px solid var(--iac-border);
      background: var(--iac-card);
      color: var(--iac-text);
      border-radius: 12px;
      padding: 10px 14px;
      font: inherit;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      transition: transform .15s ease, border-color .15s ease;
    }

    .iac-btn:hover {
      transform: translateY(-1px);
      border-color: currentColor;
    }

    .iac-btn-primary {
      background: var(--text-primary, #171a21);
      color: var(--surface, #fff);
      border-color: transparent;
    }

    .iac-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .iac-stat,
    .iac-card {
      border: 1px solid var(--iac-border);
      background: var(--iac-card);
      border-radius: 18px;
      padding: 16px;
    }

    .iac-stat-label {
      color: var(--iac-muted);
      font-size: 11px;
      font-weight: 800;
    }

    .iac-stat-value {
      margin-top: 7px;
      font-size: 25px;
      font-weight: 900;
      color: var(--iac-text);
    }

    .iac-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(300px, .8fr);
      gap: 16px;
      align-items: start;
    }

    .iac-section-title {
      margin: 0;
      font-size: 15px;
      font-weight: 900;
      color: var(--iac-text);
    }

    .iac-section-note {
      margin: 4px 0 14px;
      color: var(--iac-muted);
      font-size: 11px;
      line-height: 1.5;
    }

    .iac-list {
      display: grid;
      gap: 9px;
    }

    .iac-request {
      width: 100%;
      text-align: left;
      border: 1px solid var(--iac-border);
      background: transparent;
      color: inherit;
      border-radius: 15px;
      padding: 13px;
      cursor: pointer;
    }

    .iac-request.active {
      border-color: currentColor;
    }

    .iac-request-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }

    .iac-request-name {
      font-weight: 900;
      font-size: 13px;
      color: var(--iac-text);
    }

    .iac-request-meta {
      margin-top: 4px;
      font-size: 11px;
      color: var(--iac-muted);
    }

    .iac-badges {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-top: 9px;
    }

    .iac-badge {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--iac-border);
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 800;
      color: var(--iac-muted);
    }

    .iac-detail {
      position: sticky;
      top: 16px;
    }

    .iac-detail-empty {
      color: var(--iac-muted);
      font-size: 12px;
      line-height: 1.7;
    }

    .iac-detail-name {
      font-size: 20px;
      font-weight: 900;
      color: var(--iac-text);
      margin: 0;
    }

    .iac-metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 9px;
      margin: 14px 0;
    }

    .iac-metric {
      border: 1px solid var(--iac-border);
      border-radius: 13px;
      padding: 11px;
    }

    .iac-metric-label {
      font-size: 10px;
      color: var(--iac-muted);
      font-weight: 750;
    }

    .iac-metric-value {
      margin-top: 3px;
      font-size: 17px;
      font-weight: 900;
      color: var(--iac-text);
    }

    .iac-actions {
      display: grid;
      gap: 8px;
      margin-top: 14px;
    }

    .iac-alert {
      border-left: 3px solid currentColor;
      border-radius: 10px;
      padding: 10px 12px;
      border-top: 1px solid var(--iac-border);
      border-right: 1px solid var(--iac-border);
      border-bottom: 1px solid var(--iac-border);
      font-size: 11px;
      color: var(--iac-text);
      line-height: 1.55;
    }

    .iac-empty {
      padding: 22px 10px;
      text-align: center;
      color: var(--iac-muted);
      font-size: 12px;
      line-height: 1.7;
    }

    .iac-error {
      border: 1px solid var(--iac-border);
      border-radius: 16px;
      padding: 15px;
      color: var(--iac-muted);
      font-size: 12px;
    }

    .iac-divider {
      height: 1px;
      background: var(--iac-border);
      margin: 14px 0;
    }

    .iac-question-list {
      display: grid;
      gap: 7px;
      margin-top: 9px;
    }

    .iac-question {
      border: 1px solid var(--iac-border);
      border-radius: 10px;
      padding: 9px;
      font-size: 11px;
      color: var(--iac-muted);
    }

    @media (max-width: 900px) {
      .iac-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .iac-layout {
        grid-template-columns: 1fr;
      }

      .iac-detail {
        position: static;
      }
    }

    @media (max-width: 560px) {
      .iac-grid {
        grid-template-columns: 1fr 1fr;
      }

      .iac-stat,
      .iac-card {
        padding: 13px;
        border-radius: 15px;
      }

      .iac-header {
        display: grid;
      }
    }
  `;

  document.head.appendChild(style);
}

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;

  root = document.createElement("section");
  root.id = ROOT_ID;
  root.className = "mt-4";

  const adminMain =
    document.querySelector("main") ||
    document.querySelector(".app-shell") ||
    document.body;

  adminMain.appendChild(root);
  return root;
}

function priorityText(priority) {
  return getPriorityLabel(priority) || "পর্যবেক্ষণ";
}

function statusText(status) {
  return getStatusLabel(status) || "অজানা";
}

function renderShell(root) {
  const summary = state.summary || {};

  root.innerHTML = `
    <div class="iac-wrap">
      <div class="iac-header">
        <div>
          <p class="iac-eyebrow">IMPROVEMENT CONTROL CENTER</p>
          <h2 class="iac-title">শিক্ষার্থীদের উন্নতি ব্যবস্থাপনা</h2>
          <p class="iac-subtitle">
            বাস্তব পরীক্ষার ফলাফল থেকে শনাক্ত হওয়া দুর্বল জায়গাগুলো এখানে দেখা,
            পর্যালোচনা এবং Improvement Test-এর জন্য নিয়ন্ত্রণ করা যাবে।
          </p>
        </div>

        <button class="iac-btn" data-iac-refresh>
          তথ্য রিফ্রেশ
        </button>
      </div>

      <div class="iac-grid">
        <div class="iac-stat">
          <div class="iac-stat-label">মোট অনুরোধ</div>
          <div class="iac-stat-value">${num(summary.total)}</div>
        </div>

        <div class="iac-stat">
          <div class="iac-stat-label">জরুরি</div>
          <div class="iac-stat-value">${num(summary.highPriority)}</div>
        </div>

        <div class="iac-stat">
          <div class="iac-stat-label">পরীক্ষা প্রয়োজন</div>
          <div class="iac-stat-value">${num(summary.testRequired)}</div>
        </div>

        <div class="iac-stat">
          <div class="iac-stat-label">সম্পন্ন</div>
          <div class="iac-stat-value">${num(summary.completed)}</div>
        </div>
      </div>

      <div class="iac-layout">
        <div class="iac-card">
          <h3 class="iac-section-title">Improvement Queue</h3>
          <p class="iac-section-note">
            প্রতিটি অনুরোধ শিক্ষার্থীর বাস্তব ফলাফল ও repeated performance evidence-এর ভিত্তিতে এসেছে।
          </p>

          <div id="iacRequestList" class="iac-list"></div>
        </div>

        <aside class="iac-card iac-detail" id="iacDetail">
          <div class="iac-detail-empty">
            বাম দিক থেকে একটি Improvement Request নির্বাচন করো।
          </div>
        </aside>
      </div>

      <div class="iac-card">
        <h3 class="iac-section-title">সতর্কতা</h3>
        <p class="iac-section-note">
          গুরুত্বপূর্ণ Improvement Request বা workflow পরিবর্তন এখানে দেখা যাবে।
        </p>
        <div id="iacAlerts" class="iac-list"></div>
      </div>
    </div>
  `;

  root.querySelector("[data-iac-refresh]")?.addEventListener(
    "click",
    load
  );
}

function renderRequests() {
  const list = document.getElementById("iacRequestList");
  if (!list) return;

  if (!state.requests.length) {
    list.innerHTML = `
      <div class="iac-empty">
        এই মুহূর্তে কোনো Improvement Request নেই।
      </div>
    `;
    return;
  }

  list.innerHTML = state.requests.map((request) => `
    <button
      class="iac-request ${state.selectedRequest?.id === request.id ? "active" : ""}"
      data-request-id="${esc(request.id)}"
    >
      <div class="iac-request-top">
        <div>
          <div class="iac-request-name">
            ${esc(request.entityName || request.entityId)}
          </div>
          <div class="iac-request-meta">
            Student: ${esc(request.studentId || "অজানা")}
          </div>
        </div>

        <div class="iac-badge">
          ${esc(priorityText(request.priority))}
        </div>
      </div>

      <div class="iac-badges">
        <span class="iac-badge">
          বর্তমান ${Math.round(num(request.currentAccuracy))}%
        </span>

        <span class="iac-badge">
          লক্ষ্য ${Math.round(num(request.targetAccuracy))}%
        </span>

        <span class="iac-badge">
          ${esc(statusText(request.status))}
        </span>
      </div>
    </button>
  `).join("");

  list.querySelectorAll("[data-request-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.requestId;
      state.selectedRequest =
        state.requests.find((x) => x.id === id) || null;

      renderRequests();
      renderDetail();
    });
  });
}

function renderAlerts() {
  const el = document.getElementById("iacAlerts");
  if (!el) return;

  if (!state.alerts.length) {
    el.innerHTML = `
      <div class="iac-empty">
        এখন কোনো গুরুত্বপূর্ণ সতর্কতা নেই।
      </div>
    `;
    return;
  }

  el.innerHTML = state.alerts.slice(0, 8).map((alert) => `
    <div class="iac-alert">
      ${esc(alert.message || alert.text || "গুরুত্বপূর্ণ Improvement পরিবর্তন শনাক্ত হয়েছে।")}
    </div>
  `).join("");
}

function renderDetail() {
  const el = document.getElementById("iacDetail");
  const request = state.selectedRequest;

  if (!el) return;

  if (!request) {
    el.innerHTML = `
      <div class="iac-detail-empty">
        বাম দিক থেকে একটি Improvement Request নির্বাচন করো।
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <p class="iac-eyebrow">REQUEST DETAILS</p>
    <h3 class="iac-detail-name">
      ${esc(request.entityName || request.entityId)}
    </h3>

    <div class="iac-badges">
      <span class="iac-badge">
        ${esc(request.entityType || "learning area")}
      </span>

      <span class="iac-badge">
        ${esc(priorityText(request.priority))}
      </span>

      <span class="iac-badge">
        ${esc(statusText(request.status))}
      </span>
    </div>

    <div class="iac-metrics">
      <div class="iac-metric">
        <div class="iac-metric-label">বর্তমান Accuracy</div>
        <div class="iac-metric-value">${Math.round(num(request.currentAccuracy))}%</div>
      </div>

      <div class="iac-metric">
        <div class="iac-metric-label">লক্ষ্য Accuracy</div>
        <div class="iac-metric-value">${Math.round(num(request.targetAccuracy))}%</div>
      </div>

      <div class="iac-metric">
        <div class="iac-metric-label">চেষ্টা</div>
        <div class="iac-metric-value">${num(request.attempts)}</div>
      </div>

      <div class="iac-metric">
        <div class="iac-metric-label">ভুল প্রশ্ন</div>
        <div class="iac-metric-value">${num(request.wrongQuestions)}</div>
      </div>
    </div>

    <div class="iac-divider"></div>

    <div class="iac-section-note">
      <strong>কেন Request এসেছে?</strong><br>
      ${esc(request.reason === "repeated_low_performance"
        ? "একাধিক পরীক্ষায় একই learning area-তে কম performance পাওয়া গেছে।"
        : request.reason || "Performance evidence অনুযায়ী improvement প্রয়োজন।")}
    </div>

    <div class="iac-actions">
      <button class="iac-btn iac-btn-primary" data-action="review">
        Request পর্যালোচনা
      </button>

      <button class="iac-btn" data-action="build-test">
        Improvement Test তৈরি
      </button>

      <button class="iac-btn" data-action="dismiss">
        Request বাতিল
      </button>
    </div>

    <div id="iacTestPreview"></div>
  `;

  el.querySelector('[data-action="review"]')
    ?.addEventListener("click", () => handleReview(request));

  el.querySelector('[data-action="build-test"]')
    ?.addEventListener("click", () => handleBuildTest(request));

  el.querySelector('[data-action="dismiss"]')
    ?.addEventListener("click", () => handleDismiss(request));
}

async function handleReview(request) {
  try {
    await reviewImprovementRequest(request.id);
    await load();
  } catch (error) {
    console.error(error);
    alert("Improvement Request পর্যালোচনা করা যায়নি।");
  }
}

async function handleDismiss(request) {
  const ok = window.confirm(
    "এই Improvement Request কি বাতিল করতে চাও?"
  );

  if (!ok) return;

  try {
    await dismissImprovementRequest(request.id);
    await load();
  } catch (error) {
    console.error(error);
    alert("Request বাতিল করা যায়নি।");
  }
}

async function handleBuildTest(request) {
  const preview = document.getElementById("iacTestPreview");
  if (!preview) return;

  preview.innerHTML = `
    <div class="iac-divider"></div>
    <div class="iac-section-note">
      Improvement Test-এর জন্য বাস্তব question pool তৈরি করা হচ্ছে...
    </div>
  `;

  try {
    const pool = await getQuestionPoolForImprovement(request);

    const draft = buildImprovementTestDraft({
      request,
      questionPool: pool
    });

    preview.innerHTML = `
      <div class="iac-divider"></div>

      <div class="iac-section-note">
        <strong>Test Draft প্রস্তুত</strong><br>
        প্রশ্ন: ${num(draft.questionCount || draft.questions?.length)}
      </div>

      <div class="iac-question-list">
        ${(draft.questions || []).slice(0, 8).map((question, index) => `
          <div class="iac-question">
            ${index + 1}. ${esc(
              question.questionText ||
              question.text ||
              question.id ||
              "প্রশ্ন"
            )}
          </div>
        `).join("")}
      </div>

      <div class="iac-actions">
        <button class="iac-btn iac-btn-primary" data-create-test>
          Test তৈরি করে সংরক্ষণ
        </button>
      </div>
    `;

    preview.querySelector("[data-create-test]")
      ?.addEventListener("click", async () => {
        try {
          const created = await createImprovementTest({
            request,
            draft
          });

          if (created?.id) {
            await setImprovementTestPublished(created.id, false);
            await assignImprovementTest(created.id, request.studentId);
          }

          await load();

          alert(
            "Improvement Test তৈরি হয়েছে এবং শিক্ষার্থীর জন্য বরাদ্দ করা হয়েছে। Publish করার আগে Admin এটি যাচাই করতে পারবে।"
          );
        } catch (error) {
          console.error(error);
          alert("Improvement Test তৈরি করা যায়নি।");
        }
      });
  } catch (error) {
    console.error(error);

    preview.innerHTML = `
      <div class="iac-divider"></div>
      <div class="iac-error">
        Question pool তৈরি করা যায়নি। আগে Firestore-এর বাস্তব question/exam data যাচাই করো।
      </div>
    `;
  }
}

async function load() {
  if (state.loading) return;

  state.loading = true;

  try {
    const [requests, summary, alerts] = await Promise.all([
      getImprovementRequestQueue({
        status: null,
        limitCount: 100
      }),
      getImprovementQueueSummary(),
      buildImprovementAlerts()
    ]);

    state.requests = Array.isArray(requests) ? requests : [];
    state.summary = summary || {};
    state.alerts = Array.isArray(alerts) ? alerts : [];

    if (
      state.selectedRequest &&
      !state.requests.some((x) => x.id === state.selectedRequest.id)
    ) {
      state.selectedRequest = null;
    }

    const root = ensureRoot();
    renderShell(root);
    renderRequests();
    renderDetail();
    renderAlerts();
  } catch (error) {
    console.error("Improvement Control Center:", error);

    const root = ensureRoot();

    root.innerHTML = `
      <div class="iac-error">
        Improvement Control Center-এর তথ্য লোড করা যায়নি।
        Firestore rules এবং improvement-admin-utils.js সংযোগ পরীক্ষা করো।
      </div>
    `;
  } finally {
    state.loading = false;
  }
}

export function initImprovementAdminControlCenter() {
  injectStyles();
  load();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initImprovementAdminControlCenter,
    { once: true }
  );
} else {
  initImprovementAdminControlCenter();
}
