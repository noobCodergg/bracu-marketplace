import assert from 'node:assert/strict';
import {after,before,describe,test} from 'node:test';
import {createServer,type Server} from 'node:http';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {app} from '../app.js';
import {env} from '../config/env.js';
import {UserModel} from '../models/User.js';
import {ProductModel} from '../models/Product.js';
import {OrderModel} from '../models/Order.js';
import {NotificationModel} from '../models/Notification.js';
import {CompanyPaymentModel} from '../models/CompanyPayment.js';
import {PpcCampaignModel} from '../models/PpcCampaign.js';
import {ReportModel} from '../models/Report.js';
import {SellerApplicationModel} from '../models/SellerApplication.js';
import {ReactivationRequestModel} from '../models/ReactivationRequest.js';
import {internalLoadTestSecret} from '../middleware/userRateLimiter.js';
import {deliverOrderNotifications} from '../services/orderNotifications.js';
import {notifyUser} from '../services/notifications.js';
import {productView} from '../services/productView.js';

test('public product DTO excludes all cost fields; owner DTO includes them',()=>{
 const product=new ProductModel({name:'Test product',description:'A sufficiently long description',price:100,quantity:1,variants:[{price:100,costPrice:55,packagingCost:5,otherCost:2,quantity:1}],images:['https://example.com/product.png']});
 assert.equal('costPrice' in productView(product).variants[0],false);
 assert.equal('packagingCost' in productView(product).variants[0],false);
 assert.equal(productView(product,true).variants[0].costPrice,55);
});

describe('isolated database platform regression',{skip:process.env.RUN_DB_TESTS!=='1'},()=>{
 const databaseName='bracu_regression_'+randomUUID().replaceAll('-','');
 let server:Server,base:string,seller:any,buyer:any,admin:any,product:any;
 let sellerCookie='',buyerCookie='',adminCookie='';
 const password=randomUUID()+'Aa1!';
 async function request(path:string,method='GET',body?:unknown,cookie='',bypassLimiter=true){
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(bypassLimiter?{'X-Internal-Load-Test-Secret':internalLoadTestSecret,'X-Load-Test-User':randomUUID()}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,body:await response.json() as any,cookie:response.headers.get('set-cookie')?.split(';')[0]??''};
 }
 const productInput=(price=100)=>({name:'Regression pen',description:'A stationery product for isolated regression testing.',category:'Stationery',subcategory:'Pens',status:'ACTIVE',images:['https://example.com/product.png'],variants:[{price,discountPrice:80,costPrice:55,packagingCost:5,otherCost:2,quantity:50}],prepMinutes:0,spicy:0,ingredients:[],dietary:[],deliverySlots:[],searchKeywords:[],seoTitle:'',metaDescription:''});
 const orderInput=()=>({idempotencyKey:randomUUID(),foodId:product.id,variantId:product.variants[0].id,quantity:1,deliveryDate:'2099-01-01',deliveryTime:'12:00',deliveryAddress:'Regression test address, Dhaka',phone:'01700000000'});
 before(async()=>{
  // Never run fixtures or cleanup against the configured application database.
  await mongoose.connect(env.MONGODB_URI,{dbName:databaseName,serverSelectionTimeoutMS:15000});
  assert.equal(mongoose.connection.name,databaseName);
  await Promise.all([UserModel.init(),ProductModel.init(),OrderModel.init(),NotificationModel.init(),CompanyPaymentModel.init(),ReportModel.init(),ReactivationRequestModel.init()]);
  const passwordHash=await bcrypt.hash(password,4);
  [seller,buyer,admin]=await UserModel.create([{name:'Test seller',email:'seller@regression.test',role:'SELLER',passwordHash},{name:'Test buyer',email:'buyer@regression.test',role:'BUYER',passwordHash},{name:'Test admin',email:'admin@regression.test',role:'ADMIN',passwordHash}]);
  server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
  sellerCookie=(await request('/auth/login','POST',{email:seller.email,password})).cookie;
  buyerCookie=(await request('/auth/login','POST',{email:buyer.email,password})).cookie;
  adminCookie=(await request('/auth/login','POST',{email:admin.email,password})).cookie;
  const created=await request('/products','POST',productInput(),sellerCookie);assert.equal(created.status,201);product=created.body.data;
 });
 after(async()=>{
  if(server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  if(mongoose.connection.readyState===1){assert.match(databaseName,/^bracu_regression_[a-f0-9]{32}$/);assert.equal(mongoose.connection.name,databaseName);await mongoose.connection.dropDatabase();}
  await mongoose.disconnect();
 });
 test('public and owned product endpoints have different cost permissions',async()=>{
  const publicResult=await request('/products/'+product.id);assert.equal(publicResult.status,200);assert.equal('costPrice' in publicResult.body.data.variants[0],false);
  const privateResult=await request('/products/mine/'+product.id,'GET',undefined,sellerCookie);assert.equal(privateResult.body.data.variants[0].costPrice,55);
  assert.equal((await request('/products/mine/'+product.id,'GET',undefined,buyerCookie)).status,403);
 });
 test('editing a listing preserves variant identity and rejects foreign IDs',async()=>{
  const input={...productInput(),name:'Edited pen',variants:product.variants.map((item:any)=>({...item,costPrice:55,packagingCost:5,otherCost:2}))};
  const response=await request('/products/'+product.id,'PATCH',input,sellerCookie);assert.equal(response.status,200);assert.equal(response.body.data.variants[0].id,product.variants[0].id);
  assert.equal((await request('/products/'+product.id,'PATCH',{...input,variants:[{...input.variants[0],id:String(new mongoose.Types.ObjectId())}]},sellerCookie)).status,400);
 });
 test('concurrent checkout retries create exactly one order and enforce payload consistency',async()=>{
  const input=orderInput();const result=await Promise.all([request('/orders','POST',input,buyerCookie),request('/orders','POST',input,buyerCookie)]);
  assert.ok(result.every(item=>[200,201].includes(item.status)),JSON.stringify(result.map(item=>item.body)));
  assert.equal(result[0]!.body.data.id,result[1]!.body.data.id);assert.equal(await OrderModel.countDocuments({idempotencyKey:input.idempotencyKey}),1);
  assert.equal(result[0]!.body.data.total,80);
  assert.equal((await ProductModel.findById(product.id))?.variants[0]?.quantity,49);
  assert.equal((await request('/orders','POST',{...input,quantity:2},buyerCookie)).status,409);
 });
 test('stocked orders reserve units while pre-orders do not',async()=>{
  const created=await request('/products','POST',{...productInput(),name:'Regression pre-order pen',status:'PRE_ORDER_AVAILABLE',variants:[{...productInput().variants[0],quantity:3}]},sellerCookie);assert.equal(created.status,201);
  const preOrder=created.body.data;const placed=await request('/orders','POST',{...orderInput(),foodId:preOrder.id,variantId:preOrder.variants[0].id,quantity:2},buyerCookie);assert.equal(placed.status,201);
  assert.equal((await ProductModel.findById(preOrder.id))?.variants[0]?.quantity,3);
 });
 test('one user can call one normal API at most twenty times per second',async()=>{
  for(let index=0;index<20;index++)assert.equal((await request('/orders','POST',orderInput(),buyerCookie,false)).status,201);
  assert.equal((await request('/orders','POST',orderInput(),buyerCookie,false)).status,429);
  await new Promise(resolve=>setTimeout(resolve,1050));
  assert.equal((await request('/orders','POST',orderInput(),buyerCookie,false)).status,201);
 });
 test('simultaneous terminal transitions commit once and notification retries do not duplicate',async()=>{
  const created=await request('/orders','POST',orderInput(),buyerCookie);const id=created.body.data.id;
  const results=await Promise.all([request('/orders/'+id+'/status','PATCH',{status:'DELIVERED'},sellerCookie),request('/orders/'+id+'/status','PATCH',{status:'DELIVERED'},sellerCookie)]);
  assert.ok(results.some(item=>item.status===200));assert.ok(results.every(item=>[200,409].includes(item.status)));
  const order=await OrderModel.findById(id);assert.equal(order?.notificationEvents.filter(item=>item.type==='ORDER_STATUS').length,1);
  await deliverOrderNotifications();const count=await NotificationModel.countDocuments();await deliverOrderNotifications();assert.equal(await NotificationModel.countDocuments(),count);
  const details=await request('/products/'+product.id);assert.equal(details.body.data.orders,1);
 });
 test('expired timed ban can sign in again',async()=>{
  await UserModel.updateOne({_id:buyer._id},{status:'BANNED',restrictionEnds:new Date(Date.now()-1000),$inc:{tokenVersion:1}});
  const login=await request('/auth/login','POST',{email:buyer.email,password});assert.equal(login.status,200);assert.equal(login.body.data.status,'ACTIVE');buyerCookie=login.cookie;
 });
 test('restricted seller cannot mutate products and buyers cannot order from that seller',async()=>{
  await UserModel.updateOne({_id:seller._id},{status:'SUSPENDED'});
  assert.equal((await request('/products/'+product.id+'/status','PATCH',{status:'PAUSED'},sellerCookie)).status,403);
  assert.equal((await request('/orders','POST',orderInput(),buyerCookie)).status,409);
  await UserModel.updateOne({_id:seller._id},{status:'ACTIVE'});
 });
 test('explicit price sort works and invalid input returns 400',async()=>{
  for(const price of [200,150])await request('/products','POST',{...productInput(price),variants:[{...productInput(price).variants[0],discountPrice:undefined}]},sellerCookie);
  const result=await request('/products?sort=Price%20low%20to%20high&paginated=true');const prices=result.body.data.items.map((item:any)=>item.price);assert.deepEqual(prices,[...prices].sort((a,b)=>a-b));
  assert.equal((await request('/products/not-an-id')).status,400);
 });
 test('profile and saved products persist and remain account-scoped',async()=>{
  assert.equal((await request('/account/profile','PATCH',{name:'Updated buyer',phone:'01700000000',notificationPreference:'ORDERS'},buyerCookie)).status,200);
  assert.equal((await request('/account/profile','GET',undefined,buyerCookie)).body.data.name,'Updated buyer');
  await request('/account/saved/'+product.id,'PUT',undefined,buyerCookie);assert.equal((await request('/account/saved','GET',undefined,buyerCookie)).body.data.length,1);assert.equal((await request('/account/saved','GET',undefined,sellerCookie)).body.data.length,0);
  await request('/account/saved/'+product.id,'DELETE',undefined,buyerCookie);assert.equal((await request('/account/saved','GET',undefined,buyerCookie)).body.data.length,0);
 });
 test('admin inventory includes paused items; removal and settings persist',async()=>{
  const created=await request('/products','POST',{...productInput(),status:'PAUSED'},sellerCookie);const id=created.body.data.id;
  assert.equal((await request('/admin/marketplace/products?status=PAUSED','GET',undefined,adminCookie)).body.data.total,1);
  assert.equal((await request('/admin/marketplace/products/'+id+'/remove','PATCH',{reason:'Policy violation'},adminCookie)).status,200);
  assert.equal((await ProductModel.findById(id))?.removalReason,'Policy violation');assert.equal((await request('/products/'+id)).status,404);
  assert.equal((await request('/products/'+id+'/status','PATCH',{status:'ACTIVE'},sellerCookie)).status,404);
  await request('/platform','PATCH',{name:'Regression marketplace',supportEmail:'support@regression.test',announcement:'Test announcement'},adminCookie);assert.equal((await request('/platform')).body.data.announcement,'Test announcement');
 });
 test('SEO metadata updates the owned database product',async()=>{
  assert.equal((await request('/seller/analytics/product-intelligence-settings/'+product.id,'PATCH',{seoTitle:'Campus stationery pen for students',searchKeywords:['stationery','campus pen','student supplies'],metaDescription:'A good pen for students.'},sellerCookie)).status,200);
  assert.equal((await ProductModel.findById(product.id))?.seoTitle,'Campus stationery pen for students');
 });
 test('company aggregation excludes pending payments and PPC excludes organic sales',async()=>{
  await CompanyPaymentModel.create([{reference:'regression-paid',userId:buyer._id,buyerEmail:buyer.email,product:'BOOST',status:'SUCCEEDED',amount:300,directCost:10,paidAt:new Date()},{reference:'regression-pending',userId:buyer._id,buyerEmail:buyer.email,product:'PREMIUM_ANALYTICS',status:'PENDING',amount:1000,paidAt:new Date()}]);
  const result=await request('/admin/analytics','GET',undefined,adminCookie);assert.equal(result.status,200);assert.equal(result.body.data.summary.profit,290);assert.equal(result.body.data.summary.purchases,1);
  await PpcCampaignModel.create({sellerId:seller._id,productId:product.id,name:'Test campaign',dailyBudget:100,bid:2});
  const basic=await request('/seller/analytics?days=365','GET',undefined,sellerCookie);assert.equal(basic.status,200);assert.equal(basic.body.data.summary.revenue,18);assert.equal(basic.body.data.summary.totalCost,62);assert.equal(basic.body.data.summary.grossSales,80);assert.equal(basic.body.data.summary.completedOrders,1);assert.equal(basic.body.data.topProducts.find((row:any)=>row.id===product.id)?.orders,1);assert.equal(basic.body.data.trend.reduce((sum:number,row:any)=>sum+row.orders,0),1);
  const premium=await request('/seller/analytics/premium','GET',undefined,sellerCookie);assert.equal(premium.status,200);assert.equal(premium.body.data.summary.sales,18);assert.equal(premium.body.data.summary.profit,18);assert.equal(premium.body.data.customers.averageNetRevenue,18);assert.equal('promotionSimulator' in premium.body.data,false);assert.equal(premium.body.data.ppc[0].sales,0);assert.equal(premium.body.data.ppc[0].clicks,0);
 });
 test('returned discounted and coupon orders restore stock and leave analytics',async()=>{
  const coupon=await request('/coupons','POST',{code:'RETURN10',discountPercent:10},sellerCookie);assert.equal(coupon.status,201);
  const beforeStock=(await ProductModel.findById(product.id))!.variants[0]!.quantity;
  const created=await request('/orders','POST',{...orderInput(),couponCode:'RETURN10'},buyerCookie);assert.equal(created.status,201);assert.equal(created.body.data.total,72);
  assert.equal((await request('/orders/'+created.body.data.id+'/status','PATCH',{status:'RETURNED'},sellerCookie)).status,409);
  assert.equal((await request('/orders/'+created.body.data.id+'/status','PATCH',{status:'DELIVERED'},sellerCookie)).status,200);
  const withSale=await request('/seller/analytics?days=365','GET',undefined,sellerCookie);assert.equal(withSale.body.data.summary.revenue,28);assert.equal(withSale.body.data.summary.totalDiscounts,8);
  const returned=await request('/orders/'+created.body.data.id+'/status','PATCH',{status:'RETURNED'},sellerCookie);assert.equal(returned.status,200);assert.equal(returned.body.data.status,'RETURNED');
  assert.equal((await ProductModel.findById(product.id))!.variants[0]!.quantity,beforeStock);
  const afterReturn=await request('/seller/analytics?days=365','GET',undefined,sellerCookie);assert.equal(afterReturn.body.data.summary.revenue,18);assert.equal(afterReturn.body.data.summary.totalDiscounts,0);assert.equal(afterReturn.body.data.statusCounts.RETURNED,1);
 });
 test('concurrent food extension approval advances delivery exactly once',async()=>{
  const created=await request('/orders','POST',orderInput(),buyerCookie);const id=created.body.data.id;
  const beforeDate=new Date('2099-01-01T06:00:00Z');
  await OrderModel.updateOne({_id:id},{$set:{itemType:'FOOD',status:'ACCEPTED',allocatedDeliveryAt:beforeDate}});
  const requested=await Promise.all([1,2].map(()=>request('/orders/'+id+'/extension','POST',{minutes:30,reason:'Additional preparation time'},sellerCookie)));
  assert.deepEqual(requested.map(row=>row.status).sort(),[200,409]);
  const decisions=await Promise.all([1,2].map(()=>request('/orders/'+id+'/extension','PATCH',{decision:'APPROVED'},buyerCookie)));
  assert.deepEqual(decisions.map(row=>row.status).sort(),[200,409]);
  const order=await OrderModel.findById(id);assert.equal(order?.allocatedDeliveryAt.getTime(),beforeDate.getTime()+30*60000);
  assert.equal(order?.notificationEvents.filter(event=>event.type==='EXTENSION_DECISION').length,1);
 });
 test('notification preference suppresses optional updates but preserves account warnings',async()=>{
  await UserModel.updateOne({_id:buyer._id},{$set:{notificationPreference:'ORDERS'}});
  const count=await NotificationModel.countDocuments({userId:buyer._id});
  await notifyUser(buyer._id,{type:'API_ABUSE',title:'Optional update',message:'Test'});
  assert.equal(await NotificationModel.countDocuments({userId:buyer._id}),count);
  await notifyUser(buyer._id,{type:'ACCOUNT_WARNING',title:'Account update',message:'Test'});
  assert.equal(await NotificationModel.countDocuments({userId:buyer._id}),count+1);
 });

 test('product reports are private per reporter until an admin closes them',async()=>{
  assert.equal((await request('/reports','POST',{targetId:product.id,type:'Food',reason:'Owner should not report this'},sellerCookie)).status,400);
  const first=await request('/reports','POST',{targetId:product.id,type:'Food',reason:'The product description is misleading'},buyerCookie);
  assert.equal(first.status,201);
  assert.equal((await request('/reports/'+first.body.data.id,'PATCH',{action:'REMOVE',note:'Must use inventory moderation'},adminCookie)).status,400);
  assert.notEqual((await ProductModel.findById(product.id))?.status,'REMOVED');
  assert.equal((await request('/reports/mine/product/'+product.id+'/active','GET',undefined,buyerCookie)).body.data.active,true);
  assert.equal((await request('/reports','POST',{targetId:product.id,type:'Food',reason:'Duplicate unresolved report'},buyerCookie)).status,409);

  const secondBuyer=await UserModel.create({name:'Second reporter',email:'second-reporter@regression.test',role:'BUYER',passwordHash:await bcrypt.hash(password,4)});
  const secondCookie=(await request('/auth/login','POST',{email:secondBuyer.email,password})).cookie;
  assert.equal((await request('/reports','POST',{targetId:product.id,type:'Food',reason:'A separate user can report it'},secondCookie)).status,201);

  assert.equal((await request('/reports/'+first.body.data.id,'PATCH',{action:'RESOLVE'},adminCookie)).status,200);
  assert.equal((await request('/reports/mine/product/'+product.id+'/active','GET',undefined,buyerCookie)).body.data.active,false);
  const reopened=await request('/reports','POST',{targetId:product.id,type:'Food',reason:'A new issue after resolution'},buyerCookie);
  assert.equal(reopened.status,201);
  const sellerWarnings=await NotificationModel.countDocuments({userId:seller._id,type:'ACCOUNT_WARNING'});
  assert.equal((await request('/reports/'+reopened.body.data.id,'PATCH',{action:'WARN',note:'Correct the reported product information'},adminCookie)).status,200);
  assert.equal(await NotificationModel.countDocuments({userId:seller._id,type:'ACCOUNT_WARNING'}),sellerWarnings+1);
  assert.notEqual((await ProductModel.findById(product.id))?.status,'REMOVED');
 });

 test('application decisions notify users while only report warnings notify targets',async()=>{
  const passwordHash=await bcrypt.hash(password,4);
  const decisionUsers=await UserModel.create([
   {name:'Approved applicant',email:'approved-applicant@regression.test',role:'BUYER',passwordHash},
   {name:'Rejected applicant',email:'rejected-applicant@regression.test',role:'BUYER',passwordHash},
   {name:'Warn target',email:'warn-target@regression.test',role:'BUYER',passwordHash},
   {name:'Suspend target',email:'suspend-target@regression.test',role:'BUYER',passwordHash},
   {name:'Ban target',email:'ban-target@regression.test',role:'BUYER',passwordHash},
  ]);
  const approvedApplicant=decisionUsers[0]!,rejectedApplicant=decisionUsers[1]!,warnTarget=decisionUsers[2]!,suspendTarget=decisionUsers[3]!,banTarget=decisionUsers[4]!;
  const approvedApplication=await SellerApplicationModel.create({userId:approvedApplicant._id,user:approvedApplicant.name,store:'Approved Store',phone:'01700000001',bracuId:'BRACU-APPROVED',description:'A complete seller application for approval testing.'});
  const rejectedApplication=await SellerApplicationModel.create({userId:rejectedApplicant._id,user:rejectedApplicant.name,store:'Rejected Store',phone:'01700000002',bracuId:'BRACU-REJECTED',description:'A complete seller application for rejection testing.'});
  assert.equal((await request('/seller-applications/'+approvedApplication.id,'PATCH',{status:'APPROVED'},adminCookie)).status,200);
  assert.equal((await request('/seller-applications/'+rejectedApplication.id,'PATCH',{status:'REJECTED'},adminCookie)).status,200);
  assert.equal(await NotificationModel.countDocuments({userId:approvedApplicant._id,type:'APPLICATION_DECISION'}),1);
  assert.equal(await NotificationModel.countDocuments({userId:rejectedApplicant._id,type:'APPLICATION_DECISION'}),1);

  for(const [target,action] of [[warnTarget,'WARN'],[suspendTarget,'SUSPEND'],[banTarget,'BAN']] as const){
   const report=await request('/reports','POST',{targetId:target.id,type:'Buyer',reason:'Moderation notification behavior test'},sellerCookie);
   assert.equal(report.status,201);
   assert.equal((await request('/reports/'+report.body.data.id,'PATCH',{action,note:'Administrative moderation decision'},adminCookie)).status,200);
  }
  assert.equal(await NotificationModel.countDocuments({userId:warnTarget._id,type:'ACCOUNT_WARNING'}),1);
  assert.equal(await NotificationModel.countDocuments({userId:suspendTarget._id}),0);
  assert.equal(await NotificationModel.countDocuments({userId:banTarget._id}),0);
 });

 test('a restricted account can submit only one reactivation application per Dhaka day',async()=>{
  const dailyUser=await UserModel.create({name:'Daily applicant',email:'daily-reactivation@regression.test',role:'BUYER',status:'SUSPENDED',passwordHash:await bcrypt.hash(password,4)});
  const dailyCookie=(await request('/auth/login','POST',{email:dailyUser.email,password})).cookie;
  const first=await request('/reactivation-requests','POST',{reason:'Please review my restricted account'},dailyCookie);
  assert.equal(first.status,201);
  assert.equal((await request('/reactivation-requests/'+first.body.data.id,'PATCH',{status:'REJECTED'},adminCookie)).status,200);
  const second=await request('/reactivation-requests','POST',{reason:'Trying again on the same day'},dailyCookie);
  assert.equal(second.status,429);
  assert.ok(second.body.retryAt);
 });

});
