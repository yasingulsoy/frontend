import { SOPHOS_GLOBAL_API } from "./constants";
import type { TenantRow, WhoAmIResponse } from "./types";

async function parseJsonOk<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Sophos API ${res.status}: ${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Geçersiz JSON yanıtı (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function whoami(accessToken: string): Promise<WhoAmIResponse> {
  const res = await fetch(`${SOPHOS_GLOBAL_API}/whoami/v1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return parseJsonOk<WhoAmIResponse>(res);
}

type TenantPage = {
  pages?: { current?: number; total?: number; maxSize?: number };
  items?: Array<{
    id: string;
    name?: string;
    dataRegion?: string;
    apiHost?: string;
  }>;
};

async function fetchAllOrganizationTenants(
  accessToken: string,
  organizationId: string,
): Promise<TenantRow[]> {
  const out: TenantRow[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(`${SOPHOS_GLOBAL_API}/organization/v1/tenants`);
    url.searchParams.set("page", String(page));
    if (page === 1) url.searchParams.set("pageTotal", "true");

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Organization-ID": organizationId,
      },
      cache: "no-store",
    });

    const data = await parseJsonOk<TenantPage>(res);

    const items = data.items ?? [];
    for (const t of items) {
      if (t.id && t.apiHost) {
        out.push({
          id: t.id,
          name: t.name,
          dataRegion: t.dataRegion,
          apiHost: t.apiHost,
        });
      }
    }

    totalPages = data.pages?.total ?? 1;
    page += 1;
  } while (page <= totalPages);

  return out;
}

async function fetchAllPartnerTenants(
  accessToken: string,
  partnerId: string,
): Promise<TenantRow[]> {
  const out: TenantRow[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(`${SOPHOS_GLOBAL_API}/partner/v1/tenants`);
    url.searchParams.set("page", String(page));
    if (page === 1) url.searchParams.set("pageTotal", "true");

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Partner-ID": partnerId,
      },
      cache: "no-store",
    });

    const data = await parseJsonOk<TenantPage>(res);

    const items = data.items ?? [];
    for (const t of items) {
      if (t.id && t.apiHost) {
        out.push({
          id: t.id,
          name: t.name,
          dataRegion: t.dataRegion,
          apiHost: t.apiHost,
        });
      }
    }

    totalPages = data.pages?.total ?? 1;
    page += 1;
  } while (page <= totalPages);

  return out;
}

/**
 * whoami yanıtına göre izlenecek kiracı + bölge API host listesini üretir.
 */
export async function resolveTenants(
  accessToken: string,
  me: WhoAmIResponse,
): Promise<TenantRow[]> {
  const globalHost =
    me.apiHosts?.global ?? `${SOPHOS_GLOBAL_API.replace(/\/$/, "")}`;

  if (me.idType === "organization") {
    return fetchAllOrganizationTenants(accessToken, me.id);
  }

  if (me.idType === "partner") {
    return fetchAllPartnerTenants(accessToken, me.id);
  }

  if (me.idType === "tenant") {
    const envHost = process.env.SOPHOS_TENANT_API_HOST?.trim();
    /** Tenant API’leri (firewall, endpoint, …) bölgesel host üzerinden çalışır. */
    const regional =
      envHost || me.apiHosts?.dataRegion || globalHost;
    return [{ id: me.id, apiHost: regional }];
  }

  throw new Error(
    `Desteklenmeyen whoami idType: ${me.idType}. Organization, partner veya tenant olmalı.`,
  );
}

type KeyPaged<T> = {
  pages?: { nextKey?: string; fromKey?: string };
  items?: T[];
};

/**
 * Sayfa anahtarı ile dolaşan Sophos listeleri için yardımcı (ör. endpoint, firewall).
 */
export async function fetchAllKeyPages<T>(
  urlPath: string,
  accessToken: string,
  tenantId: string,
  apiHost: string,
): Promise<T[]> {
  const base = apiHost.replace(/\/$/, "");
  const out: T[] = [];
  let pageFromKey: string | undefined;

  for (;;) {
    const path = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
    const url = new URL(path, base);
    if (pageFromKey) url.searchParams.set("pageFromKey", pageFromKey);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Tenant-ID": tenantId,
      },
      cache: "no-store",
    });

    const data = await parseJsonOk<KeyPaged<T>>(res);

    const batch = data.items ?? [];
    out.push(...batch);

    const next = data.pages?.nextKey;
    if (!next) break;
    pageFromKey = next;
  }

  return out;
}
