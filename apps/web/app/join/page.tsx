import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { JoinPanel } from "@/components/join-panel";
import { SiteFooter } from "@/components/landing-sections";

export const metadata: Metadata = {
  title: "Join · docs-kg",
  description: "Sign in with GitHub to join the docs-kg audience and watch docs for updates. Free and open source.",
};

// The signup flow (ticket 06). Kept off the landing page — the opt-in is captured
// only here (ADR-0005). The interactive panel is a client island; the shell stays
// server-rendered for the same nav/footer as the rest of the site.
export default function JoinPage() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <JoinPanel />
      </main>
      <SiteFooter />
    </>
  );
}
