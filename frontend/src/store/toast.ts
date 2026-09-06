import { create } from 'zustand';

export type ToastTone='success'|'error'|'info';
export interface ToastMessage {id:number;tone:ToastTone;message:string}
let nextId=0;
const recent=new Map<string,number>();
export const useToasts=create<{items:ToastMessage[];dismiss:(id:number)=>void}>(set=>({
  items:[],dismiss:id=>set(state=>({items:state.items.filter(item=>item.id!==id)})),
}));
function show(tone:ToastTone,message:string){
  const now=Date.now(),key=`${tone}:${message}`;
  for(const [entry,time] of recent)if(now-time>10000)recent.delete(entry);
  if(recent.has(key))return;
  recent.set(key,now);
  useToasts.setState(state=>({items:[...state.items,{id:++nextId,tone,message}].slice(-4)}));
}
export const toast={
  success:(message:string)=>show('success',message),
  error:(error:unknown)=>{if(error instanceof Error&&error.name==='AbortError')return;show('error',error instanceof Error?error.message:typeof error==='string'?error:'Something went wrong. Please try again.');},
  info:(message:string)=>show('info',message),
};
