import type {ErrorRequestHandler,RequestHandler} from 'express';
import {ZodError} from 'zod';

export const notFound:RequestHandler=(req,res)=>{
  res.status(404).json({success:false,message:`Route not found: ${req.method} ${req.originalUrl}`});
};

export const errorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{
  if(error instanceof ZodError){
    res.status(400).json({success:false,message:'Validation failed',errors:error.flatten()});
    return;
  }
  const message=error instanceof Error?error.message:'Internal server error';
  res.status(500).json({success:false,message});
};
