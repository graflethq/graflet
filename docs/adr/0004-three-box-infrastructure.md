# ADR-0004 — Three-box infrastructure split

**Status:** Accepted (2026-07-20)

## Context
Three workloads with different needs: an always-up user-facing backend, a daily bulk release-poller, and heavy
graphify builds. Constraints discovered: Cloudflare's free plan caps **50 subrequests per invocation** (fine for
normal requests, fatal for a 1,000-repo poll in one run); the AlexHost VPS runs **occasional scheduled
maintenance** (unacceptable for a user-facing backend); the VPS is **2 shared cores / ~2.4 GB free RAM** ("avoid
CPU-intensive tasks").

## Decision
Put each workload on the infrastructure that fits it:

- **Backend → Cloudflare Worker.** Always-up, global, free tier. The 50-subrequest limit never applies because
  each user request makes only ~1–3 outward calls (the counter resets per request). Holds the private-repo
  token; brokers KG downloads; runs GitHub OAuth; triggers emails.
- **Daily poller → the VPS.** A background job that tolerates the VPS's maintenance windows (a missed daily run
  is harmless; the design is resumable) and avoids the 50-limit. Uses the VPS's existing n8n/cronicle. Free.
- **Graphify builds → the Mac / a rented box.** Needs real CPU/RAM the VPS lacks. Pushes KGs to the private
  repo and POSTs status to the backend.

## Consequences
- Cloudflare is **not** dropped (an earlier idea to host the backend on the VPS is reversed — maintenance
  downtime rules it out).
- Verified (GitHub docs, 2026-07-20): conditional `304` responses are free **only when authenticated** — so the
  poller must send a token (no scopes needed for public reads). Secondary rate limits still apply → poll
  serially/throttled.
- Operator alerts go to **Telegram**; subscriber alerts go to **email**. Two channels, never merged.
- If the VPS's latency/reliability disappoints as traffic grows, front the backend with Cloudflare later — no
  change needed now.
