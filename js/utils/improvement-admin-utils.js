/* Improvement Admin Engine
   Admin-side logic for the Improvement Control Center.
   Uses only existing performance data and keeps publishing under Admin control.
   No emoji. */

import { db, auth } from "../firebase/firebase-config.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  addDoc, updateDoc, serverTimestamp
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

export async function buildImprovementTestDraft({requestIds=[],studentIds=[],subjectId=null,chapterId=null,topicId=null,questionCount=10,previousWrongQuestionIds=[],adminSelectedQuestionIds=[]}={}) {
  requireAdmin();
  const requests=[];
  for (const rid of uniq(requestIds)) { const s=await getDoc(doc(db,"improvementRequests",rid)); if(s.exists()) requests.push({id:s.id,...s.data()}); }
  const students=uniq([...studentIds,...requests.map(r=>r.studentId)]);
  const wrong=uniq([...previousWrongQuestionIds,...requests.flatMap(r=>Array.isArray(r.wrongQuestionIds)?r.wrongQuestionIds:[])]);
  const subject=subjectId || requests.find(r=>r.subjectId)?.subjectId || null;
  const chapter=chapterId || requests.find(r=>r.chapterId)?.chapterId || null;
  const topic=topicId || requests.find(r=>r.topicId)?.topicId || null;
  const selected=uniq(adminSelectedQuestionIds);
  const load=async ids=>Promise.all(ids.map(async qid=>{const s=await getDoc(doc(db,"questions",qid));return s.exists()?{id:s.id,...s.data()}:null;}));
  const adminQ=(await load(selected)).filter(Boolean);
  const wrongQ=(await load(wrong.slice(0,Math.max(1,n(questionCount,10))))).filter(Boolean);
  const excluded=uniq([...adminQ.map(q=>q.id),...wrongQ.map(q=>q.id)]);
  const related=await getQuestionPoolForImprovement({subjectId:subject,chapterId:chapter,topicId:topic,excludeQuestionIds:excluded,maxResults:Math.max(n(questionCount,10)*4,40)});
  const map=new Map(); [...adminQ,...wrongQ,...related].forEach(q=>{if(q&&!map.has(q.id)&&map.size<Math.max(1,Math.min(50,n(questionCount,10)))) map.set(q.id,q);});
  const questions=[...map.values()];
  return {type:"improvement_practice",studentIds:students,requestIds:uniq(requestIds),subjectId:subject,chapterId:chapter,topicId:topic,questionIds:questions.map(q=>q.id),questions,questionCount:questions.length,sourceBreakdown:{adminSelected:adminQ.length,previousMistakes:wrongQ.length,relatedQuestionBank:Math.max(0,questions.length-adminQ.length-wrongQ.length)}};
}

export async function createImprovementTest({draft,title="উন্নতির অনুশীলন",description="",publish=false,expiresAt=null,xpEnabled=true}={}) {
  const admin=requireAdmin();
  if (!draft?.questionIds?.length) throw new Error("Improvement test-এর জন্য অন্তত একটি প্রশ্ন প্রয়োজন।");
  const data={type:"improvement_practice",title:String(title).trim(),description:String(description||"").trim(),studentIds:uniq(draft.studentIds),requestIds:uniq(draft.requestIds),subjectId:draft.subjectId||null,chapterId:draft.chapterId||null,topicId:draft.topicId||null,questionIds:uniq(draft.questionIds),questionCount:uniq(draft.questionIds).length,sourceBreakdown:draft.sourceBreakdown||{},xpEnabled:Boolean(xpEnabled),status:publish?"published":"draft",createdBy:admin.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),expiresAt:expiresAt||null};
  const ref=await addDoc(collection(db,"improvementTests"),data);
  if(publish) for(const rid of data.requestIds) await updateDoc(doc(db,"improvementRequests",rid),{status:IMPROVEMENT_STATUS.ASSIGNED,improvementTestId:ref.id,assignedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  return {id:ref.id,...data};
}

export async function setImprovementTestPublished(testId,published=true) {
  const admin=requireAdmin(); const ref=doc(db,"improvementTests",id(testId)); const s=await getDoc(ref);
  if(!s.exists()) throw new Error("Improvement test পাওয়া যায়নি।");
  await updateDoc(ref,{status:published?"published":"draft",published:Boolean(published),publishedBy:published?admin.uid:null,publishedAt:published?serverTimestamp():null,updatedAt:serverTimestamp()});
  return {id:ref.id,...s.data(),status:published?"published":"draft",published:Boolean(published)};
}

export async function assignImprovementTest(testId,studentIds=[]) {
  requireAdmin(); const ref=doc(db,"improvementTests",id(testId)); const s=await getDoc(ref);
  if(!s.exists()) throw new Error("Improvement test পাওয়া যায়নি।");
  const merged=uniq([...(s.data().studentIds||[]),...studentIds]);
  await updateDoc(ref,{studentIds:merged,assignedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  return {id:ref.id,...s.data(),studentIds:merged};
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
