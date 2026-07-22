/**
 * KG download broker — THE SPINE's server half (ticket 05 / ADR-0002, 0005).
 *
 *   GET /kg/{slug}[?version=]  Auth-gated. The ONE action that requires sign-in
 *                              (ADR-0005): everything else — catalog browse,
 *                              version listing, copy-command — stays signup-free.
 *
 * Verifies the caller's bearer (minted at sign-in, ticket 03), resolves the
 * version's `kg_ref` from the catalog, fetches the bundle tarball from the
 * maintainer's PRIVATE repo with the server-side token, and streams the bytes
 * straight back. The client never holds a GitHub key, no signed URL is ever
 * returned, and the server token never leaves the backend.
 */

import { authenticateUser } from "./auth";
import { resolveVersion } from "./catalog";
import { fetchPrivateBundle } from "./github";

export async function handleKgDownload(env: Env, req: Request, slug: string, wantVersion: string | null): Promise<Response> {
  // The gate (ADR-0005): a valid caller bearer is required, and only here.
  const user = await authenticateUser(env, req);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Location comes from the catalog, never the client — only a ready+pinned
  // version with a recorded kg_ref is deliverable (ADR-0002).
  const target = await resolveVersion(env, slug, wantVersion);
  if (!target || !target.kg_ref) {
    return Response.json({ error: "no deliverable KG for that doc/version" }, { status: 404 });
  }

  const bundle = await fetchPrivateBundle(env.PRIVATE_KG_REPO, `${target.kg_ref}.tar.gz`, env.PRIVATE_REPO_TOKEN);
  if (!bundle.ok || !bundle.body) {
    // Don't surface GitHub's status/body — the private repo is an internal detail.
    return Response.json({ error: "KG bundle is temporarily unavailable" }, { status: 502 });
  }

  // Stream the private bytes through under OUR headers. Not a redirect, not a
  // signed URL, no Authorization forwarded — the server token stays server-side.
  // X-KG-Sha lets the CLI prove the KG matches the .md snapshot (ADR-0002).
  return new Response(bundle.body, {
    headers: {
      "Content-Type": "application/gzip",
      "X-KG-Sha": target.sha,
    },
  });
}
