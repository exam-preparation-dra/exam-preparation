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
