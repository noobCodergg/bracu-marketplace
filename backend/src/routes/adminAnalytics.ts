import {Router} from 'express';
import {z} from 'zod';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {CompanyPaymentModel} from '../models/CompanyPayment.js';
import {requestBulkhead} from '../middleware/requestBulkhead.js';


export const adminAnalyticsRouter=Router();
adminAnalyticsRouter.use(requireAuth,requireRole('ADMIN'));
adminAnalyticsRouter.use(requestBulkhead(2,6,4000));
adminAnalyticsRouter.get('/',async(req,res,next)=>{try{
  const {days}=z.object({days:z.coerce.number().pipe(z.union([z.literal(7),z.literal(30),z.literal(90),z.literal(365)])).default(30)}).parse(req.query);
  const now=new Date();
  // Calendar days in Bangladesh, regardless of the server's timezone.
  const today=new Date(now.getTime()+6*3600000).toISOString().slice(0,10);
  const start=new Date(new Date(`${today}T00:00:00+06:00`).getTime()-(days-1)*86400000);
  const match={status:'SUCCEEDED' as const,currency:'BDT' as const,paidAt:{$gte:start,$lte:now}};
  const group=(id:unknown)=>({$group:{_id:id,gross:{$sum:'$amount'},directCosts:{$sum:'$directCost'},purchases:{$sum:1}}});
  const [rows,receipts]=await Promise.all([CompanyPaymentModel.aggregate([{$match:match},{$facet:{summary:[group(null)],breakdown:[group('$product')],trend:[group({$dateToString:{date:'$paidAt',format:'%Y-%m-%d',timezone:'Asia/Dhaka'}})]}}]),CompanyPaymentModel.find(match).sort({paidAt:-1,_id:-1}).limit(50).select('reference buyerEmail product amount directCost paidAt').lean()]);
  const round=(value:number)=>Math.round(value*100)/100;
  const totals=(row:any={})=>({gross:round(row.gross??0),revenue:round(row.gross??0),directCosts:round(row.directCosts??0),profit:round((row.gross??0)-(row.directCosts??0)),purchases:row.purchases??0});
  const result=rows[0]??{summary:[],breakdown:[],trend:[]};const dayMap=new Map(result.trend.map((row:any)=>[row._id,row]));
  const trend=Array.from({length:days},(_,index)=>{const date=new Date(start.getTime()+index*86400000+6*3600000).toISOString().slice(0,10);return {date,...totals(dayMap.get(date))}});
  res.json({success:true,message:'Company analytics loaded',data:{rangeDays:days,summary:totals(result.summary[0]),breakdown:['BOOST','PREMIUM_ANALYTICS'].map(product=>({product,...totals(result.breakdown.find((row:any)=>row._id===product))})),trend,recentPayments:receipts.map(item=>({id:String(item._id),reference:item.reference,buyerEmail:item.buyerEmail,product:item.product,amount:item.amount,directCost:item.directCost,paidAt:item.paidAt.toISOString()}))}});
}catch(error){next(error)}});
