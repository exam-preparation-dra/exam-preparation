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
   DIRECT IMAGE UPLOAD (ImgBB) — an alternative to pasting a Google
   Drive link. Google Drive's uc?export=view hotlink is unreliable
   (blocks/rate-limits image embeds even with correct sharing), so this
   uploads the photo straight from the phone to ImgBB's free image host
   and gets back a permanent, embed-friendly URL — same "admin supplies
   their own free API key, stored client-side only" pattern already used
   for the Gemini key elsewhere in this app.
   Get a free key at: https://api.imgbb.com/  (just needs a free account)
   ========================================================= */
const IMGBB_KEY_STORAGE = "examPrepImgbbApiKey";

export function getImgbbApiKey() {
  return localStorage.getItem(IMGBB_KEY_STORAGE) || "";
}
export function setImgbbApiKey(key) {
  localStorage.setItem(IMGBB_KEY_STORAGE, (key || "").trim());
}

// file: a browser File object (from <input type="file">).
// Returns the hosted image URL on success; throws a Bengali error message on failure.
export async function uploadImageToImgbb(file, apiKey) {
  if (!apiKey) throw new Error("ImgBB API key দেওয়া হয়নি।");
  if (!file) throw new Error("কোনো ছবি বাছাই করা হয়নি।");

  const formData = new FormData();
  formData.append("image", file);

  let res;
  try {
    res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      body: formData
    });
  } catch {
    throw new Error("আপলোড ব্যর্থ — ইন্টারনেট সংযোগ চেক করো।");
  }

  let data;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok || !data?.data?.url) {
    const msg = data?.error?.message || `আপলোড ব্যর্থ (${res.status})`;
    if (res.status === 400 && /key/i.test(msg)) throw new Error("ImgBB API key ভুল — সঠিক key দিয়ে আবার চেষ্টা করো।");
    throw new Error(msg);
  }
  return data.data.url;
}
