import {expireRestriction} from '../services/accountStatus.js';
import {Router,type Response} from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {z} from 'zod';
import {env} from '../config/env.js';
import {requireAuth} from '../middleware/auth.js';
import {publicUser,UserModel} from '../models/User.js';
import {JWT_AUDIENCE,JWT_ISSUER} from '../config/auth.js';
import {requestBulkhead} from '../middleware/requestBulkhead.js';
import {clearLoginFailures,loginRetryAfter,recordLoginFailure} from '../services/loginProtection.js';

export const authRouter=Router();
const credentials=z.object({email:z.string().email().transform(v=>v.toLowerCase().trim()),password:z.string().min(8).max(72)});
const registerSchema=credentials.extend({name:z.string().trim().min(2).max(80),password:z.string().min(10).max(72).refine(value=>/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/\d/.test(value),'Use at least one uppercase letter, lowercase letter, and number')});
const cookieOptions={httpOnly:true,secure:env.NODE_ENV==='production',sameSite:env.NODE_ENV==='production'?'none' as const:'lax' as const,maxAge:7*24*60*60*1000,path:'/'};
function issueSession(res:Response,user:{_id:unknown;tokenVersion:number}){const token=jwt.sign({version:user.tokenVersion},env.JWT_SECRET,{algorithm:'HS256',issuer:JWT_ISSUER,audience:JWT_AUDIENCE,subject:String(user._id),expiresIn:'7d'});res.cookie('session',token,cookieOptions)}
const loginBulkhead=requestBulkhead(4,20,4000);
const dummyPasswordHash='$2b$12$5N1KMU7LkF8JYF1uwE/PP.BMsErd3vr0sMA4j1fLbuolPPTtfr62C';

authRouter.post('/register',async(req,res,next)=>{try{const input=registerSchema.parse(req.body);if(await UserModel.exists({email:input.email})){res.status(409).json({success:false,message:'An account already exists with this email'});return}const user=await UserModel.create({name:input.name,email:input.email,passwordHash:await bcrypt.hash(input.password,12),role:'BUYER',status:'ACTIVE'});issueSession(res,user);res.status(201).json({success:true,message:'Buyer account created',data:publicUser(user as never)})}catch(error){next(error)}});
authRouter.post('/login',loginBulkhead,async(req,res,next)=>{try{const input=credentials.parse(req.body);const retryAfter=loginRetryAfter(input.email);if(retryAfter){res.setHeader('Retry-After',String(retryAfter));res.status(429).json({success:false,message:'Too many failed sign-in attempts. Try again later.'});return}const user=await UserModel.findOne({email:input.email}).select('+passwordHash +tokenVersion');const valid=await bcrypt.compare(input.password,user?.passwordHash??dummyPasswordHash);if(!user||!valid){const lockedFor=recordLoginFailure(input.email);if(lockedFor)res.setHeader('Retry-After',String(lockedFor));res.status(401).json({success:false,message:'Invalid email or password'});return}clearLoginFailures(input.email);await expireRestriction(user);if(user.status==='BANNED'){res.status(403).json({success:false,message:'This account is banned'});return}issueSession(res,user);res.json({success:true,message:'Signed in',data:publicUser(user as never)})}catch(error){next(error)}});
authRouter.get('/me',requireAuth,async(req,res,next)=>{try{const user=await UserModel.findById(req.authUser!.id);if(!user){res.status(401).json({success:false,message:'Account not found'});return}res.json({success:true,message:'Session restored',data:publicUser(user as never)})}catch(error){next(error)}});
authRouter.post('/logout',(_req,res)=>{res.clearCookie('session',{...cookieOptions,maxAge:undefined});res.json({success:true,message:'Signed out'})});
