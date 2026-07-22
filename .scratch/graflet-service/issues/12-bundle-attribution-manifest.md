# Specify compliant bundle attribution: LICENSE/NOTICE + attribution manifest + pipeline step

Type: task
Status: open
Mode: AFK
Blocked by: 05

## Question

Define exactly what a compliant bundle must contain so we never repeat the Context7 LICENSE-stripping anti-pattern: keep original LICENSE/NOTICE files, a per-source ATTRIBUTION manifest (source URL, copyright holder, license + link), an Apache-2.0 statement-of-changes, a CC-BY 'format converted from HTML' credit - and the pipeline step that emits them, using the license fields from the rubric.

---

**Why session-sized / why this type:** Small spec + pipeline step that must land BEFORE the first real bundle is built so attribution ships from day one instead of being retrofitted; reuses the rubric's recorded fields.
