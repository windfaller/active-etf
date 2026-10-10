import { createClient } from "@redis/client";

export type RedisValue = string | number | null;
interface RedisConfig {
  host: string;
  port: number;
  key: string;
  commandTimeoutMs: number;
}
type Client = ReturnType<typeof createClient<{}, {}, {}, 2>>;
interface RedisConnection {
  config: RedisConfig;
  client: Client;
  ready: Promise<Client>;
  pending: number;
}
let connection: RedisConnection | null = null;
let redisUnavailableUntil = 0;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getRedisConfig(): RedisConfig | null {
  const host = process.env.REDIS_GOGOWINNERS_HOST;
  const key = process.env.REDIS_GOGOWINNERS_KEY;
  const port = positiveInteger(process.env.REDIS_GOGOWINNERS_PORT, 6380);
  if (!host || !key || port > 65535) return null;
  return { host, port, key, commandTimeoutMs: positiveInteger(process.env.REDIS_COMMAND_TIMEOUT_MS, 800) };
}

export function hasRedisConfiguration(): boolean {
  return getRedisConfig() !== null;
}

export function isRedisConfigured(): boolean {
  return hasRedisConfiguration() && Date.now() >= redisUnavailableUntil;
}

function retire(client: Client): void {
  if (connection?.client === client) {
    connection = null;
    redisUnavailableUntil = Date.now() + positiveInteger(process.env.REDIS_FAILURE_COOLDOWN_MS, 60000);
  }
  if (client.isOpen) client.destroy();
}

async function bounded<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Redis command timed out")), milliseconds);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function connected(config: RedisConfig): Promise<RedisConnection> {
  if (connection && (connection.config.host !== config.host || connection.config.port !== config.port || connection.config.key !== config.key || connection.config.commandTimeoutMs !== config.commandTimeoutMs)) {
    const previous = connection;
    connection = null;
    if (previous.client.isOpen) previous.client.destroy();
  }
  if (!connection) {
    const client = createClient({
      RESP: 2,
      password: config.key,
      socket: { host: config.host, port: config.port, tls: true, servername: config.host, connectTimeout: config.commandTimeoutMs, reconnectStrategy: false },
      disableOfflineQueue: true,
      commandsQueueMaxLength: 256,
      commandOptions: { timeout: config.commandTimeoutMs }
    });
    client.on("error", () => retire(client));
    const state: RedisConnection = {
      config,
      client,
      pending: 0,
      ready: Promise.resolve().then(async () => {
        try {
          await bounded(client.connect(), config.commandTimeoutMs);
          return client;
        } catch (error) {
          retire(client);
          throw error;
        }
      })
    };
    connection = state;
  }
  const state = connection;
  await state.ready;
  return state;
}

export async function runRedisCommands(commands: string[][]): Promise<RedisValue[]> {
  const config = getRedisConfig();
  if (!config) throw new Error("Redis is not configured");
  if (Date.now() < redisUnavailableUntil) throw new Error("Redis is temporarily disabled after a connection failure");
  const state = await connected(config);
  state.pending++;
  state.client.ref();
  try {
    return await Promise.all(commands.map((command) => state.client.sendCommand<RedisValue>(command, { timeout: config.commandTimeoutMs })));
  } catch (error) {
    retire(state.client);
    throw error;
  } finally {
    state.pending--;
    // Keep requests alive, but let short-lived CLI jobs exit with an idle cache.
    if (state.pending === 0 && state.client.isOpen) state.client.unref();
  }
}

export async function redisGet(key: string): Promise<string | null> {
  const [value] = await runRedisCommands([["GET", key]]);
  return typeof value === "string" ? value : null;
}

export async function redisSetEx(key: string, ttlSeconds: number, value: string): Promise<void> {
  await runRedisCommands([["SETEX", key, String(ttlSeconds), value]]);
}

export async function redisDel(keys: string[]): Promise<void> {
  if (keys.length) await runRedisCommands([["DEL", ...keys]]);
}

export function closeRedis(): void {
  const previous = connection;
  connection = null;
  redisUnavailableUntil = 0;
  if (previous?.client.isOpen) previous.client.destroy();
}
