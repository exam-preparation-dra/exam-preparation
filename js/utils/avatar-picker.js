/* =========================================================
   AVATAR PICKER — bottom-sheet with the animated faces.
   openAvatarPicker({ current, onPick }) -> onPick(uri | null) is awaited;
   it may throw (the sheet shows the error and stays open).
   ========================================================= */
import { FACE_URIS } from "./avatar-faces.js";

const STYLE_ID = "avpk-style";
const CSS = `
.avpk{position:fixed;inset:0;z-index:10050;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55);animation:avpkIn .2s ease}
.avpk-card{width:min(440px,100%);max-height:88dvh;overflow:auto;padding:18px 16px calc(16px + env(safe-area-inset-bottom));border-radius:24px 24px 0 0;background:var(--surface,#fff);color:var(--text-primary,#222);border:1px solid var(--surface-border,#e5e2d9);box-shadow:0 -10px 40px rgba(0,0,0,.25);animation:avpkUp .28s cubic-bezier(.2,.8,.2,1)}
@media(min-width:560px){.avpk{align-items:center}.avpk-card{border-radius:24px}}
.avpk-card h3{margin:0 0 2px;font-size:1.08rem;font-weight:900}
.avpk-card p{margin:0 0 14px;font-size:.78rem;font-weight:700;color:var(--text-secondary,#666)}
.avpk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.avpk-it{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:0;border:0;background:none;cursor:pointer;color:inherit;font:inherit;-webkit-tap-highlight-color:transparent}
.avpk-it .im{width:100%;aspect-ratio:1;border-radius:22px;overflow:hidden;border:3px solid transparent;box-shadow:0 4px 14px rgba(0,0,0,.12);transition:transform .15s,border-color .15s}
.avpk-it .im img{width:100%;height:100%;display:block;pointer-events:none}
.avpk-it:active .im{transform:scale(.93)}
.avpk-it.sel .im{border-color:var(--color-accent,#b8863c);transform:scale(1.04)}
.avpk-it.sel::after{content:"✓";position:absolute;top:-4px;right:-2px;width:20px;height:20px;border-radius:50%;background:var(--color-accent,#b8863c);color:#fff;font-size:.72rem;font-weight:900;display:grid;place-items:center}
.avpk-it small{font-size:.66rem;font-weight:800;color:var(--text-secondary,#666);white-space:nowrap}
.avpk-err{min-height:18px;margin:10px 0 0;font-size:.78rem;font-weight:800;color:#ef4444}
.avpk-row{display:flex;gap:10px;margin-top:10px}
.avpk-row button{flex:1;padding:13px;border-radius:14px;font:inherit;font-weight:900;font-size:.88rem;cursor:pointer;border:1px solid var(--surface-border,#ddd);background:rgba(128,128,128,.08);color:var(--text-primary,#222)}
.avpk-row .rm{color:#ef4444;border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.06)}
.avpk-row button:disabled,.avpk-it:disabled{opacity:.5;pointer-events:none}
@keyframes avpkIn{from{opacity:0}to{opacity:1}}
@keyframes avpkUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
`;

export function openAvatarPicker({ current = "", onPick, title = "তোমার ফেস বেছে নাও", sub = "যেকোনো একটা ট্যাপ করো — সবখানে এটাই দেখাবে" } = {}) {
  document.getElementById("avpk")?.remove();
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const root = document.createElement("div");
  root.id = "avpk"; root.className = "avpk"; root.setAttribute("role", "dialog");
  root.innerHTML = `<div class="avpk-card">
    <h3>${title}</h3><p>${sub}</p>
    <div class="avpk-grid">${FACE_URIS.map(f => `
      <button type="button" class="avpk-it${f.uri === current ? " sel" : ""}" data-uri="${f.id}">
        <span class="im"><img src="${f.uri}" alt=""></span><small>${f.label}</small>
      </button>`).join("")}
    </div>
    <p class="avpk-err" id="avpkErr"></p>
    <div class="avpk-row">
      ${current ? `<button type="button" class="rm" id="avpkRm">ছবি সরাও</button>` : ""}
      <button type="button" id="avpkClose">বন্ধ করো</button>
    </div>
  </div>`;
  document.body.appendChild(root);

  const err = root.querySelector("#avpkErr");
  const close = () => root.remove();
  const busy = (b) => root.querySelectorAll("button").forEach(x => x.disabled = b);
  const pick = async (uri) => {
    err.textContent = "";
    busy(true);
    try { await onPick(uri); close(); }
    catch (e) { console.error(e); err.textContent = "সেভ করা যায়নি। আবার চেষ্টা করো।"; busy(false); }
  };

  root.addEventListener("click", (e) => {
    if (e.target === root) return close();
    const it = e.target.closest(".avpk-it");
    if (it) return pick(FACE_URIS.find(f => f.id === it.dataset.uri).uri);
    if (e.target.id === "avpkRm") return pick(null);
    if (e.target.id === "avpkClose") return close();
  });
}
