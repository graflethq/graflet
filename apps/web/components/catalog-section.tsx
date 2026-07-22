"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "@/components/copy-button";
import { useCatalog } from "@/lib/use-catalog";
import { buildCatalogRows, type CatalogTab } from "@/lib/catalog";

const TABS: { key: CatalogTab; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "smallest", label: "Smallest first" },
  { key: "recent", label: "Recently built" },
];

/**
 * The live catalog table (ticket 04): every `ready` doc from the read-only
 * catalog API, searchable and re-sortable, each row with a copy-command button —
 * all with no sign-in and no KG fetch (ADR-0005). Rendering is a thin pass over
 * the pure view-model (`buildCatalogRows`); missing metrics show "—" (ADR-0006).
 */
export function CatalogSection() {
  const load = useCatalog();
  const [tab, setTab] = useState<CatalogTab>("popular");
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () => (load.status === "ready" ? buildCatalogRows(load.docs, tab, query) : []),
    [load, tab, query],
  );
  const count = load.status === "ready" ? load.docs.length : 0;

  return (
    <section id="catalog" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-2xl font-semibold tracking-tight">Knowledge-graph catalog</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {load.status === "ready"
            ? `${count} librar${count === 1 ? "y" : "ies"} · aligned to pinned releases`
            : "aligned to pinned releases"}
        </span>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search libraries…"
        aria-label="Search libraries"
        className="mb-4 max-w-md font-mono"
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as CatalogTab)} className="mb-4">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="overflow-x-auto rounded-xl border border-border bg-card font-mono text-[13px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Library</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="text-right">GraphScore</TableHead>
              <TableHead className="text-right">Tokens saved</TableHead>
              <TableHead className="text-right">Graph size</TableHead>
              <TableHead className="text-right">Updated</TableHead>
              <TableHead className="text-right">Command</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {load.status === "loading" && <StateRow>Loading catalog…</StateRow>}
            {load.status === "error" && (
              <StateRow>Couldn&apos;t reach the catalog — try again shortly.</StateRow>
            )}
            {load.status === "ready" && rows.length === 0 && (
              <StateRow>
                {query ? `No libraries match “${query}”.` : "No libraries are ready yet."}
              </StateRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-foreground">{row.name}</span>
                    {row.repo && <span className="text-[11px] text-muted-foreground">{row.repo}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono font-normal text-muted-foreground">
                    {row.version}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-primary">{row.score}</TableCell>
                <TableCell className="text-right">{row.tokens}</TableCell>
                <TableCell className="text-right text-muted-foreground">{row.size}</TableCell>
                <TableCell className="text-right text-muted-foreground">{row.updated}</TableCell>
                <TableCell className="text-right">
                  <CopyButton
                    value={row.command}
                    idleLabel={<span>⧉ {row.command}</span>}
                    copiedLabel={<span className="text-primary">✓ copied</span>}
                    className="whitespace-nowrap rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function StateRow({ children }: { children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}
