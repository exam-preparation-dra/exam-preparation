/* ============================================================
   notif-ui.js — WhatsApp-style behaviour + look for the bell panel.

   ui-utils.js renders the notification cards (and owns the data).
   This module adds, without touching the data layer:
     • a cleaner light/dark design (bottom sheet on phones, card on desktop)
     • swipe left / right on a card to dismiss it
     • inline reply on chat / friend-message cards (ready-made messages,
       live mini thread, 2-minute cooldown) — no page redirect
     • accept / decline group invites in place
     • auto-close (idle timer with a thin progress bar), Esc, swipe-down
     • "Clear all", live count, ringing bell

   Hooks it relies on (set by ui-utils.js):
     window.__nxNotif = { me, names, getRoom(id), visibleKeys(), hide(key), refresh() }
     window.__nxBusy / window.__nxPending  (pauses list re-rendering while
       a reply box is open or a card is being dragged)
   ============================================================ */

const IDLE_MS = 12000;           // auto-close after this much inactivity
const SWIPE_MIN = 96;            // px needed to dismiss
const THREAD_SHOW = 4;           // messages shown in the live mini thread

const T = (bn, en) => (window.AppPopup ? window.AppPopup.t({ bn, en }) : bn);
const isPhone = () => window.matchMedia("(max-width: 600px)").matches;

/* ---------------- styles ---------------- */
const CSS = `
.student-global-notification .global-notification-btn{width:44px;height:44px;border-radius:14px;
  background:var(--surface-solid,#fff);border:1px solid var(--surface-border,rgba(0,0,0,.08));color:var(--text-primary,#21262f);
  box-shadow:0 1px 2px rgba(0,0,0,.04);transition:transform .15s,box-shadow .2s,border-color .2s}
.student-global-notification .global-notification-btn:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,.1)}
.student-global-notification .global-notification-btn:active{transform:scale(.94)}
.student-global-notification .global-notification-btn.nx-ring svg{animation:nxRing 2.6s ease-in-out infinite;transform-origin:50% 8%}
@keyframes nxRing{0%,62%,100%{transform:rotate(0)}6%{transform:rotate(16deg)}12%{transform:rotate(-14deg)}18%{transform:rotate(10deg)}24%{transform:rotate(-7deg)}30%{transform:rotate(3deg)}36%{transform:rotate(0)}}
.global-notification-count{background:var(--color-danger,#e0453a)!important}

.nx-backdrop{position:fixed;inset:0;z-index:99990;background:rgba(10,12,18,.46);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);
  opacity:0;pointer-events:none;transition:opacity .22s}
.nx-backdrop.on{opacity:1;pointer-events:auto}
@media (min-width:601px){.nx-backdrop{display:none}}

.global-notification-panel{position:fixed;z-index:99995;display:none;flex-direction:column;box-sizing:border-box;overflow:hidden;
  width:min(410px,calc(100vw - 24px));max-height:min(640px,calc(100vh - 90px));padding:0;
  background:var(--surface-solid,#fff);color:var(--text-primary,#21262f);border:1px solid var(--surface-border,rgba(0,0,0,.1));
  border-radius:22px;box-shadow:0 28px 70px rgba(0,0,0,.28),0 4px 14px rgba(0,0,0,.08)}
.global-notification-panel.show{display:flex;animation:nxIn .22s cubic-bezier(.2,.9,.3,1.1)}
@keyframes nxIn{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:none}}
.nx-grab{display:none;width:42px;height:5px;border-radius:9px;margin:9px auto 0;background:var(--surface-border,rgba(0,0,0,.18));flex:none;touch-action:none}
.nx-timer{display:block;height:3px;flex:none;background:var(--color-accent,#b8863c);transform-origin:left;transform:scaleX(1);opacity:.65;border-radius:0 3px 3px 0}
.global-notification-panel .global-notification-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none;
  padding:14px 16px 10px;border:0;touch-action:none}
.nx-head-t{display:flex;flex-direction:column;gap:1px;min-width:0}
.nx-head-t strong{font-size:1.1rem;font-weight:800;letter-spacing:-.01em;color:var(--text-primary,#21262f)}
.nx-head-t small{font-size:.74rem;font-weight:600;color:var(--text-muted,#8d94a0)}
.nx-head-a{display:flex;align-items:center;gap:6px}
.global-notification-panel .global-notification-head button{border:0;cursor:pointer;font:inherit;-webkit-tap-highlight-color:transparent}
.nx-clear{padding:7px 12px!important;border-radius:999px;font-size:.76rem!important;font-weight:700;color:var(--text-secondary,#5b6270)!important;
  background:var(--surface,rgba(0,0,0,.05))!important;transition:background .15s,color .15s}
.nx-clear:hover{color:var(--color-danger,#a6402f)!important}
.nx-clear[hidden]{display:none}
.nx-x{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;padding:0!important;color:var(--text-secondary,#5b6270)!important;
  background:var(--surface,rgba(0,0,0,.05))!important}
.nx-x:hover{background:var(--surface-border,rgba(0,0,0,.1))!important}

.global-notification-panel .global-notification-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;
  gap:8px;padding:4px 12px 14px;scrollbar-width:thin}

/* cards */
.global-notification-panel .global-notification-item{position:relative;border:1px solid var(--surface-border,rgba(0,0,0,.07));
  border-radius:18px;padding:12px;background:var(--surface,rgba(0,0,0,.025));touch-action:pan-y;
  transition:transform .2s ease,opacity .2s ease,height .22s ease,margin .22s ease,padding .22s ease,background .15s,border-color .15s;will-change:transform}
.global-notification-panel .global-notification-item.nx-drag{transition:none;cursor:grabbing}
.global-notification-panel .global-notification-item.gn-cheer{border-left-width:1px}
.global-notification-panel .global-notification-icon{width:38px;height:38px;border-radius:50%}
.global-notification-panel .global-notification-main strong{font-size:.9rem;color:var(--text-primary,#21262f)}
.global-notification-panel .global-notification-main p{font-size:.8rem;color:var(--text-secondary,#5b6270)}
.global-notification-panel .global-notification-actions{padding-left:0;flex-wrap:wrap}
.global-notification-panel .global-notification-actions button,.nx-btn{border:0;border-radius:999px;padding:8px 14px;font:inherit;font-size:.78rem;font-weight:700;
  cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .12s,filter .15s,background .15s}
.global-notification-panel .global-notification-actions button:active,.nx-btn:active{transform:scale(.96)}

.nx-row{display:flex;align-items:center;gap:12px}
.nx-av{flex:none;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:1.05rem;
  background:linear-gradient(135deg,hsl(var(--h) 58% 54%),hsl(calc(var(--h) + 36) 62% 42%));box-shadow:0 2px 8px hsl(var(--h) 55% 40% / .35)}
.nx-body{flex:1;min-width:0}
.nx-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.nx-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.98rem;font-weight:800;color:var(--text-primary,#21262f)}
.nx-time{flex:none;font-size:.7rem;font-weight:600;color:var(--text-muted,#8d94a0)}
.nx-line{display:flex;align-items:center;gap:8px;margin-top:2px}
.nx-prev{flex:1;min-width:0;font-size:.84rem;line-height:1.4;color:var(--text-secondary,#5b6270);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.nx-prev-big{font-size:.95rem;font-weight:700;color:var(--text-primary,#21262f)}
.nx-badge{flex:none;min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:grid;place-items:center;font-size:.7rem;font-weight:800;
  color:#fff;background:var(--color-accent,#b8863c)}
.nx-acts{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px;padding-left:58px}
.nx-btn{display:inline-flex;align-items:center;gap:6px;color:var(--text-primary,#21262f);background:var(--surface-border,rgba(0,0,0,.07))}
.nx-btn:hover{filter:brightness(.96)}
.nx-primary{color:#fff;background:var(--color-accent,#b8863c)}
.nx-primary:hover{filter:brightness(1.08)}
.nx-ghost{background:transparent;color:var(--text-secondary,#5b6270);box-shadow:inset 0 0 0 1px var(--surface-border,rgba(0,0,0,.12))}
.global-notification-panel .global-notif-hide{color:var(--color-danger,#a6402f)!important;background:transparent!important}

/* inline reply */
.nx-composer{margin-top:12px;border-top:1px dashed var(--surface-border,rgba(0,0,0,.12));padding-top:10px;animation:nxIn .2s ease}
.nx-composer[hidden]{display:none}
.nx-thread{display:flex;flex-direction:column;gap:5px;max-height:132px;overflow-y:auto;padding:2px 2px 8px}
.nx-b{max-width:84%;padding:6px 11px;border-radius:14px;font-size:.82rem;line-height:1.35;word-break:break-word;background:var(--surface-border,rgba(0,0,0,.07));color:var(--text-primary,#21262f);align-self:flex-start;border-bottom-left-radius:4px}
.nx-b.me{align-self:flex-end;background:color-mix(in srgb,var(--color-accent,#b8863c) 22%,transparent);border-bottom-left-radius:14px;border-bottom-right-radius:4px}
.nx-b small{display:block;font-size:.66rem;font-weight:700;color:var(--color-accent,#b8863c);margin-bottom:1px}
.nx-b.big{font-size:1.5rem;padding:3px 10px;background:transparent}
.nx-cats{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}
.nx-cats::-webkit-scrollbar{display:none}
.nx-cat{flex:none;border:0;cursor:pointer;font:inherit;font-size:.74rem;font-weight:700;padding:6px 11px;border-radius:999px;
  color:var(--text-secondary,#5b6270);background:var(--surface-border,rgba(0,0,0,.07))}
.nx-cat.on{color:#fff;background:var(--color-accent,#b8863c)}
.nx-presets{display:flex;flex-wrap:wrap;gap:6px;max-height:150px;overflow-y:auto;padding:2px 1px 4px;overscroll-behavior:contain}
.nx-pre{border:1px solid var(--surface-border,rgba(0,0,0,.12));cursor:pointer;font:inherit;font-size:.8rem;font-weight:600;padding:7px 11px;border-radius:14px;
  color:var(--text-primary,#21262f);background:var(--surface-solid,#fff);transition:transform .1s,border-color .15s,background .15s}
.nx-pre:active{transform:scale(.95)}
.nx-pre.sel{border-color:var(--color-accent,#b8863c);background:color-mix(in srgb,var(--color-accent,#b8863c) 16%,transparent)}
.nx-pre.emo{font-size:1.25rem;padding:4px 10px}
.nx-wait{display:none;margin-top:8px;font-size:.74rem;font-weight:700;color:var(--text-muted,#8d94a0);text-align:center}
.nx-wait.on{display:block}
.nx-wait b{color:var(--color-accent,#b8863c);font-variant-numeric:tabular-nums}
.nx-sendbar{display:flex;align-items:center;gap:8px;margin-top:10px}
.nx-sel{flex:1;min-width:0;padding:9px 13px;border-radius:999px;font-size:.82rem;color:var(--text-muted,#8d94a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  background:var(--surface,rgba(0,0,0,.05));border:1px solid var(--surface-border,rgba(0,0,0,.08))}
.nx-sel.has{color:var(--text-primary,#21262f)}
.nx-send{flex:none;width:42px;height:42px;border-radius:50%;border:0;cursor:pointer;display:grid;place-items:center;color:#fff;background:var(--color-accent,#b8863c);
  box-shadow:0 5px 14px color-mix(in srgb,var(--color-accent,#b8863c) 40%,transparent);transition:transform .12s,opacity .15s}
.nx-send:active{transform:scale(.92)}
.nx-send:disabled{opacity:.4;box-shadow:none;cursor:not-allowed}
.nx-err{margin-top:8px;font-size:.76rem;font-weight:600;color:var(--color-danger,#a6402f);text-align:center}
.nx-ok{display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;font-weight:700;font-size:.88rem;color:var(--color-success,#2f7d5e)}

.global-notification-panel .nx-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:34px 16px 38px;text-align:center}
.nx-empty-ico{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;margin-bottom:6px;color:var(--color-accent,#b8863c);
  background:color-mix(in srgb,var(--color-accent,#b8863c) 13%,transparent)}
.nx-empty-ico svg{width:28px;height:28px}
.nx-empty b{font-size:1rem;color:var(--text-primary,#21262f)}
.nx-empty span:last-child{font-size:.82rem;color:var(--text-muted,#8d94a0)}

@media (max-width:600px){
  .global-notification-panel{left:0!important;right:0!important;top:auto!important;bottom:0!important;width:100%;max-height:84vh;border-radius:26px 26px 0 0;
    border-bottom:0;padding-bottom:env(safe-area-inset-bottom);transition:transform .22s ease}
  .global-notification-panel.show{animation:nxSheet .28s cubic-bezier(.2,.9,.3,1)}
  .nx-grab{display:block}
  .nx-acts{padding-left:0}
}
@keyframes nxSheet{from{transform:translateY(100%)}to{transform:none}}
@media (prefers-reduced-motion:reduce){.global-notification-panel.show,.nx-composer{animation:none}.student-global-notification .global-notification-btn.nx-ring svg{animation:none}}
`;
function injectCss() {
  let s = document.getElementById("nx-style");
  if (!s) { s = document.createElement("style"); s.id = "nx-style"; s.textContent = CSS; }
  if (document.head.lastElementChild !== s) document.head.appendChild(s);   // keep it last -> wins over ui-utils' base styles
}

/* ---------------- busy / pending-render guard ---------------- */
let busyCount = 0;
function busy(on) {
  busyCount = Math.max(0, busyCount + (on ? 1 : -1));
  window.__nxBusy = busyCount > 0;
  if (!window.__nxBusy && window.__nxPending) {
    window.__nxPending = false;
    try { window.__nxNotif && window.__nxNotif.refresh(); } catch (e) {}
  }
}

/* ---------------- main setup ---------------- */
function setup() {
  const panel = document.getElementById("globalNotificationPanel");
  const list = document.getElementById("globalNotificationList");
  const btn = document.getElementById("globalNotificationBtn");
  if (!panel || !list || !btn || panel.__nx) return false;
  panel.__nx = true;
  injectCss();

  // mount on <body> so position:fixed is never trapped by a transformed/filtered header
  document.querySelectorAll("body > #globalNotificationPanel").forEach(p => { if (p !== panel) p.remove(); });
  document.body.appendChild(panel);

  document.querySelectorAll(".nx-backdrop").forEach(b => b.remove());
  const backdrop = document.createElement("div");
  backdrop.className = "nx-backdrop";
  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", () => closePanel());

  const closePanel = () => panel.classList.remove("show");
  const timerBar = panel.querySelector(".nx-timer");
  const sub = panel.querySelector("#nxSub");
  const clearBtn = panel.querySelector("#nxClearAll");

  /* ---- auto close ---- */
  let deadline = 0, tick = null, hovering = false, idleHold = 0;
  const poke = () => { deadline = Date.now() + IDLE_MS; };
  const paused = () => busyCount > 0 || hovering || idleHold > 0 || document.hidden || panel.querySelector(".nx-composer:not([hidden])");
  function startTimer() {
    stopTimer(); poke();
    tick = setInterval(() => {
      if (paused()) { poke(); }
      const left = Math.max(0, deadline - Date.now());
      if (timerBar) timerBar.style.transform = `scaleX(${left / IDLE_MS})`;
      if (left <= 0) closePanel();
    }, 100);
  }
  function stopTimer() { if (tick) clearInterval(tick); tick = null; }
  ["pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach(ev => panel.addEventListener(ev, poke, { passive: true, capture: true }));
  panel.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") hovering = true; });
  panel.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") { hovering = false; poke(); } });

  /* ---- open / close sync ---- */
  const place = () => {
    if (isPhone()) { panel.style.top = panel.style.right = ""; return; }
    const r = btn.getBoundingClientRect();
    panel.style.top = Math.round(r.bottom + 10) + "px";
    panel.style.right = Math.max(12, Math.round(window.innerWidth - r.right)) + "px";
    panel.style.left = "auto"; panel.style.bottom = "auto";
  };
  new MutationObserver(() => {
    const open = panel.classList.contains("show");
    backdrop.classList.toggle("on", open && isPhone());
    if (open) { injectCss(); place(); enhance(); startTimer(); }
    else { stopTimer(); closeAllComposers(true); panel.style.transform = ""; if (timerBar) timerBar.style.transform = "scaleX(1)"; }
  }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", () => { if (panel.classList.contains("show")) place(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && panel.classList.contains("show")) closePanel(); });

  /* ---- bell ring + count ---- */
  const countEl = document.getElementById("globalNotificationCount");
  const syncBell = () => btn.classList.toggle("nx-ring", !!countEl && countEl.style.display !== "none" && !!countEl.textContent.trim() && countEl.textContent.trim() !== "0");
  if (countEl) new MutationObserver(syncBell).observe(countEl, { attributes: true, childList: true, characterData: true, subtree: true });
  syncBell();

  /* ---- header helpers ---- */
  function cards() { return [...list.querySelectorAll(".global-notification-item[data-notification-key]")]; }
  function syncHead() {
    const n = cards().length;
    if (sub) sub.textContent = n ? T(`${n}টি নোটিফিকেশন`, `${n} notification${n === 1 ? "" : "s"}`) : "";
    if (clearBtn) clearBtn.hidden = n === 0;
  }
  clearBtn && clearBtn.addEventListener("click", async e => {
    e.stopPropagation();
    const all = cards();
    all.forEach((c, i) => setTimeout(() => dismiss(c, i % 2 ? 1 : -1, { skipEmptyClose: true }), i * 60));
    setTimeout(() => closePanel(), all.length * 60 + 700);
  });

  /* ---- enhance cards after every render ---- */
  new MutationObserver(() => enhance()).observe(list, { childList: true });
  function enhance() {
    cards().forEach(c => { if (!c.__nxBound) { c.__nxBound = true; bindSwipe(c); } });
    syncHead();
    if (panel.classList.contains("show") && !tick) startTimer();
  }

  /* ---- swipe to dismiss ---- */
  function bindSwipe(card) {
    let sx = 0, sy = 0, dx = 0, drag = false, pid = null;
    card.addEventListener("pointerdown", e => {
      if (e.button > 0 || e.target.closest("button,input,textarea,a,.nx-composer")) return;
      sx = e.clientX; sy = e.clientY; dx = 0; drag = false; pid = e.pointerId;
    });
    card.addEventListener("pointermove", e => {
      if (pid !== e.pointerId) return;
      const mx = e.clientX - sx, my = e.clientY - sy;
      if (!drag) {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { pid = null; return; }
        if (Math.abs(mx) < 8) return;
        drag = true; busy(true);
        try { card.setPointerCapture(pid); } catch (er) {}
        card.classList.add("nx-drag");
      }
      dx = mx;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 60}deg)`;
      card.style.opacity = String(1 - Math.min(.65, Math.abs(dx) / 300));
    });
    const end = () => {
      if (!drag) { pid = null; return; }
      drag = false; pid = null; card.classList.remove("nx-drag");
      if (Math.abs(dx) >= Math.min(SWIPE_MIN, card.offsetWidth * .34)) { dismiss(card, dx > 0 ? 1 : -1); }
      else { card.style.transform = ""; card.style.opacity = ""; }
      busy(false);
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
  }

  async function dismiss(card, dir, opts = {}) {
    if (card.__gone) return;
    card.__gone = true;
    const key = card.dataset.notificationKey;
    const kind = card.dataset.nx;
    busy(true);
    if (card.classList.contains("nx-open")) closeComposer(card, true);
    card.classList.remove("nx-drag");
    card.style.transform = `translateX(${dir * 115}%) rotate(${dir * 6}deg)`;
    card.style.opacity = "0";
    // swiping a chat card away also marks that chat as read
    if (kind === "chat" && card.dataset.room && window.__nxNotif) {
      import("./chat-utils.js").then(C => C.markRead(card.dataset.room, window.__nxNotif.me)).catch(() => {});
    }
    try { window.__nxNotif && key && window.__nxNotif.hide(key); } catch (e) {}
    await new Promise(r => setTimeout(r, 190));
    const h = card.offsetHeight;
    card.style.height = h + "px"; card.style.overflow = "hidden";
    void card.offsetHeight;
    card.style.height = "0px"; card.style.margin = "-4px 0"; card.style.paddingTop = card.style.paddingBottom = "0"; card.style.borderWidth = "0";
    await new Promise(r => setTimeout(r, 230));
    card.remove();
    busy(false);
    syncHead();
    if (!cards().length) {
      list.innerHTML = `<div class="global-notification-empty nx-empty"><span class="nx-empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span><b>${T("সব দেখা শেষ!", "You're all caught up")}</b><span>${T("এখন কোনো নতুন notification নেই।", "No new notifications right now.")}</span></div>`;
      syncHead();
      if (!opts.skipEmptyClose) setTimeout(() => { if (!cards().length) closePanel(); }, 1300);
    }
  }

  /* ---- click delegation: reply / read / invites ---- */
  list.addEventListener("click", async e => {
    const b = e.target.closest("[data-nx-act],.nx-cat,.nx-pre,.nx-send");
    if (!b || !list.contains(b)) return;
    const card = b.closest(".global-notification-item");
    if (!card) return;
    const act = b.dataset.nxAct;
    if (act === "reply") { e.stopPropagation(); toggleComposer(card); }
    else if (act === "read") {
      e.stopPropagation();
      dismiss(card, 1);
    } else if (act === "inv-yes" || act === "inv-no") {
      e.stopPropagation();
      b.disabled = true;
      try {
        const C = await import("./chat-utils.js");
        const me = window.__nxNotif.me, id = card.dataset.room;
        if (act === "inv-yes") await C.acceptInvite(id, me); else await C.declineInvite(id, me);
        window.AppPopup && window.AppPopup.toast(act === "inv-yes" ? { bn: "গ্রুপে যোগ দিয়েছো", en: "Joined the group" } : { bn: "আমন্ত্রণ বাদ দেওয়া হয়েছে", en: "Invitation declined" }, "success");
        dismiss(card, act === "inv-yes" ? 1 : -1);
      } catch (err) {
        b.disabled = false;
        window.AppPopup && window.AppPopup.toast(err.message || { bn: "কাজটি সম্পন্ন করা যায়নি।", en: "Couldn't complete this action." }, "error");
      }
    }
  });

  /* ---- inline composer ---- */
  function closeAllComposers(silent) {
    list.querySelectorAll(".nx-card.nx-open").forEach(c => closeComposer(c, silent));
  }
  function closeComposer(card, silent) {
    const box = card.querySelector(".nx-composer");
    if (!box || box.hidden) return;
    if (box.__stop) box.__stop();
    box.hidden = true; box.innerHTML = "";
    card.classList.remove("nx-open");
    busy(false);
    if (!silent) poke();
  }
  function toggleComposer(card) {
    const box = card.querySelector(".nx-composer");
    if (!box) return;
    if (!box.hidden) { closeComposer(card); return; }
    closeAllComposers();
    openComposer(card, box);
  }

  async function openComposer(card, box) {
    busy(true);
    card.classList.add("nx-open");
    box.hidden = false;
    box.innerHTML = `<div class="nx-wait on">${T("লোড হচ্ছে…", "Loading…")}</div>`;
    const stops = [];
    box.__stop = () => stops.forEach(f => { try { f(); } catch (e) {} });
    try {
      const C = await import("./chat-utils.js");
      const hook = window.__nxNotif, me = hook.me;
      let room = card.dataset.room ? hook.getRoom(card.dataset.room) : null;
      if (!room && card.dataset.replyTo) room = await C.ensureDm(me, card.dataset.replyTo);
      if (!room) throw new Error(T("চ্যাট খোলা যায়নি।", "Couldn't open the chat."));
      if (box.hidden) return;                     // closed while loading
      let serverLast = await C.loadChatMeta(me);
      let sel = null, cat = "greet";

      box.innerHTML = `
        <div class="nx-thread" role="log" aria-live="polite"></div>
        <div class="nx-cats" role="tablist"></div>
        <div class="nx-presets"></div>
        <div class="nx-wait"></div>
        <div class="nx-sendbar"><div class="nx-sel">${T("একটি বার্তা বেছে নাও", "Pick a message")}</div>
          <button type="button" class="nx-send" aria-label="${T("পাঠাও", "Send")}" disabled><svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.3 10l12.6 2-12.6 2z"/></svg></button></div>
        <div class="nx-err" hidden></div>`;
      const thread = box.querySelector(".nx-thread"), cats = box.querySelector(".nx-cats"), pres = box.querySelector(".nx-presets");
      const waitEl = box.querySelector(".nx-wait"), selEl = box.querySelector(".nx-sel"), sendBtn = box.querySelector(".nx-send"), errEl = box.querySelector(".nx-err");

      // live mini thread
      const nm = id => String(hook.names[id] || "").split(/\s+/)[0];
      const unsub = C.watchMessages(room.id, msgs => {
        const vis = msgs.filter(m => !m.deletedForAll && !(m.deletedFor || []).includes(me)).slice(-THREAD_SHOW);
        thread.innerHTML = vis.map(m => {
          const p = C.presetByKey(m.key), line = p ? C.presetLine(p) : m.text;
          const mine = m.from === me, emo = p && C.isEmojiOnly(p);
          const who = !mine && room.type === "group" ? `<small>${esc(nm(m.from))}</small>` : "";
          return `<div class="nx-b${mine ? " me" : ""}${emo ? " big" : ""}">${who}${esc(line)}</div>`;
        }).join("");
        thread.style.display = vis.length ? "" : "none";
        thread.scrollTop = thread.scrollHeight;
      }, () => {});
      stops.push(unsub);

      // categories + presets
      cats.innerHTML = C.CHAT_CATS.map(c => `<button type="button" class="nx-cat${c.key === cat ? " on" : ""}" data-cat="${c.key}">${c.emoji} ${esc(c.label)}</button>`).join("");
      const paintPresets = () => {
        pres.innerHTML = C.CHAT_PRESETS.filter(p => p.cat === cat).map(p =>
          `<button type="button" class="nx-pre${C.isEmojiOnly(p) ? " emo" : ""}${sel && sel.key === p.key ? " sel" : ""}" data-key="${p.key}">${esc(C.presetLine(p))}</button>`).join("");
      };
      paintPresets();
      cats.addEventListener("click", ev => {
        const c = ev.target.closest(".nx-cat"); if (!c) return;
        ev.stopPropagation(); cat = c.dataset.cat;
        cats.querySelectorAll(".nx-cat").forEach(x => x.classList.toggle("on", x === c));
        paintPresets();
      });
      pres.addEventListener("click", ev => {
        const p = ev.target.closest(".nx-pre"); if (!p) return;
        ev.stopPropagation(); sel = C.presetByKey(p.dataset.key);
        pres.querySelectorAll(".nx-pre").forEach(x => x.classList.toggle("sel", x === p));
        selEl.textContent = C.presetLine(sel); selEl.classList.add("has"); errEl.hidden = true;
        refreshSend();
      });

      // cooldown ticker
      const refreshSend = () => {
        const w = C.chatWaitMs(me, serverLast);
        if (w > 0) {
          const s = Math.ceil(w / 1000);
          waitEl.classList.add("on");
          waitEl.innerHTML = T(`আরও <b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}</b> পরে পাঠাতে পারবে`, `You can send again in <b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}</b>`);
        } else waitEl.classList.remove("on");
        sendBtn.disabled = !sel || w > 0;
      };
      refreshSend();
      const iv = setInterval(refreshSend, 1000);
      stops.push(() => clearInterval(iv));

      // mark as read as soon as the reply box opens (like opening the chat)
      if (Number(room.unread && room.unread[me]) > 0) C.markRead(room.id, me).catch(() => {});

      // send
      sendBtn.addEventListener("click", async ev => {
        ev.stopPropagation();
        if (!sel || sendBtn.disabled) return;
        sendBtn.disabled = true; errEl.hidden = true;
        try {
          await C.sendMessage(room, me, sel, serverLast);
          stops.forEach(f => { try { f(); } catch (e) {} }); stops.length = 0;
          box.innerHTML = `<div class="nx-ok"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.2 4.2L19 7"/></svg>${T("পাঠানো হয়েছে", "Sent")}</div>`;
          C.markRead(room.id, me).catch(() => {});
          setTimeout(() => { dismiss(card, 1).then(() => poke()); }, 850);   // dismiss() closes the composer itself
        } catch (err) {
          errEl.hidden = false; errEl.textContent = window.AppPopup ? window.AppPopup.t(err.message || "") : err.message;
          refreshSend();
        }
      });
    } catch (err) {
      box.innerHTML = `<div class="nx-err">${esc(window.AppPopup ? window.AppPopup.t(err.message || "") : err.message || "")}</div>`;
    }
  }

  /* ---- swipe the sheet down to close (phones) ---- */
  const dragZone = [panel.querySelector(".nx-grab"), panel.querySelector(".global-notification-head")];
  dragZone.forEach(z => {
    if (!z) return;
    let sy = 0, dy = 0, on = false, pid = null;
    z.addEventListener("pointerdown", e => { if (!isPhone() || e.target.closest("button")) return; sy = e.clientY; dy = 0; on = true; pid = e.pointerId; try { z.setPointerCapture(pid); } catch (er) {} panel.style.transition = "none"; });
    z.addEventListener("pointermove", e => { if (!on) return; dy = Math.max(0, e.clientY - sy); panel.style.transform = `translateY(${dy}px)`; backdrop.style.opacity = String(1 - Math.min(1, dy / 320)); });
    const up = () => { if (!on) return; on = false; panel.style.transition = ""; backdrop.style.opacity = "";
      if (dy > 90) { panel.style.transform = "translateY(100%)"; setTimeout(() => { closePanel(); panel.style.transform = ""; }, 180); }
      else panel.style.transform = ""; };
    z.addEventListener("pointerup", up); z.addEventListener("pointercancel", up);
  });

  enhance();
  return true;
}

function esc(v) {
  return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------------- boot ---------------- */
function boot() {
  if (setup()) return;
  // the header is rendered by JS on every page; wait for it
  const mo = new MutationObserver(() => { if (setup()) mo.disconnect(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), 30000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
