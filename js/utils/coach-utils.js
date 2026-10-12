/* =========================================================
   COACH UTILS — turns real results into a personal "coach" view.
   Pure functions (no Firebase). Every number comes from the student's
   own results and from the other students' approved results already
   visible on the leaderboard. Nothing is made up: if there is not
   enough data a function returns null / [] and the page says so.
   ========================================================= */
import { computeOverallStats, computeSubjectStats, computeTopicStats } from "./analytics-utils.js";
import { sameBatch } from "./batch-utils.js";

export const toMs = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : (typeof t === "number" ? t : 0));
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const DAY = 86400000;

export function groupByStudent(results) {
  const m = {};
  (results || []).forEach(r => { (m[r.studentId] ||= []).push(r); });
  Object.values(m).forEach(l => l.sort((a, b) => toMs(b.submittedAt) - toMs(a.submittedAt)));
  return m;
}

// One student's headline numbers. results are newest-first.
export function summarize(results) {
  const o = computeOverallStats(results || []);
  if (!o) return null;
  const pcts = results.map(r => Number(r.percentage)).filter(Number.isFinite);
  const mean = avg(pcts) ?? 0;
  const sd = pcts.length > 1 ? Math.sqrt(avg(pcts.map(p => (p - mean) ** 2))) : 0;
  const times = results.map(r => Number(r.avgTimePerQuestionSeconds)).filter(v => Number.isFinite(v) && v > 0);
  return { n: o.examsTaken, avgPct: o.avgPercentage, accuracy: o.avgAccuracy, avgTime: times.length ? Math.round(avg(times)) : null, sd: r1(sd), pcts };
}

// Leaderboard rows (already sorted best -> worst) -> who is above me / the topper in my batch.
export function findPeers(rows, me, myBatch) {
  const pool = (rows || []).filter(r => !myBatch || sameBatch(r.className, myBatch));
  const list = pool.length ? pool : (rows || []);
  const idx = list.findIndex(r => r.studentId === me);
  if (idx < 0) return null;
  const topper = list[0];
  return {
    list, idx, rank: idx + 1, total: list.length,
    iAmTopper: idx === 0,
    topper: idx === 0 ? (list[1] || null) : topper,   // when I lead, the "chase" target is the runner-up
    above: idx > 0 ? list[idx - 1] : null,
    below: list[idx + 1] || null,
    mine: list[idx]
  };
}

// Last N exams (oldest -> newest), each with my score vs batch average / topper / my rank in that exam.
export function examSequence(myResults, resultsByStudent, batchIds, topperId, n = 8) {
  const mine = (myResults || []).slice(0, n).reverse();
  return mine.map((r, i) => {
    const same = [];
    batchIds.forEach(sid => {
      const x = (resultsByStudent[sid] || []).find(z => z.examId === r.examId);
      if (x && Number.isFinite(Number(x.percentage))) same.push({ sid, pct: Number(x.percentage) });
    });
    const myPct = Number(r.percentage);
    const topperPct = topperId ? same.find(s => s.sid === topperId)?.pct ?? null : null;
    const batchAvg = same.length ? avg(same.map(s => s.pct)) : null;
    const rank = same.length ? 1 + same.filter(s => s.pct > myPct).length : null;
    const prev = i > 0 ? Number(mine[i - 1].percentage) : null;
    return {
      examId: r.examId, name: r.examName || "পরীক্ষা", at: toMs(r.submittedAt),
      my: Number.isFinite(myPct) ? myPct : null, topper: topperPct, batchAvg: r1(batchAvg), takers: same.length, rank,
      delta: prev != null && Number.isFinite(prev) && Number.isFinite(myPct) ? r1(myPct - prev) : null
    };
  });
}

// Recent momentum: last 3 vs the 3 before.
export function momentum(pctsNewestFirst) {
  const p = (pctsNewestFirst || []).filter(Number.isFinite);
  if (p.length < 4) return null;
  const k = Math.min(3, Math.floor(p.length / 2));
  const recent = avg(p.slice(0, k)), before = avg(p.slice(k, k * 2));
  return { recent: r1(recent), before: r1(before), diff: r1(recent - before), k };
}

export function currentStreak(pctsNewestFirst, min = 70) {
  let c = 0;
  for (const v of pctsNewestFirst || []) { if (Number(v) >= min) c++; else break; }
  return c;
}

// Subject-wise: me vs the person I chase. Biggest gap first.
export function subjectGaps(mySubjects, theirSubjects) {
  const their = Object.fromEntries((theirSubjects || []).map(s => [s.subjectId, s]));
  return (mySubjects || []).map(s => {
    const t = their[s.subjectId];
    return { id: s.subjectId, name: s.name, mine: s.accuracy, theirs: t ? t.accuracy : null, gap: t && s.accuracy != null && t.accuracy != null ? r1(t.accuracy - s.accuracy) : null };
  }).filter(x => x.mine != null).sort((a, b) => (b.gap ?? -999) - (a.gap ?? -999));
}

export function topicGaps(myTopics, theirTopics, minGap = 15) {
  const their = Object.fromEntries((theirTopics || []).map(s => [s.topicId, s]));
  return (myTopics || []).map(t => {
    const o = their[t.topicId];
    return { id: t.topicId, name: t.name, mine: t.accuracy, theirs: o ? o.accuracy : null, gap: o && t.accuracy != null && o.accuracy != null ? r1(o.accuracy - t.accuracy) : null };
  }).filter(x => x.gap != null && x.gap >= minGap).sort((a, b) => b.gap - a.gap);
}

// When each topic was last tested (newest first results) -> a simple spaced-revision hint.
export function reviewPlan(results, topicStats, limit = 5) {
  const last = {};
  (results || []).forEach(r => (r.topicBreakdown || []).forEach(t => { if (!(t.topicId in last)) last[t.topicId] = toMs(r.submittedAt); }));
  const now = Date.now();
  return (topicStats || [])
    .filter(t => t.accuracy != null && t.accuracy < 65)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit)
    .map(t => {
      const d = last[t.topicId] ? Math.floor((now - last[t.topicId]) / DAY) : null;
      let when = "আজই ঝালাই করো", tone = "now";
      if (d == null) { when = "আজই ঝালাই করো"; }
      else if (d < 1) { when = "আজ পরীক্ষা দিয়েছো, কাল আবার ঝালাই করো"; tone = "soon"; }
      else if (d < 3) { when = `${d} দিন আগে — ১ম ঝালাইয়ের সময়`; tone = "now"; }
      else if (d < 7) { when = `${d} দিন আগে — ২য় ঝালাই বাকি`; tone = "now"; }
      else { when = `${d} দিন পার — আজই ঝালাই করো`; tone = "late"; }
      return { id: t.topicId, name: t.name, accuracy: t.accuracy, attempts: t.attempts, days: d, when, tone };
    });
}

/* Missions: each one is computed from real data and shows real progress.
   { id, kind, title, goal, now, target, pct (0-100|null), how:[steps] } */
export function buildMissions(ctx) {
  const { me, peers, peerSummary, topicStats, wrongPatterns, rushing } = ctx;
  const out = [];
  const weak = (topicStats || []).filter(t => t.attempts >= 2 && t.accuracy != null && t.accuracy < 65).sort((a, b) => a.accuracy - b.accuracy)[0];
  if (weak) {
    const latest = weak.recentAccuracies?.[0] ?? weak.accuracy;
    out.push({ id: "weak", kind: "topic", title: `${weak.name} ঠিক করো`, goal: "পরের পরীক্ষায় এই টপিকে ৬৫% বা তার বেশি", now: `${Math.round(latest)}%`, target: "৬৫%", pct: Math.min(100, Math.round(latest / 65 * 100)),
      how: ["টপিকের নোট একবার পড়ে মূল সূত্র বা পয়েন্ট লিখে ফেলো", "এই টপিকের ভুল হওয়া প্রশ্নগুলো আবার সমাধান করো", "২-৩ দিন পর কিছু না দেখে আবার ঝালাই করো"] });
  }
  if (peers?.above && peerSummary?.above && ctx.mySummary) {
    const gap = r1(peerSummary.above.avgPct - ctx.mySummary.avgPct);
    if (gap > 0) out.push({ id: "beat", kind: "rank", title: `${peers.above.name} কে ছাড়িয়ে যাও`, goal: `গড় স্কোরে ${gap} পয়েন্ট ব্যবধান কমাও`, now: `${ctx.mySummary.avgPct}%`, target: `${peerSummary.above.avgPct}%`, pct: Math.min(100, Math.round(ctx.mySummary.avgPct / peerSummary.above.avgPct * 100)),
      how: ["ওর চেয়ে যে বিষয়ে পিছিয়ে আছো সেটা আগে ধরো", "প্রতি পরীক্ষায় অন্তত ২-৩ নম্বর বাড়ানোর লক্ষ্য রাখো", "ভুল করা প্রশ্নের কারণ লিখে রাখো"] });
  } else if (peers?.iAmTopper && peers.topper && peerSummary?.topper && ctx.mySummary) {
    const lead = r1(ctx.mySummary.avgPct - peerSummary.topper.avgPct);
    out.push({ id: "hold", kind: "rank", title: "শীর্ষ স্থান ধরে রাখো", goal: `${peers.topper.name} এর চেয়ে ${lead} পয়েন্ট এগিয়ে আছো`, now: `${ctx.mySummary.avgPct}%`, target: `${peerSummary.topper.avgPct}%`, pct: 100,
      how: ["দুর্বল টপিকগুলো ছোট করে ঝালাই করো", "সময় ধরে অনুশীলন করো", "কোনো পরীক্ষা বাদ দিও না"] });
  }
  const streak = currentStreak(ctx.pcts, 70);
  out.push({ id: "streak", kind: "streak", title: "পরপর ৩টি পরীক্ষায় ৭০%+", goal: "ধারাবাহিকতা তৈরি করো", now: `${Math.min(streak, 3)}/৩`, target: "৩/৩", pct: Math.min(100, Math.round(Math.min(streak, 3) / 3 * 100)),
    how: ["পরীক্ষার আগের দিন শুধু ভুল করা প্রশ্ন দেখো", "প্রতিটি পরীক্ষা দাও, বাদ দিও না"] });
  if (rushing) {
    out.push({ id: "slow", kind: "habit", title: "তাড়াহুড়ো কমাও", goal: "দ্রুত উত্তরে ভুল বেশি হচ্ছে, উত্তর বেছে নেওয়ার আগে একবার অপশন মিলিয়ে নাও", now: "", target: "", pct: null,
      how: ["প্রতিটি প্রশ্নে অন্তত ১০ সেকেন্ড ভাবো", "সন্দেহ হলে মার্ক করে পরে ফিরে এসো"] });
  } else if (wrongPatterns?.length) {
    out.push({ id: "repeat", kind: "habit", title: "বারবার হওয়া ভুল বন্ধ করো", goal: "যে প্রশ্নে একই ভুল অপশন বেছেছো সেটার সঠিক ব্যাখ্যা বুঝে নাও", now: `${wrongPatterns[0].repeatedCount} বার`, target: "০ বার", pct: null,
      how: ["ওই প্রশ্নের সঠিক উত্তরের কারণ নিজের ভাষায় লেখো", "একই ধরনের আরও ৫টি প্রশ্ন করো"] });
  }
  return out.slice(0, 4);
}

// A few plain, friendly sentences. No emoji, no hype — only what the data says.
export function coachLines(ctx) {
  const L = [];
  const { first, mySummary: s, mom, peers, peerSummary, subjGaps, weakTopic } = ctx;
  if (mom) {
    const up = mom.diff >= 0;
    L.push({ tone: up ? "good" : "warn", text: `শেষ ${mom.k}টা পরীক্ষায় তোমার গড় ${mom.recent}%, তার আগের ${mom.k}টায় ছিল ${mom.before}%। ${up ? `${Math.abs(mom.diff)} পয়েন্ট বেড়েছে, ঠিক পথেই আছো।` : `${Math.abs(mom.diff)} পয়েন্ট কমেছে, কারণটা খুঁজে বের করার সময় এসেছে।`}` });
  } else if (s) {
    L.push({ tone: "neutral", text: `এখন পর্যন্ত ${s.n}টা পরীক্ষায় তোমার গড় স্কোর ${s.avgPct}%। ট্রেন্ড বোঝার জন্য আরও কয়েকটা পরীক্ষা দরকার।` });
  }
  if (peers?.above && peerSummary?.above && s) {
    const g = r1(peerSummary.above.avgPct - s.avgPct);
    L.push({ tone: "neutral", text: `তোমার ঠিক উপরে ${peers.above.name}। ওর গড় ${peerSummary.above.avgPct}%, তোমার ${s.avgPct}%${g > 0 ? ` — ব্যবধান মাত্র ${g} পয়েন্ট।` : "।"}` });
  } else if (peers?.iAmTopper) {
    L.push({ tone: "good", text: "এই মুহূর্তে তুমি ব্যাচের শীর্ষে। এবার লক্ষ্য হলো সেটা ধরে রাখা।" });
  }
  const g = (subjGaps || []).find(x => x.gap != null && x.gap > 0);
  if (g && peers?.topper) L.push({ tone: "warn", text: `${peers.topper.name} এর সাথে সবচেয়ে বড় ফারাক ${g.name} বিষয়ে — তুমি ${g.mine}%, ও ${g.theirs}%। আগে এখানে মন দাও।` });
  if (weakTopic) L.push({ tone: "warn", text: `${weakTopic.name} টপিকে ${weakTopic.attempts} বার পরীক্ষা দিয়েও accuracy ${weakTopic.accuracy}%। এটাই এখন তোমার সবচেয়ে সহজ লাভের জায়গা।` });
  return L.slice(0, 4);
}
