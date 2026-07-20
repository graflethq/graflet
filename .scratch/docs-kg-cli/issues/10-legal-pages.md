# 10 — Legal pages (Terms / Privacy / attribution)

**What to build:** The website carries the minimal legal surface a free tool that collects emails and redistributes docs legally needs (spec §3). A **Privacy** page discloses what is stored (`github_id`, email, marketing consent), why, the marketing-consent model and how to withdraw it, and the unsubscribe/suppression path — matching ADR-0006 so the consent capture in 07/08 is lawful. A **Terms** page states the tool is free and open source, provided as-is, no warranty. An **attribution** page (or section) credits each redistributed doc's upstream source and license — the KG bundles ship the upstream `.md` plus the doc repo's LICENSE, so the site names the source repo and license per doc, satisfying the redistribution terms of the green licenses. These pages are static, public, and linked from the footer; nothing here gates or captures.

**Blocked by:** 06 (the website exists to host and link them).

**Status:** ready-for-agent

- [ ] A public Privacy page discloses the stored fields (`github_id`, email, `marketing_consent`), the tri-state consent model, and how to withdraw consent / unsubscribe — consistent with ADR-0006.
- [ ] A public Terms page states free + open-source, as-is, no warranty, and links the OSS repo/license.
- [ ] An attribution page/section lists each redistributed doc's upstream repo and license, sourced from the catalog (`repo_url`, `license_id`), satisfying the green-license redistribution terms.
- [ ] All three are linked from the site footer and load with no sign-in and no data capture.
- [ ] The unsubscribe/suppression path referenced by notification emails (ticket 08) is documented on or reachable from the Privacy page.
