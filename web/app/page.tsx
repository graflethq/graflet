import { Button } from "@/components/ui/button";

// Foundation skeleton (ticket 01): proves the dark-terminal theme + a shadcn
// component render through the CSS-variable tokens. The real landing (nav, hero,
// terminal, catalog table) is built in tickets 03–05 on top of this seam.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="rounded-full border border-border px-3 py-1 font-mono text-xs tracking-widest text-primary">
        FREE · OPEN SOURCE · MIT
      </span>
      <h1 className="max-w-2xl font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
        docs-kg
      </h1>
      <p className="max-w-md text-balance text-muted-foreground">
        One command pulls any library&apos;s docs and a ready-made knowledge
        graph, locally aligned for your AI tools.
      </p>
      <code className="rounded-md border border-border bg-card px-4 py-2 font-mono text-sm text-foreground">
        npx docs-kg react
      </code>
      <Button size="lg">Get started</Button>
    </main>
  );
}
