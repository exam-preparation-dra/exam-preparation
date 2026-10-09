/* =========================================================
   Pending-exam alert (student dashboard).
   showPendingExamAlert({ student, exam, examUrl })
   Pops up every time the page is opened while an exam is still not taken.
   Shows the student's name BIG, today's early-bird bonus, the 7-day bonus
   ladder, and (last 2 days) an extra red warning about the XP penalty.
   No emoji: every icon is inline SVG. Uses the site's CSS variables.
   ========================================================= */
import { EXAM_BONUS, getEarlyBonus, getExamWindow } from "./xp-utils.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bn = n => Number(n).toLocaleString("bn-BD");

const ICON = {
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>'
};
const svg = (n, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

function injectStyles() {
  if (document.getElementById("peaStyles")) return;
  const st = document.createElement("style");
  st.id = "peaStyles";
  st.textContent = `
    .pea-back { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 18px;
      background: rgba(10,12,16,.58); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: peaFade .35s ease both; }
    .pea-back.out { animation: peaFadeOut .25s ease both; }
    .pea-card { --pea: var(--color-accent,#8f82ff); position: relative; width: min(100%, 400px); overflow: hidden;
      background: var(--surface-solid,#fff); color: var(--text-primary,#21262f); border-radius: 26px; padding: 26px 20px 20px; text-align: center;
      border: 1px solid var(--surface-border,rgba(128,128,128,.22)); box-shadow: 0 30px 70px rgba(0,0,0,.35);
      animation: peaPop .6s cubic-bezier(.2,1.2,.3,1) both; }
    .pea-card.urgent { --pea: var(--color-danger,#a6402f); animation: peaPop .6s cubic-bezier(.2,1.2,.3,1) both, peaShake .6s .7s ease-in-out 1; }
    .pea-card::before { content: ""; position: absolute; inset: -45% -25% auto -25%; height: 85%;
      background: radial-gradient(closest-side, color-mix(in srgb, var(--pea) 22%, transparent), transparent 72%); pointer-events: none; }
    .pea-card > * { position: relative; }
    .pea-x { position: absolute !important; top: 10px; right: 10px; width: 34px; height: 34px; border: 0; border-radius: 50%; display: grid; place-items: center;
      background: transparent; color: var(--text-muted,#8a8f98); cursor: pointer; }
    .pea-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 99px; font-size: .74rem; font-weight: 900;
      color: var(--pea); background: color-mix(in srgb, var(--pea) 14%, transparent); animation: peaPulse 1.8s ease-in-out infinite; }
    .pea-name { margin: 14px 0 2px; font-size: clamp(1.9rem, 9vw, 2.5rem); font-weight: 900; line-height: 1.12; letter-spacing: -.01em;
      background: linear-gradient(100deg, var(--text-primary,#21262f) 20%, var(--pea) 50%, var(--text-primary,#21262f) 80%); background-size: 220% 100%;
      -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; animation: peaShine 3.4s linear infinite; word-break: break-word; }
    .pea-msg { margin: 6px 0 0; font-size: .95rem; font-weight: 800; line-height: 1.5; }
    .pea-exam { margin: 8px auto 0; display: inline-block; max-width: 100%; padding: 6px 14px; border-radius: 12px; font-size: .82rem; font-weight: 800;
      background: color-mix(in srgb, var(--pea) 10%, transparent); color: var(--pea); }
    .pea-bonus { margin: 16px 0 4px; }
    .pea-bonus small { display: block; font-size: .72rem; font-weight: 700; color: var(--text-muted,#8a8f98); }
    .pea-num { display: inline-flex; align-items: center; gap: 6px; font-size: 2.6rem; font-weight: 900; color: var(--pea); line-height: 1.1; font-variant-numeric: tabular-nums; }
    .pea-num svg { animation: peaBolt 1.4s ease-in-out infinite; }
    .pea-ladder { display: flex; gap: 5px; margin: 14px 0 4px; }
    .pea-step { flex: 1; min-width: 0; padding: 7px 0 6px; border-radius: 11px; font-size: .66rem; font-weight: 800; color: var(--text-muted,#8a8f98);
      background: color-mix(in srgb, var(--text-primary,#21262f) 6%, transparent); animation: peaRise .5s ease both; }
    .pea-step b { display: block; font-size: .78rem; font-weight: 900; }
    .pea-step.past { opacity: .4; text-decoration: line-through; }
    .pea-step.now { color: #fff; background: var(--pea); transform: scale(1.08); box-shadow: 0 8px 18px color-mix(in srgb, var(--pea) 40%, transparent); }
    .pea-warn { display: flex; align-items: flex-start; gap: 8px; margin: 12px 0 0; padding: 10px 12px; border-radius: 14px; text-align: left; font-size: .8rem; font-weight: 800; line-height: 1.5;
      color: var(--color-danger,#a6402f); background: color-mix(in srgb, var(--color-danger,#a6402f) 11%, transparent); animation: peaPulse 1.6s ease-in-out infinite; }
    .pea-warn svg { flex: 0 0 auto; margin-top: 2px; }
    .pea-go { display: block; margin-top: 16px; min-height: 50px; line-height: 50px; border-radius: 15px; font-weight: 900; font-size: .95rem; text-decoration: none; color: #fff;
      background: var(--pea); box-shadow: 0 10px 22px color-mix(in srgb, var(--pea) 35%, transparent); position: relative; overflow: hidden; }
    .pea-go::after { content: ""; position: absolute; top: 0; left: -60%; width: 40%; height: 100%;
      background: linear-gradient(100deg, transparent, rgba(255,255,255,.4), transparent); animation: peaSweep 2.6s ease-in-out infinite; }
    .pea-later { margin-top: 8px; width: 100%; min-height: 40px; border: 0; background: transparent; color: var(--text-muted,#8a8f98); font-weight: 800; font-size: .82rem; cursor: pointer; }
    @keyframes peaFade { from { opacity: 0 } to { opacity: 1 } }
    @keyframes peaFadeOut { to { opacity: 0 } }
    @keyframes peaPop { from { transform: translateY(30px) scale(.86); opacity: 0 } to { transform: none; opacity: 1 } }
    @keyframes peaShake { 0%,100% { transform: none } 20% { transform: translateX(-6px) } 40% { transform: translateX(6px) } 60% { transform: translateX(-4px) } 80% { transform: translateX(3px) } }
    @keyframes peaPulse { 0%,100% { opacity: 1 } 50% { opacity: .72 } }
    @keyframes peaShine { to { background-position: -220% 0 } }
    @keyframes peaBolt { 0%,100% { transform: scale(1) } 50% { transform: scale(1.18) rotate(-6deg) } }
    @keyframes peaRise { from { transform: translateY(10px); opacity: 0 } to { transform: none; opacity: 1 } }
    @keyframes peaSweep { 0% { left: -60% } 60%,100% { left: 130% } }
    @media (prefers-reduced-motion: reduce) { .pea-back, .pea-card, .pea-badge, .pea-name, .pea-num svg, .pea-step, .pea-warn, .pea-go::after { animation: none !important; } }
  `;
  document.head.appendChild(st);
}

let shownThisLoad = false;

export function showPendingExamAlert({ student, exam, examUrl } = {}) {
  if (shownThisLoad || !student || !exam) return;
  const win = getExamWindow(exam);
  if (!win) return;
  const now = Date.now();
  const eb = getEarlyBonus(exam, now);
  const daysLeft = Math.max(1, Math.ceil((win.endMs - now) / 86400000));
  const urgent = daysLeft <= 2;
  shownThisLoad = true;
  injectStyles();

  const days = EXAM_BONUS.days;
  const ladder = eb ? days.map((v, i) => {
    const cls = i + 1 < eb.day ? "past" : (i + 1 === eb.day ? "now" : "");
    return `<div class="pea-step ${cls}" style="animation-delay:${i * 0.06}s">${bn(i + 1)} দিন<b>+${bn(v)}</b></div>`;
  }).join("") : "";

  const wrap = document.createElement("div");
  wrap.className = "pea-back";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.innerHTML = `
    <div class="pea-card ${urgent ? "urgent" : ""}">
      <button type="button" class="pea-x" aria-label="বন্ধ করো">${svg("close", 18)}</button>
      <span class="pea-badge">${svg(urgent ? "alert" : "clock", 14)} ${urgent ? `মাত্র ${bn(daysLeft)} দিন বাকি` : `${bn(daysLeft)} দিন সময় আছে`}</span>
      <h2 class="pea-name">${esc(student.name || student.studentId)}</h2>
      <p class="pea-msg">তোমার এই পরীক্ষাটি এখনও পেন্ডিং।<br>${eb ? "তাড়াতাড়ি পরীক্ষা দাও আর বোনাস নাও!" : "আর দেরি না করে এখনই পরীক্ষাটি দিয়ে ফেলো!"}</p>
      <span class="pea-exam">${esc(exam.name || "পরীক্ষা")}</span>
      ${eb ? `
      <div class="pea-bonus">
        <small>আজ পরীক্ষা দিলে এক্সট্রা বোনাস</small>
        <span class="pea-num">${svg("bolt", 30)}+<span id="peaCount">0</span> XP</span>
      </div>
      <div class="pea-ladder" aria-label="৭ দিনের বোনাস">${ladder}</div>` : ""}
      ${urgent ? `<p class="pea-warn">${svg("alert", 18)}<span>শেষ ${bn(daysLeft)} দিন! পরীক্ষা না দিলে ${bn(EXAM_BONUS.missPenalty)} XP কাটা যাবে।</span></p>` : ""}
      <a class="pea-go" href="${esc(examUrl || "#")}">এখনই পরীক্ষা দাও</a>
      <button type="button" class="pea-later">পরে দেখব</button>
    </div>`;
  document.body.appendChild(wrap);

  // count the bonus up
  const target = eb ? eb.bonus : 0;
  const counter = wrap.querySelector("#peaCount");
  if (counter) {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) counter.textContent = bn(target);
    else {
      const t0 = performance.now(), dur = 900;
      const tick = t => {
        const p = Math.min(1, (t - t0) / dur);
        counter.textContent = bn(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1 && wrap.isConnected) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  const close = () => { wrap.classList.add("out"); setTimeout(() => wrap.remove(), 260); };
  wrap.querySelector(".pea-x").onclick = close;
  wrap.querySelector(".pea-later").onclick = close;
  wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
}
