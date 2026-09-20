/* ============================================================
   FIREBASE CONFIGURATION
   ============================================================
   EXAM PREPARATION
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyCfhlXO9EKShin5x7GHNHic2UQcIJGeCvQ",
  authDomain: "exam-preparation-dra.firebaseapp.com",
  projectId: "exam-preparation-dra",
  storageBucket: "exam-preparation-dra.firebasestorage.app",
  messagingSenderId: "426879208763",
  appId: "1:426879208763:web:fd20bd7523661c32c77b1e"
};


// Firebase SDK
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";

import {
  getFirestore,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";


// Initialize Firebase
const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);


// Offline persistence
// Exam চলাকালীন internet চলে গেলেও cached data ব্যবহার করতে পারবে।
enableIndexedDbPersistence(db).catch((err) => {

  if (err.code === "failed-precondition") {
    console.warn(
      "Offline persistence: একাধিক ট্যাব খোলা আছে"
    );

  } else if (err.code === "unimplemented") {
    console.warn(
      "এই ব্রাউজার offline persistence সমর্থন করে না"
    );
  }

});


// Export Firebase services
export {
  app,
  db,
  auth,
  storage
};
