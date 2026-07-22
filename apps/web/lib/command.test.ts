import { describe, it, expect } from "vitest";
import { buildInstallCommand } from "./command";

describe("buildInstallCommand", () => {
  it("returns the bare command for the latest version (no @version)", () => {
    expect(buildInstallCommand("react")).toBe("uvx graflet react");
  });

  it("appends @<version> when a specific (non-latest) version is chosen", () => {
    expect(buildInstallCommand("react", "18.2.0")).toBe("uvx graflet react@18.2.0");
  });

  it("treats an empty / null / undefined version as latest (no @)", () => {
    expect(buildInstallCommand("next.js", "")).toBe("uvx graflet next.js");
    expect(buildInstallCommand("next.js", null)).toBe("uvx graflet next.js");
    expect(buildInstallCommand("next.js", undefined)).toBe("uvx graflet next.js");
  });
});
