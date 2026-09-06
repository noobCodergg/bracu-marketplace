import {Router} from 'express';
import {z} from 'zod';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {PpcCampaignModel} from '../models/PpcCampaign.js';
import {ProductModel} from '../models/Product.js';

export const ppcCampaignRouter=Router();
ppcCampaignRouter.use(requireAuth,requireRole('SELLER'));
const inputSchema=z.object({productId:z.string().regex(/^[a-f\d]{24}$/i),name:z.string().trim().min(3).max(120),keywords:z.array(z.string().trim().min(1).max(80)).max(30).default([]),negativeKeywords:z.array(z.string().trim().min(1).max(80)).max(30).default([]),dailyBudget:z.coerce.number().min(1).max(100000),bid:z.coerce.number().min(.1).max(10000),startsAt:z.coerce.date().optional(),endsAt:z.coerce.date().optional()});
const view=(item:any)=>({id:String(item._id),productId:String(item.productId),name:item.name,keywords:item.keywords,negativeKeywords:item.negativeKeywords,dailyBudget:item.dailyBudget,bid:item.bid,status:item.status,startsAt:item.startsAt.toISOString(),endsAt:item.endsAt?.toISOString()});
ppcCampaignRouter.get('/',async(req,res,next)=>{try{const rows=await PpcCampaignModel.find({sellerId:req.authUser!.id}).sort({createdAt:-1});res.json({success:true,message:'Campaigns loaded',data:rows.map(view)})}catch(error){next(error)}});
ppcCampaignRouter.post('/',async(req,res,next)=>{try{const input=inputSchema.parse(req.body);const product=await ProductModel.findOne({_id:input.productId,sellerId:req.authUser!.id});if(!product){res.status(404).json({success:false,message:'Product not found'});return}const row=await PpcCampaignModel.create({...input,sellerId:req.authUser!.id});res.status(201).json({success:true,message:'Campaign created',data:view(row)})}catch(error){next(error)}});
ppcCampaignRouter.patch('/:id/status',async(req,res,next)=>{try{const {status}=z.object({status:z.enum(['ACTIVE','PAUSED'])}).parse(req.body);const row=await PpcCampaignModel.findOneAndUpdate({_id:req.params.id,sellerId:req.authUser!.id},{status},{new:true});if(!row){res.status(404).json({success:false,message:'Campaign not found'});return}res.json({success:true,message:'Campaign updated',data:view(row)})}catch(error){next(error)}});
