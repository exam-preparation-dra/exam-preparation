/* ============================================================
   popup.js — shared themed popups for every page.
   Works both as <script src="js/popup.js"> and as `import "../popup.js"`.
   Provides:  window.AppPopup.toast / confirm / alert / prompt
              window.showToast (alias)
   Text can be a string or { bn, en } (language auto-picked).
   ============================================================ */
(function () {
  if (window.AppPopup && window.AppPopup.__ready) return;

  // ---------- language ----------
  function lang() {
    try {
      var l = document.documentElement.getAttribute("data-lg") ||
        localStorage.getItem("appLang") || localStorage.getItem("lang") ||
        localStorage.getItem("legalLang") || document.documentElement.lang || "bn";
      return String(l).toLowerCase().indexOf("en") === 0 ? "en" : "bn";
    } catch (e) { return "bn"; }
  }
  function t(v, fallback) {
    if (v == null) return fallback || "";
    if (typeof v === "object") return v[lang()] || v.bn || v.en || fallback || "";
    return String(v);
  }

  // ---------- styles ----------
  var css = "\
.ap-toast-wrap{position:fixed;left:0;right:0;bottom:calc(24px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center;gap:8px;z-index:100000;pointer-events:none}\
.ap-toast{pointer-events:auto;max-width:90vw;padding:12px 20px;border-radius:14px;background:var(--surface-solid,#fff);color:var(--text-primary,#222);border:1px solid var(--surface-border,rgba(0,0,0,.12));box-shadow:var(--shadow-lift,0 8px 24px rgba(0,0,0,.2));font-size:.9rem;font-weight:600;line-height:1.5;opacity:0;transform:translateY(12px);transition:opacity .25s ease,transform .25s ease}\
.ap-toast.show{opacity:1;transform:none}\
.ap-toast.ap-error{border-color:var(--color-danger,#a6402f);color:var(--color-danger,#a6402f)}\
.ap-toast.ap-success{border-color:var(--color-success,#2f7d5e);color:var(--color-success,#2f7d5e)}\
.ap-ov{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.5);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .2s ease}\
.ap-ov.show{opacity:1}\
.ap-box{width:100%;max-width:380px;background:var(--surface-solid,#fff);color:var(--text-primary,#222);border:1px solid var(--surface-border,rgba(0,0,0,.12));border-radius:18px;box-shadow:var(--shadow-lift,0 16px 48px rgba(0,0,0,.35));padding:22px 20px 16px;transform:scale(.94);transition:transform .25s cubic-bezier(.16,1,.3,1)}\
.ap-ov.show .ap-box{transform:none}\
.ap-title{margin:0 0 8px;font-size:1.05rem;font-weight:800}\
.ap-msg{margin:0 0 16px;font-size:.92rem;line-height:1.6;white-space:pre-wrap;word-break:break-word;color:var(--text-secondary,var(--text-primary,#444))}\
.ap-input{width:100%;box-sizing:border-box;margin:0 0 16px;padding:11px 12px;border-radius:12px;border:1px solid var(--surface-border,rgba(0,0,0,.2));background:var(--surface-solid,#fff);color:var(--text-primary,#222);font:inherit;font-size:.95rem}\
.ap-input:focus{outline:2px solid var(--color-accent,#b8863c);outline-offset:1px}\
.ap-row{display:flex;gap:10px;justify-content:flex-end}\
.ap-btn{flex:0 1 auto;min-width:88px;padding:10px 16px;border-radius:12px;border:1px solid var(--surface-border,rgba(0,0,0,.2));background:transparent;color:var(--text-primary,#222);font:inherit;font-size:.9rem;font-weight:700;cursor:pointer}\
.ap-btn.ap-ok{background:var(--color-accent,#b8863c);border-color:var(--color-accent,#b8863c);color:#fff}\
.ap-btn.ap-danger{background:var(--color-danger,#a6402f);border-color:var(--color-danger,#a6402f);color:#fff}\
.ap-btn.ap-success{background:var(--color-success,#2f7d5e);border-color:var(--color-success,#2f7d5e);color:#fff}";

  function ensureStyle() {
    if (document.getElementById("ap-style")) return;
    var s = document.createElement("style");
    s.id = "ap-style";
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---------- toast ----------
  function toast(message, type) {
    function go() {
      ensureStyle();
      var wrap = document.querySelector(".ap-toast-wrap");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "ap-toast-wrap";
        document.body.appendChild(wrap);
      }
      var el = document.createElement("div");
      el.className = "ap-toast" + (type === "error" ? " ap-error" : type === "success" ? " ap-success" : "");
      el.setAttribute("role", "status");
      el.textContent = t(message);
      wrap.appendChild(el);
      requestAnimationFrame(function () { el.classList.add("show"); });
      setTimeout(function () {
        el.classList.remove("show");
        setTimeout(function () { el.remove(); }, 300);
      }, 3000);
    }
    if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
  }

  // ---------- dialog core ----------
  function dialog(o) {
    return new Promise(function (resolve) {
      ensureStyle();
      var ov = document.createElement("div");
      ov.className = "ap-ov";
      var box = document.createElement("div");
      box.className = "ap-box";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");

      if (o.title) {
        var h = document.createElement("h3");
        h.className = "ap-title";
        h.textContent = o.title;
        box.appendChild(h);
      }
      var p = document.createElement("p");
      p.className = "ap-msg";
      p.textContent = o.message;
      box.appendChild(p);

      var input = null;
      if (o.prompt) {
        input = document.createElement("input");
        input.type = "text";
        input.className = "ap-input";
        input.value = o.value || "";
        if (o.placeholder) input.placeholder = o.placeholder;
        box.appendChild(input);
      }

      var row = document.createElement("div");
      row.className = "ap-row";
      var cancelBtn = null;
      if (o.showCancel) {
        cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "ap-btn";
        cancelBtn.textContent = o.cancelText;
        row.appendChild(cancelBtn);
      }
      var okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.className = "ap-btn " + (o.danger ? "ap-danger" : o.kind === "success" ? "ap-success" : "ap-ok");
      okBtn.textContent = o.okText;
      row.appendChild(okBtn);
      box.appendChild(row);
      ov.appendChild(box);

      var done = false;
      function close(val) {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey, true);
        ov.classList.remove("show");
        setTimeout(function () { ov.remove(); }, 220);
        resolve(val);
      }
      var cancelVal = o.prompt ? null : false;
      function ok() { close(o.prompt ? input.value : true); }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); close(o.showCancel ? cancelVal : (o.prompt ? null : true)); }
        else if (e.key === "Enter" && (o.prompt || document.activeElement === okBtn)) { e.preventDefault(); ok(); }
      }
      okBtn.addEventListener("click", ok);
      if (cancelBtn) cancelBtn.addEventListener("click", function () { close(cancelVal); });
      ov.addEventListener("mousedown", function (e) {
        if (e.target === ov && o.showCancel) close(cancelVal);
      });
      document.addEventListener("keydown", onKey, true);

      function mount() {
        document.body.appendChild(ov);
        requestAnimationFrame(function () { ov.classList.add("show"); });
        setTimeout(function () { (input || okBtn).focus(); if (input) input.select(); }, 30);
      }
      if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
    });
  }

  function confirmFn(message, opts) {
    opts = opts || {};
    return dialog({
      message: t(message),
      title: t(opts.title),
      okText: t(opts.okText, lang() === "en" ? "Yes" : "হ্যাঁ"),
      cancelText: t(opts.cancelText, lang() === "en" ? "Cancel" : "বাতিল"),
      danger: !!opts.danger,
      showCancel: true
    });
  }

  function alertFn(message, opts) {
    opts = opts || {};
    return dialog({
      message: t(message),
      title: t(opts.title),
      okText: t(opts.okText, "OK"),
      danger: opts.type === "error",
      kind: opts.type,
      showCancel: false
    });
  }

  function promptFn(message, value, opts) {
    opts = opts || {};
    return dialog({
      message: t(message),
      title: t(opts.title),
      okText: t(opts.okText, "OK"),
      cancelText: t(opts.cancelText, lang() === "en" ? "Cancel" : "বাতিল"),
      placeholder: t(opts.placeholder),
      value: value == null ? "" : String(value),
      prompt: true,
      showCancel: true
    });
  }

  window.AppPopup = { __ready: true, toast: toast, confirm: confirmFn, alert: alertFn, prompt: promptFn };
  if (typeof window.showToast !== "function") window.showToast = toast;
})();
