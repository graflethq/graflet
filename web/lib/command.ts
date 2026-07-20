/**
 * The one install command, built in one place (ADR-0005: copying it needs no
 * network and no auth). Shared by the hero pill and every catalog-table row so
 * the string is identical everywhere. Latest → `npx docs-kg <slug>`; a chosen
 * non-latest version → `npx docs-kg <slug>@<version>`.
 */
export function buildInstallCommand(slug: string, version?: string | null): string {
  const base = `npx docs-kg ${slug}`;
  return version ? `${base}@${version}` : base;
}
