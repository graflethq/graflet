import { SiteNav } from "@/components/site-nav";
import { Hero } from "@/components/hero";
import { CatalogSection } from "@/components/catalog-section";

// Landing page: sticky nav + hero (ticket 03) and the live catalog table
// (ticket 04). Body sections + footer (05) and sign-in (06) land on top of this.
export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <CatalogSection />
      </main>
    </>
  );
}
