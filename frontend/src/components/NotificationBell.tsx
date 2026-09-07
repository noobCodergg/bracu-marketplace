import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Bell,CheckCheck } from 'lucide-react';
import { useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiConfig } from '../config/api';
import { notificationService,orderService,type LiveNotification } from '../services';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';
import { formatDateTime } from '../utils/dateTime';


export function NotificationBell(){
  const {user}=useAuth(),qc=useQueryClient(),nav=useNavigate(),[open,setOpen]=useState(false);
  const {data=[]}=useQuery({queryKey:['notifications',user?.id],queryFn:notificationService.list,enabled:!!user,refetchInterval:document.hidden?false:120_000});
  useEffect(()=>{if(!user)return;const stream=new EventSource(`${apiConfig.baseUrl}/notifications/stream`,{withCredentials:true});const receive=(event:MessageEvent)=>{const item=JSON.parse(event.data) as LiveNotification;toast.info(`${item.title}: ${item.message}`);qc.setQueryData<LiveNotification[]>(['notifications',user.id],current=>[item,...(current??[]).filter(existing=>existing.id!==item.id)].slice(0,50))};stream.addEventListener('notification',receive as EventListener);return()=>stream.close()},[qc,user]);
  const read=useMutation({mutationFn:notificationService.read,meta:{silent:true},onSuccess:item=>qc.setQueryData<LiveNotification[]>(['notifications',user?.id],current=>current?.map(existing=>existing.id===item.id?item:existing))});
  const readAll=useMutation({mutationFn:notificationService.readAll,meta:{successMessage:'All notifications marked as read.'},onSuccess:()=>qc.setQueryData<LiveNotification[]>(['notifications',user?.id],current=>current?.map(item=>({...item,read:true})))});
  const decideExtension=useMutation({
    mutationFn:({orderId,decision}:{orderId:string;decision:'APPROVED'|'REJECTED'})=>orderService.decideExtension(orderId,decision),
    meta:{successMessage:'Extension request updated.'},
    onSuccess:(_order,variables)=>{
      if(!user)return;
      qc.setQueryData<LiveNotification[]>(['notifications',user.id],current=>current?.map(item=>item.resourceId===variables.orderId&&item.type==='EXTENSION_REQUEST'?{...item,resolved:true,read:true}:item));
      void qc.invalidateQueries({queryKey:['orders']});
    },
  });
  if(!user)return null;
  const unread=data.filter(item=>!item.read).length;
  const openItem=(item:LiveNotification)=>{if(!item.read)read.mutate(item.id);setOpen(false);if(item.link)nav(item.link)};
  return <div className="relative">
    <button type="button" aria-label="Notifications" aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="relative grid h-10 w-10 place-items-center rounded-xl border bg-white text-stone-600 hover:bg-stone-50">
      <Bell size={19}/>
      {unread>0&&<span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white">{unread>99?'99+':unread}</span>}
    </button>
    {open&&<div role="dialog" aria-label="Notifications panel" className="fixed inset-x-4 top-[4.5rem] z-[70] max-h-[calc(100dvh-5.5rem)] w-auto overflow-hidden rounded-2xl border bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:max-h-none sm:w-[min(24rem,calc(100vw-2rem))]">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <div><b>Notifications</b><p className="text-xs text-stone-500">{unread} unread</p></div>
        {unread>0&&<button onClick={()=>readAll.mutate()} className="flex shrink-0 items-center gap-1 text-xs font-bold text-brand-700"><CheckCheck size={15}/>Mark all read</button>}
      </div>
      <div className="max-h-[calc(100dvh-10.5rem)] overflow-y-auto sm:max-h-96">
        {data.length?data.map(item=><div key={item.id} className={`border-b p-4 last:border-0 ${item.read?'':'bg-brand-50/70'}`}>
          <button className="block w-full text-left" onClick={()=>openItem(item)}>
            <div className="flex gap-3">
              {!item.read&&<span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600"/>}
              <div className="min-w-0 flex-1"><b className="block break-words text-sm">{item.title}</b><p className="mt-1 break-words text-xs leading-5 text-stone-600">{item.message}</p><small className="mt-1 block text-stone-400">{formatDateTime(item.createdAt)}</small></div>
            </div>
          </button>
          {item.type==='EXTENSION_REQUEST'&&item.resourceId&&!item.resolved&&<div className="mt-3 flex gap-2 pl-5">
            <button disabled={decideExtension.isPending} onClick={()=>decideExtension.mutate({orderId:item.resourceId!,decision:'APPROVED'})} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button>
            <button disabled={decideExtension.isPending} onClick={()=>decideExtension.mutate({orderId:item.resourceId!,decision:'REJECTED'})} className="rounded-lg border px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-50">Reject</button>
          </div>}
          {item.type==='EXTENSION_REQUEST'&&item.resolved&&<p className="mt-2 pl-5 text-xs font-bold text-stone-500">Request handled</p>}
        </div>):<p className="p-8 text-center text-sm text-stone-500">No notifications yet.</p>}
      </div>
    </div>}
  </div>;
}
