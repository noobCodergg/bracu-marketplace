import type {RequestHandler} from 'express';
import jwt from 'jsonwebtoken';
import {env} from '../config/env.js';
import {UserModel,type Role} from '../models/User.js';
import {expireRestriction} from '../services/accountStatus.js';
import {JWT_AUDIENCE,JWT_ISSUER} from '../config/auth.js';

export interface AuthenticatedUser{id:string;role:Role;status:string}
type CachedUser=AuthenticatedUser&{tokenVersion:number;expiresAt:number};
const cache=new Map<string,CachedUser>();
const MAX_CACHE_ENTRIES=2000;

export function invalidateAuthCache(userId:string){cache.delete(userId)}

function cachedUser(userId:string,version:number){
  const item=cache.get(userId);
  if(!item||item.expiresAt<=Date.now()||item.tokenVersion!==version){if(item)cache.delete(userId);return undefined}
  cache.delete(userId);cache.set(userId,item);return item;
}

function remember(user:AuthenticatedUser,tokenVersion:number){
  if(env.AUTH_CACHE_TTL_MS===0)return;
  cache.set(user.id,{...user,tokenVersion,expiresAt:Date.now()+env.AUTH_CACHE_TTL_MS});
  if(cache.size>MAX_CACHE_ENTRIES){const oldest=cache.keys().next().value;if(oldest)cache.delete(oldest)}
}

declare global{namespace Express{interface Request{authUser?:AuthenticatedUser}}}

export const requireAuth:RequestHandler=async(req,res,next)=>{
  try{
    const token=req.cookies?.session as string|undefined;
    if(!token){res.status(401).json({success:false,message:'Authentication required'});return}
    let payload:{sub:string;version:number};
    try{payload=jwt.verify(token,env.JWT_SECRET,{algorithms:['HS256'],issuer:JWT_ISSUER,audience:JWT_AUDIENCE}) as {sub:string;version:number}}catch{res.status(401).json({success:false,message:'Invalid or expired session'});return}
    const sensitive=req.originalUrl.startsWith('/api/v1/admin/')||req.originalUrl.startsWith('/api/v1/seller/analytics')||req.originalUrl.startsWith('/api/v1/notifications/stream');
    const cached=!sensitive&&['GET','HEAD','OPTIONS'].includes(req.method)?cachedUser(payload.sub,payload.version):undefined;
    if(cached){req.authUser={id:cached.id,role:cached.role,status:cached.status};next();return}
    const user=await UserModel.findById(payload.sub).select('+tokenVersion');
    if(!user||user.tokenVersion!==payload.version){res.status(401).json({success:false,message:'Session is no longer valid'});return}
    await expireRestriction(user);
    if(user.status==='BANNED'){res.status(403).json({success:false,message:'Account is banned'});return}
    if(user.status!=='ACTIVE'&&!['GET','HEAD','OPTIONS'].includes(req.method)&&!req.originalUrl.split('?')[0]?.startsWith('/api/v1/reactivation-requests')){res.status(403).json({success:false,message:'Your account is restricted. Request reactivation before making changes.'});return}
    req.authUser={id:String(user._id),role:user.role as Role,status:user.status};
    if(user.status==='ACTIVE')remember(req.authUser,user.tokenVersion);
    next();
  }catch(error){next(error)}
};

export function requireRole(...roles:Role[]):RequestHandler{return(req,res,next)=>{if(!req.authUser||!roles.includes(req.authUser.role)){res.status(403).json({success:false,message:'You do not have permission to perform this action'});return}next()}}
