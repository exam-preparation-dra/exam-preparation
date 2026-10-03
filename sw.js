/* Minimal service worker — makes the app installable.
   Deliberately does NOT cache pages/data (exam content and Firebase data must always be live),
   so updating the site never leaves students on a stale version. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* network as usual */ });
