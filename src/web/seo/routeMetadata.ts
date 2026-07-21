import { configuredEtfs } from "../../config/etfs.js";
import { enabledGlobalEtfs } from "../../config/globalEtfs.js";

export const SITE_ORIGIN = "https://active-etf.inthewins.com";
export const SOCIAL_IMAGE_URL = `${SITE_ORIGIN}/assets/etf-holdings-radar-og.png`;

export interface SeoBreadcrumb {
  name: string;
  path: string;
}

export interface RouteMetadata {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  eyebrow: string;
  robots: "index, follow" | "noindex, nofollow";
  breadcrumbs: SeoBreadcrumb[];
  pageType: "home" | "market" | "taiwan-etf" | "global-etf" | "institution" | "reference" | "not-found";
  sourceUrl?: string;
}

const taiwanEtfs = configuredEtfs.filter((etf) => etf.enabled);
const globalEtfs = enabledGlobalEtfs.filter((etf) => etf.strategyType !== "13f");
const institutions = enabledGlobalEtfs.filter((etf) => etf.strategyType === "13f");

function cleanPath(pathname: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  })();
  const path = decoded.split("?")[0]?.split("#")[0]?.replace(/\/+$/u, "") ?? "/";
  return path || "/";
}

function homeBreadcrumb(): SeoBreadcrumb {
  return { name: "今日情報", path: "/" };
}

function metadataBase(
  path: string,
  title: string,
  description: string,
  h1: string,
  intro: string,
  eyebrow: string,
  pageType: RouteMetadata["pageType"],
  breadcrumbs: SeoBreadcrumb[],
  sourceUrl?: string
): RouteMetadata {
  return { path, title, description, h1, intro, eyebrow, pageType, breadcrumbs, sourceUrl, robots: "index, follow" };
}

export function routeMetadataForPath(pathname: string): RouteMetadata | null {
  const path = cleanPath(pathname);
  const parts = path.split("/").filter(Boolean);

  if (path === "/") {
    return metadataBase(
      "/",
      "主動 ETF 機構調倉情報｜ETF 持倉雷達",
      "排除基金規模變化，追蹤台灣主動式 ETF 經理人真正的加碼、減碼、跨 ETF 共識與三大法人方向。",
      "主動 ETF 機構調倉情報",
      "排除基金規模變化，追蹤經理人真正的加碼、減碼與跨 ETF 共識。每日摘要同時呈現產業方向、共同加減碼與資料涵蓋狀態。",
      "ETF 持倉雷達",
      "home",
      [homeBreadcrumb()]
    );
  }

  if (path === "/market") {
    return metadataBase(
      path,
      "台灣主動式 ETF 市場總覽｜個股影響與產業方向",
      "查看台灣主動式 ETF 跨基金個股影響、規模校正後主動淨變動、三大法人與產業資金方向。",
      "台灣主動式 ETF 市場總覽",
      "從個股、產業與影響 ETF 數量比較當日機構調倉；表面持股變化與規模校正後主動變動分開呈現。",
      "台灣 ETF",
      "market",
      [homeBreadcrumb(), { name: "台灣 ETF 市場總覽", path }]
    );
  }

  if (parts[0] === "etf" && parts[1]) {
    const code = parts[1].toUpperCase();
    const etf = taiwanEtfs.find((row) => row.etfCode === code);
    if (!etf) return null;
    const section = parts[2]?.toLowerCase();
    const common = `${etf.etfCode} ${etf.name}由${etf.issuer}發行`;
    const rootCrumb = { name: `${etf.etfCode} ${etf.name}`, path: `/etf/${etf.etfCode}` };

    if (section === "changes") {
      return metadataBase(
        `/etf/${etf.etfCode}/changes`,
        `${etf.etfCode} ${etf.name}持股變化｜主動加碼與減碼`,
        `查看 ${etf.etfCode} ${etf.name}的新增、刪除、加碼、減碼與規模校正後主動調倉訊號。`,
        `${etf.etfCode} ${etf.name}持股變化`,
        `${common}。本頁用於比較當期與前期持股，並區分基金規模變化與經理人主動調倉。`,
        "台灣 ETF 持股變化",
        "taiwan-etf",
        [homeBreadcrumb(), { name: "台灣 ETF", path: "/market" }, rootCrumb, { name: "持股變化", path: `/etf/${etf.etfCode}/changes` }],
        etf.source.infoUrl
      );
    }

    if (section === "premium-history") {
      return metadataBase(
        `/etf/${etf.etfCode}/premium-history`,
        `${etf.etfCode} ${etf.name}折溢價歷史｜股價與淨值走勢`,
        `查看 ${etf.etfCode} ${etf.name}歷史股價、每單位淨值與折溢價走勢。`,
        `${etf.etfCode} ${etf.name}折溢價歷史`,
        `${common}。本頁用於查詢每個交易日的市價、淨值與折溢價，不將折溢價解讀為買賣建議。`,
        "台灣 ETF 折溢價",
        "taiwan-etf",
        [homeBreadcrumb(), { name: "台灣 ETF", path: "/market" }, rootCrumb, { name: "折溢價歷史", path: `/etf/${etf.etfCode}/premium-history` }],
        etf.source.infoUrl
      );
    }

    if (section) return null;
    return metadataBase(
      `/etf/${etf.etfCode}`,
      `${etf.etfCode} ${etf.name}｜持股、調倉與折溢價`,
      `查看 ${etf.etfCode} ${etf.name}的持股總表、持股變化、資產配置與折溢價資料。`,
      `${etf.etfCode} ${etf.name}`,
      `${common}。本頁整理該 ETF 的公開持股、權重、資產配置、折溢價與每日調倉用途。`,
      "台灣單檔 ETF",
      "taiwan-etf",
      [homeBreadcrumb(), { name: "台灣 ETF", path: "/market" }, rootCrumb],
      etf.source.infoUrl
    );
  }

  if (path === "/global-etfs") {
    return metadataBase(
      path,
      "海外 ETF 持股雷達｜共同持有與權重變化",
      "比較海外 ETF 官方持股、持股權重變化與跨 ETF 共同持有標的；機構 13F 另頁呈現。",
      "海外 ETF 市場總覽",
      "專注海外 ETF 的公開持股與持股權重變化。13F 由於是延遲的季度申報，不與 ETF 當期變化混合比較。",
      "海外 ETF",
      "market",
      [homeBreadcrumb(), { name: "海外 ETF", path }]
    );
  }

  if (parts[0] === "global-etfs" && parts[1] && !parts[2]) {
    const code = parts[1].toUpperCase();
    const etf = globalEtfs.find((row) => row.etfCode === code);
    if (!etf) return null;
    return metadataBase(
      `/global-etfs/${etf.etfCode}`,
      `${etf.etfCode} ${etf.fundName}｜海外 ETF 持股權重變化`,
      `查看 ${etf.etfCode} ${etf.fundName} 的官方持股、持股權重變化、資料日期與來源。`,
      `${etf.etfCode} ${etf.fundName}`,
      `${etf.etfCode} ${etf.fundName} 由 ${etf.issuer} 發行。本頁整理官方公開持股、權重及與前期的持股權重變化。`,
      "海外單檔 ETF",
      "global-etf",
      [homeBreadcrumb(), { name: "海外 ETF", path: "/global-etfs" }, { name: etf.etfCode, path: `/global-etfs/${etf.etfCode}` }],
      etf.sourceUrl
    );
  }

  if (path === "/institutions") {
    return metadataBase(
      path,
      "機構 13F 季度持倉｜延遲與申報日說明",
      "查看機構 13F 季度持倉變化、持倉截止日、資料取得日與延遲天數；13F 並非即時持倉。",
      "機構 13F 季度持倉",
      "13F 是向美國 SEC 申報的季度持倉資料，存在法定延遲，不可與 ETF 當日持股變化解讀為「同步加碼」。",
      "機構 13F",
      "institution",
      [homeBreadcrumb(), { name: "機構 13F", path }],
      "https://www.sec.gov/edgar/search/"
    );
  }

  if (parts[0] === "institutions" && parts[1] && !parts[2]) {
    const code = parts[1].toUpperCase();
    const institution = institutions.find((row) => row.etfCode === code);
    if (!institution) return null;
    return metadataBase(
      `/institutions/${institution.etfCode}`,
      `${institution.fundName}｜13F 季度持倉變化`,
      `查看 ${institution.fundName} 的 13F 季度持倉、持倉截止日、資料取得日與延遲天數。`,
      institution.fundName,
      `${institution.issuer} 的 13F 季度持倉變化由 SEC 公開申報整理。該資料並非即時持倉，不代表機構目前部位。`,
      "機構 13F",
      "institution",
      [homeBreadcrumb(), { name: "機構 13F", path: "/institutions" }, { name: institution.etfCode, path: `/institutions/${institution.etfCode}` }],
      institution.sourceUrl
    );
  }

  if (path === "/active-etfs") {
    return metadataBase(
      "/active-etfs/",
      "台灣主動式 ETF 追蹤清單｜ETF 持倉雷達",
      "本站目前追蹤的台灣主動式 ETF 代碼、名稱、發行投信與可查詢的持股、調倉、折溢價資料。",
      "台灣主動式 ETF 追蹤清單",
      "本頁整理納入 ETF 持倉雷達的台灣主動式 ETF，每檔的持股、調倉與折溢價仍以官方揭露日期為準。",
      "資料參考",
      "reference",
      [homeBreadcrumb(), { name: "追蹤 ETF 清單", path: "/active-etfs/" }]
    );
  }

  if (path === "/data-usage") {
    return metadataBase(
      "/data-usage/",
      "資料來源與使用說明｜ETF 持倉雷達",
      "ETF 持倉雷達的公開資料來源、更新時間差、計算方式與研究使用限制。",
      "資料來源與使用說明",
      "本站整理證交所、投信官網、美國 SEC 與海外發行商公開資料。不同來源更新時間不同，內容僅供資訊研究，不構成投資建議。",
      "資料參考",
      "reference",
      [homeBreadcrumb(), { name: "資料來源與使用說明", path: "/data-usage/" }]
    );
  }

  return null;
}

export function notFoundMetadata(pathname: string): RouteMetadata {
  const path = cleanPath(pathname);
  return {
    path,
    title: "找不到頁面｜ETF 持倉雷達",
    description: "這個 ETF 或資料頁面不存在。",
    h1: "找不到頁面",
    intro: "請檢查 ETF 代碼或回到今日情報。未知代碼不會自動切換到其他 ETF。",
    eyebrow: "404",
    robots: "noindex, nofollow",
    breadcrumbs: [homeBreadcrumb()],
    pageType: "not-found"
  };
}

export function allStaticSeoPaths(): string[] {
  return [
    "/",
    "/market",
    "/active-etfs/",
    "/global-etfs",
    "/institutions",
    "/data-usage/",
    ...taiwanEtfs.flatMap((etf) => [
      `/etf/${etf.etfCode}`,
      `/etf/${etf.etfCode}/changes`,
      `/etf/${etf.etfCode}/premium-history`
    ]),
    ...globalEtfs.map((etf) => `/global-etfs/${etf.etfCode}`),
    ...institutions.map((institution) => `/institutions/${institution.etfCode}`)
  ];
}

export function routeStructuredData(metadata: RouteMetadata, dateModified: string): unknown[] {
  const canonical = `${SITE_ORIGIN}${metadata.path}`;
  const organization = {
    "@type": "Organization",
    name: "Active ETF Intelligence",
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/assets/logo-mark.svg`
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: metadata.breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_ORIGIN}${item.path}`
    }))
  };
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: metadata.h1,
    url: canonical,
    description: metadata.description,
    inLanguage: "zh-Hant-TW",
    dateModified,
    publisher: organization,
    ...(metadata.sourceUrl ? { isBasedOn: metadata.sourceUrl } : {})
  };

  if (metadata.pageType === "reference" || metadata.pageType === "not-found") return [webPage, breadcrumb];

  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: metadata.h1,
    url: canonical,
    description: metadata.description,
    inLanguage: "zh-Hant-TW",
    dateModified,
    creator: organization,
    isBasedOn: metadata.sourceUrl
      ? [metadata.sourceUrl]
      : [
          "https://www.twse.com.tw/",
          "https://www.tpex.org.tw/",
          "https://mops.twse.com.tw/",
          "https://www.sec.gov/edgar/search/"
        ],
    keywords: ["台灣主動式 ETF", "ETF 持股", "ETF 調倉", "機構 13F", "規模校正"]
  };

  return [webPage, breadcrumb, dataset];
}
