/* =========================================================
   Free card claim widget (used on result.html and the dashboard).
   mountExamClaim(container, { examId, studentId, hideIfClaimed })
   - not claimed yet  -> a gift card with a "claim" button
   - claimed just now -> reveals the card(s) with a pop animation
   - claimed earlier  -> small "you got ..." line (or nothing if hideIfClaimed)
   Rules live in store-utils.js (claimExamCards): top scorer = 2 cards,
   everyone else = 1, random card type, once per exam.
   ========================================================= */
import { STORE_ITEMS, getExamClaim, claimExamCards } from "./store-utils.js";

const META = {
  time_extend_card: { emoji: "⏱️", color: "#5b7c99" },
  battle_room_card: { emoji: "⚔️", color: "#b8863b" },
  hint_card:        { emoji: "💡", color: "#c9a227" }
};

function injectStyles() {
  if (document.getElementById("claimStyles")) return;
  const st = document.createElement("style");
  st.id = "claimStyles";
  st.textContent = `
    .cl-card { background: var(--surface-solid, #fff); border: 1px solid var(--surface-border, rgba(128,128,128,.2));
      border-radius: 20px; padding: 18px; margin-top: 16px; text-align: center; }
    .cl-gift { font-size: 2.6rem; line-height: 1; animation: clBob 2.2s ease-in-out infinite; }
    .cl-title { font-size: 1.05rem; font-weight: 900; margin: 8px 0 4px; color: var(--text-primary); }
    .cl-sub { font-size: .8rem; font-weight: 600; color: var(--text-muted); line-height: 1.5; margin: 0 0 14px; }
    .cl-btn { width: 100%; min-height: 48px; border: 0; border-radius: 14px; font-weight: 900; font-size: .95rem;
      background: var(--color-accent, #b8863b); color: #fff; }
    .cl-btn:disabled { opacity: .6; }
    .cl-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 12px; }
    .cl-item { flex: 1 1 130px; max-width: 170px; border-radius: 16px; padding: 14px 8px; color: #fff; text-align: center;
      animation: clPop .5s cubic-bezier(.2,1.4,.4,1) both; }
    .cl-item:nth-child(2) { animation-delay: .25s; }
    .cl-item b { display: block; font-size: .9rem; margin-top: 6px; }
    .cl-item i { font-style: normal; font-size: 1.8rem; }
    .cl-top { display: inline-block; background: rgba(184,134,59,.15); color: var(--color-accent, #b8863b);
      font-weight: 900; font-size: .8rem; padding: 4px 12px; border-radius: 99px; margin-bottom: 6px; }
    .cl-done { font-size: .82rem; font-weight: 700; color: var(--text-secondary); }
    @keyframes clBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
    @keyframes clPop { from { transform: scale(.4) rotate(-8deg); opacity: 0 } to { transform: none; opacity: 1 } }
  `;
  document.head.appendChild(st);
}

function itemsHtml(cards) {
  return `<div class="cl-row">` + cards.map(id => {
    const item = STORE_ITEMS.find(i => i.id === id);
    const m = META[id] || { emoji: "🎁", color: "#666" };
    return `<div class="cl-item" style="background:${m.color};"><i>${m.emoji}</i><b>${item?.name || id}</b></div>`;
  }).join("") + `</div>`;
}

function showClaimed(el, claim, justNow) {
  el.innerHTML = `
    <div class="cl-card">
      ${claim.isTop ? `<span class="cl-top">🏆 এই পরীক্ষায় তুমি সবার সেরা!</span>` : ""}
      <p class="cl-title">${justNow ? "অভিনন্দন! তুমি পেয়েছ" : "এই পরীক্ষার ফ্রি কার্ড"}</p>
      ${itemsHtml(claim.cards)}
      <p class="cl-done" style="margin-top:12px;">কার্ড তোমার স্টোরে জমা হয়েছে।</p>
    </div>`;
}

export async function mountExamClaim(container, { examId, studentId, hideIfClaimed = false } = {}) {
  if (!container || !examId || !studentId) return;
  injectStyles();
  let claim = null;
  try { claim = await getExamClaim(examId, studentId); } catch { return; }

  if (claim) {
    if (hideIfClaimed) { container.innerHTML = ""; return; }
    showClaimed(container, claim, false);
    return;
  }

  container.innerHTML = `
    <div class="cl-card">
      <div class="cl-gift">🎁</div>
      <p class="cl-title">ফ্রি কার্ড ক্লেইম করো</p>
      <p class="cl-sub">প্রতিটি পরীক্ষার পর ১টি র‍্যান্ডম কার্ড ফ্রি। পরীক্ষায় সবার সেরা হলে পাবে ২টি!</p>
      <button type="button" class="cl-btn" id="clBtn">ক্লেইম করো</button>
      <p class="cl-sub" id="clMsg" style="margin:10px 0 0;color:#ef4444;"></p>
    </div>`;

  const btn = container.querySelector("#clBtn");
  const msg = container.querySelector("#clMsg");
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "খোলা হচ্ছে...";
    try {
      const res = await claimExamCards(examId, studentId);
      showClaimed(container, { ...res }, true);
    } catch (err) {
      if (err?.message === "ALREADY_CLAIMED" && err.claim) { showClaimed(container, err.claim, false); return; }
      console.error(err);
      msg.textContent = err?.message === "NO_RESULT" ? "এই পরীক্ষার ফলাফল পাওয়া যায়নি।" : "ক্লেইম করা যায়নি, আবার চেষ্টা করো।";
      btn.disabled = false; btn.textContent = "ক্লেইম করো";
    }
  };
}
