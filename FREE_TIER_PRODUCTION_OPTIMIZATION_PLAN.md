# B Market — Free-tier production optimization plan

তারিখ: ৬ সেপ্টেম্বর ২০২৬  
Project: React/Vite frontend + Express/TypeScript backend + MongoDB

## সরাসরি সিদ্ধান্ত

এই project-কে **public MVP / portfolio-grade production** হিসেবে free tier-এ নিরাপদভাবে চালানো সম্ভব, কিন্তু ৫,০০০ simultaneously active user বা business-critical availability free tier-এ guarantee করা সম্ভব নয়। Render নিজেই Free web service production-এর জন্য ব্যবহার না করতে বলে; এটি idle হলে spin-down হয়, একটির বেশি instance চালানো যায় না, এবং free machine প্রায় `0.1 CPU / 512 MB`। MongoDB Atlas Free-এর storage মাত্র `0.5 GB`, সর্বোচ্চ `500` connection এবং backup নেই।

এই plan-এর realistic লক্ষ্য:

- ৫,০০০ registered user থাকতে পারে;
- সাধারণ সময়ে আনুমানিক ২০–৫০ concurrently active visitor;
- read-heavy short burst সামলানো;
- order consistency, security ও data-loss risk যতটা সম্ভব নিয়ন্ত্রণ করা;
- limit/latency বাড়লে পরিষ্কার upgrade path;
- zero-cost বজায় রাখতে non-essential telemetry, polling ও raw analytics কমানো।

## Recommended free deployment stack

| অংশ | নির্বাচন | কারণ |
|---|---|---|
| Frontend | Cloudflare Pages Free | Vite static files CDN থেকে পরিবেশন; static asset request free/unlimited, backend CPU ব্যবহার হবে না |
| Backend | Render Free Web Service | বর্তমান long-running Express/SSE architecture সবচেয়ে কম পরিবর্তনে চলে |
| Database | MongoDB Atlas Free | বর্তমান Mongoose code অপরিবর্তিত রাখা যায়; 0.5 GB hard limit মাথায় রাখতে হবে |
| Images | Cloudflare R2 Free | 10 GB-month storage, free egress; DB-তে image binary রাখা হবে না |
| DNS/TLS/WAF | Cloudflare Free | frontend/domain protection ও caching rules |
| Redis | Phase 1-এ নয় | Upstash Free 500k commands/month; every-request limiter/cache করলে খুব দ্রুত শেষ হবে |
| Monitoring | provider metrics + sampled structured logs | MongoDB-তে প্রতি request telemetry document রাখা যাবে না |

Cloudflare Pages-এ শুধুই compiled static frontend থাকবে—Pages Functions ব্যবহার না করলে 100k/day Worker quota লাগে না। Vercel Hobby alternative হলেও সেটি non-commercial personal use-এর জন্য; marketplace/business launch-এর default recommendation নয়।

## P0 code optimization — deploy-এর আগে

### 1. MongoDB request telemetry production-এ বন্ধ করুন

বর্তমানে `backend/src/middleware/systemTelemetry.ts` প্রতিটি API response-এর পর `SystemRequestModel.create(...)` করে। Atlas Free-তে এটি database writes এবং 0.5 GB storage দুটোই দ্রুত শেষ করবে।

পরিবর্তন:

- `ENABLE_REQUEST_DB_TELEMETRY=false` production default;
- success request raw document সংরক্ষণ নয়;
- 5xx এবং slow request (>1s) sampled structured log করুন;
- admin system dashboard raw Mongo telemetry-র বদলে rolling in-memory metrics দেখাবে; restart হলে reset হওয়া free-tier-এ acceptable;
- `SystemRequest` পুরোনো data একবার purge/archive করুন এবং TTL ২৪ ঘণ্টা করুন যদি feature রাখতে হয়।

Expected impact: প্রতি API call-এর অন্তত একটি DB write ও associated indexes update বাদ যাবে।

### 2. authentication-এর duplicate DB reads কমান

`requireAuth` প্রত্যেক protected request-এ user পড়ে; কিছু route আবার user পড়ে। Free single instance-এর জন্য Redis যোগ না করে:

- ৩০–৬০ সেকেন্ড TTL-এর bounded LRU user-session cache ব্যবহার করুন;
- maximum 2,000 entry; TTL expiry ও LRU eviction বাধ্যতামূলক;
- logout, password/status/role change-এর সময় entry invalidate;
- order/payment/admin-sensitive mutation-এ fresh DB validation রাখুন;
- route-এ দরকারি user data auth middleware থেকে reuse করুন;
- read-only query-তে `.lean()` দিন।

Cache process restart-এ হারালে correctness নষ্ট হবে না; DB source of truth থাকবে।

### 3. সব collection list paginate করুন

অবশ্যই pagination দরকার:

- orders;
- admin users;
- seller products, coupons, campaigns;
- reviews;
- reports, applications, reactivation requests।

Contract:

```text
?limit=20&cursor=<opaque>
default limit = 20
maximum limit = 50
sort = createdAt desc, _id desc
```

Deep page-এর জন্য `skip` বাদ দিয়ে cursor pagination ব্যবহার করুন। Response-এ প্রয়োজনীয় field শুধু `.select(...)` করুন।

### 4. product catalog query সহজ করুন

বর্তমান case-insensitive regex search collection scan করতে পারে এবং `$lookup + sort + facet` Free Atlas CPU-heavy। Phase 1-এ:

- normalized `searchText` field তৈরি করুন;
- free-text search-এর জন্য existing Mongo text index ও `$text` ব্যবহার করুন;
- search query minimum 3 characters, 300–500 ms frontend debounce;
- category browse query আলাদা simple `find().lean()` path;
- seller active status hot listing document-এ denormalize করুন;
- exact total count প্রতি request নয়; `hasNextPage` দিন;
- best-selling aggregation ৫–১৫ মিনিট in-memory cache করুন;
- catalog result `Cache-Control: public, max-age=30, stale-while-revalidate=120` দিন, personalized data বাদ দিয়ে।

### 5. analytics write amplification বন্ধ করুন

একটি product listing request বর্তমানে বহু impression/search document লিখতে পারে। Free tier-এ:

- listing impression raw per-product insert বন্ধ;
- browser events 10–20টি batch করে পাঠান;
- একই visitor/product/type ৩০ মিনিটে একবার deduplicate;
- `SEARCH` aggregate counter daily bucket-এ `$inc` করুন;
- analytics raw events ৭ দিনের TTL;
- bot/anonymous events sampled করুন (যেমন 10%);
- seller analytics ৫ মিনিট cache করুন।

### 6. checkout transaction-safe করুন

- Atlas transaction-এ conditional inventory decrement + order create + coupon redemption করুন;
- existing idempotency key/index রাখুন;
- transient transaction retry সীমিত (যেমন সর্বোচ্চ 2 retry with jitter);
- duplicate checkout, last-item race এবং interrupted transaction test করুন;
- notification outbox order document-এ থাকলেও worker event atomically claim করবে।

### 7. notification system free-tier উপযোগী করুন

Render Free single instance হওয়ায় প্রথম version-এ Redis Pub/Sub প্রয়োজন নেই। তবে:

- SSE optional feature flag করুন;
- reconnect-এর পর persisted latest notifications fetch হবে;
- প্রতিটি client-এর আলাদা timer নয়, একটি shared heartbeat loop;
- backpressure/closed response cleanup;
- order notification worker `findOneAndUpdate` দিয়ে একটি event claim করবে;
- worker loop batch 10–20, idle অবস্থায় 5–10 সেকেন্ড interval;
- process shutdown-এর সময় worker বন্ধ ও inflight কাজ drain করুন।

Render sleep/restart হলে realtime connection ভাঙবে—frontend reconnect/backoff ও normal notification fetch এটিকে recover করবে।

### 8. frontend polling ব্যাপকভাবে কমান

বর্তমান ৫/১০/১৫/৩০/৬০ সেকেন্ড polling free backend ও Atlas-কে অপ্রয়োজনীয়ভাবে জাগিয়ে রাখবে।

- account restriction restore: ৫ সেকেন্ড → ৬০ সেকেন্ড অথবা window focus;
- buyer orders: ১০ সেকেন্ড → SSE event + ৬০ সেকেন্ড fallback;
- seller orders: ৩০ সেকেন্ড → SSE event + ৬০ সেকেন্ড fallback;
- analytics: auto polling বন্ধ, manual refresh/৫ মিনিট stale time;
- notification: SSE connected থাকলে ৬০ সেকেন্ড poll বন্ধ;
- hidden tab/offline-এ সব polling pause;
- `refetchOnWindowFocus` selective;
- mutations-এর পর শুধু affected query invalidate।

### 9. rate limiting single-instance ও bounded রাখুন

বর্তমান in-memory `Map` single Render instance-এ acceptable, কিন্তু:

- proxy IP সঠিক পেতে Express `trust proxy` Render-এর documented setup অনুযায়ী configure;
- global anonymous IP limit + login-specific strict limit;
- authenticated user/route limit;
- map maximum entries ও periodic expiry;
- request count array-এর বদলে token bucket/fixed counters;
- `/auth/login`, signup, analytics ingestion, search এবং write endpoints-এর আলাদা limits;
- Cloudflare WAF/rate rules available scope-এ bot traffic block।

Upstash পরে কেবল multiple API instances নেওয়ার সময় যোগ করুন। 500k free commands/month মানে গড়ে প্রায় 16.7k/day; প্রতিটি request-এ একাধিক Redis command ব্যবহার করা এই project-এর জন্য practical free solution নয়।

### 10. server memory, timeout ও database pool

Render-এর 512 MB memory মাথায় রেখে:

- production source map generate/serve করবেন না;
- Node heap budget আনুমানিক 320–384 MB;
- Mongoose `maxPoolSize: 10`, `minPoolSize: 0`, `serverSelectionTimeoutMS: 5000`, `maxIdleTimeMS` configure;
- Atlas-এর 500 connection limit মানে 500 user নয়—users pool share করে;
- HTTP `requestTimeout`, `headersTimeout`, `keepAliveTimeout` নির্ধারণ;
- JSON body global 1 MB থেকে সাধারণ API-তে 100 KB; direct-to-R2 upload;
- response compression proxy/CDN-এ; already-compressed image আবার compress নয়;
- uncaught exception/rejection log করে graceful termination;
- shutdown-এর maximum deadline দিন যাতে process ঝুলে না থাকে।

## Required database indexes

Production-like seed data-তে `explain('executionStats')` দিয়ে যাচাই করে প্রয়োজনমতো:

```javascript
Product:      { status: 1, category: 1, subcategory: 1, price: 1, _id: 1 }
Product:      { sellerId: 1, status: 1, updatedAt: -1 }
Order:        { buyerId: 1, status: 1, createdAt: -1, _id: -1 }
Order:        { sellerId: 1, status: 1, createdAt: -1, _id: -1 }
Notification: { userId: 1, readAt: 1, createdAt: -1 }
Analytics:    { visitorId: 1, productId: 1, type: 1, createdAt: -1 }
Application:  { status: 1, createdAt: -1 }
Report:       { status: 1, createdAt: -1 }
```

Unused/duplicate index সরান—Atlas Free-এর 0.5 GB limit documents এবং indexes দুটো মিলিয়ে গণনা করে।

## Data retention budget

0.5 GB hard limit-এর জন্য alert threshold:

- 50%: investigate growth;
- 70%: analytics retention কমানো/export;
- 80%: writes-at-risk warning ও paid upgrade decision;
- 90%: non-essential analytics writes বন্ধ।

Retention:

| Data | Policy |
|---|---|
| Users/products/orders/payments | permanent; scheduled export backup |
| Notifications | 30–60 days, unread exception প্রয়োজনমতো |
| Raw analytics | 7 days |
| Aggregated daily analytics | 12 months |
| Request telemetry | production DB-তে নয়; রাখলে ≤24 hours |
| Load-test jobs | memory-only/dev-only |

Atlas Free automated backup দেয় না। প্রতিদিন/সপ্তাহে encrypted `mongodump` অন্য নিরাপদ storage-এ রাখুন এবং মাসে অন্তত একবার restore test করুন। Backup job চালানোর জন্য নিজের trusted machine/GitHub Actions ব্যবহারের আগে secret exposure ও egress বিবেচনা করুন।

## Deployment configuration

### Cloudflare Pages (frontend)

```text
Root directory: frontend
Build command: npm ci && npm run build
Output directory: dist
Environment: VITE_API_BASE_URL=https://api.example.com/api/v1
```

- SPA fallback configure;
- hashed assets: `Cache-Control: public, max-age=31536000, immutable`;
- `index.html`: short/no-cache;
- CSP, HSTS, Referrer-Policy এবং Permissions-Policy;
- production source maps public deploy থেকে বাদ।

### Render Free Web Service (backend)

```text
Root directory: backend
Build command: npm ci && npm run build
Start command: npm start
Health path: /api/v1/health
```

- `NODE_ENV=production`;
- exact frontend origin in `CLIENT_URL`;
- generated 32+ byte JWT secret;
- Atlas/Cloudflare credentials dashboard secret হিসেবে;
- local filesystem-এ upload/data নয়—Render filesystem ephemeral;
- `dist/` source control থেকে deploy না করে build output ব্যবহার;
- health endpoint DB query না করে liveness রাখুন; আলাদা readiness endpoint DB ping করবে;
- cold start UI-তে friendly “service waking up” retry with exponential backoff দেখান।

### Region placement

Render backend এবং Atlas cluster-এর geographically closest available region বেছে নিন। Dhaka users-এর latency কমানোর জন্য frontend CDN যথেষ্ট; backend–database round trip কমানো বেশি গুরুত্বপূর্ণ।

## Security checklist

- production `.env` কখনো Git-এ commit নয়;
- JWT cookie: `httpOnly`, `secure`, suitable `sameSite`, short expiry;
- Cloudflare Pages ও Render cross-site হলে cookie/CORS configuration browser-এ test;
- Helmet CSP project-specific করা;
- Zod validation রাখা, Mongo object ID validation সব param-এ;
- login brute-force rate limit;
- admin seed/bootstrap startup-এর প্রতিবার expensive write করবে না;
- admin load-test route `NODE_ENV=production`-এ register করবেন না;
- R2 upload signed URL, MIME/size allowlist এবং random object key;
- dependency audit ও monthly update window;
- admin actions/order transitions structured audit log-এ রাখুন—generic request telemetry নয়।

## Free-tier capacity test plan

Production service নিজেকে load test করবে না। Local/staging থেকে k6/Artillery চালান এবং free provider acceptable-use policy মেনে ছোট ধাপে test করুন:

1. 5 virtual users, 10 মিনিট;
2. 10 VU, 10 মিনিট;
3. 25 VU, 10 মিনিট;
4. 50 VU, short test—latency/error বাড়লে থামুন;
5. SSE আলাদাভাবে connection/reconnect test।

Pass target:

- cached public GET p95 < 500 ms (warm);
- DB-backed GET p95 < 800 ms (warm);
- order write p95 < 1.5 s;
- unexpected error < 1%;
- memory stable < 400 MB;
- Mongo connections < 50 for this single API instance;
- no duplicate order/oversell;
- cold start আলাদা metric, warm latency-এর সঙ্গে মেশাবেন না।

৫,০০০ VU test Free Render/Atlas-এর বিরুদ্ধে চালাবেন না—সেটি meaningful capacity result দেবে না এবং service suspension ঘটাতে পারে।

## Upgrade triggers

নিচের যেকোনো একটি হলে free tier আর production-safe নয়:

- নিয়মিত warm p95 > 1s বা 5xx > 1%;
- memory > 400 MB বা frequent restart;
- Atlas storage > 70%;
- database operation throttling/queueing;
- Render cold start business conversion ক্ষতি করছে;
- uptime/recovery business requirement;
- daily active users/traffic free quotas-এর কাছে;
- multiple API instance প্রয়োজন;
- automated backup/PITR প্রয়োজন;
- sustained 20–50+ concurrently active users।

Upgrade order: প্রথমে always-on backend, তারপর MongoDB paid tier/backup, এরপর Redis + দ্বিতীয় API replica। Frontend static hosting সাধারণত free-তেই রাখা যাবে।

## Implementation sequence

### Sprint A — data/traffic reduction

1. DB telemetry disable + sampled logs।
2. polling reduction।
3. pagination/projection/`.lean()`।
4. analytics batching, dedupe ও TTL।
5. product search/query simplification।

### Sprint B — correctness and resilience

1. transactional checkout।
2. bounded auth cache ও rate limiter।
3. notification claim/retry/reconnect।
4. server timeout, pool, graceful shutdown/readiness।
5. backup/export and restore test।

### Sprint C — deploy and prove

1. Cloudflare Pages + R2 setup।
2. Render backend + Atlas closest regions।
3. security headers/cookies/CORS validation।
4. staged external load test।
5. alerts, quota dashboard ও upgrade thresholds।

## Official limit references

- [Render Free services](https://render.com/docs/free)
- [Render compute plans](https://render.com/docs/compute-plans)
- [MongoDB Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
- [MongoDB Atlas connection limits](https://www.mongodb.com/docs/atlas/reference/alert-resolutions/connection-alerts/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Upstash Redis pricing](https://upstash.com/pricing/redis)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)

## Bottom line

Free tier-এ optimization-এর মূলনীতি হলো **কম request, কম DB operation, ছোট response, bounded memory এবং aggressive retention**। প্রথম release-এ Redis/microservice যোগ না করে single Render instance-এর সীমা মেনে code সরল রাখুন। ৫,০০০ registered account রাখা সম্ভব হলেও ৫,০০০ concurrent active user free stack-এর target নয়। P0 optimization শেষ করে measured capacity অনুযায়ী user growth হলে paid backend/database-এ upgrade করাই production-safe পথ।
