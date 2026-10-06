/* =========================================================
   THEME — dark / light / manual (time-range) mode.
   The first paint is handled by theme-boot.js (classic script in <head>);
   this module adds the settings, the bubble-reveal switch animation and the
   "থিম সেটিংস" bottom sheet. ui-utils.js re-exports initTheme/toggleTheme.
   ========================================================= */

const root = document.documentElement;
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---- helpers (fall back if theme-boot.js is missing on some page) ----
const boot = () => window.__theme;
function ls(k, d) { try { return localStorage.getItem(k) || d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

export function getThemeSettings() {
  if (boot()) return boot().settings();
  const m = ls("themeMode", ls("theme", "light"));
  return { mode: ["light", "dark", "schedule"].includes(m) ? m : "light", from: ls("themeDarkFrom", "19:00"), to: ls("themeDarkTo", "06:00") };
}
const toMin = s => { const [h, m] = String(s).split(":").map(n => parseInt(n, 10)); return (h || 0) * 60 + (m || 0); };
function darkAt(s, d = new Date()) {
  if (boot()) return boot().darkAt(s, d);
  const now = d.getHours() * 60 + d.getMinutes(), a = toMin(s.from), b = toMin(s.to);
  return a === b ? false : a < b ? now >= a && now < b : now >= a || now < b;
}
export function resolveTheme(s = getThemeSettings()) {
  return s.mode === "dark" ? "dark" : s.mode === "schedule" ? (darkAt(s) ? "dark" : "light") : "light";
}

// ---- bengali formatting ----
const BN = "০১২৩৪৫৬৭৮৯";
const bn = v => String(v).replace(/\d/g, d => BN[d]);
export function fmtTime(hhmm) {
  const m = toMin(hhmm), h = Math.floor(m / 60) % 24, mm = m % 60;
  const period = h < 4 ? "রাত" : h < 6 ? "ভোর" : h < 12 ? "সকাল" : h < 15 ? "দুপুর" : h < 18 ? "বিকাল" : h < 19 ? "সন্ধ্যা" : "রাত";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${bn(h12)}:${bn(String(mm).padStart(2, "0"))}`;
}
export function themeStatusText(s = getThemeSettings()) {
  if (s.mode === "schedule") return `ম্যানুয়াল · ${fmtTime(s.from)} – ${fmtTime(s.to)} ডার্ক`;
  return s.mode === "dark" ? "সবসময় ডার্ক" : "সবসময় লাইট";
}

// ---- applying (with the circular "bubble" reveal) ----
function setAttr(theme) {
  root.setAttribute("data-theme", theme);
  try { window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } })); } catch {}
  refreshWidgets();
}

function applyTheme(next, origin) {
  if (root.getAttribute("data-theme") === next) { refreshWidgets(); return; }
  if (!document.startViewTransition || reduceMotion()) { setAttr(next); return; }
  const x = origin?.x ?? innerWidth / 2, y = origin?.y ?? innerHeight / 2;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add("theme-vt");
  let t;
  try { t = document.startViewTransition(() => setAttr(next)); }
  catch { root.classList.remove("theme-vt"); setAttr(next); return; }
  t.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 700, easing: "cubic-bezier(.22,1,.36,1)", pseudoElement: "::view-transition-new(root)" }
    );
  }).catch(() => {});
  t.finished.finally(() => root.classList.remove("theme-vt"));
}

function centerOf(el) {
  if (!el?.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function saveThemeSettings(patch, origin) {
  const cur = getThemeSettings();
  const s = { ...cur, ...patch };
  lsSet("themeMode", s.mode); lsSet("themeDarkFrom", s.from); lsSet("themeDarkTo", s.to);
  lsSet("theme", s.mode === "dark" ? "dark" : "light"); // old key, so older cached pages still agree
  applyTheme(resolveTheme(s), origin);
  refreshWidgets();
  return s;
}

export function initTheme() {
  const t = resolveTheme();
  if (root.getAttribute("data-theme") !== t) root.setAttribute("data-theme", t);
  return t;
}

// Used directly as a click listener on the .theme-toggle buttons (gets the event).
export function toggleTheme(evt) {
  const btn = evt?.currentTarget instanceof Element ? evt.currentTarget : evt?.target?.closest?.(".theme-toggle");
  const next = (root.getAttribute("data-theme") || "light") === "dark" ? "light" : "dark";
  if (btn) {
    btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
    setTimeout(() => btn.classList.remove("pop"), 900);
  }
  try { navigator.vibrate?.(12); } catch {}
  // Tapping the switch makes the choice explicit (it replaces a manual schedule).
  saveThemeSettings({ mode: next }, centerOf(btn));
  return next;
}

// ---- keep every visible switch / label in sync ----
function refreshWidgets() {
  const dark = root.getAttribute("data-theme") === "dark";
  const s = getThemeSettings();
  document.querySelectorAll(".theme-toggle").forEach(b => {
    b.setAttribute("aria-pressed", String(dark));
    b.setAttribute("aria-label", dark ? "লাইট মোডে যাও" : "ডার্ক মোডে যাও");
  });
  document.querySelectorAll("[data-theme-status]").forEach(el => { el.textContent = themeStatusText(s); });
  syncSheet();
}
window.addEventListener("themechange", refreshWidgets);
document.addEventListener("DOMContentLoaded", refreshWidgets);

// =========================================================
// Settings sheet
// =========================================================
let sheet = null;

const ICON = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
};

function barSegments(s) {
  const a = toMin(s.from), b = toMin(s.to), D = 1440, pct = v => (v / D * 100).toFixed(2);
  if (a === b) return "";
  const seg = (from, to) => `<i style="left:${pct(from)}%;width:${pct(to - from)}%"></i>`;
  return a < b ? seg(a, b) : seg(0, b) + seg(a, D);
}

function sheetHTML() {
  return `
  <div class="th-sheet" role="dialog" aria-modal="true" aria-label="থিম সেটিংস">
    <div class="th-grab"></div>
    <div class="th-head">
      <div><h3>থিম সেটিংস</h3><p>কখন ডার্ক, কখন লাইট — তুমি ঠিক করো</p></div>
      <button type="button" class="th-x" aria-label="বন্ধ করো">✕</button>
    </div>

    <div class="th-modes" role="radiogroup">
      <button type="button" class="th-mode" data-mode="light" role="radio"><span class="th-mi">${ICON.sun}</span><b>লাইট</b><small>সবসময়</small></button>
      <button type="button" class="th-mode" data-mode="dark" role="radio"><span class="th-mi">${ICON.moon}</span><b>ডার্ক</b><small>সবসময়</small></button>
      <button type="button" class="th-mode" data-mode="schedule" role="radio"><span class="th-mi">${ICON.clock}</span><b>ম্যানুয়াল</b><small>সময় ধরে</small></button>
    </div>

    <div class="th-sched" id="thSched">
      <div class="th-bar-wrap">
        <div class="th-bar" id="thBar"></div>
        <div class="th-now" id="thNow"></div>
        <div class="th-ticks"><span>১২ রাত</span><span>৬ সকাল</span><span>১২ দুপুর</span><span>৬ সন্ধ্যা</span><span>১২ রাত</span></div>
      </div>
      <div class="th-times">
        <label><span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg> ডার্ক শুরু</span><input type="time" id="thFrom" step="300"></label>
        <label><span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg> লাইট শুরু</span><input type="time" id="thTo" step="300"></label>
      </div>
      <p class="th-sum" id="thSum"></p>
    </div>

    <button type="button" class="th-done">ঠিক আছে</button>
  </div>`;
}

function syncSheet() {
  if (!sheet) return;
  const s = getThemeSettings();
  sheet.querySelectorAll(".th-mode").forEach(b => {
    const on = b.dataset.mode === s.mode;
    b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on));
  });
  const sched = sheet.querySelector("#thSched");
  sched.classList.toggle("open", s.mode === "schedule");
  const f = sheet.querySelector("#thFrom"), t = sheet.querySelector("#thTo");
  if (f.value !== s.from) f.value = s.from;
  if (t.value !== s.to) t.value = s.to;
  sheet.querySelector("#thBar").innerHTML = barSegments(s);
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
  sheet.querySelector("#thNow").style.left = (nm / 1440 * 100).toFixed(2) + "%";
  sheet.querySelector("#thSum").innerHTML = s.from === s.to
    ? "শুরু আর শেষের সময় আলাদা করো।"
    : `<b>${fmtTime(s.from)}</b> থেকে <b>${fmtTime(s.to)}</b> পর্যন্ত <b>ডার্ক</b> · বাকি সময় <b>লাইট</b>`;
}

export function openThemeSheet() {
  if (sheet) return;
  sheet = document.createElement("div");
  sheet.className = "th-ov";
  sheet.innerHTML = sheetHTML();
  document.body.appendChild(sheet);
  document.body.classList.add("th-lock");
  requestAnimationFrame(() => sheet.classList.add("show"));

  const close = () => {
    if (!sheet) return;
    const el = sheet; sheet = null;
    el.classList.remove("show");
    document.body.classList.remove("th-lock");
    setTimeout(() => el.remove(), 320);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  sheet.addEventListener("click", e => { if (e.target === sheet) close(); });
  sheet.querySelector(".th-x").addEventListener("click", close);
  sheet.querySelector(".th-done").addEventListener("click", close);

  sheet.querySelectorAll(".th-mode").forEach(b => b.addEventListener("click", () => {
    b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
    saveThemeSettings({ mode: b.dataset.mode }, centerOf(b));
  }));
  const onTime = () => {
    const f = sheet.querySelector("#thFrom").value, t = sheet.querySelector("#thTo").value;
    if (f && t) saveThemeSettings({ from: f, to: t });
  };
  sheet.querySelector("#thFrom").addEventListener("change", onTime);
  sheet.querySelector("#thTo").addEventListener("change", onTime);
  syncSheet();
}
