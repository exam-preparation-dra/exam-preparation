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
    teamA: { members: [{ studentId: hostStudentId, name: hostName || "Host" }] },
    teamB: emptyTeam(),
    createdAt: Date.now()
  };
  await setDoc(doc(db, "battleMatches", code), data);
  return code;
}

/** Join an existing lobby as Team A or Team B. */
export async function joinMatch(code, { studentId, name, team }) {
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

    const newMembers = [...current, { studentId, name: name || "Player" }];
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

function buildQuestionObj(q) {
  return {
    questionId: q.id,
    question_bn: q.question_bn || "",
    options_bn: q.options_bn || {},
    correctAnswer: q.correctAnswer,
    marks: Number(q.marks) || 1,
    claim: { A: null, B: null },
    answers: { A: null, B: null },
    startedAt: Date.now(),
    expiresAt: Date.now() + TIME_LIMIT_MS
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
 * Host starts the match: locks the rosters, decides questions-per-level
 * from total player count, pulls a random question pool for the chosen
 * topics from /questions, and splits it into 4 levels.
 */
export async function startMatch(code) {
  const ref = doc(db, "battleMatches", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("MATCH_NOT_FOUND");
  const m = snap.data();
  if (m.status !== "lobby") throw new Error("MATCH_ALREADY_STARTED");

  const teamAMembers = m.teamA?.members || [];
  const teamBMembers = m.teamB?.members || [];
  if (!teamAMembers.length || !teamBMembers.length) {
    throw new Error("BOTH_TEAMS_NEED_AT_LEAST_ONE_MEMBER");
  }
  const totalPlayers = teamAMembers.length + teamBMembers.length;
  const questionsPerLevel = totalPlayers > 4 ? QUESTIONS_PER_LEVEL_LARGE : QUESTIONS_PER_LEVEL_SMALL;
  const totalNeeded = questionsPerLevel * LEVEL_COUNT;

  // Firestore 'in' supports at most 10 values -- chunk the selected topics.
  // Battle now uses the MAIN question bank directly, so there is no separate
  // /battleQuestions copy to maintain. Only active questions are eligible.
  const topics = [...new Set((m.topics || []).filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < topics.length; i += 10) chunks.push(topics.slice(i, i + 10));

  let pool = [];
  const seenIds = new Set();
  for (const chunk of chunks) {
    const q = query(
      collection(db, "questions"),
      where("topicId", "in", chunk),
      where("isActive", "==", true)
    );
    const s = await getDocs(q);
    s.forEach(d => {
      // Defensive de-duplication in case the query strategy changes later.
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id);
        pool.push({ id: d.id, ...d.data() });
      }
    });
  }
  pool = shuffle(pool);
  if (pool.length < totalNeeded) {
    throw new Error(`NOT_ENOUGH_QUESTIONS: pool has ${pool.length}, needs ${totalNeeded}. Add more active questions for these topics or pick more topics.`);
  }

  // Firestore does not allow arrays nested inside arrays. Store the four
  // levels as a map (1..4), with one question array per level.
  const levels = {};
  for (let lvl = 0; lvl < LEVEL_COUNT; lvl++) {
    levels[String(lvl + 1)] = pool.slice(
      lvl * questionsPerLevel,
      (lvl + 1) * questionsPerLevel
    );
  }

  const participantIds = [...teamAMembers, ...teamBMembers].map(x => x.studentId);

  await setDoc(ref, {
    ...m,
    status: "active",
    questionsPerLevel,
    levels,
    currentLevel: 1,
    currentQuestionIndex: 0,
    levelWins: { A: 0, B: 0 },
    matchTotals: { A: 0, B: 0 }, // total questions won across the whole match (tie-break signal)
    eliminated: {},
    wrongCounts: {},
    scoreBoard: {},
    participantIds,
    currentQuestion: buildQuestionObj(levels["1"][0]),
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
    if (m.eliminated?.[studentId]) throw new Error("ELIMINATED_THIS_LEVEL");
    const q = m.currentQuestion;
    if (!q) throw new Error("NO_ACTIVE_QUESTION");
    if (q.expiresAt && Date.now() >= q.expiresAt) throw new Error("TIME_UP");
    if (q.claim?.[team]) throw new Error("ALREADY_CLAIMED"); // first tap wins, rest are too late

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
  const levelWins = { ...(m.levelWins || { A: 0, B: 0 }) };
  const matchTotals = { ...(m.matchTotals || { A: 0, B: 0 }) };
  if (winner) { levelWins[winner] += 1; matchTotals[winner] += 1; }

  const levelQuestions = m.levels?.[String(m.currentLevel)] || [];
  const isLastOfLevel = m.currentQuestionIndex >= levelQuestions.length - 1;

  let status = m.status, currentLevel = m.currentLevel, currentQuestionIndex = m.currentQuestionIndex;
  let currentQuestion = null, result = null;
  let nextEliminated = eliminated, nextWrongCounts = wrongCounts;

  if (isLastOfLevel) {
    if (currentLevel >= LEVEL_COUNT) {
      // LEVEL 4 DECIDES THE WHOLE MATCH.
      let winnerTeam;
      if (levelWins.A === levelWins.B) {
        // Tie-break: whoever has won more questions across the whole
        // match; if still tied, Team A (documented v1 edge-case).
        winnerTeam = matchTotals.A >= matchTotals.B ? "A" : "B";
      } else {
        winnerTeam = levelWins.A > levelWins.B ? "A" : "B";
      }
      status = "finished";
      result = buildResult(m, scoreBoard, winnerTeam);
    } else {
      currentLevel += 1;
      currentQuestionIndex = 0;
      nextEliminated = {};
      nextWrongCounts = {};
      levelWins.A = 0; levelWins.B = 0;
      currentQuestion = buildQuestionObj(m.levels?.[String(currentLevel)][0]);
    }
  } else {
    currentQuestionIndex += 1;
    currentQuestion = buildQuestionObj(levelQuestions[currentQuestionIndex]);
  }

  return {
    scoreBoard,
    eliminated: nextEliminated,
    wrongCounts: nextWrongCounts,
    levelWins, matchTotals,
    status, currentLevel, currentQuestionIndex,
    currentQuestion,
    result
  };
}

/**
 * The claimer for a team submits their chosen option. Resolves the
 * question the moment both teams have answered, or the moment the other
 * team is fully eliminated for this level (can no longer answer at all).
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
    const q = m.currentQuestion;
    if (!q) throw new Error("NO_ACTIVE_QUESTION");
    if (q.expiresAt && Date.now() >= q.expiresAt) throw new Error("TIME_UP");
    if (!q.claim?.[team] || q.claim[team].studentId !== studentId) throw new Error("NOT_YOUR_CLAIM");
    if (q.answers?.[team]) throw new Error("ALREADY_ANSWERED");

    const correct = option === q.correctAnswer;
    const answers = { ...q.answers, [team]: { studentId, option, correct, answeredAt: Date.now() } };

    const scoreBoard = { ...(m.scoreBoard || {}) };
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

    if (!otherAnswered && !otherFullyEliminated) {
      // Still waiting on the other team -- just record this team's answer.
      tx.update(ref, { currentQuestion: { ...q, answers }, scoreBoard, eliminated, wrongCounts });
      return;
    }

    // Both sides are in (or the other side can no longer answer) -- resolve.
    tx.update(ref, resolveQuestion(m, answers, scoreBoard, eliminated, wrongCounts));
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

    tx.update(ref, resolveQuestion(m, answers, scoreBoard, eliminated, wrongCounts));
  });
}

/** Sum of XP this student has been awarded across every finished match. */
export async function getStudentBattleXP(studentId) {
  if (!studentId) return 0;
  const q = query(
    collection(db, "battleMatches"),
    where("participantIds", "array-contains", studentId),
    where("status", "==", "finished")
  );
  const snap = await getDocs(q);
  let total = 0;
  snap.forEach(d => { total += Number(d.data()?.result?.xpLog?.[studentId] || 0); });
  return total;
}

export async function getMatch(code) {
  const snap = await getDoc(doc(db, "battleMatches", code));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
