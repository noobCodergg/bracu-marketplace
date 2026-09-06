import {Router} from 'express';
import {z} from 'zod';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {CouponModel} from '../models/Coupon.js';
import {UserModel} from '../models/User.js';

export const couponRouter=Router();
const codeSchema=z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/,'Use 3-30 letters, numbers, underscores or hyphens');
const view=(coupon:any)=>({id:String(coupon._id),sellerId:String(coupon.sellerId),seller:coupon.seller,code:coupon.code,discountPercent:coupon.discountPercent,active:coupon.active,createdAt:coupon.createdAt.toISOString().slice(0,10),redemptions:coupon.redemptions});

couponRouter.get('/',requireAuth,requireRole('SELLER'),async(req,res,next)=>{try{const coupons=await CouponModel.find({sellerId:req.authUser!.id}).sort({createdAt:-1});res.json({success:true,message:'Coupons loaded',data:coupons.map(view)})}catch(error){next(error)}});
couponRouter.post('/',requireAuth,requireRole('SELLER'),async(req,res,next)=>{try{if(req.authUser!.status!=='ACTIVE'){res.status(403).json({success:false,message:'Only active sellers can create coupons'});return}const input=z.object({code:codeSchema,discountPercent:z.coerce.number().int().min(1).max(90)}).parse(req.body);const seller=await UserModel.findById(req.authUser!.id);if(!seller){res.status(404).json({success:false,message:'Seller not found'});return}const coupon=await CouponModel.create({...input,sellerId:seller._id,seller:seller.store??seller.name});res.status(201).json({success:true,message:'Coupon created',data:view(coupon)})}catch(error:any){if(error?.code===11000){res.status(409).json({success:false,message:'This coupon code already exists'});return}next(error)}});
couponRouter.patch('/:id/toggle',requireAuth,requireRole('SELLER'),async(req,res,next)=>{try{const coupon=await CouponModel.findOne({_id:req.params.id,sellerId:req.authUser!.id});if(!coupon){res.status(404).json({success:false,message:'Coupon not found'});return}coupon.active=!coupon.active;await coupon.save();res.json({success:true,message:`Coupon ${coupon.active?'activated':'paused'}`,data:view(coupon)})}catch(error){next(error)}});
couponRouter.post('/validate',requireAuth,async(req,res,next)=>{try{const input=z.object({code:codeSchema,sellerIds:z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(100)}).parse(req.body);const coupon=await CouponModel.findOne({code:input.code,active:true});if(!coupon){res.status(404).json({success:false,message:'Invalid or inactive coupon'});return}if(!input.sellerIds.includes(String(coupon.sellerId))){res.status(400).json({success:false,message:'This coupon does not apply to items in your cart'});return}res.json({success:true,message:'Coupon applied',data:view(coupon)})}catch(error){next(error)}});
