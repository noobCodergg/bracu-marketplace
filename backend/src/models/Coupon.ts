import {Schema,model} from 'mongoose';

const couponSchema=new Schema({
  sellerId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  seller:{type:String,required:true,trim:true},
  code:{type:String,required:true,unique:true,uppercase:true,trim:true,minlength:3,maxlength:30,index:true},
  discountPercent:{type:Number,required:true,min:1,max:90},
  active:{type:Boolean,default:true,required:true},
  redemptions:{type:Number,default:0,min:0}
},{timestamps:true});

export const CouponModel=model('Coupon',couponSchema);
