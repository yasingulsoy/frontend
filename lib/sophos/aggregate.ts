import type { FirewallRecord } from "./firewalls";
import { listFirewallsForTenant } from "./firewalls";
import { getSession } from "./session";
import type { TenantRow } from "./types";
import type { WanMapEntry } from "./wan-map";
import { findMapping, loadWanMap } from "./wan-map";

export type WanSide = {
  configuredIp?: string;
  seen?: boolean;
};

export type EnrichedFirewall = {
  tenantId: string;
  id: string;
  hostname: string;
  name: string | null;
  serialNumber: string | null;
  model: string | null;
  firmwareVersion: string | null;
  connected: boolean;
  suspended: boolean;
  managing: string | null;
  externalIpv4Addresses: string[];
  stateChangedAt: string | null;
  clusterMode: string | null;
  groupId: string | null;
  groupName: string | null;
  wan: {
    main: WanSide;
    backup: WanSide;
    hasMapping: boolean;
    notes?: string;
  };
  raw: FirewallRecord;
};

export type TenantFirewalls = {
  tenant: {
    id: string;
    name: string | null;
    dataRegion: string | null;
    apiHost: string;
  };
  count: number;
  firewalls: EnrichedFirewall[];
};

export type FirewallDashboardPayload =
  | {
      ok: true;
      whoami: { id: string; idType: string };
      summary: {
        tenantCount: number;
        firewallCount: number;
        connectedCount: number;
        offlineCount: number;
        suspendedCount: number;
      };
      data: TenantFirewalls[];
    }
  | { ok: false; error: string; code: "missing_env" | "upstream" };

function enrich(
  fw: FirewallRecord,
  tenantId: string,
): EnrichedFirewall {
  const map = loadWanMap();
  const mapping: WanMapEntry | undefined = findMapping(map, [
    fw.hostname,
    fw.name,
    fw.serialNumber,
  ]);

  const ipSet = new Set(
    (fw.externalIpv4Addresses ?? []).map((s) => s.trim()),
  );

  const wan: EnrichedFirewall["wan"] = mapping
    ? {
        hasMapping: true,
        notes: mapping.notes,
        main: {
          configuredIp: mapping.main,
          seen: mapping.main ? ipSet.has(mapping.main) : undefined,
        },
        backup: {
          configuredIp: mapping.backup,
          seen: mapping.backup ? ipSet.has(mapping.backup) : undefined,
        },
      }
    : { hasMapping: false, main: {}, backup: {} };

  const rawGroup = (fw as FirewallRecord & {
    group?: { id?: string; name?: string };
  }).group;

  return {
    tenantId,
    id: fw.id,
    hostname: fw.hostname ?? fw.name ?? fw.serialNumber ?? fw.id,
    name: fw.name ?? null,
    serialNumber: fw.serialNumber ?? null,
    model: fw.model ?? null,
    firmwareVersion: fw.firmwareVersion ?? null,
    connected: fw.status?.connected ?? false,
    suspended: fw.status?.suspended ?? false,
    managing: fw.status?.managing ?? null,
    externalIpv4Addresses: fw.externalIpv4Addresses ?? [],
    stateChangedAt: fw.stateChangedAt ?? null,
    clusterMode: fw.cluster?.mode ?? null,
    groupId: rawGroup?.id ?? null,
    groupName: rawGroup?.name ?? null,
    wan,
    raw: fw,
  };
}

async function fetchForTenant(
  token: string,
  t: TenantRow,
): Promise<TenantFirewalls> {
  const firewalls = await listFirewallsForTenant(token, t);
  const enriched = firewalls.map((fw) => enrich(fw, t.id));
  enriched.sort((a, b) => a.hostname.localeCompare(b.hostname, "tr"));
  return {
    tenant: {
      id: t.id,
      name: t.name ?? null,
      dataRegion: t.dataRegion ?? null,
      apiHost: t.apiHost,
    },
    count: firewalls.length,
    firewalls: enriched,
  };
}

export async function getFirewallDashboardData(): Promise<FirewallDashboardPayload> {
  try {
    const { token, me, tenants } = await getSession();
    const data = await Promise.all(
      tenants.map((t) => fetchForTenant(token, t)),
    );

    const all = data.flatMap((b) => b.firewalls);
    return {
      ok: true,
      whoami: { id: me.id, idType: me.idType },
      summary: {
        tenantCount: tenants.length,
        firewallCount: all.length,
        connectedCount: all.filter((x) => x.connected && !x.suspended).length,
        offlineCount: all.filter((x) => !x.connected && !x.suspended).length,
        suspendedCount: all.filter((x) => x.suspended).length,
      },
      data,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bilinmeyen hata";
    const code = message.includes("SOPHOS_CLIENT_ID")
      ? "missing_env"
      : "upstream";
    return { ok: false, code, error: message };
  }
}
