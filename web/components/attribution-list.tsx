"use client";

import { useMemo } from "react";
import { useCatalog } from "@/lib/use-catalog";
import { buildAttributionRows } from "@/lib/attribution";

/**
 * The attribution list (ticket 07): every redistributed library's upstream source
 * repo + license, read from the same catalog API as the table (ticket 04), with no
 * sign-in and no data capture. Rendering is a thin pass over the pure view-model
 * (`buildAttributionRows`).
 */
export function AttributionList() {
  const load = useCatalog();
  const rows = useMemo(() => (load.status === "ready" ? buildAttributionRows(load.docs) : []), [load]);

  if (load.status === "loading") {
    return <p className="mt-8 font-mono text-sm text-muted-foreground">Loading sources…</p>;
  }
  if (load.status === "error") {
    return (
      <p className="mt-8 font-mono text-sm text-muted-foreground">
        Couldn&apos;t reach the catalog — try again shortly.
      </p>
    );
  }
  if (rows.length === 0) {
    return <p className="mt-8 font-mono text-sm text-muted-foreground">No libraries are published yet.</p>;
  }

  return (
    <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-card font-mono text-sm">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-foreground">{row.name}</span>
            {row.repo &&
              (row.repoUrl ? (
                <a href={row.repoUrl} className="text-[12px] text-muted-foreground hover:text-primary">
                  {row.repo}
                </a>
              ) : (
                <span className="text-[12px] text-muted-foreground">{row.repo}</span>
              ))}
          </div>
          <span className="text-muted-foreground">{row.license}</span>
        </li>
      ))}
    </ul>
  );
}
