/**
 * GET /stars — the public repo's star count, for the site's ★ Star button.
 *
 * Public and CORS-open like the catalog reads: the number is already visible to
 * anyone who loads the repo page (ADR-0005 gates only the KG download). It lives
 * here rather than as a browser fetch to api.github.com so a visitor's IP never
 * spends a GitHub rate-limit slot — one authenticated upstream call per colo per
 * hour serves everyone behind it.
 *
 * A failed upstream call answers `{ stars: null }`, never a stale guess and never
 * a 5xx. The site renders no count for null, which is the same pixels as a count
 * below its display floor — so GitHub being unreachable is an already-designed state.
 */

import { fetchRepoStars } from "./github";

/** The repo the button points at. Public, and not a secret — unlike PRIVATE_KG_REPO. */
const PUBLIC_REPO = "graflethq/graflet";

/** Cache key. Never a real route — `caches.default` just needs a stable URL.
 *  Exported so a test can start cold; one isolate shares one cache. */
export const CACHE_KEY = "https://graflet.internal/stars";

const TTL_SECONDS = 3600;

export async function handleStars(env: Env): Promise<Response> {
  const cache = caches.default;
  const hit = await cache.match(CACHE_KEY);
  if (hit) return hit;

  let stars: number | null = null;
  try {
    stars = await fetchRepoStars(PUBLIC_REPO, env.PRIVATE_REPO_TOKEN);
  } catch {
    stars = null;
  }

  // Only a real number earns the hour. A null is a transient upstream failure, so
  // it stays uncached and the next request gets a fresh attempt.
  const res = Response.json(
    { stars },
    { headers: { "Cache-Control": stars === null ? "no-store" : `public, max-age=${TTL_SECONDS}` } },
  );
  if (stars !== null) await cache.put(CACHE_KEY, res.clone());
  return res;
}
