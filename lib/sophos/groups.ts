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

export type FirewallGroup = {
  id: string;
  name: string;
  parentGroup?: { id: string; name?: string };
  firewalls?: {
    total?: number;
    itemsCount?: number;
    items?: Array<{ id: string }>;
  };
  lockedByManagingAccount?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * GET /firewall/v1/firewall-groups (sayfalı, numara tabanlı)
 */
export async function listFirewallGroups(
  accessToken: string,
  tenant: TenantRow,
): Promise<FirewallGroup[]> {
  const base = tenant.apiHost.replace(/\/$/, "");
  const out: FirewallGroup[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL("/firewall/v1/firewall-groups", base);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("recurseSubgroups", "true");
    if (page === 1) url.searchParams.set("pageTotal", "true");

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Tenant-ID": tenant.id,
      },
      cache: "no-store",
    });

    const data = await parseJsonOk<{
      items?: FirewallGroup[];
      pages?: { current?: number | string; total?: number | string };
    }>(res);

    out.push(...(data.items ?? []));

    totalPages = Number(data.pages?.total ?? 1) || 1;
    page += 1;
  } while (page <= totalPages);

  return out;
}
