import { describe, expect, it } from "vitest";
import { symbolsForMarketPreset } from "./universe";

describe("market-aware screener presets", () => {
  it("returns Indian exchange symbols for every preset when India is selected", () => {
    const keys = [
      "m-high",
      "m-breakouts",
      "m-52w",
      "v-lowpe",
      "v-divkings",
      "v-fcf",
      "g-revenue",
      "g-roe",
      "vol-volume",
      "vol-earnings",
    ];

    for (const key of keys) {
      expect(symbolsForMarketPreset(key, "IN").every((symbol) => /\.(NS|BO)$/i.test(symbol))).toBe(
        true,
      );
    }
  });

  it("keeps the US preset universe when the US market is selected", () => {
    expect(symbolsForMarketPreset("m-high", "US")).toContain("AAPL");
    expect(
      symbolsForMarketPreset("m-high", "US").some((symbol) => /\.(NS|BO)$/i.test(symbol)),
    ).toBe(false);
  });
});
