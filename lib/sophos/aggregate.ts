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

/**
 * Tek bir WAN hattının (Main / Backup) o anki durumu.
 *
 *  - `up`             : Yapılandırılmış IP, Sophos'un döndüğü
 *                       `externalIpv4Addresses` listesinde görünüyor → hat aktif.
 *  - `down`           : Yapılandırılmış IP var, ama dışa çıkan IP listesinde yok
 *                       → hat şu an trafik taşımıyor.
 *  - `not-configured` : Harita dosyasında bu taraf için IP tanımlı değil.
 *  - `unknown`        : Cihaz Sophos Central'a bağlı değil, karar verilemiyor.
 */
export type GatewayLinkState = "up" | "down" | "not-configured" | "unknown";

/**
 * Sophos Central Firewall API portlar için doğrudan up/down bayrağı
 * dönmüyor. "Hangi gateway şu an trafik taşıyor?" bilgisi, firewall'un
 * Sophos'a bildirdiği dış (public) IP'lerden türetiliyor:
 *
 *   Main IP listede var   → Main aktif (normal çalışma)
 *   Main yok, Backup var → Backup aktif → şube 4.5G üzerinde (onBackup)
 *   İkisi de yok          → her iki hat da down
 *
 * Cihaz `connected=false` ise `active = "unknown"` döner.
 */
export type GatewayStatus = {
  main: GatewayLinkState;
  backup: GatewayLinkState;
  active: "main" | "backup" | "none" | "unknown";
  onBackup: boolean;
  reason: string;
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
  gateway: GatewayStatus;
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
        /** Main hattı düşmüş, Backup (4.5G) taşıyan şube sayısı. */
        onBackupCount: number;
        /** Main + Backup ikisi de down (cihaz bağlı olsa bile trafik yok). */
        bothDownCount: number;
      };
      data: TenantFirewalls[];
    }
  | { ok: false; error: string; code: "missing_env" | "upstream" };

function deriveGatewayStatus(
  connected: boolean,
  suspended: boolean,
  wan: EnrichedFirewall["wan"],
): GatewayStatus {
  const mainConfigured = Boolean(wan.main.configuredIp);
  const backupConfigured = Boolean(wan.backup.configuredIp);
  const mainSeen = wan.main.seen === true;
  const backupSeen = wan.backup.seen === true;

  if (!connected || suspended) {
    return {
      main: mainConfigured ? "unknown" : "not-configured",
      backup: backupConfigured ? "unknown" : "not-configured",
      active: "unknown",
      onBackup: false,
      reason: suspended
        ? "Cihaz askıda; gateway durumu doğrulanamıyor."
        : "Cihaz Sophos Central'a bağlı değil; gateway durumu doğrulanamıyor.",
    };
  }

  if (!wan.hasMapping) {
    return {
      main: "not-configured",
      backup: "not-configured",
      active: "unknown",
      onBackup: false,
      reason: "Firewall için Main/Backup IP eşlemesi tanımlı değil.",
    };
  }

  const main: GatewayLinkState = mainConfigured
    ? mainSeen
      ? "up"
      : "down"
    : "not-configured";
  const backup: GatewayLinkState = backupConfigured
    ? backupSeen
      ? "up"
      : "down"
    : "not-configured";

  if (main === "up") {
    return {
      main,
      backup,
      active: "main",
      onBackup: false,
      reason: "Main gateway aktif; trafik fiber üzerinden gidiyor.",
    };
  }

  if (backup === "up") {
    return {
      main,
      backup,
      active: "backup",
      onBackup: true,
      reason:
        "Main gateway down; şube yedek hat (4.5G) üzerinden internete çıkıyor.",
    };
  }

  return {
    main,
    backup,
    active: "none",
    onBackup: false,
    reason:
      "Main ve Backup IP'lerinin hiçbiri firewall'un dış IP listesinde görünmüyor; her iki hat da down.",
  };
}

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

  const connected = fw.status?.connected ?? false;
  const suspended = fw.status?.suspended ?? false;
  const gateway = deriveGatewayStatus(connected, suspended, wan);

  return {
    tenantId,
    id: fw.id,
    hostname: fw.hostname ?? fw.name ?? fw.serialNumber ?? fw.id,
    name: fw.name ?? null,
    serialNumber: fw.serialNumber ?? null,
    model: fw.model ?? null,
    firmwareVersion: fw.firmwareVersion ?? null,
    connected,
    suspended,
    managing: fw.status?.managing ?? null,
    externalIpv4Addresses: fw.externalIpv4Addresses ?? [],
    stateChangedAt: fw.stateChangedAt ?? null,
    clusterMode: fw.cluster?.mode ?? null,
    groupId: rawGroup?.id ?? null,
    groupName: rawGroup?.name ?? null,
    wan,
    gateway,
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
        onBackupCount: all.filter((x) => x.gateway.onBackup).length,
        bothDownCount: all.filter(
          (x) =>
            x.connected && !x.suspended && x.gateway.active === "none",
        ).length,
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
