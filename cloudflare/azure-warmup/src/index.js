export default {
  async scheduled(controller, env) {
    const startedAt = Date.now();

    if (!env.WARMUP_TOKEN) {
      throw new Error("WARMUP_TOKEN secret is required");
    }

    const response = await fetch(env.WARMUP_URL, {
      method: "POST",
      headers: {
        "x-warmup-token": env.WARMUP_TOKEN,
        "user-agent": "active-etf-cloudflare-warmup/1.0"
      },
      signal: AbortSignal.timeout(20_000)
    });

    console.log(JSON.stringify({
      event: "azure-warmup",
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString(),
      status: response.status,
      durationMs: Date.now() - startedAt
    }));

    if (!response.ok) {
      throw new Error(`Azure warmup returned HTTP ${response.status}`);
    }
  }
};
