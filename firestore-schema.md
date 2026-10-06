# Firestore Database Architecture

স্কেলেবল কাঠামো — 2 জন থেকে 100+ student পর্যন্ত পুনরায় ডিজাইন ছাড়াই কাজ করবে।

## Collections

### `students/{studentDocId}`
```
{
  studentId: "STU-0001",       // permanent, auto-generated, admin cannot edit
  name: "শিক্ষার্থীর নাম",
  isActive: true,
  createdAt: Timestamp,
  sequenceNumber: 1             // used internally to generate next STU-000X
}
```

### `counters/studentCounter`
```
{ lastSequence: 2 }             // atomically incremented via Firestore transaction on add
```

### `subjects/{subjectId}`
```
{ name_en: "Physics", name_bn: "পদার্থবিজ্ঞান", isActive: true, order: 1 }
```

### `chapters/{chapterId}`
```
{ subjectId: "...", name_en: "Motion", name_bn: "গতি", isActive: true, order: 1 }
```

### `topics/{topicId}`
```
{ chapterId: "...", subjectId: "...", name_en: "Velocity", name_bn: "বেগ", isActive: true }
```

### `questions/{questionId}`
```
{
  question_en: "...",
  question_bn: "...",
  options_bn: { A: "...", B: "...", C: "...", D: "..." },
  correctAnswer: "B",
  marks: 1,
  subjectId, chapterId, topicId,
  imageUrl: null | "https://firebasestorage...",
  explanation_bn: null | "...",   // optional, future AI-ready (#50)
  createdAt, updatedAt
}
```
Note: `correctAnswer` is never sent to the client during an active attempt — see security notes below.

### `exams/{examId}`
```
{
  name: "...",
  description: "...",
  examDate: Timestamp,           // informational only, does not start the timer
  informationalTime: "10:00 AM",
  durationMinutes: 30,
  totalMarks: 20,                // = questionCount * marksPerQuestion (auto-calculated)
  subjectIds: [...],
  chapterIds: [...],
  questionIds: [ordered array],  // exact order shown to students — no randomization
  status: "draft" | "upcoming" | "published" | "active" | "completed" | "archived",
  negativeMarking: false,
  createdAt, updatedAt
}
```

### `examSnapshots/{examId}`
Immutable copy of full question content taken at publish time (requirement #27 — question snapshot).
```
{
  examId: "...",
  questions: [
    { questionId, question_en, question_bn, options_bn, correctAnswer, marks, subjectId, chapterId, topicId, imageUrl }
  ],
  lockedAt: Timestamp
}
```
Editing/deleting a question in `questions/` later never touches this snapshot.

### `attempts/{attemptId}`  (doc id = `${examId}_${studentId}`)
Live/in-progress exam state — used for resume support (#18) and offline sync (#51).
```
{
  examId, studentId,
  durationMinutes: 30,
  startedAtMillis: 1730000000000,   // student device clock (epoch ms) — see
                                      // grading-utils.js / firestore.rules for
                                      // why this is a documented Spark-plan
                                      // limitation, not a trusted server clock
  endAtMillis: 1730001800000,         // startedAtMillis + durationMinutes*60000
  currentIndex: 0,                    // last-viewed question, for resume
  answers: { questionId: "A" | "B" | "C" | "D" | null },
  status: "in-progress" | "submitted",
  submittedAtMillis: 1730001700000 | null,
  lastSyncedAt: Timestamp
}
```

### `results/{resultId}`  (doc id = `${examId}_${studentId}`)
Created directly by the student's browser at submission time — status starts
"pending" and becomes permanent history only after admin approval. There is no
Cloud Function on this project (Spark plan only), so this write happens
client-side; Firestore rules allow `create` but restrict `update`/`delete` to
admin, so a result can never be self-approved after the fact.
```
{
  examId, studentId,
  examName: "...",                    // denormalized copy of exams.name (see #58)
  submittedAt: Timestamp,
  totalQuestions, attempted,
  correctCount, wrongCount, unansweredCount,
  obtainedMarks, totalMarks, percentage, accuracy,
  timeTakenSeconds, avgTimePerQuestionSeconds,
  status: "pending" | "approved",
  approvedAt: Timestamp | null,
  subjectBreakdown: [{ subjectId, correct, wrong, unanswered, marks, totalMarks, totalQuestions }],
  chapterBreakdown: [{ chapterId, correct, wrong, unanswered, marks, totalMarks, totalQuestions }],
  topicBreakdown:   [{ topicId, correct, wrong, unanswered, marks, totalMarks, totalQuestions }],
  answers: { questionId: "A" }        // raw answers, used to build the question-wise
                                        // review by re-joining with examSnapshots —
                                        // full question text is deliberately NOT
                                        // duplicated here (Part 28: avoid duplicating
                                        // large question data)
}
```

### `analytics/{studentId}`
There is no Cloud Function on this project (Spark plan only, by explicit
requirement), so this collection is NOT a stored, trigger-updated aggregate.
Instead, every analytics view (`student/dashboard.html`, `student/analytics.html`,
`student/comparison.html`, `admin/comparison.html`) computes these numbers on
read, directly from approved `results/` documents, via `js/utils/analytics-utils.js`.
This keeps the numbers always current with zero write-side maintenance and
avoids a class of bugs where a stored aggregate drifts from the underlying
results. The shape below is what those functions compute in memory:
```
{
  overall: { examsTaken, avgPercentage, avgAccuracy, trend: [...] },
  bySubject: { subjectId: { attempts, avgAccuracy, avgPercentage } },
  byChapter: { chapterId: { attempts, avgAccuracy, testFrequency } },
  byTopic:   { topicId: { attempts, avgAccuracy, recentAccuracy, performanceLabel } }
}
```

### Friend chat — `chatRooms`, `chatRooms/{roomId}/messages`, `chatMeta`
WhatsApp-style chat between friends (`student/chat.html`). Nobody types a
message: every message is a ready-made preset (emoji + text) from
`js/utils/chat-utils.js`. These rules use the student's real Firebase Auth
identity (`stu-0001@students...` => `STU-0001`).
```
chatRooms/{roomId}            // dm: roomId = "dm_" + the two studentIds sorted, joined by "_"
{
  type: "dm" | "group",
  members: [studentId],       // accepted members (dm: both)
  invited: [studentId],       // group invites waiting for approval (never for dm)
  name: string,               // group name ("" => auto name), max 24 chars
  createdBy: studentId,
  createdAt, lastAt: timestamp,
  lastMsg: { id, from, key, text } | null,   // chat-list preview
  unread: { [studentId]: number }            // unread counter per member (drives the red badges)
}
chatRooms/{roomId}/messages/{msgId}          // only the latest 30 are kept / shown
{
  from: studentId, key: "m01"…, text: "👋 Hello",   // text = fallback copy of the preset (<= 100 chars)
  createdAt: timestamp,
  deletedFor: [studentId],    // "delete for me"
  deletedForAll: boolean      // "delete for everyone" (sender only; text/key are cleared)
}
chatMeta/{studentId}          // { lastSentAt } -> ONE message per 2 minutes, enforced in firestore.rules
```
* Group = max 5 people incl. the creator. The creator is the only member at the
  start; each invited friend must **approve** (moves from `invited` to `members`).
* A member can leave a group; the last member leaving deletes the room.
* Unread counts feed: the "চ্যাট" tab on the leaderboard, the nav badge on the
  Leaderboard tab, and the notification bell.
* Needs no composite index (single `array-contains` queries, single-field `orderBy`).

## Relationships
```
subjects 1—* chapters 1—* topics 1—* questions
exams *—* questions (via questionIds, frozen into examSnapshots at publish)
students 1—* attempts 1—1 results
results  *—1 analytics (aggregated per student)
```

## Why this scales to 100+ students
Nothing in this schema is hard-coded to 2 students. `students/` is an open collection;
comparison and analytics queries filter `where isActive == true` rather than assuming
a fixed count. The only "2-student" UI assumption lives in the comparison screen's
layout, which is explicitly called out as swappable in the app code.

## applicationStatus/{id}  (new)
Public waiting-screen status for a join application. `id` equals the `studentRequests` doc id.
`{ status: "pending" | "approved" | "rejected", name, className, studentId?, needsCode?, createdAt, decidedAt? }`
Never contains the PIN. Created by the applicant (pending only), updated/deleted by admin.

## studentRequests/{id}  (changed)
Now also carries `pin` (6 digits, chosen by the applicant). Admin-only readable; deleted on approve/reject.
