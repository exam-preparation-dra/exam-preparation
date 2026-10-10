/* =========================================================
   RUBBER PRESS — every button / option / card behaves like a piece of rubber.
   Press  -> it squashes (a little wider, a little shorter).
   Release-> it springs back with a soft wobble.

   - One pointerdown listener on the document, so it also works for elements
     that are rendered later (menus, sheets, MCQ options, tab bar ...).
   - Big cards squash only a tiny bit, small buttons squash more.
   - No circle / ripple effect (the old tap-bubble was removed).
   - Skipped for: disabled controls, inputs, the theme switch and anything
     marked data-no-rubber. Respects prefers-reduced-motion.
   ========================================================= */

const SELECTOR = [
  "button", "a[href]", "summary", "label[for]",
  "[role=button]", "[role=tab]", "[role=menuitem]", "[role=switch]", "[role=radio]",
  ".btn", ".card--tap", ".hdr-nav-tab", "[data-tap]", "[onclick]",
  ".ex-option", ".ex-cell", ".ex-mode", ".battle-option", ".option-card", ".menu-item"
].join(",");

const SKIP = ".theme-toggle, .hdr-switch, [data-no-rubber], input, textarea, select, option, iframe";

function init() {
  if (typeof document === "undefined" || window.__rubberPress) return;
  window.__rubberPress = true;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let cur = null; // { el, t0, sx, sy }

  const release = (soft) => {
    if (!cur) return;
    const { el, t0, sx, sy } = cur;
    cur = null;
    const wait = Math.max(0, 90 - (performance.now() - t0)); // very quick taps still show the squash
    setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("rb-down");
      el.style.removeProperty("--rbx"); el.style.removeProperty("--rby");
      if (!el.animate) return;
      const dx = sx - 1, dy = 1 - sy;
      const f = (a, b) => ({ transform: `scale(${a.toFixed(4)}, ${b.toFixed(4)})` });
      const frames = soft
        ? [f(sx, sy), { transform: "scale(1, 1)" }]
        : [
            { ...f(sx, sy), easing: "ease-out" },
            { ...f(1 - dx * 0.75, 1 + dy * 0.85), offset: 0.30, easing: "ease-in-out" },
            { ...f(1 + dx * 0.38, 1 - dy * 0.42), offset: 0.55, easing: "ease-in-out" },
            { ...f(1 - dx * 0.14, 1 + dy * 0.14), offset: 0.78, easing: "ease-out" },
            { transform: "scale(1, 1)" }
          ];
      el.animate(frames, { duration: soft ? 180 : 600, easing: "linear" });
    }, wait);
  };

  document.addEventListener("pointerdown", e => {
    if (e.button > 0 || e.isPrimary === false) return;
    if (reduce?.matches) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const el = t.closest(SELECTOR);
    if (!el || el.closest(SKIP) || el.disabled || el.getAttribute("aria-disabled") === "true") return;
    if (getComputedStyle(el).display === "inline") return; // transforms do nothing on inline boxes

    if (cur) release(true);
    const r = el.getBoundingClientRect();
    // small buttons squash more, wide / tall cards only a little
    const sx = 1 + Math.min(0.085, 14 / Math.max(r.width, 1));
    const sy = 1 - Math.min(0.11, 12 / Math.max(r.height, 1));
    el.style.setProperty("--rbx", sx.toFixed(4));
    el.style.setProperty("--rby", sy.toFixed(4));
    el.classList.add("rb-down");
    cur = { el, t0: performance.now(), sx, sy };
  }, { passive: true, capture: true });

  document.addEventListener("pointerup", () => release(false), { passive: true, capture: true });
  // the browser took the touch over for scrolling -> just relax quietly
  document.addEventListener("pointercancel", () => release(true), { passive: true, capture: true });
  window.addEventListener("pagehide", () => { if (cur) { cur.el.classList.remove("rb-down"); cur = null; } });
}

init();

export const initRubberPress = init;
