import {UserModel} from '../models/User.js';

export async function expireRestriction<T extends {_id:import('mongoose').Types.ObjectId;status:import('../models/User.js').AccountStatus;restrictionEnds?:Date|null;restrictionReason?:string|null}>(user:T){
  if(user.status!=='ACTIVE'&&user.restrictionEnds&&user.restrictionEnds.getTime()<=Date.now()){
    const updated=await UserModel.findOneAndUpdate({_id:user._id,status:user.status,restrictionEnds:{$lte:new Date()}},{$set:{status:'ACTIVE'},$unset:{restrictionEnds:1,restrictionReason:1}},{new:true});
    if(updated){user.status='ACTIVE';user.restrictionEnds=undefined;user.restrictionReason=undefined;}
  }
  return user;
}
