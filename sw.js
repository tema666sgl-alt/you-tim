const CACHE='you-tim-v61-calendar-sync-fix';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))))});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k))))]))});
self.addEventListener('fetch',e=>{
  if(e.request.method==='GET') e.respondWith(fetch(e.request,{cache:'no-store'}));
});

self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch(e){data={message:event.data?.text()||''}}
 const title=String(data.title||'YOU TIM').slice(0,80);const body=String(data.message||'Новое уведомление').slice(0,400);
 event.waitUntil(self.registration.showNotification(title,{body,icon:'./icon-192.png',badge:'./icon-192.png',tag:'you-tim-'+Date.now(),data:{url:self.registration.scope}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{for(const w of windows){if(w.url.startsWith(self.registration.scope)){await w.focus();return}}await clients.openWindow(self.registration.scope)}))});
