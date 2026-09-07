import {OrderModel} from '../models/Order.js';
import {notifyUser} from './notifications.js';

// Events are committed in the same document write as the order transition.
// A unique notification key makes retries safe after a worker/process crash.
export async function deliverOrderNotifications(){
 const orders=await OrderModel.find({'notificationEvents.0':{$exists:true}}).select('notificationEvents').limit(50);
 for(const order of orders)for(const event of order.notificationEvents){
  await notifyUser(event.userId,{type:event.type as Parameters<typeof notifyUser>[1]['type'],title:event.title,message:event.message,link:event.link??undefined,resourceId:event.resourceId?String(event.resourceId):undefined},`${order._id}:${event._id}`);
  await OrderModel.updateOne({_id:order._id},{$pull:{notificationEvents:{_id:event._id}}});
 }
}
export function startOrderNotificationWorker(){
 let running=false;
 const timer=setInterval(()=>{if(running)return;running=true;void deliverOrderNotifications().catch(error=>console.error('Order notification delivery will retry',error)).finally(()=>{running=false})},1000);
 timer.unref();return()=>clearInterval(timer);
}
