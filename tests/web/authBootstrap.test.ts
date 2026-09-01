import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("auth callback bootstrap", () => {
  it("removes the one-time token before the app can start denied-mode Google measurement", async () => {
    const [html, main, consent] = await Promise.all([
      readFile("index.html", "utf8"),
      readFile("src/web/main.ts", "utf8"),
      readFile("src/web/consent.ts", "utf8")
    ]);
    const tokenBootstrap = html.indexOf("__ACTIVE_ETF_AUTH_CALLBACK_TOKEN__");
    const appModule = html.indexOf('/src/web/main.ts');

    expect(tokenBootstrap).toBeGreaterThan(0);
    expect(appModule).toBeGreaterThan(tokenBootstrap);
    expect(html).toContain("url.searchParams.delete('idToken')");
    expect(html).toContain('<meta name="referrer" content="same-origin" />');
    expect(html).not.toContain("googletagmanager.com");
    expect(main.indexOf("initializeTrackingConsent()")).toBeLessThan(main.indexOf("createApp(App).mount"));
    expect(main.indexOf("initializeTrackingConsent()")).toBeLessThan(main.indexOf("trackInitialPageView(window.location.pathname)"));
    expect(consent).toContain("googletagmanager.com/gtag/js");
    expect(consent).toContain("connect.facebook.net/en_US/fbevents.js");
    expect(consent).toContain("hasTrackingConsent(target)");
  });
});
