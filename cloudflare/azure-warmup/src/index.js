const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const USER_AGENT = "shared-cloudflare-warmup/1.1";
const ACTIVE_ETF_PUBLIC_API_REQUESTS = [
  {
    name: "active-etf-market-bootstrap",
    path: "/api/market/bootstrap",
    query: { limit: "60" }
  },
  {
    name: "active-etf-signals",
    path: "/api/signals",
    query: { kind: "all", window: "20", limit: "30" }
  },
  {
    name: "active-etf-comparison",
    path: "/api/compare/etfs",
    query: { type: "tw", codes: "00981A,00982A" }
  },
  {
    name: "active-etf-style",
    path: "/api/etf/00981A/style",
    query: { window: "20" }
  }
];

export function healthCheckUrl(baseUrl, scheduledTime) {
  const url = new URL(baseUrl);
  url.searchParams.set("source", "cloudflare-warmup");
  url.searchParams.set("ts", String(scheduledTime));
  return url.toString();
}

export function publicApiWarmupTargets(baseUrl) {
  return ACTIVE_ETF_PUBLIC_API_REQUESTS.map((request) => {
    const url = new URL(request.path, baseUrl);
    for (const [key, value] of Object.entries(request.query)) url.searchParams.set(key, value);
    return {
      name: request.name,
      url: url.toString(),
      method: "GET",
      headers: { "user-agent": USER_AGENT }
    };
  });
}

function warmupTargets(env, scheduledTime) {
  return [
    {
      name: "active-etf",
      url: env.WARMUP_URL,
      method: "POST",
      headers: env.WARMUP_TOKEN
        ? { "x-warmup-token": env.WARMUP_TOKEN, "user-agent": USER_AGENT }
        : null
    },
    {
      name: "forvix-staging",
      url: env.FORVIX_STAGING_HEALTH_URL
        ? healthCheckUrl(env.FORVIX_STAGING_HEALTH_URL, scheduledTime)
        : null,
      method: "GET",
      headers: { "user-agent": USER_AGENT }
    },
    {
      name: "forvix-production",
      url: env.FORVIX_PRODUCTION_HEALTH_URL
        ? healthCheckUrl(env.FORVIX_PRODUCTION_HEALTH_URL, scheduledTime)
        : null,
      method: "GET",
      headers: { "user-agent": USER_AGENT }
    },
    ...publicApiWarmupTargets(env.ACTIVE_ETF_PUBLIC_BASE_URL)
  ];
}

async function drainResponseBody(response) {
  if (!response.body) return 0;
  const reader = response.body.getReader();
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return bytes;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel("warmup response exceeded bounded size");
      throw new Error(`warmup response exceeded ${MAX_RESPONSE_BYTES} bytes`);
    }
  }
}

async function warmTarget(target, controller) {
  const startedAt = Date.now();

  try {
    if (!target.url) throw new Error(`${target.name} warmup URL is required`);
    if (!target.headers) throw new Error(`${target.name} warmup token is required`);

    const response = await fetch(target.url, {
      method: target.method,
      headers: target.headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    const responseBytes = await drainResponseBody(response);
    const result = {
      event: "warmup-target",
      name: target.name,
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString(),
      status: response.status,
      responseBytes,
      durationMs: Date.now() - startedAt
    };

    console.log(JSON.stringify(result));
    if (!response.ok) throw new Error(`${target.name} returned HTTP ${response.status}`);
    return result;
  } catch (error) {
    console.error(JSON.stringify({
      event: "warmup-target-error",
      name: target.name,
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString(),
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    }));
    throw error;
  }
}

export default {
  async scheduled(controller, env) {
    const startedAt = Date.now();
    const targets = warmupTargets(env, controller.scheduledTime);
    const results = await Promise.allSettled(targets.map((target) => warmTarget(target, controller)));
    const failedNames = results.flatMap((result, index) =>
      result.status === "rejected" ? [targets[index].name] : []
    );

    console.log(JSON.stringify({
      event: "azure-warmup",
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString(),
      targetCount: targets.length,
      successCount: targets.length - failedNames.length,
      failureCount: failedNames.length,
      durationMs: Date.now() - startedAt
    }));

    if (failedNames.length) {
      throw new Error(`Warmup failed for: ${failedNames.join(", ")}`);
    }
  }
};
