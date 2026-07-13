# Write the per-site content-license identification rubric

Type: research
Status: resolved
Mode: AFK
Blocked by: —

## Question

Given a docs site, how do we reliably determine its CONTENT license (not the code-repo license) and classify green vs red? Produce a repeatable decision-tree/checklist: where to look (footer, LICENSE/NOTICE, /license page, llms.txt, CC badge, ToS), the code-vs-prose trap, the exact green allow-list (MIT/BSD/Apache-2.0/0BSD/CC-BY/CC0/PD/US-gov), what to record per source (license id, license_url, copyright_holder, source_url), and default-to-red on ambiguity.

---

**Why session-sized / why this type:** Session-sized reading (LEGALITY.md + a scraper reference) resolving to one markdown rubric; unblocks every downstream per-site check and the attribution manifest.

## Answer

Per site, find the license that covers the **written docs content, not the code** (the core trap: a repo's MIT `LICENSE` licenses the software, not the prose). Decision tree: login/paywall/bypass → red; proprietary vendor → red; else hunt the content license in order (docs-repo `LICENSE-DOCS`/per-dir LICENSE → footer/legal page → CC badge → NOTICE → top-level LICENSE only if it plainly covers content); no content license found → red. Green allow-list only: MIT, BSD, Apache-2.0, 0BSD, CC-BY, CC0, public-domain, US-gov (or explicit mirror grant). CC-BY-**SA**/**NC**/**ND**, unlicensed, EU corpora, and `llms.txt`-only (it's discovery, not a license) → red. Record per source: `license_id`, `license_url`, `copyright_holder`, `source_url`, `zone`. Default-to-red on any ambiguity.

See: research/content-license-rubric/RUBRIC.md
