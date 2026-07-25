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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { CopyButton } from "@/components/copy-button";
import { useCatalog } from "@/lib/use-catalog";
import {
  buildCatalogRows,
  pageWindow,
  sameSort,
  toggleSort,
  DEFAULT_SORT,
  PAGE_SIZE,
  SORT_PRESETS,
  type CatalogSort,
  type SortKey,
} from "@/lib/catalog";

/**
 * The four sortable columns, in table order, each with a fixed width.
 *
 * The widths are not cosmetic: with the default `table-layout: auto` the browser
 * re-measures every column against the visible cells, so re-sorting (which swaps
 * "9.8k" for "1.2M", or "51 nodes · 57 edges" for "7.5k nodes · 8.1k edges")
 * resized the whole table under the cursor. `table-fixed` + these widths make the
 * layout independent of which 15 rows happen to be on screen.
 */
const SORTABLE: { key: SortKey; label: string; width: string }[] = [
  { key: "score", label: "GraphScore", width: "w-32" },
  { key: "tokens", label: "Doc tokens", width: "w-32" },
  { key: "size", label: "Graph size", width: "w-56" },
  { key: "updated", label: "Updated", width: "w-24" },
];

/**
 * The live catalog table (ticket 04): every `ready` doc from the read-only
 * catalog API, searchable, sortable and paged, each row with a copy-command button —
 * all with no sign-in and no KG fetch (ADR-0005). Rendering is a thin pass over
 * the pure view-model (`buildCatalogRows`); missing metrics show "—" (ADR-0006).
 */
export function CatalogSection() {
  const load = useCatalog();
  const [sort, setSort] = useState<CatalogSort>(DEFAULT_SORT);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(
    () => (load.status === "ready" ? buildCatalogRows(load.docs, sort, query) : []),
    [load, sort, query],
  );
  const count = load.status === "ready" ? load.docs.length : 0;
  const searching = query.trim() !== "";

  // Re-sorting or re-filtering makes the current page number meaningless, so both
  // reset to the first page rather than stranding you on an empty page 4.
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function reSort(key: SortKey) {
    setSort((s) => toggleSort(s, key));
    setPage(1);
  }

  return (
    <section id="catalog" className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-2xl font-semibold tracking-tight">Knowledge-graph catalog</h2>
        {/* Deliberately constant — the match count lives next to the search box below, so
            this line never re-lays out while someone is typing. */}
        <span className="font-mono text-xs text-muted-foreground">
          {load.status === "ready"
            ? `${count} librar${count === 1 ? "y" : "ies"} · more coming soon`
            : "more coming soon"}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search libraries…"
          aria-label="Search libraries"
          className="h-9 w-full max-w-md font-mono"
        />
        {searching && (
          <span aria-live="polite" className="font-mono text-xs text-muted-foreground">
            {rows.length === 0
              ? "no matches"
              : `${rows.length} match${rows.length === 1 ? "" : "es"}`}
          </span>
        )}
      </div>

      {/* Presets, not a second sort mechanism: whichever tab's sort is active lights up,
          even when a column header is what set it. Nothing can disagree. */}
      <Tabs
        value={SORT_PRESETS.find((p) => sameSort(p.sort, sort))?.label ?? ""}
        onValueChange={(label) => {
          const preset = SORT_PRESETS.find((p) => p.label === label);
          if (preset) {
            setSort(preset.sort);
            setPage(1);
          }
        }}
        className="mb-4"
      >
        <TabsList>
          {SORT_PRESETS.map((p) => (
            <TabsTrigger key={p.label} value={p.label}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="overflow-x-auto rounded-xl border border-border bg-card font-mono text-[13px]">
        {/* min-w keeps the fixed columns from being squeezed on a narrow screen — the
            wrapper scrolls horizontally instead. */}
        <Table className="table-fixed min-w-[860px]">
          <TableHeader>
            <TableRow>
              {/* No width: Library absorbs whatever the fixed columns leave. */}
              <TableHead>Library</TableHead>
              <TableHead className="w-24">Version</TableHead>
              {SORTABLE.map((col) => (
                <SortableHead key={col.key} col={col} sort={sort} onSort={reSort} />
              ))}
              <TableHead className="w-20 text-right">Command</TableHead>
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
            {pageRows.map((row) => (
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
                  {/* Icon only — the command is always `uvx graflet <slug>`, so spelling it
                      out in every row just widened the table. CopyButton's aria-label still
                      reads the full command out for screen readers. */}
                  <CopyButton
                    value={row.command}
                    idleLabel="⧉"
                    copiedLabel={<span className="text-primary">✓</span>}
                    className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <PageBar current={current} pageCount={pageCount} onPage={setPage} />
      )}
    </section>
  );
}

/** A sortable column header: a button carrying the arrow, plus `aria-sort` so the
 *  state is announced rather than only drawn. */
function SortableHead({
  col,
  sort,
  onSort,
}: {
  col: { key: SortKey; label: string; width: string };
  sort: CatalogSort;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === col.key;
  return (
    <TableHead
      className={`${col.width} text-right`}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(col.key)}
        aria-label={`Sort by ${col.label}`}
        className="ml-auto flex items-center gap-1 transition-colors hover:text-foreground"
      >
        {col.label}
        {/* Fixed-width slot: ⇅ and ↑/↓ are not the same width, so without it the label
            nudges sideways on every sort. */}
        <span
          aria-hidden
          className={`inline-block w-3 text-center ${active ? "text-primary" : "text-muted-foreground/50"}`}
        >
          {active ? (sort.dir === "asc" ? "↑" : "↓") : "⇅"}
        </span>
      </button>
    </TableHead>
  );
}

/**
 * Previous / numbers / Next. The `href` is what makes these keyboard-focusable, but
 * every click cancels the navigation — following it scrolled the table back to the
 * top on every page change, yanking the page out from under the cursor.
 */
function PageBar({
  current,
  pageCount,
  onPage,
}: {
  current: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  const go = (page: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (page >= 1 && page <= pageCount && page !== current) onPage(page);
  };

  return (
    <Pagination className="mt-4 font-mono">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#catalog"
            aria-disabled={current === 1 || undefined}
            className={current === 1 ? "pointer-events-none opacity-40" : undefined}
            onClick={go(current - 1)}
          />
        </PaginationItem>

        {pageWindow(current, pageCount).map((p, i) =>
          p === "…" ? (
            <PaginationItem key={`gap-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                href="#catalog"
                isActive={p === current}
                aria-label={`Go to page ${p}`}
                onClick={go(p)}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            href="#catalog"
            aria-disabled={current === pageCount || undefined}
            className={current === pageCount ? "pointer-events-none opacity-40" : undefined}
            onClick={go(current + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
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
