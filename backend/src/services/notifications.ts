import type {Response} from 'express';
import {NotificationModel} from '../models/Notification.js';
import {UserModel} from '../models/User.js';

type NotificationType='NEW_ORDER'|'ORDER_STATUS'|'EXTENSION_REQUEST'|'EXTENSION_DECISION'|'API_ABUSE'|'ACCOUNT_WARNING'|'APPLICATION_DECISION';
type Input={type:NotificationType;title:string;message:string;link?:string;resourceId?:string};
const clients=new Map<string,Set<Response>>();
const view=(item:any)=>({id:String(item._id),type:item.type,title:item.title,message:item.message,link:item.link,resourceId:item.resourceId?String(item.resourceId):undefined,read:Boolean(item.readAt),resolved:Boolean(item.resolvedAt),createdAt:item.createdAt.toISOString()});

export function subscribeNotifications(userId:string,res:Response){
  const subscriptions=clients.get(userId)??new Set<Response>();subscriptions.add(res);clients.set(userId,subscriptions);
  return()=>{subscriptions.delete(res);if(!subscriptions.size)clients.delete(userId)};
}

export async function notifyUser(userId:unknown,input:Input,eventKey?:string){
  if(input.type==='API_ABUSE') {
    const user=await UserModel.findById(userId).select('notificationPreference').lean();
    if(user?.notificationPreference==='ORDERS')return;
  }
  const notification=eventKey?await NotificationModel.findOneAndUpdate({eventKey},{$setOnInsert:{userId:String(userId),...input}},{new:true,upsert:true}):await NotificationModel.create({userId:String(userId),...input});const payload=view(notification);
  for(const response of clients.get(String(userId))??[])response.write(`event: notification\ndata: ${JSON.stringify(payload)}\n\n`);
  return payload;
}

export async function notifyRole(role:'ADMIN',input:Input){
  const users=await UserModel.find({role,status:'ACTIVE'}).select('_id').lean();
  await Promise.all(users.map(user=>notifyUser(user._id,input)));
}

export {view as notificationView};
