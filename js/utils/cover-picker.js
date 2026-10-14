/* =========================================================
   COVER THEMES — the coloured banner on top of a student's profile.

   theme = { c: colour index (-1 = follow my stage colour), p: pattern index, a: 0|1 }
   a = 1 also puts a soft glow of that colour behind the whole page.

   applyCover(heroEl, theme, stageColor)  -> sets the CSS variables + pattern class
   openCoverPicker({ theme, stageColor, onPick }) -> bottom sheet, onPick(theme) is awaited

   No Firebase in here: profile.html saves the theme (studentPrivacy/{id}.coverTheme),
   so friends see the same cover when they open the profile.
   ========================================================= */

export const COVERS = [
  { n: "সোনালি", a: "#b8863c", b: "#e6c27a" },
  { n: "নীল", a: "#2f6df6", b: "#8fb4ff" },
  { n: "সবুজ", a: "#1f9d6a", b: "#8fe0b8" },
  { n: "গোলাপি", a: "#e0457b", b: "#ff9fbf" },
  { n: "বেগুনি", a: "#7c5cff", b: "#c4b5ff" },
  { n: "কমলা", a: "#f07a1a", b: "#ffc08a" },
  { n: "টিল", a: "#12a8a0", b: "#8cece4" },
  { n: "লাল", a: "#d6453d", b: "#ff9d96" },
  { n: "নেভি", a: "#1e3a6e", b: "#5b7fc4" },
  { n: "কালো", a: "#15171c", b: "#4a4f5c" },
  { n: "সূর্যাস্ত", a: "#e0457b", b: "#f9a03f" },
  { n: "অরোরা", a: "#12a8a0", b: "#7c5cff" },
  { n: "সাগর", a: "#1f5fd6", b: "#22c3d6" },
  { n: "বন", a: "#1b7a4b", b: "#a3d977" },
  { n: "ল্যাভেন্ডার", a: "#8e7cc3", b: "#e3d9ff" },
  { n: "চকোলেট", a: "#6b3f26", b: "#c28a5a" }
];
export const PATTERNS = ["গ্রিড", "ডট", "ঢেউ", "ডোরা", "হেক্সাগন", "তারা", "বৃত্ত", "সাদামাটা"];
export const DEFAULT_COVER = { c: 0, p: 0, a: 0 };

export function cleanTheme(t) {
  const c = Number.isInteger(t?.c) && t.c >= -1 && t.c < COVERS.length ? t.c : 0;
  const p = Number.isInteger(t?.p) && t.p >= 0 && t.p < PATTERNS.length ? t.p : 0;
  return { c, p, a: t?.a ? 1 : 0 };
}

const hexMix = (hex, amt) => {   // amt>0 lighter, <0 darker
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, "0")).join("");
};
export function coverColors(theme, stageColor = "#b8863c") {
  const t = cleanTheme(theme);
  if (t.c === -1) return { a: stageColor, b: hexMix(stageColor, 0.45) };
  return { a: COVERS[t.c].a, b: COVERS[t.c].b };
}

/* ---------------- CSS (patterns + sheet), injected once ---------------- */
const svgUri = s => `url("data:image/svg+xml;utf8,${s.replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E")}")`;
const HEX = svgUri(`<svg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'><path d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z' fill='white' fill-opacity='.38'/></svg>`);
const WAVE = svgUri(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='26' viewBox='0 0 120 26'><path d='M0 13Q15 1 30 13T60 13T90 13T120 13' fill='none' stroke='white' stroke-opacity='.4' stroke-width='1.6'/></svg>`);
const STAR = svgUri(`<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 90 90'><g fill='white'><path fill-opacity='.7' d='M20 14l1.6 3.8 3.8 1.6-3.8 1.6L20 24.8l-1.6-3.8-3.8-1.6 3.8-1.6z'/><path fill-opacity='.45' d='M66 40l1.2 2.8 2.8 1.2-2.8 1.2L66 48l-1.2-2.8-2.8-1.2 2.8-1.2z'/><circle cx='48' cy='12' r='1.3' fill-opacity='.6'/><circle cx='12' cy='62' r='1.5' fill-opacity='.5'/><circle cx='74' cy='78' r='1.2' fill-opacity='.6'/><path fill-opacity='.4' d='M40 70l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z'/></g></svg>`);

const CSS = `
.pf-cv-grid{background-repeat:repeat}
.pf-cv-grid.pt0{background-image:linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px);background-size:22px 22px}
.pf-cv-grid.pt1{background-image:radial-gradient(circle,rgba(255,255,255,.6) 1.6px,transparent 2.2px);background-size:18px 18px}
.pf-cv-grid.pt2{background-image:${WAVE};background-size:120px 26px}
.pf-cv-grid.pt3{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.3) 0 2px,transparent 2px 14px)}
.pf-cv-grid.pt4{background-image:${HEX};background-size:28px 49px}
.pf-cv-grid.pt5{background-image:${STAR};background-size:90px 90px}
.pf-cv-grid.pt6{background-image:repeating-radial-gradient(circle at 82% 18%,transparent 0 13px,rgba(255,255,255,.32) 13px 14.6px),repeating-radial-gradient(circle at 10% 100%,transparent 0 13px,rgba(255,255,255,.2) 13px 14.4px)}
.pf-cv-grid.pt7{background-image:none}
#pfAmbient{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity .5s ease}
#pfAmbient.on{opacity:1}
.cvp{position:fixed;inset:0;z-index:10050;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55);animation:cvpIn .2s ease}
.cvp-card{display:flex;flex-direction:column;width:min(480px,100%);max-height:92dvh;border-radius:26px 26px 0 0;background:var(--surface-solid,var(--surface,#fff));color:var(--text-primary,#222);animation:cvpUp .28s cubic-bezier(.2,.9,.3,1);overflow:hidden}
@media(min-width:560px){.cvp{align-items:center}.cvp-card{border-radius:26px}}
.cvp-body{flex:1;min-height:0;overflow:auto;padding:16px}
.cvp-body h3{margin:0 0 2px;font-size:1.08rem;font-weight:900}
.cvp-body p.sub{margin:0 0 12px;font-size:.78rem;font-weight:700;color:var(--text-secondary,#666)}
.cvp-prev{position:relative;height:104px;border-radius:22px;overflow:hidden;box-shadow:0 10px 26px rgba(0,0,0,.25)}
.cvp-prev .bg{position:absolute;inset:0}
.cvp-prev .pf-cv-grid{position:absolute;inset:0;-webkit-mask-image:linear-gradient(180deg,#000,transparent 92%);mask-image:linear-gradient(180deg,#000,transparent 92%)}
.cvp-prev b{position:absolute;left:14px;bottom:10px;padding:5px 11px;border-radius:99px;font-size:.72rem;font-weight:800;color:#fff;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.25)}
.cvp-l{margin:16px 2px 8px;font-size:.78rem;font-weight:900;color:var(--text-secondary,#666)}
.cvp-sw{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
.cvp-c{position:relative;aspect-ratio:1;border-radius:50%;border:3px solid transparent;padding:0;cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.12) inset,0 3px 8px rgba(0,0,0,.18)}
.cvp-c.sel{border-color:var(--surface-solid,#fff);outline:3px solid var(--color-accent,#b8863c)}
.cvp-c.auto{display:grid;place-items:center;font-size:.58rem;font-weight:900;color:#fff;line-height:1.1;text-align:center}
.cvp-pt{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.cvp-p{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer}
.cvp-p .t{position:relative;width:100%;aspect-ratio:1.5;border-radius:16px;overflow:hidden;border:3px solid transparent;box-shadow:0 3px 10px rgba(0,0,0,.14)}
.cvp-p .t .pf-cv-grid{position:absolute;inset:0}
.cvp-p.sel .t{border-color:var(--color-accent,#b8863c)}
.cvp-p small{font-size:.66rem;font-weight:800;color:var(--text-secondary,#666)}
.cvp-tog{display:flex;align-items:center;gap:12px;width:100%;margin-top:16px;padding:14px;border-radius:16px;border:1px solid var(--surface-border,#ddd);background:var(--surface,#fff);color:inherit;font:inherit;text-align:left;cursor:pointer}
.cvp-tog b{display:block;font-size:.86rem;font-weight:800}
.cvp-tog .d{display:block;margin-top:2px;font-size:.72rem;font-weight:700;color:var(--text-muted,#888)}
.cvp-sw2{flex:none;position:relative;width:46px;height:27px;border-radius:99px;background:rgba(128,128,128,.4);transition:background .2s}
.cvp-sw2::after{content:"";position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3);transition:transform .25s cubic-bezier(.34,1.56,.64,1)}
.cvp-tog.on .cvp-sw2{background:var(--color-accent,#b8863c)}
.cvp-tog.on .cvp-sw2::after{transform:translateX(19px)}
.cvp-foot{flex:none;padding:10px 16px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--surface-border,#ddd)}
.cvp-err{min-height:16px;margin:0 0 8px;font-size:.78rem;font-weight:800;color:#ef4444}
.cvp-row{display:flex;gap:10px}
.cvp-row button{flex:1;padding:13px;border-radius:14px;font:inherit;font-weight:900;font-size:.88rem;cursor:pointer;border:1px solid var(--surface-border,#ddd);background:rgba(128,128,128,.08);color:inherit}
.cvp-row .pri{background:var(--color-accent,#b8863c);border-color:transparent;color:#fff;flex:1.6}
.cvp-row button:disabled{opacity:.5;pointer-events:none}
@keyframes cvpIn{from{opacity:0}to{opacity:1}}
@keyframes cvpUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
`;
function ensureCss() {
  if (document.getElementById("cvp-style")) return;
  const st = document.createElement("style");
  st.id = "cvp-style"; st.textContent = CSS;
  document.head.appendChild(st);
}

/* ---------------- apply to the page ---------------- */
export function applyCover(heroEl, theme, stageColor) {
  ensureCss();
  const t = cleanTheme(theme), c = coverColors(t, stageColor);
  if (heroEl) {
    heroEl.style.setProperty("--cv", c.a);
    heroEl.style.setProperty("--cv2", c.b);
    const g = heroEl.querySelector(".pf-cv-grid");
    if (g) g.className = `pf-cv-grid pt${t.p}`;
  }
  let amb = document.getElementById("pfAmbient");
  if (t.a) {
    if (!amb) { amb = document.createElement("div"); amb.id = "pfAmbient"; document.body.prepend(amb); }
    amb.style.background = `radial-gradient(60% 38% at 12% 0%, ${c.a}55, transparent 70%), radial-gradient(55% 34% at 100% 22%, ${c.b}38, transparent 70%), radial-gradient(70% 40% at 50% 100%, ${c.a}30, transparent 70%)`;
    requestAnimationFrame(() => amb.classList.add("on"));
  } else if (amb) amb.classList.remove("on");
}

/* ---------------- picker sheet ---------------- */
export function openCoverPicker({ theme, stageColor = "#b8863c", onPick, title = "কভারের রঙ ও ডিজাইন" } = {}) {
  ensureCss();
  document.getElementById("cvp")?.remove();
  let t = cleanTheme(theme);
  const root = document.createElement("div");
  root.id = "cvp"; root.className = "cvp"; root.setAttribute("role", "dialog");
  root.innerHTML = `<div class="cvp-card"><div class="cvp-body" id="cvpBody"></div>
    <div class="cvp-foot"><p class="cvp-err" id="cvpErr"></p>
      <div class="cvp-row"><button type="button" id="cvpReset">ডিফল্ট</button><button type="button" class="pri" id="cvpSave">সেভ করো</button></div></div></div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const close = () => { root.remove(); applyBack(); };
  const original = cleanTheme(theme);
  let saved = false;
  const applyBack = () => { if (!saved && onPreview) onPreview(original); };
  let onPreview = null;

  function bg(c) { return `linear-gradient(135deg,${c.a},${c.b})`; }
  function render() {
    const cur = coverColors(t, stageColor);
    $("#cvpBody").innerHTML = `
      <h3>${title}</h3><p class="sub">তোমার প্রোফাইলের ওপরের ব্যানার সাজাও — বন্ধুরাও এটা দেখবে।</p>
      <div class="cvp-prev"><div class="bg" style="background:${bg(cur)}"></div><span class="pf-cv-grid pt${t.p}"></span><b>${t.c === -1 ? "স্টেজের রঙ" : COVERS[t.c].n} · ${PATTERNS[t.p]}</b></div>
      <div class="cvp-l">রঙ</div>
      <div class="cvp-sw">
        <button type="button" class="cvp-c auto ${t.c === -1 ? "sel" : ""}" data-c="-1" style="background:${bg({ a: stageColor, b: hexMix(stageColor, .45) })}" aria-label="স্টেজের রঙ">অটো</button>
        ${COVERS.map((c, i) => `<button type="button" class="cvp-c ${t.c === i ? "sel" : ""}" data-c="${i}" style="background:${bg(c)}" aria-label="${c.n}"></button>`).join("")}
      </div>
      <div class="cvp-l">ডিজাইন</div>
      <div class="cvp-pt">${PATTERNS.map((n, i) => `<button type="button" class="cvp-p ${t.p === i ? "sel" : ""}" data-p="${i}"><span class="t" style="background:${bg(cur)}"><span class="pf-cv-grid pt${i}"></span></span><small>${n}</small></button>`).join("")}</div>
      <button type="button" class="cvp-tog ${t.a ? "on" : ""}" data-a="1"><span style="flex:1"><b>পুরো পেজে রঙের আভা</b><span class="d">কভারের রঙ পেজের ব্যাকগ্রাউন্ডেও হালকা করে ছড়াবে</span></span><span class="cvp-sw2"></span></button>`;
    if (onPreview) onPreview(t);
  }

  root.addEventListener("click", async e => {
    if (e.target === root) return close();
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.c !== undefined) { t = { ...t, c: +b.dataset.c }; render(); }
    else if (b.dataset.p !== undefined) { t = { ...t, p: +b.dataset.p }; render(); }
    else if (b.dataset.a) { t = { ...t, a: t.a ? 0 : 1 }; render(); }
    else if (b.id === "cvpReset") { t = { ...DEFAULT_COVER }; render(); }
    else if (b.id === "cvpSave") {
      $("#cvpErr").textContent = "";
      root.querySelectorAll("button").forEach(x => x.disabled = true);
      try { await onPick(cleanTheme(t)); saved = true; root.remove(); }
      catch (err) { console.error(err); $("#cvpErr").textContent = "সেভ করা যায়নি। আবার চেষ্টা করো।"; root.querySelectorAll("button").forEach(x => x.disabled = false); }
    }
  });
  const api = { onPreview(fn) { onPreview = fn; fn(t); } };
  render();
  return api;
}
