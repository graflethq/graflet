import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/landing-sections";

/**
 * Shared shell for the legal pages (ticket 07): Privacy, Terms, Attribution. Same
 * nav + footer as the rest of the site, a narrow reading column for prose. All
 * three are static and public, and gate nothing. They are measured like the rest of
 * the site (ADR-0010); /privacy is where that is disclosed and switched off.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">{children}</main>
      <SiteFooter />
    </>
  );
}
