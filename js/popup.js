/* ============================================================
   AppPopup — one popup system for the whole site.

   Replaces the browser's native alert / confirm / prompt (the
   black "<your-site>.github.io says" box) and the old green-border
   toast with a single, themed design (light + dark aware).

   Classic script (no import/export) so it works from any page:
     <script src="…/js/popup.js"></script>
   ui-utils.js also imports it, so every page that uses showToast
   gets it automatically.

   API (all on window.AppPopup):
     await AppPopup.confirm(message, { title, okText, cancelText, danger, icon })  -> true | false
     await AppPopup.alert(message,   { title, okText, type })                      -> undefined
     await AppPopup.prompt(message, defaultValue, { title, okText, placeholder })  -> string | null
     AppPopup.toast(message, "success" | "error" | "info", ms)
     AppPopup.getLang() / AppPopup.setLang("en" | "bn")
     AppPopup.t(message)     // translate a string / {bn,en} to the current language

   LANGUAGE
     The current language is read from localStorage "appLang"
     (falls back to "legalLang", then DEFAULT_LANG). When your site
     gets an English switch, just call AppPopup.setLang("en") (or set
     localStorage.appLang = "en") and every popup/toast switches.
     Messages may be passed as:
       - a plain string   -> looked up in DICT (Bangla -> English); shown as-is if not found
       - {bn: "...", en: "..."}  -> picks the right one
   ============================================================ */
(function () {
  "use strict";
  if (window.AppPopup && window.AppPopup.__ready) return;

  var DEFAULT_LANG = "bn";

  /* ---------------- language ---------------- */
  function getLang() {
    try {
      var l = localStorage.getItem("appLang") || localStorage.getItem("legalLang");
      if (l === "en" || l === "bn") return l;
    } catch (e) {}
    return DEFAULT_LANG;
  }
  function setLang(l) {
    if (l !== "en" && l !== "bn") return;
    try { localStorage.setItem("appLang", l); } catch (e) {}
    try { document.documentElement.lang = l; } catch (e) {}
    try { window.dispatchEvent(new CustomEvent("applangchange", { detail: l })); } catch (e) {}
  }

  /* ---------------- UI strings ---------------- */
  var UI = {
    ok:        { bn: "ঠিক আছে",        en: "OK" },
    cancel:    { bn: "বাতিল",           en: "Cancel" },
    confirm:   { bn: "নিশ্চিত করো",     en: "Confirm" },
    del:       { bn: "মুছে ফেলো",       en: "Delete" },
    save:      { bn: "সেভ করো",         en: "Save" },
    close:     { bn: "বন্ধ করো",        en: "Close" },
    tConfirm:  { bn: "নিশ্চিত করো",     en: "Please confirm" },
    tDanger:   { bn: "সতর্কতা",         en: "Careful" },
    tInfo:     { bn: "জানিয়ে রাখি",    en: "Heads up" },
    tError:    { bn: "কিছু একটা সমস্যা হয়েছে", en: "Something went wrong" },
    tSuccess:  { bn: "হয়ে গেছে",        en: "Done" },
    tPrompt:   { bn: "লিখে দাও",        en: "Enter a value" }
  };
  function ui(k) { return UI[k][getLang()] || UI[k].bn; }

  /* ---------------- Bangla -> English dictionary ----------------
     Only used when the language is "en". Add new strings freely. */
  var DICT = {
    /* ---- confirms ---- */
    "লগআউট করবে?": "Log out of your account?",
    "এই বন্ধুকে তালিকা থেকে সরাতে চাও?": "Remove this friend from your list?",
    "এই বন্ধুকে তালিকা থেকে সরাবে?": "Remove this friend from your list?",
    "এই আমন্ত্রণ বাদ দেবে?": "Decline this invitation?",
    "এই গ্রুপ ছেড়ে দেবে?": "Leave this group?",
    "এই প্রশ্নটি ডুপ্লিকেট করবেন?": "Duplicate this question?",
    "এই প্রশ্নটি আবার সক্রিয় করবেন?": "Activate this question again?",
    "এই প্রশ্নটি নিষ্ক্রিয় করবেন? এটি নতুন পরীক্ষায় আর আসবে না।": "Deactivate this question? It won't appear in new exams.",
    "এই প্রশ্নটি স্থায়ীভাবে মুছে ফেলবেন?": "Permanently delete this question?",
    "পরীক্ষা প্রকাশ করলে প্রশ্নগুলো স্থায়ীভাবে লক হয়ে যাবে। এগিয়ে যাবেন?": "Once published, the questions are locked permanently. Continue?",
    "এই পরীক্ষাটি ডুপ্লিকেট করবেন?": "Duplicate this exam?",
    "এই পরীক্ষাটি সংরক্ষণাগারে পাঠাবেন?": "Move this exam to the archive?",
    "এই খসড়া পরীক্ষাটি স্থায়ীভাবে মুছে ফেলবেন?": "Permanently delete this draft exam?",
    "নিশ্চিত? এই পরীক্ষার সব রেকর্ড চিরতরে হারিয়ে যাবে।": "Are you sure? All records of this exam will be lost forever.",
    "আবেদন বাতিল করবেন?": "Reject this application?",
    "টপিকটি মুছে ফেলতে চান?": "Delete this topic?",
    "সতর্কতা: এই ব্যাচটি মুছলে এর ভেতরের সব বিষয় ও টপিক মুছে যাবে! নিশ্চিত?": "Warning: deleting this batch also deletes every subject and topic inside it. Are you sure?",
    "সতর্কতা: এই বিষয়টি মুছলে এর ভেতরের সব টপিক মুছে যাবে! নিশ্চিত?": "Warning: deleting this subject also deletes every topic inside it. Are you sure?",
    "এই পরীক্ষা সব ব্যাচ পাবে এবং সবার marks-এ যোগ হবে। নিশ্চিত?": "This exam will go to every batch and count toward everyone's marks. Are you sure?",
    "এই পরীক্ষা সব ব্যাচের জন্য থাকবে এবং সবার marks-এ যোগ হবে। নিশ্চিত?": "This exam will be available to every batch and count toward everyone's marks. Are you sure?",
    "এই Improvement Request মুছে ফেলবে? এটি আর তালিকায় দেখা যাবে না।": "Delete this Improvement Request? It will no longer appear in the list.",
    "Reject this offline student request?": "Reject this offline student request?",

    /* ---- prompts ---- */
    "বিষয়ের নতুন নাম:": "New subject name:",
    "টপিকের নতুন নাম (টপিক - সাবটপিক ফরম্যাটে দিতে পারেন):": "New topic name (you can use the format Topic - Subtopic):",

    /* ---- alerts ---- */
    "Request পর্যালোচনা হিসেবে সংরক্ষণ হয়েছে।": "Request saved as reviewed.",
    "Test প্রকাশ করা হয়েছে।": "Test published.",
    "Test শিক্ষার্থীকে বরাদ্দ করা হয়েছে।": "Test assigned to the student.",
    "Request বাতিল করা হয়েছে।": "Request cancelled.",
    "কাজটি সম্পন্ন করা যায়নি।": "Couldn't complete this action.",
    "সেভ করা যায়নি।": "Couldn't save.",
    "শুধু Host এই Battle delete করতে পারবে।": "Only the host can delete this battle.",
    "Battle delete করা যায়নি। আবার চেষ্টা করো।": "Couldn't delete the battle. Please try again.",

    /* ---- toasts ---- */
    "আপডেট হয়েছে!": "Updated!",
    "আপডেট হয়েছে": "Updated",
    "আপডেট করা হয়েছে।": "Updated.",
    "মুছে ফেলা হয়েছে": "Deleted",
    "মুছে ফেলা হয়েছে।": "Deleted.",
    "সেভ হয়েছে": "Saved",
    "সেভ করা যায়নি": "Couldn't save",
    "প্রথমে ব্যাচ, বিষয় এবং টপিক নির্বাচন করুন": "Select a batch, subject and topic first",
    "প্রথমে ব্যাচ, বিষয় এবং টপিক সিলেক্ট করুন": "Select a batch, subject and topic first",
    "নাম খালি রাখা যাবে না।": "Name can't be empty.",
    "ছবি আপলোড করা যায়নি।": "Couldn't upload the image.",
    "চ্যালেঞ্জ পাঠানো হয়েছে": "Challenge sent",
    "অনুরোধ পাঠানো হয়েছে": "Request sent",
    "This request has already been reviewed.": "This request has already been reviewed.",
    "স্টুডেন্ট আইডি কপি করা হয়েছে!": "Student ID copied!",
    "সরানো হয়েছে": "Removed",
    "সব প্রশ্ন আগেই সিলেক্ট করা হয়েছে!": "All questions are already selected!",
    "সফলভাবে তৈরি হয়েছে!": "Created successfully!",
    "সফলভাবে জেনারেট হয়েছে! নিচে প্রিভিউ দেখুন।": "Generated successfully! See the preview below.",
    "সঠিক উত্তর ও ব্যাখ্যা দেখা যাচ্ছে ✅": "Correct answer and explanation are now visible ✅",
    "সংরক্ষণাগারে পাঠানো হয়েছে।": "Moved to the archive.",
    "শুধুমাত্র খসড়া পরীক্ষা সম্পাদনা করা যায়।": "Only draft exams can be edited.",
    "শুধু বন্ধুদের সাথেই চ্যাট করা যায়।": "You can only chat with friends.",
    "রেফারেল কোড সঠিক নয় — ঠিক করো অথবা ফাঁকা রাখো।": "Referral code isn't valid — fix it or leave it blank.",
    "রেজাল্ট কার্ড তৈরি করা যায়নি।": "Couldn't create the result card.",
    "ভয়েস ইনপুট ব্যর্থ হয়েছে।": "Voice input failed.",
    "ব্যাচ আপডেট হয়েছে।": "Batch updated.",
    "ব্যাখ্যা তৈরি ও সংরক্ষণ করা হয়েছে।": "Explanation generated and saved.",
    "বিষয়ের নাম লিখতে হবে": "Enter a subject name",
    "বাদ দেওয়া যায়নি": "Couldn't decline",
    "বন্ধু যুক্ত হলো": "Friend added",
    "প্ল্যাটফর্মের নাম সংরক্ষণ করা হয়েছে।": "Platform name saved.",
    "প্রশ্ন যোগ করা হয়েছে।": "Question added.",
    "প্রশ্ন মুছে ফেলা হয়েছে।": "Question deleted.",
    "প্রশ্ন ডুপ্লিকেট করা হয়েছে।": "Question duplicated.",
    "প্রশ্ন আপডেট করা হয়েছে।": "Question updated.",
    "প্রম্পট কপি হয়েছে! এবার ChatGPT/Claude-এ পেস্ট করুন।": "Prompt copied! Now paste it into ChatGPT/Claude.",
    "প্রথমে API Key সেট করুন": "Set your API key first",
    "পরীক্ষা প্রকাশ করা হয়েছে।": "Exam published.",
    "পরীক্ষা পাওয়া যায়নি।": "Exam not found.",
    "পরীক্ষা ডুপ্লিকেট করা হয়েছে (খসড়া হিসেবে)।": "Exam duplicated (as a draft).",
    "পরীক্ষা ও এর সব রেকর্ড মুছে ফেলা হয়েছে।": "Exam and all its records deleted.",
    "পরীক্ষা আপডেট করা হয়েছে।": "Exam updated.",
    "নাম দেওয়া আবশ্যক।": "A name is required.",
    "নতুন ব্যাচের নাম লিখুন": "Enter a name for the new batch",
    "দয়া করে ব্যাচ নির্বাচন করুন": "Please select a batch",
    "দয়া করে নাম এবং ব্যাচ নির্বাচন করো": "Please choose a name and a batch",
    "তোমার ব্যালেন্সে যথেষ্ট XP নেই।": "You don't have enough XP.",
    "তোমার কাছে কোনো হিন্ট কার্ড নেই। স্টোর থেকে কিনে রাখো।": "You have no hint cards. Buy some from the store.",
    "তোমার কাছে কোনো টাইম কার্ড নেই। স্টোর থেকে কিনে রাখো।": "You have no time cards. Buy some from the store.",
    "তথ্য সফলভাবে আপডেট করা হয়েছে।": "Details updated successfully.",
    "তথ্য লোড করা যায়নি।": "Couldn't load the details.",
    "টেক্সট প্রসেস করা হয়েছে!": "Text processed!",
    "জমা দেওয়া যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করো।": "Couldn't submit. Check your internet connection and try again.",
    "জমা দেওয়া যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।": "Couldn't submit. Check your internet connection and try again.",
    "খসড়া পরীক্ষা তৈরি করা হয়েছে।": "Draft exam created.",
    "কোনো প্রশ্ন তৈরি করা যায়নি।": "No questions could be created.",
    "কেনা হয়ে গেছে! ✅": "Purchased! ✅",
    "কার্ড তৈরি করা যায়নি।": "Couldn't create the card.",
    "কপি হয়েছে।": "Copied.",
    "কপি হয়েছে": "Copied",
    "কপি করা যায়নি — নিজে সিলেক্ট করে কপি করো।": "Couldn't copy — select the text and copy it manually.",
    "কপি করতে সমস্যা হয়েছে।": "Couldn't copy.",
    "এগিয়ে যেতে গোপনীয়তা নীতি ও শর্তাবলিতে সম্মতি দাও": "Accept the Privacy Policy and Terms to continue",
    "এখনে AI-এর দেওয়া উত্তর পেস্ট করুন": "Paste the AI's answer here",
    "এই ব্রাউজারে সরাসরি শেয়ার সাপোর্ট নেই — ডাউনলোড করে শেয়ার করুন।": "This browser can't share directly — download it and share manually.",
    "এই বন্ধুর সাথে চ্যালেঞ্জ চলছে।": "A challenge with this friend is already in progress.",
    "এই পরীক্ষার ব্যাচ এখনো ঠিক করা হয়নি — ব্যাচ নির্বাচন করুন।": "This exam has no batch yet — please select one.",
    "এই তালিকায় তুমি নেই।": "You're not on this list.",
    "এই ক্যাটাগরিতে কোনো প্রশ্ন পাওয়া যায়নি।": "No questions found in this category.",
    "ইম্পোর্ট করার মতো বৈধ প্রশ্ন নেই।": "There are no valid questions to import.",
    "আর মাত্র ১ মিনিট বাকি — সময় শেষ হলে উত্তর স্বয়ংক্রিয়ভাবে জমা হয়ে যাবে।": "Only 1 minute left — your answers will be submitted automatically when time runs out.",
    "আমন্ত্রণ পাঠানো হয়েছে — অনুমোদনের অপেক্ষা": "Invitation sent — waiting for approval",
    "আবেদন বাতিল করা হয়েছে।": "Application rejected.",
    "আবেদন জমা হয়েছে। অ্যাডমিন Exam তৈরি করলে এখানে দেখতে পাবে।": "Application submitted. You'll see the exam here once the admin creates it.",
    "আগে কাউকে বন্ধু বানাও।": "Add a friend first.",
    "অন্তত একটি ছবি বা নির্দেশিকা দিন": "Add at least one image or instruction",
    "অন্তত একটা সিলেকশন যোগ করুন।": "Add at least one selection.",
    "Student successfully approved as Offline.": "Student successfully approved as Offline.",
    "Request মুছে ফেলা হয়েছে।": "Request deleted.",
    "Request মুছে ফেলা যায়নি।": "Couldn't delete the request.",
    "Request rejected successfully.": "Request rejected successfully.",
    "QR খোলা যায়নি": "Couldn't open the QR code",
    "PIN বদলানো হয়েছে": "PIN changed",
    "PDF তৈরি করা যায়নি।": "Couldn't create the PDF.",
    "PDF তৈরি করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।": "Couldn't create the PDF. Check your internet connection.",
    "Improvement Exam সরানো হয়েছে।": "Improvement Exam removed.",
    "Improvement Exam চিরতরে মুছে ফেলা হয়েছে।": "Improvement Exam deleted permanently.",
    "Failed to reject request.": "Failed to reject request.",
    "Failed to approve request. Check permissions.": "Failed to approve request. Check permissions.",
    "API key ছাড়া ব্যাখ্যা তৈরি করা যাবে অমর।": "Explanations can't be generated without an API key.",
    "API key ছাড়া তৈরি করা যাবে না।": "Can't be generated without an API key.",
    "API Key সফলভাবে সেভ হয়েছে!": "API key saved!",
    "API Key ফাঁকা রাখা যাবে না": "API key can't be empty",

    "ওর অ্যাকাউন্ট আগে থেকেই আছে। Firebase Console → Authentication থেকে ইউজারটা ডিলিট করে আবার চাপো।": "This account already exists. Delete the user in Firebase Console → Authentication, then try again.",
    "অ্যাকাউন্ট আগে থেকেই আছে। রিসেট করতে Firebase Console → Authentication থেকে ওই ইউজার ডিলিট করো, তারপর আবার চাপো।": "This account already exists. To reset it, delete that user in Firebase Console → Authentication, then try again.",
    "এই অনুশীলনটি প্রস্তুত আছে। অনুশীলন পেজ সংযুক্ত হলে এখান থেকেই শুরু হবে।": "This practice is ready. You'll be able to start it from here once the practice page is connected.",
    "অনুশীলন শুরু করার সংযোগ প্রস্তুত হয়েছে।": "Practice start link is ready.",
    "Friend request গ্রহণ করা হয়েছে।": "Friend request accepted.",
    "Friend request প্রত্যাখ্যান করা হয়েছে।": "Friend request declined.",
    "Challenge গ্রহণ করা হয়েছে।": "Challenge accepted.",
    "Challenge প্রত্যাখ্যান করা হয়েছে।": "Challenge declined.",
    "চ্যালেঞ্জ গ্রহণ করা হয়েছে": "Challenge accepted",
    "বাদ দেওয়া হয়েছে": "Dismissed",
    "বাতিল করা হয়েছে": "Cancelled",
    "বন্ধুত্ব শেষ হয়েছে": "Friendship ended",
    "রাইভাল ঠিক করা হয়েছে": "Rival set",
    "রাইভাল সরানো হয়েছে": "Rival removed",
    "আমন্ত্রণ বাদ দেওয়া হয়েছে": "Invitation declined",
    "গ্রুপে যোগ দিয়েছো": "Joined the group",
    "গ্রুপ ছেড়েছো": "Left the group",
    "সবার জন্য মুছে ফেলা হয়েছে": "Deleted for everyone",
    "সক্রিয় করা হয়েছে।": "Activated.",
    "নিষ্ক্রিয় করা হয়েছে।": "Deactivated.",

    /* ---- friendlyError() ---- */
    "পাসওয়ার্ড সঠিক নয়।": "Incorrect password.",
    "এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।": "No account found with this email.",
    "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।": "Too many attempts. Please try again in a little while.",
    "ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না।": "No internet connection.",
    "এই তথ্য দেখার অনুমতি নেই।": "You don't have permission to view this.",
    "সার্ভারের সাথে সংযোগ করা যাচ্ছে না। পরে আবার চেষ্টা করুন।": "Can't reach the server. Please try again later.",
    "একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।": "Something went wrong. Please try again."
  };

  /* Dynamic Bangla messages that can't be matched exactly. */
  var PATTERNS = [
    [/^(\d+) টি ফলাফল সফলভাবে (.+) করা হয়েছে।$/, function (m) { return m[1] + " results " + m[2] + " successfully."; }],
    [/^(.+)টি প্রশ্ন দিয়ে Draft Test তৈরি হয়েছে।$/, function (m) { return "Draft Test created with " + m[1] + " questions."; }],
    [/^(\d+) টি প্রশ্ন সফলভাবে যোগ হয়েছে!$/, function (m) { return m[1] + " questions added successfully!"; }],
    [/^(\d+) টি প্রশ্ন র‍্যান্ডমলি সিলেক্ট করা হয়েছে!$/, function (m) { return m[1] + " questions picked at random!"; }],
    [/^আরও (.+) পরে পাঠাতে পারবে।$/, function (m) { return "You can send again in " + m[1] + "."; }],
    [/^আর মাত্র (\d+) মিনিট বাকি আছে।$/, function (m) { return "Only " + m[1] + " minutes left."; }]
  ];

  // Bengali has two spellings for letters like য় (U+09DF vs U+09AF+U+09BC).
  // Normalise both the dictionary and the incoming text so lookups always match.
  var nfc = function (x) { return x.normalize ? x.normalize("NFC") : x; };
  var NDICT = {};
  Object.keys(DICT).forEach(function (k) { NDICT[nfc(k)] = DICT[k]; });
  PATTERNS = PATTERNS.map(function (p) { return [new RegExp(nfc(p[0].source)), p[1]]; });

  function t(msg) {
    if (msg == null) return "";
    if (typeof msg === "object") {
      if (msg instanceof Error) msg = msg.message || String(msg);
      else return String(msg[getLang()] != null ? msg[getLang()] : (msg.bn != null ? msg.bn : msg.en != null ? msg.en : ""));
    }
    msg = String(msg);
    if (getLang() !== "en") return msg;
    var key = nfc(msg);
    if (Object.prototype.hasOwnProperty.call(NDICT, key)) return NDICT[key];
    for (var i = 0; i < PATTERNS.length; i++) {
      var m = PATTERNS[i][0].exec(key);
      if (m) return PATTERNS[i][1](m);
    }
    return msg;
  }

  /* ---------------- styles ---------------- */
  var CSS = "\
.ap-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;\
background:rgba(14,16,22,.52);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .18s ease}\
.ap-overlay.ap-in{opacity:1}\
.ap-box{position:relative;width:100%;max-width:380px;box-sizing:border-box;padding:26px 22px 20px;text-align:center;\
background:var(--surface-solid,#fff);color:var(--text-primary,#21262f);border:1px solid var(--surface-border,rgba(0,0,0,.08));\
border-radius:22px;box-shadow:0 24px 60px rgba(0,0,0,.28),0 2px 0 rgba(255,255,255,.04) inset;\
transform:translateY(14px) scale(.96);transition:transform .22s cubic-bezier(.2,.9,.3,1.2);font-family:inherit}\
.ap-overlay.ap-in .ap-box{transform:none}\
.ap-ico{width:58px;height:58px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;\
background:color-mix(in srgb,var(--ap-c) 14%,transparent);color:var(--ap-c);\
box-shadow:0 0 0 8px color-mix(in srgb,var(--ap-c) 7%,transparent)}\
.ap-ico svg{width:28px;height:28px}\
.ap-title{margin:0 0 6px;font-size:1.08rem;font-weight:700;line-height:1.3;color:var(--text-primary,#21262f)}\
.ap-msg{margin:0 0 20px;font-size:.93rem;line-height:1.6;white-space:pre-line;word-break:break-word;color:var(--text-secondary,#5b6270)}\
.ap-input{width:100%;box-sizing:border-box;margin:-6px 0 18px;padding:12px 14px;font:inherit;font-size:.95rem;text-align:left;\
color:var(--text-primary,#21262f);background:var(--surface,rgba(0,0,0,.03));border:1.5px solid var(--surface-border,rgba(0,0,0,.12));\
border-radius:12px;outline:none;transition:border-color .15s,box-shadow .15s}\
.ap-input:focus{border-color:var(--ap-c);box-shadow:0 0 0 3px color-mix(in srgb,var(--ap-c) 22%,transparent)}\
.ap-actions{display:flex;gap:10px}\
.ap-btn{flex:1;min-height:46px;padding:0 14px;border-radius:13px;font:inherit;font-size:.95rem;font-weight:600;cursor:pointer;\
border:1.5px solid transparent;transition:transform .12s,filter .15s,background .15s;-webkit-tap-highlight-color:transparent}\
.ap-btn:active{transform:scale(.97)}\
.ap-btn-ghost{background:transparent;color:var(--text-secondary,#5b6270);border-color:var(--surface-border,rgba(0,0,0,.14))}\
.ap-btn-ghost:hover{background:var(--surface,rgba(0,0,0,.04))}\
.ap-btn-main{background:var(--ap-c);color:#fff;box-shadow:0 6px 16px color-mix(in srgb,var(--ap-c) 38%,transparent)}\
.ap-btn-main:hover{filter:brightness(1.07)}\
.ap-btn:focus-visible{outline:2px solid var(--ap-c);outline-offset:2px}\
\
.ap-toasts{position:fixed;left:0;right:0;top:max(14px,env(safe-area-inset-top));z-index:100001;display:flex;flex-direction:column;\
align-items:center;gap:10px;padding:0 14px;pointer-events:none}\
.ap-toast{pointer-events:auto;display:flex;align-items:center;gap:12px;max-width:min(440px,100%);box-sizing:border-box;padding:11px 16px 11px 12px;\
background:var(--surface-solid,#fff);color:var(--text-primary,#21262f);border:1px solid var(--surface-border,rgba(0,0,0,.08));\
border-radius:16px;box-shadow:0 14px 34px rgba(0,0,0,.2);font-size:.9rem;line-height:1.45;cursor:pointer;position:relative;overflow:hidden;\
opacity:0;transform:translateY(-14px) scale(.97);transition:opacity .22s,transform .25s cubic-bezier(.2,.9,.3,1.2)}\
.ap-toast.ap-in{opacity:1;transform:none}\
.ap-toast.ap-out{opacity:0;transform:translateY(-10px) scale(.97)}\
.ap-toast-ico{flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:var(--ap-c);\
background:color-mix(in srgb,var(--ap-c) 15%,transparent)}\
.ap-toast-ico svg{width:17px;height:17px}\
.ap-toast-msg{min-width:0;word-break:break-word;white-space:pre-line}\
.ap-toast-bar{position:absolute;left:0;bottom:0;height:3px;width:100%;background:var(--ap-c);opacity:.55;transform-origin:left;\
animation:ap-bar var(--ap-ms,3200ms) linear forwards}\
@keyframes ap-bar{to{transform:scaleX(0)}}\
\
.ap-c-info{--ap-c:var(--color-accent,#b8863c)}\
.ap-c-success{--ap-c:var(--color-success,#2f7d5e)}\
.ap-c-error,.ap-c-danger{--ap-c:var(--color-danger,#a6402f)}\
@media (max-width:520px){.ap-overlay{align-items:flex-end;padding:12px}.ap-box{max-width:none;border-radius:24px 24px 18px 18px}}\
@media (prefers-reduced-motion:reduce){.ap-overlay,.ap-box,.ap-toast{transition:none}.ap-toast-bar{animation:none}}";

  function injectCss() {
    if (document.getElementById("ap-style")) return;
    var s = document.createElement("style");
    s.id = "ap-style";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------------- icons ---------------- */
  var SVG = function (p) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
  };
  var ICON = {
    question: SVG('<circle cx="12" cy="12" r="9.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8"/><path d="M12 17h.01"/>'),
    danger:   SVG('<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4.2M12 17h.01"/>'),
    info:     SVG('<circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5M12 7.6h.01"/>'),
    success:  SVG('<circle cx="12" cy="12" r="9.5"/><path d="m7.8 12.3 2.8 2.8 5.6-5.8"/>'),
    error:    SVG('<circle cx="12" cy="12" r="9.5"/><path d="m9 9 6 6m0-6-6 6"/>'),
    edit:     SVG('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>')
  };

  /* ---------------- dialog engine ---------------- */
  var queue = [];
  var busy = false;

  function looksDangerous(s) {
    return /মুছ|ডিলিট|স্থায়ী|চিরতরে|সতর্কতা|permanent|delete|erase|remove|reject|বাতিল|সরা|ছেড়ে|লগআউট|log ?out/i.test(s);
  }

  function open(kind, message, opts, def) {
    return new Promise(function (resolve) {
      queue.push({ kind: kind, message: message, opts: opts || {}, def: def, resolve: resolve });
      if (!busy) next();
    });
  }

  function next() {
    var job = queue.shift();
    if (!job) { busy = false; return; }
    busy = true;
    injectCss();

    var o = job.opts;
    var raw = typeof job.message === "string" ? job.message : "";
    var msg = t(job.message);
    var isConfirm = job.kind === "confirm";
    var isPrompt = job.kind === "prompt";
    var danger = o.danger != null ? !!o.danger : (isConfirm && looksDangerous(raw + " " + msg));
    var tone = isPrompt ? "info" : (o.type === "error" ? "error" : o.type === "success" ? "success" : danger ? "danger" : "info");
    var icon = o.icon || (isPrompt ? "edit" : tone === "danger" ? "danger" : tone === "error" ? "error" : tone === "success" ? "success" : isConfirm ? "question" : "info");

    var title = o.title != null ? t(o.title)
      : isPrompt ? ui("tPrompt")
      : tone === "danger" ? ui("tDanger")
      : tone === "error" ? ui("tError")
      : tone === "success" ? ui("tSuccess")
      : isConfirm ? ui("tConfirm") : ui("tInfo");

    var okText = o.okText != null ? t(o.okText) : (danger ? (/মুছ|delete|ডিলিট/i.test(raw + msg) ? ui("del") : ui("confirm")) : isConfirm ? ui("confirm") : isPrompt ? ui("save") : ui("ok"));
    var cancelText = o.cancelText != null ? t(o.cancelText) : ui("cancel");

    var prevFocus = document.activeElement;
    var ov = document.createElement("div");
    ov.className = "ap-overlay ap-c-" + tone;
    ov.setAttribute("role", isConfirm || isPrompt ? "alertdialog" : "dialog");
    ov.setAttribute("aria-modal", "true");

    var box = document.createElement("div");
    box.className = "ap-box";

    var ico = document.createElement("div");
    ico.className = "ap-ico";
    ico.innerHTML = ICON[icon] || ICON.info;

    var h = document.createElement("h2");
    h.className = "ap-title";
    h.id = "ap-t" + Date.now();
    h.textContent = title;
    ov.setAttribute("aria-labelledby", h.id);

    var p = document.createElement("p");
    p.className = "ap-msg";
    p.textContent = msg;

    box.appendChild(ico);
    box.appendChild(h);
    box.appendChild(p);

    var input = null;
    if (isPrompt) {
      input = document.createElement("input");
      input.className = "ap-input";
      input.type = "text";
      input.value = job.def == null ? "" : String(job.def);
      if (o.placeholder) input.placeholder = t(o.placeholder);
      input.setAttribute("autocomplete", "off");
      box.appendChild(input);
    }

    var actions = document.createElement("div");
    actions.className = "ap-actions";
    var cancelBtn = null;
    if (isConfirm || isPrompt) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "ap-btn ap-btn-ghost";
      cancelBtn.textContent = cancelText;
      actions.appendChild(cancelBtn);
    }
    var okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "ap-btn ap-btn-main";
    okBtn.textContent = okText;
    actions.appendChild(okBtn);
    box.appendChild(actions);
    ov.appendChild(box);
    document.body.appendChild(ov);

    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(function () { ov.classList.add("ap-in"); });
    setTimeout(function () { (input || okBtn).focus(); if (input) input.select(); }, 30);

    var done = false;
    function finish(result) {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey, true);
      ov.classList.remove("ap-in");
      document.body.style.overflow = prevOverflow;
      setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (e) {}
        job.resolve(result);
        next();
      }, 170);
    }
    var cancelValue = isConfirm ? false : isPrompt ? null : undefined;
    var okValue = function () { return isConfirm ? true : isPrompt ? input.value : undefined; };

    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(cancelValue); }
      else if (e.key === "Enter" && (!e.target || e.target.tagName !== "BUTTON" || e.target === okBtn)) { e.preventDefault(); e.stopPropagation(); finish(okValue()); }
      else if (e.key === "Tab") {
        var f = box.querySelectorAll("input,button");
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKey, true);
    okBtn.addEventListener("click", function () { finish(okValue()); });
    if (cancelBtn) cancelBtn.addEventListener("click", function () { finish(cancelValue); });
    ov.addEventListener("mousedown", function (e) { if (e.target === ov && (isConfirm || isPrompt)) finish(cancelValue); });
  }

  /* ---------------- toast ---------------- */
  function toast(message, type, ms) {
    if (typeof type === "number") { ms = type; type = "info"; }
    if (type === true) type = "error";
    if (type === false || type == null || type === "default") type = "info";
    if (type !== "error" && type !== "success") type = "info";
    ms = ms > 0 ? ms : (type === "error" ? 4500 : 3200);

    injectCss();
    var host = document.getElementById("ap-toasts");
    if (!host) {
      host = document.createElement("div");
      host.id = "ap-toasts";
      host.className = "ap-toasts";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    var text = t(message);
    // collapse an identical toast that's already showing
    var existing = host.querySelectorAll(".ap-toast");
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].__text === text && !existing[i].__closing) { existing[i].__close(); }
    }
    while (host.children.length >= 3) { host.firstChild.__close ? host.firstChild.__close() : host.removeChild(host.firstChild); }

    var el = document.createElement("div");
    el.className = "ap-toast ap-c-" + type;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.style.setProperty("--ap-ms", ms + "ms");
    el.__text = text;
    el.innerHTML = '<span class="ap-toast-ico">' + ICON[type === "info" ? "info" : type] + '</span><span class="ap-toast-msg"></span><span class="ap-toast-bar"></span>';
    el.querySelector(".ap-toast-msg").textContent = text;
    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("ap-in"); });

    var timer = setTimeout(close, ms);
    function close() {
      if (el.__closing) return;
      el.__closing = true;
      clearTimeout(timer);
      el.classList.remove("ap-in");
      el.classList.add("ap-out");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }
    el.__close = close;
    el.addEventListener("click", close);
    return el;
  }

  /* ---------------- public API ---------------- */
  window.AppPopup = {
    __ready: true,
    confirm: function (message, opts) { return open("confirm", message, opts); },
    alert:   function (message, opts) { return open("alert", message, opts); },
    prompt:  function (message, def, opts) { return open("prompt", message, opts, def); },
    toast: toast,
    t: t,
    getLang: getLang,
    setLang: setLang,
    DICT: DICT
  };

  // Any leftover native alert() now uses the themed popup (non-blocking).
  // confirm()/prompt() cannot be made synchronous, so those call sites use
  // `await AppPopup.confirm(...)` / `await AppPopup.prompt(...)` directly.
  window.alert = function (message) { open("alert", message == null ? "" : message, {}); };
})();
