"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchStars } from "@/lib/api";
import { compact } from "@/lib/catalog";
import { LINKS } from "@/lib/links";
import { clearSession, readSession, type Session } from "@/lib/session";

/**
 * Sticky top nav: wordmark, Catalog, ★ Star, and the account slot.
 *
 * There is no "Docs" or "GitHub" link — both resolved to the same repo the Star
 * button already points at, so ★ Star is now the single GitHub affordance and the
 * footer keeps the full link list. Below `sm` the bar sheds everything optional:
 * Catalog (you're already scrolling toward it), the Star label + count, and the
 * username beside the avatar.
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
            <a href="/#catalog" className="hover:text-foreground">Catalog</a>
            <a href="/pricing" className="hover:text-foreground">Support</a>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono">
          <StarButton />
          <NavAccount />
        </div>
      </nav>
    </header>
  );
}

/** Below this the count is hidden: "★ Star 3" is worse than no number at all. */
const STAR_FLOOR = 10;

/**
 * ★ Star, with the repo's live count once it clears the floor. The count comes from
 * our own Worker (cached an hour), not from api.github.com direct — an unauthenticated
 * browser call is 60/hr per IP and would fail for anyone behind a shared NAT. A null
 * answer (GitHub unreachable) renders exactly like a below-floor count: no number.
 */
function StarButton() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetchStars(ac.signal).then((n) => {
      if (!ac.signal.aborted) setStars(n);
    });
    return () => ac.abort();
  }, []);

  return (
    <Button asChild variant="outline" size="sm">
      <a href={LINKS.github} aria-label="Star graflet on GitHub">
        <span aria-hidden>★</span>
        <span className="hidden sm:inline">Star</span>
        {stars !== null && stars >= STAR_FLOOR && (
          <span className="hidden text-muted-foreground sm:inline">{compact(stars)}</span>
        )}
      </a>
    </Button>
  );
}

/**
 * Sign-in button, or the signed-in user. The session lives only in localStorage
 * (see lib/session), so it can't be read until after mount — and this page is
 * statically prerendered, so the server can never know it either.
 */
function NavAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setMounted(true);
  }, []);

  if (!mounted) {
    // Neither state is known yet. Guessing "signed out" flashes "Sign in with
    // GitHub" at a signed-in visitor on every page load; rendering nothing makes
    // the bar jump. So reserve exactly the sign-in button's box and show neither.
    return (
      <div aria-hidden className="invisible">
        <SignInButton />
      </div>
    );
  }

  if (!session) return <SignInButton />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Avatar login={session.login} />
          <span className="hidden sm:inline">{session.login}</span>
          <span aria-hidden>▾</span>
          <span className="sr-only">Account menu for {session.login}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="font-mono">
        <DropdownMenuItem asChild>
          <a href="/join">Account</a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            // Local only — the website flow never minted a token, so there is no
            // server-side session to end and consent stays as recorded.
            clearSession();
            setSession(null);
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SignInButton() {
  return (
    <Button asChild size="sm">
      <a href="/join">Sign in with GitHub</a>
    </Button>
  );
}

/** github.com/<login>.png is a public, stable avatar URL — no API call, no stored
 *  avatar field, and a plain <img> so it needs no next/image remote-host config. */
function Avatar({ login }: { login: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://github.com/${login}.png?size=48`}
      alt=""
      width={20}
      height={20}
      className="size-5 shrink-0 rounded-full"
    />
  );
}
