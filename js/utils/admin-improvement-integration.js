/*
  ADMIN IMPROVEMENT JOURNEY INTEGRATION
  -------------------------------------
  Connects the existing Admin CMS page to the Improvement Control Center.

  Target page:
    admin.html

  This file does NOT replace the existing Admin dashboard.
  It adds one new sidebar item and one module view, while leaving
  the existing dashboard, authentication, theme and other modules intact.

  Load this file after the existing Admin page scripts:

    <script type="module" src="../js/utils/admin-improvement-integration.js"></script>

  The existing improvement-admin-control-center.js is imported by this
  integration. It keeps the actual queue/test logic in its own utility.
*/

const NAV_MODULE = "improvement-control";
const VIEW_ID = "view-improvement-control";
const ROOT_ID = "improvement-control-center";

function addImprovementStyles() {
  if (document.getElementById("improvement-admin-integration-styles")) return;

  const style = document.createElement("style");
  style.id = "improvement-admin-integration-styles";
  style.textContent = `
    .improvement-nav-badge {
      margin-left: auto;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      border: 1px solid currentColor;
      opacity: .85;
    }

    #${VIEW_ID} {
      display: none;
      width: 100%;
    }

    #${VIEW_ID}.active {
      display: block;
    }

    #${VIEW_ID} .improvement-module-host {
      width: 100%;
      min-height: 200px;
    }

    #${VIEW_ID} .improvement-module-note {
      margin: 0 0 14px;
      color: var(--text-muted, #94a3b8);
      font-size: 12px;
      line-height: 1.6;
    }
  `;

  document.head.appendChild(style);
}

function addSidebarItem() {
  const navContainer = document.getElementById("nav-container");
  if (!navContainer) return;

  if (navContainer.querySelector(`[data-module="${NAV_MODULE}"]`)) return;

  const group = document.createElement("div");
  group.className = "nav-group improvement-nav-group";
  group.style.marginTop = "20px";

  group.innerHTML = `
    <h3 class="nav-group-title">শিক্ষার্থীর উন্নতি</h3>

    <a
      class="nav-link improvement-nav-link"
      data-module="${NAV_MODULE}"
      href="#"
      aria-label="উন্নতি নিয়ন্ত্রণ কেন্দ্র"
    >
      <svg
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M4 19V5"/>
        <path d="M4 19h16"/>
        <path d="M8 16v-4"/>
        <path d="M12 16V8"/>
        <path d="M16 16V5"/>
        <path d="M20 16v-7"/>
      </svg>
      উন্নতি নিয়ন্ত্রণ কেন্দ্র
    </a>
  `;

  navContainer.appendChild(group);
}

function addModuleView() {
  const canvas = document.getElementById("content-canvas");
  if (!canvas) return;

  if (document.getElementById(VIEW_ID)) return;

  const view = document.createElement("div");
  view.className = "module-view";
  view.id = VIEW_ID;

  view.innerHTML = `
    <div class="module-header">
      <h2>উন্নতি নিয়ন্ত্রণ কেন্দ্র</h2>
      <p>শিক্ষার্থীর দুর্বলতা, উন্নতির অনুরোধ এবং অনুশীলন পরীক্ষার নিয়ন্ত্রণ এখান থেকে করা যাবে।</p>
    </div>

    <div class="improvement-module-host" id="improvement-module-host">
      <p class="improvement-module-note">
        প্রকৃত শিক্ষার্থী ফলাফল, ভুল প্রশ্ন এবং Improvement Engine-এর তথ্য এখানে লোড হবে।
      </p>
    </div>
  `;

  canvas.appendChild(view);
}

function moveControlCenterIntoModule() {
  const root = document.getElementById(ROOT_ID);
  const host = document.getElementById("improvement-module-host");

  if (!root || !host) return false;

  if (root.parentElement !== host) {
    host.innerHTML = "";
    host.appendChild(root);
  }

  return true;
}

function showImprovementModule() {
  const views = document.querySelectorAll(".module-view");
  views.forEach((view) => view.classList.remove("active"));

  const target = document.getElementById(VIEW_ID);
  if (target) target.classList.add("active");

  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => link.classList.remove("active"));

  const activeLink = document.querySelector(
    `[data-module="${NAV_MODULE}"]`
  );
  if (activeLink) activeLink.classList.add("active");

  const title = document.getElementById("top-bar-title");
  const subtitle = document.getElementById("top-bar-subtitle");

  if (title) title.textContent = "উন্নতি নিয়ন্ত্রণ কেন্দ্র";
  if (subtitle) {
    subtitle.textContent = "Improvement Journey";
    subtitle.style.display = "inline";
  }

  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.remove("mobile-open");

  moveControlCenterIntoModule();
}

function installNavigationHandler() {
  if (window.__improvementAdminNavigationInstalled) return;
  window.__improvementAdminNavigationInstalled = true;

  /*
    Capture phase is intentional:
    the existing Admin CMS has its own navigation listener.
    We handle this module first so it does not fall through to
    the existing "coming soon" branch.
  */
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest?.(
        `[data-module="${NAV_MODULE}"]`
      );

      if (!link) return;

      event.preventDefault();
      event.stopPropagation();

      showImprovementModule();
    },
    true
  );
}

function watchForControlCenterRoot() {
  if (window.__improvementAdminRootObserver) return;

  const observer = new MutationObserver(() => {
    moveControlCenterIntoModule();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.__improvementAdminRootObserver = observer;

  moveControlCenterIntoModule();
}

async function start() {
  addImprovementStyles();
  addSidebarItem();
  addModuleView();
  installNavigationHandler();
  watchForControlCenterRoot();

  /*
    Importing the Control Center starts its existing initialization.
    It is deliberately kept separate so the business logic remains in
    improvement-admin-control-center.js.
  */
  try {
    await import("./improvement-admin-control-center.js");
  } catch (error) {
    console.error("Improvement Control Center integration failed:", error);

    const host = document.getElementById("improvement-module-host");
    if (host) {
      host.innerHTML = `
        <div style="
          padding:18px;
          border:1px solid rgba(239,68,68,.35);
          border-radius:14px;
          color:var(--text-muted,#94a3b8);
          background:rgba(239,68,68,.05);
          line-height:1.7;
        ">
          উন্নতি নিয়ন্ত্রণ কেন্দ্র লোড করা যায়নি।
          <br>
          <small>improvement-admin-control-center.js এবং তার utility ফাইলের path পরীক্ষা করো।</small>
        </div>
      `;
    }
  }

  moveControlCenterIntoModule();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
