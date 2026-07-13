# Vet and lock the green-zone launch shortlist with recorded attribution

Type: task
Status: open
Mode: AFK
Blocked by: 04, 05

## Question

Apply the rubric to the founder's candidate launch sites, confirm each is genuinely green (shadcn=MIT + N others), and record per-site license/zone/license_url/copyright_holder/source_url so the catalog and bundles can enforce gating + attribution. Produce the locked launch list, defaulting any ambiguous site to red (excluded from a green-only launch).

---

**Why session-sized / why this type:** Agent applies the rubric to the founder's chosen candidates and records attribution; produces the vetted list the catalog schema, later bundle builds, and the public attribution page consume.

## Update

Vetting is now handled by the **`scrape-site-legally`** skill (to be built — brief at `research/scraping-legality/SCRAPE-SITE-LEGALLY-PROMPT.md`). That skill checks each site's license, redistributability, and correct output license as part of scraping, per the rubric (`research/content-license-rubric/RUBRIC.md`). So this ticket becomes: **run `scrape-site-legally` over the candidate sites and record the green/red + attribution results** — no separate by-hand vetting.
