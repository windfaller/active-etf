import { verify as verifySignature } from "node:crypto";

const FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const DEFAULT_FIREBASE_PROJECT_ID = "gogowinners-380206";
const CERT_CACHE_TTL_MS = 55 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 60;

interface FirebaseJwtHeader {
  alg?: string;
  kid?: string;
}

export interface FirebaseIdTokenClaims {
  aud?: string | string[];
  auth_time?: number;
  email?: string;
  email_verified?: boolean;
  exp?: number;
  iat?: number;
  iss?: string;
  name?: string;
  picture?: string;
  sub?: string;
  user_id?: string;
}

export interface FirebaseTokenVerifierOptions {
  fetchCerts?: () => Promise<Record<string, string>>;
  nowSeconds?: number;
  projectId?: string;
}

let certificateCache: { certs: Record<string, string>; expiresAt: number } | null = null;

function decodeJwtPart<T>(part: string): T {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
  } catch {
    throw new Error("Invalid Firebase token encoding.");
  }
}

async function fetchFirebaseCertificates(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certificateCache && certificateCache.expiresAt > now) return certificateCache.certs;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(FIREBASE_CERTS_URL, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Firebase certificate request failed (${response.status}).`);
    const certs = await response.json() as Record<string, string>;
    if (!certs || typeof certs !== "object" || Array.isArray(certs)) {
      throw new Error("Firebase certificate response is invalid.");
    }
    certificateCache = { certs, expiresAt: now + CERT_CACHE_TTL_MS };
    return certs;
  } finally {
    clearTimeout(timeout);
  }
}

function hasExpectedAudience(audience: string | string[] | undefined, projectId: string): boolean {
  return Array.isArray(audience) ? audience.includes(projectId) : audience === projectId;
}

export async function verifyFirebaseIdToken(
  idToken: string,
  options: FirebaseTokenVerifierOptions = {}
): Promise<FirebaseIdTokenClaims> {
  if (!idToken || idToken.length > 10_000) throw new Error("Invalid Firebase token.");

  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Firebase token structure.");
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
  const header = decodeJwtPart<FirebaseJwtHeader>(encodedHeader);
  const claims = decodeJwtPart<FirebaseIdTokenClaims>(encodedPayload);
  const projectId = options.projectId ?? process.env.FIREBASE_PROJECT_ID ?? DEFAULT_FIREBASE_PROJECT_ID;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (header.alg !== "RS256" || !header.kid) throw new Error("Invalid Firebase token header.");
  const certs = await (options.fetchCerts ?? fetchFirebaseCertificates)();
  const certificate = certs[header.kid];
  if (!certificate) throw new Error("Firebase token key is not trusted.");

  const signatureValid = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    certificate,
    Buffer.from(encodedSignature, "base64url")
  );
  if (!signatureValid) throw new Error("Invalid Firebase token signature.");

  if (!hasExpectedAudience(claims.aud, projectId)) throw new Error("Invalid Firebase token audience.");
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("Invalid Firebase token issuer.");
  if (!claims.sub || claims.sub.length > 128) throw new Error("Invalid Firebase user identity.");
  if (claims.user_id && claims.user_id !== claims.sub) throw new Error("Firebase user identity mismatch.");
  if (!Number.isFinite(claims.exp) || (claims.exp as number) <= now - CLOCK_SKEW_SECONDS) {
    throw new Error("Firebase token has expired.");
  }
  if (!Number.isFinite(claims.iat) || (claims.iat as number) > now + CLOCK_SKEW_SECONDS) {
    throw new Error("Invalid Firebase token issue time.");
  }
  if (claims.auth_time !== undefined && (!Number.isFinite(claims.auth_time) || claims.auth_time > now + CLOCK_SKEW_SECONDS)) {
    throw new Error("Invalid Firebase authentication time.");
  }

  return claims;
}

export function clearFirebaseCertificateCache(): void {
  certificateCache = null;
}
