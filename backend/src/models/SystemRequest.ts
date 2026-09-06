import {Schema,model} from 'mongoose';

const systemRequestSchema=new Schema({
  requestId:{type:String,required:true,index:true},
  method:{type:String,required:true,trim:true,maxlength:10,index:true},
  path:{type:String,required:true,trim:true,maxlength:240,index:true},
  statusCode:{type:Number,required:true,min:100,max:599,index:true},
  durationMs:{type:Number,required:true,min:0},
  responseBytes:{type:Number,min:0,default:0},
  actorKey:{type:String,required:true,trim:true,maxlength:160,index:true},
  visitorId:{type:String,trim:true,maxlength:100},
  userId:{type:Schema.Types.ObjectId,ref:'User',index:true},
  role:{type:String,enum:['BUYER','SELLER','ADMIN']},
  ipHash:{type:String,required:true,select:false},
  userAgent:{type:String,trim:true,maxlength:300}
},{timestamps:true});

systemRequestSchema.index({createdAt:-1});
systemRequestSchema.index({method:1,path:1,createdAt:-1});
systemRequestSchema.index({actorKey:1,createdAt:-1});
systemRequestSchema.index({createdAt:1},{expireAfterSeconds:60*60*24*30});

export const SystemRequestModel=model('SystemRequest',systemRequestSchema);
