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
function validateParsed(fields, subjectNameMap, chapterNameByNameAndSubject, topicNameByNameAndChapter) {
  const errors = [];

  if (!fields.question_en) errors.push("ইংরেজি প্রশ্ন অনুপস্থিত");
  if (!fields.question_bn) errors.push("বাংলা প্রশ্ন অনুপস্থিত");
  ["A", "B", "C", "D"].forEach(k => { if (!fields[k]) errors.push(`অপশন ${k} অনুপস্থিত`); });

  const correct = (fields.correctAnswer || "").trim().toUpperCase();
  if (!["A", "B", "C", "D"].includes(correct)) errors.push("সঠিক উত্তর A/B/C/D এর একটি হতে হবে");

  const marksNum = Number(fields.marks);
  if (!fields.marks || isNaN(marksNum) || marksNum <= 0) errors.push("নম্বর সঠিক নয়");

  if (!fields.subject) errors.push("বিষয় অনুপস্থিত");
  if (!fields.chapter) errors.push("অধ্যায় অনুপস্থিত");
  if (!fields.topic) errors.push("টপিক অনুপস্থিত");

  // Cross-check against existing syllabus so we never invent new subject/chapter/topic
  // IDs silently — the admin must pick/create the real one in preview if it's missing.
  let subjectId = null, chapterId = null, topicId = null;
  if (fields.subject) {
    subjectId = subjectNameMap[fields.subject.trim().toLowerCase()] || null;
    if (!subjectId) errors.push(`"${fields.subject}" নামে কোনো বিষয় সিলেবাসে পাওয়া যায়নি`);
  }
  if (fields.chapter && subjectId) {
    chapterId = chapterNameByNameAndSubject[`${subjectId}::${fields.chapter.trim().toLowerCase()}`] || null;
    if (!chapterId) errors.push(`"${fields.chapter}" নামে কোনো অধ্যায় এই বিষয়ে পাওয়া যায়নি`);
  }
  if (fields.topic && chapterId) {
    topicId = topicNameByNameAndChapter[`${chapterId}::${fields.topic.trim().toLowerCase()}`] || null;
    if (!topicId) errors.push(`"${fields.topic}" নামে কোনো টপিক এই অধ্যায়ে পাওয়া যায়নি`);
  }

  return {
    valid: errors.length === 0,
    errors,
    question: {
      question_en: fields.question_en || "",
      question_bn: fields.question_bn || "",
      options_bn: { A: fields.A || "", B: fields.B || "", C: fields.C || "", D: fields.D || "" },
      correctAnswer: correct,
      marks: isNaN(marksNum) ? 1 : marksNum,
      subjectRaw: fields.subject || "",
      chapterRaw: fields.chapter || "",
      topicRaw: fields.topic || "",
      subjectId, chapterId, topicId
    }
  };
}

// ---------- Main entry point ----------
// syllabusTree: the result of getFullSyllabusTree() from syllabus-utils.js
export function parseAiImportText(rawText, syllabusTree) {
  const subjectNameMap = {};       // "physics" -> subjectId
  const chapterNameByNameAndSubject = {}; // "subjectId::motion" -> chapterId
  const topicNameByNameAndChapter = {};   // "chapterId::velocity" -> topicId

  syllabusTree.forEach(subject => {
    subjectNameMap[subject.name_en.trim().toLowerCase()] = subject.id;
    subjectNameMap[subject.name_bn.trim().toLowerCase()] = subject.id;
    subject.chapters.forEach(chapter => {
      const key1 = `${subject.id}::${chapter.name_en.trim().toLowerCase()}`;
      const key2 = `${subject.id}::${chapter.name_bn.trim().toLowerCase()}`;
      chapterNameByNameAndSubject[key1] = chapter.id;
      chapterNameByNameAndSubject[key2] = chapter.id;
      chapter.topics.forEach(topic => {
        const tKey1 = `${chapter.id}::${topic.name_en.trim().toLowerCase()}`;
        const tKey2 = `${chapter.id}::${topic.name_bn.trim().toLowerCase()}`;
        topicNameByNameAndChapter[tKey1] = topic.id;
        topicNameByNameAndChapter[tKey2] = topic.id;
      });
    });
  });

  const blocks = splitIntoBlocks(rawText);
  return blocks.map((block, index) => {
    const fields = parseBlock(block);
    const result = validateParsed(fields, subjectNameMap, chapterNameByNameAndSubject, topicNameByNameAndChapter);
    return { index, rawBlock: block, ...result };
  });
}

// ---------- Ready-to-copy AI prompt template (requirement: "Copy AI Prompt" helper) ----------
export function buildAiPromptTemplate({ subjectName, chapterName, topicName, count }) {
  return `আমাকে ${count || "N"} টি exam-oriented MCQ তৈরি করে দাও।
বিষয়: ${subjectName || "[বিষয়]"}
অধ্যায়: ${chapterName || "[অধ্যায়]"}
টপিক: ${topicName || "[টপিক]"}

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

Subject:
${subjectName || "[বিষয়]"}

Chapter:
${chapterName || "[অধ্যায়]"}

Topic:
${topicName || "[টপিক]"}

Marks:
1

এই ফরম্যাটের বাইরে কোনো অতিরিক্ত টেক্সট, নম্বরিং বা ব্যাখ্যা দিও না।`;
}
