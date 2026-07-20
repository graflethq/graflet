# Website (shadcn build) — ticket index

Feature: the docs-kg **website**, built from the chosen dark-terminal design (Frame A) as a
Next.js 16 + shadcn app. Spec: `../spec.md`. Realizes docs-kg-cli tickets 06/07/10.
Build guides: `../../../research/shadcn-mcp-implement/FINDINGS.md` (shadcn MCP),
`../../../research/nextjs16-docs-access/FINDINGS.md` (Next 16 docs access + gotchas).

Work the **frontier** with `/implement`, one ticket, fresh context each. Blockers-first.

## DAG

```
01 Foundation (scaffold+shadcn+theme+CF deploy)     ✅ done 2026-07-20
02 Backend CORS for catalog reads                   ✅ done 2026-07-20

03 Landing top (nav+hero+copy)        ← 01 ✅        [frontier]
04 Catalog table (view-model+live)    ← 01 ✅, 02 ✅  [frontier]
05 Landing body + footer              ← 04
06 GitHub signup + opt-in             ← 01 ✅, 02
07 Legal pages                        ← 04
08 (optional) Catalog size/date ext   ← 02   → fills 04's Graph-size + Updated columns
```

## Frontier now
- **03** — unblocked (needs only the `web/` scaffold). **04** and **06** — unblocked now that **02** (CORS) is done.

## Order of value
01 → 02 → 03 → 04 → 05, then 06 (signup), 07 (legal), 08 (optional column data).
