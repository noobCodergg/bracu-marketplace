import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {after,test} from 'node:test';
import jwt from 'jsonwebtoken';
import {app} from '../app.js';
import {env} from '../config/env.js';

const server=createServer(app);
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
after(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
const address=server.address();if(!address||typeof address==='string')throw new Error('Test server did not bind');
const base=`http://127.0.0.1:${address.port}`;

test('cross-origin state changes are rejected before reaching a route',async()=>{
  const response=await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,403);
});

test('trusted-origin state changes remain available',async()=>{
  const response=await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Origin:new URL(env.CLIENT_URL).origin,'Sec-Fetch-Site':'cross-site','Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,200);
});

test('legacy token without pinned issuer and audience is rejected',async()=>{
  const token=jwt.sign({version:0},env.JWT_SECRET,{subject:'507f1f77bcf86cd799439011',expiresIn:'1h'});
  const response=await fetch(base+'/api/v1/auth/me',{headers:{Cookie:`session=${token}`}});
  assert.equal(response.status,401);
});

test('oversized JSON payloads return 413 instead of a server error',async()=>{
  const response=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{Origin:new URL(env.CLIENT_URL).origin,'Content-Type':'application/json'},body:JSON.stringify({email:'oversized@example.com',password:'A'.repeat(1_100_000)})});
  assert.equal(response.status,413);
});
