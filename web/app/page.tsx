import { SiteNav } from "@/components/site-nav";
import { Hero } from "@/components/hero";
import { CatalogSection } from "@/components/catalog-section";
import { StatTiles } from "@/components/stat-tiles";
import { WhatYouGet, HowItWorks, WhyGraph, Support, SiteFooter } from "@/components/landing-sections";

// Landing page (Frame A order): nav + hero (03), live catalog table (04), then the
// body + footer (05) — what-you-get cards, honest live stat tiles, how-it-works,
// why-a-knowledge-graph, support, footer. Sign-in (06) lands on top of this.
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
        <WhyGraph />
        <Support />
      </main>
      <SiteFooter />
    </>
  );
}
