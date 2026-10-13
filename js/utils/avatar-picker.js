/* =========================================================
   AVATAR PICKER — bottom sheet with two tabs:
     • অবতার : build an animated girl / boy avatar (hair, look, expression,
               dress with the first letter of the student's name, colours,
               glasses, extras, background) — see avatar-builder.js
     • ফেস   : the ready-made animated faces (avatar-faces.js)

   openAvatarPicker({ current, onPick, name }) -> onPick(uri | null) is
   awaited; it may throw (the sheet shows the error and stays open).
   `current` is the saved photoURL: if it came from the avatar builder the
   editor re-opens with the same choices.
   ========================================================= */
import { FACE_URIS } from "./avatar-faces.js";
import {
  SKINS, HAIR_COLORS, DRESS_COLORS, BACKGROUNDS, EYE_COLORS, PATTERNS, HAIRS, EYES, MOUTHS, DRESSES, GLASSES,
  extrasFor, defaultConfig, normalizeConfig, avatarUri, parseAvatarConfig
} from "./avatar-builder.js";

const STYLE_ID = "avpk-style";
const CSS = `
.avpk{position:fixed;inset:0;z-index:10050;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55);animation:avpkIn .2s ease}
.avpk-card{display:flex;flex-direction:column;width:min(480px,100%);max-height:92dvh;border-radius:26px 26px 0 0;background:var(--surface-solid,var(--surface,#fff));color:var(--text-primary,#222);animation:avpkUp .28s cubic-bezier(.2,.9,.3,1);overflow:hidden}
@media(min-width:560px){.avpk{align-items:center}.avpk-card{border-radius:26px}}
.avpk-top{flex:none;padding:16px 16px 0}
.avpk-top h3{margin:0 0 2px;font-size:1.08rem;font-weight:900}
.avpk-top p{margin:0 0 12px;font-size:.78rem;font-weight:700;color:var(--text-secondary,#666)}
.avpk-tabs{display:flex;gap:4px;padding:4px;border-radius:16px;background:var(--surface-highlight,rgba(128,128,128,.12));border:1px solid var(--surface-border,#ddd)}
.avpk-tabs button{flex:1;padding:10px 4px;border:0;border-radius:12px;background:none;color:var(--text-secondary,#666);font:inherit;font-size:.84rem;font-weight:800;cursor:pointer}
.avpk-tabs button.on{background:var(--surface-solid,#fff);color:var(--color-accent,#b8863c);box-shadow:0 3px 10px rgba(0,0,0,.12),inset 0 0 0 1px rgba(184,134,60,.25)}
.avpk-body{flex:1;min-height:0;overflow:auto;padding:14px 16px;-webkit-overflow-scrolling:touch}
.avpk-foot{flex:none;padding:10px 16px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--surface-border,#ddd);background:var(--surface-solid,var(--surface,#fff))}
.avpk-err{min-height:16px;margin:0 0 8px;font-size:.78rem;font-weight:800;color:#ef4444}
.avpk-row{display:flex;gap:10px}
.avpk-row button{flex:1;padding:13px;border-radius:14px;font:inherit;font-weight:900;font-size:.88rem;cursor:pointer;border:1px solid var(--surface-border,#ddd);background:rgba(128,128,128,.08);color:inherit}
.avpk-row .pri{background:var(--color-accent,#b8863c);border-color:transparent;color:#fff;flex:1.6}
.avpk-row .rm{color:#ef4444;border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.06)}
.avpk-row button:disabled,.avpk-it:disabled{opacity:.5;pointer-events:none}

/* ---- avatar editor ---- */
.avb-stage{display:flex;align-items:center;gap:14px}
.avb-prev{position:relative;flex:none;width:128px;height:128px;border-radius:34px;overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,.28);border:3px solid var(--surface-solid,#fff);outline:2px solid rgba(184,134,60,.55)}
.avb-prev img{display:block;width:100%;height:100%}
.avb-gen{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0}
.avb-gen small{font-size:.72rem;font-weight:800;color:var(--text-muted,#888)}
.avb-g{display:flex;gap:8px}
.avb-g button{flex:1;display:flex;align-items:center;gap:8px;padding:6px 8px 6px 6px;border-radius:16px;border:2px solid var(--surface-border,#ddd);background:var(--surface,#fff);color:inherit;font:inherit;font-size:.84rem;font-weight:800;cursor:pointer}
.avb-g button img{width:36px;height:36px;border-radius:12px;display:block}
.avb-g button.on{border-color:var(--color-accent,#b8863c);background:rgba(184,134,60,.12);color:var(--color-accent,#b8863c)}
.avb-cats{display:flex;gap:8px;overflow-x:auto;margin:16px -16px 0;padding:2px 16px 6px;scrollbar-width:none}
.avb-cats::-webkit-scrollbar{display:none}
.avb-cats button{flex:none;padding:8px 13px;border-radius:99px;border:1px solid var(--surface-border,#ddd);background:var(--surface,#fff);color:var(--text-secondary,#666);font:inherit;font-size:.78rem;font-weight:800;cursor:pointer;white-space:nowrap}
.avb-cats button.on{background:var(--color-accent,#b8863c);border-color:transparent;color:#fff}
.avb-opts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}
.avb-opts.col{grid-template-columns:repeat(6,1fr);gap:9px}
.avb-o{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer}
.avb-o .t{position:relative;width:100%;aspect-ratio:1;border-radius:20px;overflow:hidden;border:3px solid transparent;box-shadow:0 3px 10px rgba(0,0,0,.12);transition:transform .15s,border-color .15s}
.avb-o .t img{display:block;width:100%;height:100%;pointer-events:none}
.avb-o.sel .t{border-color:var(--color-accent,#b8863c);transform:scale(1.04)}
.avb-o.sel::after{content:"✓";position:absolute;top:-4px;right:-3px;width:19px;height:19px;border-radius:50%;background:var(--color-accent,#b8863c);color:#fff;font-size:.7rem;font-weight:900;display:grid;place-items:center}
.avb-o small{font-size:.64rem;font-weight:800;color:var(--text-secondary,#666);text-align:center;line-height:1.25}
.avb-sw{width:100%;aspect-ratio:1;border-radius:50%;border:3px solid transparent;box-shadow:0 0 0 1px rgba(0,0,0,.12) inset,0 3px 8px rgba(0,0,0,.15)}
.avb-o.sel .avb-sw{border-color:var(--surface-solid,#fff);outline:3px solid var(--color-accent,#b8863c)}
.avb-tog{display:flex;align-items:center;gap:12px;width:100%;margin-top:12px;padding:14px;border-radius:16px;border:1px solid var(--surface-border,#ddd);background:var(--surface,#fff);color:inherit;font:inherit;text-align:left;cursor:pointer}
.avb-tog b{display:block;font-size:.88rem;font-weight:800}
.avb-tog span.d{display:block;margin-top:2px;font-size:.72rem;font-weight:700;color:var(--text-muted,#888)}
.avb-sw2{flex:none;position:relative;width:46px;height:27px;border-radius:99px;background:rgba(128,128,128,.4);transition:background .2s}
.avb-sw2::after{content:"";position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3);transition:transform .25s cubic-bezier(.34,1.56,.64,1)}
.avb-tog.on .avb-sw2{background:var(--color-accent,#b8863c)}
.avb-tog.on .avb-sw2::after{transform:translateX(19px)}

/* ---- faces tab ---- */
.avpk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.avpk-it{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:0;border:0;background:none;cursor:pointer;color:inherit;font:inherit;-webkit-tap-highlight-color:transparent}
.avpk-it .im{width:100%;aspect-ratio:1;border-radius:22px;overflow:hidden;border:3px solid transparent;box-shadow:0 4px 14px rgba(0,0,0,.12);transition:transform .15s,border-color .15s}
.avpk-it .im img{width:100%;height:100%;display:block;pointer-events:none}
.avpk-it.sel .im{border-color:var(--color-accent,#b8863c);transform:scale(1.04)}
.avpk-it.sel::after{content:"✓";position:absolute;top:-4px;right:-2px;width:20px;height:20px;border-radius:50%;background:var(--color-accent,#b8863c);color:#fff;font-size:.72rem;font-weight:900;display:grid;place-items:center}
.avpk-it small{font-size:.66rem;font-weight:800;color:var(--text-secondary,#666);white-space:nowrap}
@keyframes avpkIn{from{opacity:0}to{opacity:1}}
@keyframes avpkUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
`;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function openAvatarPicker({
  current = "", onPick, name = "",
  title = "তোমার প্রোফাইল ছবি", sub = "নিজের অবতার সাজাও, অথবা রেডি ফেস বেছে নাও — সবখানে অ্যানিমেটেড থাকবে।"
} = {}) {
  document.getElementById("avpk")?.remove();
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID; st.textContent = CSS;
    document.head.appendChild(st);
  }

  let cfg = parseAvatarConfig(current) || defaultConfig("f");
  let tab = "avatar";
  let cat = "h";

  const CATS = [
    { id: "h", label: "হেয়ারস্টাইল", type: "style", opts: g => HAIRS[g].map((l, v) => ({ v, l })) },
    { id: "hc", label: "চুলের রঙ", type: "color", opts: () => HAIR_COLORS.map((c, v) => ({ v, c })) },
    { id: "ey", label: "চোখের লুক", type: "style", opts: () => EYES.map((l, v) => ({ v, l })) },
    { id: "ec", label: "চোখের রঙ", type: "color", opts: () => EYE_COLORS.map((c, v) => ({ v, c })) },
    { id: "mo", label: "এক্সপ্রেশন", type: "style", opts: () => MOUTHS.map((l, v) => ({ v, l })) },
    { id: "dr", label: "পোশাক", type: "style", opts: g => DRESSES[g].map((l, v) => ({ v, l })) },
    { id: "dc", label: "পোশাকের রঙ", type: "color", opts: () => DRESS_COLORS.map((c, v) => ({ v, c })) },
    { id: "d2", label: "দ্বিতীয় রঙ", type: "color", opts: () => DRESS_COLORS.map((c, v) => ({ v, c })) },
    { id: "pt", label: "প্যাটার্ন", type: "style", opts: () => PATTERNS.map((l, v) => ({ v, l })) },
    { id: "gl", label: "চশমা", type: "style", opts: () => GLASSES.map((l, v) => ({ v, l })) },
    { id: "ex", label: "এক্সট্রা", type: "style", opts: g => extrasFor(g).map(e => ({ v: e.id, l: e.label })) },
    { id: "sk", label: "স্কিন টোন", type: "color", opts: () => SKINS.map((c, v) => ({ v, c })) },
    { id: "bg", label: "ব্যাকগ্রাউন্ড", type: "color", opts: () => BACKGROUNDS.map((p, v) => ({ v, c: `linear-gradient(135deg,${p[0]},${p[1]})` })) },
    { id: "ini", label: "নাম", type: "toggle" }
  ];

  const root = document.createElement("div");
  root.id = "avpk"; root.className = "avpk"; root.setAttribute("role", "dialog");
  root.innerHTML = `<div class="avpk-card">
    <div class="avpk-top">
      <h3>${esc(title)}</h3><p>${esc(sub)}</p>
      <div class="avpk-tabs"><button type="button" data-tab="avatar">অবতার বানাও</button><button type="button" data-tab="faces">রেডি ফেস</button></div>
    </div>
    <div class="avpk-body" id="avpkBody"></div>
    <div class="avpk-foot">
      <p class="avpk-err" id="avpkErr"></p>
      <div class="avpk-row" id="avpkRow"></div>
    </div>
  </div>`;
  document.body.appendChild(root);

  const $ = s => root.querySelector(s);
  const err = $("#avpkErr");
  const close = () => root.remove();
  const busy = b => root.querySelectorAll("button").forEach(x => x.disabled = b);
  const pick = async uri => {
    err.textContent = ""; busy(true);
    try { await onPick(uri); close(); }
    catch (e) { console.error(e); err.textContent = "সেভ করা যায়নি। আবার চেষ্টা করো।"; busy(false); }
  };

  const thumb = (patch) => avatarUri({ ...cfg, ...patch }, name, false);

  function renderOptions() {
    const c = CATS.find(x => x.id === cat);
    const box = $("#avbOpts");
    if (!box) return;
    if (c.type === "toggle") {
      box.className = "";
      box.innerHTML = `<button type="button" class="avb-tog ${cfg.ini ? "on" : ""}" data-toggle="ini">
        <span style="flex:1"><b>পোশাকে পুরো নাম</b><span class="d">${name ? `তোমার পোশাকে “${esc(name.trim().replace(/\s+/g, " ").slice(0, 26))}” লেখা থাকবে` : "পোশাকে তোমার পুরো নাম লেখা থাকবে"}</span></span>
        <span class="avb-sw2"></span></button>`;
      return;
    }
    const opts = c.opts(cfg.g);
    box.className = "avb-opts" + (c.type === "color" ? " col" : "");
    box.innerHTML = opts.map(o => c.type === "color"
      ? `<button type="button" class="avb-o ${cfg[c.id] === o.v ? "sel" : ""}" data-k="${c.id}" data-v="${o.v}" aria-label="রঙ ${o.v + 1}"><span class="avb-sw" style="background:${o.c}"></span></button>`
      : `<button type="button" class="avb-o ${cfg[c.id] === o.v ? "sel" : ""}" data-k="${c.id}" data-v="${o.v}"><span class="t"><img src="${thumb({ [c.id]: o.v })}" alt=""></span><small>${esc(o.l)}</small></button>`
    ).join("");
  }

  function renderCats() {
    $("#avbCats").innerHTML = CATS.map(c => `<button type="button" class="${c.id === cat ? "on" : ""}" data-cat="${c.id}">${c.label}</button>`).join("");
  }

  function renderPreview() {
    const im = $("#avbPrev img");
    if (im) im.src = avatarUri(cfg, name, true);
    root.querySelectorAll(".avb-g button").forEach(b => b.classList.toggle("on", b.dataset.g === cfg.g));
  }

  function renderAvatarTab() {
    $("#avpkBody").innerHTML = `
      <div class="avb-stage">
        <div class="avb-prev" id="avbPrev"><img alt="" src="${avatarUri(cfg, name, true)}"></div>
        <div class="avb-gen">
          <small>কে তুমি?</small>
          <div class="avb-g">
            <button type="button" data-g="f" class="${cfg.g === "f" ? "on" : ""}"><img alt="" src="${avatarUri(defaultConfig("f"), name, false)}">মেয়ে</button>
            <button type="button" data-g="m" class="${cfg.g === "m" ? "on" : ""}"><img alt="" src="${avatarUri(defaultConfig("m"), name, false)}">ছেলে</button>
          </div>
        </div>
      </div>
      <div class="avb-cats" id="avbCats"></div>
      <div id="avbOpts"></div>`;
    renderCats(); renderOptions();
    $("#avpkRow").innerHTML = `
      ${current ? `<button type="button" class="rm" data-act="rm">ছবি সরাও</button>` : ""}
      <button type="button" class="pri" data-act="save">সেভ করো</button>`;
  }

  function renderFacesTab() {
    $("#avpkBody").innerHTML = `<div class="avpk-grid">${FACE_URIS.map(f => `
      <button type="button" class="avpk-it${f.uri === current ? " sel" : ""}" data-face="${f.id}">
        <span class="im"><img src="${f.uri}" alt=""></span><small>${f.label}</small>
      </button>`).join("")}</div>`;
    $("#avpkRow").innerHTML = `
      ${current ? `<button type="button" class="rm" data-act="rm">ছবি সরাও</button>` : ""}
      <button type="button" data-act="close">বন্ধ করো</button>`;
  }

  function showTab(t) {
    tab = t;
    root.querySelectorAll(".avpk-tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
    err.textContent = "";
    t === "avatar" ? renderAvatarTab() : renderFacesTab();
  }

  root.addEventListener("click", (e) => {
    if (e.target === root) return close();
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.tab) return showTab(t.dataset.tab);
    if (t.dataset.face) return pick(FACE_URIS.find(f => f.id === t.dataset.face).uri);
    if (t.dataset.act === "rm") return pick(null);
    if (t.dataset.act === "close") return close();
    if (t.dataset.act === "save") return pick(avatarUri(cfg, name, true));
    if (t.dataset.cat) { cat = t.dataset.cat; renderCats(); renderOptions(); return; }
    if (t.dataset.toggle) { cfg = { ...cfg, ini: cfg.ini ? 0 : 1 }; renderPreview(); renderOptions(); return; }
    if (t.dataset.g) {
      if (cfg.g === t.dataset.g) return;
      // switching boy/girl keeps skin, background and dress colour; style choices restart
      const d = defaultConfig(t.dataset.g);
      cfg = normalizeConfig({ ...d, sk: cfg.sk, bg: cfg.bg, dc: cfg.dc, ini: cfg.ini });
      cat = "h"; renderPreview(); renderCats(); renderOptions(); return;
    }
    if (t.dataset.k) {
      cfg = normalizeConfig({ ...cfg, [t.dataset.k]: +t.dataset.v });
      renderPreview();
      // the other thumbnails depend on this choice too, so refresh the grid
      renderOptions();
    }
  });

  showTab("avatar");
}
