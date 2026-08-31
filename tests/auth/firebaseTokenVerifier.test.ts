import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyFirebaseIdToken } from "../../src/services/auth/firebaseTokenVerifier.js";

const projectId = "gogowinners-380206";
const now = 1_800_000_000;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicCertificate = publicKey.export({ type: "spki", format: "pem" }).toString();

function token(overrides: Record<string, unknown> = {}, signingKey = privateKey): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    aud: projectId,
    auth_time: now - 30,
    email: "member@example.com",
    email_verified: true,
    exp: now + 3_600,
    iat: now - 30,
    iss: `https://securetoken.google.com/${projectId}`,
    name: "ETF Member",
    sub: "firebase-user-1",
    user_id: "firebase-user-1",
    ...overrides
  })).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), signingKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

const options = {
  projectId,
  nowSeconds: now,
  fetchCerts: async () => ({ "test-key": publicCertificate })
};

describe("Firebase ID token verifier", () => {
  it("verifies the central GoGoWinners Firebase issuer, audience, claims, and signature", async () => {
    await expect(verifyFirebaseIdToken(token(), options)).resolves.toMatchObject({
      sub: "firebase-user-1",
      email: "member@example.com",
      email_verified: true
    });
  });

  it("rejects a token for another Firebase project", async () => {
    await expect(verifyFirebaseIdToken(token({ aud: "another-project" }), options)).rejects.toThrow("audience");
  });

  it("rejects expired and incorrectly signed tokens", async () => {
    await expect(verifyFirebaseIdToken(token({ exp: now - 120 }), options)).rejects.toThrow("expired");
    const otherKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    await expect(verifyFirebaseIdToken(token({}, otherKey), options)).rejects.toThrow("signature");
  });
});
