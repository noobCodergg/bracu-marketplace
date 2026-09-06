import {Router} from 'express';
import {z} from 'zod';
import {Schema,model} from 'mongoose';
import {requireAuth} from '../middleware/auth.js';
import {UserModel,publicUser} from '../models/User.js';
import {ProductModel} from '../models/Product.js';
import {productViews} from '../services/productView.js';

const savedSchema=new Schema({userId:{type:Schema.Types.ObjectId,required:true},productId:{type:Schema.Types.ObjectId,ref:'Product',required:true}},{timestamps:true});
savedSchema.index({userId:1,productId:1},{unique:true});
const SavedProduct=model('SavedProduct',savedSchema);
export const accountRouter=Router();
accountRouter.use(requireAuth);
accountRouter.get('/profile',async(req,res,next)=>{try{const user=await UserModel.findById(req.authUser!.id);res.json({success:true,data:user?{...publicUser(user),phone:user.phone,notificationPreference:user.notificationPreference}:null})}catch(error){next(error)}});
accountRouter.patch('/profile',async(req,res,next)=>{try{
 const input=z.object({name:z.string().trim().min(2).max(80),phone:z.string().trim().max(30).refine(value=>!value||/^\+?[\d\s-]{10,30}$/.test(value),'Enter a valid phone number'),notificationPreference:z.enum(['ALL','ORDERS'])}).parse(req.body);
 const user=await UserModel.findByIdAndUpdate(req.authUser!.id,input,{new:true,runValidators:true});
 res.json({success:true,message:'Profile updated',data:user?{...publicUser(user),phone:user.phone,notificationPreference:user.notificationPreference}:null});
}catch(error){next(error)}});
accountRouter.get('/saved',async(req,res,next)=>{try{
 const rows=await SavedProduct.find({userId:req.authUser!.id}).sort({createdAt:-1}).populate({path:'productId',match:{status:{$ne:'REMOVED'}},populate:{path:'sellerId',match:{status:'ACTIVE',role:'SELLER'},select:'acceptingOrders'}});
 res.json({success:true,data:await productViews(rows.map(row=>row.productId).filter((product:any)=>product?.sellerId))});
}catch(error){next(error)}});
accountRouter.put('/saved/:id',async(req,res,next)=>{try{
 const id=z.string().regex(/^[a-f\d]{24}$/i).parse(req.params.id);
 if(!await ProductModel.exists({_id:id,status:{$ne:'REMOVED'}})){res.status(404).json({success:false,message:'Product not found'});return}
 await SavedProduct.updateOne({userId:req.authUser!.id,productId:id},{$setOnInsert:{userId:req.authUser!.id,productId:id}},{upsert:true});res.json({success:true,data:null});
}catch(error){next(error)}});
accountRouter.delete('/saved/:id',async(req,res,next)=>{try{await SavedProduct.deleteOne({userId:req.authUser!.id,productId:req.params.id});res.json({success:true,data:null})}catch(error){next(error)}});
