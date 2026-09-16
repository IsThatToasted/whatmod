const CACHE = "whatmod-trivia-v13";
const CORE = ["./", "./index.html", "./styles.css", "./config.js", "./js/app.js", "./js/store.js",
  "./js/supabase.js", "./js/scoring.js", "./js/charts.js", "./js/twitch.js", "./js/experience.js", "./assets/icon.svg"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith("whatmod-trivia-")).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request)));
});
