import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { createAuth, json, requestBody, type AuthOptions } from "./auth.js";
import { AgentError, hash } from "./core.js";
import {
  toolDefinitions,
  type ResearchProvider,
  type ToolName,
} from "./data.js";
export interface AgentOptions extends AuthOptions {
  provider: ResearchProvider;
  releaseStage?: "test" | "production";
  requestTimeoutMs?: number;
}
export function createAgentHandler(options: AgentOptions) {
  const { origin, store } = options,
    auth = createAuth(options),
    prefix = options.apiPrefix ?? "";
  return async (req: Request, ip = "unknown"): Promise<Response> => {
    let response: Response;
    try {
      const incoming = req.headers.get("origin");
      if (incoming && incoming !== origin)
        throw new AgentError("invalid_origin", 403);
      const path = new URL(req.url).pathname;
      if (req.method === "OPTIONS")
        response = new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, MCP-Protocol-Version, X-CSRF-Token",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          },
        });
      else if (req.method === "GET" && path === "/api/agent/config")
        response = json({
          mcpUrl: auth.resource,
          releaseStage: options.releaseStage ?? "test",
          dailyLimit: store.dailyLimit,
          scope: "active_etf:read",
        });
      else if (
        req.method === "GET" &&
        [prefix + "/healthz", "/api/mcp-health"].includes(path)
      )
        response = json({
          status: "ok",
          service: "active-etf-member-mcp",
          version: "0.2.0",
          storage: prefix === "/api" ? "mongodb" : "local",
        });
      else if (path === prefix + "/mcp") {
        let member: string;
        try {
          member = await auth.authenticate(req);
        } catch (e) {
          if (!(e instanceof AgentError)) throw e;
          return json({ error: "invalid_token" }, 401, {
            "Cache-Control": "no-store",
            "WWW-Authenticate": `Bearer resource_metadata="${auth.protectedMetadata}", scope="active_etf:read"`,
          });
        }
        if (req.method !== "POST")
          return new Response(null, {
            status: 405,
            headers: { Allow: "POST", "Cache-Control": "no-store" },
          });
        const body = await requestBody(req);
        const server = new McpServer(
          { name: "active-etf-research", version: "0.2.0" },
          {
            instructions:
              "Read-only Taiwan-listed ETF research. Check source dates and missing observations. Free members share 20 daily points across clients. Respond in the user language. No trades or advertisements.",
          },
        );
        for (const name of Object.keys(toolDefinitions) as ToolName[]) {
          const tool = toolDefinitions[name];
          server.registerTool(
            name,
            {
              description: tool.description,
              inputSchema: tool.schema.shape,
              annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
              },
            },
            async (raw: Record<string, unknown>) => {
              let reservation = "";
              let timer: ReturnType<typeof setTimeout> | undefined;
              const result = (
                data: Record<string, unknown>,
                isError = false,
              ) => ({
                content: [
                  { type: "text" as const, text: JSON.stringify(data) },
                ],
                structuredContent: data,
                ...(isError ? { isError: true } : {}),
              });
              try {
                await store.rate("member:" + member, 20);
                const args = tool.schema.parse(raw) as Record<string, unknown>;
                if (name === "get_my_plan_usage")
                  return result({ ...(await store.usage(member)) });
                const job = await store.reserve(
                  member,
                  hash(JSON.stringify([name, args])),
                  tool.cost,
                );
                reservation = job.id;
                if (job.cached)
                  return result({
                    ...job.cached,
                    pointsCharged: 0,
                    cacheHit: true,
                  });
                const dataResult = await Promise.race([
                  options.provider(name, args),
                  new Promise<never>((_, reject) => {
                    timer = setTimeout(
                      () => reject(new AgentError("query_timeout", 503)),
                      options.requestTimeoutMs ?? 25000,
                    );
                  }),
                ]);
                const data = {
                  ...dataResult.data,
                  hasData: dataResult.hasData,
                  pointsCharged: dataResult.hasData ? tool.cost : 0,
                };
                if (Buffer.byteLength(JSON.stringify(data)) > 1_500_000)
                  throw new AgentError("result_too_large_use_shorter_period");
                await store.complete(reservation, data, dataResult.hasData);
                return result(data);
              } catch (e) {
                if (reservation) await store.release(reservation);
                return result(
                  {
                    error:
                      e instanceof AgentError
                        ? e.code
                        : e instanceof z.ZodError
                          ? "invalid_arguments"
                          : "temporarily_unavailable",
                    ...(await store.usage(member)),
                  },
                  true,
                );
              } finally {
                if (timer) clearTimeout(timer);
              }
            },
          );
        }
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        try {
          await server.connect(transport);
          const sdkResponse = await transport.handleRequest(req, {
            parsedBody: body,
          });
          response = new Response(await sdkResponse.arrayBuffer(), {
            status: sdkResponse.status,
            headers: sdkResponse.headers,
          });
        } finally {
          await transport.close();
          await server.close();
        }
      } else
        response =
          (await auth.handle(req, ip)) ?? json({ error: "not_found" }, 404);
    } catch (e) {
      response = json(
        {
          error:
            e instanceof AgentError
              ? e.code
              : e instanceof z.ZodError
                ? "invalid_request"
                : "temporarily_unavailable",
        },
        e instanceof AgentError
          ? e.status
          : e instanceof z.ZodError
            ? 400
            : 503,
      );
    }
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    return response;
  };
}
