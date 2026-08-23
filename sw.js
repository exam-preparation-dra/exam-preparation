// Admin-only service worker. Scope is /admin/ — registered ONLY from admin
// pages, never from student pages, so this never touches the student PWA
// experience or caches anything student-facing.
//
// v2 FIX: v1's fetch handler intercepted EVERY request from a controlled
// page — including Firestore's long-lived/streaming connections to
// firestore.googleapis.com. Wrapping those in respondWith()/fetch().catch()
// broke the connection, so every admin page hung forever on its loading
// skeleton (Firestore data never arrived). Now the fetch handler does
// nothing at all (event.respondWith is never called) unless the request is
// a GET to one of our own known static shell files on our own origin —
// Firestore, auth, and everything else is left completely untouched.
const CACHE_NAME = "exam-admin-shell-v2";
const SHELL_ASSET_PATHS = ["/css/style.css", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSET_PATHS))
      .catch(() => {})
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // never touch Firestore/Auth/any other origin
  if (!SHELL_ASSET_PATHS.includes(url.pathname)) return; // never touch app HTML/JS, only our known static shell files

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
