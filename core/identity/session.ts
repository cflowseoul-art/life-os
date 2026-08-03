/**
 * Sessions.
 *
 * A signed, stateless cookie: the server can verify it on any instance without
 * shared memory, which is what multiple devices and a serverless deployment
 * both require. Nothing secret is stored in it — only ids that are useless
 * without the signature.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import type { Session } from "./types.ts";

export const SESSION_COOKIE = "lifeos_session";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET이 없거나 너무 짧습니다 (32자 이상).");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueSession(userId: string, householdId: string, now = Date.now()): string {
  const session: Session = {
    userId,
    householdId,
    issuedAt: now,
    expiresAt: now + THIRTY_DAYS,
  };

  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the session only when the signature and expiry both hold. */
export function readSession(token: string | undefined, now = Date.now()): Session | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    return session.expiresAt > now ? session : null;
  } catch {
    return null;
  }
}

/** httpOnly · SameSite=Lax · Secure outside development. Survives refresh. */
export function sessionCookie(token: string, secure = process.env.NODE_ENV === "production"): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${String(THIRTY_DAYS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearedCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function cookieValue(header: string | undefined, name: string): string | undefined {
  return header
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];
}
