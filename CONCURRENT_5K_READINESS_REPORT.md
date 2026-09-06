# B Market: 5,000 Concurrent User Readiness Report

তারিখ: ৬ সেপ্টেম্বর ২০২৬  
Scope: বর্তমান `frontend/` ও `backend/` source-এর read-only architecture review। কোনো production load test বা database `explain()` চালানো হয়নি।

## Executive summary

বর্তমান project-টি functional MVP হিসেবে ভালো ভিত্তি তৈরি করেছে, কিন্তু **একই সময়ে ৫,০০০ active user** production-এ সামলানোর জন্য এখনো প্রস্তুত নয়। প্রধান কারণ হলো backend একটি single Express process হিসেবে ধরা হয়েছে, প্রায় প্রতিটি authenticated request MongoDB থেকে user পড়ে, প্রতিটি API response-এর জন্য আবার MongoDB-তে telemetry document লেখে, realtime notification ও rate-limit memory-তে রাখা হয়, এবং কয়েকটি high-traffic query scan/large response তৈরি করতে পারে।

এখানে “৫,০০০ concurrent user” মানেই ৫,০০০ request/second নয়। উদাহরণস্বরূপ, প্রত্যেকে গড়ে ১০ সেকেন্ডে একটি request করলে প্রায় ৫০০ RPS; ৫ সেকেন্ডে একটি হলে প্রায় ১,০০০ RPS। SSE notification চালু থাকলে ৫,০০০ long-lived connection-ও থাকবে। তাই target নির্ধারণ করতে হবে অন্তত:

- ৫,০০০ connected sessions
- ৫০০ sustained RPS এবং ১,০০০ RPS short burst (প্রাথমিক planning target)
- p95 read latency < 300 ms, p95 write latency < 500 ms
- API error rate < 1%, order duplication/oversell = 0

বর্তমান অবস্থায় সবচেয়ে জরুরি কাজ: per-request telemetry write সরানো, auth lookup কমানো, Redis-backed shared state/queue যোগ করা, catalog query/index ঠিক করা, pagination বাধ্যতামূলক করা, এবং অন্তত ২–৪টি stateless API replica-এর সামনে load balancer বসানো। বাস্তব instance count কেবল staged load test থেকে নির্ধারণ করতে হবে।

## বর্তমান architecture-এ পাওয়া bottleneck

### P0 — production-এর আগে অবশ্যই

#### 1. প্রতিটি request-এ telemetry MongoDB write

`backend/src/middleware/systemTelemetry.ts` প্রতিটি `/api/v1` response শেষ হলে `SystemRequestModel.create(...)` চালায়। ৫০০ API RPS হলে শুধু telemetry-তেই প্রায় ৫০০ DB write/second যোগ হবে। একই middleware প্রতিটি request-এর JSON `console.log`-ও করে; high traffic-এ stdout এবং log ingestion bottleneck/cost তৈরি করবে।

প্রস্তাব:

- request path থেকে MongoDB telemetry write সরিয়ে bounded in-memory buffer বা external metrics pipeline ব্যবহার করা;
- Prometheus/OpenTelemetry counter ও histogram ব্যবহার করা, raw request document নয়;
- raw audit event প্রয়োজন হলে Redis/Kafka/SQS queue-তে পাঠিয়ে batch insert করা এবং sampling (যেমন success 1–5%, error 100%) প্রয়োগ করা;
- production-এ structured logger, log level এবং sampling যোগ করা।

#### 2. প্রতিটি protected request-এ user document read

`backend/src/middleware/auth.ts`-এর `requireAuth` প্রতিবার `UserModel.findById(...)` চালায়। এরপর route-ও একই user আবার পড়তে পারে। ফলে একটি সাধারণ request ১টি business query করার আগেই authentication DB read করে। Frontend-এর polling এই amplification আরও বাড়ায়।

প্রস্তাব:

- JWT-তে প্রয়োজনীয় `sub`, `role`, `status`, `tokenVersion` রাখুন;
- Redis-এ `user-session:{id}`/revocation version ৩০–৬০ সেকেন্ড TTL-সহ cache করুন;
- suspension/ban/logout-এর সময় cache invalidate করুন;
- sensitive write route-এ fresh DB check রাখা যায়, কিন্তু catalog/read endpoints-এ প্রতি request DB read নয়;
- Mongoose query-তে document mutation প্রয়োজন না হলে `.lean()` ব্যবহার করুন।

#### 3. horizontal scaling-safe shared state নেই

নিচের state process memory-তে থাকে:

- `userRateLimiter.ts`: rate-limit windows;
- `systemTelemetry.ts`: abuse windows;
- `notifications.ts`: SSE client map;
- `loadTests.ts`: load-test jobs;
- `orderNotifications.ts`: প্রতি instance-এর timer worker।

একাধিক API replica চালালে প্রতিটি instance আলাদা limit গণনা করবে, SSE client-কে অন্য instance থেকে notification পাঠানো যাবে না, এবং একাধিক worker একই event নিয়ে race করতে পারে।

প্রস্তাব:

- Redis-backed rate limiter (atomic increment/sliding window);
- Redis Pub/Sub বা Streams দিয়ে সব replica-তে realtime event fan-out;
- BullMQ/Redis Streams/SQS-ভিত্তিক durable worker queue;
- API process ও worker process আলাদা deployment;
- worker claim/lease বা atomic `findOneAndUpdate` ব্যবহার; বর্তমান find-then-process loop multiple worker-safe নয়;
- load-test job production API memory-তে না রাখা।

#### 4. product listing query scale করবে না

`backend/src/routes/products.ts`-এ user search `$regex` + case-insensitive match দিয়ে `name`, `searchKeywords`, `seller` scan করে। বর্তমান text index এই regex query-তে কার্যকর হবে না। একই aggregation-এ `$lookup`, computed boost, sort, count facet এবং প্রতি result-এর impression/search event insert আছে। প্রতিটি catalog page view ৪০–৮০টি analytics write তৈরি করতে পারে।

প্রস্তাব:

- MongoDB Atlas Search/Elasticsearch/Meilisearch ব্যবহার, অথবা প্রথম ধাপে `$text` query;
- common browse filters-এর compound indexes, workload যাচাই করে যেমন `{status:1, category:1, subcategory:1, price:1}` এবং আলাদা sort-specific index;
- seller status/availability denormalize বা cached seller eligibility ব্যবহার করে hot-path `$lookup` সরানো;
- listing impression per-item raw write না করে browser-side batched endpoint, deduplication এবং queue;
- expensive total count optional/cached করা;
- deep pagination-এর জন্য `skip` নয়, cursor (`createdAt`, `_id`) ব্যবহার করা।

#### 5. order creation সম্পূর্ণ atomic transaction নয়

`backend/src/routes/orders.ts` inventory decrement করে পরে order create করে; create fail হলে compensating increment করে। process crash বা transient failure-এর মাঝখানে inventory/order অসামঞ্জস্য হতে পারে। Coupon redemption-ও order-এর বাইরে best-effort update। Concurrent checkout-এর জন্য conditional decrement ভালো পদক্ষেপ, কিন্তু multi-document consistency নিশ্চিত নয়।

প্রস্তাব:

- MongoDB replica set/Atlas transaction-এ inventory reserve + order create + coupon update করুন;
- idempotency index বর্তমানের মতো রাখুন;
- transaction retry policy ও unknown-commit-result handling যোগ করুন;
- oversell, duplicate submission, process crash এবং retry নিয়ে concurrency integration test লিখুন;
- order status query-এর জন্য `{sellerId:1,status:1,createdAt:-1}` এবং `{buyerId:1,status:1,createdAt:-1}` workload অনুযায়ী যোগ করুন।

#### 6. API replicas ও connection limits

`backend/src/server.ts` একটি Node process চালায় এবং `database.ts` default Mongoose pool ব্যবহার করে। ৫,০০০ SSE/client connection ও burst traffic-এর জন্য explicit timeouts, connection budget এবং graceful drain অসম্পূর্ণ।

প্রস্তাব:

- load balancer-এর পেছনে minimum 2–4 stateless API replicas দিয়ে শুরু;
- per-instance `maxPoolSize`/`minPoolSize` নির্ধারণ করুন; মোট pool যেন MongoDB tier-এর connection limit না ছাড়ায়;
- `server.keepAliveTimeout`, `headersTimeout`, `requestTimeout`, max connections এবং shutdown drain timeout নির্ধারণ;
- readiness endpoint-এ DB/Redis dependency যাচাই, liveness আলাদা;
- autoscaling CPU-এর পাশাপাশি RPS, event-loop lag ও latency-ভিত্তিক করা;
- static frontend CDN-এ এবং product images object storage + CDN-এ রাখা। বর্তমানে image কেবল URL হলেও upload/storage policy নেই।

### P1 — load test-এর আগে

#### 7. unbounded responses ও missing pagination

নিচের endpoint-গুলো limit ছাড়া collection ফেরত দেয় বা বড় হতে পারে:

- `GET /orders`
- `GET /admin/users`
- seller products/coupons/PPC campaigns
- reviews per product
- seller applications/reactivation requests/reports

প্রস্তাব: সব list endpoint-এ validated `limit` (default 20/40, maximum 100), cursor, stable sort এবং projection দিন। Admin users endpoint বিশেষভাবে full collection memory-তে নেয়।

#### 8. frontend polling amplification

Frontend-এ ৫, ১০, ১৫, ৩০ ও ৬০ সেকেন্ড interval-এ বিভিন্ন query চলে। `main.tsx` restricted user-এর session প্রতি ৫ সেকেন্ডে restore করে; orders ১০/৩০ সেকেন্ডে poll হয়; notification-এর SSE থাকার পরও ৬০ সেকেন্ড polling থাকে। একই user একাধিক tab খুললে traffic গুণ হয়।

প্রস্তাব:

- orders/status updates SSE channel বা WebSocket event দিয়ে invalidate করুন;
- fallback polling 60–120 সেকেন্ড এবং page hidden/offline হলে বন্ধ;
- `refetchOnWindowFocus` ও exponential backoff ঠিক করুন;
- cross-tab leader election/BroadcastChannel দিয়ে একটি tab-কে realtime connection owner করুন;
- restricted account restore polling event-driven বা অনেক ধীর করুন।

#### 9. SSE capacity ও delivery semantics

বর্তমান SSE map এক instance-এর client-ই জানে। Proxy buffering off header আছে, কিন্তু reconnect resume (`Last-Event-ID`) নেই; deploy/disconnect-এর সময় notification miss হতে পারে। প্রতি connection-এ আলাদা heartbeat timer-ও ৫,০০০ timer তৈরি করবে।

প্রস্তাব:

- Redis Pub/Sub fan-out + persisted notifications;
- SSE event `id`, `Last-Event-ID` resume বা reconnect-এর পর unread fetch;
- shared/bucketed heartbeat scheduler;
- reverse proxy-তে buffering off, idle timeout > heartbeat interval;
- SSE connection count, disconnect/reconnect rate ও write backpressure monitor;
- প্রয়োজন না হলে socket authentication DB lookup কমান।

#### 10. indexes ও query discipline

বিদ্যমান কিছু compound index ভালো, কিন্তু hot filters-এর সঙ্গে সব index aligned নয়। Production data snapshot-এ `explain('executionStats')` ছাড়া index blindly যোগ করা উচিত নয়। সম্ভাব্য candidates:

- Product: status/category/subcategory/price এবং seller/status/updatedAt;
- Order: seller/status/createdAt, buyer/status/createdAt, notification-events pending lookup;
- Notification: userId/readAt/createdAt;
- Coupon: code/active/sellerId (business rule অনুযায়ী global code নাকি seller-scoped code স্থির করুন);
- AnalyticsEvent: visitorId/productId/type/createdAt;
- SellerApplication/ReactivationRequest/Report: status/createdAt।

প্রতিটি candidate query production-like data-তে `totalDocsExamined`, `totalKeysExamined`, execution time এবং index size দিয়ে যাচাই করতে হবে। অতিরিক্ত index write cost বাড়ায়।

### P2 — operational hardening

- Redis ও MongoDB unavailable হলে timeout/circuit-breaker এবং degraded behaviour;
- bounded request body ইতিমধ্যে 1 MB—route-specific ছোট limits রাখা;
- CORS exact allowlist, reverse-proxy `trust proxy` সঠিকভাবে configure; ভুল হলে IP rate limiting ভেঙে যাবে;
- secrets manager, JWT key rotation, আলাদা production secret;
- database backup, point-in-time recovery এবং restore drill;
- error tracking, distributed tracing, event-loop lag, heap, GC, DB pool wait time, slow query dashboard;
- payment/boost action থাকলে provider webhook verification ও idempotent ledger;
- admin-only in-process load-test endpoint production build থেকে disable/remove। একই server নিজেকে load test করলে ফল distorted হয় এবং outage ঘটাতে পারে।

## প্রস্তাবিত target architecture

```text
Browser
  |-- static assets/images --> CDN + Object Storage
  |-- API/SSE -------------> Load Balancer / WAF
                                |--> API replica 1 --|
                                |--> API replica 2 --|--> MongoDB Atlas replica set
                                |--> API replica N --|
                                         |          |
                                         +--> Redis (cache, rate limit, pub/sub, queue)
                                                   |
                                              Worker replicas
```

API replicas stateless থাকবে। MongoDB হবে source of truth; Redis disposable cache/shared coordination; durable job প্রয়োজন হলে queue retention/retry/DLQ থাকবে।

## বাস্তবায়ন roadmap

### Phase 1 — ২–৪ দিন: measurement baseline

1. Production-like seed data বানান: users, products, orders, analytics events।
2. External k6/Artillery scenario লিখুন; production API-র নিজস্ব load-test route ব্যবহার করবেন না।
3. p50/p95/p99 latency, throughput, error rate, event-loop lag, CPU/RAM, MongoDB ops/slow query/pool wait সংগ্রহ করুন।
4. Traffic model আলাদা করুন: browse 60%, product detail 15%, auth/profile 10%, order reads 10%, writes 5%; সঙ্গে ৫,০০০ SSE connections।

### Phase 2 — ৫–১০ দিন: P0 code changes

1. Telemetry async/sampled metrics pipeline।
2. Redis session/status cache + distributed limiter।
3. Catalog search/index/analytics batching।
4. Paginated API contract।
5. Transactional checkout।
6. Redis-backed realtime fan-out ও durable notification worker।

### Phase 3 — ৩–৫ দিন: deployment hardening

1. Container image, health/readiness probes, graceful shutdown।
2. Load balancer + multiple API/worker replicas।
3. MongoDB/Redis sizing, pool budget, autoscaling rules।
4. CDN/object storage এবং WAF/DDoS controls।

### Phase 4 — ২–৪ দিন: staged proof

1. 500 → 1,000 → 2,500 → 5,000 connected user ramp; হঠাৎ spike নয়।
2. প্রতিটি stage-এ 15–30 মিনিট soak, শেষে 1–2 ঘণ্টা soak।
3. replica restart, worker restart, Redis reconnect, Mongo primary failover পরীক্ষা।
4. target SLO pass না করলে bottleneck মেপে ঠিক করে পুনরায় test।

## Acceptance criteria

- ৫,০০০ concurrent sessions এবং নির্ধারিত RPS-এ p95/p99 SLO pass;
- ১% এর কম unexpected 5xx/timeout; 429 আলাদাভাবে capacity error হিসেবে গণনা;
- duplicate order, oversell, lost notification-event নেই;
- API replica restart-এ inflight request graceful drain এবং clients reconnect;
- rate limit সব replica জুড়ে consistent;
- MongoDB connections tier limit-এর নিরাপদ সীমার মধ্যে এবং pool wait negligible;
- memory 60–70% steady-state-এর নিচে, continuous growth/leak নেই;
- cache/queue সাময়িক ব্যর্থতায় documented degradation ও recovery হয়।

## Bottom line

**বর্তমান code সরাসরি ৫,০০০ concurrent user-এর জন্য deploy করা উচিত নয়।** সবচেয়ে বড় bottleneck raw telemetry/analytics write amplification, per-request auth DB hit, regex catalog search, unbounded queries এবং process-local state। P0 পরিবর্তন, horizontal deployment এবং external staged load test শেষ হলে তবেই ৫k readiness দাবি করা যাবে। কোনো নির্দিষ্ট server size বা replica count code review থেকে নির্ভরযোগ্যভাবে বলা সম্ভব নয়; সেটা production-like workload এবং database size দিয়ে benchmark করতে হবে।
