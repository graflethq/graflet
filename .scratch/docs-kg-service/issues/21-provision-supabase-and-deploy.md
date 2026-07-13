# Provision Supabase + catalog schema and stand up the Vercel deploy target

Type: task
Status: open
Mode: HITL
Blocked by: 07, 10, 15, 17, 18

## Question

Create the Supabase project, a private bundles bucket (if Supabase wins storage in ticket 18), and the Postgres catalog table whose columns ARE the product-manifest fields settled in ticket 17 (slug, display name, source URL, content license + green/red zone flag, bundle path, size, GraphScore, node/edge counts, last-built date). Add the completion-capture from ticket 10 (events row/counter, or the logging-redirect endpoint). Stand up accounts/entitlement/consent tables now ONLY if the identity decision (ticket 15) picked a gated/paid tier - otherwise defer auth. Then set up the Vercel deploy target for the Vite app and decide where the ~50-line signed-URL + Resend endpoint runs (Vercel serverless function vs Supabase Edge Function), configuring Resend per the deliverability research (ticket 7). Deploy to a *.vercel.app URL first; wire the custom domain whenever it's ready.

---

**Why session-sized / why this type:** Concrete provisioning + deploy work needing a human to create accounts; it can't guess the catalog schema (ticket 17's manifest fields), whether to build auth (ticket 15's identity call), or whether the flow needs a logging-redirect (ticket 10) - so it waits on those plus storage (18) and Resend (7), then produces the live URL, bucket, catalog, and settled endpoint location the app reads from.

## Update

Scope expanded: PROVISION SUPABASE AUTH in v1 (signup is required — ticket 15). Catalog schema adds: `status` (ready/graphifying), the savings-metric fields (from savings.json), and a notify-me table (email/user, doc_id) for in-progress subscriptions. Downloads are tracked as authed events (ticket 10).
