# Draw the v1 feature boundary + doc-picker model

Type: grilling
Status: resolved
Mode: HITL
Blocked by: —

## Question

For the minimum lovable slice, which user-facing capabilities are IN v1 vs deferred? Confirm the spine is only: browse a small fixed catalog -> pick one doc -> enter email -> receive a temporary link -> download a pre-built zip. Rule each IN/OUT for v1: in-browser graph preview, catalog search/filter, 'request a doc we don't have yet', download history, multiple export formats, per-site freshness display. And settle the doc-picker model: a small curated catalog, or a search-anything box with a 'don't see your doc? request it' fallback? (Auth, pricing, storage, zone policy, and graph quality are decided in their own tickets.)

---

**Why session-sized / why this type:** The founder sets the in/out line; it's the spine every downstream spec, prototype, and screen hangs off, and the picker IA falls straight out of it.

## Answer

v1 flow: browse publicly → each bundle shows the 4 savings metrics + a static graph teaser (thumbnail image + stats + GRAPH_REPORT highlights) → click Download → if NOT signed up, a signup popup → signed-up users download DIRECTLY in-app via a 24-hour temporary link (NOT emailed). The full interactive graph.html is the downloaded artifact, not embedded pre-signup. Picker = a BROAD catalog (list as many docs as possible) with a per-doc status badge: `ready` (downloadable) vs `graphifying` (in progress). In-progress docs show the badge AND a 'notify me when ready' action (captures signup/email, emails on ready). IN v1: savings teaser, signup-gated 24h direct download, broad catalog w/ status, notify-me. Deferred: catalog search/filter (until the catalog grows), multiple export formats, download history (accounts exist so it's cheap later, but not v1).
