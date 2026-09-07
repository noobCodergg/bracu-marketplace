import assert from 'node:assert/strict';
import test from 'node:test';
import {clearLoginFailures,loginRetryAfter,recordLoginFailure,resetLoginProtectionForTests} from './loginProtection.js';

test('an account is temporarily locked after five failed logins',()=>{
  resetLoginProtectionForTests();
  const email='target@example.com',now=1_000_000;
  for(let attempt=0;attempt<4;attempt++)assert.equal(recordLoginFailure(email,now+attempt),0);
  assert.equal(recordLoginFailure(email,now+4),900);
  assert.equal(loginRetryAfter(email,now+5),900);
  assert.equal(loginRetryAfter(email,now+15*60_000+5),0);
});

test('successful authentication clears previous failures',()=>{
  resetLoginProtectionForTests();
  recordLoginFailure('buyer@example.com',1_000);
  clearLoginFailures('buyer@example.com');
  assert.equal(loginRetryAfter('buyer@example.com',1_001),0);
});

