import {Schema,model} from 'mongoose';

const pushSubscriptionSchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  endpoint:{type:String,required:true,unique:true},
  expirationTime:{type:Number,default:null},
  keys:{p256dh:{type:String,required:true},auth:{type:String,required:true}},
},{timestamps:true});

pushSubscriptionSchema.index({userId:1,updatedAt:-1});
export const PushSubscriptionModel=model('PushSubscription',pushSubscriptionSchema);
