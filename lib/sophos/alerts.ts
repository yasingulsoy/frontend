import type { TenantRow } from "./types";

async function parseJsonOk<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Sophos API ${res.status}: ${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Geçersiz JSON: ${text.slice(0, 200)}`);
  }
}

export type CentralAlert = {
  id: string;
  description?: string;
  category?: string;
  product?: string;
  severity?: "low" | "medium" | "high" | string;
  type?: string;
  raisedAt?: string;
  managedAgent?: {
    id?: string;
    type?: string;
    name?: string;
  };
  tenant?: { id?: string; name?: string };
  allowedActions?: string[];
};

type AlertsOpts = {
  from?: string;
  product?: string;
  severity?: string;
  maxPages?: number;
};

/**
 * GET /common/v1/alerts (key-based pagination)
 */
export async function listAlertsForTenant(
  accessToken: string,
  tenant: TenantRow,
  opts: AlertsOpts = {},
): Promise<CentralAlert[]> {
  const base = tenant.apiHost.replace(/\/$/, "");
  const out: CentralAlert[] = [];
  let pageFromKey: string | undefined;
  const maxPages = opts.maxPages ?? 2;
  let fetched = 0;

  for (;;) {
    const url = new URL("/common/v1/alerts", base);
    url.searchParams.set("pageSize", "200");
    if (pageFromKey) url.searchParams.set("pageFromKey", pageFromKey);
    if (opts.from) url.searchParams.set("from", opts.from);
    if (opts.product) url.searchParams.set("product", opts.product);
    if (opts.severity) url.searchParams.set("severity", opts.severity);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Tenant-ID": tenant.id,
      },
      cache: "no-store",
    });

    const data = await parseJsonOk<{
      items?: CentralAlert[];
      pages?: { nextKey?: string };
    }>(res);

    out.push(...(data.items ?? []));
    fetched += 1;

    const next = data.pages?.nextKey;
    if (!next || fetched >= maxPages) break;
    pageFromKey = next;
  }

  return out;
}
