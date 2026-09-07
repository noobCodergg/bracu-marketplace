import {Router} from 'express';
import {z} from 'zod';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {OrderModel} from '../models/Order.js';
import {ProductModel} from '../models/Product.js';
import {ReviewModel} from '../models/Review.js';
import {UserModel} from '../models/User.js';

export const reviewRouter=Router();
const view=(review:any)=>({id:String(review._id),foodId:String(review.productId),buyer:review.buyer,avatar:review.avatar,rating:review.rating,comment:review.comment,date:review.createdAt.toISOString().slice(0,10),verified:true});

reviewRouter.get('/product/:productId',async(req,res,next)=>{try{
  // Reviews must be visible immediately after submission. A shared CDN cache can
  // otherwise keep returning the previous list even after the database changes.
  res.setHeader('Cache-Control','no-store');
  res.setHeader('CDN-Cache-Control','no-store');
  const reviews=await ReviewModel.find({productId:req.params.productId}).sort({createdAt:-1}).limit(100).lean();
  res.json({success:true,message:'Reviews loaded',data:reviews.map(view)});
}catch(error){next(error)}});
reviewRouter.post('/product/:productId',requireAuth,requireRole('BUYER'),async(req,res,next)=>{try{
  const input=z.object({rating:z.coerce.number().int().min(1).max(5),comment:z.string().trim().min(3).max(1000)}).parse(req.body);
  if(req.authUser!.status!=='ACTIVE'){res.status(403).json({success:false,message:'Only active buyers can review products'});return}
  const [buyer,product,eligible,existing]=await Promise.all([UserModel.findById(req.authUser!.id),ProductModel.findById(req.params.productId),OrderModel.exists({buyerId:req.authUser!.id,productId:req.params.productId,status:{$in:['COMPLETED','DELIVERED']}}),ReviewModel.exists({buyerId:req.authUser!.id,productId:req.params.productId})]);
  if(!buyer||!product){res.status(404).json({success:false,message:'Buyer or product not found'});return}if(!eligible){res.status(403).json({success:false,message:'Complete an order for this product before reviewing'});return}if(existing){res.status(409).json({success:false,message:'You have already reviewed this product'});return}
  const review=await ReviewModel.create({productId:product._id,sellerId:product.sellerId,buyerId:buyer._id,buyer:buyer.name,avatar:buyer.avatar,rating:input.rating,comment:input.comment});
  const summary=await ReviewModel.aggregate([{$match:{productId:product._id}},{$group:{_id:null,average:{$avg:'$rating'}}}]);product.rating=Math.round((summary[0]?.average??0)*10)/10;await product.save();res.status(201).json({success:true,message:'Review submitted',data:view(review)});
}catch(error:any){if(error?.code===11000){res.status(409).json({success:false,message:'You have already reviewed this product'});return}next(error)}});
