/* =========================================================
   XP STORE — spend XP on real in-app perks.

   First item: a Time Card (৳1000 XP each). Bought ahead of time from the
   store, one or more can then be used any time DURING an exam to add
   +1:30 per card to that exam's original duration. More items will be
   added to STORE_ITEMS later — the cart/purchase flow below is written
   generically so a new item is just a new catalog entry, nothing else
   changes.

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
    tagline: "প্রতি কার্ডে +১ মিনিট ৩০ সেকেন্ড",
    description: "পরীক্ষা চলাকালীন যেকোনো সময় ব্যবহার করে মূল সময়ের সাথে বাড়তি দেড় মিনিট যোগ করা যাবে — কিন্তু আগে থেকে কিনে রাখতে হবে।",
    secondsGranted: 90,
    priceXP: 1000,
    maxPerOrder: 10
  }
  // আরও item এখানে যোগ হবে — বাকি সব কোড (cart/checkout/inventory) নতুন
  // item-এর জন্য নিজে থেকেই কাজ করবে, আলাদা করে কিছু বদলাতে হবে না।
];

export function getStoreItem(itemId) {
  return STORE_ITEMS.find(i => i.id === itemId) || null;
}

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
 */
export async function useStoreItem(studentId, itemId, qty = 1) {
  const item = getStoreItem(itemId);
  if (!item) throw new Error("UNKNOWN_ITEM");
  qty = Math.max(1, Math.floor(Number(qty) || 0));
  const invRef = doc(db, "storeInventory", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(invRef);
    if (!snap.exists()) throw new Error("NOTHING_TO_USE");
    const data = snap.data();
    const items = { ...(data.items || {}) };
    const row = items[itemId] || { purchased: 0, used: 0 };
    const available = Number(row.purchased || 0) - Number(row.used || 0);
    if (available < qty) throw new Error("NOTHING_TO_USE");
    items[itemId] = { ...row, used: Number(row.used || 0) + qty };
    tx.update(invRef, { items, updatedAt: Date.now() });
    return { secondsGranted: (item.secondsGranted || 0) * qty, qtyUsed: qty };
  });
}
