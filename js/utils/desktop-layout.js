/* =========================================================
   DESKTOP LAYOUT HELPER (PC only, >= 1024px)
   Some student pages are a single column of sections. On a wide screen we
   regroup those sections into  [ top row ] + [ main column | side column ]
   by MOVING the existing nodes into wrappers (ids / classes are untouched,
   so each page's own code keeps working). On a phone nothing is moved, and
   if the window shrinks below the breakpoint the sections go back in order.
   Re-applies itself when a page re-renders its shell.
   ========================================================= */
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
