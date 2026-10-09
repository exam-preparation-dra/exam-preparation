/* =========================================================
   THEME BOOT — classic script, loaded in <head> of EVERY page.
   Applies the saved theme before first paint (no light flash in dark mode)
   and keeps it right afterwards, independent of any module loading — so a
   page that fails to load ui-utils.js still has the correct theme.

   Saved settings (localStorage):
     themeMode      "light" | "dark" | "schedule"   (old key "theme" is still read)
     themeDarkFrom  "HH:MM"  dark starts   (default 19:00)   — schedule mode
     themeDarkTo    "HH:MM"  dark ends     (default 06:00)   — schedule mode
   In schedule mode the page is dark between From and To (overnight ranges
   work) and light the rest of the day; it flips by itself while the page is open.

   window.__theme exposes the helpers to js/utils/theme.js.
   ========================================================= */
(function () {
  var root = document.documentElement;

  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }

  function settings() {
    var m = get("themeMode", "");
    if (m !== "light" && m !== "dark" && m !== "schedule") m = get("theme", "light") === "dark" ? "dark" : "light";
    return { mode: m, from: get("themeDarkFrom", "19:00"), to: get("themeDarkTo", "06:00") };
  }

  function toMin(s) {
    var p = String(s).split(":");
    var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  }

  function darkAt(s, date) {
    var d = date || new Date();
    var now = d.getHours() * 60 + d.getMinutes();
    var a = toMin(s.from), b = toMin(s.to);
    if (a === b) return false;
    return a < b ? (now >= a && now < b) : (now >= a || now < b);
  }

  function resolve(s) {
    s = s || settings();
    if (s.mode === "dark") return "dark";
    if (s.mode === "schedule") return darkAt(s) ? "dark" : "light";
    return "light";
  }

  function paint(theme) {
    if (root.getAttribute("data-theme") !== theme) root.setAttribute("data-theme", theme);
  }

  window.__theme = { settings: settings, resolve: resolve, darkAt: darkAt, toMin: toMin, paint: paint };

  paint(resolve());
  try { if (/\/admin\//.test(location.pathname) && !/\/admin\/(index\.html)?$/.test(location.pathname)) root.classList.add("is-admin"); } catch (e) {}

  // Schedule mode: flip on time (checked every 20s and when the tab/app comes back).
  function tick() {
    if (settings().mode !== "schedule") return;
    var t = resolve();
    if (root.getAttribute("data-theme") !== t) {
      paint(t);
      try { window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: t } })); } catch (e) {}
    }
  }
  setInterval(tick, 20000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });

  // Another tab changed the setting -> follow it.
  window.addEventListener("storage", function (e) {
    if (e.key && e.key.indexOf("theme") !== 0) return;
    paint(resolve());
    try { window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: resolve() } })); } catch (er) {}
  });
})();


/* =========================================================
   BUBBLE FX — jelly squash + ripple bubble on every button / tab / option.
   Pure decoration: never touches the clicked element's own children
   (the ripple lives in its own absolutely-positioned layer), never
   blocks the click, and is skipped for reduced-motion users.
   CSS half: "BUBBLE MOTION" block at the end of css/style.css.
   ========================================================= */
(function () {
  var SEL = 'button, .btn, [role="button"], .btn-glass, .pf-btn, .lx-btn, .cx-btn, .ex-btn, .ex-icon-btn, .ex-tool-btn, .ex-qty-btn, .btn-outline, .btn-premium, .secondary-action, .primary-action, .pw-btn, .iac-btn, .tab-btn, .pf-tab, .pf-chip, .chip, .cal-chip, .cal-btn, .lx-h-chip, .d-btn, .d-chip, .rq-chip, .ivs-btn, .game-btn, .store-qty-btn, .row-btn, .bulk-action-btn, .btn-submit, .toggle-btn, .delete-btn, .edit-btn, .dup-btn, .remove-btn, .view-btn, .close-modal-btn, .close-guide-btn, .btn-modal, .btn-action, .entry-btn, .action-icon, .global-notification-btn, .up-btn, .jb, .cal-cell, .hdr-nav-tab, .ex-option, .review-option, .review-filter-chip, .battle-option, .lg-tabs a, .lg-back, .card--tap, details.faq > summary';
  var SKIP = '.theme-toggle, .fx-no, input, select, textarea';
  var calm = false;
  try { calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  if (calm) return;

  document.addEventListener("pointerdown", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var h = t.closest(SEL);
    if (!h || h.disabled || h.closest(SKIP) === h) return;
    var cs = window.getComputedStyle(h);
    if (cs.display === "inline" || cs.display === "contents") return;

    var r = h.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (cs.position === "static") h.style.position = "relative";

    var clip = h.querySelector(":scope > .fx-clip");
    if (!clip) {
      clip = document.createElement("span");
      clip.className = "fx-clip";
      clip.setAttribute("aria-hidden", "true");
      h.insertBefore(clip, h.firstChild);
    }
    var d = Math.max(r.width, r.height) * 2;
    var s = document.createElement("span");
    s.className = "fx-ripple";
    s.style.width = s.style.height = d + "px";
    s.style.left = (e.clientX - r.left - d / 2) + "px";
    s.style.top = (e.clientY - r.top - d / 2) + "px";
    clip.appendChild(s);
    setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 700);

    h.classList.remove("fx-pop");
    void h.offsetWidth;                       // restart the animation on rapid taps
    h.classList.add("fx-pop");
    setTimeout(function () { h.classList.remove("fx-pop"); }, 600);
  }, { passive: true });
})();
