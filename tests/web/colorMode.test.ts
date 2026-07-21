import { describe, expect, it } from "vitest";
import { resolveInitialColorMode } from "../../src/web/composables/useColorMode.js";

describe("color mode preference", () => {
  it("uses a saved user preference before the system preference", () => {
    expect(resolveInitialColorMode("light", true)).toBe("light");
    expect(resolveInitialColorMode("dark", false)).toBe("dark");
  });

  it("falls back to the system preference when no valid value is saved", () => {
    expect(resolveInitialColorMode(null, true)).toBe("dark");
    expect(resolveInitialColorMode("unknown", false)).toBe("light");
  });
});
