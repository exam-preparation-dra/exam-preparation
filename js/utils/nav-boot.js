/* =========================================================
   PERSISTENT BOTTOM NAV (phones)
   Classic script, loaded in <head> of every student page that has the tab
   bar. It puts the floating tab bar into <body> the instant the body exists
   — before any data loads — so the bar never disappears, never waits for
   Firestore, and sits OUTSIDE .app-shell (pages replace the shell's HTML
   when data arrives, which used to wipe the bar).
   Phones only (< 900px). On desktop the tabs stay inline in the page header
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
    { key: "leaderboard", href: "./leaderboard.html", label: "লিডারবোর্ড",  icon: svg('<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>') },
    { key: "improvement", href: "./improvement.html", label: "উন্নতি",       icon: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>') },
    { key: "profile",     href: "./profile.html",     label: "প্রোফাইল",     icon: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>') }
  ];
  // Pages that highlight another tab (same as the key they pass to renderStudentHeader).
  var ALIAS = { chat: "leaderboard", comparison: "dashboard" };

  var file = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
  var active = ALIAS[file] || file;

  function mount() {
    if (!document.body || document.getElementById("hdrNavPersist")) return;
    var nav = document.createElement("nav");
    nav.className = "hdr-nav";
    nav.id = "hdrNavPersist";
    nav.setAttribute("aria-label", "প্রধান মেনু");
    nav.innerHTML = TABS.map(function (t) {
      var on = t.key === active;
      return '<a href="' + t.href + '" class="hdr-nav-tab' + (on ? " active" : "") + '"' + (on ? ' aria-current="page"' : "") + ">" +
        '<span class="hdr-nav-ico">' + t.icon + "</span>" +
        '<span class="hdr-nav-label">' + t.label + "</span></a>";
    }).join("");
    document.body.appendChild(nav);

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
