import type {RequestHandler,Response} from 'express';
import {env} from '../config/env.js';

type Options={maxInFlight?:number;maxQueue?:number;queueTimeoutMs?:number};
type Waiting={resume:()=>void;reject:()=>void;timer:NodeJS.Timeout};
export type CapacitySnapshot={inFlight:number;queued:number;maxInFlight:number;maxQueue:number;shedTotal:number;queueTimeoutMs:number};
let currentCapacity:CapacitySnapshot={inFlight:0,queued:0,maxInFlight:0,maxQueue:0,shedTotal:0,queueTimeoutMs:0};
export const getCapacitySnapshot=()=>({...currentCapacity});

export function concurrencyGate(options:Options={}):RequestHandler{
  const maxInFlight=options.maxInFlight??env.API_MAX_IN_FLIGHT;
  const maxQueue=options.maxQueue??env.API_MAX_QUEUE;
  const queueTimeoutMs=options.queueTimeoutMs??env.API_QUEUE_TIMEOUT_MS;
  const waiting:Waiting[]=[];
  let inFlight=0;
  let shedTotal=0;
  const publish=()=>{currentCapacity={inFlight,queued:waiting.length,maxInFlight,maxQueue,shedTotal,queueTimeoutMs}};
  publish();

  const overloaded=(res:Response)=>{
    shedTotal+=1;publish();
    res.set({'Retry-After':'1','Cache-Control':'no-store','X-Capacity-Status':'shed'});
    res.status(503).json({success:false,message:'The server is busy. Please retry shortly.'});
  };
  const start=(res:Response,next:()=>void)=>{
    inFlight+=1;
    publish();
    res.setHeader('X-Capacity-In-Flight',String(inFlight));
    let released=false;
    const release=()=>{
      if(released)return;released=true;inFlight-=1;
      const queued=waiting.shift();
      publish();if(queued){clearTimeout(queued.timer);queued.resume()}
    };
    res.once('finish',release);res.once('close',release);next();
  };

  return (req,res,next)=>{
    const path=req.originalUrl.split('?')[0];
    if(!req.originalUrl.startsWith('/api/v1')||path==='/api/v1/health'||path==='/api/v1/notifications/stream'){
      next();return;
    }
    if(inFlight<maxInFlight){start(res,next);return}
    if(waiting.length>=maxQueue){overloaded(res);return}
    const item={} as Waiting;
    item.resume=()=>start(res,next);
    item.reject=()=>{
      const index=waiting.indexOf(item);if(index>=0)waiting.splice(index,1);
      publish();
      overloaded(res);
    };
    item.timer=setTimeout(item.reject,queueTimeoutMs);item.timer.unref();
    waiting.push(item);
    publish();
    res.setHeader('X-Capacity-Queued',String(waiting.length));
  };
}
