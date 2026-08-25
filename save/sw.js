const CACHE='save-shell-v3';
const ASSETS=['./','./index.html','./styles.css','./app.js','./config.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin||!url.pathname.startsWith('/save/'))return;
  const isNav=req.mode==='navigate';
  event.respondWith(fetch(req).then(resp=>{if(resp.ok){const clone=resp.clone();caches.open(CACHE).then(c=>c.put(req,clone));}return resp;}).catch(async()=>{const hit=await caches.match(req);if(hit)return hit;if(isNav)return caches.match('./index.html');throw new Error('offline');}));
});
