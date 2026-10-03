/* =========================================================
   FRIEND CHAT — WhatsApp-style chat between friends (বন্ধু).

   - Nobody types a message: every message is a ready-made PRESET (emoji + text).
   - 1-to-1 chats (only between friends) and friend groups (max 5 incl. creator).
   - A group invite must be APPROVED by each invited friend before they join.
   - Only the latest 30 messages of a room are kept / shown.
   - "Delete for me" and "Delete for everyone" (own messages) per message.
   - One message per 2 minutes per student (enforced by firestore.rules too,
     through the `chatMeta/{studentId}.lastSentAt` doc).

   Collections
     chatRooms/{roomId}
        type        "dm" | "group"
        members     [studentId]   accepted members (dm: both)
        invited     [studentId]   group invites waiting for approval
        name        group name ("" => auto name from members)
        createdBy   studentId
        createdAt, lastAt (timestamps)
        lastMsg     { id, from, key, text }   (for the chat list preview)
        unread      { [studentId]: number }   unread counter per member
     chatRooms/{roomId}/messages/{msgId}
        from, key, text, createdAt, deletedFor:[ids], deletedForAll:bool
     chatMeta/{studentId}       { lastSentAt }  -> 2 minute cooldown

   dm room id = "dm_" + the two studentIds sorted and joined with "_".
   ========================================================= */
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter,
  onSnapshot, writeBatch, serverTimestamp, increment, arrayUnion, arrayRemove, FieldPath
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const CHAT_COOLDOWN_MS = 2 * 60 * 1000;
export const CHAT_KEEP = 30;          // messages kept / shown per room
export const GROUP_MAX = 5;           // members incl. the creator
export const GROUP_NAME_MAX = 24;
const COOLDOWN_SAFETY_MS = 1500;      // client waits a hair longer than the server rule

/* ---------------- preset messages (no typing) ---------------- */
export const CHAT_CATS = [
  { key: "greet", label: "শুভেচ্ছা", emoji: "👋" },
  { key: "exam",  label: "পরীক্ষা",  emoji: "📝" },
  { key: "study", label: "পড়াশোনা", emoji: "📚" },
  { key: "fight", label: "চ্যালেঞ্জ", emoji: "⚔️" },
  { key: "fun",   label: "মজা",      emoji: "😂" },
  { key: "emoji", label: "ইমোজি",    emoji: "😊" }
];
const P = (key, cat, emoji, text) => ({ key, cat, emoji, text });
export const CHAT_PRESETS = [
  P("m01", "greet", "👋", "Hello"),
  P("m02", "greet", "😊", "কেমন আছো?"),
  P("m13", "greet", "☀️", "Good morning"),
  P("m15", "greet", "🌅", "শুভ সকাল"),
  P("m14", "greet", "🌙", "Good night"),
  P("m16", "greet", "😴", "শুভ রাত্রি"),
  P("m30", "greet", "🤝", "Welcome"),
  P("m28", "greet", "🙏", "Thanks বন্ধু"),
  P("m29", "greet", "🥺", "Sorry"),
  P("m31", "greet", "🎂", "শুভ জন্মদিন"),
  P("m32", "greet", "🪔", "শুভ উৎসব"),
  P("m33", "greet", "💛", "ভালো থেকো"),
  P("m34", "greet", "💞", "Miss you"),
  P("m35", "greet", "⏳", "পরে কথা বলবো"),

  P("m03", "exam", "🍀", "Tomorrow exam, best of luck"),
  P("m04", "exam", "🏆", "All the best!"),
  P("m50", "exam", "🤞", "Result-এর জন্য best of luck"),
  P("m26", "exam", "🏫", "Exam hall-এ দেখা হবে"),
  P("m36", "exam", "🤔", "আজ exam কেমন হলো?"),
  P("m37", "exam", "😵", "Question কঠিন ছিলো"),
  P("m38", "exam", "😌", "Question সোজা ছিলো"),
  P("m05", "exam", "👏", "দারুণ করেছো!"),
  P("m09", "exam", "🎯", "অসাধারণ রেজাল্ট!"),
  P("m10", "exam", "🎉", "Congratulations"),
  P("m11", "exam", "💪", "তুমি পারবে"),
  P("m12", "exam", "🤗", "চিন্তা করো না, ঠিক হয়ে যাবে"),
  P("m27", "exam", "🍃", "শান্ত থেকো, ভালো করবে"),

  P("m07", "study", "📖", "পড়তে বসো"),
  P("m08", "study", "📚", "আজ পড়া হলো?"),
  P("m23", "study", "✏️", "Revision শুরু করো"),
  P("m24", "study", "✅", "আজকের টার্গেট শেষ?"),
  P("m25", "study", "🧪", "Mock test দাও"),
  P("m39", "study", "📝", "Notes দেবে?"),
  P("m40", "study", "👥", "একসাথে পড়বো?"),
  P("m41", "study", "⚡", "Study streak ধরে রাখো"),
  P("m42", "study", "⏰", "সময় নষ্ট করো না"),
  P("m43", "study", "📵", "Phone রাখো, পড়ো"),

  P("m06", "fight", "🔥", "আগুন!"),
  P("m17", "fight", "👍", "Keep it up"),
  P("m18", "fight", "🚀", "লিডারবোর্ডে এগিয়ে যাও"),
  P("m19", "fight", "😎", "আমি তোমাকে ধরে ফেলবো"),
  P("m20", "fight", "⚔️", "Rival, ready?"),
  P("m21", "fight", "🥊", "চ্যালেঞ্জ নেবে?"),
  P("m22", "fight", "🛡️", "Battle-এ আসো"),
  P("m44", "fight", "📈", "Top 10-এ আসছো"),
  P("m45", "fight", "🌟", "Proud of you"),
  P("m46", "fight", "💯", "Don't give up"),

  P("m47", "fun", "😮", "Wow!"),
  P("m48", "fun", "😂", "হাহা"),
  P("m49", "fun", "🏃", "জলদি আসো"),

  // emoji-only messages
  ...["👍", "❤️", "😂", "🔥", "👏", "🎉", "😮", "😢", "🙏", "💯", "😎", "🤝", "💪", "🥳", "😍", "🤗", "😅", "✨"]
    .map((e, i) => ({ key: "e" + String(i + 1).padStart(2, "0"), cat: "emoji", emoji: e, text: "" }))
];
const PRESET_MAP = new Map(CHAT_PRESETS.map(p => [p.key, p]));
export const presetByKey = key => PRESET_MAP.get(key) || null;
export const isEmojiOnly = p => !!p && !p.text;
export const presetLine = p => p ? (p.text ? `${p.emoji} ${p.text}` : p.emoji) : "";

/* ---------------- helpers ---------------- */
export function toMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
}
export const dmRoomId = (a, b) => "dm_" + [a, b].sort().join("_");
export const otherMember = (room, me) => (room.members || []).find(x => x !== me) || (room.members || [])[0];

const roomRef = id => doc(db, "chatRooms", id);
const msgCol = id => collection(db, "chatRooms", id, "messages");
const asRoom = d => ({ id: d.id, ...d.data() });
const lastLocalKey = id => `chatLast_${id}`;

/* ---------------- 2 minute cooldown ---------------- */
export function chatWaitMs(me, serverLastMs = 0) {
  let local = 0;
  try { local = Number(localStorage.getItem(lastLocalKey(me))) || 0; } catch (e) {}
  const last = Math.max(local, serverLastMs || 0);
  return last ? Math.max(0, last + CHAT_COOLDOWN_MS + COOLDOWN_SAFETY_MS - Date.now()) : 0;
}
export async function loadChatMeta(me) {
  try {
    const s = await getDoc(doc(db, "chatMeta", me));
    return s.exists() ? toMs(s.data().lastSentAt) : 0;
  } catch (e) { return 0; }
}

/* ---------------- live listeners ---------------- */
// Rooms I'm a member of + group invites waiting for me.
// cb({ rooms, invites }) fires on every change. Returns an unsubscribe fn.
export function watchRooms(me, cb, onError) {
  let rooms = [], invites = [], gotRooms = false, gotInv = false;
  const emit = () => { if (gotRooms && gotInv) cb({ rooms, invites }); };
  const col = collection(db, "chatRooms");
  const u1 = onSnapshot(query(col, where("members", "array-contains", me)), s => { rooms = s.docs.map(asRoom); gotRooms = true; emit(); }, e => onError && onError(e));
  const u2 = onSnapshot(query(col, where("invited", "array-contains", me)), s => { invites = s.docs.map(asRoom); gotInv = true; emit(); }, e => onError && onError(e));
  return () => { try { u1(); } catch (e) {} try { u2(); } catch (e) {} };
}

// Light version for badges on other pages: cb({ unread, invites, total, rooms, inviteRooms })
export function watchChatBadge(me, cb) {
  return watchRooms(me, ({ rooms, invites }) => {
    const unread = rooms.reduce((n, r) => n + (Number(r.unread?.[me]) || 0), 0);
    cb({ unread, invites: invites.length, total: unread + invites.length, rooms, inviteRooms: invites });
  }, () => cb({ unread: 0, invites: 0, total: 0, rooms: [], inviteRooms: [] }));
}

// Latest CHAT_KEEP messages of a room, oldest -> newest.
// cb(list, oldestDocSnapshot, fromCache)
export function watchMessages(roomId, cb, onError) {
  return onSnapshot(query(msgCol(roomId), orderBy("createdAt", "desc"), limit(CHAT_KEEP)), snap => {
    const docs = snap.docs;
    const list = docs.map(d => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites })).reverse();
    cb(list, docs.length >= CHAT_KEEP ? docs[docs.length - 1] : null, snap.metadata.fromCache);
  }, e => onError && onError(e));
}

// Physically remove messages older than the newest CHAT_KEEP (best effort —
// the rules only let you delete your own, or anything older than 6 hours).
export async function trimRoom(roomId, oldestKeptDoc) {
  if (!oldestKeptDoc) return;
  try {
    const snap = await getDocs(query(msgCol(roomId), orderBy("createdAt", "desc"), startAfter(oldestKeptDoc), limit(25)));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref).catch(() => {})));
  } catch (e) { /* not critical */ }
}

/* ---------------- rooms ---------------- */
export async function ensureDm(me, other) {
  if (!me || !other || me === other) throw new Error("চ্যাট খোলা যায়নি।");
  const id = dmRoomId(me, other);
  const ref = roomRef(id);
  const snap = await getDoc(ref);
  if (snap.exists()) return asRoom(snap);
  const [a, b] = [me, other].sort();
  await setDoc(ref, {
    type: "dm", members: [a, b], invited: [], name: "", createdBy: me,
    createdAt: serverTimestamp(), lastAt: serverTimestamp(), lastMsg: null, unread: { [a]: 0, [b]: 0 }
  });
  return { id, type: "dm", members: [a, b], invited: [], name: "", createdBy: me, lastMsg: null, unread: {} };
}

export async function createGroup(me, name, inviteeIds) {
  const ids = [...new Set((inviteeIds || []).filter(x => x && x !== me))];
  if (ids.length < 1) throw new Error("কমপক্ষে একজন বন্ধুকে বেছে নাও।");
  if (ids.length + 1 > GROUP_MAX) throw new Error(`গ্রুপে তুমিসহ সর্বোচ্চ ${GROUP_MAX} জন থাকতে পারবে।`);
  const ref = doc(collection(db, "chatRooms"));
  await setDoc(ref, {
    type: "group", members: [me], invited: ids, name: String(name || "").trim().slice(0, GROUP_NAME_MAX),
    createdBy: me, createdAt: serverTimestamp(), lastAt: serverTimestamp(), lastMsg: null, unread: { [me]: 0 }
  });
  return ref.id;
}

export const acceptInvite = (roomId, me) => updateDoc(roomRef(roomId), { members: arrayUnion(me), invited: arrayRemove(me) });
export const declineInvite = (roomId, me) => updateDoc(roomRef(roomId), { invited: arrayRemove(me) });

export async function leaveGroup(room, me) {
  if ((room.members || []).length <= 1) await deleteDoc(roomRef(room.id));   // last one out closes the room
  else await updateDoc(roomRef(room.id), { members: arrayRemove(me) });
}

/* ---------------- messages ---------------- */
export async function sendMessage(room, me, preset, serverLastMs = 0) {
  if (!preset) throw new Error("আগে একটি বার্তা বেছে নাও।");
  if (!(room.members || []).includes(me)) throw new Error("তুমি এই চ্যাটের সদস্য নও।");
  const wait = chatWaitMs(me, serverLastMs);
  if (wait > 0) throw new Error(`আরও ${Math.ceil(wait / 1000)} সেকেন্ড পরে পাঠাতে পারবে।`);

  const ref = doc(msgCol(room.id));
  const text = presetLine(preset);
  const batch = writeBatch(db);
  batch.set(ref, { from: me, key: preset.key, text, createdAt: serverTimestamp(), deletedFor: [], deletedForAll: false });
  const roomUpdate = ["lastMsg", { id: ref.id, from: me, key: preset.key, text }, "lastAt", serverTimestamp()];
  (room.members || []).filter(x => x !== me).forEach(o => roomUpdate.push(new FieldPath("unread", o), increment(1)));
  batch.update(roomRef(room.id), ...roomUpdate);
  batch.set(doc(db, "chatMeta", me), { lastSentAt: serverTimestamp() });
  try { await batch.commit(); }
  catch (e) {
    if (e?.code === "permission-denied") throw new Error("এখনো ২ মিনিট হয়নি — একটু পরে আবার পাঠাও।");
    throw e;
  }
  try { localStorage.setItem(lastLocalKey(me), String(Date.now())); } catch (e) {}
  return ref.id;
}

export const deleteForMe = (roomId, msgId, me) =>
  updateDoc(doc(db, "chatRooms", roomId, "messages", msgId), { deletedFor: arrayUnion(me) });

export async function deleteForEveryone(room, msg) {
  await updateDoc(doc(db, "chatRooms", room.id, "messages", msg.id), { deletedForAll: true, text: "", key: "" });
  if (room.lastMsg?.id === msg.id) {
    await updateDoc(roomRef(room.id), { lastMsg: { id: msg.id, from: msg.from, key: "", text: "", deleted: true } }).catch(() => {});
  }
}

export const markRead = (roomId, me) => updateDoc(roomRef(roomId), new FieldPath("unread", me), 0);
