/* =========================================================
   i18n ENGINE — English by default, বাংলা on request.

   How it works
   - The pages are written in Bangla. In English mode this engine translates
     everything the page puts on screen (static HTML and anything JS adds
     later: toasts, lists, modals) using the dictionary in js/i18n/en*.js.
   - In Bangla mode nothing is translated (the dictionary isn't even loaded).
   - The choice is saved in localStorage "appLang" ("en" | "bn") — the same
     key js/popup.js already reads. Changing it reloads the page.
   - Bengali digits become 0-9 and bn-BD dates/numbers become English.

   Adding text: add  "বাংলা": "English"  to a dictionary file. For text with
   changing parts use a PATTERN:  P(/^(\d+) টি দিন$/, "$1 days").
   Unknown Bangla text is listed in  window.__i18n.missing  (or open any page
   with ?i18n=1 to see them in the console).
   Tag something  data-i18n-skip  to leave it untouched (e.g. the EN/বাংলা switch).
   ========================================================= */
(function () {
  "use strict";
  if (window.__i18n) return;
  var KEY = "appLang";

  function getLang() {
    try {
      var l = localStorage.getItem(KEY) || localStorage.getItem("legalLang");
      if (l === "en" || l === "bn") return l;
    } catch (e) {}
    return "en";
  }
  var LANG = getLang();
  var missing = {};
  var api = { lang: LANG, missing: missing };
  window.__i18n = api;

  function setLang(l) {
    if (l !== "en" && l !== "bn") return;
    try { localStorage.setItem(KEY, l); localStorage.setItem("legalLang", l); } catch (e) {}
    if (window.AppPopup && AppPopup.setLang) { try { AppPopup.setLang(l); } catch (e) {} }
    if (l !== LANG) location.reload();
  }
  api.setLang = setLang;

  /* ---------- switch UI (works in both languages) ---------- */
  var CSS = ".lang-dd{appearance:none;-webkit-appearance:none;min-height:36px;max-width:120px;padding:0 30px 0 12px;border-radius:99px;border:1px solid var(--surface-border,rgba(128,128,128,.25));color:var(--text-primary,#21262f);font:inherit;font-size:.78rem;font-weight:800;cursor:pointer;outline:none;" +
    "background:var(--surface-solid,#fff) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238d94a0' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\") no-repeat right 11px center}" +
    ".lang-dd:focus-visible{border-color:var(--color-accent,#b8863c)}" +
    "@media(max-width:420px){.lang-dd{min-height:34px;padding:0 26px 0 10px;font-size:.74rem;max-width:104px}}";
  function ensureCss() {
    if (document.getElementById("i18nCss")) return;
    var s = document.createElement("style"); s.id = "i18nCss"; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  api.switchHtml = function () {
    ensureCss();
    return '<select class="lang-dd" data-lang-select data-i18n-skip aria-label="Language">' +
      '<option value="en"' + (LANG === "en" ? " selected" : "") + '>English</option>' +
      '<option value="bn"' + (LANG === "bn" ? " selected" : "") + '>বাংলা</option></select>';
  };
  document.addEventListener("change", function (e) {
    var sel = e.target.closest && e.target.closest("[data-lang-select]");
    if (sel) setLang(sel.value);
  });
  function mountSlots() {
    var slots = document.querySelectorAll("[data-lang-slot]:not([data-lang-done])");
    for (var i = 0; i < slots.length; i++) { slots[i].setAttribute("data-lang-done", "1"); slots[i].innerHTML = api.switchHtml(); }
  }
  api.mountSlots = mountSlots;

  if (LANG !== "en") {          // Bangla: nothing to translate
    api.tr = function (s) { return s; };
    var obs0 = new MutationObserver(mountSlots);
    var init0 = function () { mountSlots(); obs0.observe(document.documentElement, { childList: true, subtree: true }); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init0); else init0();
    return;
  }

  /* ======================= ENGLISH MODE ======================= */
  var DICT = window.__I18N_DICT || {};
  var PATS = window.__I18N_PATTERNS || [];
  var BN = /[ঀ-৿]/;
  var BNDIG = /[\u09E6-\u09EF]/g, BNDIGT = /[\u09E6-\u09EF]/;
  function digits(s) { return s.replace(BNDIG, function (c) { return String(c.charCodeAt(0) - 0x09E6); }); }

  function exact(s) { return Object.prototype.hasOwnProperty.call(DICT, s) ? DICT[s] : null; }

  // translate one trimmed string; returns null when it can't be fully translated
  function tr(s) {
    var v = exact(s);
    if (v !== null) return v;
    var d = digits(s);
    if (d !== s) { v = exact(d); if (v !== null) return v; }
    for (var i = 0; i < PATS.length; i++) {
      var m = PATS[i][0].exec(d);
      if (m) {
        var out = PATS[i][1].replace(/\$(\d)/g, function (_, n) {
          var part = m[+n] || "";
          if (BN.test(part)) { var t = tr(part.trim()); if (t !== null) return t; }
          return part;
        });
        return out;
      }
    }
    // pieces separated by · — | / newline : translate each
    var parts = d.split(/(\s*[·•|—–\n]\s*|\s+\/\s+)/);
    if (parts.length > 1) {
      var ok = true, res = parts.map(function (p, idx) {
        if (idx % 2 === 1 || !BN.test(p) || !p.trim()) return p;
        var t = tr(p.trim()); if (t === null) { ok = false; return p; }
        return t;
      });
      if (ok) return res.join("");
    }
    // trailing / leading punctuation  (e.g. "লোড হচ্ছে…", "নাম:")
    var m2 = /^([^ঀ-৿A-Za-z0-9]*)(.*?)([\s:：।!?…\.]*)$/.exec(d);
    if (m2 && m2[2] && (m2[1] || m2[3]) && m2[2] !== d) {
      var t2 = tr(m2[2]);
      if (t2 !== null) return m2[1] + t2 + m2[3].replace("।", ".");
    }
    // known phrases inside a longer string (templates with ${values}); only if nothing Bangla is left
    var ph = phrases();
    var work = d, hit = false;
    for (var k = 0; k < ph.length; k++) {
      if (work.indexOf(ph[k]) !== -1) { work = work.split(ph[k]).join("\u0001" + DICT[ph[k]] + "\u0002"); hit = true; }
    }
    if (hit) {
      var left = work.replace(/\u0001[^\u0002]*\u0002/g, "").replace(/[\u0980-\u09FF]+-?[\u0980-\u09FF]*/g, function (w) { return /^[\u0980-\u09FF]{1,3}$/.test(w) ? "" : w; });
      if (!BN.test(left)) return work.replace(/[\u0001\u0002]/g, "");
    }
    return null;
  }
  var PH = null;
  function phrases() {
    if (PH) return PH;
    PH = Object.keys(DICT).filter(function (k) { return BN.test(k) && k.length >= 4 && DICT[k] !== ""; })
      .sort(function (a, b) { return b.length - a.length; });
    return PH;
  }
  api.tr = function (s) {
    if (s == null) return s;
    s = String(s);
    if (!BN.test(s) && !BNDIGT.test(s)) return s;
    var lead = /^\s*/.exec(s)[0], tail = /\s*$/.exec(s)[0], core = s.trim();
    var t = tr(core);
    if (t === null) { if (/[\u0980-\u09E5\u09F0-\u09FF]/.test(core)) missing[core] = 1; return digits(s); }
    return lead + t + tail;
  };

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  function skipped(n) {
    for (var e = n.nodeType === 1 ? n : n.parentNode; e && e.nodeType === 1; e = e.parentNode) {
      if (SKIP[e.nodeName] || (e.hasAttribute && e.hasAttribute("data-i18n-skip"))) return true;
    }
    return false;
  }
  function doText(n) {
    var v = n.nodeValue;
    if (!v || (!BN.test(v))) return;
    if (skipped(n)) return;
    var nv = api.tr(v);
    if (nv !== v) n.nodeValue = nv;
  }
  var ATTRS = ["placeholder", "title", "aria-label", "alt", "data-tip", "data-title"];
  function doAttrs(el) {
    if (skipped(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (v && BN.test(v)) { var nv = api.tr(v); if (nv !== v) el.setAttribute(ATTRS[i], nv); }
    }
    if (el.nodeName === "INPUT" && /^(button|submit|reset)$/.test(el.type) && BN.test(el.value || "")) el.value = api.tr(el.value);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) doAttrs(root);
    var tw = document.createTreeWalker(root, 1 | 4, null), n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  function title() { var t = document.title; if (BN.test(t) || BNDIGT.test(t)) { var nt = api.tr(t); if (nt !== t) document.title = nt; } }

  var obs = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === "childList") { for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]); }
      else if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doAttrs(m.target);
    }
    title(); mountSlots();
  });
  function start() {
    document.documentElement.lang = "en";
    walk(document.documentElement); title(); mountSlots();
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    if (/[?&]i18n=1/.test(location.search)) setTimeout(function () { console.log("[i18n] untranslated:", Object.keys(missing)); }, 2500);
  }
  if (document.readyState === "loading") {
    // translate as the parser adds nodes (before first paint)
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.addEventListener("DOMContentLoaded", function () { document.documentElement.lang = "en"; walk(document.documentElement); title(); mountSlots(); });
  } else start();

  /* ---------- dates & numbers: bn-BD -> English ---------- */
  function loc(l) { return (typeof l === "string" && /^bn/i.test(l)) ? "en-GB" : (Array.isArray(l) && /^bn/i.test(l[0] || "") ? "en-GB" : l); }
  ["toLocaleDateString", "toLocaleTimeString", "toLocaleString"].forEach(function (k) {
    [Date.prototype, Number.prototype].forEach(function (P) {
      var o = P[k]; if (!o) return;
      P[k] = function (l, o2) { return o.call(this, loc(l), o2); };
    });
  });
  ["DateTimeFormat", "NumberFormat"].forEach(function (k) {
    var O = Intl[k];
    var W = function (l, o) { return new O(loc(l), o); };
    W.prototype = O.prototype; W.supportedLocalesOf = O.supportedLocalesOf;
    Intl[k] = W;
  });
})();
