# Implement the savings-metrics computation in the graphify-and-score skill

Type: task
Status: open
Mode: AFK
Blocked by: —

## Question

Extend the `graphify-and-score-html-md-report` skill to compute + emit the 4 savings metrics per bundle (a `savings.json` + a report section), per the written requirements. THE SPEC IS COMPLETE — do this in a SEPARATE Claude session. See research/savings-metrics/REQUIREMENTS.md. Metrics: (1) doc-token-count × live Sonnet input price = $ build cost (conservative single-pass floor); (2) local-model graphify timed on the first couple of chunks, extrapolated = estimated local build time on this machine; (3) GraphScore = accuracy; (4) graph-query vs full-docs-in-context benchmark = typical % usage token savings.

---

**Why session-sized / why this type:** The 4 numbers are the conversion wedge and must be measured honestly, not guessed. The spec was written this grilling session; implementation is a self-contained skill edit best done in its own session.
