const CACHE_NAME = "orbit-merge-v16";
const FILES = [
  "./", "index.html", "home.css", "home-audio.js", "history.js", "game.html", "style.css", "game.js",
  "manifest.webmanifest", "assets/icon.svg",
  "assets/memory-1.jpg", "assets/memory-2.jpg", "assets/memory-3.jpg", "assets/memory-4.jpg",
  "assets/memory-5.jpg", "assets/memory-6.jpg", "assets/memory-7.jpg", "assets/memory-8.jpg"
  ,"assets/beauty-1.jpg", "assets/beauty-2.jpg", "assets/beauty-3.jpg", "assets/beauty-4.jpg",
  "assets/beauty-5.jpg", "assets/beauty-6.jpg", "assets/beauty-7.jpg", "assets/beauty-8.jpg"
  ,"assets/handsome-1.jpg", "assets/handsome-2.jpg", "assets/handsome-3.jpg", "assets/handsome-4.jpg",
  "assets/handsome-5.jpg", "assets/handsome-6.jpg", "assets/handsome-7.jpg", "assets/handsome-8.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});
