import { createHash, randomBytes } from "node:crypto";
export const secret = () => randomBytes(32).toString("base64url");
export const hash = (s: string) =>
  createHash("sha256").update(s).digest("base64url");
export const quotaDay = (now = Date.now()) =>
  new Date(now + 8 * 3600_000).toISOString().slice(0, 10);
export const resetAt = (now = Date.now()) =>
  new Date(
    Date.parse(`${quotaDay(now)}T00:00:00+08:00`) + 86400_000,
  ).toISOString();
export class AgentError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export interface Usage {
  plan: string;
  dailyLimit: number;
  used: number;
  reserved: number;
  remaining: number;
  resetsAt: string;
  timezone: string;
}
type Maybe<T> = T | Promise<T>;
export interface AgentStorage {
  readonly dailyLimit: number;
  put(kind: string, key: string, value: unknown, ttlMs: number): Maybe<void>;
  get<T>(kind: string, key: string): Maybe<T | null>;
  remove(kind: string, key: string): Maybe<void>;
  take<T>(kind: string, key: string): Maybe<T | null>;
  rate(key: string, limit: number, windowMs?: number): Maybe<void>;
  usage(member: string): Maybe<Usage>;
  reserve(
    member: string,
    fingerprint: string,
    cost: number,
  ): Maybe<{ id: string; cached?: Record<string, unknown> }>;
  complete(
    id: string,
    result: Record<string, unknown>,
    charge?: boolean,
  ): Maybe<void>;
  release(id: string): Maybe<void>;
  revokeMember(member: string): Maybe<void>;
}
