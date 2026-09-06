import type {RequestHandler} from 'express';
import {env} from '../config/env.js';

const SAFE_METHODS=new Set(['GET','HEAD','OPTIONS']);
const trustedOrigin=new URL(env.CLIENT_URL).origin;
export const originGuard:RequestHandler=(req,res,next)=>{
  if(SAFE_METHODS.has(req.method)){next();return}
  const origin=req.header('Origin'),fetchSite=req.header('Sec-Fetch-Site');
  if(fetchSite==='cross-site'||(origin&&origin!==trustedOrigin)||(!origin&&env.NODE_ENV==='production')){
    res.status(403).json({success:false,message:'Cross-origin request rejected'});return;
  }
  next();
};
