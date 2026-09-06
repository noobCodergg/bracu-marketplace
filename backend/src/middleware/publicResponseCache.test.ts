import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {after,test} from 'node:test';
import express from 'express';
import {publicResponseCache} from './publicResponseCache.js';

const app=express();
let executions=0;
app.get('/catalog',publicResponseCache(5000),async(_req,res)=>{
  executions+=1;
  await new Promise(resolve=>setTimeout(resolve,30));
  res.json({items:['one'],execution:executions});
});
const server=createServer(app);
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
after(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
const address=server.address();
if(!address||typeof address==='string')throw new Error('Test server did not bind');
const url=`http://127.0.0.1:${address.port}/catalog`;

test('100 concurrent identical requests share one handler execution',async()=>{
  const responses=await Promise.all(Array.from({length:100},()=>fetch(url)));
  assert.equal(executions,1);
  assert.ok(responses.every(response=>response.status===200));
  const bodies=await Promise.all(responses.map(response=>response.json() as Promise<{execution:number}>));
  assert.ok(bodies.every(body=>body.execution===1));
});

test('a warm request is served from the bounded response cache',async()=>{
  const response=await fetch(url);
  assert.equal(response.headers.get('x-cache'),'HIT');
  assert.match(response.headers.get('cache-control')??'',/s-maxage=5/);
  assert.match(response.headers.get('cdn-cache-control')??'',/stale-if-error=300/);
  assert.equal(executions,1);
});

test('query parameter order uses the same canonical cache entry',async()=>{
  const first=await fetch(`${url}?category=Food&page=2`);
  const second=await fetch(`${url}?page=2&category=Food`);
  assert.equal(first.headers.get('x-cache'),'MISS');
  assert.equal(second.headers.get('x-cache'),'HIT');
  assert.equal(executions,2);
});
