/* =========================================================
   TAP BUBBLE — every tap on a button / link / card in the student portal
   pops a soft bubble (same feel as the dark/light switch) instead of the
   browser's default blue tap flash.

   - One pointerdown listener on the document, so it also works for buttons
     that are rendered later (menus, sheets, tab bar ...).
   - The bubble lives in its own fixed layer (never touches the button's
     own layout / overflow), pointer-events: none.
   - Skipped for: disabled controls, inputs, the theme switch (it already has
     its own bigger bubble) and anything marked data-no-bubble.
   - Respects prefers-reduced-motion. If the browser takes the touch over for
     scrolling (pointercancel) the bubble just fades away.
   ========================================================= */

const SELECTOR = [
  "button", "a[href]", "summary", "label[for]",
  "[role=button]", "[role=tab]", "[role=menuitem]", "[role=switch]", "[role=radio]",
  ".btn", ".card--tap", ".hdr-nav-tab", "[data-tap]", "[onclick]"
].join(",");

const SKIP = ".theme-toggle, [data-no-bubble], input, textarea, select, option";

function isStudentPage() {
  try { return /\/student\//.test(location.pathname); } catch { return false; }
}

function init() {
  if (typeof document === "undefined" || window.__tapBubble) return;
  if (!isStudentPage()) return;
  window.__tapBubble = true;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let layer = null;
  let live = null;

  const getLayer = () => {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement("div");
    layer.className = "tap-bubble-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    return layer;
  };

  const drop = el => { if (el && el.parentNode) el.remove(); };

  document.addEventListener("pointerdown", e => {
    if (e.button > 0 || e.isPrimary === false) return;
    if (reduce?.matches) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const el = t.closest(SELECTOR);
    if (!el || el.closest(SKIP) || el.disabled || el.getAttribute("aria-disabled") === "true") return;
    if (!document.body) return;

    const r = el.getBoundingClientRect();
    // small icon buttons get a small bubble, wide cards a bigger (but capped) one
    const d = Math.round(Math.min(150, Math.max(54, Math.max(r.width, r.height) * 0.9)));

    const b = document.createElement("span");
    b.className = "tap-bubble";
    b.style.setProperty("--d", d + "px");
    b.style.left = e.clientX + "px";
    b.style.top = e.clientY + "px";
    getLayer().appendChild(b);
    live = b;
    b.addEventListener("animationend", () => { drop(b); if (live === b) live = null; }, { once: true });
    setTimeout(() => drop(b), 1200); // safety net
  }, { passive: true, capture: true });

  // The browser took the touch for scrolling -> don't leave a bubble hanging.
  document.addEventListener("pointercancel", () => {
    if (!live) return;
    const b = live; live = null;
    b.classList.add("cancel");
    setTimeout(() => drop(b), 160);
  }, { passive: true, capture: true });
}

init();

export const initTapBubble = init;
