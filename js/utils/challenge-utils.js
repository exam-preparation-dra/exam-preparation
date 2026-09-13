/* =========================================================
   CHALLENGE SYSTEM UTILITIES
   1v1 Friend Battles + Bonus Resolution
   ========================================================= */

import { db } from "../firebase/firebase-config.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";


/* =========================================================
   BONUS RULES
   ========================================================= */

export const CHALLENGE_WINNER_BONUS = 100;
export const CHALLENGE_LOSER_BONUS = 25;
export const CHALLENGE_DRAW_BONUS = 50;


/* =========================================================
   INCOMING CHALLENGES
   ========================================================= */

// যে challenge-গুলো এই student-কে করা হয়েছে
// এবং এখনো pending
export async function getIncomingChallenges(studentId) {

  const q = query(
    collection(db, "examChallenges"),
    where("toStudentId", "==", studentId),
    where("status", "==", "pending")
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}


/* =========================================================
   OUTGOING CHALLENGES
   ========================================================= */

// এই student যে challenge-গুলো পাঠিয়েছে
export async function getOutgoingChallenges(studentId) {

  const q = query(
    collection(db, "examChallenges"),
    where("fromStudentId", "==", studentId)
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}


/* =========================================================
   ALL CHALLENGES INVOLVING A STUDENT
   ========================================================= */

export async function getMyChallenges(studentId) {

  const [sentSnap, receivedSnap] = await Promise.all([

    getDocs(
      query(
        collection(db, "examChallenges"),
        where("fromStudentId", "==", studentId)
      )
    ),

    getDocs(
      query(
        collection(db, "examChallenges"),
        where("toStudentId", "==", studentId)
      )
    )

  ]);

  const map = new Map();

  sentSnap.docs.forEach(d => {
    map.set(d.id, {
      id: d.id,
      ...d.data()
    });
  });

  receivedSnap.docs.forEach(d => {
    map.set(d.id, {
      id: d.id,
      ...d.data()
    });
  });

  return [...map.values()].sort(
    (a, b) =>
      (b.createdAt?.toMillis?.() ?? 0) -
      (a.createdAt?.toMillis?.() ?? 0)
  );
}


/* =========================================================
   SEND CHALLENGE
   ========================================================= */

export async function sendChallenge(
  fromStudentId,
  toStudentId,
  examId,
  examName
) {

  if (!fromStudentId || !toStudentId) {
    throw new Error("Student information পাওয়া যায়নি।");
  }

  if (fromStudentId === toStudentId) {
    throw new Error("নিজেকে challenge করা যায় না।");
  }

  if (!examId) {
    throw new Error("পরীক্ষা নির্বাচন করো।");
  }


  /*
     একই exam-এর জন্য একই দুই student-এর
     pending/accepted challenge আগে থেকেই আছে কিনা দেখি।
  */

  const [sentSnap, receivedSnap] = await Promise.all([

    getDocs(
      query(
        collection(db, "examChallenges"),
        where("fromStudentId", "==", fromStudentId),
        where("toStudentId", "==", toStudentId),
        where("examId", "==", examId)
      )
    ),

    getDocs(
      query(
        collection(db, "examChallenges"),
        where("fromStudentId", "==", toStudentId),
        where("toStudentId", "==", fromStudentId),
        where("examId", "==", examId)
      )
    )

  ]);


  const existing = [
    ...sentSnap.docs,
    ...receivedSnap.docs
  ];


  const activeChallenge = existing.find(d => {

    const status = d.data().status;

    return status === "pending" ||
           status === "accepted";

  });


  if (activeChallenge) {
    throw new Error(
      "এই পরীক্ষার জন্য তোমাদের মধ্যে একটি challenge ইতিমধ্যেই আছে।"
    );
  }


  const challengeRef = await addDoc(
    collection(db, "examChallenges"),
    {
      fromStudentId,
      toStudentId,
      examId,
      examName,

      status: "pending",

      // Resolution fields
      winnerStudentId: null,
      loserStudentId: null,

      fromResultId: null,
      toResultId: null,

      fromPercentage: null,
      toPercentage: null,

      fromMarks: null,
      toMarks: null,

      winnerBonus: 0,
      loserBonus: 0,

      bonusAwarded: false,
      resolvedAt: null,

      createdAt: serverTimestamp()
    }
  );


  return challengeRef.id;
}


/* =========================================================
   ACCEPT CHALLENGE
   ========================================================= */

export async function acceptChallenge(challengeId) {

  if (!challengeId) {
    throw new Error("Challenge ID পাওয়া যায়নি।");
  }

  await updateDoc(
    doc(db, "examChallenges", challengeId),
    {
      status: "accepted",
      acceptedAt: serverTimestamp()
    }
  );

  return true;
}


/* =========================================================
   REJECT / DELETE CHALLENGE
   ========================================================= */

export async function rejectChallenge(challengeId) {

  if (!challengeId) {
    throw new Error("Challenge ID পাওয়া যায়নি।");
  }

  await deleteDoc(
    doc(db, "examChallenges", challengeId)
  );

  return true;
}


/* =========================================================
   GET ONE CHALLENGE
   ========================================================= */

export async function getChallengeById(challengeId) {

  if (!challengeId) return null;

  const snap = await getDoc(
    doc(db, "examChallenges", challengeId)
  );

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data()
  };
}


/* =========================================================
   FIND APPROVED RESULT
   ========================================================= */

async function getApprovedChallengeResult(
  studentId,
  examId
) {

  const q = query(
    collection(db, "results"),
    where("studentId", "==", studentId),
    where("examId", "==", examId),
    where("status", "==", "approved")
  );

  const snap = await getDocs(q);

  if (snap.empty) return null;

  /*
     সাধারণত একজন student-এর একটি exam-এর
     একটি result থাকবে।

     যদি একাধিক থাকে, latest submitted result নেওয়া হবে।
  */

  const results = snap.docs
    .map(d => ({
      id: d.id,
      ...d.data()
    }))
    .sort(
      (a, b) =>
        (b.submittedAt?.toMillis?.() ?? 0) -
        (a.submittedAt?.toMillis?.() ?? 0)
    );

  return results[0] || null;
}


/* =========================================================
   RESOLVE CHALLENGE
   =========================================================

   Rules:

   Winner       = +100
   Loser        = +25
   Draw         = +50 each

   দুজনের approved result না আসা পর্যন্ত
   challenge resolve হবে না।

   Bonus আলাদা করে points হিসেবে increment
   করা হচ্ছে না।

   Challenge document-এ final result save হচ্ছে।
   তাই একই challenge বারবার resolve হলেও
   bonus duplicate হবে না।
   ========================================================= */

export async function resolveChallengeIfReady(
  challengeId
) {

  if (!challengeId) {
    throw new Error("Challenge ID পাওয়া যায়নি।");
  }


  const challengeRef = doc(
    db,
    "examChallenges",
    challengeId
  );


  const challengeSnap = await getDoc(
    challengeRef
  );


  if (!challengeSnap.exists()) {
    return {
      resolved: false,
      reason: "challenge-not-found"
    };
  }


  const challenge = {
    id: challengeSnap.id,
    ...challengeSnap.data()
  };


  /*
     Already resolved হলে আবার bonus গণনা করব না।
  */

  if (
    challenge.bonusAwarded === true ||
    challenge.status === "completed"
  ) {

    return {
      resolved: true,
      alreadyResolved: true,
      challenge
    };

  }


  /*
     শুধু accepted challenge resolve হবে।
  */

  if (challenge.status !== "accepted") {

    return {
      resolved: false,
      reason: "not-accepted"
    };

  }


  const fromStudentId = challenge.fromStudentId;
  const toStudentId = challenge.toStudentId;
  const examId = challenge.examId;


  /*
     দুজনের approved result একসাথে খুঁজি।
  */

  const [
    fromResult,
    toResult
  ] = await Promise.all([

    getApprovedChallengeResult(
      fromStudentId,
      examId
    ),

    getApprovedChallengeResult(
      toStudentId,
      examId
    )

  ]);


  /*
     একজন বা দুজনের result এখনো approved না হলে
     challenge resolve হবে না।
  */

  if (!fromResult || !toResult) {

    return {
      resolved: false,
      reason: "waiting-for-results",

      fromCompleted: !!fromResult,
      toCompleted: !!toResult,

      challenge
    };

  }


  /*
     Marks এবং percentage বের করি।
  */

  const fromMarks =
    Number(fromResult.obtainedMarks) || 0;

  const toMarks =
    Number(toResult.obtainedMarks) || 0;

  const fromPercentage =
    Number(fromResult.percentage) || 0;

  const toPercentage =
    Number(toResult.percentage) || 0;


  /*
     Winner determination:

     প্রথমে obtainedMarks।

     Marks equal হলে percentage দিয়ে
     tie-break করা হবে।
  */

  let winnerStudentId = null;
  let loserStudentId = null;

  let winnerBonus = 0;
  let loserBonus = 0;

  let resultType = "draw";


  if (fromMarks > toMarks) {

    winnerStudentId = fromStudentId;
    loserStudentId = toStudentId;

    winnerBonus = CHALLENGE_WINNER_BONUS;
    loserBonus = CHALLENGE_LOSER_BONUS;

    resultType = "from-won";

  }

  else if (toMarks > fromMarks) {

    winnerStudentId = toStudentId;
    loserStudentId = fromStudentId;

    winnerBonus = CHALLENGE_WINNER_BONUS;
    loserBonus = CHALLENGE_LOSER_BONUS;

    resultType = "to-won";

  }

  else if (fromPercentage > toPercentage) {

    winnerStudentId = fromStudentId;
    loserStudentId = toStudentId;

    winnerBonus = CHALLENGE_WINNER_BONUS;
    loserBonus = CHALLENGE_LOSER_BONUS;

    resultType = "from-won";

  }

  else if (toPercentage > fromPercentage) {

    winnerStudentId = toStudentId;
    loserStudentId = fromStudentId;

    winnerBonus = CHALLENGE_WINNER_BONUS;
    loserBonus = CHALLENGE_LOSER_BONUS;

    resultType = "to-won";

  }

  else {

    /*
       সম্পূর্ণ draw
       দুজনেই +50
    */

    winnerStudentId = null;
    loserStudentId = null;

    winnerBonus = CHALLENGE_DRAW_BONUS;
    loserBonus = CHALLENGE_DRAW_BONUS;

    resultType = "draw";
  }


  /*
     Final challenge result Firestore-এ save।
  */

  await updateDoc(
    challengeRef,
    {

      status: "completed",

      winnerStudentId,
      loserStudentId,

      fromResultId: fromResult.id,
      toResultId: toResult.id,

      fromPercentage,
      toPercentage,

      fromMarks,
      toMarks,

      winnerBonus,
      loserBonus,

      resultType,

      bonusAwarded: true,

      resolvedAt: serverTimestamp()
    }
  );


  return {

    resolved: true,
    alreadyResolved: false,

    challengeId,

    resultType,

    winnerStudentId,
    loserStudentId,

    fromStudentId,
    toStudentId,

    fromResultId: fromResult.id,
    toResultId: toResult.id,

    fromMarks,
    toMarks,

    fromPercentage,
    toPercentage,

    winnerBonus,
    loserBonus
  };
}


/* =========================================================
   GET ALL COMPLETED CHALLENGE BONUSES
   ========================================================= */

export async function getCompletedChallengeBonuses() {

  const q = query(
    collection(db, "examChallenges"),
    where("bonusAwarded", "==", true)
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}


/* =========================================================
   CALCULATE CHALLENGE BONUS FOR EACH STUDENT
   =========================================================

   Returns:

   {
      "STU-0001": 125,
      "STU-0002": 50
   }

   Leaderboard এই data-এর সঙ্গে
   existing base points যোগ করতে পারবে।
   ========================================================= */

export async function getChallengeBonusMap() {

  const challenges =
    await getCompletedChallengeBonuses();

  const bonusMap = {};


  for (const challenge of challenges) {

    if (challenge.bonusAwarded !== true) {
      continue;
    }


    const winner =
      challenge.winnerStudentId;

    const loser =
      challenge.loserStudentId;


    /*
       Normal win
    */

    if (winner && loser) {

      bonusMap[winner] =
        (bonusMap[winner] || 0) +
        Number(challenge.winnerBonus || 0);

      bonusMap[loser] =
        (bonusMap[loser] || 0) +
        Number(challenge.loserBonus || 0);

    }


    /*
       Draw
       winner/loser null থাকবে।
       দুই participant-কে +50 দিতে হবে।
    */

    else {

      const fromId =
        challenge.fromStudentId;

      const toId =
        challenge.toStudentId;


      bonusMap[fromId] =
        (bonusMap[fromId] || 0) +
        Number(challenge.winnerBonus || 0);

      bonusMap[toId] =
        (bonusMap[toId] || 0) +
        Number(challenge.loserBonus || 0);
    }

  }


  return bonusMap;
}


/* =========================================================
   GET BONUS FOR ONE STUDENT
   ========================================================= */

export async function getStudentChallengeBonus(
  studentId
) {

  if (!studentId) return 0;

  const bonusMap =
    await getChallengeBonusMap();

  return Number(
    bonusMap[studentId] || 0
  );
}


/* =========================================================
   GET CHALLENGE STATUS FOR UI
   ========================================================= */

export function getChallengeResultText(
  challenge,
  studentId
) {

  if (!challenge) {
    return "";
  }


  if (
    challenge.bonusAwarded !== true &&
    challenge.status !== "completed"
  ) {

    return "Result-এর অপেক্ষায়";

  }


  if (
    challenge.resultType === "draw"
  ) {

    return "Draw — দুজনেই +50 bonus";

  }


  if (
    challenge.winnerStudentId === studentId
  ) {

    return `তুমি জিতেছ — +${challenge.winnerBonus || 100} bonus`;

  }


  if (
    challenge.loserStudentId === studentId
  ) {

    return `Challenge complete — +${challenge.loserBonus || 25} bonus`;

  }


  return "Challenge completed";
}


/* =========================================================
   GET CHALLENGE COMPARISON
   ========================================================= */

export function getChallengeComparison(
  challenge,
  studentId
) {

  if (!challenge) return null;


  const isFrom =
    challenge.fromStudentId === studentId;

  const myMarks =
    isFrom
      ? Number(challenge.fromMarks || 0)
      : Number(challenge.toMarks || 0);

  const opponentMarks =
    isFrom
      ? Number(challenge.toMarks || 0)
      : Number(challenge.fromMarks || 0);


  const myPercentage =
    isFrom
      ? Number(challenge.fromPercentage || 0)
      : Number(challenge.toPercentage || 0);

  const opponentPercentage =
    isFrom
      ? Number(challenge.toPercentage || 0)
      : Number(challenge.fromPercentage || 0);


  return {

    myMarks,
    opponentMarks,

    myPercentage,
    opponentPercentage,

    marksGap:
      Math.round(
        (myMarks - opponentMarks) * 100
      ) / 100,

    percentageGap:
      Math.round(
        (myPercentage - opponentPercentage) * 10
      ) / 10,

    ahead:
      myMarks > opponentMarks
        ? true
        : myMarks < opponentMarks
          ? false
          : myPercentage > opponentPercentage
            ? true
            : myPercentage < opponentPercentage
              ? false
              : null
  };
}
