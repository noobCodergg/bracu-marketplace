import {Schema,model} from 'mongoose';

const ppcCampaignSchema=new Schema({
  sellerId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  productId:{type:Schema.Types.ObjectId,ref:'Product',required:true,index:true},
  name:{type:String,required:true,trim:true,maxlength:120},
  keywords:{type:[String],default:[]},negativeKeywords:{type:[String],default:[]},
  dailyBudget:{type:Number,required:true,min:1},bid:{type:Number,required:true,min:.1},
  status:{type:String,enum:['ACTIVE','PAUSED'],default:'ACTIVE',index:true},
  startsAt:{type:Date,default:Date.now},endsAt:{type:Date}
},{timestamps:true});
ppcCampaignSchema.index({sellerId:1,createdAt:-1});
export const PpcCampaignModel=model('PpcCampaign',ppcCampaignSchema);
