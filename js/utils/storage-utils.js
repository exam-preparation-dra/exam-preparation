/* =========================================================
   STORAGE UTILITIES — question images
   ========================================================= */
import { storage } from "../firebase/firebase-config.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

// ---------- Upload a question image, returns public download URL ----------
export async function uploadQuestionImage(file, questionIdHint) {
  const safeName = `${questionIdHint}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
  const storageRef = ref(storage, `question-images/${safeName}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ---------- Delete a previously uploaded image (best-effort, non-blocking) ----------
export async function deleteQuestionImage(imageUrl) {
  if (!imageUrl) return;
  try {
    const storageRef = ref(storage, imageUrl);
    await deleteObject(storageRef);
  } catch {
    // Non-fatal — the URL may already be gone or from an external source.
  }
}

// ---------- Upload a student profile photo, returns public download URL ----------
// Same pattern as uploadQuestionImage above — real Firebase Storage upload,
// no third-party service, no API key needed.
export async function uploadStudentPhoto(file, studentIdHint) {
  const safeName = `${studentIdHint}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
  const storageRef = ref(storage, `student-photos/${safeName}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ---------- Delete a previously uploaded student photo (best-effort, non-blocking) ----------
export async function deleteStudentPhoto(photoUrl) {
  if (!photoUrl) return;
  try {
    const storageRef = ref(storage, photoUrl);
    await deleteObject(storageRef);
  } catch {
    // Non-fatal — the URL may already be gone or from an external source.
  }
}
