# B Market security audit report

তারিখ: ৬ সেপ্টেম্বর ২০২৬  
Scope: `backend/src`, `frontend/src`, environment/dependency configuration এবং production-facing routes-এর static review। কোনো destructive penetration test চালানো হয়নি।

## Executive summary

বর্তমান application-এ validation, role-based access, ownership filters, generic server errors, HTTP-only cookies, Helmet, bounded request/load controls এবং checkout idempotency-এর মতো ভালো controls আছে। তবে public production deployment-এর আগে কয়েকটি **Critical/High application-level vulnerability** fix করা দরকার।

সবচেয়ে গুরুত্বপূর্ণ ঝুঁকি:

1. Premium analytics ও product boost-এর server-side payment entitlement নেই—paid feature bypass করা যায়।
2. Cookie-authenticated mutation-এর জন্য explicit CSRF/origin protection নেই।
3. Production JWT secret missing হলেও development default দিয়ে server চালু হতে পারে।
4. Admin load-test feature production server-কে ইচ্ছাকৃতভাবে self-DoS করাতে পারে।
5. Anonymous analytics endpoints arbitrary database writes দিয়ে storage/analytics poisoning করতে পারে।
6. Auth cache invalidation function ব্যবহার না হওয়ায় role/status পরিবর্তনের পর stale access window থাকে।

বর্তমান `npm audit --omit=dev` ফল:

- Backend: 0 known vulnerabilities across 114 production dependencies.
- Frontend: 0 known vulnerabilities across 61 production dependencies.

Dependency audit clean হওয়া application logic নিরাপদ হওয়ার প্রমাণ নয়; নিচের findings code-level।

## Findings summary

| ID | Severity | Finding | Primary impact |
|---|---|---|---|
| SEC-01 | Critical | Paid feature entitlement bypass | Revenue loss, unauthorized premium data |
| SEC-02 | Critical | Production JWT secret has unsafe fallback | Session forgery if misconfigured |
| SEC-03 | High | Explicit CSRF/origin defense missing | Authenticated state-changing requests |
| SEC-04 | High | Production admin self-load-test endpoint | Service denial of service |
| SEC-05 | High | Anonymous analytics write/poisoning | Atlas storage exhaustion, false analytics |
| SEC-06 | High | Auth cache is never invalidated | Suspended/changed users retain stale GET access |
| SEC-07 | High | Checkout is not a DB transaction | Inventory/order/coupon integrity failure |
| SEC-08 | Medium | Arbitrary third-party image URLs | Tracking/privacy, unsafe content source |
| SEC-09 | Medium | Proxy/IP trust is inconsistent | Incorrect limiting and spoofed telemetry |
| SEC-10 | Medium | Cache invalidation missing after moderation/mutation | Removed or changed content remains visible |
| SEC-11 | Medium | Password/account controls incomplete | Account takeover resistance |
| SEC-12 | Low | Account existence disclosure | User enumeration |
| SEC-13 | Low | Public GET mutates platform settings | Unsafe HTTP semantics/audit ambiguity |

## Detailed findings

### SEC-01 — Critical: paid feature entitlement bypass

Evidence:

- `backend/src/routes/sellerAnalytics.ts`: `GET /seller/analytics/premium` checks only `SELLER`/`ADMIN` role; no active subscription/payment is verified.
- `frontend/src/pages/SellerAnalyticsPages.tsx`: premium activation state is stored in browser `localStorage`, which any user can edit.
- `backend/src/routes/products.ts`: `POST /products/:id/boost` directly enables boost; no verified payment/receipt is required.

Attack:

- Seller directly calls the premium API without paying.
- Seller edits `localStorage` to unlock the UI.
- Seller calls boost endpoint and activates a paid boost without a successful provider transaction.

Fix:

- Introduce server-side `Entitlement`/`Subscription` and immutable `Payment` ledger.
- Only verified payment-provider webhook may mark payment `SUCCEEDED` and grant entitlement.
- Premium middleware checks user, product, entitlement type and `expiresAt` on every premium request.
- Boost activation must consume a paid entitlement atomically; client-supplied payment state is never trusted.
- Webhook signature verification, event idempotency and replay protection required.
- Remove all security decisions based on `localStorage`; it may only remember UI state.

Acceptance test: direct API calls without entitlement return `402`/`403`; forged localStorage does nothing; replayed webhook does not grant twice.

### SEC-02 — Critical: unsafe JWT secret fallback in production

Evidence: `backend/src/config/env.ts` supplies a known development JWT secret by default. If the production environment variable is absent, startup succeeds with that predictable key.

Impact: attacker can sign an admin/session JWT if deployment accidentally uses the fallback.

Fix:

- In `production`, require `JWT_SECRET` explicitly and reject known/default values.
- Require at least 32 random bytes (prefer 64) rather than only 32 characters.
- Pin signing and verification to `HS256` or migrate to asymmetric keys.
- Add `issuer` and `audience` claims and verify both.
- Document key rotation; rotation should invalidate or safely overlap existing sessions.

Acceptance test: production startup fails when secret is missing, short or default; token with wrong algorithm/issuer/audience is rejected.

### SEC-03 — High: CSRF/origin defense missing

Evidence:

- Authentication uses a cookie.
- State-changing routes accept POST/PATCH/PUT/DELETE without CSRF token or trusted `Origin`/`Referer` verification.
- CORS is configured, but CORS is not a complete CSRF control; browsers can submit some cross-origin requests without allowing the attacker to read the response.
- `express.urlencoded()` broadens the set of form-submittable bodies.

Existing `SameSite=Lax` helps, but correctness depends on final frontend/API domain topology and does not replace explicit protection for a marketplace/admin system.

Fix:

- For every unsafe method, require exact trusted `Origin`; reject missing origin in browser sessions except documented non-browser webhook routes.
- Add synchronizer/double-submit CSRF token for cookie-authenticated mutations.
- Remove `express.urlencoded()` if no route requires it; accept JSON only.
- Keep `HttpOnly`, `Secure`; choose `SameSite=Lax/Strict` when frontend/API are same-site. If truly cross-site and `SameSite=None` is needed, CSRF token becomes mandatory.
- Validate payment webhook separately using provider signatures, not CSRF.

Acceptance test: cross-origin form/fetch cannot mutate profile, orders, products, admin actions or logout.

### SEC-04 — High: admin load-test endpoint can self-DoS production

Evidence: `backend/src/routes/loadTests.ts` can generate 20,000 requests at concurrency 200 from the production process back into itself. Admin authorization limits access, but a stolen/admin-CSRF session can exhaust the small free instance. Running the generator inside the target also distorts capacity metrics.

Fix:

- Do not register `/admin/load-tests` when `NODE_ENV=production`.
- Run k6/Artillery externally against staging.
- If retained outside production, require a second explicit `ENABLE_LOAD_TESTS=true`, short-lived re-authentication and an audit event.
- Never allow arbitrary hosts; current localhost-only construction is good and should remain.

Acceptance test: production route returns 404 even for admin.

### SEC-05 — High: anonymous analytics poisoning and storage DoS

Evidence:

- `POST /analytics/events/cart` and `/funnel` require no authentication.
- A caller controls visitor ID, product IDs, event type and quantity.
- Funnel accepts up to 50 products and inserts one event per matching product.
- Generic per-IP limit still permits significant writes and can be distributed across IPs.

Impact: fake seller analytics/PPC attribution, 0.5 GB Atlas Free storage exhaustion, write/CPU exhaustion.

Fix:

- Issue a short-lived, signed anonymous visitor token server-side; do not trust arbitrary visitor ID alone.
- Strict dedicated endpoint limits, e.g. per IP + visitor + product.
- Batch size and event frequency constraints; one deduplicated event per visitor/product/type/time bucket.
- Do not accept arbitrary attribution/campaign claims; resolve server-side.
- TTL raw analytics (e.g. 7 days) and aggregate counters asynchronously.
- Reject events without same-site `Origin`; add bot/WAF protection.
- Monitor write volume and disable nonessential analytics near storage threshold.

Acceptance test: repeating identical event does not create unlimited documents; forged visitor/campaign attribution is rejected.

### SEC-06 — High: auth cache invalidation is not connected

Evidence: `invalidateAuthCache()` exists in `backend/src/middleware/auth.ts`, but no route calls it. GET/HEAD requests can use cached role/status/token version for up to 30 seconds.

Impact:

- A newly suspended/banned user may keep authenticated read access during TTL.
- A role change may leave stale authorization state.
- Sensitive GET endpoints such as analytics can expose data during that window.

Fix:

- Invalidate immediately after admin status change, seller approval/reactivation, password change and token-version update.
- Do not cache authorization for admin routes, premium data, SSE connection establishment or other sensitive endpoints.
- Alternatively cache only session existence and verify role/status for sensitive resources.
- Add tests proving ban/role change takes effect on the next request.

### SEC-07 — High: checkout lacks atomic transaction

Evidence: inventory decrement, order creation and coupon redemption update happen as separate operations with compensating rollback. A process crash/network ambiguity can leave inventory reserved without an order or coupon counters inconsistent.

Fix:

- MongoDB transaction around inventory reservation, order/outbox creation and coupon use.
- Preserve idempotency key; handle transient transaction errors and unknown commit results.
- Coupon usage should be based on an enforceable redemption record, not only a counter.
- Add concurrent last-item and crash simulation tests.

### SEC-08 — Medium: arbitrary third-party image URLs

Evidence: seller product images accept any valid URL and frontend loads them directly in `<img>`. Avatar/default images also call third parties.

Impact: sellers can embed tracking pixels, expose visitors’ IP/referrer to attacker-controlled hosts, serve changing/inappropriate content, and create availability/performance problems. Browser execution risk is reduced because React uses `<img>` and text is escaped, but remote content still creates a trust boundary.

Fix:

- Upload images directly to controlled R2/object storage using signed upload URLs.
- Validate MIME by file signature, maximum bytes/dimensions, decode/re-encode raster images, strip metadata.
- Disallow SVG initially.
- Serve through one controlled image domain; CSP `img-src` allowlist only that domain/data as required.
- Use `referrerPolicy="no-referrer"` during migration.

### SEC-09 — Medium: proxy/IP trust inconsistency

Evidence:

- Express `trust proxy` is not explicitly configured.
- Rate limiter uses `req.ip`/socket address.
- Telemetry directly trusts the first `X-Forwarded-For` value.

Impact: behind Render/Cloudflare, many users may share a proxy IP and block one another; alternatively forwarded identity may be spoofed in analytics. Incorrect proxy configuration can also weaken IP limiting.

Fix:

- Define trusted proxy hops/CIDRs for the actual deployment chain.
- Use only Express-resolved `req.ip`; do not manually trust arbitrary XFF.
- Test direct-origin access and Cloudflare → Render chain.
- Protect/bypass origin so attackers cannot skip Cloudflare controls where practical.

### SEC-10 — Medium: response cache invalidation missing

Evidence: public product/platform/review caches expire only by TTL. Product removal/edit, seller availability change and platform settings update do not invalidate related cache keys.

Impact: removed/unsafe listing may remain publicly visible for 15 seconds; platform/security notice can remain stale for 60 seconds. A product may appear orderable briefly after seller closes orders.

Fix:

- Export scoped cache invalidation by prefix/key.
- Invalidate product list/detail/availability after every relevant mutation/moderation.
- Never cache security/authorization decisions.
- Use explicit cache keys rather than raw URL ordering where possible.

### SEC-11 — Medium: password/account protection incomplete

Current state: bcrypt cost 12 and generic login failure are good. Missing:

- compromised/common password rejection;
- password change/reset and recovery controls;
- email verification;
- MFA/passkeys for admin;
- recent-authentication requirement for dangerous admin actions;
- login security audit trail/session list;
- progressive account/IP throttling across process restarts.

Fix priority: admin MFA/passkey and recent re-authentication first, then secure reset flow with single-use hashed tokens and short expiry.

### SEC-12 — Low: account enumeration

Registration returns a distinct “account already exists” response. Attackers can enumerate emails despite generic login errors.

Fix: return a neutral registration/login-assistance message, or accept the usability trade-off explicitly and rate-limit heavily. Do not reveal roles/status.

### SEC-13 — Low: GET endpoint performs a database mutation

`GET /platform` runs an `updateOne` migration-like rename on every cache miss. GET should be safe/idempotent without state mutation; crawlers and monitoring can trigger writes.

Fix: move rename to a one-time migration/seed script and make route read-only.

## Controls that are already good

- Zod schemas constrain most request body/query fields and prevent direct object/operator injection.
- Ownership filters generally bind seller/buyer resources to authenticated user IDs.
- Admin routes generally apply both authentication and `ADMIN` role checks.
- React renders user text without `dangerouslySetInnerHTML`, reducing stored XSS exposure.
- JWT is stored in `HttpOnly` cookie rather than localStorage.
- Password hashes are excluded from normal Mongoose selects.
- Login error is generic.
- Helmet and exact configured CORS origin are present.
- Request body and concurrency are bounded; load shedding returns controlled 503.
- Order idempotency and conditional stock decrement reduce duplicate/oversell races.
- `.env` is ignored and is not tracked; only `.env.example` is tracked.
- Production dependency audits currently report zero known advisories.
- Server errors returned to clients are generic rather than exposing stack traces.

## Recommended fix order

### Security Sprint 1 — release blockers

1. Fail production startup on unsafe/missing JWT secret; pin JWT claims/algorithm.
2. Add origin + CSRF middleware and remove unused URL-encoded parser.
3. Disable internal load-test route in production.
4. Enforce premium/boost entitlement on backend; remove localStorage authorization.
5. Connect auth cache invalidation and bypass cache on sensitive routes.

### Security Sprint 2 — abuse and integrity

1. Protect, deduplicate and expire anonymous analytics.
2. Make checkout transactional.
3. Configure trusted proxy/IP handling.
4. Add cache invalidation after mutation/moderation.
5. Move image ingestion to controlled object storage.

### Security Sprint 3 — account/operations

1. Admin MFA/passkeys and recent re-authentication.
2. Email verification and secure password recovery.
3. Security audit events for login/admin/payment actions.
4. CSP tuned to actual CDN/API/image domains.
5. Backup/restore drill, secret rotation and incident-response runbook.

## Required security tests

- Cross-site POST/PATCH/PUT/DELETE rejected without valid origin/CSRF token.
- Forged JWT algorithms, issuer, audience and default-secret tokens rejected.
- Banned user loses access immediately, including cached GET and SSE.
- Buyer cannot become seller/admin or read another user’s orders/saved data.
- Seller cannot edit another seller’s product/campaign/order.
- Premium/boost direct calls fail without server entitlement.
- Replayed payment webhook and checkout request are idempotent.
- Anonymous analytics spam is rate-limited/deduplicated and expires.
- Production load-test route is absent.
- Malformed ObjectIds/JSON/oversized bodies return bounded 4xx without crash.
- Removed product is unavailable immediately despite prior cache hit.
- Dependency audit runs in CI for both package locks.

## Final assessment

Current security posture is **not yet ready for a public commercial marketplace**, mainly because paid entitlement is client-influenced/missing on the server, production secret misconfiguration can be catastrophic, and CSRF/anonymous-write defenses are incomplete. Core authorization structure is a useful foundation, and dependency state is currently clean. Security Sprint 1 should be completed before public deployment; Sprint 2 should be completed before accepting real orders/payments.
