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

function heuristicSector(stockId: string, stockName?: string): SectorName {
  if (/^28/u.test(stockId) || /金|銀|壽|保險|證/u.test(stockName ?? "")) return "金融";
  if (/^26/u.test(stockId) || /航|運|海/u.test(stockName ?? "")) return "航運";
  if (/光|聯亞|波若威|華星光|上詮/u.test(stockName ?? "")) return "光通訊";
  if (/半導體|晶圓|矽|封測|日月光|精測/u.test(stockName ?? "")) return "半導體";
  if (/記憶體|華邦|南亞科|群聯|旺宏/u.test(stockName ?? "")) return "記憶體";
  if (/散熱|風扇|熱|奇鋐|雙鴻|健策|建準/u.test(stockName ?? "")) return "散熱";
  if (/PCB|電路板|欣興|南電|台光電|金像電|台燿/u.test(stockName ?? "")) return "PCB";
  return "其他";
}

export function sectorForStock(stockId: string, stockName?: string): SectorName {
  return mappingByStockId.get(stockId)?.sector ?? heuristicSector(stockId, stockName);
}

export function sectorProfileForStock(stockId: string, stockName?: string) {
  const mapping = mappingByStockId.get(stockId);
  const sector = mapping?.sector ?? heuristicSector(stockId, stockName);
  return {
    stockId,
    stockName: stockName ?? mapping?.stockName,
    sector,
    themeTags: mapping?.tags ?? [],
    source: mapping ? ("static" as const) : sector === "其他" ? ("unknown" as const) : ("heuristic" as const)
  };
}
