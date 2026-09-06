import {startOrderNotificationWorker} from './services/orderNotifications.js';
import {createServer} from 'node:http';
import {app} from './app.js';
import {connectDatabase,disconnectDatabase} from './config/database.js';
import {env} from './config/env.js';
import {ensureAdmin} from './config/bootstrapAdmin.js';

async function bootstrap(){
  await connectDatabase();
  await ensureAdmin();
  const stopNotifications=startOrderNotificationWorker();
  const server=createServer(app);
  server.keepAliveTimeout=65000;
  server.headersTimeout=66000;
  server.requestTimeout=30000;
  server.maxRequestsPerSocket=1000;
  server.listen(env.PORT,()=>console.log(`API listening on http://localhost:${env.PORT}`));

  const shutdown=async(signal:string)=>{
    console.log(`${signal} received, shutting down`);
    stopNotifications();
    const forceExit=setTimeout(()=>process.exit(1),10000);forceExit.unref();
    server.close(async()=>{
      clearTimeout(forceExit);
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
