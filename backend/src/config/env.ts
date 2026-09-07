import 'dotenv/config';
import {z} from 'zod';

const unsafeDevelopmentSecret='development-only-secret-change-before-production';
const envSchema=z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'),
  PORT:z.coerce.number().int().positive().default(5000),
  CLIENT_URL:z.string().url().default('http://localhost:5173'),
  CLIENT_URLS:z.string().default(''),
  MONGODB_URI:z.string().min(1).default('mongodb://127.0.0.1:27017/bracu_marketplace'),
  JWT_SECRET:z.string().min(32).default(unsafeDevelopmentSecret),
  ENABLE_REQUEST_DB_TELEMETRY:z.enum(['true','false']).default('false').transform(value=>value==='true'),
  DB_MAX_POOL_SIZE:z.coerce.number().int().min(1).max(50).default(10),
  AUTH_CACHE_TTL_MS:z.coerce.number().int().min(0).max(60000).default(30000),
  API_MAX_IN_FLIGHT:z.coerce.number().int().min(1).max(500).default(40),
  API_MAX_QUEUE:z.coerce.number().int().min(0).max(2000).default(160),
  API_QUEUE_TIMEOUT_MS:z.coerce.number().int().min(100).max(30000).default(5000),
  TRUST_PROXY_HOPS:z.coerce.number().int().min(0).max(5).default(1),
  ADMIN_EMAIL:z.string().email().optional(),
  ADMIN_PASSWORD:z.string().min(12).max(72).optional(),
  ADMIN_NAME:z.string().min(2).default('Platform Admin')
  ,VAPID_PUBLIC_KEY:z.string().optional()
  ,VAPID_PRIVATE_KEY:z.string().optional()
  ,VAPID_SUBJECT:z.string().default('mailto:admin@example.com')
}).superRefine((value,ctx)=>{
  if(value.NODE_ENV==='production'&&value.JWT_SECRET===unsafeDevelopmentSecret)ctx.addIssue({code:'custom',path:['JWT_SECRET'],message:'A strong unique JWT_SECRET is required in production'});
});

export const env=envSchema.parse(process.env);
