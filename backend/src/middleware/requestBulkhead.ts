import type {RequestHandler} from 'express';

export function requestBulkhead(maxActive:number,maxQueue:number,timeoutMs=3000):RequestHandler{
  let active=0;const queue:Array<{run:()=>void;timer:NodeJS.Timeout}>=[];
  const release=()=>{active-=1;const next=queue.shift();if(next){clearTimeout(next.timer);next.run()}};
  return (_req,res,next)=>{
    const run=()=>{active+=1;let done=false;const finish=()=>{if(done)return;done=true;release()};res.once('finish',finish);res.once('close',finish);next()};
    if(active<maxActive){run();return}
    if(queue.length>=maxQueue){res.set({'Retry-After':'2','Cache-Control':'no-store','X-Bulkhead-Status':'shed'}).status(503).json({success:false,message:'This resource-intensive service is busy. Please retry shortly.'});return}
    const item={run,timer:undefined as unknown as NodeJS.Timeout};
    item.timer=setTimeout(()=>{const index=queue.indexOf(item);if(index>=0)queue.splice(index,1);res.set({'Retry-After':'2','Cache-Control':'no-store','X-Bulkhead-Status':'timeout'}).status(503).json({success:false,message:'This resource-intensive service is busy. Please retry shortly.'})},timeoutMs);item.timer.unref();queue.push(item);
  };
}
