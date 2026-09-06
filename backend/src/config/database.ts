import mongoose from 'mongoose';
import {env} from './env.js';

export async function connectDatabase(){
  await mongoose.connect(env.MONGODB_URI,{
    maxPoolSize:env.DB_MAX_POOL_SIZE,
    minPoolSize:0,
    maxIdleTimeMS:30000,
    serverSelectionTimeoutMS:5000,
  });
  console.log('MongoDB connected');
}

export async function disconnectDatabase(){
  await mongoose.disconnect();
}
