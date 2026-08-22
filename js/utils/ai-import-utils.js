/* =========================================================
   AI QUESTION IMPORT PARSER (Flexible Version)
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

// সিলেবাসের সাথে কড়াকড়ি চেক বাদ দিয়ে ফ্লেক্সিবল করা হলো
function validateParsed(fields) {
  const errors = [];

  if (!fields.question_en) errors.push("ইংরেজি প্রশ্ন অনুপস্থিত");
  if (!fields.question_bn) errors.push("বাংলা প্রশ্ন অনুপস্থিত");
  ["A", "B", "C", "D"].forEach(k => { if (!fields[k]) errors.push(`অপশন ${k} অনুপস্থিত`); });

  const correct = (fields.correctAnswer || "").trim().toUpperCase();
  if (!["A", "B", "C", "D"].includes(correct)) errors.push("সঠিক উত্তর A/B/C/D এর একটি হতে হবে");

  const marksNum = Number(fields.marks);
  if (!fields.marks || isNaN(marksNum) || marksNum <= 0) errors.push("নম্বর সঠিক নয়");

  return {
    valid: errors.length === 0,
    errors,
    question: {
      question_en: fields.question_en || "",
      question_bn: fields.question_bn || "",
      options_bn: { A: fields.A || "", B: fields.B || "", C: fields.C || "", D: fields.D || "" },
      correctAnswer: correct,
      marks: isNaN(marksNum) ? 1 : marksNum,
      subjectRaw: fields.subject || "সাধারণ",
      chapterRaw: fields.chapter || "সাধারণ",
      topicRaw: fields.topic || "সাধারণ",
      // সিলেবাস আইডি না থাকলেও ডিফল্টভাবে পাস করে দেবে যাতে ইম্পোর্ট আটকে না যায়
      subjectId: fields.subjectId || null, 
      chapterId: fields.chapterId || null, 
      topicId: fields.topicId || null
    }
  };
}

export function parseAiImportText(rawText) {
  const blocks = splitIntoBlocks(rawText);
  return blocks.map((block, index) => {
    const fields = parseBlock(block);
    const result = validateParsed(fields);
    return { index, rawBlock: block, ...result };
  });
}

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
         
