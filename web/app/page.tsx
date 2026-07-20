import { SiteNav } from "@/components/site-nav";
import { Hero } from "@/components/hero";

// Landing page: sticky nav + hero (ticket 03). The live catalog table (04),
// body sections + footer (05) and sign-in (06) land on top of this.
export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-1 flex-col">
        <Hero />
      </main>
    </>
  );
}
