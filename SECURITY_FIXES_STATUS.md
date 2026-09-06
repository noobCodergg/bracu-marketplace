# Security remediation status

Updated: 6 September 2026

## Fixed

- Production startup rejects the known development JWT secret.
- JWT signing and verification pin `HS256`, issuer and audience.
- Unsafe browser methods reject cross-site/mismatched origins; missing Origin is rejected in production.
- URL-encoded request parsing was removed; API mutations accept JSON.
- Admin load-test routes are not registered in production, and the production UI hides the panel.
- Premium analytics requires a recent successful server-side payment record.
- Product boost requires and atomically consumes an unused successful payment meeting the selected plan price.
- Browser localStorage no longer grants premium authorization.
- Sensitive admin, analytics and SSE authentication bypasses the short-lived auth cache.
- Role/status moderation, seller approval and reactivation invalidate auth cache immediately.
- Successful mutations clear public response cache, preventing stale moderated content.
- Public platform GET no longer performs a database write.
- Anonymous analytics has a dedicated 2 requests/second limit, requires a visitor identifier, deduplicates events into 10-minute buckets, and raw events expire after 7 days.
- Deployment proxy hops are explicit; telemetry uses Express-resolved client IP instead of trusting raw forwarded headers.
- New product image URLs must use HTTPS.
- New passwords require at least 10 characters with uppercase, lowercase and a number; existing users can still log in.
- Backend and frontend production dependency audits found zero known advisories.

## Verified

- Cross-origin mutation regression test passes.
- Trusted-origin mutation regression test passes.
- Legacy JWT without pinned issuer/audience is rejected.
- Backend TypeScript build and test suite pass.
- Frontend production build and ESLint pass.

## Still needs external product/infrastructure work

- Integrate a real payment gateway webhook with signature verification. Until then paid features securely remain locked unless a trusted server-side process creates successful payments.
- Move checkout inventory/order/coupon operations into a MongoDB transaction.
- Replace arbitrary remote image hosting with signed uploads to controlled object storage, MIME sniffing/re-encoding and an image-domain CSP allowlist.
- Add admin MFA/passkeys, recent re-authentication, email verification and password recovery.
- Add persistent distributed rate limiting when moving beyond one backend instance.
- Run full database-backed security tests using an isolated MongoDB test database before release.
