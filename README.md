# B Market

React/Vite frontend and Express/Mongoose API for a campus marketplace. Buyers save products and place orders; sellers manage listings, delivery, coupons and analytics; admins moderate accounts/products and inspect company earnings.

## Development

In both `backend` and `frontend`, run `npm ci` (PowerShell: `npm.cmd ci`). Copy `backend/.env.example` to `backend/.env` and configure MongoDB and authentication. Run `npm run dev` in each directory. Vite proxies `/api` to backend port 5000; health is `/api/v1/health`. Keep credentials out of source control.

## Verification

- Frontend: `npm run lint` and `npm run build`.
- Backend: `npm test` builds and runs unit tests; database integration tests are opt-in.
- Database tests in PowerShell, from `backend`: `$env:RUN_DB_TESTS='1'; npm.cmd test`. Tests connect to the configured server with a random `bracu_regression_*` database. Fixtures and cleanup are guarded against touching the application database; the database user needs create/drop permission.
- Browser fixture: build the backend, run `node dist/tests/browserServer.js`, then run `npm run dev -- --config tests/vite.config.mjs` in `frontend`. Open `http://127.0.0.1:5177`; this explicitly proxies to the fixture on port 5001. Test-only credentials are in the fixture source. `GET http://127.0.0.1:5001/__fixture/stop` cleans up; a 30-minute timeout also cleans up normally. Forced termination can leave the randomly named fixture database behind.

## Implementation

- Backend routes enforce permissions; models persist records; services calculate reports, normalize account restrictions and deliver notifications.
- Frontend API clients are split by feature. Active route modules load lazily from `pages/dashboard` and `pages/marketplace`; no runtime mock data layer remains.
- Cart rows have stable idempotency keys. Successful rows leave the cart; failed rows remain for retry. Order transitions commit notification events in the same write; a worker retries delivery using unique event keys.
- Account changes cancel pending API requests and clear cache/previous-account cart state. Guest carts survive the first login.
- Company earnings include only successful stored boost/premium receipts minus recorded direct/gateway costs. No refund or manual receipt workflow exists. Gateway integration is deferred; demo activation does not create paid income.
- PPC uses campaign-attributed events/orders. Estimated click cost is not billed spend; ad serving is not connected. Seller reports enforce row limits and disclose competitor sampling. Marketplace results and admin inventory use database pagination.

See [remediation details](AUDIT_FIXES.md) and [the original audit](PROJECT_AUDIT_REPORT.md).
