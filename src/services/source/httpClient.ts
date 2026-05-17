import { withRetry } from "../../utils/retry.js";

export interface SourceFetchInput {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface SourceFetchResult {
  url: string;
  method: "GET" | "POST";
  requestHeaders: Record<string, string>;
  requestBody?: string;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  rawContentType: string;
  rawBody: string;
}

export function defaultCrawlerHeaders(referer = "https://www.ezmoney.com.tw/"): Record<string, string> {
  return {
    "User-Agent":
      process.env.CRAWLER_USER_AGENT ??
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
    Accept: "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    Referer: referer,
    "Cache-Control": "no-cache"
  };
}

export async function fetchSource(input: SourceFetchInput): Promise<SourceFetchResult> {
  const method = input.method ?? "GET";
  const timeoutMs = input.timeoutMs ?? Number(process.env.CRAWLER_TIMEOUT_MS ?? 30000);
  const headers = { ...defaultCrawlerHeaders(), ...input.headers };

  return withRetry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input.url, {
        method,
        headers,
        body: input.body,
        signal: controller.signal,
        redirect: "follow"
      });

      const rawBody = await response.text();
      return {
        url: input.url,
        method,
        requestHeaders: headers,
        requestBody: input.body,
        responseStatus: response.status,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        rawContentType: response.headers.get("content-type") ?? "",
        rawBody
      };
    } finally {
      clearTimeout(timeout);
    }
  });
}
