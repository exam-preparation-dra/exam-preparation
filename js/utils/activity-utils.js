/* =========================================================
   FRIEND ACTIVITY FEED
   Collection `friendActivity`, one doc per milestone:
     { studentId, type: "exam"|"badge"|"stage"|"streak", title, sub, color,
       createdMs, createdAt, reactions: { [studentId]: "clap"|"fire"|"trophy" } }
   doc id = `${studentId}__${key}` so the same milestone can never be
   posted twice.

   Who writes: each student's OWN browser, when they open their profile or
   the leaderboard (see publishMyActivity). Nothing is posted for history
   that already existed — the first run on a device only records a
   baseline, so the feed never floods. Respects the student's privacy
   switches: exam posts need "records", badge posts need "badges".
   Old posts are deleted by their owner after KEEP_DAYS.
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where,
  serverTimestamp, deleteField, FieldPath
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getPrivacy } from "./student-auth.js";
import { stageOf } from "./stage-utils.js";
import { weeklyStreak, startOfWeekMs, toMillis, DAY_MS } from "./friend-stats-utils.js";

const COL = "friendActivity";
const KEEP_DAYS = 30;       // posts older than this are deleted by their owner
const FEED_DAYS = 14;       // how far back the feed looks
const GOOD_PCT = 80;        // only good exam scores are posted
const MAX_EXAMS_PER_RUN = 3;

export const REACTIONS = [
  { key: "clap",   label: "দারুণ!" },
  { key: "fire",   label: "আগুন!" },
  { key: "trophy", label: "সেরা!" }
];

/* ---------------- publishing ---------------- */
function loadStore(sid) {
  try { const s = JSON.parse(localStorage.getItem("actPub_" + sid)); if (s && s.seen) return s; } catch { /* ignore */ }
  return { base: {}, seen: [], pruned: 0 };
}
function saveStore(sid, st) {
  st.seen = st.seen.slice(-500);
  try { localStorage.setItem("actPub_" + sid, JSON.stringify(st)); } catch { /* ignore */ }
}
const docId = (sid, key) => `${sid}__${key.replace(/[^\w-]/g, "_")}`;

/**
 * student : active student
 * data    : { results: my approved results, xp: my total XP (or null),
 *             badges: [{id,title,rarity}] earned non-common badges (or null) }
 * Fire-and-forget; never throws.
 */
export async function publishMyActivity(student, data = {}) {
  try {
    const sid = student?.studentId;
    if (!sid) return;
    const priv = await getPrivacy(sid);
    const st = loadStore(sid);
    const seen = new Set(st.seen);
    const now = Date.now();
    const out = [];

    // cands: [{ key, post }]  — allowed=false marks them seen without posting
    const consider = (cat, cands, allowed = true) => {
      if (!st.base[cat]) { cands.forEach(c => seen.add(c.key)); st.base[cat] = 1; return; }
      cands.forEach(c => {
        if (seen.has(c.key)) return;
        seen.add(c.key);
        if (allowed) out.push(c);
      });
    };

    const mine = (data.results || []).filter(r => r.studentId === sid || !r.studentId);

    // exams — good scores only, newest few
    const exams = mine.filter(r => Number(r.percentage) >= GOOD_PCT)
      .sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt))
      .map(r => ({
        key: `exam:${r.id || r.resultId || `${r.examId}_${toMillis(r.submittedAt)}`}`,
        post: {
          type: "exam", color: "#2f7d5e",
          title: `${Math.round(Number(r.percentage))}% স্কোর করেছে`,
          sub: String(r.examName || "পরীক্ষা")
        }
      }));
    const before = out.length;
    consider("exam", exams, !!priv.records);
    out.splice(before + MAX_EXAMS_PER_RUN);   // keep only the newest few of this run

    // stage-up
    if (data.xp !== null && data.xp !== undefined) {
      const stg = stageOf(data.xp);
      consider("stage", [{
        key: `stage:${stg.level}`,
        post: { type: "stage", color: stg.color, title: `${stg.name} স্টেজে উঠেছে`, sub: `লেভেল ${stg.level}` }
      }]);
    }

    // weekly-streak milestones (4, 8, 12 …)
    const n = weeklyStreak(mine);
    const lastMs = Math.max(0, ...mine.map(r => toMillis(r.submittedAt) || 0));
    consider("streak", n >= 4 && n % 4 === 0 && lastMs ? [{
      key: `streak:${n}:${startOfWeekMs(lastMs)}`,
      post: { type: "streak", color: "#e0742c", title: `${n} সপ্তাহের স্ট্রিক!`, sub: `টানা ${n} সপ্তাহ পরীক্ষা দিয়েছে` }
    }] : [], true);

    // badges (profile page passes these; leaderboard doesn't)
    if (Array.isArray(data.badges)) {
      consider("badge", data.badges.map(b => ({
        key: `badge:${b.id}`,
        post: { type: "badge", color: "#8b5cf6", title: "নতুন ব্যাজ পেয়েছে", sub: String(b.title || ""), rarity: b.rarity || "" }
      })), !!priv.badges);
    }

    if (out.length) {
      await Promise.all(out.map(c => setDoc(doc(db, COL, docId(sid, c.key)), {
        studentId: sid, ...c.post, createdMs: now, createdAt: serverTimestamp(), reactions: {}
      })));
    }
    st.seen = [...seen];
    saveStore(sid, st);

    // housekeeping: once a day, delete my own old posts
    if (now - (st.pruned || 0) > DAY_MS) {
      st.pruned = now; saveStore(sid, st);
      const snap = await getDocs(query(collection(db, COL), where("studentId", "==", sid)));
      await Promise.all(snap.docs.filter(d => (d.data().createdMs || 0) < now - KEEP_DAYS * DAY_MS).map(d => deleteDoc(d.ref)));
    }
  } catch (e) {
    console.warn("[activity] publish skipped:", e?.message || e);
  }
}

/* ---------------- reading ---------------- */
// ids: friends (+ me). Firestore `in` takes a handful of values, so chunk.
export async function getFriendFeed(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < uniq.length; i += 10) chunks.push(uniq.slice(i, i + 10));
  const snaps = await Promise.all(chunks.map(c => getDocs(query(collection(db, COL), where("studentId", "in", c)))));
  const cutoff = Date.now() - FEED_DAYS * DAY_MS;
  return snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() })))
    .filter(x => (x.createdMs || 0) >= cutoff)
    .sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));
}

// Toggle: same reaction again removes it, a different one switches.
export async function reactToActivity(item, myId, type) {
  const ref = doc(db, COL, item.id);
  if (item.reactions?.[myId] === type) await updateDoc(ref, new FieldPath("reactions", myId), deleteField());
  else await updateDoc(ref, new FieldPath("reactions", myId), type);
}

/* ---------------- rendering (shared by every page) ---------------- */
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bnDigits = s => String(s).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);

export function timeAgo(ms) {
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "এইমাত্র";
  if (m < 60) return `${bnDigits(m)} মিনিট আগে`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${bnDigits(h)} ঘণ্টা আগে`;
  const d = Math.floor(h / 24);
  return d === 1 ? "গতকাল" : `${bnDigits(d)} দিন আগে`;
}

const ico = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const TYPE_ICON = {
  exam:   ico(`<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`),
  badge:  ico(`<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>`),
  stage:  ico(`<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>`),
  streak: ico(`<path d="M12 3c1 4-4 5-4 10a4 4 0 0 0 8 0c0-2-1-3-1.5-4.5C13.5 9 13 6 12 3z"/>`)
};
const REACT_ICON = {
  clap:   ico(`<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M13 10V6a1.5 1.5 0 0 1 3 0v6"/><path d="M7 11a1.5 1.5 0 0 0-3 0v3a8 8 0 0 0 8 8h1a6 6 0 0 0 6-6v-3a1.5 1.5 0 0 0-3 0"/>`),
  fire:   TYPE_ICON.streak,
  trophy: ico(`<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>`)
};

/**
 * items : feed items; ctx : { meId, studentMap, linkProfile(sid) }
 */
export function activityFeedHtml(items, ctx) {
  if (!items.length) {
    return `<div class="af-empty">এখনো কোনো খবর নেই। বন্ধুরা নতুন ব্যাজ, স্টেজ বা ভালো স্কোর পেলে এখানে দেখা যাবে।</div>`;
  }
  return items.map(it => {
    const s = ctx.studentMap?.[it.studentId] || {};
    const mine = it.studentId === ctx.meId;
    const name = mine ? "তুমি" : (s.name || it.studentId);
    const rx = it.reactions || {};
    const counts = {}; Object.values(rx).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    const my = rx[ctx.meId];
    return `<article class="af-item" style="--ac:${esc(it.color || "#8b95a5")}" data-id="${esc(it.id)}">
      <a class="af-av" href="${esc(ctx.linkProfile(it.studentId))}">${esc((s.name || "শ").charAt(0))}${s.photoURL ? `<img src="${esc(s.photoURL)}" alt="" onerror="this.remove()">` : ""}</a>
      <div class="af-main">
        <div class="af-line"><a class="af-nm" href="${esc(ctx.linkProfile(it.studentId))}">${esc(name)}</a> ${esc(it.title)}</div>
        <div class="af-sub"><span class="af-ic">${TYPE_ICON[it.type] || ""}</span><span class="af-subt">${esc(it.sub || "")}</span><span class="af-dot">·</span><time>${timeAgo(it.createdMs || 0)}</time></div>
        <div class="af-react">${REACTIONS.map(r => `<button type="button" class="${my === r.key ? "on" : ""}" data-react="${r.key}" aria-pressed="${my === r.key}">${REACT_ICON[r.key]}<span>${r.label}</span>${counts[r.key] ? `<b>${counts[r.key]}</b>` : ""}</button>`).join("")}</div>
      </div>
    </article>`;
  }).join("");
}

/**
 * Wires reaction buttons inside `host`. Updates the item optimistically,
 * then calls rerender(); on failure it rolls back.
 */
export function bindActivityFeed(host, items, ctx, rerender) {
  host.querySelectorAll(".af-item").forEach(card => {
    const item = items.find(x => x.id === card.dataset.id);
    card.querySelectorAll("[data-react]").forEach(btn => btn.addEventListener("click", async () => {
      if (!item || btn.dataset.busy) return;
      btn.dataset.busy = "1";
      const type = btn.dataset.react, prev = item.reactions?.[ctx.meId];
      item.reactions = { ...(item.reactions || {}) };
      if (prev === type) delete item.reactions[ctx.meId]; else item.reactions[ctx.meId] = type;
      rerender();
      try { await reactToActivity({ id: item.id, reactions: { [ctx.meId]: prev } }, ctx.meId, type); }
      catch (e) {
        console.warn("[activity] react failed", e);
        item.reactions = { ...item.reactions };
        if (prev) item.reactions[ctx.meId] = prev; else delete item.reactions[ctx.meId];
        rerender();
      }
    }));
  });
}
