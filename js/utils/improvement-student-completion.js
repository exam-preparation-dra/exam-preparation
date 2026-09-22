/* Physics Lover 2.0
 * Improvement Student Integration
 * Connects the improved attempt lifecycle with the existing student profile.
 */

import { getActiveStudent } from "./student-utils.js";
import { completeImprovementAttempt } from "./improvement-test-completion.js";

function getNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function finalizeStudentImprovement({
  attemptId,
  testId,
  requestId = null,
  correct = 0,
  total = 0,
  accuracy = 0,
  improvementPercent = 0,
  xpEarned = 0,
  targetReached = false
}) {
  const student = await getActiveStudent();

  if (!student?.studentId) {
    throw new Error("সক্রিয় শিক্ষার্থীর তথ্য পাওয়া যায়নি।");
  }

  const result = {
    correct: getNumber(correct),
    total: getNumber(total),
    accuracy: getNumber(accuracy),
    improvementPercent: getNumber(improvementPercent),
    xpEarned: getNumber(xpEarned),
    targetReached: Boolean(targetReached)
  };

  const completed = await completeImprovementAttempt({
    attemptId,
    testId,
    studentId: student.studentId,
    requestId,
    result
  });

  window.dispatchEvent(
    new CustomEvent("improvement:completed", {
      detail: {
        ...completed,
        result
      }
    })
  );

  return completed;
}

export function showImprovementCompletionSummary({
  accuracy = 0,
  improvementPercent = 0,
  xpEarned = 0,
  targetReached = false
}) {
  const box = document.querySelector("#improvementCompletionSummary");
  if (!box) return;

  box.innerHTML = `
    <section class="improvement-completion-card">
      <div class="improvement-completion-title">উন্নতি অনুশীলন সম্পন্ন</div>
      <div class="improvement-completion-grid">
        <div>
          <span>নতুন নির্ভুলতা</span>
          <strong>${getNumber(accuracy)}%</strong>
        </div>
        <div>
          <span>উন্নতি</span>
          <strong>+${getNumber(improvementPercent)}%</strong>
        </div>
        <div>
          <span>XP অর্জন</span>
          <strong>${getNumber(xpEarned)}</strong>
        </div>
      </div>
      <div class="improvement-completion-status">
        ${
          targetReached
            ? "লক্ষ্য পূরণ হয়েছে।"
            : "লক্ষ্য এখনো পূরণ হয়নি। আরও অনুশীলন চালিয়ে যাও।"
        }
      </div>
    </section>
  `;
}

export function injectImprovementCompletionStyles() {
  if (document.getElementById("improvementCompletionStyles")) return;

  const style = document.createElement("style");
  style.id = "improvementCompletionStyles";
  style.textContent = `
    .improvement-completion-card {
      margin: 20px 0;
      padding: 20px;
      border: 1px solid var(--border-color, #ddd);
      border-radius: 16px;
      background: var(--card-bg, #fff);
      color: var(--text-color, #111);
    }

    .improvement-completion-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
    }

    .improvement-completion-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .improvement-completion-grid > div {
      padding: 12px;
      border-radius: 12px;
      background: var(--surface-color, rgba(127,127,127,.08));
    }

    .improvement-completion-grid span {
      display: block;
      font-size: 12px;
      opacity: .75;
      margin-bottom: 5px;
    }

    .improvement-completion-grid strong {
      font-size: 20px;
    }

    .improvement-completion-status {
      margin-top: 14px;
      font-size: 14px;
      line-height: 1.5;
    }

    @media (max-width: 600px) {
      .improvement-completion-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}
