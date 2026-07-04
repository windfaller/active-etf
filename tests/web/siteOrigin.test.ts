import { describe, expect, it } from "vitest";
import { canonicalOriginForLocation } from "../../src/web/siteOrigin.js";

describe("canonical origin", () => {
  it("uses known public hosts as their own canonical origin", () => {
    expect(canonicalOriginForLocation({ hostname: "active-etf.inthewins.com", origin: "https://active-etf.inthewins.com" })).toBe(
      "https://active-etf.inthewins.com"
    );
  });

  it("falls back to the production chicoo host for preview or local hosts", () => {
    expect(canonicalOriginForLocation({ hostname: "localhost", origin: "http://localhost:5173" })).toBe("https://active-etf.chicoo.co");
  });
});
