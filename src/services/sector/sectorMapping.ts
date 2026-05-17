import type { SectorName } from "../../models/EtfSectorFlow.js";

export interface StockSectorMapping {
  stockId: string;
  stockName?: string;
  sector: SectorName;
}

const mappings: StockSectorMapping[] = [
  { stockId: "2330", stockName: "台積電", sector: "ASIC" },
  { stockId: "2308", stockName: "台達電", sector: "AI Server" },
  { stockId: "2317", stockName: "鴻海", sector: "AI Server" },
  { stockId: "2382", stockName: "廣達", sector: "AI Server" },
  { stockId: "3231", stockName: "緯創", sector: "AI Server" },
  { stockId: "6669", stockName: "緯穎", sector: "AI Server" },
  { stockId: "3017", stockName: "奇鋐", sector: "散熱" },
  { stockId: "3324", stockName: "雙鴻", sector: "散熱" },
  { stockId: "2383", stockName: "台光電", sector: "PCB" },
  { stockId: "3037", stockName: "欣興", sector: "PCB" },
  { stockId: "8046", stockName: "南電", sector: "PCB" },
  { stockId: "6442", stockName: "光聖", sector: "CPO" },
  { stockId: "3711", stockName: "日月光投控", sector: "ASIC" },
  { stockId: "2881", stockName: "富邦金", sector: "金融" },
  { stockId: "2882", stockName: "國泰金", sector: "金融" },
  { stockId: "2603", stockName: "長榮", sector: "航運" },
  { stockId: "2609", stockName: "陽明", sector: "航運" }
];

const sectorByStockId = new Map(mappings.map((mapping) => [mapping.stockId, mapping.sector]));

export function sectorForStock(stockId: string): SectorName {
  return sectorByStockId.get(stockId) ?? "其他";
}
