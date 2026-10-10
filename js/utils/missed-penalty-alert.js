/* =========================================================
   Missed-exam penalty popup.

   The -500 XP itself is NOT stored anywhere: computeStudentXP() (xp-utils.js)
   recomputes it from the exam list every time, and the leaderboard, dashboard,
   profile, store and history all use that same function — so the moment an
   exam's 7 days (+24h grace) are over, every page already shows the lower XP.

   This file only SHOWS it: a one-time animated popup per missed exam
   (remembered per student in localStorage), opened from renderStudentHeader()
   so it appears on whichever student page is opened first.

   Console helper:   await debugPenalty()   -> says, exam by exam, why a
   penalty was or wasn't applied to the logged-in student.
   No emoji — every icon is inline SVG.
   ========================================================= */
import { getMissedExams, getXPExams, EXAM_BONUS } from "./xp-utils.js";
import { ensureXPExams, getApprovedResults } from "./results-utils.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bn = n => Number(n).toLocaleString("bn-BD");
const ICON = {
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
};
const svg = (n, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const REDUCED = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- seen-list (per student, per exam) ---------------- */
const seenKey = sid => `missedPenaltySeen_${sid}`;
function readSeen(sid) { try { return JSON.parse(localStorage.getItem(seenKey(sid)) || "[]"); } catch { return []; } }
function writeSeen(sid, ids) { try { localStorage.setItem(seenKey(sid), JSON.stringify([...new Set(ids)])); } catch { /* private mode */ } }

/* ---------------- entry point ---------------- */
let started = false;
export async function checkMissedPenalty(student) {
  if (started || !student?.studentId) return;
  started = true;
  try {
    const sid = student.studentId;
    // don't re-read results on every page: one check per 5 minutes per tab session
    const last = Number(sessionStorage.getItem("mpaChecked_" + sid) || 0);
    if (Date.now() - last < 5 * 60 * 1000) return;

    await ensureXPExams();
    const results = await getApprovedResults(sid);
    const missed = getMissedExams(student, new Set(results.map(r => r.examId)));
    try { sessionStorage.setItem("mpaChecked_" + sid, String(Date.now())); } catch { /* ignore */ }

    const seen = readSeen(sid);
    const fresh = missed.filter(m => !seen.includes(m.examId));
    if (!fresh.length) return;

    await whenFree();
    showMissedPenaltyAlert({ student, exams: fresh });
    writeSeen(sid, [...seen, ...fresh.map(m => m.examId)]);
    window.dispatchEvent(new CustomEvent("xp:penalty", { detail: { studentId: sid, exams: fresh, xp: fresh.length * EXAM_BONUS.missPenalty } }));
  } catch (e) { console.warn("missed-penalty check failed", e); }
}

// don't stack on top of the dashboard's pending-exam popup
function whenFree(maxMs = 20000) {
  return new Promise(res => {
    const t0 = Date.now();
    const tick = () => (!document.querySelector(".pea-back, .mpa-back") || Date.now() - t0 > maxMs) ? res() : setTimeout(tick, 800);
    tick();
  });
}

/* ---------------- styles ---------------- */
function injectStyles() {
  if (document.getElementById("mpaStyles")) return;
  const st = document.createElement("style");
  st.id = "mpaStyles";
  st.textContent = `
    .mpa-back { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 18px;
      background: radial-gradient(120% 80% at 50% 30%, rgba(120,20,10,.55), rgba(10,8,8,.82)); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
      animation: mpaFade .35s ease both; overflow: hidden; }
    .mpa-back.out { animation: mpaFadeOut .3s ease both; }
    .mpa-back::after { content: ""; position: absolute; inset: 0; background: var(--color-danger,#a6402f); opacity: 0; pointer-events: none; animation: mpaFlash .7s .25s ease-out 1; }
    .mpa-embers { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
    .mpa-embers i { position: absolute; top: -30px; left: var(--x); color: var(--color-danger,#c9503a); opacity: 0; animation: mpaFall var(--d) var(--w) linear infinite; }
    .mpa-embers svg { width: var(--s); height: var(--s); }
    .mpa-card { --pea: var(--color-danger,#a6402f); position: relative; z-index: 1; width: min(100%, 400px); overflow: hidden; text-align: center;
      background: var(--surface-solid,#fff); color: var(--text-primary,#21262f); border-radius: 26px; padding: 26px 20px 20px;
      border: 1px solid color-mix(in srgb, var(--pea) 45%, transparent); box-shadow: 0 30px 80px rgba(0,0,0,.5), 0 0 0 4px color-mix(in srgb, var(--pea) 14%, transparent);
      animation: mpaSlam .55s cubic-bezier(.2,1.25,.3,1) both, mpaShake .6s .55s ease-in-out 1; }
    .mpa-card::before { content: ""; position: absolute; inset: -45% -25% auto -25%; height: 85%;
      background: radial-gradient(closest-side, color-mix(in srgb, var(--pea) 24%, transparent), transparent 72%); pointer-events: none; }
    .mpa-card > * { position: relative; }
    .mpa-x { position: absolute !important; top: 10px; right: 10px; width: 34px; height: 34px; border: 0; border-radius: 50%; display: grid; place-items: center; background: transparent; color: var(--text-muted,#8a8f98); cursor: pointer; }
    .mpa-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 99px; font-size: .74rem; font-weight: 900;
      color: var(--pea); background: color-mix(in srgb, var(--pea) 14%, transparent); animation: mpaPulse 1.6s ease-in-out infinite; }
    .mpa-name { margin: 14px 0 2px; font-size: clamp(1.8rem, 9vw, 2.4rem); font-weight: 900; line-height: 1.12; letter-spacing: -.01em; word-break: break-word; }
    .mpa-msg { margin: 6px 0 0; font-size: .92rem; font-weight: 800; line-height: 1.55; color: var(--text-secondary,#5b6270); }
    .mpa-exams { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 10px; }
    .mpa-exams span { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 6px 12px; border-radius: 12px; font-size: .78rem; font-weight: 800;
      background: color-mix(in srgb, var(--pea) 10%, transparent); color: var(--pea); }
    .mpa-exams span b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; font-weight: 800; }
    .mpa-hit { display: inline-flex; align-items: baseline; justify-content: center; gap: 4px; margin: 16px 0 6px; color: var(--pea);
      font-family: var(--font-num, inherit); font-weight: 900; line-height: 1; animation: mpaThump .5s .75s cubic-bezier(.3,1.6,.4,1) both; }
    .mpa-hit .m { font-size: 2.6rem; } .mpa-hit .n { font-size: 4rem; font-variant-numeric: tabular-nums; letter-spacing: -.02em; text-shadow: 0 6px 24px color-mix(in srgb, var(--pea) 45%, transparent); }
    .mpa-hit small { font-size: 1.1rem; font-weight: 900; }
    .mpa-bar { height: 10px; border-radius: 99px; overflow: hidden; margin: 10px 4px 0; background: color-mix(in srgb, var(--text-primary,#21262f) 10%, transparent); }
    .mpa-bar i { display: block; height: 100%; width: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--color-success,#2f7d5e), var(--color-accent,#b8863c), var(--pea));
      transform-origin: left; animation: mpaDrain 1.5s .8s cubic-bezier(.6,0,.2,1) both; }
    .mpa-note { margin: 12px 0 0; font-size: .76rem; font-weight: 700; line-height: 1.55; color: var(--text-muted,#8a8f98); }
    .mpa-ok { display: block; width: 100%; margin-top: 16px; min-height: 50px; border: 0; border-radius: 15px; cursor: pointer; font: inherit; font-weight: 900; font-size: .95rem; color: #fff;
      background: var(--pea); box-shadow: 0 10px 22px color-mix(in srgb, var(--pea) 35%, transparent); }
    .mpa-ok:active { transform: scale(.97); }
    @keyframes mpaFade { from { opacity: 0 } to { opacity: 1 } }
    @keyframes mpaFadeOut { to { opacity: 0 } }
    @keyframes mpaFlash { 0% { opacity: 0 } 25% { opacity: .35 } 100% { opacity: 0 } }
    @keyframes mpaSlam { from { transform: translateY(-60px) scale(1.25); opacity: 0 } to { transform: none; opacity: 1 } }
    @keyframes mpaShake { 0%,100% { transform: none } 20% { transform: translateX(-7px) } 40% { transform: translateX(7px) } 60% { transform: translateX(-4px) } 80% { transform: translateX(3px) } }
    @keyframes mpaPulse { 0%,100% { opacity: 1 } 50% { opacity: .7 } }
    @keyframes mpaThump { from { transform: scale(2.2); opacity: 0 } to { transform: none; opacity: 1 } }
    @keyframes mpaDrain { from { transform: scaleX(1) } to { transform: scaleX(.32) } }
    @keyframes mpaFall { 0% { transform: translateY(0) rotate(0); opacity: 0 } 12% { opacity: .85 } 100% { transform: translateY(105vh) rotate(160deg); opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .mpa-back, .mpa-back::after, .mpa-card, .mpa-badge, .mpa-hit, .mpa-bar i, .mpa-embers i { animation: none !important; } .mpa-bar i { transform: scaleX(.32); } .mpa-embers { display: none; } }
  `;
  document.head.appendChild(st);
}

/* ---------------- the popup ---------------- */
export function showMissedPenaltyAlert({ student, exams }) {
  if (!student || !exams?.length) return;
  injectStyles();
  const total = exams.length * EXAM_BONUS.missPenalty;
  const many = exams.length > 1;
  const embers = Array.from({ length: 14 }, () =>
    `<i style="--x:${Math.round(Math.random() * 96)}%;--d:${(3.2 + Math.random() * 2.6).toFixed(2)}s;--w:${(Math.random() * 2.4).toFixed(2)}s;--s:${Math.round(14 + Math.random() * 14)}px">${svg("bolt", 28)}</i>`).join("");

  const wrap = document.createElement("div");
  wrap.className = "mpa-back";
  wrap.setAttribute("role", "alertdialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.innerHTML = `
    <div class="mpa-embers" aria-hidden="true">${embers}</div>
    <div class="mpa-card">
      <button type="button" class="mpa-x" aria-label="বন্ধ করো">${svg("close", 18)}</button>
      <span class="mpa-badge">${svg("alert", 14)} XP পেনাল্টি</span>
      <h2 class="mpa-name">${esc(student.name || student.studentId)}</h2>
      <p class="mpa-msg">${many ? `${bn(exams.length)}টি পরীক্ষা` : "এই পরীক্ষাটি"} ${bn(EXAM_BONUS.windowDays)} দিনের মধ্যে দেওয়া হয়নি,<br>তাই XP কাটা হয়েছে।</p>
      <div class="mpa-exams">${exams.slice(0, 4).map(e => `<span>${svg("file", 14)}<b>${esc(e.examName)}</b></span>`).join("")}${exams.length > 4 ? `<span>+${bn(exams.length - 4)}টি</span>` : ""}</div>
      <div class="mpa-hit"><span class="m">−</span><span class="n" id="mpaNum">0</span><small>XP</small></div>
      <div class="mpa-bar" aria-hidden="true"><i></i></div>
      <p class="mpa-note">লিডারবোর্ডসহ সব পেজে তোমার XP আপডেট হয়ে গেছে। পরের পরীক্ষাগুলো সময়মতো দিলে বোনাস XP দিয়ে এটা পুষিয়ে নিতে পারবে।</p>
      <button type="button" class="mpa-ok">বুঝেছি</button>
    </div>`;
  document.body.appendChild(wrap);

  const num = wrap.querySelector("#mpaNum");
  if (REDUCED()) num.textContent = bn(total);
  else {
    const t0 = performance.now() + 700, dur = 1100;          // starts when the slam lands
    const tick = t => {
      const p = Math.max(0, Math.min(1, (t - t0) / dur));
      num.textContent = bn(Math.round(total * (1 - Math.pow(1 - p, 3))));
      if (p < 1 && wrap.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const close = () => { wrap.classList.add("out"); setTimeout(() => wrap.remove(), 300); };
  wrap.querySelector(".mpa-x").onclick = close;
  wrap.querySelector(".mpa-ok").onclick = close;
  wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
}

/* ---------------- console helper ---------------- */
async function debugPenalty() {
  const raw = localStorage.getItem("activeStudent");
  const student = raw ? JSON.parse(raw) : null;
  if (!student) { console.warn("debugPenalty: no logged-in student in localStorage"); return null; }
  await ensureXPExams(true);
  const results = await getApprovedResults(student.studentId);
  const { missed, why } = getMissedExams(student, new Set(results.map(r => r.examId)), Date.now(), true);
  console.log("student:", student.studentId, "| batch:", student.className, "| exams loaded:", getXPExams().length, "| results:", results.length);
  console.table(why);
  console.log("penalty now:", missed.length * EXAM_BONUS.missPenalty, "XP", missed);
  return { missed, why };
}
if (typeof window !== "undefined") window.debugPenalty = debugPenalty;
