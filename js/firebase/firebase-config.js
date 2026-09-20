/* =========================================================
   FIREBASE CONFIGURATION
   =========================================================
   Physics Lover - Teacher 2 Project
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCQG23Rle-VaWgEtcKj4KuxiAZfsZnn79s",
  authDomain: "physicslover-16ee5.firebaseapp.com",
  projectId: "physicslover-16ee5",
  storageBucket: "physicslover-16ee5.firebasestorage.app",
  messagingSenderId: "960004318623",
  appId: "1:960004318623:web:d7adb915e4bfa541e9c9aa"
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
