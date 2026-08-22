/* =========================================================
   UI UTILITIES — theme, toast, state rendering
   এই ফাইল সব পেজে (student + admin) shared।
   ========================================================= */

// ---------- Theme (light/dark) ----------
export function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  return saved;
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  return next;
}

// ---------- Toast ----------
let toastTimer = null;
export function showToast(message, type = "default") {
  let el = document.getElementById("app-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "app-toast";
    document.body.appendChild(el);
  }
  el.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = "none"; }, 3200);
}

// ---------- Firebase error → Bengali-friendly message (requirement #56) ----------
export function friendlyError(err) {
  const code = err?.code || "";
  const map = {
    "auth/wrong-password": "পাসওয়ার্ড সঠিক নয়।",
    "auth/user-not-found": "এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।",
    "auth/too-many-requests": "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    "auth/network-request-failed": "ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না।",
    "permission-denied": "এই তথ্য দেখার অনুমতি নেই।",
    "unavailable": "সার্ভারের সাথে সংযোগ করা যাচ্ছে না। পরে আবার চেষ্টা করুন।"
  };
  return map[code] || "একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।";
}

// ---------- State block renderer (loading / empty / error) ----------
const ICONS = {
  loading: `<div class="spinner"></div>`,
  empty: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/></svg>`,
  error: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>`,
  offline: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 9a15 15 0 0 1 22 0M5 13a10 10 0 0 1 14 0M9 17a5 5 0 0 1 6 0M12 21h.01"/></svg>`
};

export function renderState(container, kind, message) {
  container.innerHTML = `
    <div class="state-block">
      ${ICONS[kind] || ""}
      <p class="text-sm">${message}</p>
    </div>`;
}

// ---------- Simple SVG icon set (project rule: no emoji anywhere) ----------
export const icons = {
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>`,
  history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17z"/><path d="M20 19H6.5A2.5 2.5 0 0 0 4 21.5"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>`,
  trendUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l6-6 4 4 8-10"/><path d="M15 5h6v6"/></svg>`,
  trendDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7l6 6 4-4 8 10"/><path d="M15 19h6v-6"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
  toggle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="8" cy="12" r="3" fill="currentColor" stroke="none"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>`,
};

// ---------- Shared header for student-facing pages (dashboard/profile/history) ----------
export function renderStudentHeader(student, activeKey) {
  const tabs = [
    { key: "dashboard", href: "../student/dashboard.html", icon: icons.home, label: "ড্যাশবোর্ড" },
    { key: "history", href: "../student/history.html", icon: icons.history, label: "ইতিহাস" },
    { key: "profile", href: "../student/profile.html", icon: icons.user, label: "প্রোফাইল" },
  ];
  return `
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark">${student.name.charAt(0)}</div>
        <div>
          <h1 style="font-size:1.05rem;">${student.name}</h1>
          <p class="text-xs text-muted" style="margin:0;">${student.studentId}</p>
        </div>
      </div>
      <div class="flex gap-2 items-center">
        <button class="theme-toggle" id="themeToggle"><span class="theme-toggle-thumb"></span></button>
        <a href="../index.html" class="icon-btn" title="শিক্ষার্থী পরিবর্তন">${icons.arrowLeft}</a>
      </div>
    </div>
    <div class="glass card" style="display:flex;padding:6px;margin-bottom:var(--space-5);">
      ${tabs.map(t => `
        <a href="${t.href}" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:12px;
          ${t.key === activeKey ? "background:var(--color-accent-soft);color:var(--color-accent);" : "color:var(--text-muted);"}">
          <span style="width:20px;height:20px;">${t.icon}</span>
          <span class="text-xs" style="font-weight:600;">${t.label}</span>
        </a>
      `).join("")}
    </div>
  `;
}
