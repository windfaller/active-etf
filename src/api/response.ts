import type { HttpResponseInit } from "@azure/functions";

export interface ServerTimingMetric {
  name: string;
  duration?: number;
  description?: string;
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): HttpResponseInit {
  return {
    status,
    jsonBody: body,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  };
}

export function cachedJsonResponse(body: unknown, maxAgeSeconds = 300): HttpResponseInit {
  return jsonResponse(body, 200, {
    "Cache-Control": `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${Math.max(60, maxAgeSeconds * 2)}`
  });
}

export function edgeCachedJsonResponse(
  body: unknown,
  browserMaxAgeSeconds = 30,
  edgeMaxAgeSeconds = 180
): HttpResponseInit {
  return jsonResponse(body, 200, {
    "Cache-Control": [
      "public",
      `max-age=${browserMaxAgeSeconds}`,
      `s-maxage=${edgeMaxAgeSeconds}`,
      `stale-while-revalidate=${Math.max(60, edgeMaxAgeSeconds * 2)}`
    ].join(", ")
  });
}

export function withServerTiming(response: HttpResponseInit, metrics: ServerTimingMetric[]): HttpResponseInit {
  const value = metrics.map((metric) => {
    const name = metric.name.replace(/[^a-zA-Z0-9_-]/gu, "-");
    const duration = metric.duration === undefined
      ? ""
      : `;dur=${Math.max(0, Math.round(metric.duration * 10) / 10)}`;
    const description = metric.description === undefined
      ? ""
      : `;desc="${metric.description.replace(/["\\]/gu, "")}"`;
    return `${name}${duration}${description}`;
  }).join(", ");
  const headers = new Headers(response.headers);
  headers.set("Server-Timing", value);
  return { ...response, headers: Object.fromEntries(headers.entries()) };
}

export function notFound(message: string): HttpResponseInit {
  return jsonResponse({ error: message }, 404);
}

export function badRequest(message: string): HttpResponseInit {
  return jsonResponse({ error: message }, 400);
}

export function unauthorized(message = "Unauthorized"): HttpResponseInit {
  return jsonResponse({ error: message }, 401);
}

export function serverError(message = "Server configuration error"): HttpResponseInit {
  return jsonResponse({ error: message }, 500);
}
