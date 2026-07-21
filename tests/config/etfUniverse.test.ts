import { describe, expect, it } from "vitest";
import { configuredEtfs } from "../../src/config/etfs.js";
import { allianceBernsteinEtfs } from "../../src/providers/allianceBernstein/types.js";
import { allianzEtfs } from "../../src/providers/allianz/types.js";
import { ctbcEtfs } from "../../src/providers/ctbc/types.js";
import { firstEtfs } from "../../src/providers/first/types.js";
import { fubonEtfs } from "../../src/providers/fubon/types.js";
import { kgiEtfs } from "../../src/providers/kgi/types.js";

describe("configured active ETF universe", () => {
  it("enables verified June 2026 equity active ETFs with provider fund codes", () => {
    expect(configuredEtfs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          etfCode: "00402A",
          fundCode: "E0003",
          enabled: true,
          source: expect.objectContaining({ providerId: "allianz" })
        }),
        expect.objectContaining({
          etfCode: "00404A",
          fundCode: "TW00000404A5",
          enabled: true,
          source: expect.objectContaining({ providerId: "allianceBernstein" })
        }),
        expect.objectContaining({
          etfCode: "00405A",
          fundCode: "00405A",
          enabled: true,
          source: expect.objectContaining({ providerId: "fubon" })
        }),
        expect.objectContaining({
          etfCode: "00406A",
          fundCode: "E0038",
          enabled: true,
          source: expect.objectContaining({ providerId: "ctbc" })
        }),
        expect.objectContaining({
          etfCode: "00407A",
          fundCode: "J024",
          enabled: true,
          source: expect.objectContaining({ providerId: "kgi" })
        }),
        expect.objectContaining({
          etfCode: "00408A",
          fundCode: "183",
          enabled: true,
          source: expect.objectContaining({ providerId: "first" })
        })
      ])
    );
  });

  it("keeps provider-level code mappings in sync with enabled master config", () => {
    expect(allianzEtfs).toEqual(expect.arrayContaining([expect.objectContaining({ etfCode: "00402A", fundCode: "E0003" })]));
    expect(allianceBernsteinEtfs).toEqual(expect.arrayContaining([
      expect.objectContaining({ etfCode: "00404A", fundCode: "TW00000404A5" })
    ]));
    expect(fubonEtfs).toEqual(expect.arrayContaining([expect.objectContaining({ etfCode: "00405A", fundCode: "00405A" })]));
    expect(ctbcEtfs).toEqual(expect.arrayContaining([expect.objectContaining({ etfCode: "00406A", fundCode: "E0038" })]));
    expect(kgiEtfs).toEqual(expect.arrayContaining([expect.objectContaining({ etfCode: "00407A", fundCode: "J024" })]));
    expect(firstEtfs).toEqual(expect.arrayContaining([expect.objectContaining({ etfCode: "00408A", fundCode: "183" })]));
  });
});
