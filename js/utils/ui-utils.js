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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getUpcomingExams } from "./results-utils.js";

// ---------- Theme (light/dark) ----------
export function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  return saved;
}

export function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") || "light";

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

  attendance: {
    gradient: "linear-gradient(135deg,#fb923c,#ea580c)",
    label: null,
    icon: `
      <path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.5-2-1-2
      .5 2-1 3-2 2 1-2-.5-4-3-7z"/>
      <path d="M9 15a3 3 0 1 0 6 0c0-1-1-2-3-5-2 3-3 4-3 5z"/>
    `
  }
};

export function badgeCard(
  kind,
  { count = 1, label = null } = {}
) {
  const spec = BADGE_KINDS[kind];

  if (!spec) return "";

  const text = label || spec.label || "";

  return `
    <div style="
      background:${spec.gradient};
      border-radius:16px;
      padding:14px 10px;
      text-align:center;
      color:#fff;
      position:relative;
      overflow:hidden;
    ">
      <svg width="26" height="26"
        viewBox="0 0 24 24"
        fill="#fff"
        style="margin:0 auto 6px;display:block;">
        ${spec.icon}
      </svg>

      <p style="
        margin:0;
        font-size:0.74rem;
        font-weight:800;
        line-height:1.3;
      ">
        ${text}
      </p>

      ${
        count > 1
          ? `
            <span style="
              position:absolute;
              top:6px;
              right:6px;
              background:rgba(255,255,255,0.28);
              border-radius:999px;
              padding:1px 7px;
              font-size:0.62rem;
              font-weight:800;
            ">
              ×${count}
            </span>
          `
          : ""
      }
    </div>
  `;
}

export const icons = {
  sun: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2"/>
      <path d="M4.9 4.9l1.4 1.4"/>
      <path d="M17.7 17.7l1.4 1.4"/>
      <path d="M2 12h2M20 12h2"/>
      <path d="M4.9 19.1l1.4-1.4"/>
      <path d="M17.7 6.3l1.4-1.4"/>
    </svg>
  `,

  moon: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <path d="M21 12.8A9 9 0 1 1 11.2 3
        7 7 0 0 0 21 12.8z"/>
    </svg>
  `,

  clock: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 3"/>
    </svg>
  `,

  check: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  `,

  arrowRight: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8">
      <path d="M5 12h14"/>
      <path d="M13 6l6 6-6 6"/>
    </svg>
  `,

  arrowLeft: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8">
      <path d="M19 12H5"/>
      <path d="M11 18l-6-6 6-6"/>
    </svg>
  `,

  user: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
    </svg>
  `,

  home: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <path d="M3 11l9-7 9 7"/>
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4
        a1 1 0 0 0 1-1v-9"/>
    </svg>
  `,

  history: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <path d="M3 12a9 9 0 1 0 3-6.7"/>
      <path d="M3 4v5h5"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  `,

  book: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5
        A2.5 2.5 0 0 0 4 21.5v-17z"/>
      <path d="M20 19H6.5A2.5 2.5 0 0 0 4 21.5"/>
    </svg>
  `,

  chart: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <path d="M3 3v18h18"/>
      <path d="M7 15l4-5 3 3 5-7"/>
    </svg>
  `,

  trendUp: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8">
      <path d="M3 17l6-6 4 4 8-10"/>
      <path d="M15 5h6v6"/>
    </svg>
  `,

  trendDown: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8">
      <path d="M3 7l6 6 4-4 8 10"/>
      <path d="M15 19h6v-6"/>
    </svg>
  `,

  plus: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  `,

  edit: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4
        12.5-12.5z"/>
    </svg>
  `,

  toggle: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <rect x="2" y="7" width="20" height="10" rx="5"/>
      <circle cx="8" cy="12" r="3"
        fill="currentColor"
        stroke="none"/>
    </svg>
  `,

  chevronDown: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8">
      <path d="M6 9l6 6 6-6"/>
    </svg>
  `,

  layers: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <path d="M12 2l9 5-9 5-9-5 9-5z"/>
      <path d="M3 12l9 5 9-5"/>
      <path d="M3 17l9 5 9-5"/>
    </svg>
  `,

  alert: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17
        a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
      <path d="M12 9v4M12 17h.01"/>
    </svg>
  `,

  camera: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11
        a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  `,

  bell: `
    <svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0
        c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
      <path d="M10 21h4"/>
    </svg>
  `
};


/* =========================================================
   GLOBAL STUDENT NOTIFICATIONS

   Friend request + Challenge
   Dashboard / History / Leaderboard / Profile
   সব জায়গায় একই notification system।
   ========================================================= */

const NOTIF_HIDE_KEY = "studentHiddenNotifications";

let notificationUnsubs = [];
let notificationOutsideClickBound = false;


// ---------- Hidden notification IDs ----------
function getHiddenNotificationKeys() {
  try {
    return new Set(
      JSON.parse(
        localStorage.getItem(NOTIF_HIDE_KEY) || "[]"
      )
    );
  } catch {
    return new Set();
  }
}


function hideNotification(key) {
  const keys = getHiddenNotificationKeys();

  keys.add(key);

  localStorage.setItem(
    NOTIF_HIDE_KEY,
    JSON.stringify([...keys])
  );
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
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #22c55e;
      top: 7px;
      right: 7px;
      display: none;
      box-shadow:
        0 0 0 2px var(--bg, #fff);
    }

    .global-notification-count {
      position: absolute;
      min-width: 17px;
      height: 17px;
      padding: 0 4px;
      border-radius: 999px;
      background: #ef4444;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      line-height: 17px;
      text-align: center;
      top: -4px;
      right: -4px;
      display: none;
      box-shadow:
        0 0 0 2px var(--bg, #fff);
    }

    .global-notification-panel {
      position: absolute;
      z-index: 9999;
      top: calc(100% + 10px);
      right: 0;
      width: min(380px, calc(100vw - 24px));
      max-height: 520px;
      overflow: hidden;
      border: 1px solid var(--border, rgba(0,0,0,.08));
      border-radius: 18px;
      background: var(--card-bg, #fff);
      color: var(--text, #111);
      box-shadow:
        0 18px 55px rgba(0,0,0,.16);
      display: none;
    }

    .global-notification-panel.show {
      display: block;
      animation: globalNotifIn .16s ease;
    }

    @keyframes globalNotifIn {
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
      padding: 14px 16px;
      border-bottom: 1px solid var(--border, rgba(0,0,0,.08));
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
    }

    .global-notification-list {
      max-height: 450px;
      overflow-y: auto;
    }

    .global-notification-item {
      padding: 15px 16px;
      border-bottom: 1px solid var(--border, rgba(0,0,0,.07));
    }

    .global-notification-item:last-child {
      border-bottom: 0;
    }

    .global-notification-title {
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 5px;
    }

    .global-notification-copy {
      font-size: 12px;
      line-height: 1.55;
      color: var(--text-muted, #777);
    }

    .global-notification-copy strong {
      color: var(--text, #111);
    }

    .global-notification-time {
      font-size: 10px;
      color: var(--text-muted, #999);
      margin-top: 6px;
    }

    .global-notification-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 11px;
    }

    .global-notification-actions button {
      border: 0;
      border-radius: 9px;
      padding: 7px 10px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
    }

    .global-notification-actions .accept {
      background: #22c55e;
      color: #fff;
    }

    .global-notification-actions
      .global-notif-reject-friend,
    .global-notification-actions
      .global-notif-reject-challenge {
      background: rgba(239,68,68,.1);
      color: #dc2626;
    }

    .global-notification-actions .hide {
      background: var(--surface, rgba(0,0,0,.06));
      color: var(--text-muted, #777);
    }

    .global-notification-empty {
      padding: 28px 18px;
      text-align: center;
      color: var(--text-muted, #888);
      font-size: 12px;
    }

    @media (max-width: 600px) {
      .global-notification-panel {
        position: fixed;
        top: 70px;
        right: 12px;
        left: 12px;
        width: auto;
        max-height: calc(100vh - 90px);
      }

      .global-notification-list {
        max-height: calc(100vh - 150px);
      }
    }
  `;

  document.head.appendChild(style);
}


// ---------- Upcoming exam auto-select ----------
async function refreshChallengeExamPlaceholders(
  challenges
) {
  if (!challenges.length) {
    return challenges;
  }

  let upcoming = [];

  try {
    upcoming = await getUpcomingExams();
  } catch (err) {
    console.warn(
      "Could not load upcoming exams:",
      err
    );
  }

  if (!Array.isArray(upcoming) || !upcoming.length) {
    return challenges;
  }

  const nextExam = upcoming[0];

  if (!nextExam) {
    return challenges;
  }

  const updated = [];

  for (const challenge of challenges) {
    if (
      challenge.examId !== "__NEXT_EXAM__"
    ) {
      updated.push(challenge);
      continue;
    }

    try {
      await updateDoc(
        doc(
          db,
          "examChallenges",
          challenge.id
        ),
        {
          examId:
            nextExam.examId ||
            nextExam.id ||
            "__NEXT_EXAM__",

          examName:
            nextExam.examName ||
            nextExam.name ||
            "পরবর্তী পরীক্ষা"
        }
      );

      updated.push({
        ...challenge,

        examId:
          nextExam.examId ||
          nextExam.id ||
          "__NEXT_EXAM__",

        examName:
          nextExam.examName ||
          nextExam.name ||
          "পরবর্তী পরীক্ষা"
      });
    } catch (err) {
      console.warn(
        "Could not update challenge exam:",
        err
      );

      updated.push(challenge);
    }
  }

  return updated;
}


// ---------- Render notifications ----------
async function renderGlobalNotifications(
  student
) {
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

    const [
      requestSnap,
      challengeSnap,
      studentSnap
    ] = await Promise.all([
      getDocs(requestQuery),
      getDocs(challengeQuery),
      getDocs(collection(db, "students"))
    ]);

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

    // ---------- Hidden ----------
    const hidden =
      getHiddenNotificationKeys();

    const items = [
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
      )
    ]
      .filter(
        item =>
          !hidden.has(item.key)
      )
      .sort(
        (a, b) =>
          notificationMillis(
            b.createdAt
          ) -
          notificationMillis(
            a.createdAt
          )
      );

    // ---------- Badge ----------
    const unreadCount =
      items.length;

    badge.style.display =
      unreadCount
        ? "block"
        : "none";

    count.style.display =
      unreadCount
        ? "grid"
        : "none";

    count.textContent =
      unreadCount > 9
        ? "9+"
        : String(unreadCount);

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
        .map(
          item => {
            if (
              item.type === "friend"
            ) {
              return `
                <div
                  class="global-notification-item"
                >
                  <div
                    class="global-notification-title"
                  >
                    নতুন Friend Request
                  </div>

                  <div
                    class="global-notification-copy"
                  >
                    <strong>
                      ${escapeNotification(
                        item.sender
                      )}
                    </strong>
                    তোমাকে friend request পাঠিয়েছে।
                  </div>

                  <div
                    class="global-notification-time"
                  >
                    ${notificationAge(
                      item.createdAt
                    )}
                  </div>

                  <div
                    class="global-notification-actions"
                  >
                    <button
                      class="accept
                        global-notif-accept-friend"
                      data-id="${escapeNotification(
                        item.id
                      )}"
                    >
                      গ্রহণ
                    </button>

                    <button
                      class="
                        global-notif-reject-friend"
                      data-id="${escapeNotification(
                        item.id
                      )}"
                    >
                      প্রত্যাখ্যান
                    </button>

                    <button
                      class="hide
                        global-notif-hide"
                      data-key="${escapeNotification(
                        item.key
                      )}"
                    >
                      Hide
                    </button>
                  </div>
                </div>
              `;
            }

            return `
              <div
                class="global-notification-item"
              >
                <div
                  class="global-notification-title"
                >
                  নতুন Challenge
                </div>

                <div
                  class="global-notification-copy"
                >
                  <strong>
                    ${escapeNotification(
                      item.sender
                    )}
                  </strong>

                  তোমাকে

                  <strong>
                    ${escapeNotification(
                      item.exam
                    )}
                  </strong>

                  -এ challenge করেছে।

                  <br>

                  Winner
                  <strong>+100</strong>
                  · Loser
                  <strong>+25</strong>
                  · Draw
                  <strong>+50</strong>
                  points
                </div>

                <div
                  class="global-notification-time"
                >
                  ${notificationAge(
                    item.createdAt
                  )}
                </div>

                <div
                  class="global-notification-actions"
                >
                  <button
                    class="accept
                      global-notif-accept-challenge"
                    data-id="${escapeNotification(
                      item.id
                    )}"
                  >
                    গ্রহণ
                  </button>

                  <button
                    class="
                      global-notif-reject-challenge"
                    data-id="${escapeNotification(
                      item.id
                    )}"
                  >
                    প্রত্যাখ্যান
                  </button>

                  <button
                    class="hide
                      global-notif-hide"
                    data-key="${escapeNotification(
                      item.key
                    )}"
                  >
                    Hide
                  </button>
                </div>
              </div>
            `;
          }
        )
        .join("");

   // ---------- Hide ----------
    list
      .querySelectorAll(
        ".global-notif-hide"
      )
      .forEach(
        button => {
          button.onclick = () => {
            hideNotification(
              button.dataset.key
            );

            renderGlobalNotifications(
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
                await updateDoc(
                  doc(
                    db,
                    "friendRequests",
                    button.dataset.id
                  ),
                  {
                    status:
                      "accepted"
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
                    status:
                      "accepted"
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

  renderGlobalNotifications(
    student
  );

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
// Shared header for student-facing pages
// =========================================================

export function renderStudentHeader(
  student,
  activeKey
) {
  const tabs = [
    {
      key: "dashboard",
      href: "../student/dashboard.html",
      icon: icons.home,
      label: "ড্যাশবোর্ড"
    },

    {
      key: "history",
      href: "../student/history.html",
      icon: icons.history,
      label: "ইতিহাস"
    },

    {
      key: "leaderboard",
      href: "../student/leaderboard.html",
      icon: icons.chart,
      label: "লিডারবোর্ড"
    },

    {
      key: "profile",
      href: "../student/profile.html",
      icon: icons.user,
      label: "প্রোফাইল"
    }
  ];

  const html = `
    <div class="topbar student-header">

      <div class="brand">

        ${
          student.photoURL
            ? `
              <img
                src="${student.photoURL}"
                alt=""
                draggable="false"
                oncontextmenu="return false"
                style="
                  width:64px;
                  height:64px;
                  border-radius:50%;
                  object-fit:cover;
                  flex-shrink:0;
                  -webkit-touch-callout:none;
                  -webkit-user-select:none;
                  user-select:none;
                  pointer-events:none;
                "
                onerror="
                  this.replaceWith(
                    Object.assign(
                      document.createElement('div'),
                      {
                        className:'brand-mark',
                        textContent:'${String(
                          student.name || ""
                        ).charAt(0)}'
                      }
                    )
                  )
                "
              >
            `
            : `
              <div
                class="brand-mark"
                style="
                  width:64px;
                  height:64px;
                  font-size:1.6rem;
                "
              >
                ${String(
                  student.name || ""
                ).charAt(0)}
              </div>
            `
        }

        <div>
          <h1 style="font-size:1.3rem;">
            ${student.name || ""}
          </h1>

          <p
            class="text-xs text-muted"
            style="margin:0;"
          >
            ${student.studentId || ""}
          </p>
        </div>

      </div>

      <div class="flex gap-2 items-center">

        <!-- Global Notification -->
        <div
          class="student-global-notification"
        >

          <button
            class="global-notification-btn"
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

        <!-- Theme -->
        <button
          class="theme-toggle"
          id="themeToggle"
        >
          <span
            class="theme-toggle-thumb"
          ></span>
        </button>

        <!-- Student switch -->
        <a
          href="../index.html"
          class="icon-btn"
          title="শিক্ষার্থী পরিবর্তন"
        >
          ${icons.arrowLeft}
        </a>

      </div>
    </div>

    <!-- Navigation -->
    <div
      class="glass card"
      style="
        display:flex;
        padding:6px;
        margin-bottom:var(--space-5);
      "
    >

      ${tabs
        .map(
          tab => `
            <a
              href="${tab.href}"
              style="
                flex:1;
                display:flex;
                flex-direction:column;
                align-items:center;
                gap:4px;
                padding:10px 4px;
                border-radius:12px;
                ${
                  tab.key === activeKey
                    ? `
                      background:
                        var(--color-accent-soft);
                      color:
                        var(--color-accent);
                    `
                    : `
                      color:
                        var(--text-muted);
                    `
                }
              "
            >

              <span
                style="
                  width:20px;
                  height:20px;
                "
              >
                ${tab.icon}
              </span>

              <span
                class="text-xs"
                style="
                  font-weight:600;
                "
              >
                ${tab.label}
              </span>

            </a>
          `
        )
        .join("")}

    </div>
  `;

  // Header caller-এর DOM-এ বসানোর পর
  // notification system initialize হবে।
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

    if (btn && panel) {
      btn.onclick = event => {
        event.stopPropagation();

        panel.classList.toggle(
          "show"
        );
      };
    }

    if (close && panel) {
      close.onclick = () => {
        panel.classList.remove(
          "show"
        );
      };
    }

    startGlobalNotificationSystem(
      student
    );
  });

  return html;
                   }
