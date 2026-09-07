import {Router} from 'express';
import {z} from 'zod';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {SellerApplicationModel} from '../models/SellerApplication.js';
import {publicUser,UserModel} from '../models/User.js';
import {notifyUser} from '../services/notifications.js';
import {invalidateAuthCache} from '../middleware/auth.js';

export const sellerApplicationRouter=Router();
const applicationSchema=z.object({store:z.string().trim().min(3).max(100),phone:z.string().trim().min(10).max(20),bracuId:z.string().trim().min(6).max(40),description:z.string().trim().min(30).max(1000)});
const REAPPLICATION_COOLDOWN_MS=7*24*60*60*1000;

sellerApplicationRouter.get('/mine',requireAuth,async(req,res,next)=>{
  try{
    const application=await SellerApplicationModel.findOne({userId:req.authUser!.id});
    if(!application){res.json({success:true,message:'No seller application',data:null});return}
    const retryAt=application.status==='REJECTED'?new Date(application.updatedAt.getTime()+REAPPLICATION_COOLDOWN_MS):null;
    res.json({success:true,message:'Seller application loaded',data:{
      id:String(application._id),store:application.store,status:application.status,
      submittedAt:application.createdAt.toISOString(),retryAt:retryAt?.toISOString()??null
    }});
  }catch(error){next(error)}
});

sellerApplicationRouter.post('/',requireAuth,requireRole('BUYER'),async(req,res,next)=>{
  try{
    const input=applicationSchema.parse(req.body);
    const user=await UserModel.findById(req.authUser!.id);
    if(!user){res.status(404).json({success:false,message:'Account not found'});return}
    const existing=await SellerApplicationModel.findOne({userId:user._id});
    if(existing?.status==='PENDING'||existing?.status==='APPROVED'){
      res.status(409).json({success:false,message:`Seller application is already ${existing.status.toLowerCase()}`});return;
    }
    if(existing?.status==='REJECTED'){
      const retryAt=new Date(existing.updatedAt.getTime()+REAPPLICATION_COOLDOWN_MS);
      if(retryAt.getTime()>Date.now()){
        res.status(429).json({success:false,message:`You can apply again after ${retryAt.toLocaleString('en-BD',{timeZone:'Asia/Dhaka'})}`,retryAt:retryAt.toISOString()});return;
      }
    }
    const application=await SellerApplicationModel.findOneAndUpdate(
      {userId:user._id},
      {user:user.name,...input,status:'PENDING'},
      {new:true,upsert:true,setDefaultsOnInsert:true}
    );
    res.status(201).json({success:true,message:'Seller application submitted',data:application});
  }catch(error){next(error)}
});
sellerApplicationRouter.get('/',requireAuth,requireRole('ADMIN'),async(_req,res,next)=>{try{const rows=await SellerApplicationModel.find().sort({createdAt:-1});res.json({success:true,message:'Applications loaded',data:rows.map(a=>({id:String(a._id),user:a.user,store:a.store,phone:a.phone,bracuId:a.bracuId,description:a.description,date:a.createdAt.toISOString().slice(0,10),status:a.status}))})}catch(error){next(error)}});
sellerApplicationRouter.patch('/:id',requireAuth,requireRole('ADMIN'),async(req,res,next)=>{try{const {status}=z.object({status:z.enum(['APPROVED','REJECTED'])}).parse(req.body);const application=await SellerApplicationModel.findById(req.params.id);if(!application){res.status(404).json({success:false,message:'Application not found'});return}if(application.status!=='PENDING'){res.status(409).json({success:false,message:'Application has already been reviewed'});return}application.status=status;await application.save();let user=null;if(status==='APPROVED'){user=await UserModel.findByIdAndUpdate(application.userId,{role:'SELLER',store:application.store,sellerActivityAt:new Date()},{new:true});invalidateAuthCache(String(application.userId))}await notifyUser(application.userId,{type:'APPLICATION_DECISION',title:status==='APPROVED'?'Seller application approved':'Seller application rejected',message:status==='APPROVED'?`Your application for ${application.store} was approved.`:`Your application for ${application.store} was rejected.`,link:'/become-seller'},`seller-application:${application._id}:${status}`);res.json({success:true,message:status==='APPROVED'?'Buyer upgraded to seller':'Application rejected',data:{application,user:user?publicUser(user as never):null}})}catch(error){next(error)}});
