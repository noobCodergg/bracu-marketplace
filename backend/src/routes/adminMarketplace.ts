import {Router} from 'express';
import {z} from 'zod';
import {Schema,model} from 'mongoose';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {ProductModel} from '../models/Product.js';
import {UserModel} from '../models/User.js';
import {OrderModel} from '../models/Order.js';
import {publicResponseCache} from '../middleware/publicResponseCache.js';
import {SellerApplicationModel} from '../models/SellerApplication.js';
import {ReportModel} from '../models/Report.js';
import {productView} from '../services/productView.js';

const PlatformSettings=model('PlatformSettings',new Schema({_id:{type:String,default:'platform'},name:{type:String,default:'B Market'},supportEmail:{type:String,default:''},announcement:{type:String,default:''}},{timestamps:true}));
export const platformRouter=Router();
platformRouter.get('/',publicResponseCache(60_000),async(_req,res,next)=>{try{res.json({success:true,data:await PlatformSettings.findById('platform').lean()??{name:'B Market',supportEmail:'',announcement:''}})}catch(error){next(error)}});
platformRouter.patch('/',requireAuth,requireRole('ADMIN'),async(req,res,next)=>{try{const input=z.object({name:z.string().trim().min(3).max(100),supportEmail:z.union([z.email(),z.literal('')]),announcement:z.string().trim().max(500)}).parse(req.body);const data=await PlatformSettings.findByIdAndUpdate('platform',input,{upsert:true,new:true,runValidators:true});res.json({success:true,data})}catch(error){next(error)}});
export const adminMarketplaceRouter=Router();
adminMarketplaceRouter.use(requireAuth,requireRole('ADMIN'));
adminMarketplaceRouter.get('/overview',async(_req,res,next)=>{try{
 const [users,sellers,approvals,reports,sales]=await Promise.all([UserModel.countDocuments(),UserModel.countDocuments({role:'SELLER',status:'ACTIVE'}),SellerApplicationModel.countDocuments({status:'PENDING'}),ReportModel.countDocuments({status:{$in:['OPEN','UNDER_REVIEW']}}),OrderModel.aggregate([{$match:{status:{$in:['COMPLETED','DELIVERED']}}},{$group:{_id:null,total:{$sum:'$total'},orders:{$sum:1}}}])]);
 res.json({success:true,data:{users,sellers,approvals,reports,sales:sales[0]?.total??0,completedOrders:sales[0]?.orders??0}});
}catch(error){next(error)}});
adminMarketplaceRouter.get('/products',async(req,res,next)=>{try{
 const {page,status,q}=z.object({page:z.coerce.number().int().min(1).default(1),status:z.enum(['ALL','ACTIVE','PAUSED','PRE_ORDER_AVAILABLE','OUT_OF_STOCK','REMOVED']).default('ALL'),q:z.string().trim().max(140).default('')}).parse(req.query);
 const escaped=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const filter={...(status==='ALL'?{}:{status}),...(q?{$or:[{name:{$regex:escaped,$options:'i'}},{seller:{$regex:escaped,$options:'i'}}]}:{})};
 const [products,total]=await Promise.all([ProductModel.find(filter).sort({createdAt:-1,_id:1}).skip((page-1)*40).limit(40),ProductModel.countDocuments(filter)]);
 res.json({success:true,data:{items:products.map(item=>({...productView(item),removalReason:item.removalReason})),total,page,totalPages:Math.max(1,Math.ceil(total/40))}});
}catch(error){next(error)}});
adminMarketplaceRouter.patch('/products/:id/remove',async(req,res,next)=>{try{
 const {reason}=z.object({reason:z.string().trim().min(3).max(1000)}).parse(req.body);
 const product=await ProductModel.findByIdAndUpdate(req.params.id,{$set:{status:'REMOVED',removalReason:reason,removedBy:req.authUser!.id,removedAt:new Date()}},{new:true,runValidators:true});
 if(!product){res.status(404).json({success:false,message:'Product not found'});return}res.json({success:true,data:productView(product)});
}catch(error){next(error)}});
