/* =========================================================
   FIREBASE CONFIGURATION
   =========================================================
   >>> এখানে আপনার নিজের Firebase project configuration paste করুন <<<

   Firebase Console → Project Settings → General → Your apps → SDK config
   থেকে এই object copy করে নিচে paste করুন।

   এই ফাইলে কোনো real credential আগে থেকে বসানো নেই — placeholder আছে।
   ========================================================= */

// TODO: এই object টি আপনার নিজের Firebase config দিয়ে replace করুন
const firebaseConfig = {
  apiKey: "AIzaSyCfhlXO9EKShin5x7GHNHic2UQcIJGeCvQ",
  authDomain: "exam-preparation-dra.firebaseapp.com",
  projectId: "exam-preparation-dra",
  storageBucket: "exam-preparation-dra.firebasestorage.app",
  messagingSenderId: "426879208763",
  appId: "1:426879208763:web:fd20bd7523661c32c77b1e"
};

// Firebase SDK (CDN, modular v10) — index.html / admin pages এ type="module" হিসেবে import হয়
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Offline persistence — exam চলাকালীন internet চলে গেলেও data হারাবে না (requirement #51)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // একাধিক ট্যাব খোলা থাকলে persistence শুধু একটি ট্যাবে কাজ করবে — সমস্যা নয়, শুধু log
    console.warn("Offline persistence: একাধিক ট্যাব খোলা আছে।");
  } else if (err.code === "unimplemented") {
    console.warn("এই ব্রাউজার offline persistence সমর্থন করে না।");
  }
});

export { app, db, auth, storage };
