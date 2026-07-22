import type { Metadata } from "next";
import { Title, Lede } from "@/components/legal-prose";
import { AttributionList } from "@/components/attribution-list";

export const metadata: Metadata = {
  title: "Attribution · docs-kg",
  description: "Upstream source and license for every doc set docs-kg redistributes.",
};

// Attribution (ticket 07). Lists each redistributed doc's upstream repo + license
// from the catalog, satisfying the green-license redistribution terms. Static
// shell + a client island that reads the read-only catalog API (no sign-in).
export default function AttributionPage() {
  return (
    <article>
      <Title>Attribution</Title>
      <Lede>
        docs-kg redistributes documentation from the projects below. Each stays under its own license; the graphs we
        build over them are ours. Here is every source repository and its license.
      </Lede>
      <AttributionList />
    </article>
  );
}
