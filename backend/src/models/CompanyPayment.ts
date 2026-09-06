import {Schema,model} from 'mongoose';

// Written by the future gateway integration after server-side payment verification.
// No public or admin endpoint may create successful payments.
const schema=new Schema({
  reference:{type:String,required:true,unique:true,trim:true,maxlength:120},
  buyerEmail:{type:String,required:true,lowercase:true,trim:true},
  product:{type:String,enum:['BOOST','PREMIUM_ANALYTICS'],required:true},
  amount:{type:Number,required:true,min:0},
  status:{type:String,enum:['PENDING','SUCCEEDED','FAILED'],required:true,index:true},
  currency:{type:String,enum:['BDT'],required:true,default:'BDT'},
  directCost:{type:Number,required:true,min:0,default:0},
  paidAt:{type:Date,required:true,index:true},
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true},
  consumedAt:{type:Date},
  resourceId:{type:Schema.Types.ObjectId},
},{timestamps:true});
schema.index({userId:1,product:1,status:1,paidAt:-1});
export const CompanyPaymentModel=model('CompanyPayment',schema);
