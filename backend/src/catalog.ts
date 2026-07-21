/**
 * Catalog API (ticket 02 / ADR-0002, 0003, 0005).
 *
 * One authoritative list of the launch docs, read by the website + CLI with NO
 * sign-in — the gate is only the KG download (ADR-0005). Three routes:
 *
 *   GET  /catalog          Public. Docs with a servable (ready) latest version,
 *                          ordered by popularity — each with its repo, GraphScore
 *                          and hero savings, so the site table (ticket 04) renders
 *                          those columns without a per-row detail fetch.
 *   GET  /catalog/{slug}   Public. Every tracked version (old ones kept, ADR-0003)
 *                          + a resolve for {slug, version} → {repo_url, sha, docs_path,
 *                          kg_ref} (the pin the CLI feeds codeload; never KG bytes).
 *   POST /catalog/upsert   Shared-secret. The pipeline/poller flips a version
 *                          graphifying → ready and fills savings/sha/license as builds
 *                          land. Green-license gated; needs_human held provisional.
 */

import { isGreenLicense } from "./license";
import { notifyWatchers } from "./notify";
import { sha256Hex } from "./tokens";

/** GET /catalog — the public, sign-in-free doc list. */
export async function handleCatalogList(env: Env): Promise<Response> {
  const { results } = await env.CATALOG.prepare(
    `SELECT d.slug, d.name, d.repo_url, d.license_id AS license, d.popularity_rank,
            v.version_label AS latest_version, v.graphscore, v.hero_savings,
            v.nodes, v.edges, v.built_at
       FROM docs d
       JOIN doc_versions v ON v.slug = d.slug AND v.is_latest = 1 AND v.status = 'ready'
      ORDER BY d.popularity_rank ASC`,
  ).all<{
    slug: string;
    name: string;
    repo_url: string;
    license: string;
    popularity_rank: number;
    latest_version: string;
    graphscore: number | null;
    hero_savings: number | null;
    nodes: number | null;
    edges: number | null;
    built_at: string | null;
  }>();
  return Response.json({ docs: results });
}

/** GET /catalog/{slug}[?version=] — doc detail + a resolve for one version. */
export async function handleCatalogDoc(env: Env, slug: string, wantVersion: string | null): Promise<Response> {
  const doc = await env.CATALOG.prepare(
    "SELECT slug, name, repo_url, license_id AS license, popularity_rank FROM docs WHERE slug = ?",
  )
    .bind(slug)
    .first<{ slug: string; name: string; repo_url: string; license: string; popularity_rank: number }>();
  if (!doc) return new Response("not found", { status: 404 });

  const { results: rows } = await env.CATALOG.prepare(
    `SELECT version_label, is_latest, status, sha, docs_path, kg_ref, graphscore, hero_savings, savings_json,
            nodes, edges, built_at
       FROM doc_versions WHERE slug = ?
      ORDER BY is_latest DESC, version_label DESC`,
  )
    .bind(slug)
    .all<{
      version_label: string;
      is_latest: number;
      status: string;
      sha: string | null;
      docs_path: string | null;
      kg_ref: string | null;
      graphscore: number | null;
      hero_savings: number | null;
      savings_json: string | null;
      nodes: number | null;
      edges: number | null;
      built_at: string | null;
    }>();

  const versions = rows.map((r) => ({
    version_label: r.version_label,
    is_latest: r.is_latest === 1,
    status: r.status,
    graphscore: r.graphscore,
    hero_savings: r.hero_savings,
    nodes: r.nodes,
    edges: r.edges,
    built_at: r.built_at,
    savings: parseSavings(r.savings_json),
  }));

  const resolve = resolveTarget(doc.repo_url, rows, wantVersion);
  return Response.json({ ...doc, versions, resolve });
}

/** The deliverable pin for one version, or null. */
export interface ResolvedTarget {
  version: string;
  repo_url: string;
  sha: string;
  docs_path: string | null;
  kg_ref: string | null;
}

type VersionRow = { version_label: string; is_latest: number; status: string; sha: string | null; docs_path: string | null; kg_ref: string | null };

/**
 * Resolve {slug, version|latest} to its deliverable pin (ADR-0002/0005), or null.
 * Only a `ready` version with a recorded commit pin resolves — a provisional /
 * graphifying one, or a seeded row whose {sha} the re-graphify (P1) hasn't filled
 * yet, is browsable but not deliverable (a KG is delivered by its pin). Pure over
 * already-fetched rows so the catalog detail endpoint and the download broker
 * (ticket 05) apply ONE rule from ONE place.
 */
export function resolveTarget(repoUrl: string, rows: VersionRow[], wantVersion: string | null): ResolvedTarget | null {
  const target = wantVersion ? rows.find((r) => r.version_label === wantVersion) : rows.find((r) => r.is_latest === 1);
  if (!target || target.status !== "ready" || !target.sha) return null;
  return { version: target.version_label, repo_url: repoUrl, sha: target.sha, docs_path: target.docs_path, kg_ref: target.kg_ref };
}

/** DB-backed resolve for a slug — the broker's entry point (ticket 05). Reads the
 *  doc's repo_url + version rows, then applies {@link resolveTarget}. */
export async function resolveVersion(env: Env, slug: string, wantVersion: string | null): Promise<ResolvedTarget | null> {
  const doc = await env.CATALOG.prepare("SELECT repo_url FROM docs WHERE slug = ?").bind(slug).first<{ repo_url: string }>();
  if (!doc) return null;
  const { results } = await env.CATALOG.prepare(
    "SELECT version_label, is_latest, status, sha, docs_path, kg_ref FROM doc_versions WHERE slug = ?",
  )
    .bind(slug)
    .all<VersionRow>();
  return resolveTarget(doc.repo_url, results, wantVersion);
}

/** POST /catalog/upsert — shared-secret; the pipeline/poller keep the catalog live. */
export async function handleCatalogUpsert(env: Env, req: Request): Promise<Response> {
  if (!(await authorized(env, req))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as UpsertBody | null;
  if (!body) return Response.json({ error: "invalid json body" }, { status: 400 });

  const slug = str(body.slug);
  const versionLabel = str(body.version_label);
  const license = str(body.license);
  if (!slug || !versionLabel || !license) {
    return Response.json({ error: "slug, version_label and license are required" }, { status: 400 });
  }

  const requested = body.status ?? "graphifying";
  if (requested !== "graphifying" && requested !== "ready") {
    return Response.json({ error: "status must be 'graphifying' or 'ready'" }, { status: 400 });
  }

  // needs_human always holds provisional (unconfirmed version label, pending review) —
  // never served (ticket criterion). Otherwise a `ready` payload must be green-licensed.
  let status: "provisional" | "graphifying" | "ready";
  if (body.needs_human) {
    status = "provisional";
  } else if (requested === "ready") {
    if (!isGreenLicense(license)) {
      return Response.json({ error: `license '${license}' is not on the green allow-list` }, { status: 422 });
    }
    status = "ready";
  } else {
    status = "graphifying";
  }

  // Prior status of this exact version, read before the write, so we can tell a
  // real graphifying→ready transition (notify watchers) from an idempotent
  // re-POST of an already-ready row (notify nobody — ticket 08 fires on "going ready").
  const prior = await env.CATALOG.prepare(
    "SELECT status FROM doc_versions WHERE slug = ? AND version_label = ?",
  )
    .bind(slug, versionLabel)
    .first<{ status: string }>();

  const isLatest = body.is_latest ? 1 : 0;
  // ponytail: every real payload (seed/pipeline/poller) carries the popularity rank;
  // the fallback only guards a malformed one so it sorts last rather than 500-ing.
  const rank = typeof body.popularity_rank === "number" ? body.popularity_rank : 1_000_000;

  const stmts = [
    env.CATALOG.prepare(
      `INSERT INTO docs (slug, name, repo_url, license_id, popularity_rank) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         name = excluded.name, repo_url = excluded.repo_url,
         license_id = excluded.license_id, popularity_rank = excluded.popularity_rank`,
    ).bind(slug, str(body.name) || slug, str(body.repo_url), license, rank),
  ];

  // A new latest alias demotes the previous one first (same transaction), so the
  // one-latest-per-slug invariant holds and old versions stay frozen (ADR-0003).
  if (isLatest) {
    stmts.push(
      env.CATALOG.prepare("UPDATE doc_versions SET is_latest = 0 WHERE slug = ? AND version_label <> ?").bind(
        slug,
        versionLabel,
      ),
    );
  }

  stmts.push(
    env.CATALOG.prepare(
      `INSERT INTO doc_versions
         (slug, version_label, is_latest, status, sha, docs_path, kg_ref, license_id, savings_json, graphscore, hero_savings, nodes, edges, built_at, needs_human)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug, version_label) DO UPDATE SET
         is_latest = excluded.is_latest, status = excluded.status,
         sha = excluded.sha, docs_path = excluded.docs_path, kg_ref = excluded.kg_ref,
         license_id = excluded.license_id, savings_json = excluded.savings_json,
         graphscore = excluded.graphscore, hero_savings = excluded.hero_savings,
         nodes = excluded.nodes, edges = excluded.edges, built_at = excluded.built_at,
         needs_human = excluded.needs_human`,
    ).bind(
      slug,
      versionLabel,
      isLatest,
      status,
      str(body.sha) || null,
      str(body.docs_path) || null,
      str(body.kg_ref) || null,
      license,
      body.savings != null ? JSON.stringify(body.savings) : null,
      num(body.graphscore),
      num(body.hero_savings),
      num(body.nodes),
      num(body.edges),
      str(body.built_at) || null,
      body.needs_human ? 1 : 0,
    ),
  );

  await env.CATALOG.batch(stmts);

  // Version just became `ready` — email its watchers (ADR-0006 service notify).
  // Best-effort: a Resend outage must never fail the catalog write.
  if (status === "ready" && prior?.status !== "ready") {
    try {
      await notifyWatchers(env, new URL(req.url).origin, slug, versionLabel);
    } catch {
      // swallow — notifying is a side-effect, not part of the upsert contract
    }
  }

  return Response.json({ ok: true, slug, version_label: versionLabel, status });
}

type UpsertBody = {
  slug?: unknown;
  name?: unknown;
  repo_url?: unknown;
  popularity_rank?: unknown;
  version_label?: unknown;
  is_latest?: unknown;
  status?: unknown;
  sha?: unknown;
  docs_path?: unknown;
  kg_ref?: unknown;
  license?: unknown;
  savings?: unknown;
  graphscore?: unknown;
  hero_savings?: unknown;
  nodes?: unknown;
  edges?: unknown;
  built_at?: unknown;
  needs_human?: unknown;
};

/** Bearer shared-secret. Compared as SHA-256 digests (fixed length) so the check
 *  leaks no timing signal about the secret, and an empty/unset secret can't match. */
async function authorized(env: Env, req: Request): Promise<boolean> {
  const expected = env.CATALOG_UPSERT_SECRET;
  if (!expected) return false;
  const provided = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided) return false;
  return (await sha256Hex(provided)) === (await sha256Hex(expected));
}

function parseSavings(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
