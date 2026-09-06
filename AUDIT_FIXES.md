# Audit remediation — 5 September 2026

This document supersedes the implementation status in the original `PROJECT_AUDIT_REPORT.md`. The original report is retained as the baseline, so its old line references and initial test results are historical.

| Finding | Implemented change |
|---|---|
| 1. Public seller cost exposure | Public DTOs omit all cost fields; authenticated owner endpoints expose costs for editing. |
| 2. Partial/duplicate checkout | Stable per-row idempotency keys, unique buyer/key index, payload-conflict checks, successful-row removal and retained failed rows. Checkout rate allowance supports multi-item carts. |
| 3. Order concurrency/notification failure | Conditional state updates, order-embedded notification events and idempotent worker delivery. Fulfilled-unit counts come from orders. Concurrent extension requests/decisions are guarded. |
| 4. Account cache isolation | Identity/role changes abort pending API requests, cancel queries, clear cache/toasts and reset the previous account's cart. |
| 5. Restriction gaps | Shared mutation guard; order placement checks active seller role/status. Reactivation remains available. |
| 6. Expired bans | Expired restrictions normalize before login rejection and during authenticated requests. |
| 7. Variant IDs | Edits retain existing IDs and reject duplicates/foreign IDs. |
| 8. Mock admin removal | Database-backed inventory includes paused/removed listings, pagination and persisted removal reasons. Sellers cannot reactivate removed listings. |
| 9. Mock SEO saves | Owned products and the real product-intelligence update endpoint replace mock metadata. |
| 10. Sorting | Explicit price/newest order takes precedence; database sorting/pagination replaces full-feed JavaScript ranking. Recommended uses active boost, rating and recency. |
| 11. Price mismatch | Variant selection, product total, cart and checkout use the effective discounted price; backend remains authoritative. |
| 12. PPC attribution | Campaign-specific events/orders; organic results are excluded. Estimated spend and disconnected ad serving are disclosed. |
| 13. Fake admin overview | Database counts and fulfilled marketplace sales; company boost/premium earnings stay separate. |
| 14. Placeholder settings/saved items | Persisted profile, notification preference, platform announcement/support/title and account-specific saved products. |
| 15. Unbounded expensive reports | Company aggregation and marketplace pagination run in MongoDB. Seller analytics enforce row caps and disclose competitor sampling. |
| 16. Error handling | Validation/cast/duplicate/JSON errors receive appropriate status and details; unexpected failures use a generic 500 with server logging. Database auth failures are no longer misreported as invalid sessions. |
| 17. Lint | Unused imports/helpers removed; lint passes. |
| 18. Prototype structure/docs/bundle | Active routes and API clients split by feature; unused mocks/demo services removed; versions pinned to installed resolutions; setup documentation replaced; lazy route chunks reduce initial JS. |

## Validation

- Backend production build: pass.
- Frontend lint and production build: pass. Initial JS approximately 274 kB (86 kB gzip), compared with the audit's 973 kB (278 kB gzip); no oversized chunk warning.
- 18 backend tests pass, including real HTTP/MongoDB regression tests in an isolated, randomly named database. Coverage includes public/owner cost permissions, variant IDs, concurrent retries, six-item checkout, terminal status and notification idempotency, expired bans, restrictions, sorting/errors, profile/saved persistence, moderation, SEO, company/PPC calculations, concurrent extensions and notification preferences.
- Browser checks on isolated fixture data: buyer login; profile persistence after reload; saved toggle; discounted product/cart price; successful UI checkout with one persisted pending order totaling BDT 80 and a success toast; seller A to seller B cache isolation showing B's empty inventory; admin inventory removal with persisted reason and success toast. The admin screenshot was visually inspected; the browser reported no page errors.

## Deliberate limits

Payment gateway integration remains deferred. No refund or manual receipt flow was added. Company income comes only from successful receipt records; demo activation does not fabricate income. PPC estimated costs are not billing records, and campaign ad serving is not connected.

Seller reports cap detailed order/event rows at 20,000 and owned products/campaigns at 2,000. Competitor benchmarks sample at most 1,000 active products. These are explicit bounds, not a claim of unrestricted historical analytics. Browser checks are targeted regression verification, not an exhaustive production-load or every-device certification.

Reproduction commands and fixture cleanup are documented in [README.md](README.md).
