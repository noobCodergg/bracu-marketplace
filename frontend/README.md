# BRACU Food Express

A complete frontend prototype for a campus food pre-order marketplace. Buyers discover and reserve meals, sellers manage their kitchen and listings, and admins moderate the marketplace. No backend, payments, or real authentication are included.

## Run locally

```bash
npm install
npm run dev
```

Quality checks: `npm run lint` and `npm run build`.

## Architecture

The app uses React, Vite, strict TypeScript, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, Zustand, Recharts, and Lucide.

- `src/mocks` owns development records. Pages never import these arrays.
- `src/services` is the backend boundary. Its typed asynchronous methods simulate API calls and own feed ordering/business mutations.
- `src/pages` contains public marketplace and role-specific screens.
- `src/components` contains the shared product UI and layout primitives.
- `src/store` holds only session state. Server-like state lives in TanStack Query.
- `src/config/api.ts` reads `VITE_API_BASE_URL` for future integration.

## Demo accounts

Use the `DEV` switcher in the public header or `/login` to select Admin, Active Seller, Frozen Seller, Active Buyer, Pending Buyer, or Suspended User. Authentication is an in-memory Zustand session and deliberately stores no credentials.

## Backend integration

Replace the implementations in `src/services` with `fetch`/Axios requests using `apiConfig.baseUrl`. Preserve service signatures and domain types, and the UI/query layer will not need rewriting. A production backend must enforce authentication, authorization, account status, validation, upload rules, and payment integrity; frontend route guards are UX only.

## Mock workflows

Pre-orders, eligible cancellation, seller listing create/edit/delete/pause/boost, order-status progression, seller reactivation requests, account upgrades, user moderation, seller approvals, filters, and range-based analytics are functional in memory. Refreshing resets the mock database.
