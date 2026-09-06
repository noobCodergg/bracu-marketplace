# Project audit — 5 September 2026

> Remediation update: see [AUDIT_FIXES.md](AUDIT_FIXES.md) for implemented changes and final verification. The findings and test results below describe the original audit baseline.

এই audit-এ **১৮টি finding group** পাওয়া গেছে: **৭টি High, ৯টি Medium, ২টি Low**। এগুলো security, data correctness, অসম্পূর্ণ feature এবং maintenance সমস্যা। Build পাস করলেও এই সমস্যাগুলো ধরা পড়ে না।

Application source পরিবর্তন করা হয়নি। এই রিপোর্ট তৈরি এবং build/check চালানো হয়েছে। Database-এ কোনো record লেখা, live payment, load test job বা external notification পাঠানো হয়নি।

## যাচাইয়ের সীমা ও ফলাফল

| Check | ফলাফল |
|---|---|
| Backend production build | PASS |
| Frontend production build | PASS; main JS প্রায় 973.36 kB, gzip 278.10 kB; chunk-size warning |
| Full frontend lint | FAIL: `App.tsx:24`-এ unused `Analytics` import |
| Existing company analytics tests | 3/3 PASS |
| Isolated reproduction, actual model/handler with in-memory stubs | 5টি finding reproduce হয়েছে: public cost exposure, variant ID regeneration, sixth-request rate limit, broken price sorting, expired-ban login rejection |
| Browser / live MongoDB end-to-end test | করা হয়নি |

“Reproduced” মানে isolated execution-এ আচরণ দেখা গেছে। অন্য findings source ও active route trace থেকে নিশ্চিত implementation issue অথবা স্পষ্টভাবে উল্লেখ করা concurrency/performance risk; live production incident হিসেবে দাবি করা হচ্ছে না।

## High priority

### 1. Public product API seller-এর private cost প্রকাশ করছে — reproduced

**Evidence:** [products.ts:34](backend/src/routes/products.ts#L34), [products.ts:54](backend/src/routes/products.ts#L54)। একই `view()` public এবং seller response-এ `costPrice`, `packagingCost`, `otherCost` ফেরত দেয়।

**Impact:** Login ছাড়াই competitor বা buyer seller-এর purchase/packaging cost দেখতে পারে। Isolated anonymous detail handler-এ `costPrice: 55` response-এ পাওয়া গেছে।

**Fix:** Public এবং owner/admin response DTO আলাদা করতে হবে। Public response-এ শুধু প্রয়োজনীয় selling price, variant ও availability থাকবে।

### 2. Multi-item checkout partial success এবং duplicate order তৈরি করতে পারে

**Evidence:** [MarketplaceProductPages.tsx:48](frontend/src/pages/MarketplaceProductPages.tsx#L48), [userRateLimiter.ts:6](backend/src/middleware/userRateLimiter.ts#L6), [orders.ts:222](backend/src/routes/orders.ts#L222)। Checkout প্রতিটি cart row-এর জন্য আলাদা `POST /orders` পাঠায় এবং `Promise.all` ব্যবহার করে। Limiter একই endpoint-এ ৫ সেকেন্ডে ৫টি request অনুমোদন করে।

**Trigger:** ৬টি আলাদা cart row একসঙ্গে checkout করা। Limiter-এর isolated test-এ ৫টি request pass এবং ষষ্ঠটি 429 হয়েছে। প্রথম ৫টি order অন্যভাবে valid হলে সেগুলো তৈরি হতে পারে, কিন্তু frontend পুরো checkout-কে failed দেখিয়ে সব cart item রেখে দেয়। Retry-তে আগের সফল item আবার order হবে। অন্য যেকোনো একটি item ব্যর্থ হলেও একই partial-success সমস্যা থাকে।

**Fix:** Server-side batch checkout এবং idempotency key। Atomic checkout সম্ভব না হলে per-item success/failure ফিরিয়ে সফল item cart থেকে সরাতে হবে। শুধু rate limit বাড়ানো যথেষ্ট নয়।

### 3. Order status ও side effect atomic নয়

**Evidence:** [orders.ts:351](backend/src/routes/orders.ts#L351), [orders.ts:360](backend/src/routes/orders.ts#L360), [orders.ts:268](backend/src/routes/orders.ts#L268), [notifications.ts:16](backend/src/services/notifications.ts#L16)। Status update-এ আগে product order counter বাড়ে, পরে order save হয়। Create/update-এর database write হওয়ার পর notification awaited হয়।

**Impact:** একই pending order-এর concurrent completion request দুটোই পুরোনো status পড়লে counter দুবার বাড়তে পারে। Notification write ব্যর্থ হলে order ইতোমধ্যে তৈরি/আপডেট হওয়ার পরও API error দেয়; retry duplicate action ঘটাতে পারে। এটি code-derived race/failure-path risk; live concurrency test করা হয়নি।

**Fix:** Expected-current-status সহ conditional atomic update, consistent transaction/counter strategy এবং notification outbox/retry। Notification failure-কে সফল order creation-এর failure হিসেবে দেখানো যাবে না।

### 4. Account switch-এ আগের user-এর cached private data থেকে যায়

**Evidence:** [auth.ts:3](frontend/src/store/auth.ts#L3), [queryClient.ts:10](frontend/src/config/queryClient.ts#L10), [SellerProducts.tsx:14](frontend/src/pages/SellerProducts.tsx#L14), [DashboardPages.tsx:1304](frontend/src/pages/DashboardPages.tsx#L1304)। Logout-এ QueryClient/cart reset হয় না। `['database-products']`, `['orders']`, `['coupons']`-এর মতো private query key user ID ছাড়া ব্যবহার হচ্ছে।

**Trigger/impact:** একই tab-এ seller A logout করে seller B login করলে fresh cached result থেকে A-এর listings/orders কিছু সময় দেখা যেতে পারে। Cart-ও নতুন account-এ রয়ে যায়। এটি client-side cache isolation সমস্যা; backend অন্য user-এর data অনুমোদন করে—এমন দাবি নয়।

**Fix:** Private query keys-এ account ID, logout/account change-এ private cache cancel/remove এবং account-specific local state reset।

### 5. Account restrictions সব mutation-এ enforce হচ্ছে না

**Evidence:** [auth.ts:15](backend/src/middleware/auth.ts#L15), [products.ts:52](backend/src/routes/products.ts#L52), [products.ts:57](backend/src/routes/products.ts#L57), [products.ts:59](backend/src/routes/products.ts#L59), [coupons.ts:14](backend/src/routes/coupons.ts#L14), [ppcCampaigns.ts:8](backend/src/routes/ppcCampaigns.ts#L8)। `requireAuth` suspended/frozen account-কে authenticate করে; `requireRole` শুধু role দেখে। কিছু mutation ACTIVE check করে, product status/delete, store availability, coupon toggle এবং campaign mutation-এ তা অনুপস্থিত।

আর [orders.ts:127](backend/src/routes/orders.ts#L127)-এ seller-এর শুধু `acceptingOrders` দেখা হয়, account status নয়। ফলে restricted seller-এর active listing থেকে নতুন order নেওয়ার পথ খোলা থাকে।

**Fix:** Reusable active-account guard এবং action-specific restriction policy। Checkout-এ seller role/status-ও যাচাই করতে হবে। React-এর restricted screen API authorization-এর বিকল্প নয়।

### 6. Timed ban মেয়াদ শেষে নিজে থেকে unlock হয় না — reproduced

**Evidence:** [auth.ts:17](backend/src/routes/auth.ts#L17), [auth.ts:15](backend/src/middleware/auth.ts#L15), [adminUsers.ts:11](backend/src/routes/adminUsers.ts#L11)। Ban দিলে token version বদলে পুরোনো session invalid হয়। Expiry normalization authenticated middleware-এ আছে, কিন্তু login `BANNED` দেখেই reject করে।

**Impact:** Ban শেষ হওয়ার পর পুরোনো token দিয়ে middleware-এ পৌঁছানো যায় না, নতুন login-ও হয় না। Expired `restrictionEnds`-সহ user দিয়ে isolated login handler এখনও 403 দিয়েছে।

**Fix:** Login এবং authenticated request দুটোতেই session/status decision-এর আগে একই expiry-normalization logic চালানো।

### 7. Product edit existing variant ID বদলে দেয় — reproduced

**Evidence:** [products.ts:15](backend/src/routes/products.ts#L15), [products.ts:56](backend/src/routes/products.ts#L56), [Product.ts:3](backend/src/models/Product.ts#L3), [SellerProductForm.tsx:29](frontend/src/pages/SellerProductForm.tsx#L29)। Variant input schema ID গ্রহণ করে না; পুরো variants array replace হয়। Mongoose নতুন subdocument `_id` দেয়।

**Impact:** শুধু title/description edit করলেও old cart-এর variant ID invalid হতে পারে। পুরোনো order-এর `variantId` আর বর্তমান variant-এর সঙ্গে মেলে না; variant analytics বিচ্ছিন্ন হয়। Actual model-এর array replacement test-এ ID বদলেছে।

**Fix:** Existing owned variant ID validate/preserve করে targeted update; শুধু নতুন variant-এ নতুন ID।

## Medium priority

### 8. Admin listing remove বাস্তবে database থেকে কিছু সরায় না

**Evidence:** [DashboardPages.tsx:3016](frontend/src/pages/DashboardPages.tsx#L3016), [services/index.ts:227](frontend/src/services/index.ts#L227)। Active `/admin/foods` route live feed পড়ে, কিন্তু remove action in-memory `foods` mock array পরিবর্তন করে। Removal reason textarea-ও submit payload-এ নেই।

**Impact:** Success toast/modal close হলেও database listing থাকে। Public feed ব্যবহারে admin শুধু প্রথম ৪০টি matching active/pre-order listing পায়; paused/out-of-stock listing দেখা যায় না।

**Fix:** Dedicated admin inventory API with pagination/status filters এবং audited moderation endpoint। Reason বাধ্যতামূলকভাবে backend-এ পাঠানো।

### 9. Seller SEO page live product পড়লেও mock-এ save করে

**Evidence:** [DashboardPages.tsx:1132](frontend/src/pages/DashboardPages.tsx#L1132), [services/index.ts:293](frontend/src/services/index.ts#L293)। `/seller/seo` seller-owned inventory-এর বদলে public feed নেয়; `seoService.save()` mock `foods.find()` ব্যবহার করে।

**Impact:** Real MongoDB product ID-তে সাধারণত “Food not found”; SEO metadata persist হয় না। অন্য seller-এর product-ও selection-এ আসতে পারে।

**Fix:** Seller-owned products load করে existing product-intelligence-settings API বা dedicated SEO API-তে save করা।

### 10. Price / Newest sorting কার্যকর primary sort নয় — reproduced

**Evidence:** [products.ts:44](backend/src/routes/products.ts#L44)। Requested sort-এর আগে tier, quality বা random comparison return হয়। তাই price/newest শুধু বিরল tie-breaker হিসেবে কাজ করে।

**Reproduction:** `Price low to high`-তে actual handler ফিরিয়েছে `[100,300,200,500,400,700,600,800]`।

**Fix:** Explicit price/newest selection-এ সেই comparator আগে ব্যবহার করা; sponsored placement রাখতে হলে UI-তে আচরণ স্পষ্ট করা।

### 11. Discounted variant-এর displayed price এবং checkout total মেলে না

**Evidence:** [MarketplaceProductPages.tsx:21](frontend/src/pages/MarketplaceProductPages.tsx#L21), [MarketplaceProductPages.tsx:47](frontend/src/pages/MarketplaceProductPages.tsx#L47), [orders.ts:168](backend/src/routes/orders.ts#L168)। Detail price/cart row `variant.price` নেয়; subtotal ও backend `variant.discountPrice ?? variant.price` নেয়।

**Example:** Regular 100, discount 80 হলে detail/row 100 দেখাতে পারে কিন্তু subtotal/backend 80। Backend client-supplied total বিশ্বাস করে না—এটি display inconsistency, overcharge প্রমাণ নয়।

**Fix:** Shared effective-selling-price helper দিয়ে detail, variant picker, cart row ও total একইভাবে render করা।

### 12. PPC analytics organic performance-ও প্রতিটি campaign-এ গণনা করে

**Evidence:** [sellerAnalytics.ts:34](backend/src/routes/sellerAnalytics.ts#L34), [products.ts:46](backend/src/routes/products.ts#L46), [analyticsEvents.ts:7](backend/src/routes/analyticsEvents.ts#L7)। Campaign report campaign-specific event/order-এর বদলে পুরো product-এর views/sales নেয়। একই product-এর দুই campaign থাকলে একই sale দুবার campaign revenue হয়। Feed events organic/boost/marketplace source তৈরি করে; campaign-attributed serving path পাওয়া যায়নি।

**Impact:** Campaign ROAS, spend ও conversion misleading। Bid/budget estimates-কে actual measured campaign economics হিসেবে ব্যবহার করা যাবে না।

**Fix:** Campaign ID-সহ impressions/clicks/order attribution implement করে তার ওপর report; ততদিন unsupported metrics স্পষ্টভাবে estimate/unavailable দেখানো।

### 13. Admin dashboard এখনও hardcoded business numbers দেখায়

**Evidence:** [DashboardPages.tsx:2036](frontend/src/pages/DashboardPages.tsx#L2036), [services/index.ts:487](frontend/src/services/index.ts#L487)। Active admin dashboard-এ 2,846 users, 126 sellers, 14 approvals, ৳8.4L sales hardcoded। Chart `Math.sin`-ভিত্তিক generated data।

**Impact:** নতুন company earnings page real DB পড়লেও admin overview বাস্তব platform activity দেখায় না।

**Fix:** Real summary endpoint; API unavailable হলে error/empty state। Mock data শুধু explicit demo environment-এ।

### 14. Settings ও Saved products feature বাস্তবে অসম্পূর্ণ

**Evidence:** [DashboardPages.tsx:3426](frontend/src/pages/DashboardPages.tsx#L3426), [DashboardPages.tsx:3224](frontend/src/pages/DashboardPages.tsx#L3224), [FoodCard.tsx:8](frontend/src/components/FoodCard.tsx#L8)। Settings “Save changes” button-এর handler/form submission নেই এবং profile default hardcoded। Saved page `data.slice(1,5)` দেখায়; heart button-এর save/remove behavior নেই।

**Impact:** User পরিবর্তন বা bookmark সংরক্ষণ হচ্ছে মনে করতে পারেন, কিন্তু persistence নেই। Toast infrastructure এগুলোকে functional করে না।

**Fix:** Profile/preferences ও per-user saved-product APIs; অথবা feature প্রস্তুত না হওয়া পর্যন্ত action সরিয়ে পরিষ্কার unavailable state।

### 15. Feed ও analytics request-এ dataset বড় হলে ব্যয় দ্রুত বাড়বে

**Evidence:** [products.ts:44](backend/src/routes/products.ts#L44), [products.ts:46](backend/src/routes/products.ts#L46), [sellerAnalytics.ts:25](backend/src/routes/sellerAnalytics.ts#L25), [adminAnalytics.ts:15](backend/src/routes/adminAnalytics.ts#L15)। Feed সব matching product load/rank করার পর slice করে। Seller premium অন্য seller-দের সব product-ও load করে। Company analytics সব period receipts load করে প্রতিদিনের জন্য আবার filter করে।

**Impact:** Pagination দেখালেও DB/memory কাজ bounded নয়; বেশি data ও polling-এ latency/memory বাড়বে। এটি structural scalability risk; production-scale benchmark করা হয়নি।

**Fix:** Mongo aggregation/projections, indexed filtering, precomputed ranking এবং database-level pagination। Company totals/trend aggregate ও latest-50 receipts query আলাদা করা।

### 16. API validation detail UI-তে হারায়; invalid ID-তেও 500 হয়

**Evidence:** [errors.ts:8](backend/src/middleware/errors.ts#L8), [services/index.ts:62](frontend/src/services/index.ts#L62), [products.ts:54](backend/src/routes/products.ts#L54)। Zod response-এর `errors` API client discard করে শুধু “Validation failed” throw করে। Mongoose CastError/ValidationError general 500 handler-এ পড়ে; raw error message client-এ ফেরত যায়।

**Impact:** User কোন field ঠিক করবেন বুঝতে পারেন না; invalid input server failure হিসাবে telemetry-তে গণনা হয় এবং internal detail প্রকাশ পেতে পারে।

**Fix:** Typed API error with field errors/status/code; form field mapping; malformed ID/validation/duplicate error যথাক্রমে 400/409 এবং unexpected 500-তে generic public message।

## Low priority / structure

### 17. Full lint বর্তমানে fail করছে

**Evidence:** [App.tsx:24](frontend/src/App.tsx#L24)। `Analytics` imported কিন্তু unused। `npm run lint`-এ 1 error, 0 warnings।

**Impact:** Lint-enforced CI fail করবে। এটি আগের admin analytics route replacement-এর অবশিষ্ট import।

**Fix:** Unused import সরানো এবং CI-তে build + lint রাখা।

### 18. Prototype ও live implementation একই structure-এ মিশে আছে

**Evidence:** [App.tsx:160](frontend/src/App.tsx#L160), [services/index.ts:1](frontend/src/services/index.ts#L1), [frontend README](frontend/README.md)। `Real*` pages-এর পাশাপাশি legacy page exports, `void` দিয়ে retained imports, mock এবং live services একই module-এ আছে। DashboardPages প্রায় 3,460 lines; SellerAnalyticsPages প্রায় 1,672; services/index প্রায় 1,047। README এখনও backend/auth নেই এবং DEV switcher ব্যবহারের কথা বলে।

**Impact:** ভুল service বেছে নেওয়ার বাস্তব ফল #8/#9; onboarding ও review কঠিন। Initial JS chunk-এ সব route eager import হওয়ায় analytics/admin code-ও download হয়।

**Fix:** Active-route inventory করে unused prototype archive/remove; feature-based folders (`auth`, `catalog`, `orders`, `seller`, `admin`, `analytics`), আলাদা DTO/API modules এবং route lazy loading। বাস্তব setup/auth/database instructions দিয়ে README update করা। বড় rewrite একবারে নয়; feature অনুযায়ী ছোট change।

## ইচ্ছাকৃতভাবে deferred — bug হিসেবে গণনা করা হয়নি

- Payment gateway পরে implement করার সিদ্ধান্ত অনুযায়ী এখন gateway নেই—এটি expected। Company analytics শুধু stored `SUCCEEDED` BDT payment পড়ে; payment না থাকলে zero দেখানো সঠিক।
- Refund ও manual receipt entry না থাকা বর্তমান requirement। এগুলো ফেরত আনার সুপারিশ নেই।
- Gateway যুক্ত করার সময়ে verified server-side callback, idempotent payment persistence এবং boost/premium entitlement activation একসঙ্গে সংযুক্ত করতে হবে। Current boost activation/payment-independent premium demo-কে paid entitlement ধরে production launch করা যাবে না।
- Stock model এবং UI-র “Order any quantity” আচরণের মধ্যে পার্থক্য আছে: order creation stock reserve/decrement করে না। Unlimited/pre-order যদি intentional হয়, সেটি documented হওয়া দরকার; stocked inventory intended হলে আলাদা stock correctness fix লাগবে। Requirement নিশ্চিত নয় বলে এটি confirmed bug count-এ রাখা হয়নি।

## কাজের প্রস্তাবিত ক্রম

1. Public cost exposure, checkout idempotency/partial failure, order consistency, account/cache isolation এবং restriction expiry ঠিক করা।
2. Variant identity, real admin moderation ও seller SEO persistence ঠিক করা।
3. Price consistency/sorting ও analytics attribution ঠিক করা; placeholder dashboard/settings/saved feature replace বা hide করা।
4. Feature অনুযায়ী structure cleanup, DTO/error handling, query optimization ও README update।
5. Checkout partial failure, concurrent status update, account switch, expired restriction, variant edit এবং real moderation নিয়ে integration/browser regression suite তৈরি করা। বর্তমান তিনটি financial summary test এসব flow cover করে না।
