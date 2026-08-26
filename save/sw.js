const CACHE='save-shell-v6';
const SHELL=['./','./index.html','./styles.css','./app.js','./config.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||url.pathname.includes('/functions/')||url.hostname.includes('supabase.co'))return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(response.ok){const cache=await caches.open(CACHE);cache.put(event.request,response.clone()).catch(()=>{});}
      return response;
    }catch(error){
      const cached=await caches.match(event.request);
      if(cached)return cached;
      if(event.request.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
      return Response.error();
    }
  })());
});
