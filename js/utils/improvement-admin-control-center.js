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
  autoBuildAndPublishImprovementTest,
  autoPublishOverdueImprovementRequests,
  generateAndPublishImprovementForAllStudents,
  createImprovementRequestsForStudent,
  getAllImprovementTests,
  deleteImprovementTestPermanently
} from "./improvement-admin-utils.js";

import { getActiveStudents } from "./student-utils.js";

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
  tests: [],
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

    .iac-bulk {
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(109,93,252,.20);
      border-radius: 20px;
      padding: 18px;
      background: linear-gradient(135deg, rgba(109,93,252,.10), rgba(109,93,252,.035));
      box-shadow: 0 12px 34px rgba(15,23,42,.055);
    }

    .iac-bulk::after {
      content: "";
      position: absolute;
      width: 180px;
      height: 180px;
      right: -75px;
      top: -90px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(109,93,252,.18), transparent 70%);
      pointer-events: none;
    }

    .iac-bulk-inner {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .iac-bulk-copy { min-width: 0; }
    .iac-bulk-title {
      margin: 0;
      font-size: 16px;
      font-weight: 950;
      color: var(--iac-text);
    }
    .iac-bulk-note {
      margin: 5px 0 0;
      color: var(--iac-muted);
      font-size: 11px;
      line-height: 1.6;
      max-width: 650px;
    }

    .iac-bulk-btn {
      flex: 0 0 auto;
      min-height: 48px;
      padding: 12px 17px;
      border: 0;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--imp-accent, #6d5dfc), var(--imp-accent-2, #8b7cff));
      color: #fff;
      font: inherit;
      font-size: 12px;
      font-weight: 950;
      cursor: pointer;
      box-shadow: 0 12px 28px rgba(109,93,252,.22);
      transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
    }
    .iac-bulk-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(109,93,252,.28); }
    .iac-bulk-btn:active { transform: translateY(0) scale(.98); }
    .iac-bulk-btn:disabled { opacity: .62; cursor: wait; transform: none; }

    .iac-bulk-result {
      margin-top: 12px;
      display: none;
    }
    .iac-bulk-result.show { display: block; }

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


    .iac-exam-section { margin-top: 16px; }
    .iac-exam-list { display: grid; gap: 14px; }
    .iac-exam-card {
      border: 1px solid var(--iac-border);
      background: var(--iac-card);
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 8px 28px rgba(0,0,0,.025);
      transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
    }
    .iac-exam-card:hover { transform: translateY(-2px); box-shadow: 0 12px 34px rgba(0,0,0,.055); }
    .iac-exam-top { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap; }
    .iac-exam-title { margin:0; font-size:17px; line-height:1.45; font-weight:950; color:var(--iac-text); }
    .iac-exam-subtitle { margin:5px 0 0; color:var(--iac-muted); font-size:11px; line-height:1.5; }
    .iac-exam-meta { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
    .iac-exam-meta-item { display:inline-flex; align-items:center; gap:6px; padding:7px 10px; border:1px solid var(--iac-border); border-radius:10px; background:rgba(128,128,128,.04); color:var(--iac-muted); font-size:10px; font-weight:800; }
    .iac-exam-status { display:inline-flex; align-items:center; padding:6px 11px; border-radius:999px; font-size:10px; font-weight:900; border:1px solid rgba(16,185,129,.2); background:rgba(16,185,129,.09); color:#10b981; white-space:nowrap; }
    .iac-exam-status.draft { border-color:rgba(128,128,128,.2); background:rgba(128,128,128,.08); color:var(--iac-muted); }
    .iac-exam-actions { display:flex; flex-wrap:wrap; gap:9px; margin-top:16px; padding-top:14px; border-top:1px dashed var(--iac-border); }
    .iac-exam-delete { border:1px solid rgba(239,68,68,.2); background:rgba(239,68,68,.08); color:#ef4444; border-radius:12px; padding:10px 14px; font:inherit; font-size:11px; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:.18s ease; }
    .iac-exam-delete:hover { background:#ef4444; color:#fff; transform:translateY(-1px); box-shadow:0 7px 18px rgba(239,68,68,.2); }
    .iac-exam-delete:disabled { opacity:.55; cursor:wait; transform:none; }
    .iac-exam-empty { border:1px dashed var(--iac-border); border-radius:16px; padding:24px; text-align:center; color:var(--iac-muted); font-size:12px; font-weight:750; }

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

    .iac-success-state {
      display: grid;
      gap: 4px;
      padding: 12px 13px;
      border: 1px solid rgba(16,185,129,.35);
      border-radius: 13px;
      background: rgba(16,185,129,.08);
      color: var(--iac-text);
      font-size: 11px;
      line-height: 1.5;
    }

    .iac-success-state strong {
      font-size: 12px;
      font-weight: 900;
    }

    .iac-success-state span {
      color: var(--iac-muted);
      overflow-wrap: anywhere;
    }

    .iac-loading {
      opacity: .65;
      pointer-events: none;
      cursor: wait;
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

    @media (max-width: 700px) {
      .iac-bulk-inner { align-items: stretch; flex-direction: column; }
      .iac-bulk-btn { width: 100%; }
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

      <section class="iac-bulk">
        <div class="iac-bulk-inner">
          <div class="iac-bulk-copy">
            <p class="iac-eyebrow">ONE-CLICK AUTOMATION</p>
            <h3 class="iac-bulk-title">সকল শিক্ষার্থীর Improvement Exam তৈরি করুন</h3>
            <p class="iac-bulk-note">
              সক্রিয় শিক্ষার্থীদের ফলাফল থেকে দুর্বলতা শনাক্ত করে eligible Improvement Request-এর জন্য প্রশ্ন বাছাই করবে, Exam তৈরি করবে, Publish করবে এবং সরাসরি শিক্ষার্থীকে Assign করবে। আলাদা করে Generate ও Publish চাপতে হবে না।
            </p>
          </div>
          <button class="iac-bulk-btn" id="iacGenerateAllBtn" type="button">
            সকলের জন্য Generate + Publish
          </button>
        </div>
        <div class="iac-bulk-result" id="iacBulkResult"></div>
      </section>


      <section class="iac-card iac-exam-section">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div>
            <p class="iac-eyebrow">EXAM MANAGEMENT</p>
            <h3 class="iac-section-title">Improvement Exam ব্যবস্থাপনা</h3>
            <p class="iac-section-note" style="margin-bottom:0;">
              তৈরি হওয়া Improvement Exam এখানে দেখা যাবে। স্থায়ীভাবে মুছলে Exam, Snapshot, Attempt এবং সংশ্লিষ্ট Request-এর Firestore record-ও মুছে যাবে।
            </p>
          </div>
          <button class="iac-btn" id="iacRefreshTestsBtn" type="button">তালিকা রিফ্রেশ</button>
        </div>
        <div id="iacExamList" class="iac-exam-list" style="margin-top:14px;"></div>
      </section>

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

  root.querySelector("#iacGenerateAllBtn")?.addEventListener("click", handleGenerateAll);
  root.querySelector("#iacRefreshTestsBtn")?.addEventListener("click", () => load());
}

async function handleGenerateAll() {
  const button = document.getElementById("iacGenerateAllBtn");
  const result = document.getElementById("iacBulkResult");
  if (!button || !result) return;

  const confirmed = window.confirm(
    "সকল সক্রিয় শিক্ষার্থীর eligible Improvement Request থেকে Exam তৈরি, Publish এবং Assign করা হবে। ইতিমধ্যে Exam তৈরি হওয়া Request আবার তৈরি হবে না। চালিয়ে যেতে চাও?"
  );
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "সব শিক্ষার্থীর Exam তৈরি ও Publish হচ্ছে…";
  result.className = "iac-bulk-result show";
  result.innerHTML = `
    <div class="iac-success-state">
      <strong>Bulk automation চলছে</strong>
      <span>দুর্বলতা শনাক্ত করা, প্রশ্ন বাছাই, Exam তৈরি, Publish ও Assign—সব ধাপ সম্পন্ন করা হচ্ছে।</span>
    </div>
  `;

  try {
    const summary = await generateAndPublishImprovementForAllStudents({
      maxRequests: 500,
      concurrency: 4
    });

    const failedDetails = (summary.results || [])
      .filter(r => !r.ok)
      .slice(0, 5)
      .map(r => `${esc(r.studentId || "অজানা")}: ${esc(r.error || "সমস্যা")}`)
      .join("<br>");

    result.innerHTML = `
      <div class="iac-success-state">
        <strong>${summary.published}টি Improvement Exam সফলভাবে Publish ও Assign হয়েছে</strong>
        <span>সক্রিয় শিক্ষার্থী: ${num(summary.students)} · নতুন Request: ${num(summary.createdRequests)} · Eligible Request: ${num(summary.eligibleRequests)} · সফল: ${num(summary.published)} · ব্যর্থ: ${num(summary.failed)}</span>
        ${failedDetails ? `<span style="margin-top:4px">যেগুলো হয়নি:<br>${failedDetails}</span>` : ""}
      </div>
    `;

    await load();
  } catch (error) {
    console.error("Bulk Improvement Exam automation:", error);
    result.innerHTML = `
      <div class="iac-error">
        <strong>Bulk generation সম্পন্ন করা যায়নি</strong><br>
        ${esc(error?.message || "অজানা সমস্যা হয়েছে।")}
      </div>
    `;
  } finally {
    button.disabled = false;
    button.textContent = "সকলের জন্য Generate + Publish";
  }
}


function formatDate(value) {
  const ms = ts(value);
  if (!ms) return "—";
  try { return new Date(ms).toLocaleDateString("bn-BD", { day:"numeric", month:"short", year:"numeric" }); }
  catch { return "—"; }
}

function renderImprovementTests() {
  const list = document.getElementById("iacExamList");
  if (!list) return;

  if (!state.tests.length) {
    list.innerHTML = `<div class="iac-exam-empty">এখনো কোনো Improvement Exam তৈরি হয়নি।</div>`;
    return;
  }

  list.innerHTML = state.tests.map(test => {
    const students = Array.isArray(test.studentIds) ? test.studentIds.length : 0;
    const published = test.published === true || test.status === "published";
    return `
      <article class="iac-exam-card">
        <div class="iac-exam-top">
          <div style="min-width:0;flex:1;">
            <h4 class="iac-exam-title">${esc(test.title || "Improvement Exam")}</h4>
            <p class="iac-exam-subtitle">Test ID: ${esc(test.id)}</p>
          </div>
          <span class="iac-exam-status ${published ? "" : "draft"}">${published ? "প্রকাশিত" : "খসড়া"}</span>
        </div>

        <div class="iac-exam-meta">
          <span class="iac-exam-meta-item">${num(test.questionCount)} টি প্রশ্ন</span>
          <span class="iac-exam-meta-item">${num(test.durationMinutes)} মিনিট</span>
          <span class="iac-exam-meta-item">${students} জন শিক্ষার্থী</span>
          <span class="iac-exam-meta-item">${formatDate(test.createdAt)}</span>
        </div>

        <div class="iac-exam-actions">
          <button class="iac-exam-delete" type="button" data-delete-improvement-test="${esc(test.id)}" data-test-title="${esc(test.title || "Improvement Exam")}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v5M14 11v5"/></svg>
            স্থায়ীভাবে মুছুন
          </button>
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-delete-improvement-test]").forEach(button => {
    button.addEventListener("click", () => handleDeleteImprovementTest(button));
  });
}

async function handleDeleteImprovementTest(button) {
  const testId = button?.dataset?.deleteImprovementTest;
  const title = button?.dataset?.testTitle || "Improvement Exam";
  if (!testId) return;

  const first = window.confirm(`"${title}" স্থায়ীভাবে মুছে ফেলবে? Exam-এর Snapshot, সব Student Attempt এবং সংশ্লিষ্ট Improvement Request-ও মুছে যাবে।`);
  if (!first) return;
  const second = window.confirm("শেষবার নিশ্চিত করো: এই record আর ফেরত আনা যাবে না। সত্যিই মুছবে?");
  if (!second) return;

  button.disabled = true;
  button.textContent = "মুছে ফেলা হচ্ছে…";

  try {
    await deleteImprovementTestPermanently(testId);
    await load();
  } catch (error) {
    console.error("Improvement Exam permanent delete:", error);
    alert(error?.message || "Improvement Exam স্থায়ীভাবে মুছে ফেলা যায়নি।");
    button.disabled = false;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v5M14 11v5"/></svg>
      স্থায়ীভাবে মুছুন
    `;
  }
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
      ${request.improvementTestId ? `
        <div class="iac-success-state">
          <strong>Improvement Exam তৈরি হয়েছে</strong>
          <span>Test ID: ${esc(request.improvementTestId)}</span>
          <span>${request.status === "assigned" ? "শিক্ষার্থীকে বরাদ্দ করা হয়েছে" : "Publish করা হয়েছে"}</span>
        </div>
      ` : `
        <button class="iac-btn iac-btn-primary" data-action="build-test">
          Improvement Exam তৈরি ও Publish করুন
        </button>
      `}

      ${request.status !== "dismissed" && request.status !== "assigned" && !request.improvementTestId ? `
        <button class="iac-btn" data-action="review">
          Request পর্যালোচনা
        </button>
        <button class="iac-btn" data-action="dismiss">
          Request বাতিল
        </button>
      ` : ""}
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
  const button = document.querySelector('[data-action="build-test"]');
  if (!preview) return;

  if (request.improvementTestId) {
    preview.innerHTML = `
      <div class="iac-success-state">
        <strong>এই Request-এর Improvement Exam ইতিমধ্যেই তৈরি হয়েছে।</strong>
        <span>Test ID: ${esc(request.improvementTestId)}</span>
      </div>
    `;
    return;
  }

  if (button) {
    button.disabled = true;
    button.classList.add("iac-loading");
    button.textContent = "Exam তৈরি হচ্ছে… প্রশ্ন ও Snapshot সংরক্ষণ করা হচ্ছে";
  }

  preview.innerHTML = `
    <div class="iac-divider"></div>
    <div class="iac-section-note">
      Improvement Exam তৈরি হচ্ছে। এই সময় পেজ বন্ধ কোরো না।
    </div>
  `;

  try {
    const created = await autoBuildAndPublishImprovementTest(request);

    preview.innerHTML = `
      <div class="iac-success-state">
        <strong>Improvement Exam সফলভাবে তৈরি ও Publish হয়েছে</strong>
        <span>Test ID: ${esc(created.id)}</span>
        <span>প্রশ্ন: ${num(created.questionCount)} · সময়: ${num(created.durationMinutes)} মিনিট · প্রতি প্রশ্ন: ১ নম্বর</span>
        <span>শিক্ষার্থীকে স্বয়ংক্রিয়ভাবে বরাদ্দ করা হয়েছে।</span>
      </div>
    `;

    await load();
  } catch (error) {
    console.error("Improvement Exam create/publish:", error);

    preview.innerHTML = `
      <div class="iac-error">
        <strong>Improvement Exam তৈরি করা যায়নি</strong><br>
        ${esc(error?.message || "অজানা সমস্যা হয়েছে।")}
      </div>
    `;

    if (button) {
      button.disabled = false;
      button.classList.remove("iac-loading");
      button.textContent = "আবার চেষ্টা করুন";
    }
  }
}

async function load() {
  if (state.loading) return;

  state.loading = true;

  try {
    const [requests, summary, alerts, tests] = await Promise.all([
      getImprovementRequestQueue({
        status: null,
        maxResults: 100
      }),
      getImprovementQueueSummary(),
      buildImprovementAlerts(),
      getAllImprovementTests({ maxResults: 250 })
    ]);

    const selectedId = state.selectedRequest?.id || null;

    state.requests = Array.isArray(requests) ? requests : [];
    state.summary = summary || {};
    state.alerts = Array.isArray(alerts) ? alerts : [];
    state.tests = Array.isArray(tests) ? tests : [];

    // Always replace the selected request with the freshly-read Firestore
    // version. Without this, the UI kept the old object after Publish/Assign,
    // so the same "Publish" button stayed visible even though Firestore had
    // already changed the request status.
    state.selectedRequest = selectedId
      ? state.requests.find((x) => x.id === selectedId) || null
      : null;

    const root = ensureRoot();
    renderShell(root);
    renderImprovementTests();
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

// THE MISSING STEP: nothing in this codebase ever actually scanned a
// student's results and created improvementRequests -- createImprovementRequestsForStudent()
// existed but was never called from anywhere, so the queue above always
// stayed empty no matter how badly a student performed. This runs it for
// every active student (each student is independent -- one failing does
// not stop the rest), same "opportunistic, next admin page load" pattern
// as runOverdueSweep below (Spark plan, no cron).
async function runDetectionSweep() {
  try {
    const students = await getActiveStudents();
    for (const s of students) {
      try {
        await createImprovementRequestsForStudent(s.studentId);
      } catch (error) {
        console.warn(`Improvement Control Center: detection skipped for ${s.studentId}:`, error);
      }
    }
  } catch (error) {
    console.warn("Improvement Control Center: detection sweep skipped:", error);
  }
}

// SPARK-PLAN LIMITATION: there is no server/cron here, so a request that
// crosses 24 hours unpublished cannot fire on its own the instant the
// deadline hits. This runs the same auto-build-and-publish used by the
// manual button, but sweeps every overdue request at once -- it just needs
// an admin to have this page open (any time after the 24 hours) to trigger.
async function runOverdueSweep() {
  try {
    const results = await autoPublishOverdueImprovementRequests();
    const okCount = results.filter(r => r.ok).length;
    if (okCount > 0) {
      console.info(`Improvement Control Center: ${okCount} overdue request(s) auto-published.`);
    }
    const failed = results.filter(r => !r.ok);
    if (failed.length) {
      console.warn("Improvement Control Center: overdue auto-publish failed for", failed);
    }
  } catch (error) {
    console.warn("Improvement Control Center: overdue sweep skipped:", error);
  }
}

export function initImprovementAdminControlCenter() {
  injectStyles();
  runDetectionSweep().then(runOverdueSweep).finally(load);
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
