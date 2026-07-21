import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/landing-sections";

/**
 * Shared shell for the legal pages (ticket 07): Privacy, Terms, Attribution. Same
 * nav + footer as the rest of the site, a narrow reading column for prose. All
 * three are static, public, and gate/capture nothing.
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
