import type {ErrorRequestHandler,RequestHandler} from 'express';
import {ZodError} from 'zod';
import mongoose from 'mongoose';

export const notFound:RequestHandler=(req,res)=>{
  res.status(404).json({success:false,message:`Route not found: ${req.method} ${req.originalUrl}`});
};

export const errorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{
  if(error instanceof ZodError){
    res.status(400).json({success:false,message:'Validation failed',errors:error.flatten()});
    return;
  }
  if(error instanceof mongoose.Error.CastError){res.status(400).json({success:false,message:'Invalid identifier or field value'});return}
  if(error instanceof mongoose.Error.ValidationError){res.status(400).json({success:false,message:'Validation failed',errors:{fieldErrors:Object.fromEntries(Object.entries(error.errors).map(([key,value])=>[key,[value.message]]))}});return}
  if(error?.code===11000){res.status(409).json({success:false,message:'This record already exists'});return}
  if(error?.type==='entity.parse.failed'){res.status(400).json({success:false,message:'Invalid JSON request'});return}
  console.error('Unhandled request error',error);
  res.status(500).json({success:false,message:'Unable to complete the request. Please try again.'});
};
