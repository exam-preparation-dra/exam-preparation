/* =========================================================
   DESKTOP LAYOUT HELPER (PC only, >= 1024px)
   Some student pages are a single column of sections. On a wide screen we
   regroup those sections into  [ top row ] + [ main column | side column ]
   by MOVING the existing nodes into wrappers (ids / classes are untouched,
   so each page's own code keeps working). On a phone nothing is moved, and
   if the window shrinks below the breakpoint the sections go back in order.
   Re-applies itself when a page re-renders its shell.
   ========================================================= */
/* ---- collapsible sidebar: open -> icons only -> hidden (remembered) ---- */
(function () {
  var KEY = "pcNav", MODES = ["open", "mini", "off"];
  function get() { try { var v = localStorage.getItem(KEY); return MODES.indexOf(v) < 0 ? "open" : v; } catch (e) { return "open"; } }
  function set(m) { try { localStorage.setItem(KEY, m); } catch (e) {} }
  var de = document.documentElement, mode = get();
  function paint() {
    de.classList.toggle("pc-nav-mini", mode === "mini");
    de.classList.toggle("pc-nav-off", mode === "off");
    var b = document.getElementById("pcNavToggle");
    if (b) { var t = mode === "open" ? "Menu chhoto koro" : mode === "mini" ? "Menu lukao" : "Menu kholo"; b.title = t; b.setAttribute("aria-label", t); }
  }
  paint();
  function tips() {
    document.querySelectorAll(".hdr-nav-tab").forEach(function (a) {
      var l = a.querySelector(".hdr-nav-label"); if (l && !a.title) a.title = l.textContent.trim();
    });
  }
  function build() {
    if (!document.body || !document.body.getAttribute("data-page") || document.getElementById("pcNavToggle")) return;
    var b = document.createElement("button"); b.type = "button"; b.id = "pcNavToggle"; b.className = "pc-nav-toggle";
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
    b.addEventListener("click", function () { mode = MODES[(MODES.indexOf(mode) + 1) % 3]; set(mode); paint(); });
    document.body.appendChild(b); paint(); tips();
    new MutationObserver(tips).observe(document.body, { childList: true, subtree: true });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key !== "b" && e.key !== "B") return;
    var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || (t && t.isContentEditable) || e.ctrlKey || e.metaKey || e.altKey) return;
    var b = document.getElementById("pcNavToggle"); if (b && getComputedStyle(b).display !== "none") b.click();
  });
  if (document.body) build(); else document.addEventListener("DOMContentLoaded", build);
})();

(function () {
  var CFG = {
    dashboard: {
      top:  [".d-greet", "#timerSection", "#cardReminderSection"],
      main: ["#heroSection", "#walletSection", "#upcomingSection", "#recentSection", "#installSection"],
      side: [".d-links", "#referralSection"]
    },
    // result page: summary column on the left (sticky), question review on the right
    result: {
      root: "#revealArea", reverse: true, sideRest: true,
      main: ["#reviewList", "#reviewList ~ *", "#claimMount ~ p"]
    }
  };
  var page = document.body && document.body.getAttribute("data-page");
  if (!page) { document.addEventListener("DOMContentLoaded", function () { init(); }); } else init();

  function init() {
    page = document.body.getAttribute("data-page");
    var cfg = CFG[page];
    if (!cfg || !window.matchMedia) return;
    var mq = window.matchMedia("(min-width: 1024px)");
    var shell = document.querySelector(".app-shell");
    if (!shell) return;
    var host = shell;   // element whose children get regrouped
    function getHost() { return cfg.root ? shell.querySelector(cfg.root) : shell; }
    var busy = false;

    function matches(el, list) { return list.some(function (s) { return el.matches(s); }); }
    function kids() { return Array.prototype.filter.call(host.children, function (c) { return c.tagName !== "HEADER" && c.tagName !== "NAV" && !c.classList.contains("pc-top") && !c.classList.contains("pc-cols"); }); }

    function group() {
      host = getHost(); if (!host) return;
      if (host.querySelector(":scope > .pc-cols")) return;
      var items = kids();
      if (!items.some(function (e) { return matches(e, cfg.main) || (cfg.side && matches(e, cfg.side)); })) return;   // page not rendered yet
      items.forEach(function (e, i) { e.setAttribute("data-pc-i", i); });
      var top = cfg.top ? items.filter(function (e) { return matches(e, cfg.top); }) : [];
      var side, main;
      if (cfg.sideRest) {
        main = items.filter(function (e) { return matches(e, cfg.main); });
        side = items.filter(function (e) { return main.indexOf(e) < 0; });
      } else {
        side = items.filter(function (e) { return matches(e, cfg.side); });
        main = items.filter(function (e) { return top.indexOf(e) < 0 && side.indexOf(e) < 0; });
      }
      var anchor = items.filter(function (e) { return top.indexOf(e) < 0; })[0];
      var topWrap = document.createElement("div"); topWrap.className = "pc-top";
      var cols = document.createElement("div"); cols.className = "pc-cols";
      var mainEl = document.createElement("div"); mainEl.className = "pc-main";
      var sideEl = document.createElement("div"); sideEl.className = "pc-side";
      host.insertBefore(topWrap, top[0] || anchor);
      host.insertBefore(cols, anchor);
      top.forEach(function (e) { topWrap.appendChild(e); });
      main.forEach(function (e) { mainEl.appendChild(e); });
      side.forEach(function (e) { sideEl.appendChild(e); });
      if (cfg.reverse) { cols.classList.add("pc-rev"); cols.appendChild(sideEl); cols.appendChild(mainEl); }
      else { cols.appendChild(mainEl); cols.appendChild(sideEl); }
      if (!top.length) topWrap.remove();
    }

    function ungroup() {
      host = getHost(); if (!host) return;
      var wraps = host.querySelectorAll(":scope > .pc-top, :scope > .pc-cols");
      if (!wraps.length) return;
      var all = Array.prototype.slice.call(host.querySelectorAll("[data-pc-i]"));
      all.sort(function (a, b) { return a.getAttribute("data-pc-i") - b.getAttribute("data-pc-i"); });
      var first = wraps[0];
      all.forEach(function (e) { host.insertBefore(e, first); });
      wraps.forEach(function (w) { w.remove(); });
    }

    function apply() {
      if (busy) return; busy = true;
      try { mq.matches ? group() : ungroup(); } catch (e) { console.error(e); }
      busy = false;
    }

    new MutationObserver(function () { apply(); }).observe(shell, { childList: true, subtree: !!cfg.root });
    if (mq.addEventListener) mq.addEventListener("change", apply);
    apply();
  }
})();
