import {createServer} from 'node:http';
import {app} from './app.js';
import {connectDatabase,disconnectDatabase} from './config/database.js';
import {env} from './config/env.js';

async function bootstrap(){
  await connectDatabase();
  const server=createServer(app);
  server.listen(env.PORT,()=>console.log(`API listening on http://localhost:${env.PORT}`));

  const shutdown=async(signal:string)=>{
    console.log(`${signal} received, shutting down`);
    server.close(async()=>{
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT',()=>void shutdown('SIGINT'));
  process.on('SIGTERM',()=>void shutdown('SIGTERM'));
}

bootstrap().catch(error=>{
  console.error('Backend failed to start',error);
  process.exit(1);
});
