import type { HttpResponseInit } from "@azure/functions";

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
