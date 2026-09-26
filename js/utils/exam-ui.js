/* =========================================================
   EXAM UI — markup builders shared by
     student/exam.html            (regular exam)
     student/improvement-test.html (improvement exam)
   so both pages look and behave the same, in light and dark.
   Styles live in css/exam-ui.css (scoped to body.exam-page).
   No exam logic in here: pages keep their own state + events.
   ========================================================= */

import { toggleTheme } from "./ui-utils.js";

export const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

/* ---------- theme ---------- */
// Keep the browser / phone status bar in step with the chosen theme.
export function syncThemeColor() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
  meta.content = dark ? "#0e1712" : "#f5f0e3";
}

// Call once, right after initTheme().
export function initExamPage() {
  document.body.classList.add("exam-page");
  syncThemeColor();
}

export function themeButtonHtml() {
  return `
    <button type="button" class="ex-icon-btn ex-theme" data-ex-theme aria-label="ডে / নাইট মোড">
      <svg class="moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      <svg class="sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    </button>`;
}

// Call after every innerHTML render that contains a theme button.
export function bindThemeButtons(root = document) {
  root.querySelectorAll("[data-ex-theme]").forEach(btn => {
    btn.addEventListener("click", () => { toggleTheme(); syncThemeColor(); });
  });
}

const ICON = {
  back: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>`,
  next: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>`,
  grid: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
  close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  warn: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  star: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  card: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>`
};

/* ---------- intro screen ---------- */
// stats: [{label, value}]   facts / notes: html strings (already escaped where needed)
export function introHtml({ backHref, title, name, description, stats = [], facts = [], notes = [], startLabel }) {
  return `
    <header class="ex-topbar"><div class="ex-topbar-in">
      <a href="${esc(backHref)}" class="ex-icon-btn" aria-label="ফিরে যান">${ICON.back}</a>
      <h2 class="ex-page-title">${esc(title)}</h2>
      <div class="ex-actions">${themeButtonHtml()}</div>
    </div></header>

    <main class="ex-main">
      <section class="ex-card">
        <h1 class="ex-title">${name}</h1>
        ${description ? `<p class="ex-desc">${description}</p>` : ""}
        <div class="ex-stats">
          ${stats.map(s => `<div class="ex-stat"><small>${esc(s.label)}</small><b>${esc(s.value)}</b></div>`).join("")}
        </div>
        ${facts.length ? `<div class="ex-facts">${facts.map(f => `<p>${f}</p>`).join("")}</div>` : ""}
      </section>

      <section class="ex-card">
        <p class="ex-notes-title">${ICON.info} মনে রাখুন</p>
        <ul class="ex-notes">${notes.map(n => `<li>${n}</li>`).join("")}</ul>
      </section>
    </main>

    <nav class="ex-nav"><div class="ex-nav-in single">
      <button class="ex-btn ex-btn-primary" id="startBtn" type="button">${esc(startLabel)}</button>
    </div></nav>
  `;
}

/* ---------- running exam shell ---------- */
export function runShellHtml({ name, photoURL, total, showCardBtn = false }) {
  const initial = esc(String(name || "?").trim().charAt(0));
  return `
    <header class="ex-topbar"><div class="ex-topbar-in">
      <div class="ex-user">
        ${photoURL ? `<img class="ex-avatar" src="${esc(photoURL)}" alt="">` : `<div class="ex-avatar">${initial}</div>`}
        <span class="ex-user-name">${esc(name)}</span>
      </div>
      <div class="ex-actions">
        ${showCardBtn ? `<button id="useCardBtn" class="ex-icon-btn ex-card-btn" type="button" aria-label="টাইম কার্ড ব্যবহার করো">${ICON.card}<span id="cardBadge" class="ex-card-badge hidden">0</span></button>` : ""}
        <div class="ex-timer"><small>বাকি সময়</small><span id="timerDisplay">--:--</span></div>
        ${themeButtonHtml()}
        <button id="submitBtn" class="ex-submit" type="button">জমা দিন</button>
      </div>
    </div></header>

    <main class="ex-main">
      <section class="ex-card">
        <div class="ex-qhead">
          <p class="ex-qcount" id="qCounter">প্রশ্ন <b>1</b> / ${total}</p>
          <button id="paletteBtn" class="ex-icon-btn" type="button" aria-label="প্রশ্ন তালিকা">${ICON.grid}</button>
        </div>
        <div class="ex-progress"><i id="progressFill"></i></div>
        <p class="ex-progress-label" id="progressLabel"></p>
        <div id="questionBody"></div>
      </section>
    </main>

    <nav class="ex-nav"><div class="ex-nav-in">
      <button class="ex-btn ex-btn-ghost" id="prevBtn" type="button">${ICON.back} পূর্ববর্তী</button>
      <button class="ex-btn ex-btn-primary" id="nextBtn" type="button">পরবর্তী ${ICON.next}</button>
    </div></nav>

    <div id="paletteOverlay" class="ex-overlay hidden">
      <div class="ex-sheet">
        <div class="ex-sheet-head">
          <p class="ex-sheet-title">প্রশ্ন তালিকা</p>
          <button id="closePaletteBtn" class="ex-icon-btn" type="button" aria-label="বন্ধ করো">${ICON.close}</button>
        </div>
        <p class="ex-sheet-sub" id="paletteSummary"></p>
        <div class="ex-palette" id="paletteGrid"></div>
        <div class="ex-legend">
          <span><i class="l-now"></i> এখনকার</span>
          <span><i class="l-ok"></i> উত্তরিত</span>
          <span><i></i> অনুত্তরিত</span>
          <span><i class="l-mark"></i> চিহ্নিত</span>
        </div>
      </div>
    </div>

    <div id="submitModal" class="ex-overlay hidden">
      <div class="ex-sheet ex-confirm">
        <div class="ex-confirm-icon">${ICON.warn}</div>
        <p class="ex-sheet-title">নিশ্চিত করুন</p>
        <p class="msg" id="submitModalText"></p>
        <div class="ex-confirm-actions">
          <button class="ex-btn ex-btn-ghost" id="cancelSubmitBtn" type="button">ফিরে যান</button>
          <button class="ex-btn ex-btn-danger" id="confirmSubmitBtn" type="button">চূড়ান্ত জমা</button>
        </div>
      </div>
    </div>

    <div id="figurePreviewModal" class="hidden">
      <img id="figurePreviewImg" alt="" draggable="false" oncontextmenu="return false;">
    </div>

    ${showCardBtn ? cardModalHtml() : ""}
  `;
}

/* ---------- "use a time card" sheet (shown when useCardBtn is tapped) ---------- */
function cardModalHtml() {
  return `
    <div id="cardModal" class="ex-overlay hidden">
      <div class="ex-sheet">
        <div class="ex-sheet-head">
          <p class="ex-sheet-title">টাইম কার্ড ব্যবহার করো</p>
          <button id="closeCardModalBtn" class="ex-icon-btn" type="button" aria-label="বন্ধ করো">${ICON.close}</button>
        </div>
        <div class="ex-timecard">
          <div class="ex-timecard-plus"><span id="cardPerUnitLabel">+০</span></div>
          <div class="ex-timecard-info">
            <span class="ex-timecard-name">টাইম কার্ড</span>
            <span class="ex-timecard-avail">তোমার কাছে আছে <b id="cardAvailCount">0</b>টি</span>
          </div>
        </div>
        <div class="ex-card-qty-row">
          <span>কতগুলো ব্যবহার করবে</span>
          <div class="ex-qty">
            <button type="button" id="cardQtyDec" class="ex-qty-btn" aria-label="কমাও">−</button>
            <span class="ex-qty-value num" id="cardQtyValue">1</span>
            <button type="button" id="cardQtyInc" class="ex-qty-btn" aria-label="বাড়াও">+</button>
          </div>
        </div>
        <p class="ex-sheet-sub" id="cardTotalNote" style="margin:14px 0 0;"></p>
        <div class="ex-confirm-actions">
          <button class="ex-btn ex-btn-ghost" id="cancelCardBtn" type="button">বাতিল</button>
          <button class="ex-btn ex-btn-primary" id="confirmCardBtn" type="button">ব্যবহার করো</button>
        </div>
      </div>
    </div>`;
}

/* ---------- one question ---------- */
// questionBn / questionEn / option text are admin-authored (may contain math or
// HTML) and are inserted as-is, exactly like before.
export function questionHtml({ questionBn, questionEn, imageUrl, options, selected, isMarked }) {
  const image = imageUrl ? `
    <div class="ex-figure">
      <img src="${esc(imageUrl)}" draggable="false" oncontextmenu="return false;" onerror="this.style.display='none';">
      <div class="img-shield" data-url="${esc(imageUrl)}"></div>
    </div>` : "";

  return `
    ${questionEn ? `<details class="ex-en"><summary>English</summary><p>${questionEn}</p></details>` : ""}
    <p class="ex-qtext">${questionBn}</p>
    ${image}

    <div class="ex-options">
      ${options.map(o => `
        <button type="button" class="ex-option ${selected === o.letter ? "selected" : ""}" data-letter="${esc(o.letter)}">
          <span class="ex-letter">${esc(o.letter)}</span>
          <span class="ex-option-text">${o.text ?? ""}</span>
        </button>`).join("")}
    </div>

    <button type="button" id="markReviewBtn" class="ex-review ${isMarked ? "active" : ""}">
      ${ICON.star} ${isMarked ? "চিহ্নিত করা আছে" : "পর্যালোচনার জন্য চিহ্নিত করুন"}
    </button>
  `;
}

/* ---------- small helpers the pages call ---------- */
export function setQuestionCounter(index, total) {
  document.getElementById("qCounter").innerHTML = `প্রশ্ন <b>${index + 1}</b> / ${total}`;
}

export function setProgress(answered, total) {
  document.getElementById("progressFill").style.width = `${total ? Math.round((answered / total) * 100) : 0}%`;
  document.getElementById("progressLabel").textContent = `${answered} / ${total} টি প্রশ্নের উত্তর দেওয়া হয়েছে`;
}

// cells: [{ answered, marked, current }]
export function fillPalette(cells) {
  const answered = cells.filter(c => c.answered).length;
  const marked = cells.filter(c => c.marked).length;
  document.getElementById("paletteSummary").textContent =
    `উত্তরিত ${answered} · বাকি ${cells.length - answered}${marked ? ` · চিহ্নিত ${marked}` : ""}`;
  document.getElementById("paletteGrid").innerHTML = cells.map((c, i) => `
    <button type="button" class="ex-cell ${c.answered ? "answered" : ""} ${c.marked ? "marked" : ""} ${c.current ? "current" : ""}" data-idx="${i}">${i + 1}</button>`).join("");
}

export function submitMessage(unanswered, marked) {
  const parts = [];
  if (unanswered) parts.push(`এখনও ${unanswered}টি প্রশ্নের উত্তর দেওয়া হয়নি।`);
  if (marked) parts.push(`${marked}টি প্রশ্ন পর্যালোচনার জন্য চিহ্নিত আছে।`);
  parts.push("জমা দেওয়ার পরে কোনো উত্তর পরিবর্তন করা যাবে না।");
  return parts.join(" ");
}
