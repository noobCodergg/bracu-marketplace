import 'dotenv/config';
import {z} from 'zod';

const envSchema=z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'),
  PORT:z.coerce.number().int().positive().default(5000),
  CLIENT_URL:z.string().url().default('http://localhost:5173'),
  MONGODB_URI:z.string().min(1).default('mongodb://127.0.0.1:27017/bracu_marketplace')
});

export const env=envSchema.parse(process.env);
