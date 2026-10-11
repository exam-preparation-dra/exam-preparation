/* =========================================================
   GOOGLE DRIVE LINK HELPERS (study notes)
   The admin keeps the PDF in his own Google Drive (share: "Anyone with the
   link → Viewer") and pastes the link. Nothing is uploaded to Firebase, so
   it works on the free Spark plan. We only turn the share link into the
   official Drive *preview* URL that can be shown in an iframe.
   Pure module: no Firebase imports.
   ========================================================= */

const ID = "[A-Za-z0-9_-]{15,}";

// Share link -> { id, kind } | null.  kind: "file" | "document" | "presentation" | "spreadsheets"
// Folder links are rejected on purpose (a folder can't be previewed as one note).
export function parseDriveLink(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") return null;
  if (/\/folders\//.test(u.pathname) || /\/drive\/(u\/\d+\/)?folders/.test(u.pathname)) return null;

  const docs = u.pathname.match(new RegExp(`^/(document|presentation|spreadsheets)/d/(${ID})`));
  if (docs && host === "docs.google.com") return { id: docs[2], kind: docs[1] };

  const file = u.pathname.match(new RegExp(`/file/d/(${ID})`));
  if (file) return { id: file[1], kind: "file" };

  const q = u.searchParams.get("id");
  if (q && new RegExp(`^${ID}$`).test(q)) return { id: q, kind: "file" };
  return null;
}

// Iframe-able preview URL.
export function drivePreviewUrl({ id, kind = "file" }) {
  if (kind === "file") return `https://drive.google.com/file/d/${id}/preview`;
  return `https://docs.google.com/${kind}/d/${id}/preview`;
}

// Normal "open in Drive" URL (new tab fallback).
export function driveOpenUrl({ id, kind = "file" }) {
  if (kind === "file") return `https://drive.google.com/file/d/${id}/view`;
  return `https://docs.google.com/${kind}/d/${id}/edit`;
}

// A saved material -> { preview, open } (supports old materials that only had `pdfUrl`).
export function materialLinks(m) {
  if (m && m.driveId) {
    const ref = { id: m.driveId, kind: m.driveKind || "file" };
    return { preview: drivePreviewUrl(ref), open: driveOpenUrl(ref) };
  }
  const old = String(m?.pdfUrl || "");
  if (/^https?:\/\//i.test(old)) {
    const p = parseDriveLink(old);
    return p ? { preview: drivePreviewUrl(p), open: driveOpenUrl(p) } : { preview: old, open: old };
  }
  return { preview: "", open: "" };
}
