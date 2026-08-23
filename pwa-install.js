/* =========================================================
   ADMIN-ONLY PWA INSTALL HELPER
   Import and call this from every admin page. It registers a service
   worker scoped strictly to /admin/, so installing this never affects or
   appears alongside the student-facing pages. Call it once, after the
   admin page's topbar (with an install button already in the DOM) renders.
   ========================================================= */

let deferredPrompt = null;

export function initAdminPwaInstall(buttonId = "installBtn") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../admin/sw.js", { scope: "../admin/" }).catch(() => {});
  }

  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.classList.add("hidden");

  // Already installed / running as a standalone app — nothing to offer.
  if (window.matchMedia("(display-mode: standalone)").matches) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.classList.remove("hidden");
  });

  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.classList.add("hidden");
  });

  window.addEventListener("appinstalled", () => btn.classList.add("hidden"));
}
