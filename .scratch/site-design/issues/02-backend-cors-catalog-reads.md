# 02 — Backend: CORS for the site origin on read-only catalog endpoints

**What to build:** The browser on the website's origin can call the read-only catalog API (`GET /catalog`, `GET /catalog/{slug}`) cross-origin — the Cloudflare Worker returns the correct CORS headers for the site origin (production + local dev), so the site lists docs directly without a proxy. Auth, the download broker, and `/catalog/upsert` semantics are unchanged; only the two public read endpoints are opened.

**Blocked by:** None — can start immediately.

**Status:** done 2026-07-20

- [x] `GET /catalog` and `GET /catalog/{slug}` return CORS headers that allow the site origin(s), including the local dev origin, so a browser fetch from the site succeeds with no CORS error.
- [x] CORS is scoped to the read-only endpoints only — `/catalog/upsert`, the OAuth exchange, and the download broker are NOT opened to arbitrary origins.
- [x] Any required preflight (`OPTIONS`) on the read endpoints is handled.
- [x] A backend vitest test asserts the CORS headers on the read endpoints (prior art: `backend/src/catalog.test.ts`).

## Comments

Landed as `backend/src/cors.ts` (allow-list `withCors`/`corsPreflight`/`isCatalogReadPath`), wired into `src/index.ts` for `OPTIONS` + the two GET reads only. Allow-list is `env.SITE_ORIGINS` (comma-separated, prod + local dev) — off-list Origin fails closed with no header; reads are already public (ADR-0005) so this is browser-reachability, not a new gate. 8 tests in `backend/src/cors.test.ts` (all 6 backend files, 50 tests pass).
