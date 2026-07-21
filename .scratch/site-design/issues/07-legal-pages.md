# 07 — Legal pages: Privacy / Terms / attribution

**What to build:** The website carries the minimal legal surface a free tool that collects emails and redistributes docs needs. A **Privacy** page discloses what is stored (`github_id`, email, `marketing_consent`), the tri-state consent model, and how to withdraw consent / unsubscribe (ADR-0006). A **Terms** page states the tool is free and open source, provided as-is, no warranty, and links the OSS repo/license. An **attribution** page lists each redistributed doc's upstream source repo and license, sourced from the catalog. All three are static, public, footer-linked, and gate or capture nothing.

**Blocked by:** 04.

**Status:** done (2026-07-21) — route group `app/(legal)/` (shared nav/footer layout) with `/privacy`, `/terms`, `/attribution`; all three static (`○`), footer-linked, gate/capture nothing. Attribution reuses ticket 04's `fetchCatalog` via pure `lib/attribution.ts` (`buildAttributionRows`, unit-tested). Privacy `#withdraw` anchor is the unsubscribe path for notification emails.

- [x] A public Privacy page discloses the stored fields (`github_id`, email, `marketing_consent`), the tri-state consent model, and the withdraw/unsubscribe path — consistent with ADR-0006.
- [x] A public Terms page states free + open-source, as-is, no warranty, and links the OSS repo/license.
- [x] An attribution page lists each redistributed doc's `repo_url` + `license_id` from the catalog (reusing ticket 04's catalog client), satisfying the green-license redistribution terms.
- [x] All three pages are linked from the footer and load with no sign-in and no data capture; the unsubscribe path referenced by notification emails is reachable from Privacy.
