import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {after,test} from 'node:test';
import express from 'express';
import {concurrencyGate} from './concurrencyGate.js';

const app=express();
let active=0,peak=0;
app.use(concurrencyGate({maxInFlight:5,maxQueue:10,queueTimeoutMs:1000}));
app.get('/api/v1/slow',async(_req,res)=>{
  active+=1;peak=Math.max(peak,active);
  await new Promise(resolve=>setTimeout(resolve,100));
  active-=1;res.json({success:true});
});
const server=createServer(app);
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
after(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
const address=server.address();
if(!address||typeof address==='string')throw new Error('Test server did not bind');
const url=`http://127.0.0.1:${address.port}/api/v1/slow`;

test('excess API work is bounded and load is shed with retry guidance',async()=>{
  const responses=await Promise.all(Array.from({length:25},()=>fetch(url)));
  const statuses=responses.map(response=>response.status);
  assert.equal(peak,5);
  assert.equal(statuses.filter(status=>status===200).length,15);
  assert.equal(statuses.filter(status=>status===503).length,10);
  assert.ok(responses.filter(response=>response.status===503).every(response=>response.headers.get('retry-after')==='1'));
});
