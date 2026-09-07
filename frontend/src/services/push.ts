import {apiRequest} from './http';

function applicationServerKey(value:string){
  const padding='='.repeat((4-value.length%4)%4);
  const base64=(value+padding).replaceAll('-','+').replaceAll('_','/');
  return Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
}

export const pushService={
  supported:()=>('serviceWorker'in navigator)&&('PushManager'in window)&&('Notification'in window),
  permission:()=>('Notification'in window?Notification.permission:'denied'),
  enable:async()=>{
    if(!pushService.supported())throw new Error('Push notifications are not supported by this browser.');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('Notification permission was not granted.');
    const publicKey=await apiRequest<string|null>('/push/public-key');
    if(!publicKey)throw new Error('Push notifications are not configured on the server.');
    const registration=await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const existing=await registration.pushManager.getSubscription();
    const subscription=existing??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationServerKey(publicKey)});
    await apiRequest<boolean>('/push/subscription',{method:'PUT',body:JSON.stringify(subscription.toJSON())});
    return true;
  },
  disable:async()=>{
    if(!pushService.supported())return false;
    const registration=await navigator.serviceWorker.getRegistration('/');
    const subscription=await registration?.pushManager.getSubscription();
    if(!subscription)return false;
    await apiRequest<boolean>('/push/subscription',{method:'DELETE',body:JSON.stringify({endpoint:subscription.endpoint})});
    await subscription.unsubscribe();
    return false;
  },
};
