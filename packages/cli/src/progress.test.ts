import { describe, it, expect } from "vitest";
import {
  renderFrame,
  startProgress,
  formatBytes,
  formatCount,
  formatDuration,
  type StepView,
} from "./progress.js";

// Terse StepView builder — the tests only ever vary two or three fields.
function view(p: Partial<StepView> & { id: string; label: string }): StepView {
  return { state: "pending", done: 0, total: null, detail: "", ...p };
}

describe("renderFrame (ticket 05 progress UI)", () => {
  const steps: StepView[] = [
    view({
      id: "resolve",
      label: "Resolving latest",
      state: "done",
      detail: "2f9d939 · docs and graph aligned",
    }),
    // A leg whose size IS known renders a bar. No production leg is, today — both codeload
    // and the broker stream without a content-length — but the branch must stay correct.
    view({ id: "docs", label: "Downloading docs", state: "active", done: 25_000_000, total: 40_262_219 }),
    // The real production shape: no total, so bytes-so-far and nothing invented.
    view({ id: "graph", label: "Fetching graph", state: "active", done: 1_100_000, total: null }),
    view({ id: "later", label: "Writing files" }), // pending
  ];

  it("renders one line per non-pending step, with the right glyphs", () => {
    const lines = renderFrame(steps, 3, 120).split("\n");

    expect(lines).toHaveLength(3); // the pending step contributes nothing
    expect(renderFrame(steps, 3, 120)).not.toContain("Writing files");

    expect(lines[0]).toBe("✔ Resolved latest → 2f9d939 · docs and graph aligned");
    expect(lines[1]!.startsWith("⠸ ")).toBe(true); // frame 3 of the braille set
    expect(lines[2]!.startsWith("⠸ ")).toBe(true);
  });

  it("shows a bar + percentage only when the size is known", () => {
    const lines = renderFrame(steps, 3, 120).split("\n");

    expect(lines[1]).toMatch(/█+░+/);
    expect(lines[1]).toContain("62%");
    expect(lines[1]).toContain("25/40 MB"); // one unit, printed once

    expect(lines[2]).not.toMatch(/[█░]/); // no bar without a total …
    expect(lines[2]).not.toContain("%"); // … and no percentage to invent
    expect(lines[2]).toContain("1.1 MB");
  });

  it("lines the bars up under a common label column", () => {
    const [, docs, graph] = renderFrame(steps, 0, 120).split("\n");
    expect(docs!.indexOf("█")).toBe(graph!.indexOf("1.1 MB"));
  });

  it("marks a failed step with ✘ and keeps the present tense", () => {
    const failed = renderFrame(
      [view({ id: "graph", label: "Fetching graph", state: "failed", detail: "connection reset" })],
      0,
      120,
    );
    expect(failed).toBe("✘ Fetching graph — connection reset");
  });

  it("truncates every line to the terminal width (wrapping smears the redraw)", () => {
    const narrow = renderFrame(steps, 0, 24);
    for (const line of narrow.split("\n")) expect(line.length).toBeLessThanOrEqual(24);
    expect(narrow.split("\n")[0]).toContain("…");
  });
});

describe("startProgress: non-TTY (piped output / CI)", () => {
  it("writes zero ANSI bytes and exactly one line per completed step", () => {
    const chunks: string[] = [];
    const p = startProgress(
      [
        { id: "docs", label: "Downloading docs" },
        { id: "graph", label: "Fetching graph" },
      ],
      { isTTY: false, write: (c) => void chunks.push(c), columns: 80 },
    );

    p.begin("docs");
    p.update("docs", 25_000_000, 40_262_219);
    expect(chunks).toEqual([]); // nothing until a step actually finishes

    p.finish("docs", "149 files (40 MB)");
    p.begin("graph");
    p.fail("graph", "connection reset");
    p.stop();
    p.stop(); // idempotent

    const out = chunks.join("");
    expect(out).not.toContain("\x1b");
    expect(out).toBe("Downloaded docs → 149 files (40 MB)\nFetching graph — connection reset\n");
  });
});

describe("startProgress: TTY", () => {
  it("hides the cursor, redraws in place, and restores the cursor on stop", () => {
    const chunks: string[] = [];
    const p = startProgress([{ id: "docs", label: "Downloading docs" }], {
      isTTY: true,
      write: (c) => void chunks.push(c),
      columns: 80,
    });

    expect(chunks[0]).toBe("\x1b[?25l");
    p.begin("docs");
    p.finish("docs", "149 files (40 MB)");
    p.stop();
    p.stop(); // idempotent — must not emit a second cursor restore

    const out = chunks.join("");
    expect(out).toContain("\x1b[1A"); // walked back over the previous frame
    expect(out).toContain("\x1b[2K");
    expect(out).toContain("✔ Downloaded docs → 149 files (40 MB)");
    expect(out.match(/\x1b\[\?25h/g)).toHaveLength(1);
  });

  // A pty with no winsize (script(1), ssh -T, some CI runners) reports
  // columns === 0. `??` would keep the 0 and truncate every line to "", so the
  // whole UI silently drew blank frames.
  it("falls back to 80 columns when the terminal reports a width of 0", () => {
    const chunks: string[] = [];
    const p = startProgress([{ id: "docs", label: "Downloading docs" }], {
      isTTY: true,
      write: (c) => void chunks.push(c),
      columns: 0,
    });

    p.begin("docs");
    p.finish("docs", "149 files (40 MB)");
    p.stop();

    expect(chunks.join("")).toContain("✔ Downloaded docs → 149 files (40 MB)");
  });
});

describe("formatters", () => {
  it("formatBytes", () => {
    expect(formatBytes(40_262_219)).toBe("40 MB");
    expect(formatBytes(1_100_000)).toBe("1.1 MB");
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formatDuration", () => {
    expect(formatDuration(31)).toBe("31s");
    expect(formatDuration(34_711)).toBe("9h 38m");
    expect(formatDuration(612)).toBe("10m 12s");
    expect(formatDuration(600)).toBe("10m");
    expect(formatDuration(0)).toBe("0s");
  });

  it("formatCount", () => {
    expect(formatCount(2803)).toBe("2,803");
    expect(formatCount(2874)).toBe("2,874");
    expect(formatCount(385)).toBe("385");
    expect(formatCount(1_234_567)).toBe("1,234,567");
  });
});
