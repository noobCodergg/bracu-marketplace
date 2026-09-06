// Temporary local browser fixture. Uses a separate disposable database.
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {app} from '../app.js';
import {env} from '../config/env.js';
import {UserModel} from '../models/User.js';
import {ProductModel} from '../models/Product.js';
import {startOrderNotificationWorker} from '../services/orderNotifications.js';

const databaseName='bracu_browser_'+randomUUID().replaceAll('-','');
await mongoose.connect(env.MONGODB_URI,{dbName:databaseName});
const passwordHash=await bcrypt.hash('BrowserFixture2026!',4);
const [seller]=await UserModel.create([
 {name:'Fixture Seller',email:'seller@browser.test',role:'SELLER',passwordHash},
 {name:'Fixture Buyer',email:'buyer@browser.test',role:'BUYER',passwordHash},
 {name:'Fixture Admin',email:'admin@browser.test',role:'ADMIN',passwordHash},
 {name:'Other Seller',email:'other@browser.test',role:'SELLER',passwordHash},
]);
await ProductModel.create(Array.from({length:6},(_,index)=>({sellerId:seller!._id,seller:'Fixture Seller',name:`Campus Notebook ${index+1}`,description:'A durable campus notebook for everyday class notes and study.',category:'Stationery',subcategory:'Notebooks',price:80+index*20,quantity:10,status:'ACTIVE' as const,images:['https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=500'],variants:[{price:100+index*20,discountPrice:80+index*20,costPrice:50,packagingCost:5,otherCost:0,quantity:10}],prepMinutes:0,spicy:0})));
const harness=express(),stopWorker=startOrderNotificationWorker();let closing=false;
const server=createServer(harness);
async function shutdown(){if(closing)return;closing=true;stopWorker();server.closeAllConnections();server.close();if(mongoose.connection.name!==databaseName||!/^bracu_browser_[a-f0-9]{32}$/.test(databaseName))throw Error('Refusing unsafe database cleanup');await mongoose.connection.dropDatabase();await mongoose.disconnect();process.exit(0)}
harness.get('/__fixture/stop',(_req,res)=>{res.send('Stopping isolated fixture');setTimeout(()=>void shutdown(),100)});
harness.use(app);
server.listen(5001,'127.0.0.1',()=>console.log('Isolated browser fixture ready on 127.0.0.1:5001'));
process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
setTimeout(()=>void shutdown(),30*60*1000).unref();
