import type { Db } from "mongodb";
import { configuredEtfs } from "../../config/etfs.js";
import { enabledGlobalEtfs } from "../../config/globalEtfs.js";
import type { EtfDailySummary } from "../../models/EtfDailySummary.js";
import type { GlobalEtfSnapshot } from "../../models/GlobalEtf.js";
import type { StockSectorProfile } from "../../models/StockSectorProfile.js";
import { generatedAt } from "./dataAccess.js";
import { searchStocks } from "./stockIntelligenceService.js";

export type SearchResultType = "tw_etf" | "global_etf" | "institution" | "tw_stock" | "us_stock" | "sector" | "signal";

function includesQuery(values: Array<string | undefined>, query: string): boolean {
  const normalized = query.toLocaleLowerCase("zh-Hant-TW");
  return values.some((value) => value?.toLocaleLowerCase("zh-Hant-TW").includes(normalized));
}

export async function globalSearch(db: Db, query: string, types: SearchResultType[], limit: number) {
  const activeTypes = new Set(types);
  const wants = (type: SearchResultType) => !activeTypes.size || activeTypes.has(type);
  const [twDates, globalDates, stockResults] = await Promise.all([
    wants("tw_etf") ? db.collection<EtfDailySummary>("etf_daily_summary").aggregate<{ _id: string; date: string }>([
      { $match: { etfCode: { $in: configuredEtfs.filter((row) => row.enabled).map((row) => row.etfCode) } } },
      { $group: { _id: "$etfCode", date: { $max: "$tradeDate" } } }
    ]).toArray() : [],
    wants("global_etf") || wants("institution") ? db.collection<GlobalEtfSnapshot>("global_etf_snapshots").aggregate<{ _id: string; date: string }>([
      { $match: { etfCode: { $in: enabledGlobalEtfs.map((row) => row.etfCode) }, sourceStatus: "ok" } },
      { $group: { _id: "$etfCode", date: { $max: "$sourceAsOf" } } }
    ]).toArray() : [],
    wants("tw_stock") || wants("us_stock") ? searchStocks(db, query, undefined, limit) : Promise.resolve({ results: [] })
  ]);
  const twDateByCode = new Map(twDates.map((row) => [row._id, row.date]));
  const globalDateByCode = new Map(globalDates.map((row) => [row._id, row.date]));
  const results: Array<{ type: SearchResultType; typeLabel: string; code: string; name: string; market: string; latestDataDate: string | null; path: string }> = [];

  if (wants("tw_etf")) {
    for (const etf of configuredEtfs.filter((row) => row.enabled && includesQuery([row.etfCode, row.name, row.issuer], query))) {
      results.push({ type: "tw_etf", typeLabel: "ETF", code: etf.etfCode, name: etf.name, market: "台灣", latestDataDate: twDateByCode.get(etf.etfCode) ?? null, path: `/etf/${etf.etfCode}` });
    }
  }
  for (const etf of enabledGlobalEtfs.filter((row) => includesQuery([row.etfCode, row.fundName, row.issuer], query))) {
    if (etf.strategyType === "13f" && wants("institution")) {
      results.push({ type: "institution", typeLabel: "機構 13F", code: etf.etfCode, name: etf.fundName, market: "美國 SEC", latestDataDate: globalDateByCode.get(etf.etfCode) ?? null, path: `/institutions/${etf.etfCode}` });
    } else if (etf.strategyType !== "13f" && wants("global_etf")) {
      results.push({ type: "global_etf", typeLabel: "海外 ETF", code: etf.etfCode, name: etf.fundName, market: "海外", latestDataDate: globalDateByCode.get(etf.etfCode) ?? null, path: `/global-etfs/${etf.etfCode}` });
    }
  }
  for (const stock of stockResults.results ?? []) {
    const type = stock.market === "tw" ? "tw_stock" : "us_stock";
    if (!wants(type)) continue;
    results.push({ type, typeLabel: "股票", code: stock.symbol, name: stock.name, market: stock.market === "tw" ? "台灣" : "美國", latestDataDate: stock.latestDataDate, path: stock.path });
  }
  if (wants("sector")) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const sectors = await db.collection<StockSectorProfile>("stock_sector_profiles").distinct("sector", { sector: { $regex: `^${escaped}`, $options: "i" } });
    for (const sector of sectors.slice(0, 8)) results.push({ type: "sector", typeLabel: "產業", code: sector, name: `${sector} 調倉`, market: "台灣", latestDataDate: null, path: `/market?sector=${encodeURIComponent(sector)}` });
  }
  if (wants("signal")) {
    const signalPages = [
      { code: "CONSECUTIVE", name: "連續加碼／減碼", path: "/signals/consecutive" },
      { code: "REVERSALS", name: "方向反轉", path: "/signals/reversals" },
      { code: "DIVERGENCE", name: "ETF 與法人分歧", path: "/signals/divergence" }
    ];
    for (const page of signalPages.filter((row) => includesQuery([row.code, row.name, "訊號"], query))) {
      results.push({ type: "signal", typeLabel: "訊號", code: page.code, name: page.name, market: "台灣", latestDataDate: null, path: page.path });
    }
  }
  const typeOrder: SearchResultType[] = ["tw_stock", "us_stock", "tw_etf", "global_etf", "institution", "sector", "signal"];
  results.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type) || a.code.localeCompare(b.code));
  return { generatedAt: generatedAt(), query, results: results.slice(0, limit) };
}
