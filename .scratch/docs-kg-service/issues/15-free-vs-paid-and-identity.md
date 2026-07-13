# Decide free vs paid, the pricing model, and the v1 identity model

Type: grilling
Status: resolved
Mode: HITL
Blocked by: 02, 06

## Question

Given Context7 is free and the graph is the defensible artifact while verbatim .md is license-gated to green-zone sites - is v1 free, paid, or freemium, and what exactly does money buy? Force a choice among: (a) fully free to grow, (b) pay-per-bundle / credits, (c) subscription for freshness + more sites, (d) freemium (free small green bundles; pay for large graphs, red-zone graph-only, or on-demand builds). Why would someone pay when Context7 is free? Bundled with this: is 'type email -> we email the link' the whole v1 identity (no accounts), or do we stand up accounts now - is there anything to gate yet (paid tier, download history, rate-limits), and do we want the collected emails as a marketing list (needs a consent checkbox)?

---

**Why session-sized / why this type:** Only the founder decides the money model and whether there's a paid tier to gate; identity/accounts only becomes meaningful once pricing says whether there's something to gate, so they're one conversation, grounded by the competitor scan and the launch bet - and its output drives provisioning and the privacy page.

## Answer

IDENTITY: real accounts/auth ARE in v1 (signup required to download) — this REVERSES the earlier 'no login v1' default. Email/Resend narrows to signup-verification + 'your bundle is ready' notify-me emails, NOT download-link delivery. PRICING: v1 free; after 100 signups, paywall a subset of bundles. Exactly which bundles + price point = phase-2 detail, deferred. Signups double as the marketing list (add consent wording at signup). Paid bundles need commercially-redistributable licenses (see ticket 03).
