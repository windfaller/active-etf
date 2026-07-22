import { connect as connectTls, type TLSSocket } from "node:tls";

export type RedisValue = string | number | null;

interface RedisConfig {
  host: string;
  port: number;
  key: string;
  commandTimeoutMs: number;
}

let redisUnavailableUntil = 0;

function getRedisConfig(): RedisConfig | null {
  const host = process.env.REDIS_GOGOWINNERS_HOST;
  const port = Number(process.env.REDIS_GOGOWINNERS_PORT ?? 6380);
  const key = process.env.REDIS_GOGOWINNERS_KEY;

  if (!host || !key || !Number.isFinite(port)) return null;

  return {
    host,
    port,
    key,
    commandTimeoutMs: Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 800)
  };
}

export function isRedisConfigured(): boolean {
  return hasRedisConfiguration() && Date.now() >= redisUnavailableUntil;
}

export function hasRedisConfiguration(): boolean {
  return getRedisConfig() !== null;
}

function encodeCommand(parts: string[]): string {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join("")}`;
}

function parseRedisValue(buffer: Buffer, offset = 0): { value: RedisValue; offset: number } {
  const prefix = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf("\r\n", offset);
  if (lineEnd === -1) throw new Error("Incomplete Redis response");

  const line = buffer.toString("utf8", offset + 1, lineEnd);
  const nextOffset = lineEnd + 2;

  if (prefix === "+") return { value: line, offset: nextOffset };
  if (prefix === ":") return { value: Number(line), offset: nextOffset };
  if (prefix === "-") throw new Error(`Redis error: ${line}`);

  if (prefix === "$") {
    const length = Number(line);
    if (length === -1) return { value: null, offset: nextOffset };

    const valueEnd = nextOffset + length;
    if (buffer.length < valueEnd + 2) throw new Error("Incomplete Redis bulk string");
    return {
      value: buffer.toString("utf8", nextOffset, valueEnd),
      offset: valueEnd + 2
    };
  }

  throw new Error(`Unsupported Redis response prefix: ${prefix}`);
}

function parseRedisResponses(buffer: Buffer, count: number): RedisValue[] {
  const values: RedisValue[] = [];
  let offset = 0;

  while (values.length < count) {
    const parsed = parseRedisValue(buffer, offset);
    values.push(parsed.value);
    offset = parsed.offset;
  }

  return values;
}

function expectedResponseCount(commands: string[][]): number {
  return commands.length + 1;
}

export async function runRedisCommands(commands: string[][]): Promise<RedisValue[]> {
  const config = getRedisConfig();
  if (!config) throw new Error("Redis is not configured");
  if (Date.now() < redisUnavailableUntil) throw new Error("Redis is temporarily disabled after a connection failure");

  const allCommands = [["AUTH", config.key], ...commands];

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    const socket = connectTls({
      host: config.host,
      port: config.port,
      servername: config.host
    });

    const timeout = setTimeout(() => {
      finish(new Error("Redis command timed out"));
    }, config.commandTimeoutMs);

    function finish(error?: Error): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error) {
        redisUnavailableUntil = Date.now() + Number(process.env.REDIS_FAILURE_COOLDOWN_MS ?? 60000);
        reject(error);
      }
    }

    socket.on("secureConnect", () => {
      socket.write(allCommands.map(encodeCommand).join(""));
    });

    socket.on("data", (chunk) => {
      chunks.push(chunk);
      try {
        const responses = parseRedisResponses(Buffer.concat(chunks), expectedResponseCount(commands));
        finish();
        resolve(responses.slice(1));
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Incomplete Redis")) return;
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });

    socket.on("error", (error) => {
      finish(error);
    });
  });
}

export async function redisGet(key: string): Promise<string | null> {
  const [value] = await runRedisCommands([["GET", key]]);
  return typeof value === "string" ? value : null;
}

export async function redisSetEx(key: string, ttlSeconds: number, value: string): Promise<void> {
  await runRedisCommands([["SETEX", key, String(ttlSeconds), value]]);
}

export async function redisDel(keys: string[]): Promise<void> {
  if (!keys.length) return;
  await runRedisCommands([["DEL", ...keys]]);
}
