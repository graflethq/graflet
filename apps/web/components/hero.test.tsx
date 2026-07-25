import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./hero";
import { LINKS } from "@/lib/links";

describe("Hero (compact: the catalog has to clear the fold)", () => {
  it("is one headline, one claim, one command — no badge, no terminal", () => {
    const { container } = render(<Hero />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Knowledge graphs for library docs",
    );
    expect(screen.queryByText(/FREE · OPEN SOURCE · MIT/)).toBeNull();
    // The example-output terminal moved to TerminalDemo, below the fold.
    expect(container.querySelector("pre")).toBeNull();
    // "Get started →" / "★ Star on GitHub" are duplicated in the nav and Support.
    expect(screen.queryByRole("link", { name: /Get started/ })).toBeNull();
  });

  it("sources the 95% claim to graphify's benchmarks rather than stating it bare", () => {
    render(<Hero />);

    expect(screen.getByRole("link", { name: /95% fewer tokens/ })).toHaveAttribute(
      "href",
      LINKS.graphifyBenchmarks,
    );
    // The baseline the number is measured against must stay in the sentence.
    expect(screen.getByText(/instead of dumping whole docs/)).toBeInTheDocument();
  });
});
