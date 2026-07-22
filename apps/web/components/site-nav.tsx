import { Button } from "@/components/ui/button";
import { LINKS } from "@/lib/links";

/**
 * Sticky top nav (ticket 03): wordmark, section links, Star + Sign-in buttons.
 * Middle links collapse on mobile so the bar never overflows horizontally.
 * "Sign in with GitHub" links to the /join signup flow (ticket 06); the OAuth
 * exchange runs on the backend, so no client secret ships here.
 */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-5 sm:gap-8">
          <a href="/" className="font-mono text-base font-bold whitespace-nowrap">
            graflet
          </a>
          <div className="hidden items-center gap-6 font-mono text-[13px] text-muted-foreground sm:flex">
            <a href="#catalog" className="hover:text-foreground">Catalog</a>
            <a href={LINKS.docs} className="hover:text-foreground">Docs</a>
            <a href={LINKS.github} className="hover:text-foreground">GitHub</a>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono">
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <a href={LINKS.github}>★ Star</a>
          </Button>
          <Button asChild size="sm">
            <a href="/join">Sign in with GitHub</a>
          </Button>
        </div>
      </nav>
    </header>
  );
}
