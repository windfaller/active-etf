import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("auth callback bootstrap", () => {
  it("removes the one-time token before Google Tag Manager starts", async () => {
    const html = await readFile("index.html", "utf8");
    const tokenBootstrap = html.indexOf("__ACTIVE_ETF_AUTH_CALLBACK_TOKEN__");
    const tagManager = html.indexOf("Google Tag Manager");

    expect(tokenBootstrap).toBeGreaterThan(0);
    expect(tagManager).toBeGreaterThan(tokenBootstrap);
    expect(html).toContain("url.searchParams.delete('idToken')");
    expect(html).toContain('<meta name="referrer" content="same-origin" />');
  });
});
