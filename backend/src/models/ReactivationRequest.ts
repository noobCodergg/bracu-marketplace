import {Schema,model} from 'mongoose';

const reactivationRequestSchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  user:{type:String,required:true,trim:true},
  role:{type:String,enum:['BUYER','SELLER'],required:true},
  accountStatus:{type:String,enum:['SUSPENDED','FROZEN'],required:true},
  reason:{type:String,required:true,trim:true,maxlength:1000},
  submissionDay:{type:String,match:/^\d{4}-\d{2}-\d{2}$/},
  status:{type:String,enum:['PENDING','APPROVED','REJECTED'],default:'PENDING',required:true,index:true}
},{timestamps:true});

reactivationRequestSchema.index({userId:1,submissionDay:1},{unique:true,partialFilterExpression:{submissionDay:{$type:'string'}}});
export const ReactivationRequestModel=model('ReactivationRequest',reactivationRequestSchema);
