/* =========================================================
   XP STORE — spend XP on real in-app perks.

   First item: a Time Card (৳200 XP each). Bought ahead of time from the
   store, one or more can then be used any time DURING an exam to add
   +1:00 per card to that exam's original duration. More items will be
   added to STORE_ITEMS later — the cart/purchase flow below is written
   generically so a new item is just a new catalog entry, nothing else
   changes. Each use is capped per-exam at MAX_CARDS_PER_ATTEMPT (enforced
   client-side in exam.html, same trust model as everything else here) and
   logged to storeCardUsage for the store's own history list and the admin
   report.

   XP itself is never stored anywhere (computeStudentXP() in xp-utils.js
   always derives it fresh from results/battle/referral/etc). So there is
   no XP "balance" field to decrement on purchase. Instead:
     spendable balance = computeStudentXP().totalXP - totalSpentXP
   where totalSpentXP lives on this student's storeInventory doc and only
   ever goes up. See getSpentXP()/getStoreInventory() below, and pass the
   result into xp-utils.js's computeStudentXP({ spentXP }) wherever the
   store needs to show or re-check a balance.

   Trust model: identical to every other student-facing write in this
   app (battleMatches, attempts, friendRequests, ...) — there is no
   student auth, so this trusts the client. purchaseCart() re-reads and
   re-checks the inventory doc inside a Firestore transaction so two
   concurrent tabs/taps can't double-spend against each other, but a
   student editing devtools could still lie about their own XP number —
   exactly like they already could with any other client-trusted write
   in this app (nothing new here).
   ========================================================= */

import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, addDoc, getDocs, getDoc, query, where,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const STORE_ITEMS = [
  {
    id: "time_extend_card",
    name: "টাইম কার্ড",
    tagline: "প্রতি কার্ডে +১ মিনিট",
    description: "পরীক্ষা চলাকালীন যেকোনো সময় ব্যবহার করে মূল সময়ের সাথে বাড়তি ১ মিনিট যোগ করা যাবে — কিন্তু আগে থেকে কিনে রাখতে হবে।",
    secondsGranted: 60,
    priceXP: 200,
    maxPerOrder: 10
  },
  {
    id: "battle_room_card",
    name: "ব্যাটল রুম কার্ড",
    tagline: "১টি কার্ড = ১টি নতুন Battle",
    description: "নতুন Battle Match তৈরি (Create) করতে ১টি কার্ড লাগবে। কেনার পর কার্ডটি ৬০ দিন (২ মাস) পর্যন্ত ব্যবহারযোগ্য থাকবে।",
    validityDays: 60,     // marks this item as a "room card": buying it also mints
                          // individual expiring cards in battleRoomCards (see
                          // purchaseCart below and consumeBattleRoomCardForMatch)
    priceXP: 50,
    maxPerOrder: 10
  },
  {
    id: "hint_card",
    name: "হিন্ট কার্ড",
    tagline: "১টি কার্ড = ১টি প্রশ্নের উত্তর + ব্যাখ্যা",
    description: "পরীক্ষা চলাকালীন যেকোনো প্রশ্নে ব্যবহার করে সেই প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা দেখে নেওয়া যাবে — একটি কার্ডে একটি প্রশ্নের হিন্ট পাওয়া যাবে।",
    hintsGranted: 1,      // marks this item as a "hint card" for the store UI
                          // (see renderItems()/renderHistory() in store.html)
    priceXP: 300,
    maxPerOrder: 10
  }
  // আরও item এখানে যোগ হবে — বাকি সব কোড (cart/checkout/inventory) নতুন
  // item-এর জন্য নিজে থেকেই কাজ করবে, আলাদা করে কিছু বদলাতে হবে না।
];

export function getStoreItem(itemId) {
  return STORE_ITEMS.find(i => i.id === itemId) || null;
}

/** How many Time Cards a student may use inside a single exam attempt. */
export const MAX_CARDS_PER_ATTEMPT = 10;

/** How many Hint Cards a student may use inside a single exam attempt (separate cap — one per question, not shared with MAX_CARDS_PER_ATTEMPT above). */
export const MAX_HINT_CARDS_PER_ATTEMPT = 5;

/** Total XP this student has ever spent in the store (all items combined). */
export async function getSpentXP(studentId) {
  if (!studentId) return 0;
  const snap = await getDoc(doc(db, "storeInventory", studentId));
  return snap.exists() ? Number(snap.data()?.totalSpentXP || 0) : 0;
}

/** { <itemId>: { purchased, used, available } } for every catalog item. */
export async function getStoreInventory(studentId) {
  const out = {};
  const items = studentId
    ? (await getDoc(doc(db, "storeInventory", studentId))).data()?.items || {}
    : {};
  for (const item of STORE_ITEMS) {
    const row = items[item.id] || { purchased: 0, used: 0 };
    const purchased = Number(row.purchased || 0);
    const used = Number(row.used || 0);
    out[item.id] = { purchased, used, available: Math.max(0, purchased - used) };
  }
  return out;
}

/**
 * Buy a cart of items in one transaction.
 * cart: [{ itemId, qty }]
 * currentXP: this student's freshly-computed total XP (computeStudentXP().totalXP),
 * read by the caller right before checkout — used to re-verify the spend is
 * actually affordable at the moment of purchase.
 */
export async function purchaseCart(studentId, cart, currentXP) {
  if (!studentId) throw new Error("NO_STUDENT");

  const lines = (cart || [])
    .map(c => ({ item: getStoreItem(c.itemId), qty: Math.max(1, Math.floor(Number(c.qty) || 0)) }))
    .filter(l => l.item && l.qty > 0);
  if (!lines.length) throw new Error("EMPTY_CART");
  for (const l of lines) {
    if (l.qty > (l.item.maxPerOrder || 10)) throw new Error("QTY_TOO_HIGH");
  }

  const totalCost = lines.reduce((sum, l) => sum + l.item.priceXP * l.qty, 0);
  const invRef = doc(db, "storeInventory", studentId);

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(invRef);
    const data = snap.exists() ? snap.data() : {};
    const spentSoFar = Number(data.totalSpentXP || 0);
    const newSpent = spentSoFar + totalCost;
    if (newSpent > Number(currentXP || 0)) throw new Error("INSUFFICIENT_XP");

    const items = { ...(data.items || {}) };
    for (const l of lines) {
      const row = items[l.item.id] || { purchased: 0, used: 0 };
      items[l.item.id] = { purchased: Number(row.purchased || 0) + l.qty, used: Number(row.used || 0) };
    }

    tx.set(invRef, { studentId, items, totalSpentXP: newSpent, updatedAt: Date.now() }, { merge: true });
    return { totalCost, newSpent };
  });

  // Best-effort receipt log for the "purchase history" list — not required
  // for balance correctness (that lives in storeInventory.totalSpentXP
  // above), so a failure here never blocks or reverses the purchase.
  Promise.all(lines.map(l => addDoc(collection(db, "storePurchases"), {
    studentId,
    itemId: l.item.id,
    itemName: l.item.name,
    qty: l.qty,
    unitPriceXP: l.item.priceXP,
    totalXP: l.item.priceXP * l.qty,
    createdAtMs: Date.now()
  }))).catch(() => {});

  // Room-card items (validityDays set) also mint one expiring card doc per
  // unit bought, in battleRoomCards -- see consumeBattleRoomCardForMatch().
  // Best-effort like the receipt above: the XP spend already committed
  // above is the source of truth for balance either way.
  const now = Date.now();
  const cardDocs = [];
  for (const l of lines) {
    if (!l.item.validityDays) continue;
    for (let i = 0; i < l.qty; i++) {
      cardDocs.push(addDoc(collection(db, "battleRoomCards"), {
        studentId,
        itemId: l.item.id,
        status: "available",
        purchasedAt: now,
        expiresAt: now + l.item.validityDays * 24 * 60 * 60 * 1000,
        usedAt: null,
        matchCode: null
      }));
    }
  }
  if (cardDocs.length) Promise.all(cardDocs).catch(() => {});

  return result;
}

/** Every purchase this student has made, newest first. */
export async function getPurchaseHistory(studentId) {
  if (!studentId) return [];
  const snap = await getDocs(query(collection(db, "storePurchases"), where("studentId", "==", studentId)));
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
  return rows;
}

/**
 * Consume `qty` purchased units of an item at once (used from inside
 * exam.html when a student taps "টাইম কার্ড ব্যবহার করো" during an exam).
 * Re-checks availability inside a transaction so two taps (or two tabs)
 * can't consume more cards than the student actually owns.
 *
 * `examMeta` ({ examId, examTitle }) is optional context for the usage log
 * (storeCardUsage) — pass it when this is used from inside an exam so the
 * store's history list and the admin report can show which exam it was
 * used in. Logging is best-effort, like the purchase receipt above: a
 * failure here never undoes the already-committed transaction.
 */
export async function useStoreItem(studentId, itemId, qty = 1, examMeta = null) {
  const item = getStoreItem(itemId);
  if (!item) throw new Error("UNKNOWN_ITEM");
  qty = Math.max(1, Math.floor(Number(qty) || 0));
  const invRef = doc(db, "storeInventory", studentId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(invRef);
    if (!snap.exists()) throw new Error("NOTHING_TO_USE");
    const data = snap.data();
    const items = { ...(data.items || {}) };
    const row = items[itemId] || { purchased: 0, used: 0 };
    const available = Number(row.purchased || 0) - Number(row.used || 0);
    if (available < qty) throw new Error("NOTHING_TO_USE");
    items[itemId] = { ...row, used: Number(row.used || 0) + qty };
    tx.update(invRef, { items, updatedAt: Date.now() });
    return { secondsGranted: (item.secondsGranted || 0) * qty, hintsGranted: (item.hintsGranted || 0) * qty, qtyUsed: qty };
  });

  addDoc(collection(db, "storeCardUsage"), {
    studentId,
    itemId,
    itemName: item.name,
    qty,
    secondsGranted: result.secondsGranted,
    hintsGranted: result.hintsGranted,
    examId: examMeta?.examId || null,
    examTitle: examMeta?.examTitle || null,
    createdAtMs: Date.now()
  }).catch(() => {});

  return result;
}

/** Every "use card" event this student has triggered, newest first. */
export async function getUsageHistory(studentId) {
  if (!studentId) return [];
  const snap = await getDocs(query(collection(db, "storeCardUsage"), where("studentId", "==", studentId)));
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
  return rows;
}

/**
 * How many *currently usable* Battle Room Cards (bought, unused, not
 * expired) this student has. Shown on battle-lobby.html next to Create.
 */
export async function getAvailableBattleRoomCardCount(studentId) {
  if (!studentId) return 0;
  const snap = await getDocs(query(
    collection(db, "battleRoomCards"),
    where("studentId", "==", studentId),
    where("status", "==", "available")
  ));
  const now = Date.now();
  return snap.docs.filter(d => Number(d.data()?.expiresAt || 0) > now).length;
}

/**
 * Consume the oldest still-valid Battle Room Card this student owns, for
 * creating match `matchCode`. Throws NO_ROOM_CARD if they have none (all
 * used up, or every card expired) -- battle-lobby.html shows this as
 * "buy a card from the store" and does not create the match.
 */
export async function consumeBattleRoomCardForMatch(studentId, matchCode) {
  if (!studentId) throw new Error("NO_ROOM_CARD");
  const snap = await getDocs(query(
    collection(db, "battleRoomCards"),
    where("studentId", "==", studentId),
    where("status", "==", "available")
  ));
  const now = Date.now();
  const candidates = snap.docs
    .filter(d => Number(d.data()?.expiresAt || 0) > now)
    .sort((a, b) => Number(a.data()?.purchasedAt || 0) - Number(b.data()?.purchasedAt || 0));
  if (!candidates.length) throw new Error("NO_ROOM_CARD");

  const cardRef = candidates[0].ref;
  const itemId = candidates[0].data()?.itemId || "battle_room_card";
  await runTransaction(db, async (tx) => {
    const cardSnap = await tx.get(cardRef);
    if (!cardSnap.exists() || cardSnap.data()?.status !== "available") throw new Error("NO_ROOM_CARD");
    tx.update(cardRef, { status: "used", usedAt: Date.now(), matchCode });
  });

  // Best-effort: keep the generic storeInventory "used" count in sync too,
  // purely so the admin store report's purchased/used/available columns
  // stay meaningful for this item. Never blocks match creation on failure.
  const invRef = doc(db, "storeInventory", studentId);
  runTransaction(db, async (tx) => {
    const invSnap = await tx.get(invRef);
    const data = invSnap.exists() ? invSnap.data() : {};
    const items = { ...(data.items || {}) };
    const row = items[itemId] || { purchased: 0, used: 0 };
    items[itemId] = { ...row, used: Number(row.used || 0) + 1 };
    tx.set(invRef, { studentId, items, totalSpentXP: Number(data.totalSpentXP || 0), updatedAt: Date.now() }, { merge: true });
  }).catch(() => {});

  return cardRef.id;
}

/* ---------- Admin-only reads (rules restrict writes, not reads — but these
   are only ever called from admin/*.html, guarded by requireAdmin()). ---------- */

/** Every student's storeInventory doc, for the admin store report. */
export async function getAllInventoriesForAdmin() {
  const snap = await getDocs(collection(db, "storeInventory"));
  return snap.docs.map(d => ({ studentId: d.id, ...d.data() }));
}

/** Most recent "use card" events across every student, for the admin store report. */
export async function getRecentUsageForAdmin(limitN = 100) {
  const snap = await getDocs(collection(db, "storeCardUsage"));
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
  return rows.slice(0, limitN);
}


/* =========================================================
   FREE CARD CLAIM (after every exam)
   Every student who has submitted an exam can claim free random
   XP-store card(s) for that exam, once:
     - the exam's top scorer gets 2 cards,
     - everyone else gets 1 card.
   "Top scorer" = highest obtainedMarks among all submissions of that exam
   (ties broken by faster timeTakenSeconds; an exact tie makes both top).
   Claimed cards go straight into storeInventory (items[id].purchased += n),
   so they show up in the wallet / store / exam exactly like bought cards --
   but no XP is spent (totalSpentXP is untouched).
   One claim doc per exam+student: examCardClaims/{examId}_{studentId}.
   Same client-trust model as the rest of the store (see header above).
   ========================================================= */

function randomInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

/** The claim this student already made for this exam, or null. */
export async function getExamClaim(examId, studentId) {
  if (!examId || !studentId) return null;
  const snap = await getDoc(doc(db, "examCardClaims", `${examId}_${studentId}`));
  return snap.exists() ? snap.data() : null;
}

/**
 * Claim the free card(s) for one exam. Throws:
 *   NO_RESULT        -- this student has no submission for the exam
 *   ALREADY_CLAIMED  -- already claimed (err.claim holds the earlier claim)
 * Returns { cards: [itemId...], isTop, count }.
 */
export async function claimExamCards(examId, studentId) {
  if (!examId || !studentId) throw new Error("NO_RESULT");

  const snap = await getDocs(query(collection(db, "results"), where("examId", "==", examId)));
  const rows = snap.docs.map(d => d.data());
  const mine = rows.find(r => r.studentId === studentId);
  if (!mine) throw new Error("NO_RESULT");

  const better = (a, b) => {           // is a strictly better than b ?
    const ma = Number(a.obtainedMarks || 0), mb = Number(b.obtainedMarks || 0);
    if (ma !== mb) return ma > mb;
    const ta = Number(a.timeTakenSeconds ?? Infinity), tb = Number(b.timeTakenSeconds ?? Infinity);
    return ta < tb;
  };
  const isTop = !rows.some(r => r.studentId !== studentId && better(r, mine));
  const count = isTop ? 2 : 1;
  const cards = Array.from({ length: count }, () => STORE_ITEMS[randomInt(STORE_ITEMS.length)].id);

  const claimRef = doc(db, "examCardClaims", `${examId}_${studentId}`);
  const invRef = doc(db, "storeInventory", studentId);

  await runTransaction(db, async (tx) => {
    const [claimSnap, invSnap] = await Promise.all([tx.get(claimRef), tx.get(invRef)]);
    if (claimSnap.exists()) {
      const err = new Error("ALREADY_CLAIMED");
      err.claim = claimSnap.data();
      throw err;
    }
    const items = { ...((invSnap.exists() ? invSnap.data().items : null) || {}) };
    for (const id of cards) {
      const row = items[id] || { purchased: 0, used: 0 };
      items[id] = { purchased: Number(row.purchased || 0) + 1, used: Number(row.used || 0) };
    }
    tx.set(invRef, { studentId, items, updatedAt: Date.now() }, { merge: true });
    tx.set(claimRef, { studentId, examId, examName: mine.examName || "", isTop, count, cards, claimedAt: Date.now() });
  });

  // Battle-room cards are individual expiring docs (see purchaseCart) -- mint
  // them too, best-effort; the inventory counter above is already committed.
  const now = Date.now();
  const mints = [];
  for (const id of cards) {
    const item = getStoreItem(id);
    if (!item?.validityDays) continue;
    mints.push(addDoc(collection(db, "battleRoomCards"), {
      studentId, itemId: id, status: "available", purchasedAt: now,
      expiresAt: now + item.validityDays * 24 * 60 * 60 * 1000,
      usedAt: null, matchCode: null, source: "exam_claim"
    }));
  }
  if (mints.length) Promise.all(mints).catch(() => {});

  return { cards, isTop, count };
}
