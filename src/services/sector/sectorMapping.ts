import type { SectorName } from "../../models/EtfSectorFlow.js";

export interface StockSectorMapping {
  stockId: string;
  stockName?: string;
  sector: SectorName;
  tags?: string[];
}

const mappings: StockSectorMapping[] = [
  { stockId: "2330", stockName: "台積電", sector: "ASIC" },
  { stockId: "2454", stockName: "聯發科", sector: "ASIC" },
  { stockId: "3034", stockName: "聯詠", sector: "ASIC" },
  { stockId: "3443", stockName: "創意", sector: "ASIC" },
  { stockId: "3661", stockName: "世芯-KY", sector: "ASIC" },
  { stockId: "5274", stockName: "信驊", sector: "ASIC" },
  { stockId: "2308", stockName: "台達電", sector: "AI Server" },
  { stockId: "2317", stockName: "鴻海", sector: "AI Server" },
  { stockId: "2356", stockName: "英業達", sector: "AI Server" },
  { stockId: "2376", stockName: "技嘉", sector: "AI Server" },
  { stockId: "2377", stockName: "微星", sector: "AI Server" },
  { stockId: "2382", stockName: "廣達", sector: "AI Server" },
  { stockId: "3231", stockName: "緯創", sector: "AI Server" },
  { stockId: "3706", stockName: "神達", sector: "AI Server" },
  { stockId: "6669", stockName: "緯穎", sector: "AI Server" },
  { stockId: "8210", stockName: "勤誠", sector: "AI Server" },
  { stockId: "8996", stockName: "高力", sector: "散熱" },
  { stockId: "3017", stockName: "奇鋐", sector: "散熱" },
  { stockId: "3324", stockName: "雙鴻", sector: "散熱" },
  { stockId: "3653", stockName: "健策", sector: "散熱" },
  { stockId: "2421", stockName: "建準", sector: "散熱" },
  { stockId: "3338", stockName: "泰碩", sector: "散熱" },
  { stockId: "2368", stockName: "金像電", sector: "PCB" },
  { stockId: "2383", stockName: "台光電", sector: "PCB" },
  { stockId: "3037", stockName: "欣興", sector: "PCB" },
  { stockId: "3189", stockName: "景碩", sector: "PCB" },
  { stockId: "4958", stockName: "臻鼎-KY", sector: "PCB" },
  { stockId: "6191", stockName: "精成科", sector: "PCB" },
  { stockId: "6274", stockName: "台燿", sector: "PCB" },
  { stockId: "8046", stockName: "南電", sector: "PCB" },
  { stockId: "3081", stockName: "聯亞", sector: "光通訊" },
  { stockId: "3163", stockName: "波若威", sector: "光通訊" },
  { stockId: "3363", stockName: "上詮", sector: "光通訊" },
  { stockId: "4979", stockName: "華星光", sector: "光通訊" },
  { stockId: "6442", stockName: "光聖", sector: "CPO" },
  { stockId: "3711", stockName: "日月光投控", sector: "ASIC" },
  { stockId: "2303", stockName: "聯電", sector: "半導體" },
  { stockId: "2344", stockName: "華邦電", sector: "記憶體" },
  { stockId: "2408", stockName: "南亞科", sector: "記憶體" },
  { stockId: "3006", stockName: "晶豪科", sector: "記憶體" },
  { stockId: "5347", stockName: "世界", sector: "半導體" },
  { stockId: "6488", stockName: "環球晶", sector: "半導體" },
  { stockId: "3167", stockName: "大量", sector: "半導體設備" },
  { stockId: "3583", stockName: "辛耘", sector: "半導體設備" },
  { stockId: "3680", stockName: "家登", sector: "半導體設備" },
  { stockId: "4763", stockName: "材料-KY", sector: "半導體設備" },
  { stockId: "6789", stockName: "采鈺", sector: "半導體設備" },
  { stockId: "8028", stockName: "昇陽半導體", sector: "半導體" },
  { stockId: "8299", stockName: "群聯", sector: "記憶體" },
  { stockId: "1476", stockName: "儒鴻", sector: "其他" },
  { stockId: "1504", stockName: "東元", sector: "電源" },
  { stockId: "1519", stockName: "華城", sector: "電源" },
  { stockId: "1605", stockName: "華新", sector: "電源" },
  { stockId: "4904", stockName: "遠傳", sector: "其他" },
  { stockId: "2881", stockName: "富邦金", sector: "金融" },
  { stockId: "2882", stockName: "國泰金", sector: "金融" },
  { stockId: "2883", stockName: "凱基金", sector: "金融" },
  { stockId: "2884", stockName: "玉山金", sector: "金融" },
  { stockId: "2885", stockName: "元大金", sector: "金融" },
  { stockId: "2886", stockName: "兆豐金", sector: "金融" },
  { stockId: "2887", stockName: "台新新光金", sector: "金融" },
  { stockId: "2891", stockName: "中信金", sector: "金融" },
  { stockId: "2892", stockName: "第一金", sector: "金融" },
  { stockId: "5876", stockName: "上海商銀", sector: "金融" },
  { stockId: "5880", stockName: "合庫金", sector: "金融" },
  { stockId: "2603", stockName: "長榮", sector: "航運" },
  { stockId: "2609", stockName: "陽明", sector: "航運" },
  { stockId: "2615", stockName: "萬海", sector: "航運" },
  { stockId: "2618", stockName: "長榮航", sector: "航運" },
  { stockId: "2637", stockName: "慧洋-KY", sector: "航運" }
];

const mappingByStockId = new Map(mappings.map((mapping) => [mapping.stockId, mapping]));

const defaultTagsBySector: Partial<Record<SectorName, string[]>> = {
  "AI Server": ["AI", "AI伺服器"],
  ASIC: ["AI", "IC設計", "ASIC"],
  CPO: ["AI", "CPO", "光通訊"],
  PCB: ["AI", "PCB"],
  光通訊: ["AI", "光通訊"],
  半導體: ["半導體"],
  半導體設備: ["半導體設備"],
  散熱: ["AI", "散熱"],
  記憶體: ["記憶體"],
  電源: ["電力設備"],
  金融: ["金融"],
  航運: ["航運"]
};

const explicitTagsByStockId = new Map<string, string[]>([
  ["2330", ["AI", "晶圓代工", "CoWoS", "先進製程"]],
  ["2454", ["IC設計", "AI", "手機晶片"]],
  ["3034", ["IC設計", "面板驅動IC"]],
  ["3443", ["IC設計", "ASIC", "IP"]],
  ["3661", ["IC設計", "ASIC", "AI"]],
  ["5274", ["IC設計", "伺服器管理晶片"]],
  ["3711", ["封測", "先進封裝", "半導體"]],
  ["2327", ["被動元件", "車用電子"]],
  ["2345", ["網通", "AI伺服器", "交換器"]],
  ["2308", ["電源", "AI伺服器", "電動車"]],
  ["2317", ["AI伺服器", "EMS", "電動車"]],
  ["2356", ["AI伺服器", "伺服器代工"]],
  ["2376", ["AI伺服器", "板卡"]],
  ["2377", ["AI伺服器", "板卡"]],
  ["2382", ["AI伺服器", "伺服器代工"]],
  ["3231", ["AI伺服器", "伺服器代工"]],
  ["3706", ["AI伺服器", "伺服器代工"]],
  ["6669", ["AI伺服器", "伺服器代工"]],
  ["8210", ["AI伺服器", "機殼"]],
  ["3017", ["散熱", "AI伺服器"]],
  ["3324", ["散熱", "AI伺服器"]],
  ["3653", ["散熱", "均熱片"]],
  ["2421", ["散熱", "風扇"]],
  ["3338", ["散熱", "熱管"]],
  ["8996", ["散熱", "熱交換"]],
  ["2368", ["PCB", "AI伺服器"]],
  ["2383", ["PCB", "CCL", "AI伺服器"]],
  ["3037", ["PCB", "載板"]],
  ["3189", ["PCB", "載板"]],
  ["4958", ["PCB", "載板"]],
  ["6191", ["PCB", "EMS"]],
  ["6274", ["PCB", "CCL"]],
  ["8046", ["PCB", "載板"]],
  ["3081", ["光通訊", "磊晶"]],
  ["3163", ["光通訊", "矽光子"]],
  ["3363", ["光通訊", "CPO"]],
  ["4979", ["光通訊", "光收發模組"]],
  ["6442", ["CPO", "光通訊", "矽光子"]],
  ["2303", ["晶圓代工", "成熟製程"]],
  ["2449", ["封測", "半導體測試"]],
  ["2344", ["記憶體", "DRAM"]],
  ["2408", ["記憶體", "DRAM"]],
  ["3006", ["記憶體", "利基型記憶體"]],
  ["5347", ["晶圓代工", "成熟製程"]],
  ["6488", ["半導體材料", "矽晶圓"]],
  ["3167", ["半導體設備", "PCB設備"]],
  ["3583", ["半導體設備", "先進製程"]],
  ["3680", ["半導體設備", "EUV", "光罩盒"]],
  ["4763", ["半導體材料", "特用材料"]],
  ["6789", ["半導體", "CMOS影像感測"]],
  ["8028", ["半導體", "再生晶圓"]],
  ["8299", ["記憶體", "NAND控制IC"]],
  ["8150", ["封測", "記憶體測試"]],
  ["6223", ["半導體測試", "探針卡"]],
  ["6510", ["半導體測試", "探針卡"]],
  ["1476", ["紡織", "機能服飾"]],
  ["1504", ["電機", "節能設備"]],
  ["1519", ["重電", "電力設備"]],
  ["1605", ["線纜", "電力設備"]],
  ["4904", ["電信", "高股息"]],
  ["2881", ["金融", "金控"]],
  ["2882", ["金融", "金控"]],
  ["2883", ["金融", "金控"]],
  ["2884", ["金融", "金控"]],
  ["2885", ["金融", "金控"]],
  ["2886", ["金融", "金控"]],
  ["2887", ["金融", "金控"]],
  ["2891", ["金融", "金控"]],
  ["2892", ["金融", "金控"]],
  ["5876", ["金融", "銀行"]],
  ["5880", ["金融", "金控"]],
  ["2603", ["航運", "貨櫃航運"]],
  ["2609", ["航運", "貨櫃航運"]],
  ["2615", ["航運", "貨櫃航運"]],
  ["2618", ["航運", "航空"]],
  ["2637", ["航運", "散裝航運"]]
]);

function dedupeTags(tags: string[]): string[] {
  return [...new Set(tags.filter(Boolean))].slice(0, 5);
}

function heuristicSector(stockId: string, stockName?: string): SectorName {
  if (/^28/u.test(stockId) || /金|銀|壽|保險|證/u.test(stockName ?? "")) return "金融";
  if (/^26/u.test(stockId) || /航運|航空|貨櫃|散裝|長榮航|萬海|慧洋/u.test(stockName ?? "")) return "航運";
  if (/光|聯亞|波若威|華星光|上詮/u.test(stockName ?? "")) return "光通訊";
  if (/半導體|晶圓|矽|封測|日月光|精測/u.test(stockName ?? "")) return "半導體";
  if (/記憶體|華邦|南亞科|群聯|旺宏/u.test(stockName ?? "")) return "記憶體";
  if (/散熱|風扇|熱|奇鋐|雙鴻|健策|建準/u.test(stockName ?? "")) return "散熱";
  if (/PCB|電路板|欣興|南電|台光電|金像電|台燿/u.test(stockName ?? "")) return "PCB";
  return "其他";
}

function heuristicTags(stockId: string, stockName?: string): string[] {
  const name = stockName ?? "";
  const tags: string[] = [];
  if (/^28/u.test(stockId) || /金|銀|壽|保險|證/u.test(name)) tags.push("金融");
  if (/^26/u.test(stockId) || /航運|航空|貨櫃|散裝|長榮航|萬海|慧洋/u.test(name)) tags.push("航運");
  if (/AI|伺服器|廣達|緯創|緯穎|英業達|神達/u.test(name)) tags.push("AI伺服器");
  if (/光|CPO|矽光|光通訊|光聖|聯亞|波若威|華星光|上詮/u.test(name)) tags.push("光通訊");
  if (/半導體|晶圓|矽|封測|精測/u.test(name)) tags.push("半導體");
  if (/測試|探針|京元|旺矽|南茂|精測/u.test(name)) tags.push("半導體測試");
  if (/國巨|華新科|信昌電|被動元件/u.test(name)) tags.push("被動元件");
  if (/智邦|網通|交換器|啟碁|中磊/u.test(name)) tags.push("網通");
  if (/記憶體|華邦|南亞科|旺宏/u.test(name)) tags.push("記憶體");
  if (/散熱|風扇|熱|奇鋐|雙鴻|健策|建準/u.test(name)) tags.push("散熱");
  if (/PCB|電路板|欣興|南電|台光電|金像電|台燿/u.test(name)) tags.push("PCB");
  if (/電力|重電|華城|東元|線纜|電源/u.test(name)) tags.push("電力設備");
  return tags;
}

export function themeTagsForStock(stockId: string, stockName?: string): string[] {
  const mapping = mappingByStockId.get(stockId);
  const sector = mapping?.sector ?? heuristicSector(stockId, stockName);
  const mappedTags = [
    ...(mapping?.tags ?? []),
    ...(explicitTagsByStockId.get(stockId) ?? []),
    ...(defaultTagsBySector[sector] ?? [])
  ];
  if (mapping) return dedupeTags(mappedTags);

  return dedupeTags([
    ...mappedTags,
    ...heuristicTags(stockId, stockName)
  ]);
}

export function sectorForStock(stockId: string, stockName?: string): SectorName {
  return mappingByStockId.get(stockId)?.sector ?? heuristicSector(stockId, stockName);
}

export function mappedStockNameForStock(stockId: string): string | undefined {
  return mappingByStockId.get(stockId)?.stockName;
}

export function sectorProfileForStock(stockId: string, stockName?: string) {
  const mapping = mappingByStockId.get(stockId);
  const sector = mapping?.sector ?? heuristicSector(stockId, stockName);
  return {
    stockId,
    stockName: stockName ?? mapping?.stockName,
    sector,
    themeTags: themeTagsForStock(stockId, stockName ?? mapping?.stockName),
    source: mapping ? ("static" as const) : sector === "其他" ? ("unknown" as const) : ("heuristic" as const)
  };
}
