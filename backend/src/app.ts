import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import {env} from './config/env.js';
import {errorHandler,notFound} from './middleware/errors.js';
import {systemTelemetry} from './middleware/systemTelemetry.js';
import {apiRouter} from './routes/index.js';
import {userRateLimiter} from './middleware/userRateLimiter.js';
import {concurrencyGate} from './middleware/concurrencyGate.js';
import {originGuard} from './middleware/originGuard.js';
import {clearPublicResponseCache} from './middleware/publicResponseCache.js';

export const app=express();

app.disable('x-powered-by');
if(env.NODE_ENV==='production')app.set('trust proxy',env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(cors({origin:env.CLIENT_URL,credentials:true}));
app.use(systemTelemetry);
app.use(cookieParser());
app.use(userRateLimiter);
app.use(concurrencyGate());
app.use(originGuard);
app.use('/api/v1',(_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');res.setHeader('CDN-Cache-Control','no-store');next()});
app.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method))res.once('finish',()=>{if(res.statusCode>=200&&res.statusCode<300)clearPublicResponseCache()});next()});
app.use(express.json({limit:'1mb'}));
if(env.NODE_ENV!=='test')app.use(morgan('dev'));

app.get('/',(_req,res)=>res.json({success:true,message:'B Market backend'}));
app.use('/api/v1',apiRouter);
app.use(notFound);
app.use(errorHandler);
