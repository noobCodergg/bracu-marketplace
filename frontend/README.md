# Marketplace frontend

React/Vite/TypeScript application backed by the Express API. Run npm ci, then npm run dev; the development proxy targets API port 5000. Quality checks: npm run lint and npm run build.

Active screens live in src/pages; API clients are split by feature under src/services. TanStack Query manages server data, Zustand manages authentication/cart/toasts, and route modules load lazily. No runtime mock data layer remains.

See the [root README](../README.md) for setup, isolated browser fixtures, payment scope and regression checks.
