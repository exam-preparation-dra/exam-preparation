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
        top: 70px;
        right: 12px;
        width: calc(100vw - 24px);
        max-height: 70vh;
      }
    }
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
        .map(item => {

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
                    লুকান
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
                  লুকান
                </button>

              </div>

            </div>
          `;
        })
        .join("");

    // ---------- Hide notification ----------
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

              hideNotification(key);

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

    <!-- =================================================
         TOP HEADER
         ================================================= -->

    <div class="topbar">

      <!-- Student identity -->

      <div
        class="brand"
        style="
          min-width:0;
          display:flex;
          align-items:center;
          gap:10px;
        "
      >

        <div
          class="brand-mark"
          style="
            overflow:hidden;
            display:flex;
            align-items:center;
            justify-content:center;
            flex-shrink:0;
          "
        >

          ${
            student?.photoURL
              ? `
                <img
                  src="${escapeNotification(student.photoURL)}"
                  alt=""
                  style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                    display:block;
                  "
                />
              `
              : escapeNotification(initial)
          }

        </div>


        <div style="min-width:0;">

          <h1
            style="
              font-size:1.05rem;
              margin:0;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
            "
          >
            ${safeName}
          </h1>

          <p
            class="text-xs text-muted"
            style="
              margin:0;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
            "
          >
            ${safeStudentId}
          </p>

        </div>

      </div>


      <!-- =================================================
           RIGHT SIDE ACTIONS
           ================================================= -->

      <div
        class="flex gap-2 items-center"
        style="position:relative;"
      >

        <!-- Global Notification -->

        <div
          class="student-global-notification"
          id="studentGlobalNotification"
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


        <!-- Theme -->

        <button
          class="theme-toggle"
          id="themeToggle"
          type="button"
          aria-label="থিম পরিবর্তন"
          title="থিম পরিবর্তন"
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
          aria-label="শিক্ষার্থী পরিবর্তন"
        >

          ${icons.arrowLeft}

        </a>

      </div>

    </div>


    <!-- =================================================
         NAVIGATION
         ================================================= -->

    <div
      class="glass card"
      style="
        display:flex;
        padding:6px;
        margin-bottom:var(--space-5);
      "
    >

      ${
        tabs
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
                    display:flex;
                    align-items:center;
                    justify-content:center;
                  "
                >
                  ${tab.icon}
                </span>


                <span
                  class="text-xs"
                  style="
                    font-weight:600;
                    text-align:center;
                  "
                >
                  ${tab.label}
                </span>

              </a>

            `
          )
          .join("")
      }

    </div>

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

  const button =
    document.getElementById(
      "themeToggle"
    );

  if (!button) {
    return;
  }

  button.onclick = () => {

    const next =
      toggleTheme();

    button.setAttribute(
      "aria-label",
      next === "dark"
        ? "লাইট মোড"
        : "ডার্ক মোড"
    );

  };
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
