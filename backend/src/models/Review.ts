import {Schema,model} from 'mongoose';

const reviewSchema=new Schema({
  productId:{type:Schema.Types.ObjectId,ref:'Product',required:true,index:true},
  sellerId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  buyerId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  buyer:{type:String,required:true,trim:true},
  avatar:{type:String,default:''},
  rating:{type:Number,required:true,min:1,max:5},
  comment:{type:String,required:true,trim:true,minlength:3,maxlength:1000}
},{timestamps:true});

reviewSchema.index({productId:1,buyerId:1},{unique:true});
export const ReviewModel=model('Review',reviewSchema);
