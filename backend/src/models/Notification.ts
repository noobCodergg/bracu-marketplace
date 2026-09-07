import {Schema,model} from 'mongoose';

const notificationSchema=new Schema({
  eventKey:{type:String,unique:true,sparse:true},
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  resourceId:{type:Schema.Types.ObjectId,index:true},
  type:{type:String,enum:['NEW_ORDER','ORDER_STATUS','EXTENSION_REQUEST','EXTENSION_DECISION','API_ABUSE','ACCOUNT_WARNING','APPLICATION_DECISION'],required:true},
  title:{type:String,required:true,trim:true,maxlength:120},
  message:{type:String,required:true,trim:true,maxlength:500},
  link:{type:String,trim:true,maxlength:240},
  readAt:{type:Date,default:null,index:true}
  ,resolvedAt:{type:Date,default:null}
},{timestamps:true});

notificationSchema.index({userId:1,createdAt:-1});
notificationSchema.index({userId:1,readAt:1,createdAt:-1});
export const NotificationModel=model('Notification',notificationSchema);
