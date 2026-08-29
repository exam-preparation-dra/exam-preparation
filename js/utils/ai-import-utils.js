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

/* =========================================================
   GEMINI (Google AI Studio) IMAGE-BASED QUESTION GENERATION
   Calls the Gemini API directly from the browser using an
   admin-supplied API key (stored client-side only — never
   committed to the repo). Reuses buildAiPromptTemplate() so
   the output format Gemini is asked to produce is identical
   to the manual copy-paste flow, meaning parseAiImportText()
   can parse it without any changes.
   ========================================================= */

// Google renames/retires Gemini models every few months (2.0 -> 2.5 -> 3 ->
// 3.6 ...). Rather than hardcoding one model id that breaks the whole
// feature on the next rename, we try a short list in order and fall back
// to "gemini-flash-latest" (an alias Google keeps pointed at whichever
// Flash model is current) if all named versions fail with a 404.
const GEMINI_MODEL_CANDIDATES = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"];

function geminiEndpoint(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

// imageParts: [{ mimeType, base64 }, ...] — base64 WITHOUT the
// "data:image/...;base64," prefix (already stripped by the caller).
// extraInstructions: free-text from the admin — e.g. desired difficulty
// level relative to the photo, or a different marks scheme — appended to
// the standard prompt so one call covers count + difficulty + marks + images.
export async function generateQuestionsFromImage({ apiKey, imageParts, subjectName, chapterName, topicName, count, extraInstructions }) {
  if (!apiKey) throw new Error("Gemini API key দেওয়া হয়নি।");
  if (!imageParts || imageParts.length === 0) throw new Error("কমপক্ষে একটি ছবি দিতে হবে।");

  let instructionText = buildAiPromptTemplate({ subjectName, chapterName, topicName, count }) +
    "\n\nউপরে দেওয়া ছবি(গুলো)র বিষয়বস্তু পড়ে তার ওপর ভিত্তি করে প্রশ্নগুলো তৈরি করো।";
  if (extraInstructions && extraInstructions.trim()) {
    instructionText += `\n\nঅতিরিক্ত নির্দেশনা (মানো): ${extraInstructions.trim()}`;
  }

  const body = {
    contents: [{
      parts: [
        { text: instructionText },
        ...imageParts.map(p => ({ inline_data: { mime_type: p.mimeType, data: p.base64 } }))
      ]
    }]
  };

  let lastError = null;
  for (const model of GEMINI_MODEL_CANDIDATES) {
    let res;
    try {
      res = await fetch(`${geminiEndpoint(model)}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (networkErr) {
      lastError = new Error("Gemini এ পৌঁছানো যায়নি — ইন্টারনেট চেক করো।");
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map(p => p.text || "")
        .join("\n")
        .trim();
      if (!text) { lastError = new Error("Gemini থেকে কোনো টেক্সট পাওয়া যায়নি — ছবিটা স্পষ্ট কিনা দেখো।"); continue; }
      return text;
    }

    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; } catch { /* ignore */ }

    // Model retired/renamed — try the next candidate instead of failing outright.
    if (res.status === 404 || /no longer available|not found/i.test(detail)) {
      lastError = new Error(`মডেল "${model}" আর নেই — পরবর্তী মডেল চেষ্টা করা হচ্ছে...`);
      continue;
    }
    if (res.status === 400 && /API key/i.test(detail)) throw new Error("Gemini API key ভুল — সঠিক key দিয়ে আবার চেষ্টা করো।");
    if (res.status === 429) throw new Error("Gemini free tier এর সীমা শেষ — একটু পরে আবার চেষ্টা করো।");
    throw new Error(`Gemini API সমস্যা (${res.status}): ${detail || "অজানা সমস্যা"}`);
  }

  throw lastError || new Error("কোনো Gemini মডেল দিয়েই কাজ করা গেল না।");
}

// Converts a browser File object into { mimeType, base64 } for the call above.
export function fileToImagePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1] || "";
      resolve({ mimeType: file.type || "image/jpeg", base64 });
    };
    reader.onerror = () => reject(new Error("ছবি পড়া যায়নি।"));
    reader.readAsDataURL(file);
  });
}
