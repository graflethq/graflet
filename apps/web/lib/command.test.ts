import { describe, it, expect } from "vitest";
import { buildInstallCommand } from "./command";

describe("buildInstallCommand", () => {
  it("returns the bare command for the latest version (no @version)", () => {
    expect(buildInstallCommand("react")).toBe("npx docs-kg react");
  });

  it("appends @<version> when a specific (non-latest) version is chosen", () => {
    expect(buildInstallCommand("react", "18.2.0")).toBe("npx docs-kg react@18.2.0");
  });

  it("treats an empty / null / undefined version as latest (no @)", () => {
    expect(buildInstallCommand("next.js", "")).toBe("npx docs-kg next.js");
    expect(buildInstallCommand("next.js", null)).toBe("npx docs-kg next.js");
    expect(buildInstallCommand("next.js", undefined)).toBe("npx docs-kg next.js");
  });
});
