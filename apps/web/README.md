# graflet web

Marketing site for graflet — a Next.js 16 (App Router) + shadcn/ui app, dark-terminal
themed (Frame A), deployed to **Cloudflare Workers** via `@opennextjs/cloudflare`.
It consumes the read-only catalog API served by the `backend/` Worker; it runs no
server logic of its own beyond rendering. See `../CONTEXT.md` and `../docs/adr/`.

## Develop

```bash
pnpm install
pnpm dev          # next dev (Turbopack) → http://localhost:3000
pnpm typecheck    # next typegen && tsc --noEmit
pnpm test         # vitest run (view-model + behavior checks)
pnpm build        # next build
```

The catalog table reads the backend Worker's public `/catalog` API. Point it with
`NEXT_PUBLIC_CATALOG_API_URL` (in `.env.local` for dev, or the deploy env);
it defaults to `http://localhost:8787` (the local `wrangler dev` port).

## Preview / deploy (Cloudflare, via OpenNext)

```bash
pnpm preview      # build + serve on the local Workers runtime (workerd)
pnpm deploy       # build + deploy to Cloudflare Workers (needs `wrangler login` + a CF account)
pnpm cf-typegen   # regenerate cloudflare-env.d.ts binding types
```

Do **not** use `@cloudflare/next-on-pages` — this app is on the Workers Node runtime
(`nodejs_compat`) through OpenNext. Build output lands in `.open-next/` (gitignored).

## Theme

Dark-committed (`<html class="dark">`). The palette lives once in `app/globals.css` as
`.dark` CSS-variable tokens (bg `#0a0b0d`, accent `#4ef08c`, borders `#1c2027`, JetBrains
Mono) — re-skin via those tokens, never per-element classes. shadcn components come from
the `radix-nova` preset; source them with the wired shadcn MCP (`.mcp.json`).
