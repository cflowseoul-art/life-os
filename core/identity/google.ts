/**
 * Google Sign-In verification.
 *
 * Verifies the ID token Google gave the browser: signature against Google's
 * published keys, issuer, audience, and expiry. Nothing about Google leaves
 * this file — callers receive a plain claim set.
 *
 * Deliberately dependency-free so it runs unchanged on a Node serverless
 * runtime. When `google-auth-library` is available in the deployment, this
 * module is the single place to swap it in (see MIGRATION note in the report).
 */

import { createPublicKey, createVerify } from "node:crypto";

const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export type GoogleIdentity = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
};

type Jwk = { kid: string; n: string; e: string; kty: string; alg?: string };

let cache: { keys: Jwk[]; until: number } | null = null;

async function keys(): Promise<Jwk[]> {
  if (cache && cache.until > Date.now()) return cache.keys;

  const response = await fetch(JWKS_URL);
  if (!response.ok) throw new Error("구글 인증 키를 가져오지 못했습니다.");

  const body = (await response.json()) as { keys: Jwk[] };
  const maxAge = /max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1];

  cache = { keys: body.keys, until: Date.now() + Number(maxAge ?? 3600) * 1000 };
  return body.keys;
}

function decode(part: string): Buffer {
  return Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Verifies an ID token and returns who it says the user is.
 *
 * Throws on anything unverified. There is no "trust the payload" path, and no
 * development bypass — a token that cannot be checked is not an identity.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const [headerPart, payloadPart, signaturePart] = idToken.split(".");
  if (!headerPart || !payloadPart || !signaturePart) throw new Error("토큰 형식이 올바르지 않습니다.");

  const header = JSON.parse(decode(headerPart).toString("utf8")) as { kid: string; alg: string };
  if (header.alg !== "RS256") throw new Error("지원하지 않는 서명 방식입니다.");

  const jwk = (await keys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("서명 키를 찾지 못했습니다.");

  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const verified = createVerify("RSA-SHA256")
    .update(`${headerPart}.${payloadPart}`)
    .verify(publicKey, decode(signaturePart));

  if (!verified) throw new Error("서명이 유효하지 않습니다.");

  const claims = JSON.parse(decode(payloadPart).toString("utf8")) as {
    iss: string; aud: string; sub: string; exp: number;
    email?: string; email_verified?: boolean; name?: string;
  };

  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) throw new Error("GOOGLE_CLIENT_ID가 설정되지 않았습니다.");
  if (claims.aud !== audience) throw new Error("다른 앱을 위한 토큰입니다.");
  if (!ISSUERS.includes(claims.iss)) throw new Error("발급자가 구글이 아닙니다.");
  if (claims.exp * 1000 < Date.now()) throw new Error("만료된 토큰입니다.");

  return {
    googleId: claims.sub,
    email: claims.email ?? "",
    emailVerified: claims.email_verified === true,
    displayName: claims.name ?? claims.email ?? "대표님",
  };
}
