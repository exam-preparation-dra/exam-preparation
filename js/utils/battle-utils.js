/* =========================================================
   BATTLE MODE ENGINE
   -----------------------------------------------------------------------
   2 teams (1-4 members each) race through 4 levels of questions, picked
   automatically from the main /questions bank by topic. Per question: each team's
   members "buzz" to claim who answers for their side; first correct
   answer (or the only correct one) wins the point for that team. Every
   question carries a 1-minute clock (see TIME_LIMIT_MS) -- both teams see
   it and answer it at the same time; whichever side hasn't locked in a
   final answer when the clock runs out is simply scored as "no answer"
   for that question (see checkTimeout). 2 wrong answers in the same level
   eliminates a member for THAT level only. Whichever team wins Level 4
   (best-of-N within the level) wins the whole match.

   No backend/Cloud Functions exist on this project (Spark plan), and
   students have no Firebase Auth -- so, exactly like every other
   student-facing write in this app, this trusts the client. The only
   server-side arbitration available is a Firestore transaction, which is
   what resolves every buzz/answer/timeout/lobby-edit here atomically
   (first write wins).

   XP is never written to /students directly (students can't write there
   -- admin-only). Instead, like challengeBonusXP and improvementPractice
   elsewhere in this app, a finished match just stores what it awards in
   result.xpLog; getStudentBattleXP() sums that up per student. Wire the
   returned number into computeStudentXP({ battleXP }) wherever XP is
   displayed (dashboard, history, leaderboard).
   ========================================================= */

import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, getDoc, getDocs, setDoc, runTransaction,
  query, where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const TEAM_MAX_MEMBERS = 4;
export const LEVEL_COUNT = 4;
export const QUESTIONS_PER_LEVEL_SMALL = 5;   // <=4 total players
export const QUESTIONS_PER_LEVEL_LARGE = 10;  // >4 total players
export const WIN_XP_PER_MEMBER = 2000;
export const WIN_MVP_BONUS_XP = 10000;
export const LOSE_MVP_XP = 5000;
export const LOSE_XP_CUT_FRACTION = 0.5; // losing team's match-earned XP is cut by this much
export const TIME_LIMIT_MS = 60_000; // 1 minute per question, both teams share the same clock

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion

function randomCode(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function emptyTeam() {
  return { members: [] };
}

/**
 * Create a new lobby. The host is automatically the first member of
 * Team A. Returns the match code the host shares with everyone else.
 */
export async function createMatch({ hostStudentId, hostName, topics }) {
  if (!hostStudentId || !Array.isArray(topics) || !topics.length) {
    throw new Error("hostStudentId and at least one topic are required");
  }
  let code = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = randomCode();
    const existing = await getDoc(doc(db, "battleMatches", candidate));
    if (!existing.exists()) { code = candidate; break; }
  }
  if (!code) throw new Error("Could not allocate a match code, try again");

  const data = {
    code,
    hostStudentId,
    topics,
    status: "lobby", // lobby -> active -> finished
    teamA: { members: [{ studentId: hostStudentId, name: hostName || "Host", swapCount: 0 }] },
    teamB: emptyTeam(),
    createdAt: Date.now(),
    startsAt: null
  };
  await setDoc(doc(db, "battleMatches", code), data);
  return code;
}

/**
 * Arm the 10-minute lobby countdown only after both teams have at least one member.
 * If either team becomes empty again, the countdown is cleared until the lobby is ready.
 */
export async function syncLobbyTimer(code, ready) {
  const ref = doc(db, "battleMatches", code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("MATCH_NOT_FOUND");
    const m = snap.data();
    if (m.status !== "lobby") return m;
    const aReady = (m.teamA?.members || []).length > 0;
    const bReady = (m.teamB?.members || []).length > 0;
    const actuallyReady = aReady && bReady;
    if (!actuallyReady) {
      if (m.startsAt != null) tx.update(ref, { startsAt: null });
      return { ...m, startsAt: null };
    }
    if (m.startsAt == null) {
      const startsAt = Date.now() + 10 * 60_000;
      tx.update(ref, { startsAt });
      return { ...m, startsAt };
    }
    return m;
  });
}

/** Join an existing lobby. New members enter Team B by default. */
export async function joinMatch(code, { studentId, name, team = "B" }) {
  if (team !== "A" && team !== "B") throw new Error("team must be 'A' or 'B'");
  const ref = doc(db, "battleMatches", code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("MATCH_NOT_FOUND");
    const m = snap.data();
    if (m.status !== "lobby") throw new Error("MATCH_ALREADY_STARTED");

    const teamKey = `team${team}`;
    const current = m[teamKey]?.members || [];
    if (current.some(mem => mem.studentId === studentId)) return m; // already in, no-op
    if (current.length >= TEAM_MAX_MEMBERS) throw new Error("TEAM_FULL");

    const otherKey = team === "A" ? "teamB" : "teamA";
    const other = m[otherKey]?.members || [];
    if (other.some(mem => mem.studentId === studentId)) throw new Error("ALREADY_IN_OTHER_TEAM");

    const newMembers = [...current, { studentId, name: name || "Player", swapCount: 0 }];
    tx.update(ref, { [`${teamKey}.members`]: newMembers });
    return { ...m, [teamKey]: { members: newMembers } };
  });
}

/**
 * Host-only: remove a joined member from the lobby before the match
 * starts (e.g. someone joined by mistake or the wrong person tapped in).
 * Only works while status is still "lobby"; the host can't remove
 * themselves this way.
 */
export async function removeMember(code, { hostStudentId, team, studentId }) {
  if (team !== "A" && team !== "B") throw new Error("team must be 'A' or 'B'");
  const ref = doc(db, "battleMatches", code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("MATCH_NOT_FOUND");
    const m = snap.data();
    if (m.status !== "lobby") throw new Error("MATCH_ALREADY_STARTED");
    if (m.hostStudentId !== hostStudentId) throw new Error("NOT_HOST");
    if (studentId === hostStudentId) throw new Error("CANNOT_REMOVE_HOST");

    const teamKey = `team${team}`;
    const current = m[teamKey]?.members || [];
    const next = current.filter(mem => mem.studentId !== studentId);
    if (next.length === current.length) throw new Error("MEMBER_NOT_FOUND");
    tx.update(ref, { [`${teamKey}.members`]: next });
  });
}

/**
 * Move one lobby member between Team A and Team B.
 * A normal member may move themselves at most twice per lobby.
 * The host can move any member without consuming that member's swap count.
 */
export async function swapMember(code, { requesterStudentId, studentId, fromTeam, toTeam }) {
  if (!["A", "B"].includes(fromTeam) || !["A", "B"].includes(toTeam) || fromTeam === toTeam) {
    throw new Error("INVALID_SWAP");
  }
  const ref = doc(db, "battleMatches", code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("MATCH_NOT_FOUND");
    const m = snap.data();
    if (m.status !== "lobby") throw new Error("MATCH_ALREADY_STARTED");

    const fromKey = `team${fromTeam}`;
    const toKey = `team${toTeam}`;
    const fromMembers = [...(m[fromKey]?.members || [])];
    const toMembers = [...(m[toKey]?.members || [])];
    const idx = fromMembers.findIndex(mem => mem.studentId === studentId);
    if (idx < 0) throw new Error("MEMBER_NOT_FOUND");
    if (toMembers.length >= TEAM_MAX_MEMBERS) throw new Error("TEAM_FULL");

    const isHost = requesterStudentId === m.hostStudentId;
    const isSelf = requesterStudentId === studentId;
    if (!isHost && !isSelf) throw new Error("NOT_ALLOWED");

    const member = { ...fromMembers[idx] };
    const swapCount = Number(member.swapCount || 0);
    if (!isHost && swapCount >= 2) throw new Error("SWAP_LIMIT_REACHED");
    if (!isHost) member.swapCount = swapCount + 1;
    else member.swapCount = swapCount;

    fromMembers.splice(idx, 1);
    toMembers.push(member);
    tx.update(ref, {
      [`${fromKey}.members`]: fromMembers,
      [`${toKey}.members`]: toMembers
    });
    return { ...m, [fromKey]: { members: fromMembers }, [toKey]: { members: toMembers } };
  });
}

function buildQuestionObj(q) {
  return {
    questionId: q.id,
    question_bn: typeof q.question_bn === "string" ? q.question_bn : String(q.question_bn ?? ""),
    options_bn: normalizeOptions(q.options_bn),
    correctAnswer: typeof q.correctAnswer === "string" ? q.correctAnswer : String(q.correctAnswer ?? ""),
    marks: Number(q.marks) || 1,
    claim: { A: null, B: null },
    answers: { A: null, B: null },
    startedAt: Date.now(),
    expiresAt: Date.now() + TIME_LIMIT_MS
  };
}

// Keep Battle question data strictly Firestore-safe.
// We intentionally store only scalar/map fields here. This prevents a
// question document containing an unexpected nested array from breaking the
// whole battleMatches/{code} write with "Nested arrays are not supported".
function normalizeOptions(options) {
  const o = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  return {
    A: typeof o.A === "string" ? o.A : String(o.A ?? ""),
    B: typeof o.B === "string" ? o.B : String(o.B ?? ""),
    C: typeof o.C === "string" ? o.C : String(o.C ?? ""),
    D: typeof o.D === "string" ? o.D : String(o.D ?? "")
  };
}

function sanitizeBattleQuestion(q) {
  return {
    id: q.id,
    question_bn: typeof q.question_bn === "string" ? q.question_bn : String(q.question_bn ?? ""),
    options_bn: normalizeOptions(q.options_bn),
    correctAnswer: typeof q.correctAnswer === "string" ? q.correctAnswer : String(q.correctAnswer ?? ""),
    marks: Number(q.marks) || 1
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Host starts the match.
 *
 * Battle reads directly from the main /questions collection. The selected
 * topic IDs are queried in chunks of 10, the combined pool is de-duplicated,
 * shuffled, and exactly 20 or 40 questions are selected depending on the
 * number of players.
 *
 * IMPORTANT FIRESTORE DESIGN:
 * We do NOT store `levels` as an array of arrays, and we do not store the raw
 * question documents inside the match. Instead the match stores:
 *   - questionOrder: a flat array of question IDs
 *   - battleQuestionMap: a map keyed by question ID containing only scalar /
 *     map fields
 *
 * This means there is no nested array anywhere in the newly written match
 * state, so Firestore cannot fail with the nested-array error because of the
 * question pool structure.
 */
export async function startMatch(code, hostStudentId = null) {
  const ref = doc(db, "battleMatches", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("MATCH_NOT_FOUND");
  const m = snap.data();
  if (m.status !== "lobby") throw new Error("MATCH_ALREADY_STARTED");
  if (hostStudentId && m.hostStudentId !== hostStudentId) throw new Error("NOT_HOST");

  const teamAMembers = m.teamA?.members || [];
  const teamBMembers = m.teamB?.members || [];
  if (!teamAMembers.length || !teamBMembers.length) {
    throw new Error("BOTH_TEAMS_NEED_AT_LEAST_ONE_MEMBER");
  }

  const totalPlayers = teamAMembers.length + teamBMembers.length;
  const questionsPerLevel = totalPlayers > 4
    ? QUESTIONS_PER_LEVEL_LARGE
    : QUESTIONS_PER_LEVEL_SMALL;
  const totalNeeded = questionsPerLevel * LEVEL_COUNT;

  const topics = [...new Set((m.topics || []).filter(Boolean))];
  if (!topics.length) throw new Error("NO_TOPICS_SELECTED");

  // Firestore 'in' supports at most 10 values, so query selected topics in chunks.
  const chunks = [];
  for (let i = 0; i < topics.length; i += 10) {
    chunks.push(topics.slice(i, i + 10));
  }

  const poolById = new Map();
  for (const chunk of chunks) {
    const q = query(
      collection(db, "questions"),
      where("topicId", "in", chunk)
    );
    const result = await getDocs(q);
    result.forEach(d => {
      if (!poolById.has(d.id)) {
        poolById.set(d.id, { id: d.id, ...d.data() });
      }
    });
  }

  const pool = shuffle([...poolById.values()]);
  if (pool.length < totalNeeded) {
    throw new Error(
      `NOT_ENOUGH_QUESTIONS: pool has ${pool.length}, needs ${totalNeeded}. ` +
      `Add more questions for these topics or pick more topics.`
    );
  }

  // Select exactly the number needed. Extra questions are deliberately not stored.
  const selected = pool.slice(0, totalNeeded).map(sanitizeBattleQuestion);
  const questionOrder = selected.map(q => q.id);

  // Map values contain NO arrays. options_bn is a plain map of strings.
  const battleQuestionMap = Object.fromEntries(
    selected.map(q => [q.id, q])
  );

  const participantIds = [...teamAMembers, ...teamBMembers].map(x => x.studentId);
  const firstQuestion = selected[0];
  if (!firstQuestion) throw new Error("NO_FIRST_QUESTION");

  await setDoc(ref, {
    ...m,
    status: "active",
    questionsPerLevel,
    questionOrder,
    battleQuestionMap,
    currentLevel: 1,
    currentQuestionIndex: 0,
    levelWins: { A: 0, B: 0 },
    matchTotals: { A: 0, B: 0 },
    levelStats: { A: {}, B: {} },
    eliminated: {},
    wrongCounts: {},
    scoreBoard: {},
    participantIds,
    currentQuestion: buildQuestionObj(firstQuestion),
    startedAt: Date.now()
  }, { merge: true });
}

/** A team member taps their own name first to claim the right to answer. */
export async function buzzIn(code, { studentId, team }) {
  const ref = doc(db, "battleMatches", code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("MATCH_NOT_FOUND");
    const m = snap.data();
    if (m.status !== "active") throw new Error("MATCH_NOT_ACTIVE");
    if (!["A", "B"].includes(team)) throw new Error("INVALID_TEAM");
    const isMember = (m[`team${team}`]?.members || []).some(mem => mem.studentId === studentId);
    if (!isMember) throw new Error("NOT_TEAM_MEMBER");
    if (m.eliminated?.[studentId]) throw new Error("ELIMINATED_THIS_LEVEL");
    const q = m.currentQuestion;
    if (!q) throw new Error("NO_ACTIVE_QUESTION");
    if (q.expiresAt && Date.now() >= q.expiresAt) throw new Error("TIME_UP");
    if (q.claim?.[team]) throw new Error("ALREADY_CLAIMED"); // one claim per team per question
    // If this player has already answered/claimed this question, never allow a second claim.
    if (q.answers?.[team]?.studentId === studentId) throw new Error("ALREADY_ANSWERED");

    const newQuestion = { ...q, claim: { ...q.claim, [team]: { studentId, claimedAt: Date.now() } } };
    tx.update(ref, { currentQuestion: newQuestion });
  });
}

function decideQuestionWinner(answers) {
  const a = answers?.A, b = answers?.B;
  if (a?.correct && b?.correct) return a.answeredAt <= b.answeredAt ? "A" : "B";
  if (a?.correct) return "A";
  if (b?.correct) return "B";
  return null; // nobody answered correctly -- no point awarded
}

function mvpOf(members, scoreBoard) {
  let best = null;
  members.forEach(mem => {
    const c = scoreBoard[mem.studentId]?.correct || 0;
    if (!best || c > best.correct) best = { studentId: mem.studentId, correct: c };
  });
  return best?.studentId || null;
}

function buildResult(m, scoreBoard, winnerTeam) {
  const loserTeam = winnerTeam === "A" ? "B" : "A";
  const winMembers = m[`team${winnerTeam}`]?.members || [];
  const loseMembers = m[`team${loserTeam}`]?.members || [];

  const winMvp = mvpOf(winMembers, scoreBoard);
  const loseMvp = mvpOf(loseMembers, scoreBoard);

  const xpLog = {};
  winMembers.forEach(mem => { xpLog[mem.studentId] = (xpLog[mem.studentId] || 0) + WIN_XP_PER_MEMBER; });
  if (winMvp) xpLog[winMvp] = (xpLog[winMvp] || 0) + WIN_MVP_BONUS_XP;
  if (loseMvp) {
    const cutXp = Math.round(LOSE_MVP_XP * (1 - LOSE_XP_CUT_FRACTION));
    xpLog[loseMvp] = (xpLog[loseMvp] || 0) + cutXp;
  }

  return { winnerTeam, loserTeam, winMvp, loseMvp, xpLog, finishedAt: Date.now() };
}

/**
 * Shared "close out the current question and move the match forward"
 * logic. Called once `answers` is final for both sides (either both
 * actually answered, or the 1-minute clock ran out, or the other side
 * can no longer answer at all because every member is eliminated this
 * level). Returns the full patch object for tx.update.
 */
function resolveQuestion(m, answers, scoreBoard, eliminated, wrongCounts) {
  const winner = decideQuestionWinner(answers);
  const questionHistory = [...(m.questionHistory || []), {
    level: Number(m.currentLevel || 1),
    questionIndex: Number(m.currentQuestionIndex || 0) + 1,
    questionId: m.currentQuestion?.questionId || null,
    answers,
    winnerTeam: winner || null,
    resolvedAt: Date.now()
  }];
  const levelWins = { ...(m.levelWins || { A: 0, B: 0 }) };
  const matchTotals = { ...(m.matchTotals || { A: 0, B: 0 }) };
  const levelStats = {
    A: { ...(m.levelStats?.A || {}) },
    B: { ...(m.levelStats?.B || {}) }
  };

  if (winner) {
    levelWins[winner] += 1;
    matchTotals[winner] += 1;
  }

  const order = Array.isArray(m.questionOrder) ? m.questionOrder : [];
  const questionsPerLevel = Number(m.questionsPerLevel) || QUESTIONS_PER_LEVEL_SMALL;
  const levelStart = (m.currentLevel - 1) * questionsPerLevel;
  const absoluteIndex = levelStart + m.currentQuestionIndex;
  const isLastOfLevel = m.currentQuestionIndex >= questionsPerLevel - 1;

  const fullyEliminated = (team) => {
    const members = m[`team${team}`]?.members || [];
    return members.length > 0 && members.every(mem => eliminated[mem.studentId]);
  };

  // A level ends immediately only when ALL players on BOTH teams are eliminated.
  // If one team is fully eliminated but the other team still has active players,
  // the level continues so the remaining players can finish the level.
  const eliminationEndsLevel = fullyEliminated("A") && fullyEliminated("B");

  let status = m.status;
  let currentLevel = m.currentLevel;
  let currentQuestionIndex = m.currentQuestionIndex;
  let currentQuestion = null;
  let result = null;
  let levelResult = null;
  let nextEliminated = eliminated;
  let nextWrongCounts = wrongCounts;

  const getStoredQuestion = (index) => {
    const id = order[index];
    if (!id) return null;
    const raw = m.battleQuestionMap?.[id];
    if (!raw) return null;
    return buildQuestionObj({ id, ...raw });
  };

  const levelWinner = (() => {
    if (levelWins.A !== levelWins.B) return levelWins.A > levelWins.B ? "A" : "B";
    const aAlive = !fullyEliminated("A");
    const bAlive = !fullyEliminated("B");
    if (aAlive !== bAlive) return aAlive ? "A" : "B";
    return null;
  })();

  const makeLevelResult = () => {
    const top = {};
    for (const team of ["A", "B"]) {
      const rows = Object.entries(levelStats[team] || {});
      rows.sort((x, y) => (Number(y[1]?.correct || 0) - Number(x[1]?.correct || 0)) ||
        (Number(y[1]?.attempts || 0) - Number(x[1]?.attempts || 0)));
      top[team] = rows[0] ? { studentId: rows[0][0], correct: Number(rows[0][1]?.correct || 0), attempts: Number(rows[0][1]?.attempts || 0) } : null;
    }
    return {
      level: m.currentLevel,
      winnerTeam: levelWinner,
      score: { ...levelWins },
      topPlayer: top,
      reason: eliminationEndsLevel ? "ELIMINATION" : "QUESTIONS_COMPLETE",
      createdAt: Date.now()
    };
  };

  if (isLastOfLevel || eliminationEndsLevel) {
    levelResult = makeLevelResult();
    if (currentLevel >= LEVEL_COUNT) {
      let winnerTeam;
      if (levelWins.A === levelWins.B) {
        winnerTeam = matchTotals.A >= matchTotals.B ? "A" : "B";
      } else {
        winnerTeam = levelWins.A > levelWins.B ? "A" : "B";
      }
      status = "finished";
      result = buildResult(m, scoreBoard, winnerTeam);
      result.levelResults = [...(m.levelResults || []), levelResult];
    } else {
      currentLevel += 1;
      currentQuestionIndex = 0;
      nextEliminated = {};
      nextWrongCounts = {};
      levelWins.A = 0;
      levelWins.B = 0;
      currentQuestion = getStoredQuestion((currentLevel - 1) * questionsPerLevel);
    }
  } else {
    currentQuestionIndex += 1;
    currentQuestion = getStoredQuestion(absoluteIndex + 1);
  }

  return {
    scoreBoard,
    eliminated: nextEliminated,
    wrongCounts: nextWrongCounts,
    levelWins,
    matchTotals,
    levelStats: (isLastOfLevel || eliminationEndsLevel) ? { A: {}, B: {} } : levelStats,
    levelResult,
    status,
    currentLevel,
    currentQuestionIndex,
    currentQuestion,
    questionHistory,
    levelResults: levelResult ? [...(m.levelResults || []), levelResult] : (m.levelResults || []),
    result
  };
}
/**
 * The claimer for a team submits their chosen option. Resolves the
 * question the moment both teams have answered, or when BOTH teams are
 * fully eliminated for this level (so nobody remains who can answer).
 * Whichever team's level/match progression this triggers happens in the
 * SAME transaction, so the whole engine only ever needs this one entry
 * point during play (plus buzzIn and the timeout watchdog below).
 */
export async function submitAnswer(code, { studentId, team, option }) {
  const ref = doc(db, "battleMatches", code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("MATCH_NOT_FOUND");
    const m = snap.data();
    if (m.status !== "active") throw new Error("MATCH_NOT_ACTIVE");
    const isMember = (m[`team${team}`]?.members || []).some(mem => mem.studentId === studentId);
    if (!isMember) throw new Error("NOT_TEAM_MEMBER");
    if (m.eliminated?.[studentId]) throw new Error("ELIMINATED_THIS_LEVEL");
    const q = m.currentQuestion;
    if (!q) throw new Error("NO_ACTIVE_QUESTION");
    if (q.expiresAt && Date.now() >= q.expiresAt) throw new Error("TIME_UP");
    if (!q.claim?.[team] || q.claim[team].studentId !== studentId) throw new Error("NOT_YOUR_CLAIM");
    if (q.answers?.[team]) throw new Error("ALREADY_ANSWERED");

    const correct = option === q.correctAnswer;
    const answers = { ...q.answers, [team]: { studentId, option, correct, answeredAt: Date.now() } };

    const scoreBoard = { ...(m.scoreBoard || {}) };
    const levelStats = { A: { ...(m.levelStats?.A || {}) }, B: { ...(m.levelStats?.B || {}) } };
    const levelRow = { ...(levelStats[team][studentId] || { correct: 0, attempts: 0 }) };
    levelRow.attempts += 1;
    if (correct) levelRow.correct += 1;
    levelStats[team][studentId] = levelRow;
    const sRow = { ...(scoreBoard[studentId] || { correct: 0, wrong: 0 }) };
    if (correct) sRow.correct += 1; else sRow.wrong += 1;
    scoreBoard[studentId] = sRow;

    let eliminated = { ...(m.eliminated || {}) };
    let wrongCounts = { ...(m.wrongCounts || {}) };
    if (!correct) {
      wrongCounts[studentId] = (wrongCounts[studentId] || 0) + 1;
      if (wrongCounts[studentId] >= 2) eliminated[studentId] = true;
    }

    const otherTeam = team === "A" ? "B" : "A";
    const otherAnswered = !!answers[otherTeam];
    const otherMembers = m[`team${otherTeam}`]?.members || [];
    const otherFullyEliminated = otherMembers.length > 0 && otherMembers.every(mem => eliminated[mem.studentId]);
    const currentTeamMembers = m[`team${team}`]?.members || [];
    const currentTeamFullyEliminated = currentTeamMembers.length > 0 && currentTeamMembers.every(mem => eliminated[mem.studentId]);
    const bothTeamsFullyEliminated = currentTeamFullyEliminated && otherFullyEliminated;
    if (!otherAnswered && !bothTeamsFullyEliminated) {
      // Still waiting on the other team -- just record this team's answer.
      tx.update(ref, { currentQuestion: { ...q, answers }, scoreBoard, eliminated, wrongCounts, levelStats });
      return;
    }

    // Both sides are in (or the other side can no longer answer) -- resolve.
    tx.update(ref, resolveQuestion({ ...m, levelStats }, answers, scoreBoard, eliminated, wrongCounts));
  });
}

/**
 * Timeout watchdog: every connected player's browser calls this on a
 * tick (see battle-play.html) once a question's 1-minute clock has run
 * out. Whichever call reaches Firestore first resolves it inside a
 * transaction; any side that never locked in an answer is simply scored
 * as "no answer" (no point) for that question -- it does NOT count as a
 * wrong answer, so it never triggers the 2-strikes elimination on its
 * own. Safe to call repeatedly from every client -- a no-op once the
 * question has already been resolved or moved on.
 */
export async function checkTimeout(code) {
  const ref = doc(db, "battleMatches", code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const m = snap.data();
    if (m.status !== "active") return;
    const q = m.currentQuestion;
    if (!q?.expiresAt || Date.now() < q.expiresAt) return; // clock hasn't run out yet
    if (q.answers?.A && q.answers?.B) return; // already fully answered, nothing to do

    const answers = { ...q.answers };
    for (const t of ["A", "B"]) {
      if (!answers[t]) {
        answers[t] = {
          studentId: q.claim?.[t]?.studentId || null,
          option: null, correct: false, answeredAt: Date.now(), timedOut: true
        };
      }
    }

    const scoreBoard = { ...(m.scoreBoard || {}) };
    const eliminated = { ...(m.eliminated || {}) };
    const wrongCounts = { ...(m.wrongCounts || {}) };

    const levelStats = { A: { ...(m.levelStats?.A || {}) }, B: { ...(m.levelStats?.B || {}) } };
    for (const team of ["A", "B"]) {
      const answer = answers[team];
      if (!answer?.studentId) continue;
      const row = { ...(levelStats[team][answer.studentId] || { correct: 0, attempts: 0 }) };
      if (!q.answers?.[team]) { row.attempts += 1; if (answer.correct) row.correct += 1; }
      levelStats[team][answer.studentId] = row;
    }
    tx.update(ref, resolveQuestion({ ...m, levelStats }, answers, scoreBoard, eliminated, wrongCounts));
  });
}

/** Sum of XP this student has been awarded across every finished match. */
export async function getStudentBattleXP(studentId) {
  if (!studentId) return 0;
  // Keep this to a single array-contains query so no composite Firestore index
  // is required. Finished status is filtered in the client.
  const q = query(collection(db, "battleMatches"), where("participantIds", "array-contains", studentId));
  const snap = await getDocs(q);
  let total = 0;
  snap.forEach(d => {
    const data=d.data();
    if (data?.status === "finished") total += Number(data?.result?.xpLog?.[studentId] || 0);
  });
  return total;
}

/** Sum finished Battle XP for every student. No new collection or rule is needed. */
export async function getBattleXPMap() {
  const snap = await getDocs(collection(db, "battleMatches"));
  const map = {};
  snap.forEach(d => {
    const data=d.data();
    if (data?.status !== "finished" || !data?.result?.xpLog) return;
    Object.entries(data.result.xpLog).forEach(([studentId,xp]) => {
      map[studentId]=(map[studentId]||0)+Number(xp||0);
    });
  });
  return map;
}

/** Permanently delete a Battle match. Only its host may delete it.
 * Deleting the match also removes its result.xpLog, so Battle XP disappears
 * automatically from leaderboard/history calculations without touching rules.
 */
export async function deleteMatch(code, requesterStudentId) {
  if (!code || !requesterStudentId) throw new Error("INVALID_DELETE_REQUEST");
  const ref = doc(db, "battleMatches", code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("MATCH_NOT_FOUND");
    const m = snap.data();
    if (m.hostStudentId !== requesterStudentId) throw new Error("NOT_HOST");
    tx.delete(ref);
    return true;
  });
}

export async function getMatch(code) {
  const snap = await getDoc(doc(db, "battleMatches", code));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
