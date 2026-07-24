import { describe, expect, it, vi } from "vitest";
import { BoundedRequestCache } from "../../src/services/cache/boundedRequestCache.js";

describe("BoundedRequestCache", () => {
  it("deduplicates in-flight work without retaining a rejected loader", async () => {
    const cache = new BoundedRequestCache(2);
    let resolveFirst!: (value: string) => void;
    const sharedLoader = vi.fn(() => new Promise<string>((resolve) => { resolveFirst = resolve; }));

    const first = cache.getOrLoad("shared", 60_000, sharedLoader);
    const second = cache.getOrLoad("shared", 60_000, sharedLoader);
    resolveFirst("ready");

    await expect(Promise.all([first, second])).resolves.toEqual(["ready", "ready"]);
    expect(sharedLoader).toHaveBeenCalledTimes(1);

    const failingLoader = vi.fn(async () => { throw new Error("temporary failure"); });
    await expect(cache.getOrLoad("failure", 60_000, failingLoader)).rejects.toThrow("temporary failure");
    await expect(cache.getOrLoad("failure", 60_000, async () => "recovered")).resolves.toBe("recovered");
    expect(failingLoader).toHaveBeenCalledTimes(1);
  });

  it("reports misses, coalesced requests, and resolved hits", async () => {
    const cache = new BoundedRequestCache();
    const statuses: string[] = [];
    let resolveLoader!: (value: string) => void;
    const loader = () => new Promise<string>((resolve) => { resolveLoader = resolve; });

    const first = cache.getOrLoad("key", 60_000, loader, (status) => statuses.push(status));
    const second = cache.getOrLoad("key", 60_000, loader, (status) => statuses.push(status));
    resolveLoader("ready");
    await Promise.all([first, second]);
    await cache.getOrLoad("key", 60_000, loader, (status) => statuses.push(status));

    expect(statuses).toEqual(["miss", "coalesced", "hit"]);
  });
});
