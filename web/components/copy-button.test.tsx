import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "./copy-button";

describe("CopyButton (ADR-0005: copying makes no network request)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("writes the exact value to the clipboard, fires no fetch, and shows a copied state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(<CopyButton value="npx docs-kg react" idleLabel="Copy" />);
    await userEvent.click(screen.getByRole("button"));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("npx docs-kg react");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await screen.findByText("Copied ✓")).toBeInTheDocument();
  });
});
