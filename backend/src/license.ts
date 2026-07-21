/**
 * The green-license gate (kg-product-research/content-license-rubric/RUBRIC.md).
 *
 * A doc's KG may only be served when its content license is on the green
 * allow-list — permissive OSS or CC-BY (NOT share-alike/non-commercial/no-derivs).
 * Everything else is red; the catalog never moves a red doc to `ready`
 * (ticket 02 criterion, enforced again by the poller in ticket 09). Default-deny:
 * an unknown / missing id is NOT green.
 *
 * The allow-list itself lives in ./green-licenses.json — the SINGLE source of
 * truth, shared with backend/scripts/seed_catalog.py so the runtime gate and the
 * seed can never disagree. Edit the JSON, not this logic.
 */
import green from "./green-licenses.json";

export function isGreenLicense(id: string | null | undefined): boolean {
  if (!id) return false;
  const s = id.trim().toUpperCase();
  if (green.excludeIfContains.some((x) => s.includes(x))) return false; // reject SA / NC / ND
  if (green.exact.includes(s)) return true;
  return green.patterns.some((p) => new RegExp(p).test(s));
}
