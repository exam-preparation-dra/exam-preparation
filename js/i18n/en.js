/* English dictionary — COMMON (login, header, menu, nav, popups, dashboard).
   "বাংলা": "English"  — exact text.   P(regex, "English $1")  — text with changing parts. */
window.__I18N_DICT = window.__I18N_DICT || {};
window.__I18N_PATTERNS = window.__I18N_PATTERNS || [];
(function () {
  var D = window.__I18N_DICT, PT = window.__I18N_PATTERNS;
  window.__I18N_ADD = function (o) { for (var k in o) D[k] = o[k]; };
  window.__I18N_P = function (re, out) { PT.push([re, out]); };
})();
__I18N_ADD({
  /* ---------- greetings ---------- */
  "শুভ রাত্রি": "Good night", "শুভ সকাল": "Good morning", "শুভ দুপুর": "Good afternoon",
  "শুভ বিকেল": "Good afternoon", "শুভ সন্ধ্যা": "Good evening",
  "শুভ সন্ধ্যা,": "Good evening,", "শুভ রাত্রি,": "Good night,", "শুভ সকাল,": "Good morning,",
  "শুভ দুপুর,": "Good afternoon,", "শুভ বিকেল,": "Good afternoon,",
  "শিক্ষার্থী": "Student", "অ্যাডমিন": "Admin", "জন": "", "টি": "",

  /* ---------- login page (index.html) ---------- */
  "থিম পরিবর্তন": "Change theme", "প্রবেশ করো": "Sign in", "তুমি কে?": "Who are you?",
  "নিজের নামটি বেছে নাও": "Pick your name", "জন শিক্ষার্থী ·": "students ·", "টি ব্যাচ": "batches",
  "তালিকায় নাম নেই?": "Not on the list?", "নতুন হলে যুক্ত হওয়ার আবেদন করো।": "New here? Apply to join.",
  "আবেদন করো": "Apply", "নীতি ও সাহায্য": "Policies & help", "গোপনীয়তা নীতি": "Privacy Policy",
  "শর্তাবলি": "Terms", "প্রশ্নোত্তর": "FAQ", "শিক্ষার্থীর তালিকা": "Student list",
  "অন্যান্য শিক্ষার্থী": "Other students", "নাম চাপলে প্রোফাইল দেখা যাবে": "Tap a name to open the profile",
  "সর্বশেষ প্রবেশ": "Last sign-in", "শিক্ষার্থী খুঁজুন": "Find a student",
  "নাম বা আইডি দিয়ে খুঁজুন…": "Search by name or ID…", "নাম বা আইডি দিয়ে খুঁজুন...": "Search by name or ID...",
  "মুছে ফেলো": "Clear", "মুছো": "Clear", "সবাই": "All", "বন্ধ": "Close",
  "Battle-এ যোগ দিতে আগে নিজের নাম বেছে PIN দাও। তারপর নিজে থেকেই Battle-এ যোগ হবে।": "To join the Battle, pick your name and enter your PIN. You'll join the Battle automatically.",
  "নাম পাওয়া যায়নি": "Name not found", "আইডি পাওয়া যায়নি": "ID not found", "তুমি": "You",
  "শিক্ষার্থী পাওয়া যায়নি": "No students found", "নাম বা আইডি একটু অন্যভাবে লিখে চেষ্টা করো।": "Try spelling the name or ID a little differently.",
  "এখনো কোনো শিক্ষার্থী যোগ করা হয়নি। অ্যাডমিন প্যানেল থেকে শিক্ষার্থী তৈরি করুন।": "No students have been added yet. Create students from the admin panel.",
  "সুরক্ষিত প্রবেশ · তোমার পাসওয়ার্ড নিরাপদে থাকে": "Secure sign-in · your password stays safe",
  "দেখাও": "Show", "যাচাই": "Verify", "নতুন PIN": "New PIN", "Caps Lock চালু আছে": "Caps Lock is on",
  "একটু অপেক্ষা করো…": "Please wait…", "তোমার PIN দাও": "Enter your PIN", "সংখ্যার PIN লিখে ঢোকো।": "-digit PIN to sign in.",
  "PIN ভুলে গেছো?": "Forgot your PIN?", "মিনিট": "min", "সেকেন্ড": "sec",
  "অনেকবার ভুল হয়েছে।": "Too many wrong attempts.", "পরে আবার চেষ্টা করো।": "Try again later.",
  "যাচাই হচ্ছে…": "Verifying…", "PIN ভুল": "Wrong PIN", "পরের ধাপ": "Next",
  "পাসওয়ার্ড মনে নেই?": "Don't remember your password?", "লেখো।": "Enter it.",
  "নতুন নিয়ম: এবার থেকে PIN": "New rule: from now on, a PIN",
  "নিরাপত্তার জন্য এখন শুধু": "For security, you now sign in with only a",
  "৬ সংখ্যার PIN": "6-digit PIN", "দিয়ে ঢুকতে হবে। আজ একবার তোমার": "Today, sign in once with your",
  "পুরোনো পাসওয়ার্ড": "old password", "লিখে ঢোকো, তারপর নতুন PIN বানাবে।": "then create your new PIN.",
  "৮ সংখ্যার কোড লেখো": "Enter the 8-digit code", "অ্যাডমিন যে": "Enter the",
  "৮ সংখ্যার কোড": "8-digit code", "দিয়েছে সেটা লেখো। এই কোড দিয়ে ঢুকে তুমি নতুন PIN বানাবে।": "the admin gave you. You'll use it to sign in and create a new PIN.",
  "কোডে অক্ষর আছে?": "Letters in the code?", "৮ সংখ্যার কোড লেখো।": "Enter the 8-digit code.",
  "কোডটা মেলেনি। অ্যাডমিনের দেওয়া কোড আবার দেখে লেখো।": "That code didn't match. Check the code the admin gave you and try again.",
  "সেটআপ কোড লেখো": "Enter the setup code", "অ্যাডমিনের পাঠানো কোডটা এখানে লেখো।": "Enter the code the admin sent you here.",
  "সেটআপ কোড": "Setup code", "কোডটা মেলেনি। অ্যাডমিনের পাঠানো কোড আবার দেখে লেখো।": "That code didn't match. Check the code the admin sent and try again.",
  "নিজের PIN বানাও": "Create your PIN", "এখন থেকে এই": "From now on you'll sign in with this",
  "সংখ্যার PIN": "-digit PIN",
  "দিয়েই ঢুকবে। সহজ PIN (111111, 123456) চলবে না, আর নিজে মনে রাখো।": ". Easy PINs (111111, 123456) aren't allowed — and remember it yourself.",
  "আবার লেখো": "Enter it again", "নিশ্চিত হতে একই PIN আরেকবার লেখো।": "Type the same PIN once more to confirm.",
  "PIN বদলাবো": "Set PIN", "দুটি PIN মেলেনি। আবার লেখো।": "The two PINs don't match. Try again.",
  "সেভ হচ্ছে…": "Saving…", "PIN এখনো সেট নেই": "PIN not set yet",
  "তোমার প্রোফাইলে এখনো PIN বানানো হয়নি। PIN বানাতে অ্যাডমিনের কাছ থেকে একটা": "Your profile doesn't have a PIN yet. To create one you need a",
  "লাগবে। নিচের বাটনে চাপলে অ্যাডমিন তোমার আবেদন দেখতে পাবে।": "from the admin. Tap the button below and the admin will see your request.",
  "কোডের জন্য আবেদন করো": "Request a code", "আমার কাছে কোড আছে": "I have a code",
  "পাঠানো হচ্ছে…": "Sending…", "আবেদন পাঠানো যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করো।": "Couldn't send the request. Check your internet and try again.",
  "আবেদন পাঠানো হয়েছে": "Request sent",
  "অ্যাডমিন তোমার আবেদন দেখতে পাবে এবং তোমাকে": "The admin will see your request and send you an",
  "পাঠাবে। কোড পেলে আবার এখানে এসে": "When you get it, come back here and tap",
  "নিজের নাম চাপো": "your name", ", তারপর কোডটা লিখবে।": ", then enter the code.",
  "ঠিক আছে": "OK", "সমস্যা নেই। আবেদন পাঠাও — অ্যাডমিন তোমার PIN রিসেট করে নতুন ৮ সংখ্যার কোড দেবে, তারপর তুমি নতুন PIN বানাবে।": "No problem. Send a request — the admin will reset your PIN and give you a new 8-digit code, then you create a new PIN.",
  "রিসেটের আবেদন পাঠাও": "Request a reset", "ফিরে যাও": "Go back",
  "আবেদন পাঠানো যায়নি। আবার চেষ্টা করো।": "Couldn't send the request. Try again.",
  "তোমার রিসেটের আবেদন অ্যাডমিনের কাছে পাঠানো আছে।": "Your reset request has been sent to the admin.",
  "হিসেবে ফিরে যাও": "Go back as", "এই প্রোফাইলটাই কি তোমার?": "Is this your profile?",
  "আমি নই — ডানদিকের তালিকা থেকে বেছে নাও": "Not me — pick from the list on the right",
  "অন্য নাম দেখো": "See other names", "আমি নই — অন্য প্রোফাইল খুঁজুন": "Not me — find another profile",
  "শিক্ষার্থীদের তালিকা লোড করা যায়নি। ইন্টারনেট সংযোগ চেক করুন।": "Couldn't load the student list. Check your internet connection.",
  "আইডি": "ID",

  /* ---------- shared header / nav / menu ---------- */
  "হোম": "Home", "ক্যালেন্ডার": "Calendar", "স্টাডি": "Study", "লিডারবোর্ড": "Leaderboard",
  "উন্নতি": "Improve", "প্রোফাইল": "Profile", "প্রধান মেনু": "Main menu", "মেনু": "Menu",
  "লোড হচ্ছে": "Loading", "লোড হচ্ছে...": "Loading...", "লোড হচ্ছে…": "Loading…",
  "ইতিহাস": "History", "অ্যাটেনডেন্স QR": "Attendance QR", "ক্লাসে অ্যাডমিনকে স্ক্যান করাও": "Let the admin scan it in class",
  "ইনভাইট QR": "Invite QR", "বন্ধু স্ক্যান করলেই XP": "XP when a friend scans it",
  "অ্যাটেনডেন্স হিস্ট্রি": "Attendance history", "উপস্থিতির শতাংশ": "Attendance percentage",
  "পছন্দ": "Preferences", "থিম সেটিংস খোলো": "Open theme settings", "ডার্ক মোড": "Dark mode",
  "ডার্ক মোডে যাও": "Switch to dark mode", "লাইট মোডে যাও": "Switch to light mode",
  "সবসময় লাইট": "Always light", "সবসময় ডার্ক": "Always dark", "সময় অনুযায়ী": "By schedule",
  "পরীক্ষার টাইমার": "Exam timer", "পরীক্ষার টাইমার দেখাও বা লুকাও": "Show or hide the exam timer",
  "প্রধান পেজে ফিরুন": "Back to the main page", "লগআউট": "Log out", "লগআউট করবে?": "Log out?",
  "QR খোলা যায়নি": "Couldn't open the QR", "কোনো তথ্য পাওয়া যায়নি।": "No data found.",
  "একটি সমস্যা হয়েছে।": "Something went wrong.", "অপেক্ষা করুন...": "Please wait...",
  "নোটিফিকেশন": "Notifications", "সব মুছো": "Clear all", "সব দেখা শেষ!": "You're all caught up!",
  "এখন কোনো নতুন notification নেই।": "No new notifications.",

  /* ---------- errors (ui-utils) ---------- */
  "পাসওয়ার্ড সঠিক নয়।": "Incorrect password.", "এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।": "No account found for this email.",
  "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।": "Too many attempts. Please try again in a while.",
  "ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না।": "No internet connection.", "এই তথ্য দেখার অনুমতি নেই।": "You don't have permission to view this.",
  "সার্ভারের সাথে সংযোগ করা যাচ্ছে না। পরে আবার চেষ্টা করুন।": "Can't reach the server. Please try again later.",
  "একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।": "Something went wrong. Please try again.",
  "ইন্টারনেট সংযোগ নেই।": "No internet connection.", "কিছু একটা ভুল হয়েছে।": "Something went wrong.",
  "অনেকবার ভুল হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করো।": "Too many wrong attempts. Try again in a while.",
  "PIN ঠিক ৬ সংখ্যার হতে হবে।": "The PIN must be exactly 6 digits.",
  "একই সংখ্যা বারবার দেওয়া যাবে না (যেমন 111111)।": "Don't repeat the same digit (e.g. 111111).",
  "পরপর সংখ্যা দেওয়া যাবে না (যেমন 123456)।": "Don't use a sequence (e.g. 123456).",
  "আবার লগইন করো।": "Please sign in again.", "PIN ভুল, অথবা অ্যাডমিন এখনো তোমার সেটআপ কোড দেয়নি।": "Wrong PIN, or the admin hasn't given you a setup code yet.",
  "Firebase Console-এ Email/Password sign-in চালু করা হয়নি।": "Email/Password sign-in isn't enabled in the Firebase Console.",

  /* ---------- notifications (ui-utils) ---------- */
  "মাসিক টপার": "Monthly topper", "ক্লাস মাসিক টপার": "Class monthly topper", "সাপ্তাহিক টপার": "Weekly topper",
  "ক্লাস সাপ্তাহিক টপার": "Class weekly topper", "পরীক্ষার টপার": "Exam topper", "নতুন বার্তা": "New message",
  "বার্তা মুছে ফেলা হয়েছে": "Message deleted", "আজ": "Today", "গতকাল": "Yesterday", "আজ,": "Today,", "গতকাল,": "Yesterday,",
  "এইমাত্র": "Just now", "মিনিট আগে": "min ago", "ঘণ্টা আগে": "h ago", "দিন আগে": "d ago",
  "পরবর্তী পরীক্ষা": "Next exam", "একজন বন্ধু": "A friend", "তোমাকে একটি বার্তা পাঠিয়েছে": "sent you a message",
  "গ্রুপ চ্যাট": "Group chat", "নতুন গ্রুপ": "New group", "একজন শিক্ষার্থী": "A student", "পরীক্ষা": "Exam",
  "একটি বিষয়": "a subject", "তোমাকে friend request পাঠিয়েছে": "sent you a friend request",
  "এই request গ্রহণ করলে তোমরা friend list-এ যুক্ত হবে।": "If you accept, you'll be added to each other's friend lists.",
  "গ্রহণ": "Accept", "প্রত্যাখ্যান": "Decline", "মুছুন": "Delete", "তোমার challenge গ্রহণ করেছে": "accepted your challenge",
  "পরীক্ষা:": "Exam:", "দেখো": "View", "তোমার লিংকে জয়েন করে অ্যাকাউন্ট চালু করেছে।": "joined through your link and activated their account.",
  "অনুশীলন সম্পন্ন হয়েছে": "Practice completed", "অনুশীলন করে উন্নতি করো।": "Practice to improve.",
  "শুরু করো": "Start", "তোমাকে challenge করেছে": "challenged you",
  "Friend request গ্রহণ করা হয়েছে।": "Friend request accepted.", "Friend request প্রত্যাখ্যান করা হয়েছে।": "Friend request declined.",
  "Challenge গ্রহণ করা হয়েছে।": "Challenge accepted.", "Challenge প্রত্যাখ্যান করা হয়েছে।": "Challenge declined.",

  /* ---------- attendance QR / invite sheets ---------- */
  "আমার অ্যাটেনডেন্স QR": "My attendance QR", "ক্লাস বা পরীক্ষায় অ্যাডমিনকে স্ক্যান করতে দাও": "Let the admin scan it in class or at exams",
  "বন্ধ করো": "Close", "স্ক্যান হলেই সেই দিনের উপস্থিতি জমা হবে। QR অন্য কাউকে পাঠিও না।": "Once scanned, that day's attendance is recorded. Don't send your QR to anyone.",
  "অ্যাটেনডেন্স হিস্ট্রি ও শতাংশ দেখো ›": "See attendance history & percentage ›", "QR তৈরি করা যায়নি।": "Couldn't create the QR.",
  "আমার সাথে পরীক্ষার প্রস্তুতিতে যুক্ত হও:": "Join me in exam preparation:", "লিংক কপি হয়েছে": "Link copied",
  "কপি করা যায়নি": "Couldn't copy", "যুক্ত হও": "Join", "লিংক কপি হয়েছে — যেকোনো জায়গায় পেস্ট করো": "Link copied — paste it anywhere",
  "শেয়ার সাপোর্ট নেই — লিংক কপি করো": "Sharing isn't supported — copy the link", "আমার ইনভাইট QR": "My invite QR",
  "বন্ধু স্ক্যান করলেই তোমার সাথে যুক্ত হবে": "Your friend joins you as soon as they scan it",
  "বন্ধুর ফোনের": "Ask your friend to scan this QR with their phone's", "ক্যামেরা": "camera",
  "দিয়ে এই QR স্ক্যান করতে বলো (বা লিংক পাঠাও)।": "(or send them the link).",
  "সে নতুন অ্যাকাউন্টের আবেদন করবে, তোমার রেফারেল": "They apply for a new account and your referral",
  "আপনা-আপনি": "is added automatically", "বসে যাবে।": ".", "অ্যাডমিন অনুমোদন করলেই তোমার অ্যাকাউন্টে": "Once the admin approves, it's added to your account:",
  "জমা হবে।": "", "শেয়ার করো": "Share", "লিংক কপি": "Copy link", "লিংক কপি করে শেয়ার করো।": "Copy the link and share it.",

  /* ---------- exam alerts / claim / install ---------- */
  "তোমার এই পরীক্ষাটি এখনও পেন্ডিং।": "You still haven't taken this exam.", "৭ দিনের বোনাস": "7-day bonus",
  "এখনই পরীক্ষা দাও": "Take the exam now", "পরে দেখব": "Later", "এই পরীক্ষায় তুমি সবার সেরা": "You topped this exam",
  "কার্ড তোমার স্টোরে জমা হয়েছে": "card added to your store", "ফ্রি কার্ড ক্লেইম করো": "Claim your free card",
  "এই পরীক্ষার জন্য ১টি র‍্যান্ডম কার্ড ফ্রি। পরীক্ষায় সবার সেরা হলে পাবে ২টি।": "1 random card is free for this exam. Finish first and you get 2.",
  "ক্লেইম করো": "Claim", "খোলা হচ্ছে...": "Opening...", "এই পরীক্ষার ফলাফল পাওয়া যায়নি।": "No result found for this exam.",
  "ক্লেইম করা যায়নি, আবার চেষ্টা করো।": "Couldn't claim — try again.", "ফোনে অ্যাপ হিসেবে ইনস্টল করো": "Install as an app on your phone",
  "লুকাও": "Hide", "XP পেনাল্টি": "XP penalty", "বুঝেছি": "Got it", "XP কাটা হয়েছে": "XP deducted",
  "লিডারবোর্ড দেখো": "View leaderboard", "পরীক্ষা বাকি আছে": "Exam pending",
  "এক্সট্রা বোনাস পাবে।": "You'll get an extra bonus.",
  "লিডারবোর্ডসহ সব পেজে তোমার XP আপডেট হয়ে গেছে। পরের পরীক্ষাগুলো সময়মতো দিলে বোনাস XP দিয়ে এটা পুষিয়ে নিতে পারবে।": "Your XP is updated on every page including the leaderboard. Take future exams on time to earn bonus XP and make it up.",

  /* ---------- dashboard ---------- */
  "ড্যাশবোর্ড — পরীক্ষা প্রস্তুতি": "Dashboard — Exam Preparation",
  "বিশ্লেষণ": "Analytics", "তুলনা": "Compare", "ব্যাটল মোড": "Battle Mode", "XP স্টোর": "XP Store",
  "অ্যাটেনডেন্স": "Attendance", "অ্যাটেনডেন্স QR বড় করে দেখো": "Enlarge attendance QR", "হিস্ট্রি ও মাসিক র‍্যাঙ্ক": "History & monthly rank",
  "QR নেই": "No QR", "দিন উপস্থিত": "days present", "এখনো কোনো দিন সেট হয়নি।": "No class days set yet.",
  "ক্লাসে QR টি অ্যাডমিনকে স্ক্যান করাও।": "Let the admin scan your QR in class.", "উপস্থিতি লোড করা যায়নি।": "Couldn't load attendance.",
  "দিন": "d", "পরের পরীক্ষার টাইমার": "Next exam timer", "পরের পরীক্ষা:": "Next exam:",
  "চলমান পরীক্ষা": "Ongoing exams", "এখন কোনো পরীক্ষা চালু নেই।": "No exams are running right now.",
  "ফলাফল দেখুন": "View result", "জমা দেওয়া হয়েছে — অনুমোদনের অপেক্ষায়।": "Submitted — awaiting approval.",
  "শুরু হবে": "Starts", "পরীক্ষা শুরু করুন": "Start exam", "স্পেশাল": "Special", "প্রকাশিত": "Published", "আসন্ন": "Upcoming",
  "তারিখ": "Date", "সময়": "Time", "প্রশ্ন": "Questions", "মি.": "min", "শেষ তারিখ:": "Deadline:", "(৭ দিন সময়)": "(7 days)",
  "এই পরীক্ষায় সর্বোচ্চ XP": "Max XP for this exam", "উন্নতি ও ধারাবাহিকতা বোনাস আলাদা": "Improvement & streak bonuses are separate",
  "আজ দিলে এক্সট্রা বোনাস": "Extra bonus if you take it today",
  "তথ্য লোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করো।": "Couldn't load data. Check your internet and try again.",
  "তুমিই এখন লিডারবোর্ডের শীর্ষে।": "You're at the top of the leaderboard.",
  "তোমার XP ও লেভেল": "Your XP & level", "সর্বমোট XP": "Total XP", "খরচযোগ্য ব্যালেন্স": "Spendable balance",
  "লেভেল": "Level", "র‍্যাঙ্ক": "Rank", "পরীক্ষা দিয়েছ": "Exams taken", "গড় স্কোর": "Avg. score",
  "তুমি সর্বোচ্চ লেভেলে পৌঁছে গেছো।": "You've reached the highest level.", "সাম্প্রতিক পরীক্ষা ও XP": "Recent exams & XP",
  "শেষ পরীক্ষায়": "Last exam", "XP দরকার।": "more XP.",
});
__I18N_P(/^(\d+)\/(\d+) দিন উপস্থিত$/, "$1/$2 days present");
__I18N_P(/^(\d+) জন শিক্ষার্থী ·$/, "$1 students ·");
__I18N_P(/^(\d+) জন$/, "$1");
__I18N_P(/^(\d+) জন শিক্ষার্থী · (\d+) টি ব্যাচ$/, "$1 students · $2 batches");
__I18N_P(/^লেভেল (\d+), পরের লেভেলের (\d+)% সম্পন্ন$/, "Level $1, $2% to the next level");
__I18N_P(/^লেভেল (\d+)-এ যেতে আর$/, "To reach Level $1 you need");
__I18N_P(/^ XP দরকার।$/, " more XP.");
__I18N_P(/^শীর্ষে আছে (.+) — তার থেকে$/, "$1 is on top — you're");
__I18N_P(/^XP পিছিয়ে।$/, "XP behind.");
__I18N_P(/^খরচযোগ্য ব্যালেন্স$/, "Spendable balance");
__I18N_P(/^\(খরচ হয়েছে (.+)\)$/, "(spent $1)");
__I18N_P(/^শুরু হবে (.+)$/, "Starts $1");
__I18N_P(/^(\d+) দিন (.+)$/, "$1d $2");
__I18N_P(/^(\d+) মি\.$/, "$1 min");
__I18N_P(/^(\d+)ম দিন · যত দেরি তত কম, (\d+) দিনে শেষ$/, "Day $1 · the later you take it, the lower it gets; ends in $2 days");
__I18N_P(/^(\d+) মিনিট আগে$/, "$1 min ago");
__I18N_P(/^(\d+) ঘণ্টা আগে$/, "$1 h ago");
__I18N_P(/^(\d+) দিন আগে$/, "$1 d ago");
__I18N_P(/^(\d+)টি নোটিফিকেশন$/, "$1 notification(s)");
__I18N_P(/^(.+) তোমাকে একটি বার্তা পাঠিয়েছে$/, "$1 sent you a message");
__I18N_P(/^(\d+) টি পরীক্ষা$/, "$1 exam(s)");
__I18N_P(/^(\d+) দিন বাকি$/, "$1 days left");
__I18N_P(/^(\d+) দিন সময় আছে$/, "$1 days left");
__I18N_P(/^(\d+) বার চেষ্টা করা যাবে\)$/, "$1 tries left)");
__I18N_P(/^\(আর (\d+)$/, "($1 more");
__I18N_P(/^(\d+) সংখ্যার PIN$/, "$1-digit PIN");
__I18N_P(/^রেফারেল সফল! \+(\d+)$/, "Referral successful! +$1");
