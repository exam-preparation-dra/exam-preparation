/* =========================================================
   VOICE INPUT (Admin only — never used on student pages)
   Wraps the browser's Web Speech API (webkitSpeechRecognition).
   ========================================================= */

export function isVoiceInputSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Attaches a microphone button's click handler to fill `targetInput` with
// recognized Bengali speech. Returns a cleanup function.
export function attachVoiceInput(buttonEl, targetInput, { lang = "bn-BD", onStart, onEnd, onError } = {}) {
  if (!isVoiceInputSupported()) {
    buttonEl.disabled = true;
    buttonEl.title = "এই ব্রাউজার ভয়েস ইনপুট সমর্থন করে না।";
    return () => {};
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let listening = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const existing = targetInput.value ? targetInput.value + " " : "";
    targetInput.value = existing + transcript;
    targetInput.dispatchEvent(new Event("input", { bubbles: true }));
  };
  recognition.onerror = (event) => { if (onError) onError(event.error); };
  recognition.onend = () => { listening = false; if (onEnd) onEnd(); };

  const handler = () => {
    if (listening) { recognition.stop(); return; }
    listening = true;
    if (onStart) onStart();
    recognition.start();
  };

  buttonEl.addEventListener("click", handler);
  return () => buttonEl.removeEventListener("click", handler);
}
