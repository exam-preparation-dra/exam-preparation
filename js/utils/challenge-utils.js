// challenge-utils.js
// Complete challenge system for student-to-student exam challenges.
// Uses Firestore and works with the existing student/result structure.

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { db } from "../firebase/firebase-config.js";


// ============================================================
// CONFIG
// ============================================================

export const CHALLENGE_REWARDS = {
  winner: 100,
  loser: 25,
  draw: 50
};


// ============================================================
// INTERNAL HELPERS
// ============================================================

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}


function getResultPercentage(result) {
  const percentage = Number(result?.percentage);

  if (Number.isFinite(percentage)) {
    return percentage;
  }

  const obtained = safeNumber(result?.obtainedMarks);
  const total = safeNumber(result?.totalMarks);

  if (total > 0) {
    return (obtained / total) * 100;
  }

  return 0;
}


function getResultMarks(result) {
  return safeNumber(result?.obtainedMarks);
}


function resultKey(examId, studentId) {
  return `${examId}_${studentId}`;
}


// ============================================================
// SEND CHALLENGE
// ============================================================

export async function sendChallenge({
  fromStudentId,
  toStudentId,
  examId = "__NEXT_EXAM__",
  examName = "পরবর্তী পরীক্ষা (auto-select)"
}) {
  if (!fromStudentId) {
    throw new Error("তোমার student ID পাওয়া যায়নি।");
  }

  if (!toStudentId) {
    throw new Error("যাকে challenge করবে তার student ID পাওয়া যায়নি।");
  }

  if (fromStudentId === toStudentId) {
    throw new Error("নিজেকে challenge করা যাবে না।");
  }

  // Check whether an active/pending challenge already exists.
  const sentQuery = query(
    collection(db, "examChallenges"),
    where("fromStudentId", "==", fromStudentId),
    where("toStudentId", "==", toStudentId)
  );

  const receivedQuery = query(
    collection(db, "examChallenges"),
    where("fromStudentId", "==", toStudentId),
    where("toStudentId", "==", fromStudentId)
  );

  const [sentSnap, receivedSnap] = await Promise.all([
    getDocs(sentQuery),
    getDocs(receivedQuery)
  ]);

  const existingChallenges = [
    ...sentSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    ...receivedSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  ];

  const activeExisting = existingChallenges.find(challenge =>
    ["pending", "accepted"].includes(challenge.status)
  );

  if (activeExisting) {
    throw new Error("এই বন্ধুর সঙ্গে একটি active challenge ইতিমধ্যেই আছে।");
  }

  const challengeData = {
    fromStudentId,
    toStudentId,

    examId,
    examName,

    status: "pending",

    bonusAwarded: false,

    winnerStudentId: null,
    loserStudentId: null,

    winnerBonus: CHALLENGE_REWARDS.winner,
    loserBonus: CHALLENGE_REWARDS.loser,
    drawBonus: CHALLENGE_REWARDS.draw,

    createdAt: serverTimestamp(),

    acceptedAt: null,
    completedAt: null,
    resolvedAt: null
  };

  const challengeRef = await addDoc(
    collection(db, "examChallenges"),
    challengeData
  );

  return {
    id: challengeRef.id,
    ...challengeData
  };
}


// ============================================================
// GET INCOMING CHALLENGES
// ============================================================

export async function getIncomingChallenges(studentId) {
  if (!studentId) return [];

  const q = query(
    collection(db, "examChallenges"),
    where("toStudentId", "==", studentId)
  );

  const snap = await getDocs(q);

  return snap.docs
    .map(d => ({
      id: d.id,
      ...d.data()
    }))
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}


// ============================================================
// GET OUTGOING CHALLENGES
// ============================================================

export async function getOutgoingChallenges(studentId) {
  if (!studentId) return [];

  const q = query(
    collection(db, "examChallenges"),
    where("fromStudentId", "==", studentId)
  );

  const snap = await getDocs(q);

  return snap.docs
    .map(d => ({
      id: d.id,
      ...d.data()
    }))
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}


// ============================================================
// ACCEPT CHALLENGE
// ============================================================

export async function acceptChallenge(challengeId, studentId) {
  if (!challengeId) {
    throw new Error("Challenge ID পাওয়া যায়নি।");
  }

  const challengeRef = doc(db, "examChallenges", challengeId);
  const challengeSnap = await getDoc(challengeRef);

  if (!challengeSnap.exists()) {
    throw new Error("Challenge আর পাওয়া যাচ্ছে না।");
  }

  const challenge = challengeSnap.data();

  if (challenge.toStudentId !== studentId) {
    throw new Error("এই challenge accept করার অনুমতি নেই।");
  }

  if (challenge.status !== "pending") {
    throw new Error("এই challenge আর pending নেই।");
  }

  await updateDoc(challengeRef, {
    status: "accepted",
    acceptedAt: serverTimestamp()
  });

  return {
    id: challengeId,
    ...challenge,
    status: "accepted"
  };
}


// ============================================================
// REJECT CHALLENGE
// ============================================================

export async function rejectChallenge(challengeId, studentId) {
  if (!challengeId) {
    throw new Error("Challenge ID পাওয়া যায়নি।");
  }

  const challengeRef = doc(db, "examChallenges", challengeId);
  const challengeSnap = await getDoc(challengeRef);

  if (!challengeSnap.exists()) {
    throw new Error("Challenge আর পাওয়া যাচ্ছে না।");
  }

  const challenge = challengeSnap.data();

  if (challenge.toStudentId !== studentId) {
    throw new Error("এই challenge reject করার অনুমতি নেই।");
  }

  if (challenge.status !== "pending") {
    throw new Error("এই challenge আর pending নেই।");
  }

  await deleteDoc(challengeRef);

  return true;
}


// ============================================================
// GET SINGLE CHALLENGE
// ============================================================

export async function getChallenge(challengeId) {
  if (!challengeId) return null;

  const challengeRef = doc(db, "examChallenges", challengeId);
  const snap = await getDoc(challengeRef);

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data()
  };
}


// ============================================================
// RESOLVE COMPLETED CHALLENGES
// ============================================================

export async function resolveCompletedChallenges(studentId) {
  if (!studentId) return [];

  const incomingQuery = query(
    collection(db, "examChallenges"),
    where("toStudentId", "==", studentId),
    where("status", "==", "accepted")
  );

  const outgoingQuery = query(
    collection(db, "examChallenges"),
    where("fromStudentId", "==", studentId),
    where("status", "==", "accepted")
  );

  const [incomingSnap, outgoingSnap] = await Promise.all([
    getDocs(incomingQuery),
    getDocs(outgoingQuery)
  ]);

  const challenges = [
    ...incomingSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })),
    ...outgoingSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))
  ];

  const resolved = [];

  for (const challenge of challenges) {
    if (challenge.bonusAwarded) {
      continue;
    }

    /*
     * A special __NEXT_EXAM__ challenge cannot be resolved until
     * a real exam ID has been selected/assigned.
     */
    if (
      !challenge.examId ||
      challenge.examId === "__NEXT_EXAM__"
    ) {
      continue;
    }

    const fromResultRef = doc(
      db,
      "results",
      resultKey(
        challenge.examId,
        challenge.fromStudentId
      )
    );

    const toResultRef = doc(
      db,
      "results",
      resultKey(
        challenge.examId,
        challenge.toStudentId
      )
    );

    const [fromResultSnap, toResultSnap] = await Promise.all([
      getDoc(fromResultRef),
      getDoc(toResultRef)
    ]);

    if (!fromResultSnap.exists() || !toResultSnap.exists()) {
      continue;
    }

    const fromResult = fromResultSnap.data();
    const toResult = toResultSnap.data();

    /*
     * Only approved results are used for challenge resolution.
     */
    if (
      fromResult.status &&
      fromResult.status !== "approved"
    ) {
      continue;
    }

    if (
      toResult.status &&
      toResult.status !== "approved"
    ) {
      continue;
    }

    const fromPercentage = getResultPercentage(fromResult);
    const toPercentage = getResultPercentage(toResult);

    const fromMarks = getResultMarks(fromResult);
    const toMarks = getResultMarks(toResult);

    let winnerStudentId = null;
    let loserStudentId = null;
    let winnerBonus = 0;

    /*
     * Percentage is the primary comparison.
     * Obtained marks are used as the tie-breaker.
     */
    if (fromPercentage > toPercentage) {
      winnerStudentId = challenge.fromStudentId;
      loserStudentId = challenge.toStudentId;
      winnerBonus = CHALLENGE_REWARDS.winner;
    } else if (toPercentage > fromPercentage) {
      winnerStudentId = challenge.toStudentId;
      loserStudentId = challenge.fromStudentId;
      winnerBonus = CHALLENGE_REWARDS.winner;
    } else if (fromMarks > toMarks) {
      winnerStudentId = challenge.fromStudentId;
      loserStudentId = challenge.toStudentId;
      winnerBonus = CHALLENGE_REWARDS.winner;
    } else if (toMarks > fromMarks) {
      winnerStudentId = challenge.toStudentId;
      loserStudentId = challenge.fromStudentId;
      winnerBonus = CHALLENGE_REWARDS.winner;
    }

    const challengeRef = doc(
      db,
      "examChallenges",
      challenge.id
    );

    /*
     * Draw
     */
    if (!winnerStudentId) {
      await updateDoc(challengeRef, {
        status: "completed",
        bonusAwarded: true,

        winnerStudentId: null,
        loserStudentId: null,

        winnerBonus: 0,
        loserBonus: 0,
        drawBonus: CHALLENGE_REWARDS.draw,

        completedAt: serverTimestamp(),
        resolvedAt: serverTimestamp()
      });

      resolved.push({
        id: challenge.id,
        result: "draw",
        drawBonus: CHALLENGE_REWARDS.draw
      });

      continue;
    }

    /*
     * Winner / loser
     */
    await updateDoc(challengeRef, {
      status: "completed",
      bonusAwarded: true,

      winnerStudentId,
      loserStudentId,

      winnerBonus,
      loserBonus: CHALLENGE_REWARDS.loser,

      completedAt: serverTimestamp(),
      resolvedAt: serverTimestamp()
    });

    resolved.push({
      id: challenge.id,
      result: "completed",
      winnerStudentId,
      loserStudentId,
      winnerBonus,
      loserBonus: CHALLENGE_REWARDS.loser
    });
  }

  return resolved;
}


// ============================================================
// UPDATE AUTO-SELECTED NEXT EXAM
// ============================================================

export async function updateNextExamChallenges(
  examId,
  examName
) {
  if (!examId || examId === "__NEXT_EXAM__") {
    return [];
  }

  const q = query(
    collection(db, "examChallenges"),
    where("examId", "==", "__NEXT_EXAM__")
  );

  const snap = await getDocs(q);

  const updated = [];

  for (const challengeDoc of snap.docs) {
    const challenge = challengeDoc.data();

    /*
     * Only pending/accepted challenges should receive
     * the newly created/upcoming exam.
     */
    if (
      challenge.status !== "pending" &&
      challenge.status !== "accepted"
    ) {
      continue;
    }

    const ref = doc(
      db,
      "examChallenges",
      challengeDoc.id
    );

    await updateDoc(ref, {
      examId,
      examName
    });

    updated.push({
      id: challengeDoc.id,
      examId,
      examName
    });
  }

  return updated;
}


// ============================================================
// CHALLENGE DISPLAY INFO
// ============================================================

export function getChallengeResultSummary(
  challenge,
  myResult,
  friendResult
) {
  if (!myResult || !friendResult) {
    return {
      status: "waiting",
      text: "দুজনের result এখনো complete হয়নি।"
    };
  }

  const myPercentage = getResultPercentage(myResult);
  const friendPercentage = getResultPercentage(friendResult);

  const myMarks = getResultMarks(myResult);
  const friendMarks = getResultMarks(friendResult);

  if (friendPercentage > myPercentage) {
    return {
      status: "behind",
      percentageGap: friendPercentage - myPercentage,
      marksGap: friendMarks - myMarks,
      text: `বন্ধু ${Math.abs(friendPercentage - myPercentage).toFixed(1)}% এগিয়ে`
    };
  }

  if (myPercentage > friendPercentage) {
    return {
      status: "ahead",
      percentageGap: myPercentage - friendPercentage,
      marksGap: myMarks - friendMarks,
      text: `তুমি ${Math.abs(myPercentage - friendPercentage).toFixed(1)}% এগিয়ে`
    };
  }

  if (friendMarks > myMarks) {
    return {
      status: "behind",
      percentageGap: 0,
      marksGap: friendMarks - myMarks,
      text: `marks-এ বন্ধু ${Math.abs(friendMarks - myMarks)} এগিয়ে`
    };
  }

  if (myMarks > friendMarks) {
    return {
      status: "ahead",
      percentageGap: 0,
      marksGap: myMarks - friendMarks,
      text: `marks-এ তুমি ${Math.abs(myMarks - friendMarks)} এগিয়ে`
    };
  }

  return {
    status: "equal",
    percentageGap: 0,
    marksGap: 0,
    text: "দুজনের result সমান"
  };
     }
