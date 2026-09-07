import mongoose from 'mongoose';
import {env} from './env.js';

const ANALYTICS_RETENTION_SECONDS=90*24*60*60;

async function ensureAnalyticsRetention(){
  const db=mongoose.connection.db;if(!db)return;
  const exists=await db.listCollections({name:'analyticsevents'},{nameOnly:true}).hasNext();
  if(!exists)return;
  const index=await db.collection('analyticsevents').indexes().then(items=>items.find(item=>item.name==='createdAt_1'));
  if(index?.expireAfterSeconds===ANALYTICS_RETENTION_SECONDS)return;
  try{
    await db.command({collMod:'analyticsevents',index:{name:'createdAt_1',expireAfterSeconds:ANALYTICS_RETENTION_SECONDS}});
    console.log('Analytics event retention set to 90 days');
  }catch(error){
    console.warn('Could not update analytics retention; run the TTL migration with a database-owner account',error);
  }
}

export async function connectDatabase(){
  await mongoose.connect(env.MONGODB_URI,{
    maxPoolSize:env.DB_MAX_POOL_SIZE,
    minPoolSize:1,
    maxIdleTimeMS:600000,
    serverSelectionTimeoutMS:5000,
  });
  await ensureAnalyticsRetention();
  console.log('MongoDB connected');
}

export async function disconnectDatabase(){
  await mongoose.disconnect();
}
