/* =========================================================
   PLATFORM SETTINGS — currently just the platform's display title
   (shown as the big heading on the student landing page and in the
   admin dashboard). Stored as a single global document since this app
   has one admin. Change frequency is limited to once every 30 days —
   enforced client-side only (same documented Spark-plan trade-off as
   grading-utils.js: no Cloud Function, so this is not tamper-proof
   against a technically sophisticated admin, but is enough to stop
   accidental/impulsive renames).
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const MIN_DAYS_BETWEEN_CHANGES = 30;

// Returns { platformTitle: string|null, titleUpdatedAt: Timestamp|null }
export async function getPlatformSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "general"));
    if (!snap.exists()) return { platformTitle: null, titleUpdatedAt: null };
    const data = snap.data();
    return { platformTitle: data.platformTitle ?? null, titleUpdatedAt: data.titleUpdatedAt ?? null };
  } catch {
    return { platformTitle: null, titleUpdatedAt: null };
  }
}

// Whether the title can be changed right now, given when it was last changed.
// { allowed: true } or { allowed: false, daysRemaining: number }
export function canChangeTitle(titleUpdatedAt) {
  if (!titleUpdatedAt) return { allowed: true }; // never set before — first time is always free
  const last = titleUpdatedAt.toDate ? titleUpdatedAt.toDate() : new Date(titleUpdatedAt);
  const daysSince = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince >= MIN_DAYS_BETWEEN_CHANGES) return { allowed: true };
  return { allowed: false, daysRemaining: Math.ceil(MIN_DAYS_BETWEEN_CHANGES - daysSince) };
}

export async function setPlatformTitle(title) {
  const trimmed = (title || "").trim();
  if (!trimmed) throw new Error("নাম খালি রাখা যাবে না।");
  await setDoc(doc(db, "settings", "general"), {
    platformTitle: trimmed,
    titleUpdatedAt: serverTimestamp()
  }, { merge: true });
}
