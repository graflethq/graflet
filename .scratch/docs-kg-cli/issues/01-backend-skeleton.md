# 01 — Backend skeleton + secrets + health

**What to build:** The always-up backend exists as a deployed Cloudflare Worker with a live public URL (ADR-0004 puts the user-facing backend on Workers, not the maintenance-prone VPS). Hitting its `/health` endpoint returns ok with no sign-in — health is public because the gate applies only to KG downloads (ADR-0005), so this is the one always-public surface. The three things later tickets depend on are wired into the Worker's runtime but not yet used: the private-repo access token and the GitHub OAuth client secret are stored as Cloudflare Worker secrets (never committed to the repo), and the catalog store — a KV namespace or D1 database — is bound so the catalog API and download broker can later read and write it. Nothing user-facing beyond health yet — just the deployable shell that tickets 02 (catalog store), 03 (OAuth), and 05 (download broker) build directly on top of.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Deploying the Worker publishes it to a live URL, and `curl https://<worker-url>/health` returns HTTP 200 with an `ok` body — sent with no auth header (health is public; the gate applies only to KG download, ADR-0005).
- [ ] The backend is a Cloudflare Worker with a committed wrangler config whose deploy target is Cloudflare, not the VPS (ADR-0004).
- [ ] `wrangler secret list` shows both the private-repo access token and the GitHub OAuth client secret as Worker secrets, and a grep of the tracked repo finds neither value anywhere.
- [ ] A catalog store binding — KV namespace or D1 database — is declared in the wrangler config and is reachable from the Worker at runtime (a probe path performs a trivial read against it and still returns ok).
- [ ] From inside the fetch handler, `env` exposes all three — the private-repo token, the OAuth client secret, and the catalog-store binding — verified by a smoke check that confirms their presence (not their values), so tickets 02/03/05 build on them with no re-wiring.
