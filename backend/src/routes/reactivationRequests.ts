import {Router} from 'express';
import {z} from 'zod';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {ReactivationRequestModel} from '../models/ReactivationRequest.js';
import {UserModel} from '../models/User.js';
import {notifyUser} from '../services/notifications.js';
import {invalidateAuthCache} from '../middleware/auth.js';

export const reactivationRequestRouter=Router();
const view=(request:{_id:unknown;userId:unknown;user:string;role:string;accountStatus:string;reason:string;status:string;createdAt:Date})=>({id:String(request._id),userId:String(request.userId),user:request.user,role:request.role,accountStatus:request.accountStatus,reason:request.reason,date:request.createdAt.toISOString().slice(0,10),status:request.status});
const dhakaSubmissionWindow=(now=new Date())=>{
  const shifted=new Date(now.getTime()+6*60*60*1000);
  const submissionDay=shifted.toISOString().slice(0,10);
  const dayStart=new Date(Date.parse(submissionDay+'T00:00:00.000Z')-6*60*60*1000);
  const retryAt=new Date(dayStart.getTime()+24*60*60*1000);
  return {submissionDay,dayStart,retryAt};
};

reactivationRequestRouter.post('/',requireAuth,async(req,res,next)=>{try{
  const {reason}=z.object({reason:z.string().trim().min(3).max(1000)}).parse(req.body);
  const user=await UserModel.findById(req.authUser!.id);
  if(!user){res.status(404).json({success:false,message:'Account not found'});return}
  if(!['SUSPENDED','FROZEN'].includes(user.status)){res.status(409).json({success:false,message:'This account is not restricted'});return}
  const existing=await ReactivationRequestModel.findOne({userId:user._id,status:'PENDING'});
  if(existing){res.json({success:true,message:'Reactivation request already pending',data:view(existing as never)});return}
  const {submissionDay,dayStart,retryAt}=dhakaSubmissionWindow();
  const submittedToday=await ReactivationRequestModel.exists({userId:user._id,$or:[{submissionDay},{createdAt:{$gte:dayStart,$lt:retryAt}}]});
  if(submittedToday){res.status(429).json({success:false,message:`You can submit one reactivation application per day. Try again after ${retryAt.toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})}.`,retryAt:retryAt.toISOString()});return}
  const role=z.enum(['BUYER','SELLER']).parse(user.role);
  const accountStatus=z.enum(['SUSPENDED','FROZEN']).parse(user.status);
  const request=await ReactivationRequestModel.create({userId:user._id,user:user.name,role,accountStatus,reason,submissionDay});
  res.status(201).json({success:true,message:'Reactivation request submitted',data:view(request as never)});
}catch(error){next(error)}});

reactivationRequestRouter.get('/mine',requireAuth,async(req,res,next)=>{try{const request=await ReactivationRequestModel.findOne({userId:req.authUser!.id}).sort({createdAt:-1});res.json({success:true,message:'Latest reactivation request loaded',data:request?view(request as never):null})}catch(error){next(error)}});

reactivationRequestRouter.get('/',requireAuth,requireRole('ADMIN'),async(_req,res,next)=>{try{
  const requests=await ReactivationRequestModel.find().sort({createdAt:-1});
  res.json({success:true,message:'Reactivation requests loaded',data:requests.map(request=>view(request as never))});
}catch(error){next(error)}});

reactivationRequestRouter.patch('/:id',requireAuth,requireRole('ADMIN'),async(req,res,next)=>{try{
  const {status}=z.object({status:z.enum(['APPROVED','REJECTED'])}).parse(req.body);
  const request=await ReactivationRequestModel.findById(req.params.id);
  if(!request){res.status(404).json({success:false,message:'Reactivation request not found'});return}
  if(request.status!=='PENDING'){res.status(409).json({success:false,message:'Reactivation request has already been reviewed'});return}
  const user=await UserModel.findById(request.userId);
  if(!user){res.status(404).json({success:false,message:'User not found'});return}
  request.status=status;
  if(status==='APPROVED'){user.status='ACTIVE';user.restrictionReason=undefined;user.restrictionEnds=undefined;await user.save();invalidateAuthCache(String(user._id))}
  await request.save();
  await notifyUser(request.userId,{type:'APPLICATION_DECISION',title:status==='APPROVED'?'Reactivation request approved':'Reactivation request rejected',message:status==='APPROVED'?'Your account has been reactivated.':'Your account reactivation request was rejected.',link:status==='APPROVED'?`/${user.role.toLowerCase()}/dashboard`:'/login'},`reactivation-request:${request._id}:${status}`);
  res.json({success:true,message:status==='APPROVED'?'Account reactivated':'Reactivation request rejected',data:view(request as never)});
}catch(error){next(error)}});
