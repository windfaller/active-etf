import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { hasVerifiedMemberSession } from "../services/auth/memberSession.js";
import { jsonResponse } from "./response.js";

export interface MemberRequestAccess {
  authenticated: boolean;
}

export async function memberRequestAccess(request: HttpRequest): Promise<MemberRequestAccess> {
  return { authenticated: await hasVerifiedMemberSession(request) };
}

export function memberJsonResponse(jsonBody: unknown, status = 200): HttpResponseInit {
  return jsonResponse(jsonBody, status, {
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    Vary: "Cookie"
  });
}
