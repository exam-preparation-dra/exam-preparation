/* pwa-install.js — registers the service worker and renders an optional
   "install on phone" card (used at the very bottom of the dashboard). */
let deferredPrompt = null;
const listeners = new Set();
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

export function registerPwa() {
  if ("serviceWorker" in navigator) {
    const url = new URL("../../sw.js", import.meta.url);
    navigator.serviceWorker.register(url, { scope: new URL("../../", import.meta.url).pathname }).catch(() => {});
  }
}
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; listeners.forEach(f => f()); });
window.addEventListener("appinstalled", () => { deferredPrompt = null; listeners.forEach(f => f()); });

const DISMISS_KEY = "pwaInstallDismissed";
const ICON = new URL("../../icons/icon-192.png", import.meta.url).href;

export function mountInstallCard(el) {
  if (!el) return;
  registerPwa();
  const dismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } };
  const paint = () => {
    if (isStandalone() || dismissed()) { el.innerHTML = ""; return; }
    const ios = isIOS();
    if (!ios && !deferredPrompt) { el.innerHTML = ""; return; }   // browser can't install (yet) — show nothing
    el.innerHTML = `
      <div class="pwa-card">
        <img src="${ICON}" alt="" width="46" height="46">
        <div class="pwa-txt"><b>ফোনে অ্যাপ হিসেবে ইনস্টল করো</b>
          <small>${ios ? "Safari-র Share বাটন (⬆︎) → “Add to Home Screen”" : "এক ট্যাপে হোম স্ক্রিনে — অ্যাপের মতো খুলবে"}</small></div>
        ${ios ? "" : `<button type="button" class="pwa-btn" id="pwaInstallBtn">ইনস্টল</button>`}
        <button type="button" class="pwa-x" id="pwaCloseBtn" aria-label="লুকাও">✕</button>
      </div>`;
    el.querySelector("#pwaCloseBtn").onclick = () => { try { localStorage.setItem(DISMISS_KEY, "1"); } catch {} paint(); };
    const b = el.querySelector("#pwaInstallBtn");
    if (b) b.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch {}
      deferredPrompt = null; paint();
    };
  };
  listeners.add(paint);
  paint();
}
