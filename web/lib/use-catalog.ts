import { useEffect, useState } from "react";
import { fetchCatalog } from "./api";
import type { CatalogDoc } from "./catalog";

/**
 * Fetch GET /catalog once on mount, aborting on unmount. The one place the
 * fetch/abort/error dance lives — shared by the catalog table (ticket 04) and the
 * attribution list (ticket 07), both thin renderers over the docs it returns.
 */
export type CatalogLoad =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; docs: CatalogDoc[] };

export function useCatalog(): CatalogLoad {
  const [load, setLoad] = useState<CatalogLoad>({ status: "loading" });

  useEffect(() => {
    const ac = new AbortController();
    fetchCatalog(ac.signal)
      .then((docs) => setLoad({ status: "ready", docs }))
      .catch(() => {
        if (!ac.signal.aborted) setLoad({ status: "error" });
      });
    return () => ac.abort();
  }, []);

  return load;
}
