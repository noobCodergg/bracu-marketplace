import {Schema,model} from 'mongoose';

const sellerApplicationSchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,unique:true},
  user:{type:String,required:true},
  store:{type:String,required:true,trim:true},
  phone:{type:String,required:true,trim:true},
  bracuId:{type:String,required:true,trim:true},
  description:{type:String,required:true,trim:true},
  status:{type:String,enum:['PENDING','APPROVED','REJECTED'],default:'PENDING',required:true}
},{timestamps:true});

export const SellerApplicationModel=model('SellerApplication',sellerApplicationSchema);
