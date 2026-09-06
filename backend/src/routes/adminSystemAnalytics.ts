import {cpus,loadavg,totalmem} from 'node:os';
import {Router} from 'express';
import mongoose from 'mongoose';
import {z} from 'zod';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {getCapacitySnapshot} from '../middleware/concurrencyGate.js';
import {getLiveTelemetry,serverStartedAt} from '../middleware/systemTelemetry.js';
import {requestBulkhead} from '../middleware/requestBulkhead.js';

export const adminSystemAnalyticsRouter=Router();
adminSystemAnalyticsRouter.use(requireAuth,requireRole('ADMIN'));
adminSystemAnalyticsRouter.use(requestBulkhead(2,6,3000));
const querySchema=z.object({minutes:z.coerce.number().int().min(15).max(1440).catch(60),page:z.coerce.number().int().min(1).catch(1),limit:z.coerce.number().int().min(5).max(50).catch(15)});
const round=(value:number)=>Math.round(value*100)/100;

adminSystemAnalyticsRouter.get('/',async(req,res,next)=>{try{
  const {minutes,page,limit}=querySchema.parse(req.query),now=new Date();
  const live=getLiveTelemetry(minutes,page,limit),capacity=getCapacitySnapshot();
  let database:'CONNECTED'|'UNAVAILABLE'='CONNECTED',databaseLatencyMs=0;
  try{const started=performance.now();await mongoose.connection.db?.admin().ping();databaseLatencyMs=round(performance.now()-started)}catch{database='UNAVAILABLE'}
  const memory=process.memoryUsage(),memoryUsedMb=round(memory.rss/1024/1024),memoryUsagePercent=round(memory.rss/totalmem()*100);
  const saturated=capacity.maxInFlight>0&&capacity.inFlight/capacity.maxInFlight>=0.9;
  const status=database==='CONNECTED'&&!saturated&&memoryUsedMb<450?'UP':'DEGRADED';
  res.json({success:true,message:'Live system analytics loaded',data:{
    generatedAt:now.toISOString(),rangeMinutes:minutes,telemetryMode:'LIVE_MEMORY',retainedSamples:live.retainedSamples,
    server:{status,database,databaseLatencyMs,startedAt:serverStartedAt.toISOString(),uptimeSeconds:Math.floor(process.uptime()),nodeVersion:process.version,cpuCount:cpus().length,loadAverage:round(loadavg()[0]??0),memoryUsedMb,memoryUsagePercent},
    capacity:{...capacity,utilizationPercent:capacity.maxInFlight?round(capacity.inFlight/capacity.maxInFlight*100):0,availableSlots:Math.max(0,capacity.maxInFlight-capacity.inFlight)},
    summary:live.summary,endpoints:live.endpoints,traffic:live.traffic,suspiciousActors:live.suspiciousActors,recentErrors:live.recentErrors,
  }});
}catch(error){next(error)}});
