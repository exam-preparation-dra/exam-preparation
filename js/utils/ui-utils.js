/* =========================================================
   UI UTILITIES — theme, toast, state rendering
   এই ফাইল সব পেজে (student + admin) shared।
   ========================================================= */

import { db } from "../firebase/firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getUpcomingExams } from "./results-utils.js";
import { watchChatBadge } from "./chat-utils.js";
import "./tap-bubble.js"; // bubble on every tap (student pages)

// ---------- Theme (light/dark) ----------
// Theme (dark / light / manual time-range) lives in theme.js; first paint is done by
// theme-boot.js. Re-exported here so every page keeps importing from ui-utils.js.
import { initTheme, toggleTheme, openThemeSheet, getThemeSettings, saveThemeSettings, themeStatusText } from "./theme.js";
export { initTheme, toggleTheme, openThemeSheet, getThemeSettings, saveThemeSettings, themeStatusText };

// ---------- Toast ----------
let toastTimer = null;

export function showToast(message, type = "default") {
  let el = document.getElementById("app-toast");

  if (!el) {
    el = document.createElement("div");
    el.id = "app-toast";
    document.body.appendChild(el);
  }

  el.className =
    `toast ${
      type === "error"
        ? "toast-error"
        : type === "success"
          ? "toast-success"
          : ""
    }`;

  el.textContent = message;
  el.style.display = "block";

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.style.display = "none";
  }, 3200);
}

// ---------- Firebase error → Bengali-friendly message ----------
export function friendlyError(err) {
  const code = err?.code || "";

  const map = {
    "auth/wrong-password": "পাসওয়ার্ড সঠিক নয়।",
    "auth/user-not-found": "এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।",
    "auth/too-many-requests":
      "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    "auth/network-request-failed":
      "ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না।",
    "permission-denied":
      "এই তথ্য দেখার অনুমতি নেই।",
    "unavailable":
      "সার্ভারের সাথে সংযোগ করা যাচ্ছে না। পরে আবার চেষ্টা করুন।"
  };

  return map[code] || "একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।";
}

// ---------- State block renderer ----------
const ICONS = {
  loading: `<div class="spinner"></div>`,

  empty: `
    <svg width="40" height="40" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M3 7l9-4 9 4-9 4-9-4z"/>
      <path d="M3 7v10l9 4 9-4V7"/>
    </svg>
  `,

  error: `
    <svg width="40" height="40" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 8v5M12 16h.01"/>
    </svg>
  `,

  offline: `
    <svg width="40" height="40" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M1 9a15 15 0 0 1 22 0"/>
      <path d="M5 13a10 10 0 0 1 14 0"/>
      <path d="M9 17a5 5 0 0 1 6 0"/>
      <path d="M12 21h.01"/>
    </svg>
  `
};

export function renderState(container, kind, message) {
  container.innerHTML = `
    <div class="state-block">
      ${ICONS[kind] || ""}
      <p class="text-sm">${message}</p>
    </div>
  `;
}

// ---------- Simple SVG icon set ----------
export function aiBadge() {
  return `
    <span style="
      display:inline-flex;
      align-items:center;
      gap:4px;
      padding:3px 9px;
      border-radius:999px;
      background:linear-gradient(120deg,#7c3aed,#2563eb);
      color:#fff;
      font-size:10px;
      font-weight:800;
      letter-spacing:0.2px;
      line-height:1.4;
      vertical-align:middle;
    ">
      <svg width="10" height="10" viewBox="0 0 24 24"
        fill="currentColor"
        style="flex-shrink:0;">
        <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/>
      </svg>
      AI
    </span>
  `;
}

const BADGE_KINDS = {
  monthlyOverall: {
    gradient: "linear-gradient(135deg,#f5b301,#f97316)",
    label: "মাসিক টপার",
    icon: `<path d="M12 2l2.4 5.4L20 8l-4.2 3.9L17 18l-5-3-5 3 1.2-6.1L4 8l5.6-.6z"/>`
  },

  monthlyClass: {
    gradient: "linear-gradient(135deg,#60a5fa,#2563eb)",
    label: "ক্লাস মাসিক টপার",
    icon: `<path d="M12 2l2.4 5.4L20 8l-4.2 3.9L17 18l-5-3-5 3 1.2-6.1L4 8l5.6-.6z"/>`
  },

  weeklyOverall: {
    gradient: "linear-gradient(135deg,#34d399,#059669)",
    label: "সাপ্তাহিক টপার",
    icon: `<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>`
  },

  weeklyClass: {
    gradient: "linear-gradient(135deg,#a78bfa,#7c3aed)",
    label: "ক্লাস সাপ্তাহিক টপার",
    icon: `<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>`
  },

  examTopper: {
    gradient: "linear-gradient(135deg,#f472b6,#db2777)",
    label: "পরীক্ষার টপার",
    icon: `<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/>`
  }
};

export function badgeCard(kind, value = "") {
  const config = BADGE_KINDS[kind];

  if (!config) {
    return "";
  }

  return `
    <div class="badge-card"
      style="
        background:${config.gradient};
        color:#fff;
        border-radius:16px;
        padding:14px;
        display:flex;
        align-items:center;
        gap:10px;
      "
    >
      <span
        style="
          width:32px;
          height:32px;
          display:flex;
          align-items:center;
          justify-content:center;
          flex-shrink:0;
        "
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
        >
          ${config.icon}
        </svg>
      </span>

      <span style="display:flex;flex-direction:column;gap:2px;">
        <strong style="font-size:13px;">
          ${config.label}
        </strong>

        ${
          value
            ? `<span style="font-size:11px;opacity:.9;">
                 ${value}
               </span>`
            : ""
        }
      </span>
    </div>
  `;
}

// =========================================================
// GLOBAL STUDENT NOTIFICATIONS
// Friend Request + Challenge
// Dashboard / History / Leaderboard / Profile
// =========================================================

const NOTIF_HIDE_KEY = "studentHiddenNotifications";

let notificationUnsubs = [];
let notificationOutsideClickBound = false;

// ---------- Hidden / deleted notification IDs ----------
// Stored as { key: hiddenAtMs }. Entries are purged after 7 days (by then the
// notification itself is older than 7 days and is never shown anyway).
const NOTIF_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const NOTIF_MAX_VISIBLE = 5;
const NOTIF_SEEN_KEY = "studentNotificationsSeenAt";
let lastNotificationItems = [];

function readHiddenMap() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTIF_HIDE_KEY) || "{}");
    if (Array.isArray(raw)) { const o = {}; raw.forEach(k => { o[k] = Date.now(); }); return o; }
    return raw && typeof raw === "object" ? raw : {};
  } catch { return {}; }
}
function writeHiddenMap(map) {
  try { localStorage.setItem(NOTIF_HIDE_KEY, JSON.stringify(map)); } catch {}
}
// The hidden list also lives in Firestore (studentNotifState/{studentId}) so a
// deleted notification stays deleted after re-login, on another browser, or after
// the browser data is cleared. localStorage is only the fast local cache.
let remoteHidden = {};
let remoteHiddenFor = null;
async function loadRemoteHidden(studentId) {
  if (!studentId || remoteHiddenFor === studentId) return;
  try {
    const snap = await getDoc(doc(db, "studentNotifState", studentId));
    remoteHidden = (snap.exists() && snap.data().hidden) || {};
    remoteHiddenFor = studentId;
    // make this device remember them too
    const local = readHiddenMap();
    let dirty = false;
    Object.keys(remoteHidden).forEach(k => { if (!local[k]) { local[k] = Number(remoteHidden[k]) || Date.now(); dirty = true; } });
    if (dirty) writeHiddenMap(local);
  } catch (e) { console.warn("hidden notifications (remote) load failed", e); }
}
function getHiddenNotificationKeys() {
  const map = { ...remoteHidden, ...readHiddenMap() };
  const cutoff = Date.now() - NOTIF_LIFETIME_MS;
  const local = readHiddenMap();
  let dirty = false;
  Object.keys(local).forEach(k => { if (Number(local[k]) < cutoff) { delete local[k]; dirty = true; } });
  if (dirty) writeHiddenMap(local);
  return new Set(Object.keys(map).filter(k => Number(map[k]) >= cutoff));
}
function hideNotification(key, studentId) {
  const now = Date.now();
  const map = readHiddenMap();
  map[key] = now;
  writeHiddenMap(map);
  remoteHidden[key] = now;
  if (studentId) {
    setDoc(doc(db, "studentNotifState", studentId), { hidden: { [key]: now } }, { merge: true })
      .catch(e => console.warn("hidden notification save failed", e));
  }
}
function getNotificationsSeenAt() {
  try { return Number(localStorage.getItem(NOTIF_SEEN_KEY)) || 0; } catch { return 0; }
}
function markNotificationsSeen() {
  try { localStorage.setItem(NOTIF_SEEN_KEY, String(Date.now())); } catch {}
}

// Red count badge: how many of the shown notifications are new since the
// panel was last opened. Opening the panel marks everything as seen.
function paintNotificationBadge() {
  const dot = document.getElementById("globalNotificationDot");
  const count = document.getElementById("globalNotificationCount");
  const panel = document.getElementById("globalNotificationPanel");
  if (dot) dot.style.display = "none";
  if (!count) return;
  const open = !!(panel && panel.classList.contains("show"));
  if (open) markNotificationsSeen();
  const seen = getNotificationsSeenAt();
  const unread = open ? 0 : lastNotificationItems.filter(i => notificationMillis(i.createdAt) > seen).length;
  count.style.display = unread ? "grid" : "none";
  count.textContent = unread > 9 ? "9+" : String(unread);
}

// ---------- Friend chat (student/chat.html) -> bell + nav badge ----------
// Fed live by watchChatBadge(); renderGlobalNotifications() turns it into
// "new messages" / "group invite" cards, and the Leaderboard nav tab gets a red count.
let chatNotif = { total: 0, rooms: [], inviteRooms: [] };
function paintChatNavBadge(total) {
  try { sessionStorage.setItem("navChatBadge", String(total || 0)); } catch {}
  const ico = document.querySelector('.hdr-nav-tab[href*="leaderboard"] .hdr-nav-ico');
  if (!ico) return;
  ico.querySelector(".hdr-nav-badge")?.remove();
  if (total > 0) {
    const b = document.createElement("span");
    b.className = "hdr-nav-badge";
    b.textContent = total > 9 ? "9+" : String(total);
    ico.appendChild(b);
  }
}
function chatPreviewText(m, names) {
  if (!m) return "নতুন বার্তা";
  if (m.deleted || (!m.key && !m.text)) return "বার্তা মুছে ফেলা হয়েছে";
  return `${m.from && names[m.from] ? String(names[m.from]).split(/\s+/)[0] + ": " : ""}${m.text || ""}`;
}

const NOTIF_TRASH_ICON = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;
const NOTIF_MSG_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const stripNotifEmoji = t => String(t || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{2764}\u{FE0F}\u{200D}]+/gu, "").replace(/\s+/g, " ").trim();

// "আজ, ৩:১৫ PM" / "গতকাল, ..." / "৩ অক্টো, ..."
function notificationClock(value) {
  const ms = notificationMillis(value);
  if (!ms) return "";
  const d = new Date(ms), now = new Date();
  const day0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((day0(now) - day0(d)) / 86400000);
  const time = d.toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" });
  if (diffDays <= 0) return `আজ, ${time}`;
  if (diffDays === 1) return `গতকাল, ${time}`;
  return `${d.toLocaleDateString("bn-BD", { day: "numeric", month: "short" })}, ${time}`;
}

// ---------- HTML escaping ----------
function escapeNotification(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Firestore timestamp → milliseconds ----------
function notificationMillis(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value.seconds) {
    return Number(value.seconds) * 1000;
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}

// ---------- Notification age ----------
function notificationAge(value) {
  const ms = notificationMillis(value);

  if (!ms) return "";

  const diff = Math.max(
    0,
    Date.now() - ms
  );

  const minutes = Math.floor(
    diff / 60000
  );

  if (minutes < 1) return "এইমাত্র";

  if (minutes < 60) {
    return `${minutes} মিনিট আগে`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours} ঘণ্টা আগে`;
  }

  const days = Math.floor(
    hours / 24
  );

  return `${days} দিন আগে`;
}

// ---------- Notification CSS ----------
function injectNotificationStyles() {
  if (
    document.getElementById(
      "global-notification-styles"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "global-notification-styles";

  style.textContent = `
    .student-global-notification {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    .global-notification-btn {
      position: relative;
      width: 42px;
      height: 42px;
      border: 0;
      border-radius: 12px;
      background: var(--card-bg, rgba(255,255,255,.65));
      color: var(--text, currentColor);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: .2s ease;
    }

    .global-notification-btn:hover {
      transform: translateY(-1px);
    }

    .global-notification-btn svg {
      width: 21px;
      height: 21px;
    }

    .global-notification-dot {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #ef4444;
      display: none;
    }

    .global-notification-count {
      position: absolute;
      top: -5px;
      right: -5px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 999px;
      background: #ef4444;
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      display: none;
      align-items: center;
      justify-content: center;
      line-height: 1;
      box-shadow: 0 2px 8px rgba(239,68,68,.3);
    }

    .global-notification-panel {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: min(360px, calc(100vw - 24px));
      max-height: min(560px, 75vh);
      overflow-y: auto;
      background: var(--card-bg, #fff);
      color: var(--text, #111);
      border: 1px solid var(--border, rgba(0,0,0,.08));
      border-radius: 18px;
      box-shadow: 0 18px 50px rgba(0,0,0,.16);
      padding: 10px;
      z-index: 9999;
      display: none;
    }

    .global-notification-panel.show {
      display: block;
      animation: globalNotificationIn .16s ease;
    }

    @keyframes globalNotificationIn {
      from {
        opacity: 0;
        transform: translateY(-5px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .global-notification-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 8px 12px;
      border-bottom: 1px solid var(--border, rgba(0,0,0,.07));
    }

    .global-notification-head strong {
      font-size: 14px;
    }

    .global-notification-head button {
      border: 0;
      background: transparent;
      color: var(--text-muted, #777);
      cursor: pointer;
      font-size: 11px;
      padding: 4px 6px;
    }

    .global-notification-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 8px;
    }

    .global-notification-item {
      border: 1px solid var(--border, rgba(0,0,0,.07));
      border-radius: 14px;
      padding: 11px;
      background: var(--surface, rgba(0,0,0,.02));
    }

    .global-notification-item-title {
      display: flex;
      align-items: flex-start;
      gap: 9px;
    }
  .global-notification-icon {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: var(--color-accent-soft, rgba(37,99,235,.1));
      color: var(--color-accent, #2563eb);
    }

    .global-notification-icon svg {
      width: 17px;
      height: 17px;
    }

    .global-notification-main {
      min-width: 0;
      flex: 1;
    }

    .global-notification-main strong {
      display: block;
      font-size: 12px;
      line-height: 1.4;
    }

    .global-notification-main p {
      margin: 3px 0 0;
      font-size: 11px;
      line-height: 1.5;
      color: var(--text-muted, #777);
    }

    .global-notification-time {
      margin-top: 4px;
      font-size: 10px;
      color: var(--text-muted, #888);
    }

    .global-notification-actions {
      display: flex;
      gap: 6px;
      margin-top: 9px;
      padding-left: 41px;
    }

    .global-notification-actions button {
      border: 0;
      border-radius: 9px;
      padding: 7px 10px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
    }

    .global-notif-accept {
      background: var(--color-accent, #2563eb);
      color: #fff;
    }

    .global-notif-reject {
      background: rgba(239,68,68,.1);
      color: #dc2626;
    }

    .global-notif-hide {
      background: transparent;
      color: var(--text-muted, #777);
      border: 1px solid var(--border, rgba(0,0,0,.08)) !important;
    }

    .global-notification-empty {
      text-align: center;
      padding: 22px 10px;
      font-size: 12px;
      color: var(--text-muted, #777);
    }

    @media (max-width: 600px) {
      .global-notification-panel {
        position: fixed;
        top: 68px;
        right: 12px;
        width: calc(100vw - 24px);
        max-height: 70vh;
      }
    }

    /* ---- count-only badge (no dot), delete button, friend message card ---- */
    .global-notification-dot { display: none !important; }
    .global-notification-count { top: -6px; right: -6px; min-width: 20px; height: 20px; font-size: 11px;
      border: 2px solid var(--surface-solid, #fff); box-shadow: 0 3px 10px rgba(239,68,68,.35); animation: gnBadgePop .35s cubic-bezier(.2,1.4,.4,1) both; }
    @keyframes gnBadgePop { from { transform: scale(.3); opacity: 0 } to { transform: scale(1); opacity: 1 } }
    .global-notif-hide { display: inline-flex; align-items: center; justify-content: center; gap: 5px; color: var(--color-danger, #a6402f) !important;
      border-color: color-mix(in srgb, var(--color-danger, #a6402f) 35%, transparent) !important; }
    .global-notif-hide:hover { background: color-mix(in srgb, var(--color-danger, #a6402f) 10%, transparent) !important; }
    .gn-cheer { border-left: 3px solid var(--color-accent, #b8863c); animation: gnCheerIn .35s ease both; }
    @keyframes gnCheerIn { from { transform: translateY(6px); opacity: 0 } to { transform: none; opacity: 1 } }
    .gn-cheer-top { display: flex; align-items: center; gap: 10px; }
    .gn-cheer-from { flex: 1; min-width: 0; font-size: 15px; font-weight: 900; color: var(--text-primary, #21262f); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gn-cheer-tag { font-size: 10px; font-weight: 900; padding: 3px 9px; border-radius: 99px; color: var(--color-accent, #b8863c);
      background: color-mix(in srgb, var(--color-accent, #b8863c) 14%, transparent); }
    .gn-cheer-text { margin: 10px 0 8px; font-size: 17px; line-height: 1.45; font-weight: 900; color: var(--text-primary, #21262f); word-break: break-word; }
    .gn-cheer-time { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 700; color: var(--text-muted, #777); }
    .gn-cheer-time b { color: var(--color-accent, #b8863c); font-weight: 900; }
    .global-notif-open-feed { flex: 1; }
  `;

  document.head.appendChild(style);
}

// ---------- Bell SVG ----------
function notificationBellIcon() {
  return `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
      <path d="M10 21h4"/>
    </svg>
  `;
}

// ---------- Auto-select upcoming exam ----------
async function refreshChallengeExamPlaceholders(challenges) {
  if (!Array.isArray(challenges) || !challenges.length) {
    return [];
  }

  const needsExam = challenges.some(
    challenge =>
      challenge.examId === "__NEXT_EXAM__"
  );

  if (!needsExam) {
    return challenges;
  }

  let exams = [];

  try {
    exams = await getUpcomingExams();
  } catch (err) {
    console.error(
      "Upcoming exam lookup failed:",
      err
    );
  }

  const nextExam = Array.isArray(exams)
    ? exams[0]
    : null;

  if (!nextExam) {
    return challenges;
  }

  const nextExamId =
    nextExam.examId ||
    nextExam.id ||
    "";

  const nextExamName =
    nextExam.examName ||
    nextExam.name ||
    "পরবর্তী পরীক্ষা";

  return challenges.map(
    challenge => {
      if (
        challenge.examId !== "__NEXT_EXAM__"
      ) {
        return challenge;
      }

      return {
        ...challenge,
        examId: nextExamId,
        examName: nextExamName,
        autoSelectedExam: true
      };
    }
  );
}

// ---------- Render global notifications ----------
async function renderGlobalNotifications(student) {
  const list =
    document.getElementById(
      "globalNotificationList"
    );

  const badge =
    document.getElementById(
      "globalNotificationDot"
    );

  const count =
    document.getElementById(
      "globalNotificationCount"
    );

  if (!list || !badge || !count) {
    return;
  }

  try {
    const requestQuery = query(
      collection(db, "friendRequests"),
      where(
        "toStudentId",
        "==",
        student.studentId
      ),
      where(
        "status",
        "==",
        "pending"
      )
    );

    const challengeQuery = query(
      collection(db, "examChallenges"),
      where(
        "toStudentId",
        "==",
        student.studentId
      ),
      where(
        "status",
        "==",
        "pending"
      )
    );

    // Sender side: my challenge got accepted. Both sides: a challenge finished.
    const myId = student.studentId;
    const chCol = collection(db, "examChallenges");
    const acceptedOutQuery = query(chCol, where("fromStudentId", "==", myId), where("status", "==", "accepted"));
    const doneOutQuery = query(chCol, where("fromStudentId", "==", myId), where("status", "==", "completed"));
    const doneInQuery = query(chCol, where("toStudentId", "==", myId), where("status", "==", "completed"));

    // Settle finished challenges (throttled: at most once / 5 min per tab)
    try {
      const last = Number(sessionStorage.getItem("chResolveAt") || 0);
      if (Date.now() - last > 5 * 60 * 1000) {
        sessionStorage.setItem("chResolveAt", String(Date.now()));
        const cm = await import("./challenge-utils.js");
        await cm.resolveCompletedChallenges(myId).catch(() => []);
      }
    } catch (e) {}

    const improvementQuery = query(
      collection(db, "improvementRequests"),
      where(
        "studentId",
        "==",
        student.studentId
      )
    );

    const [
      requestSnap,
      challengeSnap,
      studentSnap,
      improvementSnap,
      acceptedOutSnap,
      doneOutSnap,
      doneInSnap
    ] = await Promise.all([
      getDocs(requestQuery),
      getDocs(challengeQuery),
      getDocs(collection(db, "students")),
      getDocs(improvementQuery).catch(() => ({ docs: [] })),
      getDocs(acceptedOutQuery).catch(() => ({ docs: [] })),
      getDocs(doneOutQuery).catch(() => ({ docs: [] })),
      getDocs(doneInQuery).catch(() => ({ docs: [] }))
    ]);

    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const chAccepted = acceptedOutSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(c => notificationMillis(c.acceptedAt) > Date.now() - 3 * 24 * 60 * 60 * 1000);
    const chDone = [...doneOutSnap.docs, ...doneInSnap.docs].map(d => ({ id: d.id, ...d.data() }))
      .filter(c => notificationMillis(c.resolvedAt || c.completedAt) > Date.now() - WEEK);

    // ---------- Student names ----------
    const names = {};

    studentSnap.docs.forEach(
      d => {
        const data = d.data();

        names[data.studentId] =
          data.name ||
          "শিক্ষার্থী";
      }
    );

    // ---------- Challenges ----------
    const challenges =
      await refreshChallengeExamPlaceholders(
        challengeSnap.docs.map(
          d => ({
            id: d.id,
            ...d.data()
          })
        )
      );

    // ---------- Requests ----------
    const requests =
      requestSnap.docs.map(
        d => ({
          id: d.id,
          ...d.data()
        })
      );

    // ---------- Friend messages (cheers) ----------
    let cheerDocs = [];
    try {
      const cs = await getDocs(query(collection(db, "friendCheers"), where("toStudentId", "==", student.studentId)));
      cheerDocs = cs.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {}
    const cutoffMs = Date.now() - NOTIF_LIFETIME_MS;
    // 7 days later the message is deleted for good (only the receiver cleans up their own inbox).
    cheerDocs.filter(c => { const m = notificationMillis(c.createdAt); return m && m < cutoffMs; })
      .slice(0, 25).forEach(c => { deleteDoc(doc(db, "friendCheers", c.id)).catch(() => {}); });
    const cheerItems = cheerDocs
      .filter(c => { const m = notificationMillis(c.createdAt); return !m || m >= cutoffMs; })
      .map(c => ({
        key: `cheer:${c.id}`, type: "cheer", id: c.id,
        sender: names[c.fromStudentId] || "একজন বন্ধু",
        text: stripNotifEmoji(c.text) || "তোমাকে একটি বার্তা পাঠিয়েছে",
        createdAt: c.createdAt || new Date()
      }));

    // ---------- Hidden ----------
    await loadRemoteHidden(student.studentId);
    const hidden =
      getHiddenNotificationKeys();

    const myChatId = student.studentId;
    const chatItems = [
      ...(chatNotif.rooms || []).filter(r => Number(r.unread?.[myChatId]) > 0).map(r => {
        const other = (r.members || []).find(x => x !== myChatId);
        return {
          key: `chat:${r.id}`, type: "chat", id: r.id, count: Number(r.unread[myChatId]),
          sender: r.type === "group" ? (r.name || "গ্রুপ চ্যাট") : (names[other] || "একজন বন্ধু"),
          text: chatPreviewText(r.lastMsg, names),
          createdAt: r.lastAt || new Date()
        };
      }),
      ...(chatNotif.inviteRooms || []).map(r => ({
        key: `chatinv:${r.id}`, type: "chatinvite", id: r.id,
        sender: names[r.createdBy] || "একজন বন্ধু",
        text: r.name || "নতুন গ্রুপ",
        createdAt: r.createdAt || new Date()
      }))
    ];

    const allItems = [
      ...chatItems,
      ...cheerItems,
      ...requests.map(
        request => ({
          key:
            `friend:${request.id}`,

          type: "friend",

          id: request.id,

          senderId:
            request.fromStudentId,

          sender:
            names[
              request.fromStudentId
            ] ||
            "একজন শিক্ষার্থী",

          createdAt:
            request.createdAt
        })
      ),

      ...challenges.map(
        challenge => ({
          key:
            `challenge:${challenge.id}`,

          type: "challenge",

          id: challenge.id,

          senderId:
            challenge.fromStudentId,

          sender:
            names[
              challenge.fromStudentId
            ] ||
            "একজন শিক্ষার্থী",

          exam:
            challenge.examName ||
            "পরবর্তী পরীক্ষা",

          createdAt:
            challenge.createdAt
        })
      ),

      ...chAccepted.map(c => ({
        key: `challenge-accepted:${c.id}`,
        type: "challenge-accepted",
        id: c.id,
        other: names[c.toStudentId] || "একজন শিক্ষার্থী",
        exam: c.examName || "পরবর্তী পরীক্ষা",
        createdAt: c.acceptedAt
      })),

      ...chDone.map(c => {
        const won = c.winnerStudentId === student.studentId;
        const lost = c.loserStudentId === student.studentId;
        const otherId = c.fromStudentId === student.studentId ? c.toStudentId : c.fromStudentId;
        return {
          key: `challenge-result:${c.id}`,
          type: "challenge-result",
          id: c.id,
          other: names[otherId] || "একজন শিক্ষার্থী",
          exam: c.examName || "পরীক্ষা",
          outcome: won ? "win" : lost ? "lose" : "draw",
          xp: won ? Number(c.winnerBonus) || 0 : lost ? Number(c.loserBonus) || 0 : Number(c.drawBonus) || 0,
          createdAt: c.resolvedAt || c.completedAt
        };
      }),

      ...improvementSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(data => data.status === "assigned")
        .map(
          data => {
            const assignedAt = data.assignedAt || data.updatedAt || data.createdAt;
            const ageDays = Math.floor((Date.now() - notificationMillis(assignedAt)) / (24 * 60 * 60 * 1000));
            return {
              key: `improvement:${data.id}`,
              type: "improvement",
              id: data.id,
              testId: data.improvementTestId || data.assignedTestId || "",
              topicName: data.topicName || data.chapterName || data.subjectName || data.entityName || "একটি বিষয়",
              currentAccuracy: Math.round(Number(data.currentAccuracy) || 0),
              targetAccuracy: Math.round(Number(data.targetAccuracy) || 0),
              // Spark plan, no cron -- this is the reminder: the same
              // notification just gets more urgent wording the longer an
              // assigned test sits untouched, checked opportunistically
              // whenever the student opens any page with this header.
              ageDays: Math.max(0, ageDays),
              createdAt: assignedAt
            };
          }
        ),

      ...improvementSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(data =>
          (data.status === "completed" || data.status === "resolved") &&
          notificationMillis(data.completedAt) > (Date.now() - 3 * 24 * 60 * 60 * 1000)
        )
        .map(
          data => ({
            key: `improvement-result:${data.id}`,
            type: "improvement-result",
            id: data.id,
            topicName: data.topicName || data.chapterName || data.subjectName || data.entityName || "একটি বিষয়",
            previousAccuracy: Math.round(Number(data.currentAccuracy) || 0),
            newAccuracy: Math.round(Number(data.lastAccuracy) || 0),
            improvementPercent: Math.round(Number(data.lastImprovementPercent) || 0),
            targetReached: data.targetReached === true,
            createdAt: data.completedAt
          })
        )
    ]
      .filter(item => !hidden.has(item.key))
      // every notification lives 7 days at most
      .filter(item => { const m = notificationMillis(item.createdAt); return !m || m >= cutoffMs; })
      .sort(
        (a, b) =>
          notificationMillis(
            b.createdAt
          ) -
          notificationMillis(
            a.createdAt
          )
      );

    // Only the latest 5 are shown; older ones stay hidden until they expire (7 days).
    const items = allItems.slice(0, NOTIF_MAX_VISIBLE);
    lastNotificationItems = items;

    // ---------- Badge ----------
    paintNotificationBadge();

    // ---------- Empty ----------
    if (!items.length) {
      list.innerHTML = `
        <div class="global-notification-empty">
          এখন কোনো নতুন notification নেই।
        </div>
      `;

      return;
    }

    // ---------- Notification HTML ----------
    list.innerHTML =
      items
        .map(item => {

          if (item.type === "chat" || item.type === "chatinvite") {
            const invite = item.type === "chatinvite";
            return `
              <div class="global-notification-item gn-cheer" data-notification-key="${escapeNotification(item.key)}">
                <div class="gn-cheer-top">
                  <div class="global-notification-icon">${NOTIF_MSG_ICON}</div>
                  <strong class="gn-cheer-from">${escapeNotification(item.sender)}</strong>
                  <span class="gn-cheer-tag">${invite ? "আমন্ত্রণ" : `${item.count}টি নতুন`}</span>
                </div>
                <p class="gn-cheer-text">${invite ? `“${escapeNotification(item.text)}” গ্রুপে যোগ দিতে আমন্ত্রণ জানিয়েছে` : escapeNotification(item.text)}</p>
                <div class="gn-cheer-time">
                  <b>${notificationClock(item.createdAt)}</b>
                  <span>${notificationAge(item.createdAt)}</span>
                </div>
                <div class="global-notification-actions">
                  <button type="button" class="global-notif-open-chat" data-room="${invite ? "" : escapeNotification(item.id)}">${invite ? "আমন্ত্রণ দেখো" : "চ্যাট খোলো"}</button>
                </div>
              </div>
            `;
          }
          if (item.type === "cheer") {
            return `
              <div class="global-notification-item gn-cheer" data-notification-key="${escapeNotification(item.key)}">
                <div class="gn-cheer-top">
                  <div class="global-notification-icon">${NOTIF_MSG_ICON}</div>
                  <strong class="gn-cheer-from">${escapeNotification(item.sender)}</strong>
                  <span class="gn-cheer-tag">বার্তা</span>
                </div>
                <p class="gn-cheer-text">${escapeNotification(item.text)}</p>
                <div class="gn-cheer-time">
                  <b>${notificationClock(item.createdAt)}</b>
                  <span>${notificationAge(item.createdAt)}</span>
                </div>
                <div class="global-notification-actions">
                  <button type="button" class="global-notif-open-feed">ফিডে দেখো</button>
                  <button type="button" class="global-notif-hide" data-key="${escapeNotification(item.key)}">${NOTIF_TRASH_ICON} মুছুন</button>
                </div>
              </div>
            `;
          }
          if (item.type === "friend") {
            return `
              <div
                class="global-notification-item"
                data-notification-key="${escapeNotification(item.key)}"
              >

                <div class="global-notification-item-title">

                  <div class="global-notification-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M19 8v6M22 11h-6"/>
                    </svg>
                  </div>

                  <div class="global-notification-main">

                    <strong>
                      ${escapeNotification(item.sender)}
                      তোমাকে friend request পাঠিয়েছে
                    </strong>

                    <p>
                      এই request গ্রহণ করলে তোমরা friend list-এ যুক্ত হবে।
                    </p>

                    <div class="global-notification-time">
                      ${notificationAge(item.createdAt)}
                    </div>

                  </div>

                </div>

                <div class="global-notification-actions">

                  <button
                    type="button"
                    class="global-notif-accept-friend"
                    data-id="${escapeNotification(item.id)}"
                  >
                    গ্রহণ
                  </button>

                  <button
                    type="button"
                    class="global-notif-reject-friend"
                    data-id="${escapeNotification(item.id)}"
                  >
                    প্রত্যাখ্যান
                  </button>

                  <button
                    type="button"
                    class="global-notif-hide"
                    data-key="${escapeNotification(item.key)}"
                  >
                    ${NOTIF_TRASH_ICON} মুছুন
                  </button>

                </div>

              </div>
            `;
          }

          if (item.type === "challenge-accepted" || item.type === "challenge-result") {
            const isRes = item.type === "challenge-result";
            const title = isRes
              ? (item.outcome === "win" ? `${escapeNotification(item.other)}-কে হারিয়েছো` : item.outcome === "lose" ? `${escapeNotification(item.other)}-এর কাছে হেরেছো` : `${escapeNotification(item.other)}-এর সাথে ড্র হয়েছে`)
              : `${escapeNotification(item.other)} তোমার challenge গ্রহণ করেছে`;
            const sub = isRes
              ? `পরীক্ষা: ${escapeNotification(item.exam)} · +${item.xp} XP`
              : `পরীক্ষা: ${escapeNotification(item.exam)}`;
            return `
              <div class="global-notification-item" data-notification-key="${escapeNotification(item.key)}">
                <div class="global-notification-item-title">
                  <div class="global-notification-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      ${isRes
                        ? `<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>`
                        : `<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4"/>`}
                    </svg>
                  </div>
                  <div class="global-notification-main">
                    <strong>${title}</strong>
                    <p>${sub}</p>
                    <div class="global-notification-time">${notificationAge(item.createdAt)}</div>
                  </div>
                </div>
                <div class="global-notification-actions">
                  <button type="button" class="global-notif-open-challenges">দেখো</button>
                  <button type="button" class="global-notif-hide" data-key="${escapeNotification(item.key)}">${NOTIF_TRASH_ICON} মুছুন</button>
                </div>
              </div>
            `;
          }

          if (item.type === "improvement-result") {
            const delta = item.improvementPercent;
            return `
              <div
                class="global-notification-item"
                data-notification-key="${escapeNotification(item.key)}"
              >

                <div class="global-notification-item-title">

                  <div class="global-notification-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                    >
                      <path d="M3 17l6-6 4 4 8-8"/>
                      <path d="M15 7h6v6"/>
                    </svg>
                  </div>

                  <div class="global-notification-main">

                    <strong>
                      ${escapeNotification(item.topicName)}-এ ${delta > 0 ? `${delta}% উন্নতি হয়েছে` : "অনুশীলন সম্পন্ন হয়েছে"}
                    </strong>

                    <p>
                      ${item.previousAccuracy}% থেকে ${item.newAccuracy}%${item.targetReached ? " — লক্ষ্য পূর্ণ হয়েছে" : ""}
                    </p>

                    <div class="global-notification-time">
                      ${notificationAge(item.createdAt)}
                    </div>

                  </div>

                </div>

                <div class="global-notification-actions">

                  <button
                    type="button"
                    class="global-notif-hide"
                    data-key="${escapeNotification(item.key)}"
                  >
                    ${NOTIF_TRASH_ICON} মুছুন
                  </button>

                </div>

              </div>
            `;
          }

          if (item.type === "improvement") {
            return `
              <div
                class="global-notification-item"
                data-notification-key="${escapeNotification(item.key)}"
              >

                <div class="global-notification-item-title">

                  <div class="global-notification-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                    >
                      <path d="M3 17l6-6 4 4 8-8"/>
                      <path d="M15 7h6v6"/>
                    </svg>
                  </div>

                  <div class="global-notification-main">

                    <strong>
                      ${item.ageDays >= 2 ? "এখনও শুরু করোনি — " : ""}${escapeNotification(item.topicName)} অংশে Improvement Exam প্রস্তুত
                    </strong>

                    <p>
                      বর্তমান accuracy ${item.currentAccuracy}% — লক্ষ্য ${item.targetAccuracy}%।
                      ${item.ageDays >= 2 ? `${item.ageDays} দিন ধরে অপেক্ষা করছে, আজই অনুশীলন করো।` : "অনুশীলন করে উন্নতি করো।"}
                    </p>

                    <div class="global-notification-time">
                      ${notificationAge(item.createdAt)}
                    </div>

                  </div>

                </div>

                <div class="global-notification-actions">

                  <button
                    type="button"
                    class="global-notif-start-improvement"
                    data-test-id="${escapeNotification(item.testId)}"
                  >
                    শুরু করো
                  </button>

                  <button
                    type="button"
                    class="global-notif-hide"
                    data-key="${escapeNotification(item.key)}"
                  >
                    ${NOTIF_TRASH_ICON} মুছুন
                  </button>

                </div>

              </div>
            `;
          }

          return `
            <div
              class="global-notification-item"
              data-notification-key="${escapeNotification(item.key)}"
            >

              <div class="global-notification-item-title">

                <div class="global-notification-icon">

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                  >
                    <path d="M6 3h12v18H6z"/>
                    <path d="M9 7h6M9 11h6M9 15h4"/>
                  </svg>

                </div>

                <div class="global-notification-main">

                  <strong>
                    ${escapeNotification(item.sender)}
                    তোমাকে challenge করেছে
                  </strong>

                  <p>
                    পরীক্ষা:
                    ${escapeNotification(item.exam)}
                  </p>

                  <div class="global-notification-time">
                    ${notificationAge(item.createdAt)}
                  </div>

                </div>

              </div>

              <div class="global-notification-actions">

                <button
                  type="button"
                  class="global-notif-accept-challenge"
                  data-id="${escapeNotification(item.id)}"
                >
                  গ্রহণ
                </button>

                <button
                  type="button"
                  class="global-notif-reject-challenge"
                  data-id="${escapeNotification(item.id)}"
                >
                  প্রত্যাখ্যান
                </button>

                <button
                  type="button"
                  class="global-notif-hide"
                  data-key="${escapeNotification(item.key)}"
                >
                  ${NOTIF_TRASH_ICON} মুছুন
                </button>

              </div>

            </div>
          `;
        })
        .join("");

    // ---------- Open friends feed ----------
    list.querySelectorAll(".global-notif-open-feed").forEach(button => {
      button.onclick = event => {
        event.stopPropagation();
        window.location.href = "../student/leaderboard.html?tab=friends";
      };
    });

    // ---------- Open chat ----------
    list.querySelectorAll(".global-notif-open-chat").forEach(button => {
      button.onclick = event => {
        event.stopPropagation();
        const room = button.dataset.room;
        window.location.href = "../student/chat.html" + (room ? `?room=${encodeURIComponent(room)}` : "");
      };
    });

    // ---------- Open challenges tab ----------
    list.querySelectorAll(".global-notif-open-challenges").forEach(button => {
      button.onclick = event => {
        event.stopPropagation();
        window.location.href = "../student/leaderboard.html?tab=challenges";
      };
    });

    // ---------- Start improvement exam ----------
    list
      .querySelectorAll(
        ".global-notif-start-improvement"
      )
      .forEach(
        button => {
          button.onclick = event => {
            event.stopPropagation();
            const testId = button.dataset.testId;
            if (testId) {
              window.location.href = `../student/exam.html?improvementTestId=${encodeURIComponent(testId)}`;
            }
          };
        }
      );


    list
      .querySelectorAll(
        ".global-notif-hide"
      )
      .forEach(
        button => {
          button.onclick =
            async event => {

              event.stopPropagation();

              const key =
                button.dataset.key;

              if (!key) {
                return;
              }

              hideNotification(key, student.studentId);

              if (key.startsWith("cheer:")) {
                // a message is a real document: delete it for good
                try { await deleteDoc(doc(db, "friendCheers", key.slice(6))); } catch (e) {}
              }
              await renderGlobalNotifications(
                student
              );
            };
        }
      );

    // ---------- Accept friend ----------
    list
      .querySelectorAll(
        ".global-notif-accept-friend"
      )
      .forEach(
        button => {
          button.onclick =
            async () => {

              try {

                const requestRef =
                  doc(
                    db,
                    "friendRequests",
                    button.dataset.id
                  );

                await updateDoc(
                  requestRef,
                  {
                    status: "accepted"
                  }
                );

                showToast(
                  "Friend request গ্রহণ করা হয়েছে।",
                  "success"
                );

                await renderGlobalNotifications(
                  student
                );

              } catch (err) {

                showToast(
                  friendlyError(err),
                  "error"
                );

              }
            };
        }
      );

    // ---------- Reject friend ----------
    list
      .querySelectorAll(
        ".global-notif-reject-friend"
      )
      .forEach(
        button => {
          button.onclick =
            async () => {

              try {

                await deleteDoc(
                  doc(
                    db,
                    "friendRequests",
                    button.dataset.id
                  )
                );

                showToast(
                  "Friend request প্রত্যাখ্যান করা হয়েছে।",
                  "success"
                );

                await renderGlobalNotifications(
                  student
                );

              } catch (err) {

                showToast(
                  friendlyError(err),
                  "error"
                );

              }
            };
        }
      );

    // ---------- Accept challenge ----------
    list
      .querySelectorAll(
        ".global-notif-accept-challenge"
      )
      .forEach(
        button => {
          button.onclick =
            async () => {

              try {

                await updateDoc(
                  doc(
                    db,
                    "examChallenges",
                    button.dataset.id
                  ),
                  {
                    status: "accepted"
                  }
                );

                showToast(
                  "Challenge গ্রহণ করা হয়েছে।",
                  "success"
                );

                await renderGlobalNotifications(
                  student
                );

              } catch (err) {

                showToast(
                  friendlyError(err),
                  "error"
                );

              }
            };
        }
      );

    // ---------- Reject challenge ----------
    list
      .querySelectorAll(
        ".global-notif-reject-challenge"
      )
      .forEach(
        button => {
          button.onclick =
            async () => {

              try {

                await deleteDoc(
                  doc(
                    db,
                    "examChallenges",
                    button.dataset.id
                  )
                );

                showToast(
                  "Challenge প্রত্যাখ্যান করা হয়েছে।",
                  "success"
                );

                await renderGlobalNotifications(
                  student
                );

              } catch (err) {

                showToast(
                  friendlyError(err),
                  "error"
                );

              }
            };
        }
      );

  } catch (err) {

    console.error(
      "Global notification refresh failed:",
      err
    );
  }
}


// ---------- Stop listeners ----------
function stopGlobalNotificationListeners() {

  notificationUnsubs.forEach(
    unsubscribe => {
      try {
        unsubscribe();
      } catch {}
    }
  );

  notificationUnsubs = [];
}


// ---------- Start notification system ----------
function startGlobalNotificationSystem(
  student
) {

  if (!student?.studentId) {
    return;
  }

  injectNotificationStyles();

  stopGlobalNotificationListeners();

  const requestQuery =
    query(
      collection(
        db,
        "friendRequests"
      ),
      where(
        "toStudentId",
        "==",
        student.studentId
      ),
      where(
        "status",
        "==",
        "pending"
      )
    );

  const challengeQuery =
    query(
      collection(
        db,
        "examChallenges"
      ),
      where(
        "toStudentId",
        "==",
        student.studentId
      ),
      where(
        "status",
        "==",
        "pending"
      )
    );

  notificationUnsubs.push(
    onSnapshot(
      requestQuery,
      () =>
        renderGlobalNotifications(
          student
        )
    )
  );

  notificationUnsubs.push(
    onSnapshot(
      challengeQuery,
      () =>
        renderGlobalNotifications(
          student
        )
    )
  );

  notificationUnsubs.push(
    onSnapshot(
      query(collection(db, "friendCheers"), where("toStudentId", "==", student.studentId)),
      () => renderGlobalNotifications(student),
      () => {}
    )
  );

  // friend chat: unread messages + group invites -> bell cards and nav badge
  try {
    notificationUnsubs.push(
      watchChatBadge(student.studentId, state => {
        chatNotif = state;
        paintChatNavBadge(state.total);
        renderGlobalNotifications(student);
      })
    );
  } catch (e) { console.warn("chat badge unavailable", e); }

  renderGlobalNotifications(
    student
  );

  // Opening the bell marks everything as seen -> the red count goes away.
  setTimeout(() => {
    const bellBtn = document.getElementById("globalNotificationBtn");
    if (bellBtn && !bellBtn.dataset.notifSeenBound) {
      bellBtn.dataset.notifSeenBound = "1";
      bellBtn.addEventListener("click", () => setTimeout(paintNotificationBadge, 0));
    }
  }, 0);

  // ---------- Outside click ----------
  if (
    !notificationOutsideClickBound
  ) {

    document.addEventListener(
      "click",
      event => {

        const wrap =
          document.querySelector(
            ".student-global-notification"
          );

        const panel =
          document.getElementById(
            "globalNotificationPanel"
          );

        if (!wrap || !panel) {
          return;
        }

        if (
          !wrap.contains(
            event.target
          )
        ) {
          panel.classList.remove(
            "show"
          );
        }

      }
    );

    notificationOutsideClickBound =
      true;
  }
         }

// =========================================================
// Shared icon set
// =========================================================

export const icons = {

  home: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5"/>
      <path d="M5 9.5V21h14V9.5"/>
      <path d="M9 21v-6h6v6"/>
    </svg>
  `,

  history: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7"/>
      <path d="M3 4v6h6"/>
      <path d="M12 7v5l3 2"/>
    </svg>
  `,

  chart: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 3v18h18"/>
      <path d="M7 15l4-5 3 3 5-7"/>
    </svg>
  `,

  user: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21a8 8 0 0 1 16 0"/>
    </svg>
  `,

  improvement: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 17l6-6 4 4 8-8"/>
      <path d="M15 7h6v6"/>
    </svg>
  `,

  arrowLeft: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M19 12H5"/>
      <path d="M12 19l-7-7 7-7"/>
    </svg>
  `,

  calendar: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/>
      <path d="M3 9.5h18"/>
      <path d="M8 2.8v3.4M16 2.8v3.4"/>
      <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01"/>
    </svg>
  `,

  bell: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
      <path d="M10 21h4"/>
    </svg>
  `,

  check: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m5 12 4 4L19 6"/>
    </svg>
  `,

  close: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18"/>
    </svg>
  `
};


// =========================================================
// Shared header for student-facing pages
// =========================================================

export function renderStudentHeader(
  student,
  activeKey
) {

  const tabs = [
    { key: "dashboard", href: "../student/dashboard.html", icon: icons.home, label: "হোম" },
    { key: "calendar", href: "../student/calendar.html", icon: icons.calendar, label: "ক্যালেন্ডার" },
    { key: "leaderboard", href: "../student/leaderboard.html", icon: icons.chart, label: "লিডারবোর্ড" },
    { key: "improvement", href: "../student/improvement.html", icon: icons.improvement, label: "উন্নতি" },
    { key: "profile", href: "../student/profile.html", icon: icons.user, label: "প্রোফাইল" }
  ];


  const safeName =
    escapeNotification(
      student?.name || "শিক্ষার্থী"
    );

  const safeStudentId =
    escapeNotification(
      student?.studentId || ""
    );


  const initial =
    String(
      student?.name ||
      "শিক্ষার্থী"
    ).charAt(0);


  const html = `
    <header class="hdr">
      <div class="hdr-row">
        <button type="button" class="hdr-user" id="hdrUserBtn" aria-haspopup="true" aria-expanded="false" aria-label="মেনু">
          <span class="brand-mark hdr-avatar">${
            student?.photoURL
              ? `<img src="${escapeNotification(student.photoURL)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />`
              : escapeNotification(initial)
          }</span>
          <span class="hdr-user-text">
            <span class="hdr-name">${safeName}</span>
            <span class="hdr-id">${safeStudentId}</span>
          </span>
          <svg class="hdr-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>

        <div class="hdr-actions" style="position:relative;">
          

        <div
          class="student-global-notification"
          id="studentGlobalNotification"
        >

          <button
            class="global-notification-btn hdr-icon"
            id="globalNotificationBtn"
            type="button"
            aria-label="Notifications"
            title="Notifications"
          >

            ${icons.bell}

            <span
              class="global-notification-dot"
              id="globalNotificationDot"
            ></span>

            <span
              class="global-notification-count"
              id="globalNotificationCount"
            ></span>

          </button>


          <!-- Notification panel -->

          <div
            class="global-notification-panel"
            id="globalNotificationPanel"
          >

            <div
              class="global-notification-head"
            >

              <strong>
                Notifications
              </strong>

              <button
                type="button"
                id="globalNotificationClose"
              >
                বন্ধ করুন
              </button>

            </div>


            <div
              class="global-notification-list"
              id="globalNotificationList"
            >

              <div
                class="global-notification-empty"
              >
                লোড হচ্ছে...
              </div>

            </div>

          </div>

        </div>
        </div>
      </div>

      <div class="hdr-menu" id="hdrMenu" role="menu">
        <div class="hdr-menu-head">
          <span class="brand-mark hdr-menu-av">${
            student?.photoURL
              ? `<img src="${escapeNotification(student.photoURL)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />`
              : escapeNotification(initial)
          }</span>
          <span class="hdr-menu-who"><b>${safeName}</b>${safeStudentId ? `<small>${safeStudentId}</small>` : ""}</span>
        </div>

        <div class="hdr-menu-group">
          <a href="../student/history.html" class="hdr-menu-item ${activeKey === "history" ? "active" : ""}" role="menuitem">
            <span class="hdr-menu-ico">${icons.history}</span><span class="hdr-menu-txt">ইতিহাস</span>
            <svg class="hdr-menu-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
          </a>
          <button type="button" class="hdr-menu-item" id="hdrQrBtn" role="menuitem">
            <span class="hdr-menu-ico hdr-menu-ico--accent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3M21 14v.01M14 21h.01M17.5 21H21v-3.5"/></svg></span>
            <span class="hdr-menu-txt"><span>ইনভাইট QR</span><small>বন্ধু স্ক্যান করলেই XP</small></span>
            <svg class="hdr-menu-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
          </button>
        </div>

        <div class="hdr-menu-group">
          <div class="hdr-menu-label">পছন্দ</div>
          <div class="hdr-menu-item hdr-menu-row hdr-theme-row">
            <span class="hdr-menu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></span>
            <button type="button" class="hdr-theme-info" id="themeSettingsBtn" aria-label="থিম সেটিংস খোলো">
              <span class="hdr-theme-title">ডার্ক মোড</span>
              <small data-theme-status>${themeStatusText()}</small>
            </button>
            <button class="theme-toggle" id="themeToggle" type="button" aria-label="থিম পরিবর্তন" title="থিম পরিবর্তন"><span class="theme-toggle-thumb"></span></button>
          </div>
          <div class="hdr-menu-item hdr-menu-row">
            <span class="hdr-menu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6"/></svg></span>
            <span class="hdr-menu-txt"><span>পরীক্ষার টাইমার</span></span>
            <button class="hdr-switch" id="examTimerToggle" type="button" role="switch" aria-checked="true" aria-label="পরীক্ষার টাইমার দেখাও বা লুকাও"><span></span></button>
          </div>
        </div>

        <div class="hdr-menu-group">
          <a href="../index.html" class="hdr-menu-item" role="menuitem">
            <span class="hdr-menu-ico">${icons.arrowLeft}</span><span class="hdr-menu-txt">প্রধান পেজে ফিরুন</span>
          </a>
          <button type="button" class="hdr-menu-item hdr-menu-danger" id="hdrLogoutBtn" role="menuitem">
            <span class="hdr-menu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg></span>
            <span class="hdr-menu-txt">লগআউট</span>
          </button>
        </div>
      </div>
    </header>

    ${document.getElementById("hdrNavPersist") ? "" : `<nav class="hdr-nav" aria-label="প্রধান মেনু">
      ${tabs.map(tab => `
        <a href="${tab.href}" class="hdr-nav-tab ${tab.key === activeKey ? "active" : ""}" ${tab.key === activeKey ? 'aria-current="page"' : ""}>
          <span class="hdr-nav-ico">${tab.icon}</span>
          <span class="hdr-nav-label">${tab.label}</span>
        </a>`).join("")}
    </nav>`}
  `;


  // =======================================================
  // IMPORTANT:
  // Header HTML is returned first.
  // After the caller puts it into DOM,
  // notification system is initialized.
  // =======================================================

  queueMicrotask(() => {

    const btn =
      document.getElementById(
        "globalNotificationBtn"
      );

    const panel =
      document.getElementById(
        "globalNotificationPanel"
      );

    const close =
      document.getElementById(
        "globalNotificationClose"
      );

    // ---------- Theme switch (single binding for all student pages) ----------
    const themeBtn = document.getElementById("themeToggle");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
    document.getElementById("themeSettingsBtn")?.addEventListener("click", openThemeSheet);

    // ---------- Exam timer show/hide switch ----------
    const timerSwitch = document.getElementById("examTimerToggle");
    if (timerSwitch) {
      const paintSwitch = () => {
        const on = !isExamTimerHidden();
        timerSwitch.classList.toggle("on", on);
        timerSwitch.setAttribute("aria-checked", on ? "true" : "false");
      };
      paintSwitch();
      timerSwitch.addEventListener("click", () => setExamTimerHidden(!isExamTimerHidden()));
      window.addEventListener("examtimer:change", paintSwitch);
    }

    // ---------- Avatar menu ----------
    const userBtn = document.getElementById("hdrUserBtn");
    const menu = document.getElementById("hdrMenu");
    if (userBtn && menu) {
      const setMenu = open => {
        menu.classList.toggle("open", open);
        userBtn.setAttribute("aria-expanded", open ? "true" : "false");
      };
      userBtn.onclick = e => { e.stopPropagation(); setMenu(!menu.classList.contains("open")); };
      menu.addEventListener("click", e => e.stopPropagation());
      document.addEventListener("click", () => setMenu(false));
      document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
    }

    // ---------- Invite QR (opens the shared bottom sheet) ----------
    const qrBtn = document.getElementById("hdrQrBtn");
    if (qrBtn) qrBtn.onclick = async () => {
      if (menu) { menu.classList.remove("open"); userBtn?.setAttribute("aria-expanded", "false"); }
      try {
        const m = await import("./invite-sheet.js");
        let xpEach = 0;
        try { xpEach = (await import("./xp-utils.js")).REFERRAL_XP || 0; } catch {}
        m.openInviteSheet(student, { xpPerFriend: xpEach });
      } catch (e) { console.error(e); showToast("QR খোলা যায়নি", "error"); }
    };

    // ---------- Logout ----------
    const logoutBtn = document.getElementById("hdrLogoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        if (!confirm("লগআউট করবে?")) return;
        try { const m = await import("./student-auth.js"); await m.studentLogout(); }
        catch (e) { localStorage.removeItem("activeStudent"); }
        window.location.href = "../index.html";
      };
    }

    // ---------- Open / close notification ----------

    if (btn && panel) {

      btn.onclick = event => {

        event.stopPropagation();

        panel.classList.toggle(
          "show"
        );

      };

    }


    // ---------- Close button ----------

    if (close && panel) {

      close.onclick = event => {

        event.stopPropagation();

        panel.classList.remove(
          "show"
        );

      };

    }


    // ---------- Start Firebase listeners ----------

    startGlobalNotificationSystem(
      student
    );

  });

  // Missed-exam penalty popup: one-time animated notice per missed exam, shown on
  // whichever student page opens first (the XP itself is already updated everywhere).
  if (student && student.studentId) {
    setTimeout(() => {
      import("./missed-penalty-alert.js")
        .then(m => m.checkMissedPenalty(student))
        .catch(e => console.warn("penalty alert", e));
    }, 1200);
  }

  return html;
         }
// =========================================================
// Optional helper utilities
// =========================================================

// ---------- Safe text ----------
export function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();

  return text || fallback;
}


// ---------- Number formatter ----------
export function formatNumber(value, digits = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }
  );
}


// ---------- Percentage formatter ----------
export function formatPercentage(
  value,
  digits = 1
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0%";
  }

  return `${number.toFixed(digits)}%`;
}


// ---------- Date formatter ----------
export function formatDate(value) {
  const ms =
    notificationMillis(value);

  if (!ms) {
    return "";
  }

  try {
    return new Date(ms).toLocaleDateString(
      "bn-BD",
      {
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    );
  } catch {
    return "";
  }
}


// ---------- Time formatter ----------
export function formatTime(value) {
  const ms =
    notificationMillis(value);

  if (!ms) {
    return "";
  }

  try {
    return new Date(ms).toLocaleTimeString(
      "bn-BD",
      {
        hour: "numeric",
        minute: "2-digit"
      }
    );
  } catch {
    return "";
  }
}


// =========================================================
// Small DOM helpers
// =========================================================

export function qs(
  selector,
  root = document
) {
  return root.querySelector(selector);
}


export function qsa(
  selector,
  root = document
) {
  return [
    ...root.querySelectorAll(selector)
  ];
}


export function on(
  element,
  event,
  handler,
  options
) {
  if (!element) {
    return () => {};
  }

  element.addEventListener(
    event,
    handler,
    options
  );

  return () => {
    element.removeEventListener(
      event,
      handler,
      options
    );
  };
}


// =========================================================
// Empty / loading helpers
// =========================================================

export function showLoading(
  container,
  message = "লোড হচ্ছে..."
) {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="state-block">

      <div class="spinner"></div>

      <p class="text-sm">
        ${escapeNotification(message)}
      </p>

    </div>
  `;
}


export function showEmpty(
  container,
  message = "কোনো তথ্য পাওয়া যায়নি।"
) {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="state-block">

      ${ICONS.empty}

      <p class="text-sm">
        ${escapeNotification(message)}
      </p>

    </div>
  `;
}


export function showError(
  container,
  message = "একটি সমস্যা হয়েছে।"
) {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="state-block">

      ${ICONS.error}

      <p class="text-sm">
        ${escapeNotification(message)}
      </p>

    </div>
  `;
}


// =========================================================
// Button loading state
// =========================================================

export function setButtonLoading(
  button,
  loading,
  loadingText = "অপেক্ষা করুন..."
) {
  if (!button) {
    return;
  }

  if (loading) {

    if (
      !button.dataset.originalText
    ) {
      button.dataset.originalText =
        button.textContent;
    }

    button.disabled = true;

    button.innerHTML = `
      <span
        class="spinner"
        style="
          width:14px;
          height:14px;
          border-width:2px;
        "
      ></span>

      ${escapeNotification(
        loadingText
      )}
    `;

  } else {

    button.disabled = false;

    if (
      button.dataset.originalText !==
      undefined
    ) {
      button.textContent =
        button.dataset.originalText;

      delete button.dataset.originalText;
    }

  }
}


// =========================================================
// Theme button binding
// =========================================================

export function bindThemeToggle() {
  const button = document.getElementById("themeToggle");
  if (!button) return;
  button.onclick = toggleTheme;
}


// =========================================================
// Re-bind global header after dynamic rendering
// =========================================================

export function bindStudentHeader(
  student
) {

  const button =
    document.getElementById(
      "globalNotificationBtn"
    );

  const panel =
    document.getElementById(
      "globalNotificationPanel"
    );

  const close =
    document.getElementById(
      "globalNotificationClose"
    );


  // ---------- Notification button ----------

  if (button && panel) {

    button.onclick =
      event => {

        event.stopPropagation();

        panel.classList.toggle(
          "show"
        );

      };

  }


  // ---------- Close ----------

  if (close && panel) {

    close.onclick =
      event => {

        event.stopPropagation();

        panel.classList.remove(
          "show"
        );

      };

  }


  // ---------- Theme ----------

  bindThemeToggle();


  // ---------- Notification system ----------

  if (student?.studentId) {

    startGlobalNotificationSystem(
      student
    );

  }

}


// =========================================================
// Cleanup when changing active student
// =========================================================

export function cleanupStudentHeader() {

  stopGlobalNotificationListeners();

  const panel =
    document.getElementById(
      "globalNotificationPanel"
    );

  if (panel) {
    panel.classList.remove(
      "show"
    );
  }

}


// =========================================================
// Reset hidden notifications
// NOTE:
// This is intentionally NOT used automatically.
// Hidden notifications remain hidden permanently
// for their individual notification key.
// =========================================================

export function resetHiddenNotifications() {

  try {

    localStorage.removeItem(
      NOTIF_HIDE_KEY
    );

  } catch {}

}


// =========================================================
// Debug helper
// =========================================================

export function debugNotificationSystem() {

  const button =
    document.getElementById(
      "globalNotificationBtn"
    );

  const panel =
    document.getElementById(
      "globalNotificationPanel"
    );

  const list =
    document.getElementById(
      "globalNotificationList"
    );

  console.log(
    "Global Notification System:",
    {
      buttonFound: !!button,
      panelFound: !!panel,
      listFound: !!list
    }
  );

  return {
    button,
    panel,
    list
  };

}


// =========================================================
// Initial theme setup
// =========================================================

try {

  initTheme();

} catch (err) {

  console.error(
    "Theme initialization failed:",
    err
  );

}


/* ---------- Exam countdown timer: show/hide preference (this device) ---------- */
const EXAM_TIMER_KEY = "examTimerHidden";
export function isExamTimerHidden() {
  try { return localStorage.getItem(EXAM_TIMER_KEY) === "1"; } catch { return false; }
}
export function setExamTimerHidden(hidden) {
  try { localStorage.setItem(EXAM_TIMER_KEY, hidden ? "1" : "0"); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event("examtimer:change"));
}
