/* invite-sheet.js — shared "বন্ধুকে ইনভাইট" bottom sheet (QR + how it works + share).
   Used by the avatar menu and the dashboard referral card. Self-contained: injects its own CSS. */
import { qrDataUrl } from "./qr-utils.js";
import { showToast } from "./ui-utils.js";

const STYLE_ID = "inviteSheetCss";
const CSS = `
.ivs-ov{position:fixed;inset:0;z-index:200;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,18,10,.5);opacity:0;transition:opacity .2s}
.ivs-ov.in{opacity:1}
.ivs{width:min(100%,460px);max-height:92vh;overflow:auto;background:var(--surface-solid,#fff);color:var(--text-primary,#21262f);border-radius:26px 26px 0 0;padding:10px 18px calc(22px + env(safe-area-inset-bottom));transform:translateY(40px);transition:transform .28s cubic-bezier(.22,1,.36,1);box-shadow:0 -12px 40px rgba(0,0,0,.2)}
.ivs-ov.in .ivs{transform:none}
@media(min-width:600px){.ivs-ov{align-items:center}.ivs{border-radius:26px;padding-bottom:22px}}
.ivs-grab{width:40px;height:4px;border-radius:4px;background:var(--surface-border,#ddd);margin:0 auto 14px}
.ivs-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.ivs-top h3{font-size:1.1rem;font-weight:800;margin:0}
.ivs-top p{font-size:.78rem;font-weight:600;color:var(--text-muted,#8d94a0);margin:3px 0 0;line-height:1.5}
.ivs-x{width:34px;height:34px;border-radius:50%;border:1px solid var(--surface-border,#ddd);background:transparent;color:var(--text-secondary,#555);font-size:1rem;cursor:pointer;flex:none}
.ivs-qr{margin:16px auto 0;width:200px;height:200px;padding:12px;border-radius:22px;background:#fff;border:1px solid var(--surface-border,#ddd);display:grid;place-items:center}
.ivs-qr img{display:block;width:100%;height:100%}
.ivs-id{text-align:center;margin-top:10px;font-family:var(--font-num,monospace);font-weight:700;font-size:.8rem;letter-spacing:.08em;color:var(--text-muted,#8d94a0)}
.ivs-how{margin:16px 0 0;padding:12px 14px;border-radius:16px;background:var(--surface-highlight,#faf9f5);border:1px solid var(--surface-border,#e5e2d9);display:grid;gap:10px;list-style:none}
.ivs-how li{display:flex;gap:11px;align-items:flex-start;font-size:.82rem;font-weight:600;color:var(--text-secondary,#5b6270);line-height:1.5}
.ivs-how li i{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--accent-fill);color:#fff;font-style:normal;font-weight:800;font-size:.72rem;font-family:var(--font-num,sans-serif)}
.ivs-how b{color:var(--text-primary,#21262f)}
.ivs-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.ivs-btn{display:flex;align-items:center;justify-content:center;gap:7px;min-height:46px;border-radius:14px;border:1px solid var(--surface-border,#ddd);background:var(--surface-solid,#fff);color:var(--text-primary,#21262f);font:inherit;font-weight:800;font-size:.86rem;cursor:pointer}
.ivs-btn:active{background:var(--surface-highlight,#faf9f5)}
.ivs-btn.pri{grid-column:1/-1;background:var(--accent-fill);border-color:transparent;color:#fff}
.ivs-btn svg{width:17px;height:17px}
`;
const I = {
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  msg: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 1 1 21 11.5z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'
};
const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

export const SHARE_TEXT = "আমার সাথে পরীক্ষার প্রস্তুতিতে যুক্ত হও:";

export function inviteLink(student) {
  return new URL(`../invite.html?ref=${encodeURIComponent(student.studentId)}`, window.location.href).href;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.cssText = "position:fixed;opacity:0;top:0;left:0;";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch {}
    ta.remove(); return ok;
  }
}

export async function copyInvite(student) {
  const ok = await copyText(inviteLink(student));
  showToast(ok ? "লিংক কপি হয়েছে" : "কপি করা যায়নি", ok ? "success" : "error");
  return ok;
}
export function whatsappInvite(student) {
  window.open(`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT + " " + inviteLink(student))}`, "_blank", "noopener");
}
export async function shareInvite(student) {
  const link = inviteLink(student);
  if (navigator.share) { try { await navigator.share({ title: "যুক্ত হও", text: SHARE_TEXT, url: link }); } catch {} return; }
  const ok = await copyText(`${SHARE_TEXT} ${link}`);
  showToast(ok ? "লিংক কপি হয়েছে — যেকোনো জায়গায় পেস্ট করো" : "শেয়ার সাপোর্ট নেই — লিংক কপি করো", ok ? "success" : "error");
}

export async function makeInviteQr(student, size = 512) {
  try { return qrDataUrl(inviteLink(student), size); } catch (e) { console.error("QR failed", e); return ""; }
}

export function openInviteSheet(student, { xpPerFriend } = {}) {
  if (!student) return;
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style"); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
  }
  document.querySelector(".ivs-ov")?.remove();
  const ov = document.createElement("div");
  ov.className = "ivs-ov";
  ov.innerHTML = `
    <div class="ivs" role="dialog" aria-modal="true" aria-label="ইনভাইট QR">
      <div class="ivs-grab"></div>
      <div class="ivs-top">
        <div><h3>আমার ইনভাইট QR</h3><p>বন্ধু স্ক্যান করলেই তোমার সাথে যুক্ত হবে${xpPerFriend ? ` — প্রতি বন্ধুতে <b>+${xpPerFriend} XP</b>` : ""}</p></div>
        <button type="button" class="ivs-x" aria-label="বন্ধ করো">✕</button>
      </div>
      <div class="ivs-qr"><div class="spinner"></div></div>
      <div class="ivs-id">${String(student.studentId || "").replace(/[<>&"]/g, "")}</div>
      <ol class="ivs-how">
        <li><i>১</i><span>বন্ধুর ফোনের <b>ক্যামেরা</b> দিয়ে এই QR স্ক্যান করতে বলো (বা লিংক পাঠাও)।</span></li>
        <li><i>২</i><span>সে নতুন অ্যাকাউন্টের আবেদন করবে, তোমার রেফারেল <b>আপনা-আপনি</b> বসে যাবে।</span></li>
        <li><i>৩</i><span>অ্যাডমিন অনুমোদন করলেই তোমার অ্যাকাউন্টে <b>XP</b> জমা হবে।</span></li>
      </ol>
      <div class="ivs-acts">
        <button type="button" class="ivs-btn pri" data-a="share">${ico("share")} শেয়ার করো</button>
        <button type="button" class="ivs-btn" data-a="copy">${ico("copy")} লিংক কপি</button>
        <button type="button" class="ivs-btn" data-a="wa">${ico("msg")} WhatsApp</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add("in"));
  const close = () => { ov.classList.remove("in"); setTimeout(() => ov.remove(), 220); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  ov.addEventListener("click", e => { if (e.target === ov) close(); });
  ov.querySelector(".ivs-x").onclick = close;
  ov.querySelector('[data-a="copy"]').onclick = () => copyInvite(student);
  ov.querySelector('[data-a="wa"]').onclick = () => whatsappInvite(student);
  ov.querySelector('[data-a="share"]').onclick = () => shareInvite(student);
  makeInviteQr(student).then(url => {
    const box = ov.querySelector(".ivs-qr");
    if (box) box.innerHTML = url ? `<img src="${url}" alt="QR">` : `<span style="font-size:.78rem;text-align:center;color:var(--text-muted)">QR তৈরি করা যায়নি।<br>লিংক কপি করে শেয়ার করো।</span>`;
  });
}
