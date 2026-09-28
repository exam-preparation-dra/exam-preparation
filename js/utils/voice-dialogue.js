/* =========================================================
   EXAM VOICE DIALOGUE BANK
   Single source of truth for every line the exam voice system
   can say. Spoken live through the browser's own speechSynthesis
   (student/exam.html prefers a Google Bengali voice when the
   device has one, e.g. "Google বাংলা" on Chrome/Android — falling
   back to whatever Bengali voice is available otherwise). There
   are no pre-recorded audio files anymore, so admin/voice-generator.html
   and assets/audio/voice/*.wav are unused and can be removed.

   Because the voice is now generated live, every line can greet
   the student by name. Write {name} anywhere a line should say
   the student's name; student/exam.html swaps it for the real
   name before speaking (or drops it cleanly if no name is set).
   ========================================================= */

export const DIALOGUE_BANK = {
  halfwayGood: [
    "{name}, তুমি খুব ভালো করছ, এভাবেই চালিয়ে যাও।",
    "চমৎকার গতিতে এগোচ্ছ {name}, দেখে ভালো লাগছে।",
    "দারুণ {name}! তোমার মনোযোগ একদম ঠিক পথে আছে।",
    "এই গতি ধরে রাখো {name}, তুমি সত্যিই ভালো করছ।",
    "তোমার প্রস্তুতি স্পষ্ট বোঝা যাচ্ছে {name}, এভাবেই চালিয়ে যাও।"
  ],
  halfwaySlow: [
    "{name}, একটু পিছিয়ে আছ, তবে সময় এখনো আছে — গতিটা একটু বাড়াও।",
    "চিন্তা নেই {name}, এখনো সময় হাতে আছে। একটু দ্রুত এগোও।",
    "{name}, বাকি প্রশ্নগুলোতে একটু গতি বাড়ালে সহজেই শেষ করতে পারবে।"
  ],
  slow1: [
    "{name}, এই প্রশ্নে একটু বেশি সময় লাগছে, ভেবে উত্তর দিয়ে দাও।",
    "চিন্তা নেই {name}, একটু সময় নিয়ে উত্তরটা দিয়ে সামনে বাড়ো।",
    "{name}, এই প্রশ্নটা কঠিন মনে হলে, দরকার হলে পরে আবার ফিরে আসতে পারবে।",
    "ধীরেসুস্থে ভাবো {name}, তবে সময়টাও একটু খেয়াল রেখো।"
  ],
  slow2: [
    "চিন্তা করো না {name}, তুমি ঠিকভাবেই এগিয়ে যাচ্ছ।",
    "একটা সিদ্ধান্ত নিয়ে সামনে বাড়ো {name}, তুমি পারবে।",
    "{name}, যেটা মনে হয় সেটাই দিয়ে সামনে যাও, পরে চাইলে দেখে নিও।",
    "একটা উত্তর বেছে নিয়ে পরের প্রশ্নে চলে যাও {name}, সময় গুরুত্বপূর্ণ।"
  ],
  minuteFinal: [
    "{name}, আর মাত্র এক মিনিট বাকি। সময় শেষ হয়ে গেলে তোমার উত্তরগুলো স্বয়ংক্রিয়ভাবে জমা হয়ে যাবে।",
    "শেষ এক মিনিট চলছে {name}, তাড়াতাড়ি বাকিটা গুছিয়ে নাও।"
  ]
};

// Fixed (single-line, no randomness) countdown announcements for the
// 20/10/5-minutes-left checkpoints. Kept separate from DIALOGUE_BANK
// because there's exactly one correct wording for each -- no variants.
export const MIN_WORDS = { 20: "বিশ", 10: "দশ", 5: "পাঁচ" };
export const MINUTE_WARN_LINES = {};
[20, 10, 5].forEach(m => {
  MINUTE_WARN_LINES[`minuteWarn${m}`] = [`{name}, আর মাত্র ${MIN_WORDS[m]} মিনিট বাকি আছে।`];
});

// Fills in the {name} placeholder used throughout DIALOGUE_BANK /
// MINUTE_WARN_LINES. If no name is available, the placeholder (and any
// stray leading/trailing comma-space it leaves behind) is removed cleanly
// so the line still reads naturally without an address.
export function fillName(text, name) {
  if (!text) return text;
  if (name && name.trim()) return text.split("{name}").join(name.trim());
  return text
    .replace(/\{name\},?\s*/g, "")
    .replace(/\s*,\s*\{name\}/g, "")
    .replace(/^\s*,\s*/, "")
    .trim();
}
