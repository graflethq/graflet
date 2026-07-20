"use client";

import { useEffect, useState } from "react";
import { fetchCatalog } from "@/lib/api";
import { buildStatTiles, statBasis } from "@/lib/stats";
import type { CatalogDoc } from "@/lib/catalog";

/**
 * The four headline stat tiles (ticket 05). Every value comes from the live
 * catalog via the pure `buildStatTiles` seam — a real representative doc's metric,
 * or "—" for a metric the data lacks (ADR-0006 honesty). Loading/error/empty all
 * collapse to "—", so the tiles never show a fabricated or stale number.
 *
 * ponytail: fetches /catalog a second time (the table fetches it too). One extra
 * cached GET on a marketing page < wiring a shared fetch across two independent
 * client sections; lift into a shared hook only if a third consumer appears.
 */
export function StatTiles() {
  const [docs, setDocs] = useState<CatalogDoc[]>([]);

  useEffect(() => {
    const ac = new AbortController();
    fetchCatalog(ac.signal)
      .then(setDocs)
      .catch(() => {
        // Honest fallback: no data → tiles already render "—". Nothing to show.
      });
    return () => ac.abort();
  }, []);

  const tiles = buildStatTiles(docs);
  const basis = statBasis(docs);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-5">
            <div className="font-mono text-2xl font-semibold text-primary sm:text-3xl">{t.value}</div>
            <div className="mt-2 font-mono text-sm text-foreground">{t.label}</div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.sub}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        {basis
          ? `Live from the catalog · e.g. ${basis}`
          : "Live from the catalog · — until the first graph is measured"}
      </p>
    </section>
  );
}
