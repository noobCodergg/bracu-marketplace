import {Router} from 'express';
import {z} from 'zod';
import {requireAuth} from '../middleware/auth.js';
import {PushSubscriptionModel} from '../models/PushSubscription.js';
import {pushPublicKey} from '../services/webPush.js';

export const pushRouter=Router();
pushRouter.get('/public-key',(_req,res)=>{res.json({success:true,message:'Push configuration loaded',data:pushPublicKey})});
pushRouter.put('/subscription',requireAuth,async(req,res,next)=>{try{
  if(!pushPublicKey){res.status(503).json({success:false,message:'Push notifications are not configured'});return}
  const input=z.object({endpoint:z.string().url().max(2048),expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().min(20).max(500),auth:z.string().min(8).max(200)})}).parse(req.body);
  await PushSubscriptionModel.findOneAndUpdate({endpoint:input.endpoint},{$set:{...input,userId:req.authUser!.id}},{upsert:true,new:true});
  res.json({success:true,message:'Push notifications enabled',data:true});
}catch(error){next(error)}});
pushRouter.delete('/subscription',requireAuth,async(req,res,next)=>{try{const {endpoint}=z.object({endpoint:z.string().url().max(2048)}).parse(req.body);await PushSubscriptionModel.deleteOne({endpoint,userId:req.authUser!.id});res.json({success:true,message:'Push notifications disabled',data:false})}catch(error){next(error)}});
