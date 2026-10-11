/* attendance-sheet.js — the student's personal "অ্যাটেনডেন্স QR" bottom sheet.
   Used by the avatar menu and the dashboard. Self-contained: injects its own CSS. */
import { qrDataUrl } from "./qr-utils.js";
import { attendanceQrText } from "./attendance-utils.js";
import { normalizeBatch } from "./batch-utils.js";

const STYLE_ID = "attSheetCss";
const CSS = `
.ats-ov{position:fixed;inset:0;z-index:200;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,18,10,.55);opacity:0;transition:opacity .2s}
.ats-ov.in{opacity:1}
.ats{width:min(100%,440px);max-height:94vh;overflow:auto;background:var(--surface-solid,#fff);color:var(--text-primary,#21262f);border-radius:26px 26px 0 0;padding:10px 20px calc(22px + env(safe-area-inset-bottom));transform:translateY(40px);transition:transform .28s cubic-bezier(.22,1,.36,1);box-shadow:0 -12px 40px rgba(0,0,0,.2);text-align:center}
.ats-ov.in .ats{transform:none}
@media(min-width:600px){.ats-ov{align-items:center}.ats{border-radius:26px;padding-bottom:22px}}
.ats-grab{width:40px;height:4px;border-radius:4px;background:var(--surface-border,#ddd);margin:0 auto 14px}
.ats-top{display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left}
.ats-top h3{font-size:1.1rem;font-weight:800;margin:0}
.ats-top p{font-size:.76rem;font-weight:600;color:var(--text-muted,#8d94a0);margin:3px 0 0}
.ats-x{width:34px;height:34px;border-radius:50%;border:1px solid var(--surface-border,#ddd);background:transparent;color:var(--text-secondary,#555);font-size:1rem;cursor:pointer;flex:none}
.ats-qr{margin:16px auto 0;width:min(78vw,260px);aspect-ratio:1;padding:14px;border-radius:24px;background:#fff;border:1px solid var(--surface-border,#ddd);display:grid;place-items:center}
.ats-qr img{display:block;width:100%;height:100%;image-rendering:pixelated}
.ats-name{margin-top:14px;font-size:1.05rem;font-weight:800}
.ats-id{margin-top:2px;font-family:var(--font-num,monospace);font-weight:700;font-size:.8rem;letter-spacing:.08em;color:var(--text-muted,#8d94a0)}
.ats-batch{display:inline-block;margin-top:8px;padding:3px 12px;border-radius:99px;background:var(--color-accent-soft,#f4ead8);color:var(--color-accent,#b8863c);font-size:.74rem;font-weight:800}
.ats-hint{margin:14px 0 0;font-size:.78rem;font-weight:600;color:var(--text-secondary,#5b6270);line-height:1.6}
.ats-link{display:flex;align-items:center;justify-content:center;gap:7px;min-height:46px;margin-top:14px;border-radius:14px;border:1px solid var(--surface-border,#ddd);background:var(--surface-solid,#fff);color:var(--text-primary,#21262f);font:inherit;font-weight:800;font-size:.86rem;text-decoration:none}
.ats-link:active{background:var(--surface-highlight,#faf9f5)}
`;

export async function attendanceQrImage(student, size = 512) {
  try { return qrDataUrl(attendanceQrText(student), size, "Q"); } catch (e) { console.error("QR failed", e); return ""; }
}

export function openAttendanceSheet(student, { historyHref = "../student/attendance.html" } = {}) {
  if (!student) return;
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style"); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
  }
  document.querySelector(".ats-ov")?.remove();
  const clean = (s) => String(s ?? "").replace(/[<>&"']/g, "");
  const batch = normalizeBatch(student.className);
  const ov = document.createElement("div");
  ov.className = "ats-ov";
  ov.innerHTML = `
    <div class="ats" role="dialog" aria-modal="true" aria-label="অ্যাটেনডেন্স QR">
      <div class="ats-grab"></div>
      <div class="ats-top">
        <div><h3>আমার অ্যাটেনডেন্স QR</h3><p>ক্লাস বা পরীক্ষায় অ্যাডমিনকে স্ক্যান করতে দাও</p></div>
        <button type="button" class="ats-x" aria-label="বন্ধ করো">✕</button>
      </div>
      <div class="ats-qr"><div class="spinner"></div></div>
      <div class="ats-name">${clean(student.name)}</div>
      <div class="ats-id">${clean(student.studentId)}</div>
      ${batch ? `<span class="ats-batch">${clean(batch)}</span>` : ""}
      <p class="ats-hint">স্ক্যান হলেই সেই দিনের উপস্থিতি জমা হবে। QR অন্য কাউকে পাঠিও না।</p>
      ${historyHref ? `<a class="ats-link" href="${historyHref}">অ্যাটেনডেন্স হিস্ট্রি ও শতাংশ দেখো ›</a>` : ""}
    </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add("in"));
  const close = () => { ov.classList.remove("in"); setTimeout(() => ov.remove(), 220); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".ats-x").onclick = close;
  attendanceQrImage(student).then(url => {
    const box = ov.querySelector(".ats-qr");
    if (box) box.innerHTML = url ? `<img src="${url}" alt="অ্যাটেনডেন্স QR">` : `<span style="font-size:.78rem;color:var(--text-muted)">QR তৈরি করা যায়নি।</span>`;
  });
}
