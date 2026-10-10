/* =========================================================
   PERSISTENT BOTTOM NAV (phones)
   Classic script, loaded in <head> of every student page that has the tab
   bar. It puts the floating glass tab bar into <body> the instant the body
   exists — before any data loads — so the bar never disappears, never waits
   for Firestore, and sits OUTSIDE .app-shell (pages replace the shell's HTML
   when data arrives, which used to wipe the bar).

   Animation: the page remembers which tab was active on the previous page.
   The bar first paints with that tab selected, then glides to the new one:
   the glass pill slides across while the tabs stretch / shrink with a soft
   spring (same timing for both, so they stay perfectly in sync).

   Phones only (< 900px). On desktop the tabs stay in the sidebar
   (renderStudentHeader in ui-utils.js still draws them there).
   Keep the tab list in sync with renderStudentHeader().
   ========================================================= */
(function () {
  if (!window.matchMedia || !window.matchMedia("(max-width: 899.98px)").matches) return;

  var svg = function (inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
  };
  var TABS = [
    { key: "dashboard",   href: "./dashboard.html",   label: "হোম",         icon: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>') },
    { key: "calendar",    href: "./calendar.html",    label: "ক্যালেন্ডার",  icon: svg('<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18"/><path d="M8 2.8v3.4M16 2.8v3.4"/><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01"/>') },
    { key: "study",       href: "./study.html",       label: "স্টাডি",       icon: svg('<path d="M2 9.5 12 4.5l10 5-10 5-10-5z"/><path d="M6 12v4.5c0 1.4 2.7 3 6 3s6-1.6 6-3V12"/><path d="M22 9.5v6"/>') },
    { key: "leaderboard", href: "./leaderboard.html", label: "লিডারবোর্ড",  icon: svg('<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>') },
    { key: "improvement", href: "./improvement.html", label: "উন্নতি",       icon: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>') },
    { key: "profile",     href: "./profile.html",     label: "প্রোফাইল",     icon: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>') }
  ];
  // Pages that highlight another tab (same as the key they pass to renderStudentHeader).
  var ALIAS = { chat: "leaderboard", comparison: "dashboard", "study-materials": "study" };
  var W_ON = 2.6; // flex weight of the selected tab (others are 1) — keep in sync with style.css

  var file = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
  var active = ALIAS[file] || file;

  function indexOfKey(k) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].key === k) return i;
    return -1;
  }

  // pill geometry for tab #idx, computed from the same weights the CSS uses
  function pillBox(nav, idx) {
    var cs = getComputedStyle(nav);
    var padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    var gap = parseFloat(cs.columnGap || cs.gap) || 0;
    var inner = nav.clientWidth - padL - padR - gap * (TABS.length - 1);
    var total = TABS.length - 1 + W_ON;
    var left = padL, width = 0;
    for (var i = 0; i < TABS.length; i++) {
      var wi = (i === idx ? W_ON : 1) / total * inner;
      if (i === idx) { width = wi; break; }
      left += wi + gap;
    }
    return { left: left, width: width };
  }

  function mount() {
    if (!document.body || document.getElementById("hdrNavPersist")) return;
    var nav = document.createElement("nav");
    nav.className = "hdr-nav";
    nav.id = "hdrNavPersist";
    nav.setAttribute("aria-label", "প্রধান মেনু");
    nav.innerHTML = '<span class="hdr-nav-pill" aria-hidden="true"></span>' + TABS.map(function (t) {
      var on = t.key === active;
      return '<a href="' + t.href + '" class="hdr-nav-tab' + (on ? " active" : "") + '"' + (on ? ' aria-current="page"' : "") + ' aria-label="' + t.label + '">' +
        '<span class="hdr-nav-ico">' + t.icon + "</span>" +
        '<span class="hdr-nav-label">' + t.label + "</span></a>";
    }).join("");
    document.body.appendChild(nav);

    var pill = nav.querySelector(".hdr-nav-pill");
    var tabEls = nav.querySelectorAll(".hdr-nav-tab");
    var idx = indexOfKey(active);
    var prevIdx = idx;
    try {
      var p = indexOfKey(sessionStorage.getItem("navPrev") || "");
      if (p >= 0) prevIdx = p;
      if (idx >= 0) sessionStorage.setItem("navPrev", active);
    } catch (e) {}

    function place(i, animate) {
      if (i < 0) { pill.style.opacity = "0"; return; }
      var b = pillBox(nav, i);
      pill.style.opacity = "1";
      pill.style.left = b.left + "px";
      pill.style.width = b.width + "px";
    }
    function setOn(i) {
      for (var k = 0; k < tabEls.length; k++) tabEls[k].classList.toggle("on", k === i);
    }

    // 1) paint instantly in the previous state (no transition)
    nav.classList.add("nav-still");
    var start = prevIdx >= 0 ? prevIdx : idx;
    setOn(start); place(start);
    void nav.offsetWidth;
    // 2) next frames: glide to the new tab
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        nav.classList.remove("nav-still");
        setOn(idx); place(idx);
      });
    });

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        nav.classList.add("nav-still"); place(idx); void nav.offsetWidth; nav.classList.remove("nav-still");
      }, 80);
    });

    // Show the last known unread-chat count right away (ui-utils refreshes it live).
    try {
      var n = parseInt(sessionStorage.getItem("navChatBadge") || "0", 10);
      if (n > 0) {
        var ico = nav.querySelector('.hdr-nav-tab[href*="leaderboard"] .hdr-nav-ico');
        var b = document.createElement("span");
        b.className = "hdr-nav-badge";
        b.textContent = n > 9 ? "9+" : String(n);
        ico.appendChild(b);
      }
    } catch (e) {}
  }

  if (document.body) mount();
  else new MutationObserver(function (_, obs) {
    if (document.body) { obs.disconnect(); mount(); }
  }).observe(document.documentElement, { childList: true });
})();
