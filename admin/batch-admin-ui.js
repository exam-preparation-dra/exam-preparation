/* =========================================================
   BATCH ADMIN UI
   - openBatchPicker(): small modal that sets ONLY an exam's target batch
     (used for old exams that still say "all")
   - renderBatchReviewAlert(): red alert listing exams that need a batch
   - renderBatchBalance(): per-batch exam count / total marks / pending
     section + recommendation for making batches equal
   ========================================================= */
import { setExamTargetBatch } from "./exam-utils.js";
import { computeBatchBalance, needsBatchReview, examMarks, examTargetBatch, batchChoices } from "./batch-utils.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bn = (n) => String(Math.round(Number(n) || 0)).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);

// ---------- modal ----------
export function openBatchPicker({ exam, students }) {
  return new Promise(resolve => {
    const choices = batchChoices(students);
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="custom-modal">
        <p style="font-weight:900;font-size:1.05rem;margin-bottom:4px;">কোন ব্যাচের পরীক্ষা?</p>
        <p style="font-size:.82rem;font-weight:700;color:var(--text-muted);margin-bottom:12px;line-height:1.5;">${esc(exam.name)} — শুধু ব্যাচ বদলাবে। প্রশ্ন, marks, ফলাফল কিছুই বদলাবে না।</p>
        <select id="bpSel" class="input-glass" style="margin-bottom:14px;">
          <option value="" disabled selected>— ব্যাচ নির্বাচন করুন —</option>
          ${choices.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join("")}
          <option value="all">সব ব্যাচ (shared)</option>
        </select>
        <div class="flex gap-2" style="justify-content:flex-end;">
          <button type="button" class="btn-glass" id="bpCancel" style="flex:1;">বাতিল</button>
          <button type="button" class="btn-primary" id="bpSave" style="flex:1;">সেভ করুন</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const done = (v) => { overlay.remove(); resolve(v); };
    overlay.querySelector("#bpCancel").addEventListener("click", () => done(null));
    overlay.querySelector("#bpSave").addEventListener("click", async (ev) => {
      const v = overlay.querySelector("#bpSel").value;
      if (!v) return;
      if (v === "all" && !await AppPopup.confirm("এই পরীক্ষা সব ব্যাচের জন্য থাকবে এবং সবার marks-এ যোগ হবে। নিশ্চিত?")) return;
      ev.target.disabled = true;
      try { await setExamTargetBatch(exam.id, v); done(v); }
      catch (err) { ev.target.disabled = false; AppPopup.alert(err.message || "সেভ করা যায়নি।", { type: "error" }); }
    });
  });
}

// ---------- alert ----------
// onChanged(): called after a batch was saved (reload your data)
export function renderBatchReviewAlert(el, exams, students, onChanged) {
  const list = (exams || []).filter(e => e.status !== "archived" && needsBatchReview(e));
  if (!el) return;
  if (!list.length) { el.innerHTML = ""; el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `
    <div style="border:1.5px solid rgba(239,68,68,.45);background:rgba(239,68,68,.08);border-radius:18px;padding:14px 14px 10px;margin-bottom:18px;">
      <p style="margin:0 0 4px;font-weight:900;color:#ef4444;font-size:.95rem;">⚠ ${bn(list.length)}টি পরীক্ষার ব্যাচ ঠিক করা নেই</p>
      <p style="margin:0 0 10px;font-size:.78rem;font-weight:700;color:var(--text-muted);line-height:1.5;">এগুলো এখন সব ব্যাচের শিক্ষার্থীর কাছে দেখাচ্ছে। প্রতিটির জন্য ব্যাচ বেছে দিন — শুধু ব্যাচ বদলাবে, প্রশ্ন ও ফলাফল একই থাকবে।</p>
      ${list.map(e => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid rgba(128,128,128,.18);">
          <div style="min-width:0;"><div style="font-weight:800;font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(e.name)}</div>
          <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);">${bn(examMarks(e))} marks · ${esc(e.status)}</div></div>
          <button class="btn-glass bp-open" data-id="${esc(e.id)}" style="padding:8px 12px;font-weight:800;font-size:.78rem;white-space:nowrap;">ব্যাচ ঠিক করুন</button>
        </div>`).join("")}
    </div>`;
  el.querySelectorAll(".bp-open").forEach(b => b.addEventListener("click", async () => {
    const exam = list.find(e => e.id === b.dataset.id);
    const picked = await openBatchPicker({ exam, students });
    if (picked && onChanged) onChanged(picked);
  }));
}

// ---------- balance section ----------
export function renderBatchBalance(el, exams, students, xpOf) {
  if (!el) return;
  const rep = computeBatchBalance(exams, students, xpOf);
  if (!rep.rows.length) { el.innerHTML = `<div class="stat-card" style="padding:16px;font-size:.85rem;font-weight:700;color:var(--text-muted);">কোনো ব্যাচ পাওয়া যায়নি।</div>`; return; }

  const badge = (r) => {
    if (r.isLeader && r.gapMarks === 0 && rep.rows.every(x => x.gapMarks === 0)) return `<span style="color:#10b981;">✔ সমান</span>`;
    if (r.gapMarks === 0) return `<span style="color:#10b981;">✔ এগিয়ে</span>`;
    if (r.status === "close") return `<span style="color:#f59e0b;">≈ প্রায় সমান</span>`;
    return `<span style="color:#ef4444;">−${bn(r.gapMarks)} marks পিছিয়ে</span>`;
  };

  const recos = rep.rows.filter(r => r.gapMarks > 0).map(r => {
    const parts = [];
    if (r.pendingCount > 0) parts.push(`${bn(r.pendingCount)}টি draft (${bn(r.pendingMarks)} marks) আগে publish করুন`);
    if (r.extraExamsNeeded > 0) parts.push(`আরও ${bn(r.extraExamsNeeded)}টি exam (প্রতিটি প্রায় ${bn(rep.avgExamMarks)} marks) বানান`);
    else if (r.afterDraftGap === 0 && r.pendingCount > 0) parts.push(`এতেই ${esc(rep.leaderBatch)} এর সমান হয়ে যাবে`);
    return `<li style="margin-bottom:6px;"><b>${esc(r.batch)}</b>: ${parts.join(" + ") || "কিছু বাকি নেই"}</li>`;
  });

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:.78rem;font-weight:700;min-width:430px;">
        <thead><tr style="text-align:left;color:var(--text-muted);font-size:.7rem;">
          <th style="padding:6px 4px;">ব্যাচ</th><th>শিক্ষার্থী</th><th>Exam</th><th>মোট marks</th><th>Max XP</th><th>Pending</th><th>অবস্থা</th>
        </tr></thead>
        <tbody>
        ${rep.rows.map(r => `
          <tr style="border-top:1px solid rgba(128,128,128,.18);">
            <td style="padding:9px 4px;font-weight:900;">${esc(r.batch)}${r.isLeader ? " 👑" : ""}</td>
            <td>${bn(r.students)}</td>
            <td>${bn(r.totalLiveCount)}${r.shared.liveCount ? `<small style="opacity:.6"> (shared ${bn(r.shared.liveCount)})</small>` : ""}</td>
            <td>${bn(r.totalLiveMarks)}</td>
            <td>${bn(r.totalLiveXP)}</td>
            <td>${r.pendingCount ? `${bn(r.pendingCount)}টি · ${bn(r.pendingMarks)} marks` : "—"}</td>
            <td>${badge(r)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${rep.unassigned.liveCount + rep.unassigned.draftCount > 0 ? `
      <p style="margin:12px 0 0;font-size:.78rem;font-weight:800;color:#ef4444;">⚠ ব্যাচ ঠিক করা নেই: ${bn(rep.unassigned.liveCount)}টি live + ${bn(rep.unassigned.draftCount)}টি draft (${bn(rep.unassigned.liveMarks + rep.unassigned.draftMarks)} marks)। এগুলো উপরের হিসাবে ধরা হয়নি — আগে ব্যাচ ঠিক করুন।</p>` : ""}
    <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(128,128,128,.07);border:1px solid rgba(128,128,128,.18);">
      <p style="margin:0 0 6px;font-weight:900;font-size:.85rem;">কী করা উচিত (সুপারিশ)</p>
      ${recos.length ? `<ul style="margin:0;padding-left:18px;font-size:.78rem;font-weight:700;line-height:1.55;">${recos.join("")}</ul>
      <p style="margin:8px 0 0;font-size:.72rem;font-weight:700;color:var(--text-muted);line-height:1.55;">কম marks-এর ব্যাচকে এগিয়ে থাকা ব্যাচের সমান করুন (${esc(rep.leaderBatch)}: ${bn(rep.leaderMarks)} marks)। এগিয়ে থাকা ব্যাচের exam কমাবেন না — তাতে ওই ব্যাচের শিক্ষার্থীর XP অন্যায্যভাবে কমে যায়। ভবিষ্যতে প্রতিটি ব্যাচের জন্য একই সপ্তাহে একই marks-এর exam দিন।</p>`
      : `<p style="margin:0;font-size:.78rem;font-weight:700;color:#10b981;">সব ব্যাচের marks সমান আছে। ভবিষ্যতেও প্রতিটি ব্যাচে একই marks-এর exam দিন।</p>`}
    </div>`;
}
