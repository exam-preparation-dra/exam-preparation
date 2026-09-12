/* =========================================================
   IMAGE URL UTILITIES — link-based question images (no Firebase Storage)
   Admin pastes a Google Drive share link (or any direct image URL) instead
   of uploading a file. This avoids Firebase Storage entirely — no Blaze
   plan, no storage quota, no upload step. The tradeoff: the admin must set
   the Drive file's sharing to "Anyone with the link" or the image won't
   load for students.
   ========================================================= */

// Recognizes common Google Drive share link shapes and rewrites them into
// a directly-embeddable image URL. Anything else (a normal direct image
// URL, an imgur link, etc.) is returned unchanged.
export function toDirectImageUrl(rawUrl) {
  const url = (rawUrl || "").trim();
  if (!url) return null;

  // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  let match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;

  // https://drive.google.com/open?id=FILE_ID  or  ...&id=FILE_ID
  match = url.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;

  // Already a direct Drive uc?id= link, or any other direct image URL —
  // leave as-is.
  return url;
}

/* =========================================================
   IMGBB UPLOAD (with guided recovery) — shared by both the student-photo
   uploader (students.html) and the question-image uploader (questions.html)
   so there's exactly one working copy instead of two similar-but-different
   ones. A default key is hardcoded so uploads "just work" with no setup;
   if that key ever stops working (revoked, over quota), the admin gets a
   clear popup explaining what happened and a place to paste a new free
   key — which is then remembered for next time.
   ========================================================= */
const IMGBB_KEY_OVERRIDE_STORAGE = "imgbb_api_key_override";
const IMGBB_DEFAULT_KEY = "da5159865f56c01745a35e83e0ed9104";

function getImgbbKey() {
  return localStorage.getItem(IMGBB_KEY_OVERRIDE_STORAGE) || IMGBB_DEFAULT_KEY;
}

export function setImgbbKeyOverride(key) {
  localStorage.setItem(IMGBB_KEY_OVERRIDE_STORAGE, (key || "").trim());
}

async function tryImgbbUpload(file, apiKey) {
  const formData = new FormData();
  formData.append("image", file);
  let res;
  try {
    res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, { method: "POST", body: formData });
  } catch {
    throw new Error("ইন্টারনেট সংযোগ সমস্যা — আপলোড পাঠানোই যায়নি।");
  }
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok || !data?.data?.url) {
    throw new Error(data?.error?.message || `আপলোড ব্যর্থ হয়েছে (status ${res.status})। key ভুল বা মেয়াদোত্তীর্ণ হতে পারে।`);
  }
  return data.data.url;
}

// Shows a guided popup explaining the failure and asking for a fresh key.
// Resolves with the new key (already saved) or null if the admin cancelled.
function promptForNewImgbbKey(reasonMessage) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";
    overlay.innerHTML = `
      <div class="glass card" style="max-width:420px;width:100%;">
        <p style="font-weight:700;margin-bottom:6px;">ছবি আপলোড ব্যর্থ হয়েছে</p>
        <p class="text-xs text-muted mb-2">${reasonMessage || "বর্তমান ইমেজ-আপলোড key কাজ করছে না।"}</p>
        <p class="text-xs text-muted mb-2">একটা নতুন ফ্রি ImgBB API key দিন — <a href="https://api.imgbb.com/" target="_blank" rel="noopener" style="color:#ff6a2b;">api.imgbb.com</a>-এ গিয়ে ফ্রি সাইন-আপ করে key নিতে পারবেন।</p>
        <input type="text" id="imgbbKeyInput" class="input" placeholder="নতুন ImgBB API key পেস্ট করুন" style="width:100%;">
        <div class="flex gap-2 mt-3">
          <button type="button" class="btn btn-secondary" id="imgbbKeyCancel" style="flex:1;">বাতিল (লিংক পেস্ট করব)</button>
          <button type="button" class="btn btn-primary" id="imgbbKeySave" style="flex:1;">সেভ করে আবার চেষ্টা করুন</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#imgbbKeyCancel").addEventListener("click", () => { overlay.remove(); resolve(null); });
    overlay.querySelector("#imgbbKeySave").addEventListener("click", () => {
      const val = overlay.querySelector("#imgbbKeyInput").value.trim();
      overlay.remove();
      if (!val) { resolve(null); return; }
      setImgbbKeyOverride(val);
      resolve(val);
    });
  });
}

// The one function callers should use: tries the current key, and if that
// fails, guides the admin through providing a new one and retries once.
// Throws only if the admin cancels the guided popup, or the retry also fails.
export async function uploadImageWithGuidedFallback(file) {
  try {
    return await tryImgbbUpload(file, getImgbbKey());
  } catch (err) {
    const newKey = await promptForNewImgbbKey(err.message);
    if (!newKey) throw err;
    return await tryImgbbUpload(file, newKey);
  }
}
