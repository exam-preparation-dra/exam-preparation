/* =========================================================
   MOTIVATION ENGINE — a floating "how am I doing?" button that, when
   tapped, gives a short personalized Bengali suggestion based on the
   student's own stats. Deliberately NOT a chat/AI-question box (the
   student never types anything) — it's a passive system that reasons
   over already-known numbers (overall %, rank, weakest subject, exam
   pace) and picks from varied phrasing so repeat visits don't feel
   robotic. No Gemini/API key involved: students use their own phones,
   which never have an admin's API key configured, so this has to work
   standalone for absolutely everyone.
   ========================================================= */

function pick(arr, seed) {
  return arr[seed % arr.length];
}

// context: {
//   overallPercentage, rank, totalStudents, classRank, classTotalStudents,
//   examsTaken, weakestSubjectName, weakestSubjectAccuracy,
//   strongestSubjectName, strongestSubjectAccuracy
// }
export function generateMotivation(context) {
  const seed = Math.floor(Math.random() * 1000);
  const lines = [];

  // ---- Opening: rank-aware framing ----
  if (context.rank && context.totalStudents) {
    if (context.rank === 1) {
      lines.push(pick([
        "তুমি এখন সবার মধ্যে ১ম স্থানে আছো — দারুণ পারফরম্যান্স!",
        "অভিনন্দন! সবার সেরা ফলাফল এখন তোমারই।"
      ], seed));
    } else if (context.rank <= Math.ceil(context.totalStudents * 0.3)) {
      lines.push(pick([
        `তুমি ${context.totalStudents} জনের মধ্যে ${context.rank}তম — খুব ভালো অবস্থানে আছো।`,
        `তোমার অবস্থান বেশ শক্ত (${context.rank}/${context.totalStudents}) — এই ধারাবাহিকতা ধরে রাখো।`
      ], seed));
    } else {
      lines.push(pick([
        `এখন তুমি ${context.totalStudents} জনের মধ্যে ${context.rank}তম আছো — আরেকটু চেষ্টা করলেই ওপরে ওঠা সম্ভব।`,
        `তোমার অবস্থান (${context.rank}/${context.totalStudents}) থেকে ওপরে ওঠার জায়গা এখনো আছে — হাল ছাড়বে না।`
      ], seed));
    }
  } else {
    lines.push(pick([
      "এখনো পর্যাপ্ত পরীক্ষার ফলাফল নেই তোমার — আরও কয়েকটা পরীক্ষা দিলে বিশ্লেষণ আরও নির্ভুল হবে।",
      "তুমি সবে শুরু করেছো — নিয়মিত পরীক্ষা দিলে এখানে বিস্তারিত পরামর্শ দেখতে পাবে।"
    ], seed));
  }

  // ---- Weakest subject callout ----
  if (context.weakestSubjectName) {
    lines.push(pick([
      `"${context.weakestSubjectName}" বিষয়ে তোমার সঠিকতা এখনো তুলনামূলক কম (${context.weakestSubjectAccuracy}%) — এই বিষয়ে আরেকটু বেশি সময় দিলে সামগ্রিক ফলাফল দ্রুত ভালো হবে।`,
      `"${context.weakestSubjectName}"-এ (${context.weakestSubjectAccuracy}% সঠিকতা) মনোযোগ বাড়ালে সবচেয়ে বেশি লাভ হবে — এখান থেকেই শুরু করো।`
    ], seed + 1));
  }

  // ---- Strongest subject encouragement ----
  if (context.strongestSubjectName) {
    lines.push(pick([
      `"${context.strongestSubjectName}"-এ তুমি বেশ ভালো করছো (${context.strongestSubjectAccuracy}%) — এটা তোমার শক্তির জায়গা, ধরে রাখো।`
    ], seed + 2));
  }

  // ---- Pace/consistency nudge ----
  if (typeof context.examsTaken === "number") {
    if (context.examsTaken < 3) {
      lines.push("এখনো খুব বেশি পরীক্ষা দাওনি — নিয়মিত পরীক্ষায় বসলে নিজের উন্নতি স্পষ্ট বোঝা যাবে।");
    } else if (context.examsTaken >= 10) {
      lines.push("তুমি নিয়মিত পরীক্ষা দিচ্ছো — এই ধারাবাহিকতাই দীর্ঘমেয়াদে সবচেয়ে বেশি কাজে আসে।");
    }
  }

  return lines.join(" ");
}
