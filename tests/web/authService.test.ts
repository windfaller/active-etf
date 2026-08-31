import { describe, expect, it } from "vitest";
import { buildSignInUrl, extractAuthToken, stripAuthToken } from "../../src/web/auth/authService.js";

describe("external auth URL contract", () => {
  it("uses the requested central sign-in route and preserves the current product route", () => {
    const result = new URL(buildSignInUrl("https://active-etf.inthewins.com/compare/etfs?type=tw&codes=00981A,00982A"));
    expect(`${result.origin}${result.pathname}`).toBe("https://auth-app.gogowinners.me/sign-in");
    expect(result.searchParams.get("locale")).toBe("zh-TW");
    expect(result.searchParams.get("redirect")).toBe("https://active-etf.inthewins.com/compare/etfs?type=tw&codes=00981A%2C00982A");
  });

  it("extracts a one-time callback token and strips it from the visible URL", () => {
    const input = "https://active-etf.inthewins.com/signals?kind=all&idToken=signed-token#today";
    expect(extractAuthToken(input)).toBe("signed-token");
    expect(stripAuthToken(input)).toBe("https://active-etf.inthewins.com/signals?kind=all#today");
  });

  it("never reflects an old token into a new auth redirect", () => {
    const result = new URL(buildSignInUrl("https://active-etf.inthewins.com/?idToken=old-token"));
    expect(result.searchParams.get("redirect")).toBe("https://active-etf.inthewins.com/");
    expect(result.toString()).not.toContain("old-token");
  });
});
