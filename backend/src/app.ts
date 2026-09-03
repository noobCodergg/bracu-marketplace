import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import {env} from './config/env.js';
import {errorHandler,notFound} from './middleware/errors.js';
import {apiRouter} from './routes/index.js';

export const app=express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({origin:env.CLIENT_URL,credentials:true}));
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true}));
if(env.NODE_ENV!=='test')app.use(morgan('dev'));

app.get('/',(_req,res)=>res.json({success:true,message:'BRACU Marketplace backend'}));
app.use('/api/v1',apiRouter);
app.use(notFound);
app.use(errorHandler);
