/* =========================================================
   AI QUESTION IMPORT PARSER
   Expected block format (repeatable, blank-line separated):

   Question:
   English question

   বাংলা প্রশ্ন:
   Bengali question

   A:
   Option
   B:
   Option
   C:
   Option
   D:
   Option

   Correct Answer:
   B

   Subject:
   Physics

   Chapter:
   Motion

   Topic:
   Velocity

   Marks:
   1
   ========================================================= */

const FIELD_LABELS = {
  question_en: /^Question:\s*(.*)$/i,
  question_bn: /^বাংলা প্রশ্ন:\s*(.*)$/,
  A: /^A[:.]\s*(.*)$/,
  B: /^B[:.]\s*(.*)$/,
  C: /^C[:.]\s*(.*)$/,
  D: /^D[:.]\s*(.*)$/,
  correctAnswer: /^Correct Answer:\s*(.*)$/i,
  subject: /^Subject:\s*(.*)$/i,
  chapter: /^Chapter:\s*(.*)$/i,
  topic: /^Topic:\s*(.*)$/i,
  marks: /^Marks:\s*(.*)$/i,
};

// Splits raw pasted text into candidate blocks. A new block starts at each
// "Question:" line so admin can paste many questions back-to-back.
function splitIntoBlocks(rawText) {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let current = [];
  lines.forEach(line => {
    if (/^Question:/i.test(line.trim()) && current.length > 0) {
      blocks.push(current);
      current = [];
    }
    current.push(line);
  });
  if (current.length > 0) blocks.push(current);
  return blocks.map(b => b.join("\n").trim()).filter(Boolean);
}

// Parses one block of lines into a field map by walking label -> value pairs.
// Tolerant of two common AI output styles for the same template: the label
// alone on its own line with the value on the next line ("A:\nOption"), or
// the value inline on the same line ("A: Option") — both are valid renderings
// of the exact format the admin is asked to request, so both must parse.
function parseBlock(blockText) {
  const lines = blockText.split("\n").map(l => l.trim());
  const fields = {};
  let currentKey = null;
  let buffer = [];

  function flush() {
    if (currentKey) fields[currentKey] = buffer.join("\n").trim();
    buffer = [];
  }

  lines.forEach(line => {
    let matchedKey = null, inlineValue = "";
    for (const [key, re] of Object.entries(FIELD_LABELS)) {
      const m = line.match(re);
      if (m) { matchedKey = key; inlineValue = (m[1] || "").trim(); break; }
    }
    if (matchedKey) {
      flush();
      currentKey = matchedKey;
      if (inlineValue) buffer.push(inlineValue);
    } else if (line !== "") {
      buffer.push(line);
    }
  });
  flush();
  return fields;
}

// Validates one parsed field map against required structure. Returns
// { valid, errors[], question } — malformed data is never silently imported.
//
// NOTE: subject/chapter/topic are NOT matched against pasted text anymore.
// The admin picks one target chapter (via dropdown, same as Quick Add) for
// the whole pasted batch, and every parsed question is assigned to that
// target directly — no name-matching, no "not found in syllabus" errors.
// Any Subject:/Chapter:/Topic: lines in the pasted text are still parsed so
// they don't get swallowed into other fields, and are shown as reference
// text only — they never block the import.
function validateParsed(fields, target) {
  const errors = [];

  if (!fields.question_en) errors.push("ইংরেজি প্রশ্ন অনুপস্থিত");
  if (!fields.question_bn) errors.push("বাংলা প্রশ্ন অনুপস্থিত");
  ["A", "B", "C", "D"].forEach(k => { if (!fields[k]) errors.push(`অপশন ${k} অনুপস্থিত`); });

  const correct = (fields.correctAnswer || "").trim().toUpperCase();
  if (!["A", "B", "C", "D"].includes(correct)) errors.push("সঠিক উত্তর A/B/C/D এর একটি হতে হবে");

  const marksNum = Number(fields.marks);
  const validMarks = fields.marks && !isNaN(marksNum) && marksNum > 0;

  if (!target || !target.subjectId || !target.chapterId || !target.topicId) {
    errors.push("উপরে থেকে বিষয় / অধ্যায় / টপিক নির্বাচন করুন — সব প্রশ্ন এখানেই যোগ হবে");
  }

  return {
    valid: errors.length === 0,
    errors,
    question: {
      question_en: fields.question_en || "",
      question_bn: fields.question_bn || "",
      options_bn: { A: fields.A || "", B: fields.B || "", C: fields.C || "", D: fields.D || "" },
      correctAnswer: correct,
      marks: validMarks ? marksNum : 1,
      subjectRaw: fields.subject || "",
      chapterRaw: fields.chapter || "",
      topicRaw: fields.topic || "",
      subjectId: target?.subjectId || null,
      chapterId: target?.chapterId || null,
      topicId: target?.topicId || null
    }
  };
}

// ---------- Main entry point ----------
// target: { subjectId, chapterId, topicId } — chosen once by the admin via
// dropdown in the import UI (same pattern as Quick Add on exam-create.html).
// Every question parsed out of rawText is assigned to this same target,
// regardless of what the AI wrote in its own Subject/Chapter/Topic lines.
export function parseAiImportText(rawText, target) {
  const blocks = splitIntoBlocks(rawText);
  return blocks.map((block, index) => {
    const fields = parseBlock(block);
    const result = validateParsed(fields, target);
    return { index, rawBlock: block, ...result };
  });
}

// ---------- Ready-to-copy AI prompt template (requirement: "Copy AI Prompt" helper) ----------
// Subject/Chapter/Topic are no longer requested from the AI — the admin
// selects the target chapter once in the import UI, so the AI only needs
// to produce question content. Kept as optional context lines for the AI's
// own understanding of the topic, not for parsing/validation.
export function buildAiPromptTemplate({ subjectName, chapterName, topicName, count }) {
  return `আমাকে ${count || "N"} টি exam-oriented MCQ তৈরি করে দাও, বিষয়: ${subjectName || "[বিষয়]"}, অধ্যায়: ${chapterName || "[অধ্যায়]"}, টপিক: ${topicName || "[টপিক]"}।

প্রতিটি প্রশ্নের জন্য ঠিক এই ফরম্যাট ব্যবহার করো, প্রতিটি প্রশ্নের মাঝে একটি ফাঁকা লাইন রেখে:

Question:
[English question]

বাংলা প্রশ্ন:
[Bengali question]

A:
[Bengali option]
B:
[Bengali option]
C:
[Bengali option]
D:
[Bengali option]

Correct Answer:
[A/B/C/D]

Marks:
1

এই ফরম্যাটের বাইরে কোনো অতিরিক্ত টেক্সট, নম্বরিং বা ব্যাখ্যা দিও না।`;
}
