# ADR-0005 — Gate only the KG download; free OSS; monetization deferred

**Status:** Accepted (2026-07-20)

## Context
The tool is free and open source, and the explicit goal right now is **audience + GitHub stars + donations**, not
revenue. A hard signup wall on a free OSS CLI is exactly the friction that suppresses stars. But the KG lives in a
private repo and genuinely needs a broker to hand out safely.

## Decision
- **Gate exactly one action: downloading a KG.** Install, browsing the site, copying the command, and starring
  the repo are all **free and signup-free**.
- The gate exists for **access-control** (brokering the private KG). Audience-capture is a **free side-effect**
  of it, not a reason to add friction elsewhere.
- **No paid plans in v1.** Donations via GitHub Sponsors (+ Buy Me a Coffee). Paid offerings (an MCP service, or
  charging for the KG) are a **phase-2** decision after there's an audience.

## Consequences
- The website's job is discovery + a frictionless copy + optional signup. The CLI's job is auth exactly at the
  download.
- Because the `.md` is just public files the user could fetch anyway, the KG is the real gated value — accepted.
- Success is measured as consented-email list size + stars + donations. Willingness-to-pay is unknowable until a
  phase-2 paywall exists and is out of scope.
- Star growth is earned-attention only (README + demo, honest Show HN, subreddits). Bought/again-manipulated
  stars are a GitHub AUP violation and are forbidden.
