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
