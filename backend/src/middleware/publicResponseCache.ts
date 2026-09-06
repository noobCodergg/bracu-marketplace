import type {RequestHandler} from 'express';

type Entry={body:unknown;expiresAt:number};
const cache=new Map<string,Entry>();
const inFlight=new Map<string,Promise<Entry|null>>();
const MAX_ENTRIES=200;
export function clearPublicResponseCache(){cache.clear()}
function cacheKey(req:Parameters<RequestHandler>[0]){const url=new URL(req.originalUrl,'http://internal');url.searchParams.sort();return `${url.pathname}${url.search}`}
function setPublicCacheHeaders(res:Parameters<RequestHandler>[1],ttlMs:number){const seconds=Math.max(1,Math.ceil(ttlMs/1000)),stale=Math.max(30,seconds*2);res.setHeader('Cache-Control',`public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${stale}, stale-if-error=300`);res.setHeader('CDN-Cache-Control',`public, s-maxage=${seconds}, stale-while-revalidate=${stale}, stale-if-error=300`)}

function remember(key:string,entry:Entry){
  cache.delete(key);cache.set(key,entry);
  if(cache.size>MAX_ENTRIES){const oldest=cache.keys().next().value;if(oldest)cache.delete(oldest)}
}

/**
 * Small single-instance cache for anonymous, non-personalized JSON endpoints.
 * Concurrent cache misses share the first request instead of stampeding MongoDB.
 */
export function publicResponseCache(ttlMs:number):RequestHandler{return async(req,res,next)=>{
  if(req.method!=='GET'){next();return}
  const key=cacheKey(req);setPublicCacheHeaders(res,ttlMs);
  const cached=cache.get(key);
  if(cached&&cached.expiresAt>Date.now()){
    res.setHeader('X-Cache','HIT');res.json(cached.body);return;
  }
  if(cached)cache.delete(key);
  const pending=inFlight.get(key);
  if(pending){
    const shared=await pending;
    if(shared){res.setHeader('X-Cache','COALESCED');res.json(shared.body);return}
  }

  let settle:(entry:Entry|null)=>void=()=>undefined;
  const promise=new Promise<Entry|null>(resolve=>{settle=resolve});
  inFlight.set(key,promise);
  let settled=false;
  const finish=(entry:Entry|null)=>{if(settled)return;settled=true;inFlight.delete(key);settle(entry)};
  const originalJson=res.json.bind(res);
  res.json=((body:unknown)=>{
    if(res.statusCode>=200&&res.statusCode<300){
      const entry={body,expiresAt:Date.now()+ttlMs};remember(key,entry);finish(entry);
      res.setHeader('X-Cache','MISS');
    }else finish(null);
    return originalJson(body);
  }) as typeof res.json;
  res.once('close',()=>finish(null));
  next();
}}
