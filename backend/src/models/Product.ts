import {Schema,model} from 'mongoose';

const variantSchema=new Schema({
  size:{type:String,trim:true,maxlength:50},
  color:{type:String,trim:true,maxlength:50},
  sku:{type:String,trim:true,maxlength:80},
  price:{type:Number,required:true,min:0},
  discountPrice:{type:Number,min:0},
  costPrice:{type:Number,required:true,min:0,default:0},
  packagingCost:{type:Number,required:true,min:0,default:0},
  otherCost:{type:Number,required:true,min:0,default:0},
  quantity:{type:Number,required:true,min:0,default:0}
},{_id:true});

const productSchema=new Schema({
  sellerId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  seller:{type:String,required:true,trim:true},
  name:{type:String,required:true,trim:true,maxlength:140},
  description:{type:String,required:true,trim:true,maxlength:3000},
  category:{type:String,required:true,trim:true},
  subcategory:{type:String,required:true,trim:true},
  price:{type:Number,required:true,min:0},
  costPrice:{type:Number,min:0,default:0},
  packagingCost:{type:Number,min:0,default:0},
  otherCost:{type:Number,min:0,default:0},
  discountPrice:{type:Number,min:0},
  quantity:{type:Number,required:true,min:0},
  status:{type:String,enum:['ACTIVE','PAUSED','PRE_ORDER_AVAILABLE','OUT_OF_STOCK','REMOVED'],default:'ACTIVE'},
  removalReason:{type:String},removedBy:{type:Schema.Types.ObjectId,ref:'User'},removedAt:{type:Date},
  images:{type:[String],required:true,validate:{validator:(items:string[])=>items.length>=1&&items.length<=8,message:'Add 1 to 8 product images'}},
  variants:{type:[variantSchema],default:[]},
  prepMinutes:{type:Number,required:true,min:0,max:10080},
  dietary:{type:[String],default:[]},
  spicy:{type:Number,default:0,min:0,max:5},
  ingredients:{type:[String],default:[]},
  deliverySlots:{type:[String],default:[]},
  boosted:{type:Boolean,default:false},
  boostEnds:{type:Date},
  rating:{type:Number,default:0,min:0,max:5},
  orders:{type:Number,default:0,min:0},
  seoTitle:{type:String,trim:true,maxlength:160},
  searchKeywords:{type:[String],default:[]},
  metaDescription:{type:String,trim:true,maxlength:300}
},{timestamps:true});

productSchema.index({name:'text',description:'text',category:'text',seller:'text'});
productSchema.index({status:1,category:1,subcategory:1,price:1,_id:1});
productSchema.index({sellerId:1,status:1,updatedAt:-1});
export const ProductModel=model('Product',productSchema);
