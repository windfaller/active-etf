import "dotenv/config";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AgentStore } from "./store.js";
import { createAgentApp } from "./server.js";
import { createResearchProvider } from "./data.js";
import { getDb, closeDb } from "../db/mongo.js";
import { verifyFirebaseIdToken } from "../services/auth/firebaseTokenVerifier.js";

const port = Number(process.env.MCP_PORT ?? 7075);
const origin = process.env.MCP_PUBLIC_ORIGIN ?? `http://127.0.0.1:${port}`;
const parsed = new URL(origin);
const releaseStage = process.env.MCP_RELEASE_STAGE ?? "test";
if (!["test", "production"].includes(releaseStage))
  throw new Error("Invalid MCP_RELEASE_STAGE");
if (
  releaseStage === "production" &&
  (!process.env.MCP_PUBLIC_ORIGIN ||
    parsed.protocol !== "https:" ||
    parsed.hostname.endsWith(".trycloudflare.com"))
)
  throw new Error(
    "Production requires an explicitly configured stable HTTPS origin",
  );
if (
  parsed.origin !== origin ||
  (parsed.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(parsed.hostname))
)
  throw new Error(
    "MCP_PUBLIC_ORIGIN must be an HTTPS origin (HTTP loopback allowed locally)",
  );
const file = resolve(
  process.env.MCP_STATE_PATH ?? ".agent-state/member-mcp.sqlite",
);
mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
const store = new AgentStore(file);
chmodSync(file, 0o600);
const allowed = process.env.MCP_BETA_MEMBER_IDS?.split(",")
  .map((x) => x.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === "production" && !process.env.MCP_STATE_PATH)
  throw new Error("Set MCP_STATE_PATH to a persistent volume");
const app = createAgentApp({
  releaseStage: releaseStage as "test" | "production",
  origin,
  store,
  verifyIdentity: verifyFirebaseIdToken,
  allowedMembers: allowed?.length ? new Set(allowed) : undefined,
  provider: createResearchProvider(getDb),
  webRoot: resolve("dist"),
});
const server = app.listen(port, process.env.MCP_BIND_HOST ?? "127.0.0.1", () =>
  console.log(`Member MCP listening on ${origin}/mcp`),
);
const timer = setInterval(() => store.cleanup(), 60_000);
timer.unref();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      clearInterval(timer);
      store.close();
      void closeDb().finally(() => process.exit(0));
    });
  });
