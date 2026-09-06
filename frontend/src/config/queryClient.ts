import { MutationCache,QueryCache,QueryClient } from '@tanstack/react-query';
import { toast } from '../store/toast';

declare module '@tanstack/react-query' {
  interface Register {mutationMeta:{successMessage?:string;silent?:boolean};queryMeta:{silent?:boolean}}
}

const failedQueries=new WeakSet<object>();
export const client=new QueryClient({
  defaultOptions:{queries:{
    staleTime:30_000,
    retry:(failureCount,error)=>failureCount<2&&([429,503].includes((error as {status?:number}).status??0)||(error as {status?:number}).status!>=500),
    retryDelay:attempt=>Math.min(2000,500*2**attempt)+Math.floor(Math.random()*250),
  }},
  mutationCache:new MutationCache({
    onSuccess:(_data,_variables,_context,mutation)=>{
      if(!mutation.meta?.silent)toast.success(mutation.meta?.successMessage??'Action completed successfully.');
    },
    onError:(error,_variables,_context,mutation)=>{if(!mutation.meta?.silent)toast.error(error);},
  }),
  queryCache:new QueryCache({onError:(error,query)=>{
    // Notify once per failure episode; background polling remains quiet until recovery.
    if(!query.meta?.silent&&!failedQueries.has(query)){failedQueries.add(query);toast.error(error);}
  },onSuccess:(_data,query)=>{failedQueries.delete(query);}}),
});
