import {UserModel} from '../models/User.js';
import {invalidateAuthCache} from '../middleware/auth.js';

export const SELLER_INACTIVITY_DAYS=10;
const inactivityMs=SELLER_INACTIVITY_DAYS*24*60*60*1000;

export async function freezeInactiveSellers(now=new Date()){
  // Existing sellers receive a full grace period when this feature is first deployed.
  await UserModel.updateMany({role:'SELLER',sellerActivityAt:{$exists:false}},{$set:{sellerActivityAt:now}});
  const cutoff=new Date(now.getTime()-inactivityMs);
  const sellers=await UserModel.find({role:'SELLER',status:'ACTIVE',sellerActivityAt:{$lte:cutoff}}).select('_id');
  if(!sellers.length)return 0;
  const ids=sellers.map(seller=>seller._id);
  const result=await UserModel.updateMany({_id:{$in:ids},status:'ACTIVE'},{$set:{status:'FROZEN',restrictionReason:'Account automatically frozen after 10 days without seller order activity'},$unset:{restrictionEnds:1}});
  ids.forEach(id=>invalidateAuthCache(String(id)));
  return result.modifiedCount;
}

export function startSellerInactivityWorker(){
  let running=false;
  const run=()=>{if(running)return;running=true;void freezeInactiveSellers().then(count=>{if(count)console.log(`Automatically froze ${count} inactive seller account(s)`)}).catch(error=>console.error('Seller inactivity check failed',error)).finally(()=>{running=false})};
  run();
  const timer=setInterval(run,60*60*1000);
  timer.unref();
  return()=>clearInterval(timer);
}
