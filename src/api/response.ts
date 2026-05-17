import type { HttpResponseInit } from "@azure/functions";

export function jsonResponse(body: unknown, status = 200): HttpResponseInit {
  return {
    status,
    jsonBody: body,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  };
}

export function badRequest(message: string): HttpResponseInit {
  return jsonResponse({ error: message }, 400);
}
