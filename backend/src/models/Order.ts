import {Schema,model} from 'mongoose';

const extensionSchema=new Schema({
  minutes:{type:Number,required:true,min:15,max:120},
  reason:{type:String,required:true,trim:true,maxlength:500},
  status:{type:String,enum:['PENDING','APPROVED','REJECTED'],default:'PENDING',required:true},
  requestedAt:{type:Date,required:true,default:Date.now},
  decidedAt:{type:Date}
},{_id:false});

const orderSchema=new Schema({
  notificationEvents:{type:[new Schema({userId:{type:Schema.Types.ObjectId,required:true},resourceId:{type:Schema.Types.ObjectId},type:{type:String,required:true},title:{type:String,required:true},message:{type:String,required:true},link:{type:String}})],default:[]},
  idempotencyKey:{type:String},requestHash:{type:String},
  buyerId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  sellerId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  productId:{type:Schema.Types.ObjectId,ref:'Product',required:true,index:true},
  variantId:{type:Schema.Types.ObjectId},
  variantLabel:{type:String,trim:true},
  food:{type:String,required:true,trim:true},
  itemType:{type:String,enum:['FOOD','PRODUCT'],required:true},
  image:{type:String,required:true},
  buyer:{type:String,required:true,trim:true},
  seller:{type:String,required:true,trim:true},
  quantity:{type:Number,required:true,min:1,max:10000},
  unitPrice:{type:Number,required:true,min:0},
  unitCost:{type:Number,min:0,default:0},
  inventoryReserved:{type:Boolean,default:false},
  total:{type:Number,required:true,min:0},
  couponId:{type:Schema.Types.ObjectId,ref:'Coupon'},
  couponCode:{type:String,trim:true},
  discountPercent:{type:Number,min:1,max:90},
  discountAmount:{type:Number,min:0},
  deliveryDate:{type:String,required:true},
  deliveryTime:{type:String,required:true},
  allocatedDeliveryAt:{type:Date,required:true},
  deliveryAddress:{type:String,required:true,trim:true,maxlength:500},
  phone:{type:String,required:true,trim:true,maxlength:30},
  instructions:{type:String,trim:true,maxlength:250},
  status:{type:String,enum:['PENDING','ACCEPTED','PREPARING','READY','OUT_FOR_DELIVERY','PACKED','DELIVERED','COMPLETED','CANCELLED','RETURNED'],default:'PENDING',required:true,index:true},
  cancellationReason:{type:String,trim:true,maxlength:300},
  attributionSource:{type:String,enum:['ORGANIC_SEARCH','MARKETPLACE','HOMEPAGE','CATEGORY','RECOMMENDATION','SELLER_STORE','PPC','BOOST','DIRECT','OTHER'],default:'DIRECT',index:true},
  attributionCampaignId:{type:Schema.Types.ObjectId,ref:'PpcCampaign'},
  extension:{type:extensionSchema}
},{timestamps:true});

orderSchema.index({buyerId:1,createdAt:-1});
orderSchema.index({buyerId:1,idempotencyKey:1},{unique:true,partialFilterExpression:{idempotencyKey:{$type:'string'}}});
orderSchema.index({sellerId:1,createdAt:-1});
orderSchema.index({buyerId:1,status:1,createdAt:-1});
orderSchema.index({sellerId:1,status:1,createdAt:-1});
export const OrderModel=model('Order',orderSchema);
