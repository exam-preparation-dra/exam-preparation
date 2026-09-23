/* Improvement Admin Engine
   Admin-side logic for the Improvement Control Center.
   Uses only existing performance data and keeps publishing under Admin control.
   No emoji. */

import { db, auth } from "../firebase/firebase-config.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  addDoc, setDoc, updateDoc, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  IMPROVEMENT_CONFIG, IMPROVEMENT_STATUS, IMPROVEMENT_PRIORITY,
  detectWeakAreas, getImprovementRequestsForStudent
} from "./improvement-utils.js";

const n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const id = v => String(v || "").trim();
const uniq = a => [...new Set((a || []).filter(Boolean))];
const ts = v => {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.toDate === "function") return v.toDate().getTime();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const x = new Date(v).getTime();
  return Number.isFinite(x) ? x : 0;
};
const rank = p => ({critical: 4, high: 3, medium: 2, low: 1}[p] || 0);
const requireAdmin = () => {
  if (!auth.currentUser) throw new Error("অ্যাডমিন হিসেবে লগইন করা প্রয়োজন।");
  return auth.currentUser;
};

// ---- Fixed format for every Improvement Exam: never editable, never
// varies request-to-request. Title is always auto-generated from the
// weak area's own name -- admin never types one in. ----
const IMPROVEMENT_EXAM_QUESTION_COUNT = 20;
const IMPROVEMENT_EXAM_DURATION_MINUTES = 20;
const IMPROVEMENT_EXAM_MARKS_PER_QUESTION = 1; // uniform -- never mixed marks

function autoImprovementTitle(request) {
  const area = request?.topicName || request?.chapterName || request?.subjectName || request?.entityName || "সাধারণ";
  return `Improvement Exam — ${area}`;
}

export async function getImprovementRequestQueue({status=null, priority=null, studentId=null, chapterId=null, maxResults=100}={}) {
  requireAdmin();
  const c = [];
  if (status) c.push(where("status", "==", status));
  if (priority) c.push(where("priority", "==", priority));
  if (studentId) c.push(where("studentId", "==", studentId));
  if (chapterId) c.push(where("chapterId", "==", chapterId));
  let snap;
  try {
    snap = await getDocs(query(collection(db,"improvementRequests"), ...c,
      orderBy("priorityRank","desc"), orderBy("createdAt","desc"), limit(maxResults)));
  } catch {
    snap = await getDocs(query(collection(db,"improvementRequests"), ...c, limit(maxResults)));
  }
  return snap.docs.map(d => ({id:d.id,...d.data()})).sort((a,b) =>
    rank(b.priority)-rank(a.priority) || ts(b.createdAt)-ts(a.createdAt));
}

export async function getImprovementQueueSummary() {
  const rows = await getImprovementRequestQueue({maxResults:250});
  const out = {total:rows.length, critical:0, high:0, medium:0, low:0};
  for (const r of rows) out[r.priority] = (out[r.priority] || 0) + 1;
  return out;
}

export async function reviewImprovementRequest(requestId, {status=IMPROVEMENT_STATUS.REVIEWED, adminNote="", targetAccuracy=null}={}) {
  const admin = requireAdmin();
  const ref = doc(db,"improvementRequests",id(requestId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Improvement request পাওয়া যায়নি।");
  const patch = {status, adminNote:String(adminNote||"").trim(), reviewedBy:admin.uid, reviewedAt:serverTimestamp(), updatedAt:serverTimestamp()};
  if (targetAccuracy !== null) patch.targetAccuracy = Math.max(1, Math.min(100, n(targetAccuracy)));
  await updateDoc(ref, patch);
  return {id:ref.id,...snap.data(),...patch};
}

export async function dismissImprovementRequest(requestId, reason="") {
  return reviewImprovementRequest(requestId, {status:IMPROVEMENT_STATUS.DISMISSED, adminNote:reason || "অ্যাডমিন request-টি বাতিল করেছেন।"});
}

export function groupRequestsByLearningArea(rows=[]) {
  const map = new Map();
  for (const r of rows) {
    const key = [r.subjectId||"",r.chapterId||"",r.topicId||"chapter"].join("::");
    if (!map.has(key)) map.set(key,{key,subjectId:r.subjectId||null,subjectName:r.subjectName||"",chapterId:r.chapterId||null,chapterName:r.chapterName||"",topicId:r.topicId||null,topicName:r.topicName||"",studentIds:[],requestIds:[],wrongQuestionIds:[],accuracies:[],priorities:[]});
    const g = map.get(key);
    if (r.studentId) g.studentIds.push(r.studentId);
    if (r.id) g.requestIds.push(r.id);
    if (Number.isFinite(Number(r.currentAccuracy))) g.accuracies.push(Number(r.currentAccuracy));
    g.wrongQuestionIds.push(...(Array.isArray(r.wrongQuestionIds)?r.wrongQuestionIds:[]));
    if (r.priority) g.priorities.push(r.priority);
  }
  return [...map.values()].map(g => ({...g,studentIds:uniq(g.studentIds),requestIds:uniq(g.requestIds),wrongQuestionIds:uniq(g.wrongQuestionIds),studentCount:uniq(g.studentIds).length,averageAccuracy:g.accuracies.length?g.accuracies.reduce((a,b)=>a+b,0)/g.accuracies.length:null,priority:g.priorities.sort((a,b)=>rank(b)-rank(a))[0]||null})).sort((a,b)=>rank(b.priority)-rank(a.priority)||(a.averageAccuracy??101)-(b.averageAccuracy??101));
}

export async function getQuestionPoolForImprovement({subjectId=null,chapterId=null,topicId=null,excludeQuestionIds=[],maxResults=100}={}) {
  requireAdmin();
  const c=[];
  if (topicId) c.push(where("topicId","==",topicId));
  else if (chapterId) c.push(where("chapterId","==",chapterId));
  else if (subjectId) c.push(where("subjectId","==",subjectId));
  let snap;
  try { snap=await getDocs(query(collection(db,"questions"),...c,limit(maxResults))); }
  catch { snap=await getDocs(query(collection(db,"questions"),limit(maxResults))); }
  const excluded=new Set(excludeQuestionIds.map(id));
  return snap.docs.map(d=>({id:d.id,...d.data()})).filter(q=>!excluded.has(q.id));
}

export async function buildImprovementTestDraft({request=null, questionPool=null, requestIds=[], studentIds=[], subjectId=null, chapterId=null, topicId=null, questionCount=10, previousWrongQuestionIds=[], adminSelectedQuestionIds=[], emphasizeFreshQuestions=false}={}) {
  requireAdmin();
  const reqs=[];
  for (const rid of uniq([...(requestIds||[]), ...(request?.id ? [request.id] : [])])) {
    const s=await getDoc(doc(db,"improvementRequests",rid));
    if(s.exists()) reqs.push({id:s.id,...s.data()});
  }
  if (request && !reqs.some(r => r.id === request.id)) reqs.push(request);

  const students=uniq([...(studentIds||[]), ...(request?.studentId ? [request.studentId] : []), ...reqs.map(r=>r.studentId)]);
  const subject=subjectId || request?.subjectId || reqs.find(r=>r.subjectId)?.subjectId || null;
  const chapter=chapterId || request?.chapterId || reqs.find(r=>r.chapterId)?.chapterId || null;
  const topic=topicId || request?.topicId || reqs.find(r=>r.topicId)?.topicId || null;
  const count=Math.max(1,Math.min(50,n(questionCount,10)));

  const selected=uniq([...(adminSelectedQuestionIds||[]) ]);
  const load=async ids=>Promise.all(ids.map(async qid=>{const s=await getDoc(doc(db,"questions",qid));return s.exists()?{id:s.id,...s.data(),source:"admin_selected"}:null;}));
  const adminQ=(await load(selected)).filter(Boolean);

  const wrong=uniq([
    ...(previousWrongQuestionIds||[]),
    ...reqs.flatMap(r=>Array.isArray(r.wrongQuestionIds)?r.wrongQuestionIds:[])
  ]);
  const wrongQ=(await load(wrong.slice(0,count))).filter(Boolean).map(q=>({...q,source:"previous_mistake"}));

  let related=[];
  if (Array.isArray(questionPool) && questionPool.length) {
    related=questionPool.map(q=>({...q,source:q.source||"related_question"}));
  } else {
    const excluded=uniq([...adminQ.map(q=>q.id),...wrongQ.map(q=>q.id)]);
    related=await getQuestionPoolForImprovement({subjectId:subject,chapterId:chapter,topicId:topic,excludeQuestionIds:excluded,maxResults:Math.max(count*4,40)});
    related=related.map(q=>({...q,source:"related_question"}));
  }

  const map=new Map();
  // ADAPTIVE DIFFICULTY: normally previous mistakes fill the test first (best
  // for a first attempt -- practice exactly what went wrong). Once a student
  // has already cleared this same weak area once before (reopenImprovementRequest
  // sets reopenedAt), repeating the identical wrong questions risks testing
  // memorisation rather than real understanding -- so on that repeat round,
  // fresh related-question-bank items fill first instead, and old mistakes
  // only fill remaining seats.
  const ordered = emphasizeFreshQuestions ? [...related,...wrongQ,...adminQ] : [...wrongQ,...adminQ,...related];
  ordered.forEach(q=>{if(q&&!map.has(q.id)&&map.size<count) map.set(q.id,q);});
  const questions=[...map.values()];
  return {
    type:"improvement_practice",
    studentIds:students,
    requestIds:uniq(reqs.map(r=>r.id)),
    subjectId:subject, chapterId:chapter, topicId:topic,
    questionIds:questions.map(q=>q.id),
    questions,
    questionCount:questions.length,
    adaptiveMode: emphasizeFreshQuestions ? "fresh_questions" : "focused_mistakes",
    sourceBreakdown:{
      adminSelected:questions.filter(q=>q.source==="admin_selected").length,
      previousMistakes:questions.filter(q=>q.source==="previous_mistake").length,
      relatedQuestionBank:questions.filter(q=>q.source==="related_question").length
    }
  };
}
export async function createImprovementTest({draft,request=null,title=null,description="",publish=false,expiresAt=null,xpEnabled=true,durationMinutes=IMPROVEMENT_EXAM_DURATION_MINUTES}={}) {
  const admin=requireAdmin();
  if (!draft?.questionIds?.length) {
    throw new Error("Improvement test-এর জন্য প্রশ্ন পাওয়া যায়নি।");
  }

  const questionIds = uniq(draft.questionIds);
  const requestIds = uniq([...(draft.requestIds || []), ...(request?.id ? [request.id] : [])]);
  const studentIds = uniq([...(draft.studentIds || []), ...(request?.studentId ? [request.studentId] : [])]);

  const normalizeOptions = (value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) return {
      A: String(value.A ?? ""), B: String(value.B ?? ""),
      C: String(value.C ?? ""), D: String(value.D ?? "")
    };
    if (Array.isArray(value)) return value;
    return [];
  };

  const snapshotQuestions = (Array.isArray(draft.questions) ? draft.questions : []).map(q => ({
    questionId: q.id || q.questionId,
    question_bn: q.question_bn || "",
    question_en: q.question_en || "",
    question: q.question || "",
    options_bn: normalizeOptions(q.options_bn),
    options_en: normalizeOptions(q.options_en),
    options: normalizeOptions(q.options),
    correctAnswer: q.correctAnswer ?? null,
    explanation_bn: q.explanation_bn || null,
    imageUrl: q.imageUrl || null,
    marks: IMPROVEMENT_EXAM_MARKS_PER_QUESTION,
    subjectId: q.subjectId || null,
    chapterId: q.chapterId || null,
    topicId: q.topicId || null,
    source: q.source || "admin_selected"
  })).filter(q =>
    q.questionId &&
    q.correctAnswer !== null &&
    q.correctAnswer !== undefined &&
    String(q.correctAnswer).trim() !== ""
  );

  if (snapshotQuestions.length < IMPROVEMENT_EXAM_QUESTION_COUNT) {
    throw new Error(
      `Improvement Exam-এর জন্য ${IMPROVEMENT_EXAM_QUESTION_COUNT}টি বৈধ প্রশ্ন দরকার, কিন্তু ${snapshotQuestions.length}টি পাওয়া গেছে।`
    );
  }

  const finalQuestions = snapshotQuestions.slice(0, IMPROVEMENT_EXAM_QUESTION_COUNT);
  const finalQuestionIds = finalQuestions.map(q => q.questionId);

  const firstRequestId = requestIds.length === 1 ? requestIds[0] : null;
  const firstRequest = firstRequestId ? await getDoc(doc(db, "improvementRequests", firstRequestId)) : null;
  const requestData = firstRequest?.exists?.() ? firstRequest.data() : {};

  const data = {
    type:"improvement_practice",
    title:String(title || autoImprovementTitle(request || requestData)).trim(),
    description:String(description || "").trim(),
    studentIds,
    requestIds,
    requestId:firstRequestId,
    subjectId:draft.subjectId || requestData.subjectId || null,
    chapterId:draft.chapterId || requestData.chapterId || null,
    topicId:draft.topicId || requestData.topicId || null,
    baselineAccuracy:Number(requestData.currentAccuracy || 0),
    targetAccuracy:Number(requestData.targetAccuracy || 65),
    questionIds:finalQuestionIds,
    questionCount:finalQuestions.length,
    durationMinutes:Number(durationMinutes) > 0 ? Number(durationMinutes) : IMPROVEMENT_EXAM_DURATION_MINUTES,
    sourceBreakdown:draft.sourceBreakdown || {},
    xpEnabled:Boolean(xpEnabled),
    status:publish ? "published" : "draft",
    published:Boolean(publish),
    createdBy:admin.uid,
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp(),
    expiresAt:expiresAt || null
  };

  // Use one batch for the test + snapshot + request state update. This
  // prevents a half-created Improvement Exam when one of the writes fails.
  const testRef = doc(collection(db, "improvementTests"));
  const snapshotRef = doc(db, "improvementTestSnapshots", testRef.id);
  const batch = writeBatch(db);

  batch.set(testRef, data);
  batch.set(snapshotRef, {
    testId:testRef.id,
    type:"improvement_practice",
    title:data.title,
    description:data.description,
    subjectId:data.subjectId,
    chapterId:data.chapterId,
    topicId:data.topicId,
    requestIds,
    questions:finalQuestions,
    questionCount:finalQuestions.length,
    createdBy:admin.uid,
    createdAt:serverTimestamp()
  });

  if (publish) {
    for (const rid of requestIds) {
      batch.update(doc(db, "improvementRequests", rid), {
        status:IMPROVEMENT_STATUS.TEST_CREATED,
        improvementTestId:testRef.id,
        updatedAt:serverTimestamp()
      });
    }
  }

  await batch.commit();

  return {id:testRef.id,...data,questionCount:finalQuestions.length};
}

export async function setImprovementTestPublished(testId,published=true) {
  const admin=requireAdmin(); const ref=doc(db,"improvementTests",id(testId)); const s=await getDoc(ref);
  if(!s.exists()) throw new Error("Improvement test পাওয়া যায়নি।");
  const snapshot=await getDoc(doc(db,"improvementTestSnapshots",id(testId)));
  if(published && (!snapshot.exists() || !Array.isArray(snapshot.data().questions) || !snapshot.data().questions.length)) {
    throw new Error("Publish করার আগে Improvement Test snapshot তৈরি থাকতে হবে।");
  }
  await updateDoc(ref,{status:published?"published":"draft",published:Boolean(published),publishedBy:published?admin.uid:null,publishedAt:published?serverTimestamp():null,updatedAt:serverTimestamp()});
  return {id:ref.id,...s.data(),status:published?"published":"draft",published:Boolean(published)};
}

export async function assignImprovementTest(testId,studentIds=[]) {
  requireAdmin(); const ref=doc(db,"improvementTests",id(testId)); const s=await getDoc(ref);
  if(!s.exists()) throw new Error("Improvement test পাওয়া যায়নি।");
  const data=s.data();
  if(data.status !== "published" || data.published !== true) throw new Error("আগে Improvement Test publish করতে হবে।");
  const merged=uniq([...(data.studentIds||[]),...studentIds]);
  await updateDoc(ref,{studentIds:merged,assignedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  for (const rid of (Array.isArray(data.requestIds) ? data.requestIds : [])) {
    await updateDoc(doc(db,"improvementRequests",rid),{status:IMPROVEMENT_STATUS.ASSIGNED,improvementTestId:ref.id,assignedTestId:ref.id,assignedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  }
  return {id:ref.id,...data,studentIds:merged};
}

export function buildImprovementAlerts(rows=[]) {
  return rows.filter(r=>![IMPROVEMENT_STATUS.RESOLVED,IMPROVEMENT_STATUS.DISMISSED].includes(r.status)).sort((a,b)=>rank(b.priority)-rank(a.priority)||n(a.currentAccuracy,101)-n(b.currentAccuracy,101)).map(r=>({id:r.id,priority:r.priority||"low",status:r.status||"detected",studentId:r.studentId||null,studentName:r.studentName||"",subjectName:r.subjectName||"",chapterName:r.chapterName||"",topicName:r.topicName||"",currentAccuracy:n(r.currentAccuracy),targetAccuracy:n(r.targetAccuracy,IMPROVEMENT_CONFIG.defaultTarget),wrongQuestionCount:Array.isArray(r.wrongQuestionIds)?r.wrongQuestionIds.length:n(r.wrongQuestionCount),message:r.alertMessage||"এই শিক্ষার্থীর নির্দিষ্ট অংশে উন্নতির প্রয়োজন।"}));
}

export async function createImprovementRequestsForStudent(studentId,options={}) {
  requireAdmin(); const sid=id(studentId); if(!sid) throw new Error("Student ID প্রয়োজন।");
  const weaknesses=await detectWeakAreas(sid,options); if(!Array.isArray(weaknesses)) return [];
  const existing=await getImprovementRequestsForStudent(sid); const cooldown=IMPROVEMENT_CONFIG.requestCooldownDays*86400000; const created=[];
  for(const w of weaknesses){
    const duplicate=existing.find(r=>r.subjectId===w.subjectId&&r.chapterId===w.chapterId&&(r.topicId||null)===(w.topicId||null)&&((Date.now()-ts(r.createdAt)<cooldown)||![IMPROVEMENT_STATUS.RESOLVED,IMPROVEMENT_STATUS.DISMISSED].includes(r.status)));
    if(duplicate) continue;
    const data={...w,studentId:sid,status:IMPROVEMENT_STATUS.DETECTED,source:"improvement_engine",priorityRank:rank(w.priority),adminNote:"",reviewedBy:null,reviewedAt:null,improvementTestId:null,assignedAt:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
    const ref=await addDoc(collection(db,"improvementRequests"),data); created.push({id:ref.id,...data});
  }
  return created;
}

// ---- One-click automation: builds the question set for this ONE student's
// weak chapter/topic (previous wrong answers first, then the related
// question bank -- never admin-typed questions), auto-titles it, forces the
// fixed 20 question / 20 minute / 1-mark-each format, publishes it, and
// assigns it straight to that student. Admin's only action is calling this
// (a single "publish" click) -- there is no title/marks/time/question input
// anywhere in this path. XP wiring is unchanged (computeImprovementPracticeXP
// still fires when the student finishes it, same as any improvement test).
export async function autoBuildAndPublishImprovementTest(request) {
  requireAdmin();
  const sid = id(request?.studentId);
  if (!sid) throw new Error("Student ID প্রয়োজন।");

  const draft = await buildImprovementTestDraft({
    request,
    studentIds: [sid],
    requestIds: request?.id ? [request.id] : [],
    subjectId: request?.subjectId || null,
    chapterId: request?.chapterId || null,
    topicId: request?.topicId || null,
    questionCount: IMPROVEMENT_EXAM_QUESTION_COUNT,
    // A request carries reopenedAt only when it was already resolved once
    // before and the student is back for another round on the same weak
    // area -- give them fresh questions instead of the same repeated ones.
    emphasizeFreshQuestions: Boolean(request?.reopenedAt)
  });

  if (!draft.questionIds.length) {
    throw new Error("এই দুর্বল অংশের জন্য প্রশ্ন ব্যাংকে যথেষ্ট প্রশ্ন নেই -- Improvement Exam তৈরি করা যায়নি।");
  }

  const created = await createImprovementTest({
    draft,
    request,
    title: autoImprovementTitle(request),
    publish: true,
    durationMinutes: IMPROVEMENT_EXAM_DURATION_MINUTES
  });

  await assignImprovementTest(created.id, [sid]);

  // Read back the final Firestore state. The admin UI can now show a real
  // success state only after the test is actually published and assigned.
  const finalSnap = await getDoc(doc(db, "improvementTests", created.id));
  if (!finalSnap.exists()) {
    throw new Error("Exam তৈরি হওয়ার পরে Firestore-এ Test পাওয়া যায়নি।");
  }

  const finalData = finalSnap.data();
  if (finalData.published !== true || finalData.status !== "published") {
    throw new Error("Exam তৈরি হয়েছে, কিন্তু Publish state নিশ্চিত করা যায়নি।");
  }
  if (!Array.isArray(finalData.studentIds) || !finalData.studentIds.includes(sid)) {
    throw new Error("Exam Publish হয়েছে, কিন্তু শিক্ষার্থীকে Assign নিশ্চিত করা যায়নি।");
  }

  return {id:finalSnap.id,...finalData,questionCount:finalData.questionCount || created.questionCount};
}

// ---- 24-hour fallback: run this whenever an admin page loads (see
// admin-improvement-integration.js). There is no server/cron on this
// project (Firebase Spark plan, no Cloud Functions), so this cannot fire on
// a real background timer -- it only runs opportunistically, the next time
// someone with admin access opens an admin page after the 24 hours have
// passed. Any request still sitting at "detected"/"reviewed" a day after it
// was created gets auto-built and auto-published from the question bank
// exactly like the manual button does, with the same fixed 20/20/1 format.
export async function autoPublishOverdueImprovementRequests() {
  requireAdmin();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const rows = await getImprovementRequestQueue({ maxResults: 250 });
  const overdue = rows.filter(r =>
    [IMPROVEMENT_STATUS.DETECTED, IMPROVEMENT_STATUS.REVIEWED].includes(r.status) &&
    ts(r.createdAt) > 0 && ts(r.createdAt) <= cutoff
  );

  const results = [];
  for (const request of overdue) {
    try {
      const created = await autoBuildAndPublishImprovementTest(request);
      results.push({ requestId: request.id, studentId: request.studentId, ok: true, testId: created.id });
    } catch (error) {
      results.push({ requestId: request.id, studentId: request.studentId, ok: false, error: error?.message || String(error) });
    }
  }
  return results;
}
