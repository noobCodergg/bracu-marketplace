import webpush from 'web-push';
import {Types} from 'mongoose';
import {env} from '../config/env.js';
import {PushSubscriptionModel} from '../models/PushSubscription.js';

const configured=Boolean(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY);
if(configured)webpush.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY!,env.VAPID_PRIVATE_KEY!);

export async function sendOrderPush(userId:unknown,payload:{title:string;message:string;link?:string}){
  if(!configured)return;
  const subscriptions=await PushSubscriptionModel.find({userId:new Types.ObjectId(String(userId))}).lean();
  await Promise.allSettled(subscriptions.map(async subscription=>{
    try{
      await webpush.sendNotification({endpoint:subscription.endpoint,expirationTime:subscription.expirationTime??null,keys:{p256dh:subscription.keys!.p256dh,auth:subscription.keys!.auth}},JSON.stringify({title:payload.title,body:payload.message,url:payload.link??'/'}),{TTL:300,urgency:'high'});
    }catch(error){
      const status=(error as {statusCode?:number}).statusCode;
      if(status===404||status===410)await PushSubscriptionModel.deleteOne({_id:subscription._id});
      else throw error;
    }
  }));
}

export const pushPublicKey=env.VAPID_PUBLIC_KEY??null;
