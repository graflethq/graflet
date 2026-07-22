import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Landing page (ADR-0005: no email / marketing opt-in capture)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders no email input and no opt-in checkbox anywhere on the landing page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ docs: [] }) })) as unknown as typeof fetch,
    );

    const { container } = render(<Home />);
    // Let the catalog fetch settle (also asserts the empty state renders).
    await screen.findByText("No libraries are ready yet.");

    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });
});
