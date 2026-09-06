import {createHash,randomUUID} from 'node:crypto';
import type {RequestHandler} from 'express';
import {env} from '../config/env.js';
import {SystemRequestModel} from '../models/SystemRequest.js';
import {notifyRole} from '../services/notifications.js';

export const serverStartedAt=new Date();
const abuseWindows=new Map<string,{requests:{at:number;path:string;rejected:boolean}[];notifiedAt:number}>();
const MAX_ABUSE_ACTORS=5000;
type Sample={at:number;requestId:string;method:string;path:string;statusCode:number;durationMs:number;responseBytes:number;actorKey:string;userId?:string;authenticated:boolean};
const MAX_SAMPLES=20000,samples:Array<Sample|undefined>=new Array(MAX_SAMPLES);let sampleCursor=0,sampleCount=0;
function record(sample:Sample){samples[sampleCursor]=sample;sampleCursor=(sampleCursor+1)%MAX_SAMPLES;sampleCount=Math.min(MAX_SAMPLES,sampleCount+1)}
const retainedSamples=()=>Array.from({length:sampleCount},(_,index)=>samples[(sampleCursor-sampleCount+index+MAX_SAMPLES)%MAX_SAMPLES]!).filter(Boolean);

function detectAbuse(actorKey:string,path:string,statusCode:number){
  const now=Date.now(),window=abuseWindows.get(actorKey)??{requests:[],notifiedAt:0};
  window.requests=window.requests.filter(item=>item.at>=now-15*60000);window.requests.push({at:now,path,rejected:statusCode>=400&&statusCode<500});if(window.requests.length>1000)window.requests=window.requests.slice(-1000);abuseWindows.set(actorKey,window);
  if(abuseWindows.size>MAX_ABUSE_ACTORS){const oldest=abuseWindows.keys().next().value;if(oldest)abuseWindows.delete(oldest)}
  const lastMinute=window.requests.filter(item=>item.at>=now-60000),pathCounts=new Map<string,number>();for(const item of lastMinute)pathCounts.set(item.path,(pathCounts.get(item.path)??0)+1);
  const peak=[...pathCounts.entries()].sort((a,b)=>b[1]-a[1])[0],rejected=lastMinute.filter(item=>item.rejected).length,abusive=lastMinute.length>=60||(peak?.[1]??0)>=30||rejected>=20||window.requests.length>=300;
  if(!abusive||now-window.notifiedAt<15*60000)return;window.notifiedAt=now;
  void notifyRole('ADMIN',{type:'API_ABUSE',title:'Possible API abuse detected',message:`${actorKey.slice(0,45)} sent ${lastMinute.length} requests/min; top endpoint ${peak?.[0]??path}.`,link:'/admin/system'}).catch(()=>undefined);
}

function normalizedPath(originalUrl:string){
  return originalUrl.split('?')[0]!
    .replace(/\/[a-f\d]{24}(?=\/|$)/gi,'/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi,'/:id')
    .replace(/\/\d+(?=\/|$)/g,'/:number');
}

const round=(value:number)=>Math.round(value*100)/100;
export function getLiveTelemetry(minutes:number,page:number,limit:number){
  const now=Date.now(),start=now-minutes*60000,rows=retainedSamples().filter(item=>item.at>=start);
  const endpoints=new Map<string,{method:string;path:string;requests:number;serverErrors:number;clientErrors:number;latencyTotal:number;maxLatencyMs:number;lastSeen:number}>();
  let serverErrors=0,clientErrors=0,latencyTotal=0,maxLatencyMs=0,responseBytes=0;
  const actors=new Map<string,{lastSeen:number;authenticated:boolean}>();
  for(const item of rows){
    serverErrors+=item.statusCode>=500?1:0;clientErrors+=item.statusCode>=400&&item.statusCode<500?1:0;latencyTotal+=item.durationMs;maxLatencyMs=Math.max(maxLatencyMs,item.durationMs);responseBytes+=item.responseBytes;
    actors.set(item.actorKey,{lastSeen:item.at,authenticated:item.authenticated});
    const key=`${item.method}:${item.path}`,entry=endpoints.get(key)??{method:item.method,path:item.path,requests:0,serverErrors:0,clientErrors:0,latencyTotal:0,maxLatencyMs:0,lastSeen:0};
    entry.requests+=1;entry.serverErrors+=item.statusCode>=500?1:0;entry.clientErrors+=item.statusCode>=400&&item.statusCode<500?1:0;entry.latencyTotal+=item.durationMs;entry.maxLatencyMs=Math.max(entry.maxLatencyMs,item.durationMs);entry.lastSeen=Math.max(entry.lastSeen,item.at);endpoints.set(key,entry);
  }
  const endpointItems=[...endpoints.values()].sort((a,b)=>b.requests-a.requests),paged=endpointItems.slice((page-1)*limit,page*limit).map(item=>({...item,averageLatencyMs:round(item.latencyTotal/item.requests),errorRate:round(item.serverErrors/item.requests*100),lastSeen:new Date(item.lastSeen).toISOString()}));
  const active=[...actors.values()].filter(item=>item.lastSeen>=now-5*60000),activeAuthenticated=active.filter(item=>item.authenticated).length;
  const bucketMinutes=minutes<=60?1:minutes<=360?5:30,bucketMs=bucketMinutes*60000,bucketCount=Math.ceil(minutes/bucketMinutes),bucketStart=Math.floor(now/bucketMs)*bucketMs-(bucketCount-1)*bucketMs;
  const traffic=Array.from({length:bucketCount},(_,index)=>({time:new Date(bucketStart+index*bucketMs).toISOString(),requests:0,errors:0,latencyTotal:0,averageLatencyMs:0}));
  for(const item of rows){const index=Math.floor((item.at-bucketStart)/bucketMs);if(index<0||index>=traffic.length)continue;const bucket=traffic[index]!;bucket.requests+=1;bucket.errors+=item.statusCode>=500?1:0;bucket.latencyTotal+=item.durationMs}
  traffic.forEach(bucket=>{bucket.averageLatencyMs=bucket.requests?round(bucket.latencyTotal/bucket.requests):0});
  const suspiciousActors=[...abuseWindows.entries()].flatMap(([actorKey,window])=>{const recent15=window.requests.filter(item=>item.at>=now-15*60000),recent1=recent15.filter(item=>item.at>=now-60000),counts=new Map<string,number>();recent1.forEach(item=>counts.set(item.path,(counts.get(item.path)??0)+1));const top=[...counts].sort((a,b)=>b[1]-a[1])[0],rejected=recent1.filter(item=>item.rejected).length,abusive=recent1.length>=60||(top?.[1]??0)>=30||rejected>=20||recent15.length>=300;if(!abusive)return[];const userId=actorKey.startsWith('user:')?actorKey.slice(5):null;return[{actor:userId?`User ${userId.slice(-8)}`:actorKey.startsWith('visitor:')?`Visitor ${actorKey.slice(8,16)}`:`Anonymous ${actorKey.slice(-8)}`,email:null,userId,risk:(recent1.length>=120||(top?.[1]??0)>=60?'CRITICAL':'HIGH') as 'CRITICAL'|'HIGH',requests1m:recent1.length,requests15m:recent15.length,topEndpoint:top?.[0]??'Unknown',lastSeen:new Date(recent15.at(-1)?.at??now).toISOString(),reasons:[...(recent1.length>=60?[`${recent1.length} requests in the last minute`]:[]),...((top?.[1]??0)>=30?[`${top![1]} requests to one API in the last minute`]:[]),...(rejected>=20?[`${rejected} rejected requests in the last minute`]:[]),...(recent15.length>=300?[`${recent15.length} requests in 15 minutes`]:[])]}]}).sort((a,b)=>b.requests1m-a.requests1m).slice(0,50);
  const recentErrors=rows.filter(item=>item.statusCode>=400).slice(-20).reverse().map(item=>({requestId:item.requestId,method:item.method,path:item.path,statusCode:item.statusCode,durationMs:item.durationMs,actor:item.actorKey.startsWith('user:')?`User ${item.actorKey.slice(-8)}`:item.actorKey.startsWith('visitor:')?`Visitor ${item.actorKey.slice(8,16)}`:'Anonymous',createdAt:new Date(item.at).toISOString()}));
  return {summary:{totalRequests:rows.length,requestsPerMinute:round(rows.length/minutes),serverErrors,clientErrors,errorRate:rows.length?round(serverErrors/rows.length*100):0,averageLatencyMs:rows.length?round(latencyTotal/rows.length):0,maxLatencyMs:round(maxLatencyMs),responseMb:round(responseBytes/1024/1024),activeUsers:active.length,activeAuthenticatedUsers:activeAuthenticated,activeGuests:active.length-activeAuthenticated},endpoints:{items:paged.map(({latencyTotal,...item})=>item),page,limit,total:endpointItems.length,totalPages:Math.max(1,Math.ceil(endpointItems.length/limit))},traffic:traffic.map(({latencyTotal:_,...item})=>item),suspiciousActors,recentErrors,retainedSamples:sampleCount};
}

export const systemTelemetry:RequestHandler=(req,res,next)=>{
  if(!req.originalUrl.startsWith('/api/v1')){next();return}
  const started=process.hrtime.bigint(),requestId=String(req.header('X-Request-Id')??randomUUID()).slice(0,100);
  res.setHeader('X-Request-Id',requestId);
  res.once('finish',()=>{
    const durationMs=Number(process.hrtime.bigint()-started)/1_000_000;
    const visitorId=String(req.header('X-Visitor-Id')??'').trim().slice(0,100)||undefined;
    const ip=req.ip||req.socket.remoteAddress||'unknown';
    const ipHash=createHash('sha256').update(`${env.JWT_SECRET}:${ip}`).digest('hex');
    const actorKey=req.authUser?`user:${req.authUser.id}`:visitorId?`visitor:${visitorId}`:`ip:${ipHash}`;
    const responseBytes=Number(res.getHeader('content-length')??0)||0;
    const path=normalizedPath(req.originalUrl);
    record({at:Date.now(),requestId,method:req.method,path,statusCode:res.statusCode,durationMs:round(durationMs),responseBytes,actorKey,userId:req.authUser?.id,authenticated:Boolean(req.authUser)});
    if(env.ENABLE_REQUEST_DB_TELEMETRY)void SystemRequestModel.create({requestId,method:req.method,path,statusCode:res.statusCode,durationMs:Math.round(durationMs*100)/100,responseBytes,actorKey,visitorId,userId:req.authUser?.id,role:req.authUser?.role,ipHash,userAgent:String(req.header('User-Agent')??'').slice(0,300)}).catch(error=>console.error(JSON.stringify({level:'error',message:'telemetry_write_failed',requestId,error:error instanceof Error?error.message:String(error)})));
    if(path!=='/api/v1/notifications/stream')detectAbuse(actorKey,path,res.statusCode);
    if(env.NODE_ENV!=='production'||res.statusCode>=500||durationMs>=1000)console.log(JSON.stringify({level:res.statusCode>=500?'error':'info',message:'api_request',requestId,method:req.method,path,status:res.statusCode,durationMs:Math.round(durationMs*100)/100}));
  });
  next();
};
