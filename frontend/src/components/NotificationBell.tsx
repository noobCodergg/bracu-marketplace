import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Bell,CheckCheck } from 'lucide-react';
import { useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiConfig } from '../config/api';
import { notificationService,type LiveNotification } from '../services';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';

const relativeTime=(value:string)=>{const seconds=Math.max(1,Math.floor((Date.now()-new Date(value).getTime())/1000));if(seconds<60)return 'just now';if(seconds<3600)return `${Math.floor(seconds/60)}m ago`;if(seconds<86400)return `${Math.floor(seconds/3600)}h ago`;return `${Math.floor(seconds/86400)}d ago`};

export function NotificationBell(){
  const {user}=useAuth(),qc=useQueryClient(),nav=useNavigate(),[open,setOpen]=useState(false);
  const {data=[]}=useQuery({queryKey:['notifications',user?.id],queryFn:notificationService.list,enabled:!!user,refetchInterval:document.hidden?false:120_000});
  useEffect(()=>{if(!user)return;const stream=new EventSource(`${apiConfig.baseUrl}/notifications/stream`,{withCredentials:true});const receive=(event:MessageEvent)=>{const item=JSON.parse(event.data) as LiveNotification;toast.info(`${item.title}: ${item.message}`);qc.setQueryData<LiveNotification[]>(['notifications',user.id],current=>[item,...(current??[]).filter(existing=>existing.id!==item.id)].slice(0,50))};stream.addEventListener('notification',receive as EventListener);return()=>stream.close()},[qc,user]);
  const read=useMutation({mutationFn:notificationService.read,meta:{silent:true},onSuccess:item=>qc.setQueryData<LiveNotification[]>(['notifications',user?.id],current=>current?.map(existing=>existing.id===item.id?item:existing))});
  const readAll=useMutation({mutationFn:notificationService.readAll,meta:{successMessage:'All notifications marked as read.'},onSuccess:()=>qc.setQueryData<LiveNotification[]>(['notifications',user?.id],current=>current?.map(item=>({...item,read:true})))});
  if(!user)return null;const unread=data.filter(item=>!item.read).length;
  const openItem=(item:LiveNotification)=>{if(!item.read)read.mutate(item.id);setOpen(false);if(item.link)nav(item.link)};
  return <div className="relative"><button type="button" aria-label="Notifications" onClick={()=>setOpen(value=>!value)} className="relative grid h-10 w-10 place-items-center rounded-xl border bg-white text-stone-600 hover:bg-stone-50"><Bell size={19}/>{unread>0&&<span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white">{unread>99?'99+':unread}</span>}</button>{open&&<div className="absolute right-0 top-12 z-[70] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-4"><div><b>Notifications</b><p className="text-xs text-stone-500">{unread} unread</p></div>{unread>0&&<button onClick={()=>readAll.mutate()} className="flex items-center gap-1 text-xs font-bold text-brand-700"><CheckCheck size={15}/>Mark all read</button>}</div><div className="max-h-96 overflow-y-auto">{data.length?data.map(item=><button key={item.id} onClick={()=>openItem(item)} className={`block w-full border-b p-4 text-left last:border-0 hover:bg-stone-50 ${item.read?'':'bg-brand-50/70'}`}><div className="flex gap-3">{!item.read&&<span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600"/>}<div className="min-w-0 flex-1"><b className="block text-sm">{item.title}</b><p className="mt-1 text-xs leading-5 text-stone-600">{item.message}</p><small className="mt-1 block text-stone-400">{relativeTime(item.createdAt)}</small></div></div></button>):<p className="p-8 text-center text-sm text-stone-500">No notifications yet.</p>}</div></div>}</div>;
}
