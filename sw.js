const CACHE='you-tim-v41-compact-mobile';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))))});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))]))});
self.addEventListener('fetch',e=>{
  if(e.request.method==='GET') e.respondWith(fetch(e.request,{cache:'no-store'}));
});
