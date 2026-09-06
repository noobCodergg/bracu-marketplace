import bcrypt from 'bcryptjs';
import {env} from './env.js';
import {UserModel} from '../models/User.js';

export async function ensureAdmin(syncCredentials=false){
  if(!env.ADMIN_EMAIL||!env.ADMIN_PASSWORD)return;
  const email=env.ADMIN_EMAIL.toLowerCase().trim();
  const existing=await UserModel.findOne({email}).select('+tokenVersion');
  if(existing){
    if(existing.role!=='ADMIN')throw Error('ADMIN_EMAIL belongs to a non-admin account');
    if(syncCredentials){
      existing.name=env.ADMIN_NAME;
      existing.passwordHash=await bcrypt.hash(env.ADMIN_PASSWORD,12);
      existing.status='ACTIVE';
      existing.restrictionReason=undefined;
      existing.restrictionEnds=undefined;
      existing.tokenVersion+=1;
      await existing.save();
      console.log('Existing admin credentials refreshed');
    }
    return;
  }
  await UserModel.create({name:env.ADMIN_NAME,email,passwordHash:await bcrypt.hash(env.ADMIN_PASSWORD,12),role:'ADMIN',status:'ACTIVE'});
  console.log('Admin account created');
}
