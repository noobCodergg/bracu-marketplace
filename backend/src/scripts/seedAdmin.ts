import {connectDatabase,disconnectDatabase} from '../config/database.js';
import {ensureAdmin} from '../config/bootstrapAdmin.js';
import {env} from '../config/env.js';

async function seed(){
  if(!env.ADMIN_EMAIL||!env.ADMIN_PASSWORD){
    throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env before seeding');
  }
  await connectDatabase();
  try{
    await ensureAdmin(true);
    console.log('Admin account is ready');
  }finally{
    await disconnectDatabase();
  }
}

seed().catch(error=>{
  console.error(error instanceof Error?error.message:error);
  process.exit(1);
});
