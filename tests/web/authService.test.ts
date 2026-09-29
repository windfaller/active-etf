import { describe, expect, it } from "vitest";
import { buildSignInUrl, extractAuthAction, extractAuthToken, safeAuthReturnUrl, stripAuthToken } from "../../src/web/auth/authService.js";

describe("external auth URL contract", () => {
  it("uses the requested central sign-in route and preserves the current product route", () => {
    const result = new URL(buildSignInUrl("https://active-etf.inthewins.com/compare/etfs?type=tw&codes=00981A,00982A"));
    expect(`${result.origin}${result.pathname}`).toBe("https://auth-app.gogowinners.me/sign-in");
    expect(result.searchParams.get("locale")).toBe("zh-TW");
    expect(result.searchParams.get("returnAuthAction")).toBe("1");
    expect(result.searchParams.get("redirect")).toBe("https://active-etf.inthewins.com/compare/etfs?type=tw&codes=00981A%2C00982A");
  });

  it("extracts a one-time callback token and strips it from the visible URL", () => {
    const input = "https://active-etf.inthewins.com/signals?kind=all&idToken=signed-token&authAction=sign_up#today";
    expect(extractAuthToken(input)).toBe("signed-token");
    expect(extractAuthAction(input)).toBe("sign_up");
    expect(stripAuthToken(input)).toBe("https://active-etf.inthewins.com/signals?kind=all#today");
  });

  it("rejects unknown auth action values", () => {
    expect(extractAuthAction("https://active-etf.inthewins.com/?authAction=register")).toBeNull();
  });

  it("never reflects an old token into a new auth redirect", () => {
    const result = new URL(buildSignInUrl("https://active-etf.inthewins.com/?idToken=old-token&authAction=sign_up"));
    expect(result.searchParams.get("redirect")).toBe("https://active-etf.inthewins.com/");
    expect(result.searchParams.get("returnAuthAction")).toBe("1");
    expect(result.toString()).not.toContain("old-token");
    expect(result.searchParams.get("redirect")).not.toContain("authAction");
  });

  it("keeps ETF selection, metric and safe campaign fields while dropping callback and unknown fields", () => {
    const result = new URL(safeAuthReturnUrl("https://active-etf.inthewins.com/compare/etfs?type=tw&codes=00981A,00982A&metric=holdings&utm_source=meta&fbclid=abc_123&idToken=secret&email=person%40example.com"));
    expect(result.searchParams.get("codes")).toBe("00981A,00982A");
    expect(result.searchParams.get("metric")).toBe("holdings");
    expect(result.searchParams.get("utm_source")).toBe("meta");
    expect(result.searchParams.get("fbclid")).toBe("abc_123");
    expect(result.toString()).not.toMatch(/secret|email|person/iu);
    expect(() => safeAuthReturnUrl("https://attacker.example/compare/etfs?codes=00981A,00982A")).toThrow();
    expect(safeAuthReturnUrl("https://kind-coast-08b07e900-20.eastasia.7.azurestaticapps.net/compare/etfs?type=tw&codes=00981A,00982A"))
      .toContain("kind-coast-08b07e900-20.eastasia.7.azurestaticapps.net/compare/etfs?type=tw");
  });
});
