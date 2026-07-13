# Map: Downloadable Docs Knowledge-Graph Service (v1)

**Effort:** docs-kg-service
**Mode:** Wayfinder chart — planning only, no tickets resolved yet
**Frontier (open + unblocked now):** 09, 10, 11, 12, 13, 19, 23
**Total tickets:** 24

## Destination

An approved **v1 spec** plus the standing infra and content to `/implement` the ~50-line pick-doc → email → signed-URL → download flow. Concretely, when planning is done there exists:

1. A **locked, license-vetted green-zone launch catalog** (shadcn + a confirmed handful) with per-site attribution recorded.
2. The **first real shadcn bundle** built, pruned, attributed, zipped, uploaded to a provisioned storage bucket, with its catalog row inserted — the download flow's plumbing proven end to end.
3. **Supabase provisioned** (storage + catalog table + completion-capture; auth deferred unless pricing forces it) and a **Vercel deploy target live** with the endpoint location settled and Resend configured.
4. A **validated throwaway prototype** of the core UI flow (picker → preview → email → confirm + edge states) and a **settled download-link lifecycle/abuse policy**.
5. A **scaffolded themed Vite + shadcn shell** and a **minimal Terms/Privacy/attribution+takedown surface** the email screens link.
6. Settled founder calls on feature boundary + picker model, launch bet/success metric + how completion is measured, pricing + identity, positioning wedge, product name/domain, corpus zone policy, storage backend, and bundle contents/manifest.

From here `/implement` writes the ~50-line flow and the real screens.

## Notes

**Settled — do not re-litigate.** Legality resolved: GREEN (MIT/BSD/Apache-2.0/0BSD/CC-BY/CC0/PD/US-gov) → may ship the `.md`; RED (proprietary / CC-SA-NC-ND / ToS-banned / paywalled / no visible license / EU-hosted) → graph-only. shadcn = MIT = green = first launch. UI stack = shadcn/ui on Base UI + Tailwind v4 + Vite/React/TS with tweakcn tokens (teal accent only, warm-stone neutrals, `--radius 0.4rem`, semantic tokens, light+dark both intentional) → there is deliberately **no "pick colors/theme" ticket**. Runtime = Node. Backend = Supabase (storage + signed URLs + Postgres catalog + later auth) + Resend for email. Issue tracker = local markdown under `.scratch/`.

**Key framings baked into the tickets.** `createSignedUrl('x.zip', 3600)` IS the temporary link — nobody hand-builds link expiry; the only open link work is the request/abuse **policy** — a grilling (ticket 8), since Supabase owns the state machine there is nothing to prototype. There is **no product bundle yet**; ticket 16 is the first real packaging and REUSES the existing graphify-out (no re-scrape). That graphify-out is a raw ~8.9M run stuffed with internal working files (`cache/`, `.graphify_analysis.json`, date-stamped incremental dirs, `.sig`, internal `manifest.json`) that must be pruned; the pruned shippable core (graph.json ~1.3M + graph.html ~1.1M + ~110 `.md` + report + LICENSE) is likely **~3–4M zipped** — that number gates the storage choice. graphify's internal `manifest.json` (mtime + ast_hash for `--update`) is NOT the product manifest — the bundle needs its own.

**The ~50-line core flow is the destination itself, not a ticket** — the tickets surface only its genuinely-open decisions and the provisioning it depends on. Attribution must ship from day one (ticket 12 lands **before** ticket 16) to avoid the Context7 LICENSE-stripping anti-pattern; the shadcn MIT LICENSE/NOTICE stays in the zip. **Green-only default keeps the "license gate" as a near-zero-code catalog filter** (every offered site is green → always ship the full bundle); a graph-only variant + download-time gate only get built if the zone-policy grilling (ticket 3) puts red-zone in scope.

**Two surfaces the flow can't launch without.** Ticket 2's success metric needs something to capture it, and a raw Supabase signed URL emits no server-side completion signal — so ticket 10 decides proxy-count vs a logging-redirect (which would sit IN FRONT of the signed URL and reshape the flow) before ticket 21 provisions the schema. And because the flow collects emails and redistributes licensed `.md`, ticket 20 drafts the minimal linked Terms/Privacy/attribution/takedown page — from the identity/marketing call (ticket 15) and the vetted attribution list (ticket 13) — that the email-submit and confirmation screens must point to before go-live.

**Recommendations carried into the tickets but still the founder's to confirm:** no login in v1 (email IS the identity), a small green-zone curated catalog, freshness = a dated point-in-time snapshot with no guarantee. Domain purchase is folded into the naming grilling (ticket 19), not a separate task. The three UI prototypes were merged into one throwaway (ticket 11) since the app is small enough to prototype in one session; the real screen build is downstream `/implement`, deliberately not charted here.

## Decisions so far

- [02 Launch bet](issues/02-launch-bet-success-metric.md) — experiment-first, free + signup-gated, kill/keep 100 signups in 3 weeks, paywall a subset after.
- [01 Feature boundary + picker](issues/01-draw-v1-feature-boundary.md) — signup-gated DIRECT 24h download (not emailed); pre-signup savings-teaser + graph thumbnail; broad catalog with `ready`/`graphifying` status + notify-me.
- [03 Zone policy](issues/03-v1-corpus-zone-policy.md) — offer both: green ships .md+graph, red ships graph-only; rolling per-doc vet; graph-only variant needed once the first red doc is built.
- [04 Launch catalog](issues/04-choose-launch-catalog.md) — list broad; build a green handful first (shadcn + react + a few); the rest sit in `graphifying`.
- [05 License rubric](issues/05-content-license-rubric.md) — content-vs-code-license decision tree, green allow-list, default-to-red → research/content-license-rubric/RUBRIC.md
- [06 Competitor pricing](issues/06-competitor-pricing-positioning.md) — Context7 = freemium $10/seat, MCP, text-only; nobody ships a graph; a flat per-bundle price is open air → research/competitor-pricing/COMPETITORS.md
- [07 Resend](issues/07-resend-deliverability-sender-domain.md) — verified custom domain is a hard prereq; 100/day free tier; role narrowed to signup-verify + notify-me → research/resend-email/RESEND.md
- [08 Link lifecycle](issues/08-email-link-lifecycle-abuse-policy.md) — 24h direct in-app link, signup-gated.
- [14 Positioning wedge](issues/14-positioning-wedge-vs-context7.md) — quantified savings (4 metrics) + graph-not-just-text + ownable-not-metered.
- [15 Pricing + identity](issues/15-free-vs-paid-and-identity.md) — accounts ARE in v1; free → paywall a subset after the milestone; email = verify + notify only.
- [Savings-metrics methodology] — 4-metric method speced → research/savings-metrics/REQUIREMENTS.md (implementation = ticket 23, a separate session).

## Not yet specified

- Actual willingness-to-pay — unknowable until real users hit the paywall; the pricing decision picks a model but can't prove demand pre-launch.
- Concrete price points + exactly which subset of bundles gets paywalled — a phase-2 detail after the 100-signup milestone.
- The true size/count distribution of bundles across the catalog — only known after the pipeline runs on many real sites, not just shadcn/react.
- Total storage footprint + expected egress — no traffic exists yet; the number that decides Supabase-vs-R2 at scale (ticket 18) is unknown.
- Which additional green sites beyond shadcn + react to build first (Tailwind / Vue / Svelte?) — pending the rolling license vet (ticket 13).
- Whether the AI-agent-operator user segment is the real market — unvalidated until v1 ships and gets used.
- The concrete signal (download volume, staleness complaints, N bundles maintained) that flips auto-refresh from deferred to worth building.

## Out of scope

- Auto-refresh / freshness cron + scheduler, source-change diffing, re-notifying prior downloaders (graphify `--update` is the natural later mechanism); v1 bundles are hand-built point-in-time snapshots with no freshness guarantee.
- Bundle versioning scheme for when a site updates (naming of v2, whether old versions are retained).
- Graph dedup / tidy-score lift (the ~28% duplicate nodes) — ship the existing GraphScore-95.1 graph; entity-resolution is a fast-follow.
- Full DMCA notice-and-takedown agent + opt-out workflow — a curated launch with attribution + a takedown contact on the terms page suffices; the full agent is prudent before scale.
- Phase-2 paid-tier billing integration + the exact paywalled subset (deferred until after the 100-signup milestone).
- Multi-site combined mega-graph bundles; codifying the manual build into a repeatable runbook/script; handling scrape failures on JS-heavy / no-clean-md sites — premature until several bundles exist.
- EU-origin / EU-hosted corpora (sui generis database right) — out until a specific EU site is proposed.
- Attorney review of the Terms/Privacy wording before the verbatim-download feature — recommended in LEGALITY.md but a founder budget/timing call; ticket 20 ships the minimal self-drafted surface.
- The actual /implement of the flow and the real screens — that's the build after this map's destination.

**Now IN scope (moved in this session):** real accounts / Supabase Auth (signup required, ticket 15); red-zone graph-only bundles + the download-time license gate (needed once the first red doc is built, ticket 03).

## Ticket index

| # | Ticket | Type | Mode | Blocked by | Status |
|---|--------|------|------|------------|--------|
| [01](issues/01-draw-v1-feature-boundary.md) | Draw the v1 feature boundary + doc-picker model | grilling | HITL | — | resolved |
| [02](issues/02-launch-bet-success-metric.md) | Set the launch bet, success metric, target user, and kill criterion | grilling | HITL | — | resolved |
| [03](issues/03-v1-corpus-zone-policy.md) | Decide v1 corpus zone policy: green-only or also red graph-only | grilling | HITL | — | resolved |
| [04](issues/04-choose-launch-catalog.md) | Choose the launch catalog: how many docs sites and which ones | grilling | HITL | — | resolved |
| [05](issues/05-content-license-rubric.md) | Write the per-site content-license identification rubric | research | AFK | — | resolved |
| [06](issues/06-competitor-pricing-positioning.md) | Research how Context7 and comparable docs/dev tools monetize and position | research | AFK | — | resolved |
| [07](issues/07-resend-deliverability-sender-domain.md) | Research Resend free-tier limits, deliverability, and sender-domain requirements | research | AFK | — | resolved |
| [08](issues/08-email-link-lifecycle-abuse-policy.md) | Settle the download-link lifecycle + abuse policy | grilling | HITL | — | resolved |
| [09](issues/09-scaffold-themed-app.md) | Scaffold the Vite + shadcn app shell with the decided theme tokens | task | AFK | — | open |
| [10](issues/10-download-completion-measurement.md) | Decide how completed downloads are measured and specify the event capture | task | AFK | 02 | open |
| [11](issues/11-prototype-core-flow.md) | Prototype the full pick-doc -> preview -> email -> check-email flow incl. edge states | prototype | HITL | 01 | open |
| [12](issues/12-bundle-attribution-manifest.md) | Specify compliant bundle attribution: LICENSE/NOTICE + attribution manifest + pipeline step | task | AFK | 05 | open |
| [13](issues/13-vet-launch-shortlist.md) | Vet and lock the green-zone launch shortlist with recorded attribution | task | AFK | 04, 05 | open |
| [14](issues/14-positioning-wedge-vs-context7.md) | Nail the one-sentence positioning wedge vs Context7 | grilling | HITL | 06 | resolved |
| [15](issues/15-free-vs-paid-and-identity.md) | Decide free vs paid, the pricing model, and the v1 identity model | grilling | HITL | 02, 06 | resolved |
| [16](issues/16-build-first-bundle.md) | Build and zip the first real shadcn bundle to learn its true shape and size | task | AFK | 12 | open |
| [17](issues/17-define-bundle-contents-manifest.md) | Decide what one shipped bundle contains and what its product manifest declares | grilling | HITL | 03, 16 | open |
| [18](issues/18-storage-supabase-vs-r2.md) | Decide bundle storage: Supabase Storage vs Cloudflare R2 | grilling | HITL | 16 | open |
| [19](issues/19-product-name-brand-domain.md) | Choose the product name, brand tone, and domain | grilling | HITL | 14 | open |
| [20](issues/20-terms-privacy-attribution-page.md) | Draft the minimal Terms + Privacy + attribution/takedown surface the app links | task | AFK | 13, 15 | open |
| [21](issues/21-provision-supabase-and-deploy.md) | Provision Supabase + catalog schema and stand up the Vercel deploy target | task | HITL | 07, 10, 15, 17, 18 | open |
| [22](issues/22-upload-bundle-and-catalog-row.md) | Upload the first bundle to storage and insert its catalog row | task | HITL | 16, 21 | open |
| 23 | [23](issues/23-implement-savings-metrics.md) Implement savings-metrics in graphify-and-score skill | task | AFK | — | open |
| 24 | [24](issues/24-catalog-build-status-notify.md) Catalog build-status + notify-me feature | task | AFK | 17 | open |
