import {Schema,model} from 'mongoose';

export type Role='BUYER'|'SELLER'|'ADMIN';
export type AccountStatus='ACTIVE'|'SUSPENDED'|'BANNED'|'FROZEN';

const userSchema=new Schema({
  name:{type:String,required:true,trim:true,minlength:2,maxlength:80},
  email:{type:String,required:true,unique:true,lowercase:true,trim:true,index:true},
  passwordHash:{type:String,required:true,select:false},
  role:{type:String,enum:['BUYER','SELLER','ADMIN'],default:'BUYER',required:true},
  status:{type:String,enum:['ACTIVE','SUSPENDED','BANNED','FROZEN'],default:'ACTIVE',required:true},
  phone:{type:String,default:''},notificationPreference:{type:String,enum:['ALL','ORDERS'],default:'ALL'},
  avatar:{type:String,default:''},
  store:{type:String,trim:true},
  acceptingOrders:{type:Boolean,default:true},
  restrictionReason:{type:String,trim:true,maxlength:1000},
  restrictionEnds:{type:Date},
  tokenVersion:{type:Number,default:0,select:false}
},{timestamps:true});

export const UserModel=model('User',userSchema);

export function publicUser(user:{_id:unknown;name:string;email:string;role:Role;status:AccountStatus;avatar?:string;store?:string|null;createdAt?:Date;restrictionReason?:string|null;restrictionEnds?:Date|null}){
  return {id:String(user._id),name:user.name,email:user.email,role:user.role,status:user.status,avatar:user.avatar||`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=DCFCE7&color=166534`,joined:(user.createdAt??new Date()).toISOString().slice(0,10),...(user.store?{store:user.store}:{}),...(user.restrictionReason?{reason:user.restrictionReason}:{}),restrictionEnds:user.restrictionEnds?.toISOString()};
}
