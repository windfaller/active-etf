import { defineConfig, type ViteDevServer, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  allStaticSeoPaths,
  notFoundMetadata,
  routeMetadataForPath,
  routeStructuredData,
  SITE_ORIGIN,
  SOCIAL_IMAGE_URL,
  type RouteMetadata
} from "./src/web/seo/routeMetadata";
import {
  loadPrerenderSnapshot,
  prerenderContentForPath,
  prerenderDateForPath
} from "./src/web/seo/prerenderSnapshot";

const appVersion = process.env.GITHUB_SHA ?? process.env.BUILD_VERSION ?? String(Date.now());

function appVersionPlugin(): Plugin {
  const payload = JSON.stringify({ version: appVersion }, null, 2);

  return {
    name: "app-version",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/app-version.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.end(payload);
      });
    },
    closeBundle() {
      const outDir = resolve(process.cwd(), "dist");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, "app-version.json"), `${payload}\n`);
    }
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#039;");
}

function seoHead(metadata: RouteMetadata, dateModified?: string): string {
  const canonical = `${SITE_ORIGIN}${metadata.path}`;
  const jsonLd = JSON.stringify(routeStructuredData(metadata, dateModified)).replace(/</gu, "\\u003c");
  return [
    "<!-- SEO_HEAD_START -->",
    `    <title>${escapeHtml(metadata.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(metadata.description)}" />`,
    `    <meta name="robots" content="${metadata.robots}" />`,
    `    <link rel="canonical" href="${canonical}" />`,
    `    <link rel="alternate" href="${canonical}" hreflang="zh-Hant-TW" />`,
    `    <meta property="og:type" content="${metadata.pageType === "home" || metadata.pageType === "market" ? "website" : "article"}" />`,
    '    <meta property="og:locale" content="zh_TW" />',
    '    <meta property="og:site_name" content="ETF 持倉雷達" />',
    `    <meta property="og:title" content="${escapeHtml(metadata.title)}" />`,
    `    <meta property="og:description" content="${escapeHtml(metadata.description)}" />`,
    `    <meta property="og:url" content="${canonical}" />`,
    `    <meta property="og:image" content="${SOCIAL_IMAGE_URL}" />`,
    '    <meta property="og:image:width" content="1200" />',
    '    <meta property="og:image:height" content="630" />',
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`,
    `    <meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`,
    `    <meta name="twitter:image" content="${SOCIAL_IMAGE_URL}" />`,
    `    <script id="route-structured-data" type="application/ld+json">${jsonLd}</script>`,
    "<!-- SEO_HEAD_END -->"
  ].join("\n");
}

function routeLinks(metadata: RouteMetadata): Array<{ path: string; label: string }> {
  if (metadata.path === "/active-etfs/") {
    return allStaticSeoPaths()
      .filter((path) => /^\/etf\/[^/]+$/u.test(path))
      .map((path) => ({ path, label: path.split("/")[2] ?? path }));
  }
  if (metadata.path === "/global-etfs") {
    return allStaticSeoPaths()
      .filter((path) => /^\/global-etfs\/[^/]+$/u.test(path))
      .slice(0, 16)
      .map((path) => ({ path, label: path.split("/")[2] ?? path }));
  }
  if (metadata.path === "/institutions") {
    return allStaticSeoPaths()
      .filter((path) => /^\/institutions\/[^/]+$/u.test(path))
      .map((path) => ({ path, label: path.split("/")[2] ?? path }));
  }
  return [
    { path: "/", label: "今日情報" },
    { path: "/market", label: "台灣 ETF" },
    { path: "/global-etfs", label: "海外 ETF" },
    { path: "/institutions", label: "機構 13F" },
    { path: "/stocks", label: "股票情報" },
    { path: "/compare/etfs", label: "ETF 比較" },
    { path: "/signals", label: "交易日訊號" },
    { path: "/methodology", label: "方法論" }
  ].filter((item) => item.path !== metadata.path);
}

function staticSeoShell(metadata: RouteMetadata, liveContent = ""): string {
  const breadcrumbs = metadata.breadcrumbs
    .map((item) => `<a href="${item.path}">${escapeHtml(item.name)}</a>`)
    .join("<span aria-hidden=\"true\">/</span>");
  const links = routeLinks(metadata)
    .map((item) => `<li><a href="${item.path}">${escapeHtml(item.label)}</a></li>`)
    .join("");
  const usageCopy = metadata.path === "/data-usage/"
    ? "<p>台灣資料主要來自證交所、櫃買中心、公開資訊觀測站與各投信官方揭露；海外 ETF 來自發行商官方持股，13F 來自美國 SEC。</p><p>資料可能因來源公告時點、交易日與申報制度而延遲。本站未宣稱對第三方原始資料授予額外授權；請依各官方來源的使用條款。</p>"
    : "";
  return [
    "<!-- SEO_BODY_START -->",
    '      <main class="static-seo-shell">',
    `        <nav aria-label="麵包屑">${breadcrumbs}</nav>`,
    `        <p class="seo-eyebrow">${escapeHtml(metadata.eyebrow)}</p>`,
    `        <h1>${escapeHtml(metadata.h1)}</h1>`,
    `        <p>${escapeHtml(metadata.intro)}</p>`,
    liveContent,
    usageCopy,
    `        <ul>${links}</ul>`,
    '        <p class="seo-disclosure">本資料根據公開資訊整理，僅供資訊研究使用，不構成投資建議。</p>',
    "      </main>",
    "<!-- SEO_BODY_END -->"
  ].filter(Boolean).join("\n");
}

function outputFileForRoute(outDir: string, path: string): string {
  if (path === "/") return resolve(outDir, "index.html");
  const relativePath = path.replace(/^\/+|\/+$/gu, "");
  return resolve(outDir, relativePath, "index.html");
}

function writeStaticRouteRewrites(outDir: string): void {
  const configPath = resolve(outDir, "staticwebapp.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as {
    routes?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  const prerenderRoutes = allStaticSeoPaths()
    .filter((path) => path !== "/")
    .map((path) => ({
      route: path,
      rewrite: `${path.replace(/\/$/u, "")}/index.html`
    }));
  const existingRoutes = (config.routes ?? []).filter((route) => route.route !== "/*");
  config.routes = [
    ...prerenderRoutes,
    ...existingRoutes,
    {
      route: "/stocks/tw/*",
      rewrite: "/stocks/_dynamic/index.html",
      headers: { "cache-control": "no-cache, must-revalidate" }
    },
    {
      route: "/stocks/us/*",
      rewrite: "/stocks/_dynamic/index.html",
      headers: { "cache-control": "no-cache, must-revalidate" }
    },
    {
      route: "/*",
      rewrite: "/404/index.html",
      statusCode: 404,
      headers: { "cache-control": "no-cache, must-revalidate" }
    }
  ];
  delete config.navigationFallback;
  writeFileSync(configPath, `${JSON.stringify(config)}\n`);
}

function staticSeoPlugin(): Plugin {
  return {
    name: "static-route-seo",
    async closeBundle() {
      const outDir = resolve(process.cwd(), "dist");
      const baseHtml = readFileSync(resolve(outDir, "index.html"), "utf8");
      const snapshot = await loadPrerenderSnapshot();
      for (const path of allStaticSeoPaths()) {
        const metadata = routeMetadataForPath(path);
        if (!metadata) continue;
        const dateModified = prerenderDateForPath(snapshot, path);
        let html = baseHtml
          .replace(/<!-- SEO_HEAD_START -->[\s\S]*?<!-- SEO_HEAD_END -->/u, seoHead(metadata, dateModified))
          .replace(
            /<!-- SEO_BODY_START -->[\s\S]*?<!-- SEO_BODY_END -->/u,
            staticSeoShell(metadata, prerenderContentForPath(snapshot, path))
          );
        if (metadata.pageType === "reference") {
          html = html.replace(/\s*<script type="module"[^>]*src="[^"]+"><\/script>/u, "");
        }
        const outputFile = outputFileForRoute(outDir, path);
        mkdirSync(dirname(outputFile), { recursive: true });
        writeFileSync(outputFile, html);
      }
      const notFound = notFoundMetadata("/404");
      const notFoundFile = outputFileForRoute(outDir, "/404");
      const notFoundHtml = baseHtml
        .replace(/<!-- SEO_HEAD_START -->[\s\S]*?<!-- SEO_HEAD_END -->/u, seoHead(notFound))
        .replace(/<!-- SEO_BODY_START -->[\s\S]*?<!-- SEO_BODY_END -->/u, staticSeoShell(notFound));
      mkdirSync(dirname(notFoundFile), { recursive: true });
      writeFileSync(notFoundFile, notFoundHtml);
      const stocksMetadata = routeMetadataForPath("/stocks");
      if (stocksMetadata) {
        const dynamicStockMetadata = {
          ...stocksMetadata,
          title: "股票 ETF 持股與調倉｜ETF 持倉雷達",
          description: "股票頁會在確認代號與資料來源後顯示 ETF 持股、調倉與各自資料日期。",
          h1: "股票 ETF 持股與調倉",
          intro: "正在確認股票代號與可用資料；未預先產生的動態股票頁不建立搜尋索引。",
          robots: "noindex, nofollow" as const
        };
        const dynamicStockFile = outputFileForRoute(outDir, "/stocks/_dynamic");
        const dynamicStockHtml = baseHtml
          .replace(/<!-- SEO_HEAD_START -->[\s\S]*?<!-- SEO_HEAD_END -->/u, seoHead(dynamicStockMetadata))
          .replace(/<!-- SEO_BODY_START -->[\s\S]*?<!-- SEO_BODY_END -->/u, staticSeoShell(dynamicStockMetadata));
        mkdirSync(dirname(dynamicStockFile), { recursive: true });
        writeFileSync(dynamicStockFile, dynamicStockHtml);
      }
      writeStaticRouteRewrites(outDir);
    }
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: [vue(), appVersionPlugin(), staticSeoPlugin()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:7072",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
