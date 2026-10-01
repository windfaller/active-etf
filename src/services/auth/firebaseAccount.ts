import type { FirebaseIdTokenClaims } from "./firebaseTokenVerifier.js";

/** Identity-provider account metadata, never callback action or client creation time. */
export async function lookupFirebaseCreation(idToken: string, claims: FirebaseIdTokenClaims): Promise<number | null> {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) return null; // Login remains available; registration is unproven.
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }), signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) return null;
  const data = await response.json() as { users?: Array<{ localId?: string; createdAt?: string; emailVerified?: boolean; disabled?: boolean }> };
  const user = data.users?.[0];
  const createdAt = Number(user?.createdAt);
  if (!user || user.localId !== claims.sub || user.disabled || (claims.email && !user.emailVerified) || !Number.isFinite(createdAt) || createdAt <= 0) return null;
  return createdAt;
}

export function isNewAccountDuringFlow(createdAt: number | null, startedAt: number, now: number): boolean {
  return createdAt !== null && createdAt >= startedAt && createdAt <= now && now - startedAt <= 24 * 60 * 60_000;
}
