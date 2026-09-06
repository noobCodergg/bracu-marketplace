import type {RequestHandler} from 'express';
import {env} from '../config/env.js';

const SAFE_METHODS=new Set(['GET','HEAD','OPTIONS']);
export const trustedOrigins=new Set([env.CLIENT_URL,...env.CLIENT_URLS.split(',')].map(value=>value.trim()).filter(Boolean).map(value=>new URL(value).origin));
export const originGuard:RequestHandler=(req,res,next)=>{
  if(SAFE_METHODS.has(req.method)){next();return}
  const origin=req.header('Origin');
  if((origin&&!trustedOrigins.has(origin))||(!origin&&env.NODE_ENV==='production')){
    res.status(403).json({success:false,message:'Cross-origin request rejected'});return;
  }
  next();
};
