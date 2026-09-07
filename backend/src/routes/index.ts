import {accountRouter} from './account.js';
import {adminMarketplaceRouter,platformRouter} from './adminMarketplace.js';
import {Router} from 'express';
import mongoose from 'mongoose';
import {adminAnalyticsRouter} from './adminAnalytics.js';
import {authRouter} from './auth.js';
import {sellerApplicationRouter} from './sellerApplications.js';
import {productRouter} from './products.js';
import {adminUserRouter} from './adminUsers.js';
import {reactivationRequestRouter} from './reactivationRequests.js';
import {orderRouter} from './orders.js';
import {reviewRouter} from './reviews.js';
import {couponRouter} from './coupons.js';
import {sellerAnalyticsRouter} from './sellerAnalytics.js';
import {analyticsEventRouter} from './analyticsEvents.js';
import {ppcCampaignRouter} from './ppcCampaigns.js';
import {adminSystemAnalyticsRouter} from './adminSystemAnalytics.js';
import {notificationRouter} from './notifications.js';
import {reportRouter} from './reports.js';
import {loadTestRouter} from './loadTests.js';
import {env} from '../config/env.js';
import {pushRouter} from './push.js';

export const apiRouter=Router();
apiRouter.use('/auth',authRouter);
apiRouter.use('/account',accountRouter);
apiRouter.use('/platform',platformRouter);
apiRouter.use('/admin/marketplace',adminMarketplaceRouter);
apiRouter.use('/seller-applications',sellerApplicationRouter);
apiRouter.use('/products',productRouter);
apiRouter.use('/admin/users',adminUserRouter);
apiRouter.use('/admin/analytics',adminAnalyticsRouter);
apiRouter.use('/admin/system-analytics',adminSystemAnalyticsRouter);
apiRouter.use('/reactivation-requests',reactivationRequestRouter);
apiRouter.use('/orders',orderRouter);
apiRouter.use('/reviews',reviewRouter);
apiRouter.use('/coupons',couponRouter);
apiRouter.use('/seller/analytics',sellerAnalyticsRouter);
apiRouter.use('/analytics/events',analyticsEventRouter);
apiRouter.use('/seller/ppc-campaigns',ppcCampaignRouter);
apiRouter.use('/notifications',notificationRouter);
apiRouter.use('/push',pushRouter);
apiRouter.use('/reports',reportRouter);
if(env.NODE_ENV!=='production')apiRouter.use('/admin/load-tests',loadTestRouter);

apiRouter.get('/health',async(_req,res)=>{
  const started=performance.now();
  try{
    if(mongoose.connection.readyState!==1||!mongoose.connection.db)throw Error('Database is not connected');
    await mongoose.connection.db.admin().ping();
    res.setHeader('Cache-Control','no-store');
    res.json({success:true,message:'B Market API and database are running',database:'AVAILABLE',databaseLatencyMs:Math.round(performance.now()-started),timestamp:new Date().toISOString()});
  }catch{
    res.setHeader('Cache-Control','no-store');
    res.status(503).json({success:false,message:'Database health check failed',database:'UNAVAILABLE',timestamp:new Date().toISOString()});
  }
});
