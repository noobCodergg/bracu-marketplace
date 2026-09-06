import { AlertCircle,CheckCircle2,Info,X } from 'lucide-react';
import { useEffect,useState } from 'react';
import { useToasts,type ToastMessage } from '../store/toast';

function ToastItem({item}:{item:ToastMessage}){
  const dismiss=useToasts(state=>state.dismiss);
  const [hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
  useEffect(()=>{
    if(hovered||focused)return;
    const timer=window.setTimeout(()=>dismiss(item.id),item.tone==='error'?8000:5000);
    return()=>window.clearTimeout(timer);
  },[dismiss,item.id,item.tone,hovered,focused]);
  const Icon=item.tone==='success'?CheckCircle2:item.tone==='error'?AlertCircle:Info;
  const tone=item.tone==='success'?'border-emerald-200 text-emerald-700':item.tone==='error'?'border-red-200 text-red-700':'border-blue-200 text-blue-700';
  return <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocus={()=>setFocused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false);}} className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-xl ${tone}`}>
    <Icon size={21} className="mt-0.5 shrink-0" aria-hidden="true"/>
    <p role={item.tone==='error'?'alert':'status'} aria-atomic="true" className="min-w-0 flex-1 break-words text-sm font-semibold leading-6">{item.message}</p>
    <button type="button" aria-label="Dismiss notification" className="-mr-1 rounded-lg p-1.5 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2" onClick={()=>dismiss(item.id)}><X size={17}/></button>
  </div>;
}
export function ToastViewport(){
  const items=useToasts(state=>state.items);
  return <section aria-label="Status messages" className="pointer-events-none fixed right-4 top-4 z-[1000] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3">{items.map(item=><ToastItem key={item.id} item={item}/>)}</section>;
}
