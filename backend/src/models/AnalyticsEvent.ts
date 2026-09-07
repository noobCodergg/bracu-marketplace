import {Schema,model} from 'mongoose';

const analyticsEventSchema=new Schema({
  sellerId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  productId:{type:Schema.Types.ObjectId,ref:'Product',index:true},
  type:{type:String,enum:['LISTING_IMPRESSION','PRODUCT_VIEW','ADD_TO_CART','REMOVE_FROM_CART','CHECKOUT_STARTED','SEARCH'],required:true,index:true},
  visitorId:{type:String,trim:true,maxlength:100,index:true},
  source:{type:String,enum:['ORGANIC_SEARCH','MARKETPLACE','HOMEPAGE','CATEGORY','RECOMMENDATION','SELLER_STORE','PPC','BOOST','DIRECT','OTHER'],default:'DIRECT',index:true},
  campaignId:{type:Schema.Types.ObjectId,ref:'PpcCampaign'},
  query:{type:String,trim:true,maxlength:200},
  quantity:{type:Number,min:1,default:1}
  ,eventBucket:{type:String,trim:true,maxlength:20}
},{timestamps:true});

analyticsEventSchema.index({sellerId:1,createdAt:-1});
analyticsEventSchema.index({sellerId:1,productId:1,type:1,createdAt:-1});
analyticsEventSchema.index({visitorId:1,productId:1,type:1,createdAt:-1});
// Retain enough traffic history for the 30- and 90-day premium reports.
analyticsEventSchema.index({createdAt:1},{expireAfterSeconds:90*24*60*60});
analyticsEventSchema.index({visitorId:1,productId:1,type:1,eventBucket:1},{unique:true,partialFilterExpression:{visitorId:{$type:'string'},eventBucket:{$type:'string'}}});
export const AnalyticsEventModel=model('AnalyticsEvent',analyticsEventSchema);
