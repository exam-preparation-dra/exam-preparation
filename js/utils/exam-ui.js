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

// Call after every innerHTML render (theme toggle, day/night picker, eligible list).
export function bindThemeButtons(root = document) {
  root.querySelectorAll("[data-ex-theme]").forEach(btn => {
    btn.addEventListener("click", () => { toggleTheme(); syncThemeColor(); });
  });
  root.querySelectorAll("[data-ex-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      setExamTheme(btn.dataset.exMode);
      root.querySelectorAll("[data-ex-mode]").forEach(b => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-checked", on ? "true" : "false");
      });
    });
  });
  bindEligible(root);
}

/* ---------- day / night mode: chosen once, on the intro screen ---------- */
function currentTheme() { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; }

export function setExamTheme(mode) {
  const m = mode === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", m);
  try { localStorage.setItem("theme", m); } catch (e) { }
  syncThemeColor();
}

function modePickerHtml() {
  const cur = currentTheme();
  const opt = (m, label, sub, icon) => `
    <button type="button" class="ex-mode ${cur === m ? "active" : ""}" data-ex-mode="${m}" role="radio" aria-checked="${cur === m}">
      <span class="ex-mode-ico">${icon}</span>
      <span class="ex-mode-txt"><b>${label}</b><small>${sub}</small></span>
      <span class="ex-mode-tick">${ICON.check}</span>
    </button>`;
  return `
    <section class="ex-card">
      <p class="ex-notes-title">${ICON.sun} পরীক্ষা কোন মোডে দেবে?</p>
      <p class="ex-sheet-sub" style="margin:0;">শুরু করার আগে বেছে নাও — পরীক্ষা চলার সময় মোড বদলানো যাবে না।</p>
      <div class="ex-modes" role="radiogroup" aria-label="ডে বা নাইট মোড">
        ${opt("light", "ডে মোড", "উজ্জ্বল ব্যাকগ্রাউন্ড", ICON.sun)}
        ${opt("dark", "নাইট মোড", "চোখের আরামের জন্য", ICON.moon)}
      </div>
    </section>`;
}

/* ---------- "who is eligible for this exam" list ----------
   The page loads the students and calls setEligibleData({ students, scope, meId }).
   Every [data-elig-list] on screen (intro dropdown + in-exam popover) is filled from it. */
let eligData = null;
export function setEligibleData(data) { eligData = data; paintEligible(); }

function eligListHtml() {
  if (!eligData) return `<p class="ex-elig-empty">লোড হচ্ছে...</p>`;
  if (eligData.error) return `<p class="ex-elig-empty">তালিকা লোড করা যায়নি।</p>`;
  const { students = [], scope = "", meId = "" } = eligData;
  if (!students.length) return `<p class="ex-elig-empty">কোনো শিক্ষার্থী পাওয়া যায়নি।</p>`;
  return `<p class="ex-elig-scope">${esc(scope)} · মোট ${students.length} জন</p>
    <ul class="ex-elig-ul">${students.map(st => {
      const me = st.studentId === meId;
      return `<li class="${me ? "me" : ""}"><span class="ex-elig-av">${esc(String(st.name || "?").trim().charAt(0))}</span><span class="ex-elig-name">${esc(st.name)}</span>${me ? "<em>আপনি</em>" : `<small>${esc(st.studentId)}</small>`}</li>`;
    }).join("")}</ul>`;
}

function paintEligible() {
  document.querySelectorAll("[data-elig-list]").forEach(el => { el.innerHTML = eligListHtml(); });
  const n = eligData && !eligData.error && eligData.students ? eligData.students.length : "";
  document.querySelectorAll("[data-elig-count]").forEach(el => { el.textContent = n; });
}

let eligDocBound = false;
function bindEligible(root) {
  root.querySelectorAll("[data-elig-toggle]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const target = document.getElementById(btn.dataset.eligToggle);
      if (!target) return;
      const open = target.classList.contains("hidden");
      target.classList.toggle("hidden", !open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
  if (!eligDocBound) {
    eligDocBound = true;
    const closePop = () => {
      const pop = document.getElementById("eligPop");
      if (pop) pop.classList.add("hidden");
      document.querySelectorAll('[data-elig-toggle="eligPop"]').forEach(b => b.setAttribute("aria-expanded", "false"));
    };
    document.addEventListener("click", e => { if (!e.target.closest("#eligPop")) closePop(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closePop(); });
  }
  paintEligible();
}

const ICON = {
  back: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>`,
  next: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>`,
  grid: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
  close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  warn: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  star: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  card: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>`,
  bulb: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.45.9 1.15.9 1.9V16h5.4v-.3c0-.75.3-1.45.9-1.9A6 6 0 0 0 12 3z"/></svg>`,
  clock: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  users: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  chev: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
  sun: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  moon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`
};

/* ---------- intro screen ---------- */
// stats: [{label, value}]   facts / notes: html strings (already escaped where needed)
export function introHtml({ backHref, title, name, description, stats = [], facts = [], notes = [], startLabel, showMode = true, showEligible = false }) {
  return `
    <header class="ex-topbar"><div class="ex-topbar-in">
      <a href="${esc(backHref)}" class="ex-icon-btn" aria-label="ফিরে যান">${ICON.back}</a>
      <h2 class="ex-page-title">${esc(title)}</h2>
      <span class="ex-spacer" aria-hidden="true"></span>
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

      ${showMode ? modePickerHtml() : ""}

      ${showEligible ? `
      <section class="ex-card ex-elig-card">
        <button type="button" class="ex-elig-head" data-elig-toggle="eligIntro" aria-expanded="false">
          <span class="ex-elig-ico">${ICON.users}</span>
          <span class="ex-elig-title"><b>কারা এই পরীক্ষা দিচ্ছে</b><small>ট্যাপ করে নামের তালিকা দেখো</small></span>
          <span class="ex-elig-count" data-elig-count></span>
          <span class="ex-elig-chev">${ICON.chev}</span>
        </button>
        <div id="eligIntro" class="ex-elig-body hidden"><div class="ex-elig-scroll" data-elig-list></div></div>
      </section>` : ""}

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
export function runShellHtml({ name, photoURL, total, showCardBtn = false, showEligible = false }) {
  const initial = esc(String(name || "?").trim().charAt(0));
  return `
    <header class="ex-topbar">
      <div class="ex-topbar-in ex-run">
        <div class="ex-user">
          ${photoURL ? `<img class="ex-avatar" src="${esc(photoURL)}" alt="">` : `<div class="ex-avatar">${initial}</div>`}
          <span class="ex-user-name">${esc(name)}</span>
        </div>

        <div class="ex-timer" role="timer">
          <span class="ex-timer-ico">${ICON.clock}</span>
          <div class="ex-timer-txt"><small>বাকি সময়</small><span id="timerDisplay">--:--</span></div>
        </div>

        <div class="ex-actions">
          ${showEligible ? `<button type="button" class="ex-tool-btn" data-elig-toggle="eligPop" aria-expanded="false" aria-label="কারা পরীক্ষা দিচ্ছে">${ICON.users}<span class="ex-tool-lbl">কারা দিচ্ছে</span><span class="ex-tool-count" data-elig-count></span></button>` : ""}
          ${showCardBtn ? `<button id="useCardBtn" class="ex-tool-btn ex-card-btn" type="button" aria-label="টাইম কার্ড ব্যবহার করো">${ICON.card}<span class="ex-tool-lbl">টাইম কার্ড</span><span id="cardBadge" class="ex-card-badge hidden">0</span></button>` : ""}
          <button id="submitBtn" class="ex-submit" type="button">জমা দিন</button>
        </div>
      </div>
      ${showEligible ? `
      <div id="eligPop" class="ex-pop hidden">
        <div class="ex-pop-head"><p class="ex-pop-title">কারা এই পরীক্ষা দিচ্ছে</p></div>
        <div class="ex-elig-scroll" data-elig-list></div>
      </div>` : ""}
    </header>

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
    ${hintModalHtml()}
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

/* ---------- "use a hint card" confirm sheet (shown when useHintBtn is tapped) ---------- */
function hintModalHtml() {
  return `
    <div id="hintModal" class="ex-overlay hidden">
      <div class="ex-sheet ex-confirm">
        <div class="ex-confirm-icon accent">${ICON.bulb}</div>
        <p class="ex-sheet-title">হিন্ট কার্ড ব্যবহার করবে?</p>
        <p class="msg" id="hintModalText"></p>
        <div class="ex-confirm-actions">
          <button class="ex-btn ex-btn-ghost" id="cancelHintBtn" type="button">বাতিল</button>
          <button class="ex-btn ex-btn-primary" id="confirmHintBtn" type="button">হ্যাঁ, দেখাও</button>
        </div>
      </div>
    </div>`;
}

/* ---------- hint zone shown under a question's options ----------
   hint: {
     enabled          -- false if there's no hint_card item in the catalog at all
     used             -- true once this question's hint has been revealed
     canUse           -- true if a card can be used right now on this question
     subtitle         -- pre-composed availability text (exam.html knows the counts)
     correctLetter, correctText, explanation -- only needed once used
   } ---------- */
export function hintZoneHtml(hint) {
  if (!hint || !hint.enabled) return "";
  if (hint.used) {
    return `
    <div class="ex-hint-reveal">
      <div class="ex-hint-reveal-head">${ICON.check} <span>হিন্ট কার্ড ব্যবহার করা হয়েছে</span></div>
      <p class="ex-hint-answer"><b>সঠিক উত্তর:</b> ${esc(hint.correctLetter ?? "")}) ${hint.correctText ?? ""}</p>
      ${hint.explanation
        ? `<p class="ex-hint-explanation">${hint.explanation}</p>`
        : `<p class="ex-hint-explanation text-muted">এই প্রশ্নের জন্য কোনো ব্যাখ্যা যোগ করা নেই।</p>`}
    </div>`;
  }
  return `
    <button type="button" id="useHintBtn" class="ex-hint-cta" ${hint.canUse ? "" : "disabled"}>
      <span class="ex-hint-cta-icon">${ICON.bulb}</span>
      <span class="ex-hint-cta-text">
        <span class="ex-hint-cta-title">হিন্ট কার্ড ব্যবহার করো</span>
        <span class="ex-hint-cta-sub">${esc(hint.subtitle ?? "")}</span>
      </span>
    </button>`;
}

/* ---------- one question ---------- */
// questionBn / questionEn / option text are admin-authored (may contain math or
// HTML) and are inserted as-is, exactly like before.
export function questionHtml({ questionBn, questionEn, imageUrl, options, selected, isMarked, hint = null }) {
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

    <div id="hintZone">${hintZoneHtml(hint)}</div>

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
