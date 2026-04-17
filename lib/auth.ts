/**
 * Server-only kimlik doğrulama.
 * HMAC-SHA256 ile imzalanmış httpOnly cookie kullanır.
 * Web Crypto API üzerinden çalıştığı için Edge (middleware) ve Node ortamında sorunsuzdur.
 *
 * Not: AUTH_USER / AUTH_PASSWORD / AUTH_SECRET yalnızca server-side env değişkenleridir
 * (NEXT_PUBLIC_ öneki yok), bu yüzden tarayıcı bundle'ına ASLA sızmaz.
 */

export const AUTH_COOKIE = "habbix_auth";
/** 8 saat */
const MAX_AGE_SECONDS = 60 * 60 * 8;

function getSecret(): string {
  return (
    process.env.AUTH_SECRET ??
    "habbix-dev-secret-change-me-in-production-please-!!"
  );
}

function getCredentials(): { user: string; password: string } {
  return {
    user: process.env.AUTH_USER ?? "hkoc",
    password: process.env.AUTH_PASSWORD ?? "hkoc1453",
  };
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

async function hmacSignHex(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return toHex(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;

export async function createSessionToken(user: string): Promise<string> {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${encodeURIComponent(user)}.${exp}`;
  const sig = await hmacSignHex(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<{ user: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userEnc, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = await hmacSignHex(`${userEnc}.${expStr}`);
  if (!timingSafeEqual(expected, sig)) return null;
  return { user: decodeURIComponent(userEnc) };
}

export function checkCredentials(user: string, password: string): boolean {
  const target = getCredentials();
  const u = user.trim();
  return u === target.user && password === target.password;
}
