// Admin-only service worker. Scope is /admin/ — registered ONLY from admin
// pages, never from student pages, so this never touches the student PWA
// experience or caches anything student-facing.
const CACHE_NAME = "exam-admin-shell-v1";
const SHELL_ASSETS = [
  "../css/style.css",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: admin pages always need fresh Firestore-backed HTML/data.
// Only fall back to the cached shell asset if the network truly fails
// (offline), so nothing ever looks "stuck" on stale data.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
