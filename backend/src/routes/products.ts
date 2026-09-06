import {productViews} from '../services/productView.js';
import {Router} from 'express';
import {z} from 'zod';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {ProductModel} from '../models/Product.js';
import {UserModel} from '../models/User.js';
import {OrderModel} from '../models/Order.js';
import {CompanyPaymentModel} from '../models/CompanyPayment.js';
import {publicResponseCache} from '../middleware/publicResponseCache.js';

export const productRouter=Router();
const url=z.string().url().max(2000).refine(value=>new URL(value).protocol==='https:','Image URLs must use HTTPS');
const ignoredKeywords=new Set(['a','an','the','and','or','for','with','near','buy','shop','product','products','item','items','best','new']);
const normalizeKeyword=(value:string)=>value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/-/g,' ').split(/\s+/).filter(word=>word.length>=3&&!ignoredKeywords.has(word)).join(' ').trim();
const keywordPhrase=z.string().trim().min(3).max(80).refine(value=>normalizeKeyword(value).length>=3,'Use a meaningful full word or phrase, not filler words');
const normalizeKeywords=(values:string[])=>[...new Set(values.map(normalizeKeyword).filter(Boolean))].slice(0,30);
const variant=z.object({id:z.string().regex(/^[a-f\d]{24}$/i).optional(),size:z.string().trim().max(50).optional().default(''),color:z.string().trim().max(50).optional().default(''),sku:z.string().trim().max(80).optional().default(''),price:z.coerce.number().positive(),discountPrice:z.coerce.number().positive().nullable().optional(),costPrice:z.coerce.number().min(0),packagingCost:z.coerce.number().min(0),otherCost:z.coerce.number().min(0),quantity:z.coerce.number().int().min(0)});
const productInput=z.object({
  name:z.string().trim().min(3).max(140),description:z.string().trim().min(20).max(3000),
  category:z.string().trim().min(2).max(80),subcategory:z.string().trim().min(2).max(80),
  status:z.enum(['ACTIVE','PAUSED','PRE_ORDER_AVAILABLE','OUT_OF_STOCK']),images:z.array(url).min(1).max(8),variants:z.array(variant).min(1).max(30),
  prepMinutes:z.coerce.number().int().min(0).max(10080),dietary:z.array(z.string().trim().min(1).max(50)).max(20).default([]),spicy:z.coerce.number().int().min(0).max(5),
  ingredients:z.array(z.string().trim().min(1).max(100)).max(50).default([]),deliverySlots:z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  seoTitle:z.string().trim().max(160).optional().default(''),searchKeywords:z.array(keywordPhrase).max(30).default([]),metaDescription:z.string().trim().max(300).optional().default('')
}).superRefine((value,ctx)=>{
  value.variants.forEach((item,index)=>{if(item.discountPrice!=null&&item.discountPrice>=item.price)ctx.addIssue({code:'custom',path:['variants',index,'discountPrice'],message:'Discount price must be lower than regular price'})});
  const apparel=["Men's Clothing","Men's Accessories","Women's Clothing","Women's Accessories",'Kids Items'];
  if(value.category==='Stationery'&&(value.variants.length!==1||value.variants[0]?.size||value.variants[0]?.color))ctx.addIssue({code:'custom',path:['variants'],message:'Stationery requires one default variant without size or color'});
  if(value.category==='Food'){
    const sizes=value.variants.map(item=>item.size.toLowerCase());
    if(value.variants.some(item=>!['small','medium','large'].includes(item.size.toLowerCase())||item.color))ctx.addIssue({code:'custom',path:['variants'],message:'Food variants may only use Small, Medium or Large sizes'});
    if(new Set(sizes).size!==sizes.length)ctx.addIssue({code:'custom',path:['variants'],message:'Each food size can only be added once'});
  }
  if(apparel.includes(value.category)&&value.variants.some(item=>!item.color||!item.size))ctx.addIssue({code:'custom',path:['variants'],message:'Each clothing, accessories or kids variant requires both color and size'});
});


productRouter.get('/',publicResponseCache(15_000),async(req,res,next)=>{try{
 const input=z.object({q:z.string().trim().max(140).default(''),category:z.string().max(80).default(''),subcategory:z.string().max(80).default(''),special:z.enum(['all','discounted','featured']).catch('all'),sort:z.string().default('Recommended'),maxPrice:z.coerce.number().positive().catch(5000),page:z.coerce.number().int().min(1).catch(1),paginated:z.string().optional()}).parse(req.query);
 const {q,category,subcategory,special,sort,maxPrice,page}=input,pageSize=40;
 const filter:any={status:{$in:['ACTIVE','PRE_ORDER_AVAILABLE']},price:{$lte:maxPrice},...(category&&category!=='All'?{category}:{}),...(subcategory&&subcategory!=='All'?{subcategory}:{}),...(q?{$text:{$search:q}}:{})};
 if(special==='discounted')filter['variants.discountPrice']={$gt:0};
 const boost={$and:[{$eq:['$boosted',true]},{$or:[{$eq:[{$ifNull:['$boostEnds',null]},null]},{$gt:['$boostEnds',new Date()]}]}]};
 const sorting:any=sort==='Price low to high'?{price:1,_id:1}:sort==='Price high to low'?{price:-1,_id:1}:sort==='Newest'?{createdAt:-1,_id:1}:{effectiveBoost:-1,rating:-1,createdAt:-1,_id:1};
 const [result]=await ProductModel.aggregate([{$match:filter},{$lookup:{from:'users',localField:'sellerId',foreignField:'_id',as:'owner',pipeline:[{$match:{status:'ACTIVE',role:'SELLER'}},{$project:{acceptingOrders:1}}]}},{$match:{'owner.0':{$exists:true}}},{$set:{effectiveBoost:boost}},...(special==='featured'?[{$match:{effectiveBoost:true}}]:[]),{$sort:sorting},{$facet:{total:[{$count:'count'}],items:[{$skip:input.paginated==='true'?(page-1)*pageSize:0},{$limit:pageSize}]}}]).option({maxTimeMS:3000});
 const products=result?.items??[],total=result?.total[0]?.count??0;
 const items=await productViews(products.map((product:any)=>({...product,sellerId:{_id:product.sellerId,acceptingOrders:product.owner[0].acceptingOrders}})));
 res.json({success:true,message:'Products loaded',data:input.paginated==='true'?{items,total,page,pageSize,totalPages:Math.max(1,Math.ceil(total/pageSize))}:items});
}catch(error){next(error)}});
productRouter.get('/best-selling',publicResponseCache(60_000),async(_req,res,next)=>{try{
 const rows=await OrderModel.aggregate([{$match:{status:{$in:['COMPLETED','DELIVERED']}}},{$group:{_id:'$productId',units:{$sum:'$quantity'}}},{$sort:{units:-1,_id:1}},{$lookup:{from:'products',localField:'_id',foreignField:'_id',as:'product'}},{$unwind:'$product'},{$match:{'product.status':{$in:['ACTIVE','PRE_ORDER_AVAILABLE']}}},{$lookup:{from:'users',localField:'product.sellerId',foreignField:'_id',as:'owner'}},{$match:{'owner.0.status':'ACTIVE','owner.0.role':'SELLER'}},{$limit:6}]);
 res.json({success:true,data:await productViews(rows.map(row=>({...row.product,sellerId:row.owner[0]})))});
}catch(error){next(error)}});
productRouter.get('/seller/:sellerId/availability',publicResponseCache(15_000),async(req,res,next)=>{try{const seller=await UserModel.findOne({_id:req.params.sellerId,role:'SELLER'}).select('acceptingOrders').lean();if(!seller){res.status(404).json({success:false,message:'Seller not found'});return}res.json({success:true,message:'Seller availability loaded',data:seller.acceptingOrders??true})}catch(error){next(error)}});
productRouter.patch('/seller/availability',requireAuth,requireRole('SELLER'),async(req,res,next)=>{try{const {accepting}=z.object({accepting:z.boolean()}).parse(req.body);const seller=await UserModel.findByIdAndUpdate(req.authUser!.id,{acceptingOrders:accepting},{new:true});res.json({success:true,message:accepting?'Store is now taking orders':'Store is no longer taking orders',data:seller?.acceptingOrders??accepting})}catch(error){next(error)}});
productRouter.get('/mine',requireAuth,requireRole('SELLER'),async(req,res,next)=>{try{const products=await ProductModel.find({sellerId:req.authUser!.id}).sort({updatedAt:-1}).populate('sellerId','acceptingOrders');res.json({success:true,message:'Seller products loaded',data:await productViews(products,true)})}catch(error){next(error)}});
productRouter.get('/mine/:id',requireAuth,requireRole('SELLER'),async(req,res,next)=>{try{const product=await ProductModel.findOne({_id:req.params.id,sellerId:req.authUser!.id,status:{$ne:'REMOVED'}});if(!product){res.status(404).json({success:false,message:'Product not found'});return}res.json({success:true,message:'Product loaded',data:(await productViews([product],true))[0]})}catch(error){next(error)}});
productRouter.get('/:id',publicResponseCache(15_000),async(req,res,next)=>{try{const product=await ProductModel.findOne({_id:req.params.id,status:{$ne:'REMOVED'}}).populate('sellerId','acceptingOrders status role').maxTimeMS(3000);if(!product||!(product.sellerId as any)?.status||(product.sellerId as any).status!=='ACTIVE'){res.status(404).json({success:false,message:'Product not found'});return}res.json({success:true,message:'Product loaded',data:(await productViews([product]))[0]})}catch(error){next(error)}});
productRouter.post('/',requireAuth,requireRole('SELLER'),async(req,res,next)=>{try{if(req.authUser!.status!=='ACTIVE'){res.status(403).json({success:false,message:'Only active sellers can create products'});return}const input={...productInput.parse(req.body),searchKeywords:normalizeKeywords(productInput.parse(req.body).searchKeywords)};const seller=await UserModel.findById(req.authUser!.id);if(!seller){res.status(404).json({success:false,message:'Seller not found'});return}const price=Math.min(...input.variants.map(item=>item.discountPrice??item.price)),quantity=input.variants.reduce((sum,item)=>sum+item.quantity,0);const product=await ProductModel.create({...input,variants:input.variants.map(({id,...item})=>item),price,quantity,sellerId:seller._id,seller:seller.store??seller.name});res.status(201).json({success:true,message:'Product created',data:(await productViews([product]))[0]})}catch(error){next(error)}});
productRouter.patch('/:id',requireAuth,requireRole('SELLER'),async(req,res,next)=>{try{
 const input=productInput.parse(req.body);
 const product=await ProductModel.findOne({_id:req.params.id,sellerId:req.authUser!.id,status:{$ne:'REMOVED'}});
 if(!product){res.status(404).json({success:false,message:'Product not found or not owned by you'});return}
 const ids=input.variants.flatMap(item=>item.id?[item.id]:[]);
 if(new Set(ids).size!==ids.length||ids.some(id=>!product.variants.id(id))){res.status(400).json({success:false,message:'Invalid or duplicate variant identifier'});return}
 product.set({...input,variants:input.variants.map(({id,...item})=>({...item,...(id?{_id:id}:{})})),searchKeywords:normalizeKeywords(input.searchKeywords),price:Math.min(...input.variants.map(item=>item.discountPrice??item.price)),quantity:input.variants.reduce((sum,item)=>sum+item.quantity,0)});
 await product.save();res.json({success:true,message:'Product updated',data:(await productViews([product],true))[0]});
}catch(error){next(error)}});
productRouter.patch('/:id/status',requireAuth,requireRole('SELLER'),async(req,res,next)=>{try{const {status}=z.object({status:z.enum(['ACTIVE','PAUSED','PRE_ORDER_AVAILABLE','OUT_OF_STOCK'])}).parse(req.body);const product=await ProductModel.findOneAndUpdate({_id:req.params.id,sellerId:req.authUser!.id,status:{$ne:'REMOVED'}},{status},{new:true,runValidators:true});if(!product){res.status(404).json({success:false,message:'Product not found or not owned by you'});return}res.json({success:true,message:'Product status updated',data:(await productViews([product]))[0]})}catch(error){next(error)}});
productRouter.post('/:id/boost',requireAuth,requireRole('SELLER'),async(req,res,next)=>{try{if(req.authUser!.status!=='ACTIVE'){res.status(403).json({success:false,message:'Only active sellers can boost products'});return}const {days}=z.object({days:z.coerce.number().pipe(z.union([z.literal(1),z.literal(7),z.literal(30)]))}).parse(req.body);const product=await ProductModel.findOne({_id:req.params.id,sellerId:req.authUser!.id,status:{$ne:'REMOVED'}});if(!product){res.status(404).json({success:false,message:'Product not found or not owned by you'});return}if(product.boosted&&product.boostEnds&&product.boostEnds.getTime()>Date.now()){res.status(409).json({success:false,message:`This product is already boosted until ${product.boostEnds.toISOString().slice(0,10)}`});return}const prices={1:149,7:599,30:1499} as const;const payment=await CompanyPaymentModel.findOneAndUpdate({userId:req.authUser!.id,product:'BOOST',status:'SUCCEEDED',amount:{$gte:prices[days]},consumedAt:{$exists:false}},{$set:{consumedAt:new Date(),resourceId:product._id}},{new:true,sort:{paidAt:1}});if(!payment){res.status(403).json({success:false,message:'A verified unused boost payment is required'});return}try{product.boosted=true;product.boostEnds=new Date(Date.now()+days*24*60*60*1000);await product.save()}catch(error){await CompanyPaymentModel.updateOne({_id:payment._id,resourceId:product._id},{$unset:{consumedAt:1,resourceId:1}});throw error}res.json({success:true,message:`Premium boost activated for ${days} day${days===1?'':'s'}`,data:(await productViews([product]))[0]})}catch(error){next(error)}});
productRouter.delete('/:id',requireAuth,requireRole('SELLER'),async(req,res,next)=>{try{const product=await ProductModel.findOneAndDelete({_id:req.params.id,sellerId:req.authUser!.id,status:{$ne:'REMOVED'}});if(!product){res.status(404).json({success:false,message:'Product not found or not owned by you'});return}res.json({success:true,message:'Product deleted',data:{id:String(product._id)}})}catch(error){next(error)}});
