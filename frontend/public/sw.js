self.addEventListener('push',event=>{
  const data=event.data?event.data.json():{};
  event.waitUntil(self.registration.showNotification(data.title||'B Market',{body:data.body||'You have an order update.',tag:data.url||'order-update',data:{url:data.url||'/'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    const existing=windows.find(client=>client.url.startsWith(self.location.origin));
    if(existing){existing.navigate(target);return existing.focus()}
    return clients.openWindow(target);
  }));
});
