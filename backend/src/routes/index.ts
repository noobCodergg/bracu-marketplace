import {Router} from 'express';

export const apiRouter=Router();

apiRouter.get('/health',(_req,res)=>{
  res.json({success:true,message:'BRACU Marketplace API is running',timestamp:new Date().toISOString()});
});
