/* =========================================================
   STUDENT ACCOUNT DELETION (self-service, with a 7-day undo window)

   1. Student asks to delete (profile > Settings): re-enters PIN + types DELETE.
      A doc deletionRequests/{studentId} is created  (purgeAfter = now + 7 days).
   2. During the 7 days the account works normally and a banner offers "Cancel".
   3. After purgeAfter the student confirms with the PIN again and everything is
      erased: all their Firestore records, then the hidden login (Firebase Auth).
      If the student never comes back, the admin can erase it from the
      "Delete requests" box on admin/students.html.
   Security rules (firestore.rules) only let a student delete their own records
   once purgeAfter has passed, so the 7 days can't be skipped from the console.
   ========================================================= */
import { db, auth } from "../firebase/firebase-config.js";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp }
  from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { EmailAuthProvider, reauthenticateWithCredential, deleteUser }
  from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { studentEmail } from "./student-auth.js";
import { eraseStudentData } from "./student-erase.js";
import { clearActiveStudent } from "./student-utils.js";

export const GRACE_DAYS = 7;
const DAY = 86400000;
const toMs = (t) => (t && t.toMillis ? t.toMillis() : t instanceof Date ? t.getTime() : Number(t) || 0);

export async function getDeletionRequest(studentId) {
  try {
    const s = await getDoc(doc(db, "deletionRequests", studentId));
    if (!s.exists()) return null;
    const d = s.data();
    return { ...d, id: s.id, purgeAt: toMs(d.purgeAfter), due: toMs(d.purgeAfter) <= Date.now() };
  } catch (e) { console.error("deletion request read", e); return null; }
}

async function reauth(studentId, pin) {
  const user = auth.currentUser;
  if (!user) throw new Error("আবার লগইন করো।");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(studentEmail(studentId), pin));
}

export async function requestDeletion(student, pin) {
  await reauth(student.studentId, pin);
  await setDoc(doc(db, "deletionRequests", student.studentId), {
    studentId: student.studentId,
    name: student.name || "",
    className: student.className || "",
    status: "pending",
    requestedAt: serverTimestamp(),
    purgeAfter: Timestamp.fromMillis(Date.now() + GRACE_DAYS * DAY),
  });
}

export async function cancelDeletion(studentId) {
  await deleteDoc(doc(db, "deletionRequests", studentId));
}

/** Student side, after the 7 days: erase everything + the login itself. */
export async function purgeOwnAccount(student, pin) {
  const req = await getDeletionRequest(student.studentId);
  if (!req || !req.due) throw new Error("৭ দিন এখনও পূর্ণ হয়নি।");
  await reauth(student.studentId, pin);
  // admin-only leftovers (setup codes) may fail here — the admin box clears them
  const rep = await eraseStudentData(student.studentId, student.docId);
  await deleteDoc(doc(db, "deletionRequests", student.studentId));
  await deleteUser(auth.currentUser);
  clearActiveStudent();
  return rep;
}

/** Admin side: erase a student's data (login must be removed from Firebase console). */
export async function adminPurge(studentId, studentDocId) {
  const rep = await eraseStudentData(studentId, studentDocId);
  try { await deleteDoc(doc(db, "deletionRequests", studentId)); } catch (e) {}
  return rep;
}

/* ---------------------------- UI ---------------------------- */
const CSS = `
.sd-ov{position:fixed;inset:0;z-index:300;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,18,10,.55);opacity:0;transition:opacity .2s}
.sd-ov.in{opacity:1}
.sd{width:min(100%,440px);max-height:94vh;overflow:auto;background:var(--surface-solid,#fff);color:var(--text-primary,#21262f);border-radius:26px 26px 0 0;padding:10px 20px calc(22px + env(safe-area-inset-bottom));transform:translateY(40px);transition:transform .28s cubic-bezier(.22,1,.36,1)}
.sd-ov.in .sd{transform:none}
@media(min-width:600px){.sd-ov{align-items:center}.sd{border-radius:26px}}
.sd-grab{width:40px;height:4px;border-radius:4px;background:var(--surface-border,#ddd);margin:0 auto 14px}
.sd h3{margin:0;font-size:1.1rem;font-weight:900;color:#d6455d}
.sd p{margin:8px 0 0;font-size:.84rem;font-weight:600;line-height:1.7;color:var(--text-secondary,#5b6270)}
.sd ul{margin:10px 0 0;padding-left:18px;font-size:.82rem;font-weight:600;line-height:1.8;color:var(--text-secondary,#5b6270)}
.sd input{display:block;width:100%;box-sizing:border-box;min-height:48px;margin-top:10px;padding:0 14px;border-radius:13px;border:1px solid var(--surface-border,#ddd);background:var(--surface-highlight,#faf9f5);color:inherit;font:inherit;font-weight:700;outline:none}
.sd input:focus{border-color:var(--color-accent,#b8863c)}
.sd-err{min-height:18px;margin-top:8px;font-size:.78rem;font-weight:700;color:#d6455d}
.sd-row{display:flex;gap:10px;margin-top:6px}
.sd-btn{flex:1;min-height:48px;border-radius:14px;border:1px solid var(--surface-border,#ddd);background:transparent;color:inherit;font:inherit;font-weight:800;cursor:pointer}
.sd-btn.dg{background:#d6455d;border-color:#d6455d;color:#fff}
.sd-btn:disabled{opacity:.45;cursor:default}
.sd-bn{position:fixed;z-index:150;left:12px;right:12px;bottom:calc(98px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;padding:12px 14px;border-radius:16px;background:var(--surface-solid,#fff);border:1px solid rgba(214,69,93,.45);box-shadow:0 10px 30px rgba(0,0,0,.18);display:flex;gap:10px;align-items:center}
.sd-bn b{display:block;font-size:.84rem;font-weight:900;color:#d6455d}
.sd-bn span{display:block;font-size:.74rem;font-weight:600;color:var(--text-secondary,#5b6270);margin-top:2px;line-height:1.5}
.sd-bn .sd-btn{flex:none;min-height:38px;padding:0 12px;font-size:.78rem}
.sd-bn > div{flex:1;min-width:0}
`;
function ensureCss() {
  if (document.getElementById("sdCss")) return;
  const s = document.createElement("style"); s.id = "sdCss"; s.textContent = CSS; document.head.appendChild(s);
}
const fmt = (ms) => new Date(ms).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
const toast = (m, t) => { import("./ui-utils.js").then(u => u.showToast(m, t)).catch(() => {}); };

function sheet(html) {
  ensureCss();
  document.querySelector(".sd-ov")?.remove();
  const ov = document.createElement("div"); ov.className = "sd-ov";
  ov.innerHTML = `<div class="sd" role="dialog" aria-modal="true"><div class="sd-grab"></div>${html}</div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add("in"));
  const close = () => { ov.classList.remove("in"); setTimeout(() => ov.remove(), 220); };
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelectorAll("[data-x]").forEach(b => b.onclick = close);
  return { ov, close };
}
const digits = (el) => el.addEventListener("input", () => { el.value = el.value.replace(/\D/g, "").slice(0, 6); });
function errText(e) {
  const c = e?.code || "";
  if (c === "auth/invalid-credential" || c === "auth/wrong-password") return "PIN ভুল।";
  if (c === "auth/too-many-requests") return "অনেকবার ভুল হয়েছে, কিছুক্ষণ পরে চেষ্টা করো।";
  if (c === "auth/network-request-failed") return "ইন্টারনেট সংযোগ নেই।";
  if (c === "permission-denied" || /permission/i.test(e?.message || "")) return "অনুমতি নেই — অ্যাডমিনকে জানাও।";
  return e?.message || "কিছু একটা ভুল হয়েছে।";
}

/** Step 1 — ask for deletion. onDone() runs after the request is saved. */
export function openDeleteFlow(student, onDone) {
  const { ov, close } = sheet(`
    <h3>অ্যাকাউন্ট ডিলিট করবে?</h3>
    <p>তোমার অনুরোধের পর <b>${GRACE_DAYS} দিন</b> অপেক্ষার সময় থাকবে। এই সময়ে মন বদলালে এক ট্যাপে বাতিল করতে পারবে। সময় শেষে নিচের সব স্থায়ীভাবে মুছে যাবে:</p>
    <ul><li>তোমার প্রোফাইল, ছবি ও PIN লগইন</li><li>সব পরীক্ষার ফল, XP, ব্যাজ ও রেকর্ড</li><li>বন্ধু, চ্যাট, স্টোরের জিনিস ও ব্যাটলের তথ্য</li></ul>
    <p>এটা আর ফেরত আনা যাবে না।</p>
    <input id="sdPin" type="password" inputmode="numeric" maxlength="6" placeholder="তোমার ৬ সংখ্যার PIN" autocomplete="current-password">
    <input id="sdWord" type="text" autocapitalize="characters" autocomplete="off" placeholder="নিশ্চিত করতে DELETE লেখো">
    <div class="sd-err" id="sdErr"></div>
    <div class="sd-row"><button class="sd-btn" data-x type="button">থাক</button><button class="sd-btn dg" id="sdGo" type="button" disabled>ডিলিটের অনুরোধ করো</button></div>`);
  const pin = ov.querySelector("#sdPin"), word = ov.querySelector("#sdWord"), go = ov.querySelector("#sdGo"), err = ov.querySelector("#sdErr");
  digits(pin);
  const check = () => { go.disabled = !(pin.value.length === 6 && word.value.trim().toUpperCase() === "DELETE"); };
  pin.addEventListener("input", check); word.addEventListener("input", check);
  go.onclick = async () => {
    go.disabled = true; err.textContent = "";
    try {
      await requestDeletion(student, pin.value);
      close(); toast(`অনুরোধ জমা হয়েছে। ${GRACE_DAYS} দিন পর মুছে যাবে — তার আগে বাতিল করা যাবে।`, "success");
      onDone && onDone();
      checkDeletion(student);
    } catch (e) { err.textContent = errText(e); check(); }
  };
}

/** Step 3 — after the grace period: final erase with PIN. */
function openFinalFlow(student, onDone) {
  const { ov, close } = sheet(`
    <h3>এখনই স্থায়ীভাবে মুছবে?</h3>
    <p>${GRACE_DAYS} দিনের অপেক্ষা শেষ। PIN দিলে তোমার অ্যাকাউন্ট ও সব তথ্য এই মুহূর্তে চিরতরে মুছে যাবে।</p>
    <input id="sdPin" type="password" inputmode="numeric" maxlength="6" placeholder="তোমার ৬ সংখ্যার PIN" autocomplete="current-password">
    <div class="sd-err" id="sdErr"></div>
    <div class="sd-row"><button class="sd-btn" data-x type="button">না, থাক</button><button class="sd-btn dg" id="sdGo" type="button" disabled>চিরতরে মুছো</button></div>`);
  const pin = ov.querySelector("#sdPin"), go = ov.querySelector("#sdGo"), err = ov.querySelector("#sdErr");
  digits(pin); pin.addEventListener("input", () => { go.disabled = pin.value.length !== 6; });
  go.onclick = async () => {
    go.disabled = true; go.textContent = "মোছা হচ্ছে…"; err.textContent = "";
    try {
      await purgeOwnAccount(student, pin.value);
      close();
      alert("তোমার অ্যাকাউন্ট ও সব তথ্য মুছে ফেলা হয়েছে।");
      location.href = "../index.html";
    } catch (e) { err.textContent = errText(e); go.textContent = "চিরতরে মুছো"; go.disabled = pin.value.length !== 6; }
  };
}

/** Shows the pending-deletion banner (call on dashboard / profile). */
export async function checkDeletion(student) {
  if (!student?.studentId) return null;
  document.querySelector(".sd-bn")?.remove();
  const req = await getDeletionRequest(student.studentId);
  if (!req) return null;
  ensureCss();
  const bar = document.createElement("div"); bar.className = "sd-bn";
  bar.innerHTML = req.due
    ? `<div><b>অ্যাকাউন্ট মোছার সময় হয়েছে</b><span>তুমি ডিলিটের অনুরোধ করেছিলে।</span></div><button class="sd-btn" data-c type="button">বাতিল</button><button class="sd-btn dg" data-p type="button">মুছো</button>`
    : `<div><b>অ্যাকাউন্ট ডিলিট হবে ${fmt(req.purgeAt)}</b><span>তার আগে মন বদলালে বাতিল করো।</span></div><button class="sd-btn dg" data-c type="button">বাতিল করো</button>`;
  document.body.appendChild(bar);
  bar.querySelector("[data-c]").onclick = async () => {
    try { await cancelDeletion(student.studentId); bar.remove(); toast("ডিলিটের অনুরোধ বাতিল হয়েছে।", "success"); document.dispatchEvent(new Event("sd:changed")); }
    catch (e) { toast(errText(e), "error"); }
  };
  const p = bar.querySelector("[data-p]"); if (p) p.onclick = () => openFinalFlow(student);
  return req;
}
