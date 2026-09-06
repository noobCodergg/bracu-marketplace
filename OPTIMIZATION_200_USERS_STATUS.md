# 200-user optimization status

Implemented on 6 September 2026 for a target of 200 simultaneous connected users and a burst of 100 users requesting the same public API.

## Completed

- Production request telemetry no longer writes one MongoDB document per API call by default.
- Production request logs are sampled to server errors and requests slower than one second.
- MongoDB pool is explicitly bounded to 10 connections with idle and selection timeouts.
- Read-only authentication checks use a bounded 2,000-entry, 30-second LRU-style cache; mutations still read fresh user state.
- In-memory rate-limit and abuse maps are bounded; normal endpoint allowance is 20 requests/user/second and auth remains 5.
- Public catalog, product detail, best-selling, seller availability, reviews and platform settings have bounded short-lived caches.
- Identical cold-cache requests are coalesced so 100 concurrent requests execute one underlying handler/database query.
- Orders and reviews have a hard 100-record response cap.
- Product, order, notification and attribution hot-path indexes were added.
- High-frequency frontend polling was reduced; analytics auto-polling was replaced with five-minute stale caching.
- HTTP keep-alive/header/request timeouts and a ten-second forced shutdown deadline were added.
- A server-wide load-shedding gate executes at most 40 API requests, queues at most 160 for five seconds, then returns `503 Retry-After` instead of allowing unbounded work to exhaust the process.
- Frontend read queries retry transient `429`, `503` and server errors with bounded exponential delay and jitter; mutations are not automatically replayed.
- Backend test includes a real HTTP test with 100 concurrent identical requests.

## Verification

- Backend TypeScript build: passed.
- Backend tests: 6 passed, 1 database-dependent suite skipped by its existing test setup.
- 100-request coalescing test: passed; handler executions = 1.
- Overload test: passed; configured execution ceiling was never exceeded and excess requests received controlled `503` responses with retry guidance.
- Frontend production build: passed.
- Frontend ESLint: passed.

## Still required before claiming real 200-user production capacity

- Deploy to the selected free-tier providers and run an external staged workload against production-like data.
- Measure warm p95/p99 latency, memory, MongoDB operations and error rate at 20, 50, 100, 150 and 200 connected users.
- Move checkout inventory/order/coupon changes into a MongoDB transaction for crash-safe multi-document consistency.
- Add cursor pagination to replace the temporary 100-record cap where users need older history.
- Configure Cloudflare Pages/CDN and object storage for images.
- Configure production secrets, exact CORS origin, proxy trust and backup/export automation.

The automated 100-request test proves stampede protection in the application layer; it is not a substitute for provider/database load testing.
