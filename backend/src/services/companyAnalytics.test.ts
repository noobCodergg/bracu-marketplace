import assert from 'node:assert/strict';
import {test} from 'node:test';
import {summarizeReceipts} from './companyAnalytics.js';

test('company earnings separate boost and premium receipts and deduct processing costs',()=>{
  const paidAt=new Date('2026-09-05T00:00:00Z');
  const result=summarizeReceipts([
    {product:'BOOST',amount:300,status:'SUCCEEDED',directCost:10,paidAt},
    {product:'PREMIUM_ANALYTICS',amount:1000,status:'SUCCEEDED',directCost:25,paidAt},
  ]);
  assert.deepEqual(result.summary,{gross:1300,directCosts:35,revenue:1300,profit:1265,purchases:2});
  assert.equal(result.breakdown[0]?.profit,290);
  assert.equal(result.breakdown[1]?.profit,975);
});
test('no receipts means zero earnings, not estimated or demo income',()=>{
  const result=summarizeReceipts([]);
  assert.equal(result.summary.profit,0);
  assert.equal(result.summary.purchases,0);
  assert.equal(result.breakdown.length,2);
});
test('pending and failed payments never count as earnings',()=>{
  const paidAt=new Date();
  const result=summarizeReceipts([
    {product:'BOOST',status:'PENDING',amount:500,directCost:0,paidAt},
    {product:'PREMIUM_ANALYTICS',status:'FAILED',amount:1000,directCost:0,paidAt},
    {product:'BOOST',status:'SUCCEEDED',amount:0.3,directCost:0.1,paidAt},
  ]);
  assert.equal(result.summary.revenue,0.3);
  assert.equal(result.summary.profit,0.2);
  assert.equal(result.summary.purchases,1);
});
