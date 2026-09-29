/* =========================================================
   Free card claim widget (result.html + dashboard).
   mountExamClaim(container, { examId, studentId, hideIfClaimed })
   Rules live in store-utils.js (claimExamCards): top scorer = 2 cards,
   everyone else = 1, random card type, once per exam, only while the
   exam's 7-day window is open. Nothing is shown for old/expired exams.
   No emoji anywhere: all icons are inline SVG.
   ========================================================= */
import { STORE_ITEMS, getExamClaim, claimExamCards, isExamClaimOpen } from "./store-utils.js";

const I = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bolt:  '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  bulb:  '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.7.6 1 1.4 1 2.4h5.6c0-1 .3-1.8 1-2.4A6 6 0 0 0 12 3z"/>',
  trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'
};
const svg = (name, size = 28) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]}</svg>`;

const META = {
  time_extend_card: { icon: "clock", g: "linear-gradient(145deg,#5f7f9e,#34495e)" },
  battle_room_card: { icon: "bolt",  g: "linear-gradient(145deg,#d1a24d,#8a5f1c)" },
  hint_card:        { icon: "bulb",  g: "linear-gradient(145deg,#e0b93c,#a67c0a)" }
};

const GIFT = `
<svg class="cl-giftsvg" viewBox="0 0 64 64" width="84" height="84" aria-hidden="true">
  <g class="cl-box">
    <rect x="10" y="28" width="44" height="28" rx="5" fill="var(--color-accent,#b8863b)"/>
    <rect x="29" y="28" width="6" height="28" fill="rgba(255,255,255,.55)"/>
  </g>
  <g class="cl-lid">
    <rect x="6" y="19" width="52" height="11" rx="4" fill="var(--color-accent,#b8863b)"/>
    <rect x="6" y="19" width="52" height="11" rx="4" fill="rgba(255,255,255,.18)"/>
    <rect x="29" y="19" width="6" height="11" fill="rgba(255,255,255,.55)"/>
    <path d="M32 19c-3-8-13-8-11-2 1 3 7 2 11 2zM32 19c3-8 13-8 11-2-1 3-7 2-11 2z" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="2.4" stroke-linejoin="round"/>
  </g>
</svg>`;

function injectStyles() {
  if (document.getElementById("claimStyles")) return;
  const st = document.createElement("style");
  st.id = "claimStyles";
  st.textContent = `
    .cl-card { position: relative; overflow: hidden; margin-top: 16px; padding: 22px 18px; text-align: center;
      background: var(--surface-solid,#fff); border: 1px solid var(--surface-border,rgba(128,128,128,.2)); border-radius: 22px; }
    .cl-card::before { content: ""; position: absolute; inset: -40% -20% auto -20%; height: 90%;
      background: radial-gradient(closest-side, var(--color-accent-soft,rgba(184,134,59,.16)), transparent 70%); pointer-events: none; }
    .cl-card > * { position: relative; }
    .cl-gift { display: inline-block; animation: clFloat 2.6s ease-in-out infinite; }
    .cl-gift.opening { animation: clShake .6s ease-in-out; }
    .cl-gift.opening .cl-lid { animation: clLid .7s cubic-bezier(.3,1.3,.5,1) forwards; }
    .cl-title { font-size: 1.08rem; font-weight: 900; margin: 6px 0 4px; color: var(--text-primary); }
    .cl-sub { font-size: .8rem; font-weight: 600; color: var(--text-muted); line-height: 1.55; margin: 0 0 16px; }
    .cl-btn { width: 100%; min-height: 50px; border: 0; border-radius: 15px; font-weight: 900; font-size: .95rem; color: #fff;
      background: linear-gradient(135deg, var(--color-accent,#b8863b), #8a5f1c); box-shadow: 0 8px 20px rgba(138,95,28,.28);
      position: relative; overflow: hidden; }
    .cl-btn::after { content: ""; position: absolute; top: 0; left: -60%; width: 40%; height: 100%;
      background: linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent); animation: clShine 2.8s ease-in-out infinite; }
    .cl-btn:disabled { opacity: .7; }
    .cl-btn:active { transform: scale(.98); }
    .cl-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 14px; perspective: 800px; }
    .cl-item { flex: 1 1 128px; max-width: 170px; border-radius: 18px; padding: 18px 10px 16px; color: #fff; text-align: center;
      box-shadow: 0 12px 26px rgba(0,0,0,.18); animation: clFlip .8s cubic-bezier(.2,.9,.3,1.1) both; position: relative; overflow: hidden; }
    .cl-item:nth-child(2) { animation-delay: .3s; }
    .cl-item::after { content: ""; position: absolute; top: 0; left: -80%; width: 50%; height: 100%;
      background: linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent); animation: clShine 2.4s .9s ease-in-out 1; }
    .cl-ico { width: 52px; height: 52px; margin: 0 auto 10px; border-radius: 50%; display: grid; place-items: center;
      background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.35); }
    .cl-item b { display: block; font-size: .92rem; font-weight: 900; }
    .cl-item small { display: block; margin-top: 3px; font-size: .68rem; font-weight: 600; opacity: .85; }
    .cl-top { display: inline-flex; align-items: center; gap: 6px; background: var(--color-accent-soft,rgba(184,134,59,.15));
      color: var(--color-accent,#b8863b); font-weight: 900; font-size: .8rem; padding: 6px 14px; border-radius: 99px; margin-bottom: 8px; }
    .cl-done { font-size: .8rem; font-weight: 700; color: var(--text-secondary); margin: 14px 0 0; }
    @keyframes clFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
    @keyframes clShake { 0%,100% { transform: none } 20% { transform: rotate(-6deg) } 40% { transform: rotate(6deg) } 60% { transform: rotate(-4deg) } 80% { transform: rotate(3deg) } }
    @keyframes clLid { to { transform: translate(6px,-22px) rotate(18deg); opacity: 0 } }
    @keyframes clShine { 0% { left: -60% } 60%,100% { left: 130% } }
    @keyframes clFlip { from { transform: rotateY(90deg) scale(.7); opacity: 0 } to { transform: none; opacity: 1 } }
    @media (prefers-reduced-motion: reduce) { .cl-gift, .cl-btn::after, .cl-item, .cl-item::after { animation: none !important; } }
  `;
  document.head.appendChild(st);
}

function itemsHtml(cards) {
  return `<div class="cl-row">` + cards.map(id => {
    const item = STORE_ITEMS.find(i => i.id === id);
    const m = META[id] || META.hint_card;
    return `<div class="cl-item" style="background:${m.g};">
      <div class="cl-ico">${svg(m.icon, 26)}</div>
      <b>${item?.name || id}</b>
      <small>${item?.tagline || ""}</small>
    </div>`;
  }).join("") + `</div>`;
}

function showClaimed(el, claim, justNow) {
  el.innerHTML = `
    <div class="cl-card">
      ${claim.isTop ? `<span class="cl-top">${svg("trophy", 16)} এই পরীক্ষায় তুমি সবার সেরা</span>` : ""}
      <p class="cl-title">${justNow ? "অভিনন্দন! তুমি পেয়েছ" : "এই পরীক্ষার ফ্রি কার্ড"}</p>
      ${itemsHtml(claim.cards)}
      <p class="cl-done">কার্ড তোমার স্টোরে জমা হয়েছে</p>
    </div>`;
}

export async function mountExamClaim(container, { examId, studentId, hideIfClaimed = false } = {}) {
  if (!container || !examId || !studentId) return;
  container.innerHTML = "";
  injectStyles();

  let claim = null;
  try { claim = await getExamClaim(examId, studentId); } catch { return; }
  if (claim) {
    if (!hideIfClaimed) showClaimed(container, claim, false);
    return;
  }
  // Not claimed: only offer it while the exam's 7-day window is open.
  if (!(await isExamClaimOpen(examId))) return;

  container.innerHTML = `
    <div class="cl-card">
      <div class="cl-gift" id="clGift">${GIFT}</div>
      <p class="cl-title">ফ্রি কার্ড ক্লেইম করো</p>
      <p class="cl-sub">এই পরীক্ষার জন্য ১টি র‍্যান্ডম কার্ড ফ্রি। পরীক্ষায় সবার সেরা হলে পাবে ২টি।</p>
      <button type="button" class="cl-btn" id="clBtn">ক্লেইম করো</button>
      <p class="cl-sub" id="clMsg" style="margin:10px 0 0;color:#ef4444;"></p>
    </div>`;

  const btn = container.querySelector("#clBtn");
  const gift = container.querySelector("#clGift");
  const msg = container.querySelector("#clMsg");
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "খোলা হচ্ছে...";
    gift.classList.add("opening");
    const wait = new Promise(r => setTimeout(r, 900));
    try {
      const [res] = await Promise.all([claimExamCards(examId, studentId), wait]);
      showClaimed(container, res, true);
    } catch (err) {
      await wait;
      gift.classList.remove("opening");
      if (err?.message === "ALREADY_CLAIMED" && err.claim) { showClaimed(container, err.claim, false); return; }
      if (err?.message === "CLAIM_EXPIRED") { container.innerHTML = ""; return; }
      console.error(err);
      msg.textContent = err?.message === "NO_RESULT" ? "এই পরীক্ষার ফলাফল পাওয়া যায়নি।" : "ক্লেইম করা যায়নি, আবার চেষ্টা করো।";
      btn.disabled = false; btn.textContent = "ক্লেইম করো";
    }
  };
}
