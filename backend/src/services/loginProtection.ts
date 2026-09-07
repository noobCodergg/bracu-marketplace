import {createHmac} from 'node:crypto';
import {env} from '../config/env.js';

const WINDOW_MS=15*60_000;
const MAX_FAILURES=5;
const MAX_ACCOUNTS=10_000;
type Attempt={failures:number;windowStartedAt:number;lockedUntil:number};
const attempts=new Map<string,Attempt>();

function keyFor(email:string){
  return createHmac('sha256',env.JWT_SECRET).update(email.trim().toLowerCase()).digest('hex');
}

export function loginRetryAfter(email:string,now=Date.now()){
  const key=keyFor(email),attempt=attempts.get(key);
  if(!attempt)return 0;
  if(now-attempt.windowStartedAt>=WINDOW_MS&&attempt.lockedUntil<=now){attempts.delete(key);return 0}
  return attempt.lockedUntil>now?Math.max(1,Math.ceil((attempt.lockedUntil-now)/1000)):0;
}

export function recordLoginFailure(email:string,now=Date.now()){
  const key=keyFor(email),previous=attempts.get(key);
  const attempt=!previous||now-previous.windowStartedAt>=WINDOW_MS
    ?{failures:1,windowStartedAt:now,lockedUntil:0}
    :{...previous,failures:previous.failures+1};
  if(attempt.failures>=MAX_FAILURES)attempt.lockedUntil=now+WINDOW_MS;
  attempts.delete(key);attempts.set(key,attempt);
  if(attempts.size>MAX_ACCOUNTS){const oldest=attempts.keys().next().value;if(oldest)attempts.delete(oldest)}
  return attempt.lockedUntil>now?Math.ceil((attempt.lockedUntil-now)/1000):0;
}

export function clearLoginFailures(email:string){attempts.delete(keyFor(email))}
export function resetLoginProtectionForTests(){attempts.clear()}

