/* =========================================================
   EXAM VOICE DIALOGUE BANK
   Single source of truth for every line the exam voice system
   can say. Used by:
   - student/exam.html      -> plays pre-recorded audio for these
                                lines (falls back to the browser's
                                speechSynthesis if a file is missing)
   - admin/voice-generator.html -> generates one audio file per
                                line via Gemini TTS

   Runtime filenames follow: assets/audio/voice/<key>-<index>.wav
   (index = position of the line within its array below)

   IMPORTANT: these lines never include the student's name, on
   purpose -- pre-recorded audio can't say a dynamic name
   naturally, so the name is dropped from speech (it still shows
   up in the on-screen toast). If you add/edit/remove a line here,
   re-open admin/voice-generator.html and regenerate the affected
   file(s), then replace them in assets/audio/voice/.
   ========================================================= */

export const DIALOGUE_BANK = {
  halfwayGood: [
    "তুমি খুব ভালো করছ, এভাবেই চালিয়ে যাও।",
    "চমৎকার গতিতে এগোচ্ছ, দেখে ভালো লাগছে।",
    "দারুণ! তোমার মনোযোগ একদম ঠিক পথে আছে।",
    "এই গতি ধরে রাখো, তুমি সত্যিই ভালো করছ।",
    "তোমার প্রস্তুতি স্পষ্ট বোঝা যাচ্ছে, এভাবেই চালিয়ে যাও।"
  ],
  halfwaySlow: [
    "একটু পিছিয়ে আছ, তবে সময় এখনো আছে — গতিটা একটু বাড়াও।",
    "চিন্তা নেই, এখনো সময় হাতে আছে। একটু দ্রুত এগোও।",
    "বাকি প্রশ্নগুলোতে একটু গতি বাড়ালে সহজেই শেষ করতে পারবে।"
  ],
  slow1: [
    "এই প্রশ্নে একটু বেশি সময় লাগছে, ভেবে উত্তর দিয়ে দাও।",
    "চিন্তা নেই, একটু সময় নিয়ে উত্তরটা দিয়ে সামনে বাড়ো।",
    "এই প্রশ্নটা কঠিন মনে হলে, দরকার হলে পরে আবার ফিরে আসতে পারবে।",
    "ধীরেসুস্থে ভাবো, তবে সময়টাও একটু খেয়াল রেখো।"
  ],
  slow2: [
    "চিন্তা করো না, তুমি ঠিকভাবেই এগিয়ে যাচ্ছ।",
    "একটা সিদ্ধান্ত নিয়ে সামনে বাড়ো, তুমি পারবে।",
    "যেটা মনে হয় সেটাই দিয়ে সামনে যাও, পরে চাইলে দেখে নিও।",
    "একটা উত্তর বেছে নিয়ে পরের প্রশ্নে চলে যাও, সময় গুরুত্বপূর্ণ।"
  ],
  minuteFinal: [
    "আর মাত্র এক মিনিট বাকি। সময় শেষ হয়ে গেলে তোমার উত্তরগুলো স্বয়ংক্রিয়ভাবে জমা হয়ে যাবে।",
    "শেষ এক মিনিট চলছে, তাড়াতাড়ি বাকিটা গুছিয়ে নাও।"
  ]
};

// Fixed (single-line, no randomness) countdown announcements for the
// 20/10/5-minutes-left checkpoints. Kept separate from DIALOGUE_BANK
// because there's exactly one correct wording for each -- no variants.
export const MIN_WORDS = { 20: "বিশ", 10: "দশ", 5: "পাঁচ" };
export const MINUTE_WARN_LINES = {};
[20, 10, 5].forEach(m => {
  MINUTE_WARN_LINES[`minuteWarn${m}`] = [`আর মাত্র ${MIN_WORDS[m]} মিনিট বাকি আছে।`];
});

// Flat list of every {key, index, text} the voice system needs an audio
// file for. admin/voice-generator.html iterates this to generate files;
// student/exam.html uses the same key+index to know which file to play.
export function buildVoiceManifest() {
  const all = { ...DIALOGUE_BANK, ...MINUTE_WARN_LINES };
  const manifest = [];
  Object.keys(all).forEach(key => {
    all[key].forEach((text, index) => manifest.push({ key, index, text }));
  });
  return manifest;
}
