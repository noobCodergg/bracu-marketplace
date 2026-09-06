import {Router} from 'express';
import {requireAuth} from '../middleware/auth.js';
import {NotificationModel} from '../models/Notification.js';
import {notificationView,subscribeNotifications} from '../services/notifications.js';

export const notificationRouter=Router();
notificationRouter.use(requireAuth);

notificationRouter.get('/',async(req,res,next)=>{try{const items=await NotificationModel.find({userId:req.authUser!.id}).sort({createdAt:-1}).limit(50);res.json({success:true,message:'Notifications loaded',data:items.map(notificationView)})}catch(error){next(error)}});
notificationRouter.get('/stream',(req,res)=>{res.status(200).set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();res.write('event: connected\ndata: {}\n\n');const unsubscribe=subscribeNotifications(req.authUser!.id,res);const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),25000);req.on('close',()=>{clearInterval(heartbeat);unsubscribe()})});
notificationRouter.patch('/read-all',async(req,res,next)=>{try{await NotificationModel.updateMany({userId:req.authUser!.id,readAt:null},{$set:{readAt:new Date()}});res.json({success:true,message:'All notifications read',data:null})}catch(error){next(error)}});
notificationRouter.patch('/:id/read',async(req,res,next)=>{try{const item=await NotificationModel.findOneAndUpdate({_id:req.params.id,userId:req.authUser!.id},{$set:{readAt:new Date()}},{new:true});if(!item){res.status(404).json({success:false,message:'Notification not found'});return}res.json({success:true,message:'Notification read',data:notificationView(item)})}catch(error){next(error)}});
