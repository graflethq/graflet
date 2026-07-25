import { SiteNav } from "@/components/site-nav";
import { Hero } from "@/components/hero";
import { CatalogSection } from "@/components/catalog-section";
import { StatTiles } from "@/components/stat-tiles";
import {
  WhatYouGet,
  HowItWorks,
  TerminalDemo,
  WhyGraph,
  Support,
  SiteFooter,
} from "@/components/landing-sections";

// Landing page (Frame A order): nav + hero (03), live catalog table (04), then the
// body + footer (05) — what-you-get cards, honest live stat tiles, how-it-works,
// the example-output terminal, why-a-knowledge-graph, support, footer. Sign-in (06)
// lands on top of this. The hero is deliberately short so the first catalog rows
// clear the fold; the terminal demo is why it can be.
export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <CatalogSection />
        <WhatYouGet />
        <StatTiles />
        <HowItWorks />
        <TerminalDemo />
        <WhyGraph />
        <Support />
      </main>
      <SiteFooter />
    </>
  );
}
