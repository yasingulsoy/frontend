import { fetchAccessToken } from "./auth";
import { resolveTenants, whoami } from "./client";
import type { TenantRow, WhoAmIResponse } from "./types";

export type Session = {
  token: string;
  me: WhoAmIResponse;
  tenants: TenantRow[];
};

let cache: { at: number; value: Session } | null = null;
/** Token ömrü 1 saat; 50 dk cache yeterli. */
const TTL_MS = 50 * 60 * 1000;

export async function getSession(): Promise<Session> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;

  const clientId = process.env.SOPHOS_CLIENT_ID;
  const clientSecret = process.env.SOPHOS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Eksik ortam değişkeni: SOPHOS_CLIENT_ID ve SOPHOS_CLIENT_SECRET (.env)",
    );
  }

  const token = await fetchAccessToken(clientId, clientSecret);
  const me = await whoami(token);
  const tenants = await resolveTenants(token, me);

  cache = { at: now, value: { token, me, tenants } };
  return cache.value;
}

export function clearSessionCache() {
  cache = null;
}
