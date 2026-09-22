import { db, auth } from "/js/firebase/firebase-config.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  addDoc, setDoc, updateDoc, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const ADMIN_EMAIL = "physicslover2312@gmail.com";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));

function assertAdmin() {
  const email = auth?.currentUser?.email || "";
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error("Admin access required.");
  }
}

function questionText(q) {
  return q.question_bn || q.question_en || q.question || "প্রশ্নের লেখা পাওয়া যায়নি।";
}

function questionOptions(q) {
  if (Array.isArray(q.options_bn) && q.options_bn.length) return q.options_bn;
  if (Array.isArray(q.options_en) && q.options_en.length) return q.options_en;
  return Array.isArray(q.options) ? q.options : [];
}

async function getRequest(id) {
  const snap = await getDoc(doc(db, "improvementRequests", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function getQuestionsForRequest(request) {
  const ids = [];
  for (const source of (request?.wrongQuestionSources || [])) {
    const id = typeof source === "string"
      ? source
      : (source.questionId || source.id);
    if (id && !ids.includes(id)) ids.push(id);
  }

  const out = [];
  for (const id of ids.slice(0, 50)) {
    const snap = await getDoc(doc(db, "questions", id));
    if (snap.exists()) out.push({ id: snap.id, ...snap.data(), source: "previous_mistake" });
  }

  if (out.length < 10 && request?.entityId) {
    const field = request.entityType === "subject"
      ? "subjectId"
      : request.entityType === "topic"
        ? "topicId"
        : "chapterId";

    try {
      const q = query(
        collection(db, "questions"),
        where(field, "==", request.entityId),
        limit(20)
      );
      const snap = await getDocs(q);
      snap.docs.forEach(d => {
        if (!out.some(x => x.id === d.id)) {
          out.push({ id: d.id, ...d.data(), source: "related_question" });
        }
      });
    } catch (e) {
      console.warn("Related question lookup skipped:", e);
    }
  }

  return out.filter(q => q.correctAnswer && questionOptions(q).length >= 2);
}

function makeSnapshotQuestions(questions) {
  return questions.map(q => ({
    questionId: q.id,
    question_bn: q.question_bn || "",
    question_en: q.question_en || "",
    question: q.question || "",
    options_bn: Array.isArray(q.options_bn) ? q.options_bn : [],
    options_en: Array.isArray(q.options_en) ? q.options_en : [],
    options: Array.isArray(q.options) ? q.options : [],
    correctAnswer: q.correctAnswer,
    subjectId: q.subjectId || null,
    chapterId: q.chapterId || null,
    topicId: q.topicId || null,
    source: q.source || "admin_selected"
  }));
}

export async function createImprovementTestFromRequest(requestId, options = {}) {
  assertAdmin();

  const request = await getRequest(requestId);
  if (!request) throw new Error("Improvement request পাওয়া যায়নি।");

  const pool = await getQuestionsForRequest(request);
  if (!pool.length) throw new Error("এই improvement-এর জন্য কোনো বৈধ প্রশ্ন পাওয়া যায়নি।");

  const requestedCount = Math.max(1, Math.min(50, Number(options.questionCount) || 10));
  const selected = pool.slice(0, requestedCount);
  const questions = makeSnapshotQuestions(selected);

  const testRef = doc(collection(db, "improvementTests"));
  const snapshotRef = doc(db, "improvementTestSnapshots", testRef.id);

  const batch = writeBatch(db);

  batch.set(testRef, {
    requestId: request.id,
    studentId: request.studentId,
    entityType: request.entityType || null,
    entityId: request.entityId || null,
    entityName: request.entityName || "",
    title: options.title || `উন্নতির অনুশীলন — ${request.entityName || "দুর্বল অংশ"}`,
    description: options.description || "আগের ভুল ও একই শেখার ক্ষেত্রের প্রশ্ন দিয়ে তৈরি অনুশীলন।",
    questionCount: questions.length,
    durationMinutes: Number(options.durationMinutes) || Math.max(5, Math.ceil(questions.length * 1.5)),
    targetAccuracy: Number(request.targetAccuracy) || 65,
    studentIds: [],
    status: "draft",
    published: false,
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  batch.set(snapshotRef, {
    testId: testRef.id,
    requestId: request.id,
    studentId: request.studentId,
    questions,
    questionCount: questions.length,
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });

  batch.update(doc(db, "improvementRequests", request.id), {
    status: "test_created",
    improvementTestId: testRef.id,
    updatedAt: serverTimestamp()
  });

  await batch.commit();

  return { testId: testRef.id, requestId: request.id, questionCount: questions.length };
}

export async function publishImprovementTest(testId) {
  assertAdmin();

  const testSnap = await getDoc(doc(db, "improvementTests", testId));
  if (!testSnap.exists()) throw new Error("Improvement test পাওয়া যায়নি।");

  const snapshotSnap = await getDoc(doc(db, "improvementTestSnapshots", testId));
  if (!snapshotSnap.exists()) throw new Error("Test snapshot তৈরি হয়নি।");

  const data = snapshotSnap.data();
  if (!Array.isArray(data.questions) || !data.questions.length) {
    throw new Error("Snapshot-এ কোনো প্রশ্ন নেই।");
  }

  await updateDoc(doc(db, "improvementTests", testId), {
    status: "published",
    published: true,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return true;
}

export async function assignImprovementTest(testId, studentId) {
  assertAdmin();

  const [testSnap, requestSnap] = await Promise.all([
    getDoc(doc(db, "improvementTests", testId)),
    getDoc(doc(db, "improvementRequests", (
      (await getDoc(doc(db, "improvementTests", testId))).data()?.requestId || ""
    )))
  ]);

  if (!testSnap.exists()) throw new Error("Improvement test পাওয়া যায়নি।");

  const test = testSnap.data();
  if (test.published !== true || test.status !== "published") {
    throw new Error("আগে test Publish করতে হবে।");
  }

  if (!studentId) throw new Error("Student ID পাওয়া যায়নি।");

  const currentIds = Array.isArray(test.studentIds) ? test.studentIds : [];
  const nextIds = currentIds.includes(studentId) ? currentIds : [...currentIds, studentId];

  await updateDoc(doc(db, "improvementTests", testId), {
    studentIds: nextIds,
    updatedAt: serverTimestamp()
  });

  if (requestSnap.exists()) {
    await updateDoc(requestSnap.ref, {
      status: "assigned",
      assignedTestId: testId,
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  return true;
}

export async function reviewImprovementRequest(requestId) {
  assertAdmin();
  await updateDoc(doc(db, "improvementRequests", requestId), {
    status: "reviewed",
    reviewedBy: auth.currentUser.uid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function dismissImprovementRequest(requestId, reason = "") {
  assertAdmin();
  await updateDoc(doc(db, "improvementRequests", requestId), {
    status: "dismissed",
    dismissedReason: reason,
    dismissedBy: auth.currentUser.uid,
    dismissedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function mountImprovementControlCenter(root) {
  assertAdmin();

  const host = typeof root === "string" ? document.querySelector(root) : root;
  if (!host) throw new Error("Improvement Control Center container পাওয়া যায়নি।");

  host.innerHTML = `
    <section style="padding:20px">
      <div style="margin-bottom:18px">
        <h2 style="margin:0">উন্নতি নিয়ন্ত্রণ কেন্দ্র</h2>
        <p style="margin:6px 0 0;opacity:.7">দুর্বলতা থেকে অনুশীলন পরীক্ষা তৈরি, প্রকাশ ও শিক্ষার্থীকে বরাদ্দ করুন।</p>
      </div>
      <div id="improvementAdminList">লোড হচ্ছে...</div>
    </section>
  `;

  const list = host.querySelector("#improvementAdminList");
  const snap = await getDocs(query(
    collection(db, "improvementRequests"),
    orderBy("createdAt", "desc"),
    limit(100)
  ));

  const requests = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  if (!requests.length) {
    list.innerHTML = `<div style="padding:18px;border:1px dashed #aaa;border-radius:14px">এখন কোনো Improvement Request নেই।</div>`;
    return;
  }

  list.innerHTML = requests.map(r => `
    <article data-request="${esc(r.id)}" style="border:1px solid rgba(128,128,128,.2);border-radius:16px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <strong>${esc(r.entityName || r.entityId)}</strong>
          <div style="font-size:.85rem;opacity:.7;margin-top:4px">
            Student: ${esc(r.studentId)} · বর্তমান: ${Number(r.currentAccuracy || 0).toFixed(1)}% · লক্ষ্য: ${Number(r.targetAccuracy || 0).toFixed(1)}%
          </div>
        </div>
        <span>${esc(r.status || "detected")}</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button data-action="review">পর্যালোচনা</button>
        <button data-action="create">Test তৈরি</button>
        ${r.improvementTestId ? `<button data-action="publish" data-test="${esc(r.improvementTestId)}">Publish</button>` : ""}
        ${r.improvementTestId ? `<button data-action="assign" data-test="${esc(r.improvementTestId)}">Assign</button>` : ""}
        <button data-action="dismiss">বাতিল</button>
      </div>
    </article>
  `).join("");

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const card = button.closest("[data-request]");
    const requestId = card?.dataset.request;
    if (!requestId) return;

    button.disabled = true;
    try {
      const action = button.dataset.action;

      if (action === "review") {
        await reviewImprovementRequest(requestId);
        alert("Request পর্যালোচনা হিসেবে সংরক্ষণ হয়েছে।");
      }

      if (action === "create") {
        const result = await createImprovementTestFromRequest(requestId, { questionCount: 10 });
        alert(`${result.questionCount}টি প্রশ্ন দিয়ে Draft Test তৈরি হয়েছে।`);
      }

      if (action === "publish") {
        await publishImprovementTest(button.dataset.test);
        alert("Test প্রকাশ করা হয়েছে।");
      }

      if (action === "assign") {
        const request = await getRequest(requestId);
        await assignImprovementTest(button.dataset.test, request.studentId);
        alert("Test শিক্ষার্থীকে বরাদ্দ করা হয়েছে।");
      }

      if (action === "dismiss") {
        await dismissImprovementRequest(requestId, "Admin review");
        alert("Request বাতিল করা হয়েছে।");
      }

      await mountImprovementControlCenter(host);
    } catch (error) {
      console.error(error);
      alert(error.message || "কাজটি সম্পন্ন করা যায়নি।");
      button.disabled = false;
    }
  });
}

export default mountImprovementControlCenter;
