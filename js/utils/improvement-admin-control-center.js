/* =========================================================
   ADMIN — IMPROVEMENT CONTROL CENTER (clean card layout)
   ---------------------------------------------------------
   One card per Improvement Request. Every action lives on the
   card itself (no side panel to open):
     - Exam না থাকলে  -> "Exam তৈরি ও Publish" + "বাতিল"
     - Exam থাকলে      -> "Exam মুছুন"

   Embeddable: admin.html loads this through
   admin-improvement-integration.js, admin/improvement.html mounts
   it directly. Root id + exported init are unchanged.
   Bengali UI only. No fake data. No emoji.
   ========================================================= */

import {
  getImprovementRequestQueue,
  autoBuildAndPublishImprovementTest,
  autoPublishOverdueImprovementRequests,
  generateAndPublishImprovementForAllStudents,
  createImprovementRequestsForStudent,
  dismissImprovementRequest,
  deleteImprovementTest
} from "./improvement-admin-utils.js";

import { getActiveStudents } from "./student-utils.js";
import { getPriorityLabel, getStatusLabel } from "./improvement-utils.js";
import { showToast } from "./ui-utils.js";

const ROOT_ID = "improvementAdminControlCenter";
const STYLE_ID = "improvement-admin-control-center-style";

const FILTERS = [
  { key: "all",     label: "সব" },
  { key: "pending", label: "অপেক্ষমাণ" },
  { key: "exam",    label: "Exam আছে" },
  { key: "done",    label: "সম্পন্ন" }
];

const state = {
  requests: [],
  students: {},
  filter: "all",
  bulkHtml: "",
  busyId: null,
  loading: false,
  reloadQueued: false
};

/* ---------- helpers ---------- */
function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const pct = v => Math.max(0, Math.min(100, Math.round(num(v))));

function kindOf(r) {
  if (r.status === "dismissed") return "closed";
  if (r.status === "completed" || r.status === "resolved") return "done";
  if (r.improvementTestId) return "exam";
  return "pending";
}

function studentName(r) {
  return state.students[r.studentId]?.name || r.studentName || r.studentId || "অজানা শিক্ষার্থী";
}

function areaName(r) {
  return r.topicName || r.chapterName || r.subjectName || r.entityName || r.entityId || "সাধারণ";
}

function areaPath(r) {
  if (r.entityType === "exam") {
    return r.source === "student_request" ? "শিক্ষার্থীর আবেদন · পরীক্ষা" : "পরীক্ষায় ৫০% এর কম পেয়েছে";
  }
  const parts = [r.subjectName, r.chapterName, r.topicName].filter(Boolean);
  return parts.length > 1 ? parts.join(" › ") : "";
}

function priorityClass(p) {
  return ({ critical: "p-critical", high: "p-high", medium: "p-medium" })[p] || "p-low";
}

/* ---------- styles (app tokens: glass card, gold accent) ---------- */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} { --iac-rgb: 201,151,63; width:100%; display:grid; gap:16px; }

    #${ROOT_ID} .iac-card {
      background: rgba(128,128,128,.03);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(128,128,128,.12); border-radius: 20px; padding: 18px;
      box-shadow: 0 8px 32px rgba(0,0,0,.02);
    }

    /* stats */
    #${ROOT_ID} .iac-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    #${ROOT_ID} .iac-stat { padding:14px 10px; border-radius:16px; text-align:center;
      background: rgba(128,128,128,.03); border:1px solid rgba(128,128,128,.12); }
    #${ROOT_ID} .iac-stat b { display:block; font-family:var(--font-num); font-size:1.5rem; font-weight:900; color:var(--text-primary); line-height:1.15; }
    #${ROOT_ID} .iac-stat span { display:block; margin-top:3px; font-size:.68rem; font-weight:800; color:var(--text-muted); }
    #${ROOT_ID} .iac-stat.accent { background: rgba(var(--iac-rgb),.08); border-color: rgba(var(--iac-rgb),.28); }
    #${ROOT_ID} .iac-stat.accent b { color: var(--color-accent); }

    /* bulk automation */
    #${ROOT_ID} .iac-bulk { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:14px;
      border-color: rgba(var(--iac-rgb),.25); background: rgba(var(--iac-rgb),.06); }
    #${ROOT_ID} .iac-bulk h3 { margin:0; font-size:.98rem; font-weight:900; color:var(--text-primary); }
    #${ROOT_ID} .iac-bulk p { margin:4px 0 0; font-size:.74rem; font-weight:600; line-height:1.55; color:var(--text-muted); }
    #${ROOT_ID} .iac-bulk-result { flex:1 1 100%; }

    /* buttons */
    #${ROOT_ID} .iac-btn {
      display:inline-flex; align-items:center; justify-content:center; gap:7px;
      padding:10px 16px; border-radius:12px; cursor:pointer; white-space:nowrap;
      font:inherit; font-size:.82rem; font-weight:800; color:var(--text-primary);
      background: rgba(128,128,128,.05); border:1px solid rgba(128,128,128,.15);
      transition: transform .18s ease, background .18s ease, box-shadow .18s ease;
    }
    #${ROOT_ID} .iac-btn:hover { background: rgba(128,128,128,.1); transform: translateY(-1px); }
    #${ROOT_ID} .iac-btn:active { transform: scale(.97); }
    #${ROOT_ID} .iac-btn:disabled { opacity:.55; cursor:wait; transform:none; }
    #${ROOT_ID} .iac-btn.primary { color:#fff; border:none; background: linear-gradient(135deg, var(--color-accent), #f59e0b);
      box-shadow: 0 4px 15px rgba(var(--iac-rgb),.3); }
    #${ROOT_ID} .iac-btn.primary:hover { box-shadow: 0 6px 20px rgba(var(--iac-rgb),.4); }
    #${ROOT_ID} .iac-btn.danger { color:#ef4444; background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.22); }
    #${ROOT_ID} .iac-btn.danger:hover { background:#ef4444; color:#fff; }

    /* list header + filters */
    #${ROOT_ID} .iac-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    #${ROOT_ID} .iac-head h2 { margin:0; font-size:1rem; font-weight:900; color:var(--text-primary); }
    #${ROOT_ID} .iac-chips { display:flex; gap:8px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none; }
    #${ROOT_ID} .iac-chips::-webkit-scrollbar { display:none; }
    #${ROOT_ID} .iac-chip { flex:0 0 auto; padding:8px 14px; border-radius:99px; cursor:pointer; font:inherit;
      font-size:.78rem; font-weight:800; color:var(--text-muted);
      background: rgba(128,128,128,.04); border:1px solid rgba(128,128,128,.14); }
    #${ROOT_ID} .iac-chip.active { color:var(--color-accent); background: rgba(var(--iac-rgb),.1); border-color: rgba(var(--iac-rgb),.35); }
    #${ROOT_ID} .iac-chip small { font-family:var(--font-num); font-weight:800; opacity:.8; margin-left:4px; }

    /* request card */
    #${ROOT_ID} .iac-list { display:grid; gap:12px; }
    #${ROOT_ID} .iac-req { display:grid; gap:12px; }
    #${ROOT_ID} .iac-req.is-closed { opacity:.6; }
    #${ROOT_ID} .iac-req-top { display:flex; align-items:center; gap:12px; }
    #${ROOT_ID} .iac-avatar { flex:0 0 auto; width:40px; height:40px; border-radius:12px; display:grid; place-items:center;
      font-weight:900; font-size:.95rem; color:var(--color-accent); background: rgba(var(--iac-rgb),.12); border:1px solid rgba(var(--iac-rgb),.28); }
    #${ROOT_ID} .iac-who { min-width:0; flex:1; }
    #${ROOT_ID} .iac-who b { display:block; font-size:.95rem; font-weight:900; color:var(--text-primary);
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #${ROOT_ID} .iac-who span { display:block; margin-top:2px; font-size:.74rem; font-weight:700; color:var(--text-muted);
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #${ROOT_ID} .iac-area { font-size:.95rem; font-weight:900; color:var(--text-primary); line-height:1.4; }
    #${ROOT_ID} .iac-path { margin-top:2px; font-size:.72rem; font-weight:700; color:var(--text-muted); }

    #${ROOT_ID} .iac-badge { display:inline-block; padding:4px 11px; border-radius:99px; font-size:.68rem; font-weight:900; white-space:nowrap;
      border:1px solid transparent; }
    #${ROOT_ID} .p-critical { color:#ef4444; background:rgba(239,68,68,.1); border-color:rgba(239,68,68,.25); }
    #${ROOT_ID} .p-high     { color:#f59e0b; background:rgba(245,158,11,.1); border-color:rgba(245,158,11,.25); }
    #${ROOT_ID} .p-medium   { color:var(--color-accent); background:rgba(var(--iac-rgb),.1); border-color:rgba(var(--iac-rgb),.28); }
    #${ROOT_ID} .p-low      { color:var(--text-secondary); background:rgba(128,128,128,.1); border-color:rgba(128,128,128,.2); }
    #${ROOT_ID} .k-pending  { color:#3b82f6; background:rgba(59,130,246,.1); border-color:rgba(59,130,246,.2); }
    #${ROOT_ID} .k-exam     { color:#10b981; background:rgba(16,185,129,.1); border-color:rgba(16,185,129,.22); }
    #${ROOT_ID} .k-done     { color:#8b5cf6; background:rgba(139,92,246,.1); border-color:rgba(139,92,246,.22); }
    #${ROOT_ID} .k-closed   { color:var(--text-secondary); background:rgba(128,128,128,.1); border-color:rgba(128,128,128,.2); }

    /* accuracy bar */
    #${ROOT_ID} .iac-acc { display:grid; gap:6px; }
    #${ROOT_ID} .iac-acc-row { display:flex; justify-content:space-between; font-size:.74rem; font-weight:800; color:var(--text-muted); }
    #${ROOT_ID} .iac-acc-row b { font-family:var(--font-num); color:var(--text-primary); }
    #${ROOT_ID} .iac-bar { position:relative; height:8px; border-radius:99px; background:rgba(128,128,128,.14); overflow:visible; }
    #${ROOT_ID} .iac-bar i { position:absolute; left:0; top:0; bottom:0; border-radius:99px;
      background: linear-gradient(90deg, var(--color-accent), #f59e0b); }
    #${ROOT_ID} .iac-bar em { position:absolute; top:-3px; bottom:-3px; width:2px; border-radius:2px; background:var(--text-primary); opacity:.55; }

    #${ROOT_ID} .iac-foot { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;
      padding-top:12px; border-top:1px dashed rgba(128,128,128,.2); }
    #${ROOT_ID} .iac-facts { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
    #${ROOT_ID} .iac-actions { display:flex; gap:8px; flex-wrap:wrap; }
    #${ROOT_ID} .iac-note { font-size:.74rem; font-weight:700; color:var(--text-muted); }

    #${ROOT_ID} .iac-msg { padding:12px 14px; border-radius:14px; font-size:.78rem; font-weight:700; line-height:1.6;
      color:var(--text-primary); background: rgba(16,185,129,.08); border:1px solid rgba(16,185,129,.3); }
    #${ROOT_ID} .iac-msg.err { background: rgba(239,68,68,.07); border-color: rgba(239,68,68,.25); }
    #${ROOT_ID} .iac-msg span { display:block; color:var(--text-muted); font-weight:600; }
    #${ROOT_ID} .iac-empty { padding:32px 12px; text-align:center; font-size:.85rem; font-weight:700; color:var(--text-muted); line-height:1.7; }

    @media (max-width:600px) {
      #${ROOT_ID} .iac-stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
      #${ROOT_ID} .iac-bulk { flex-direction:column; flex-wrap:nowrap; align-items:stretch; }
      #${ROOT_ID} .iac-card { padding:15px; border-radius:18px; }
      #${ROOT_ID} .iac-actions { width:100%; }
      #${ROOT_ID} .iac-actions .iac-btn { flex:1; }
    }
  `;
  document.head.appendChild(style);
}

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;
  root = document.createElement("section");
  root.id = ROOT_ID;
  (document.querySelector("main") || document.querySelector(".app-shell") || document.body).appendChild(root);
  return root;
}

/* ---------- render ---------- */
function counts() {
  const c = { all: state.requests.length, pending: 0, exam: 0, done: 0, closed: 0, urgent: 0 };
  for (const r of state.requests) {
    const k = kindOf(r);
    c[k]++;
    if (k === "pending" && ["critical", "high"].includes(r.priority)) c.urgent++;
  }
  return c;
}

function requestCard(r) {
  const kind = kindOf(r);
  const busy = state.busyId === r.id;
  const name = studentName(r);
  const cur = pct(r.currentAccuracy);
  const target = pct(r.targetAccuracy);

  let actions = "";
  if (kind === "pending") {
    actions = `
      <button class="iac-btn primary" data-action="build" data-id="${esc(r.id)}" ${busy ? "disabled" : ""}>
        ${busy ? "তৈরি হচ্ছে…" : "Exam তৈরি ও Publish"}
      </button>
      <button class="iac-btn danger" data-action="dismiss" data-id="${esc(r.id)}" ${busy ? "disabled" : ""}>মুছুন</button>`;
  } else if (r.improvementTestId) {
    actions = `
      <button class="iac-btn danger" data-action="delete-exam" data-id="${esc(r.id)}" data-test="${esc(r.improvementTestId)}" ${busy ? "disabled" : ""}>
        ${busy ? "মুছে ফেলা হচ্ছে…" : "Exam মুছুন"}
      </button>`;
  }

  const note = kind === "exam"
    ? `<span class="iac-note">${r.status === "assigned" ? "শিক্ষার্থীকে বরাদ্দ করা হয়েছে" : "Publish করা হয়েছে"}</span>`
    : kind === "done" ? `<span class="iac-note">শিক্ষার্থী অনুশীলন সম্পন্ন করেছে</span>` : "";

  return `
    <article class="iac-card iac-req ${kind === "closed" ? "is-closed" : ""}">
      <div class="iac-req-top">
        <div class="iac-avatar">${esc(name.trim().charAt(0).toUpperCase() || "?")}</div>
        <div class="iac-who">
          <b>${esc(name)}</b>
          <span>${esc(state.students[r.studentId]?.className || r.studentId || "")}</span>
        </div>
        <span class="iac-badge ${priorityClass(r.priority)}">${esc(getPriorityLabel(r.priority) || "পর্যবেক্ষণ")}</span>
      </div>

      <div>
        <div class="iac-area">${esc(areaName(r))}</div>
        ${areaPath(r) ? `<div class="iac-path">${esc(areaPath(r))}</div>` : ""}
      </div>

      <div class="iac-acc">
        <div class="iac-acc-row"><span>বর্তমান <b>${cur}%</b></span><span>লক্ষ্য <b>${target}%</b></span></div>
        <div class="iac-bar"><i style="width:${cur}%"></i><em style="left:calc(${target}% - 1px)"></em></div>
      </div>

      <div class="iac-foot">
        <div class="iac-facts">
          <span class="iac-badge k-${kind}">${esc(kind === "closed" ? "বাতিল" : kind === "pending" ? "Exam বাকি" : getStatusLabel(r.status))}</span>
          <span class="iac-note">চেষ্টা ${num(r.attempts)} · ভুল ${num(r.wrongQuestions)}</span>
          ${note}
        </div>
        ${actions ? `<div class="iac-actions">${actions}</div>` : ""}
      </div>
    </article>`;
}

function render() {
  const root = ensureRoot();
  const c = counts();
  const rows = state.requests.filter(r => state.filter === "all" || kindOf(r) === state.filter);

  root.innerHTML = `
    <div class="iac-stats">
      <div class="iac-stat"><b>${c.all}</b><span>মোট অনুরোধ</span></div>
      <div class="iac-stat accent"><b>${c.urgent}</b><span>জরুরি</span></div>
      <div class="iac-stat"><b>${c.exam}</b><span>Exam চলছে</span></div>
      <div class="iac-stat"><b>${c.done}</b><span>সম্পন্ন</span></div>
    </div>

    <section class="iac-card iac-bulk">
      <div>
        <h3>সবার জন্য একবারে Exam</h3>
        <p>সক্রিয় সব শিক্ষার্থীর দুর্বলতা ধরে Exam তৈরি, Publish ও Assign হবে। যাদের Exam আছে তাদের আবার হবে না।</p>
      </div>
      <button class="iac-btn primary" id="iacGenerateAllBtn" type="button">Generate + Publish</button>
      ${state.bulkHtml ? `<div class="iac-bulk-result">${state.bulkHtml}</div>` : ""}
    </section>

    <div class="iac-head">
      <h2>Improvement Queue</h2>
      <button class="iac-btn" data-action="refresh" type="button">রিফ্রেশ</button>
    </div>

    <div class="iac-chips">
      ${FILTERS.map(f => `
        <button class="iac-chip ${state.filter === f.key ? "active" : ""}" data-filter="${f.key}" type="button">
          ${f.label}<small>${c[f.key]}</small>
        </button>`).join("")}
    </div>

    <div class="iac-list">
      ${rows.length ? rows.map(requestCard).join("") : `<div class="iac-empty">এই ফিল্টারে কোনো অনুরোধ নেই।</div>`}
    </div>
  `;
}

/* ---------- actions ---------- */
async function handleBuild(request) {
  state.busyId = request.id; render();
  try {
    const created = await autoBuildAndPublishImprovementTest(request);
    showToast(`Exam তৈরি ও Publish হয়েছে (${num(created.questionCount)}টি প্রশ্ন)।`, "success");
  } catch (error) {
    console.error("Improvement Exam create/publish:", error);
    showToast(error?.message || "Exam তৈরি করা যায়নি।", "error");
  } finally {
    state.busyId = null; await load();
  }
}

async function handleDeleteExam(request) {
  const ok = window.confirm(
    `"${studentName(request)}" এর "${areaName(request)}" Improvement Exam মুছে ফেলবে?\n\n` +
    "Exam ও প্রশ্নের Snapshot চিরতরে মুছে যাবে, শিক্ষার্থীর চলমান চেষ্টা বাদ যাবে এবং এটি আর কোথাও দেখা যাবে না। আগে অর্জন করা XP ঠিক থাকবে।"
  );
  if (!ok) return;

  state.busyId = request.id; render();
  try {
    await deleteImprovementTest(request.improvementTestId);
    showToast("Improvement Exam মুছে ফেলা হয়েছে।", "success");
  } catch (error) {
    console.error("Improvement Exam delete:", error);
    showToast(error?.message || "Exam মুছে ফেলা যায়নি।", "error");
  } finally {
    state.busyId = null; await load();
  }
}

async function handleDismiss(request) {
  if (!window.confirm("এই Improvement Request মুছে ফেলবে? এটি আর তালিকায় দেখা যাবে না।")) return;
  state.busyId = request.id; render();
  try {
    await dismissImprovementRequest(request.id);
    showToast("Request মুছে ফেলা হয়েছে।", "success");
  } catch (error) {
    console.error(error);
    showToast("Request মুছে ফেলা যায়নি।", "error");
  } finally {
    state.busyId = null; await load();
  }
}

async function handleGenerateAll() {
  const btn = document.getElementById("iacGenerateAllBtn");
  if (!btn) return;
  if (!window.confirm("সব সক্রিয় শিক্ষার্থীর eligible Request থেকে Exam তৈরি, Publish ও Assign হবে। যাদের Exam আছে তাদের আবার হবে না। চালাবে?")) return;

  btn.disabled = true;
  btn.textContent = "চলছে…";
  state.bulkHtml = `<div class="iac-msg"><strong>Bulk automation চলছে</strong><span>পেজ বন্ধ কোরো না।</span></div>`;
  render();

  try {
    const s = await generateAndPublishImprovementForAllStudents({ maxRequests: 500, concurrency: 4 });
    const failed = (s.results || []).filter(r => r && !r.ok).slice(0, 5)
      .map(r => `${esc(state.students[r.studentId]?.name || r.studentId || "অজানা")}: ${esc(r.error || "সমস্যা")}`).join("<br>");

    state.bulkHtml = `
      <div class="iac-msg ${s.failed ? "err" : ""}">
        <strong>${num(s.published)}টি Exam Publish ও Assign হয়েছে</strong>
        <span>শিক্ষার্থী ${num(s.students)} · নতুন Request ${num(s.createdRequests)} · সফল ${num(s.published)} · ব্যর্থ ${num(s.failed)}</span>
        ${failed ? `<span>যেগুলো হয়নি:<br>${failed}</span>` : ""}
      </div>`;
  } catch (error) {
    console.error("Bulk Improvement Exam automation:", error);
    state.bulkHtml = `<div class="iac-msg err"><strong>Bulk generation সম্পন্ন হয়নি</strong><span>${esc(error?.message || "অজানা সমস্যা")}</span></div>`;
  }
  await load();
}

function onClick(event) {
  const chip = event.target.closest("[data-filter]");
  if (chip) { state.filter = chip.dataset.filter; render(); return; }

  if (event.target.closest("#iacGenerateAllBtn")) { handleGenerateAll(); return; }

  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "refresh") { load(true); return; }

  const request = state.requests.find(r => r.id === btn.dataset.id);
  if (!request) return;
  if (btn.dataset.action === "build") handleBuild(request);
  else if (btn.dataset.action === "delete-exam") handleDeleteExam(request);
  else if (btn.dataset.action === "dismiss") handleDismiss(request);
}

/* ---------- data ---------- */
async function loadStudents() {
  try {
    const list = await getActiveStudents();
    state.students = Object.fromEntries(
      list.map(s => [s.studentId, { name: s.name || "", className: s.className || "" }])
    );
  } catch (error) {
    console.warn("Improvement Control Center: student names skipped:", error);
  }
}

async function load(refreshStudents = false) {
  if (state.loading) { state.reloadQueued = true; return; }
  state.loading = true;
  try {
    if (refreshStudents || !Object.keys(state.students).length) await loadStudents();
    const rows = await getImprovementRequestQueue({ maxResults: 250 });
    // Removed (dismissed) requests are never shown. The record itself stays in
    // Firestore as a hidden marker so auto-detection does not rebuild it.
    state.requests = (Array.isArray(rows) ? rows : []).filter(r => r.status !== "dismissed");
    render();
  } catch (error) {
    console.error("Improvement Control Center:", error);
    ensureRoot().innerHTML = `<div class="iac-card iac-msg err"><strong>তথ্য লোড করা যায়নি</strong><span>Firestore rules ও improvement-admin-utils.js সংযোগ পরীক্ষা করো।</span></div>`;
  } finally {
    state.loading = false;
    if (state.reloadQueued) { state.reloadQueued = false; load(); }
  }
}

// Detection + overdue auto-publish run in the BACKGROUND now. The list
// paints straight away instead of waiting for every student to be scanned.
// (Spark plan has no cron, so this still only runs while an admin page is open.)
async function runBackgroundSweeps() {
  try {
    const students = await getActiveStudents();
    for (const s of students) {
      try { await createImprovementRequestsForStudent(s.studentId); }
      catch (error) { console.warn(`Improvement detection skipped for ${s.studentId}:`, error); }
    }
  } catch (error) {
    console.warn("Improvement detection sweep skipped:", error);
  }
  try {
    const results = await autoPublishOverdueImprovementRequests();
    const failed = results.filter(r => !r.ok);
    if (failed.length) console.warn("Overdue auto-publish failed for", failed);
  } catch (error) {
    console.warn("Improvement overdue sweep skipped:", error);
  }
}

export function initImprovementAdminControlCenter() {
  injectStyles();
  const root = ensureRoot();
  if (!root.dataset.bound) { root.dataset.bound = "1"; root.addEventListener("click", onClick); }
  root.innerHTML = `<div class="iac-empty">লোড হচ্ছে…</div>`;
  load(true).then(runBackgroundSweeps).then(() => load());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initImprovementAdminControlCenter, { once: true });
} else {
  initImprovementAdminControlCenter();
}
