import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";

function envFlag(name: string): boolean | null {
  const value = process.env[name];
  if (value === undefined) return null;
  return value.toLowerCase() === "true";
}

function adsEnabled(): boolean {
  return envFlag("ENABLE_ADS") ?? envFlag("VITE_ENABLE_ADS") ?? false;
}

export async function getRuntimeConfig(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: {
      ads: {
        enabled: adsEnabled(),
        trackingEnabled: envFlag("ENABLE_AD_TRACKING") ?? false
      }
    },
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0"
    }
  };
}

app.http("getRuntimeConfig", {
  methods: ["GET"],
  route: "config",
  authLevel: "anonymous",
  handler: getRuntimeConfig
});
