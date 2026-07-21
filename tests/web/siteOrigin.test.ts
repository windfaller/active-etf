import { describe, expect, it } from "vitest";
import { canonicalOriginForLocation } from "../../src/web/siteOrigin.js";

describe("canonical origin", () => {
  it("uses the inthewins production origin", () => {
    expect(canonicalOriginForLocation({ hostname: "active-etf.inthewins.com", origin: "https://active-etf.inthewins.com" })).toBe(
      "https://active-etf.inthewins.com"
    );
  });

  it("normalizes legacy and apex hosts to the production origin", () => {
    expect(canonicalOriginForLocation({ hostname: "inthewins.com", origin: "https://inthewins.com" })).toBe("https://active-etf.inthewins.com");
    expect(canonicalOriginForLocation({ hostname: "www.chicoo.co", origin: "https://www.chicoo.co" })).toBe("https://active-etf.inthewins.com");
  });

  it("keeps production canonical metadata while local navigation stays relative", () => {
    expect(canonicalOriginForLocation({ hostname: "localhost", origin: "http://localhost:5173" })).toBe("https://active-etf.inthewins.com");
  });
});
