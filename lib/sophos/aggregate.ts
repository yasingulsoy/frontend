import type { FirewallRecord } from "./firewalls";
import { listFirewallsForTenant } from "./firewalls";
import type { ProbeResult } from "./probe";
import { pingHostsPooled } from "./probe";
import { getSession } from "./session";
import type { WanMapEntry } from "./wan-map";
import { findMapping, loadWanMap } from "./wan-map";

export type ProbeOutcome = {
  checked: boolean;
  alive?: boolean;
  rttMs?: number | null;
  reason?: string;
};

export type WanSide = {
  configuredIp?: string;
  /** Sophos'un `externalIpv4Addresses`'ında görünüyor mu (pasif sinyal). */
  seen?: boolean;
  /** Aktif ICMP sonda sonucu. */
  probe?: ProbeOutcome;
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
 * "Hangi gateway şu an trafik taşıyor?" iki sinyalden çıkarılır:
 *
 * 1) Pasif: Sophos Central'ın `externalIpv4Addresses` dizisi — firewall'un
 *    son bildirdiği dış IP. (Main IP listede → Main aktif, vb.)
 *
 * 2) Aktif: Sunucudan ICMP ping — Main ve Backup public IP'lere doğrudan
 *    ping. `WAN_PROBE_ENABLED=true` ise probe sonucu pasif sinyali
 *    geçersiz kılar, çünkü gerçek zamanlı ve kesindir.
 *
 * Cihaz `connected=false` ise pasif sinyal güvenilmez; bu durumda
 * yalnızca probe sonuçları kullanılır (probe açıksa).
 */
export type GatewayStatus = {
  main: GatewayLinkState;
  backup: GatewayLinkState;
  active: "main" | "backup" | "none" | "unknown";
  onBackup: boolean;
  /** Kararın hangi kaynağa dayandığı. */
  source: "probe" | "passive" | "probe+passive" | "none";
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

function stateFor(
  configured: boolean,
  seen: boolean,
  probe: ProbeOutcome | undefined,
): GatewayLinkState {
  if (!configured) return "not-configured";
  if (probe?.checked) return probe.alive ? "up" : "down";
  return seen ? "up" : "down";
}

function deriveGatewayStatus(
  connected: boolean,
  suspended: boolean,
  wan: EnrichedFirewall["wan"],
): GatewayStatus {
  const mainConfigured = Boolean(wan.main.configuredIp);
  const backupConfigured = Boolean(wan.backup.configuredIp);
  const mainProbe = wan.main.probe;
  const backupProbe = wan.backup.probe;
  const probedAny = mainProbe?.checked || backupProbe?.checked;

  if (!wan.hasMapping) {
    return {
      main: "not-configured",
      backup: "not-configured",
      active: "unknown",
      onBackup: false,
      source: "none",
      reason: "Firewall için Main/Backup IP eşlemesi tanımlı değil.",
    };
  }

  if ((!connected || suspended) && !probedAny) {
    return {
      main: mainConfigured ? "unknown" : "not-configured",
      backup: backupConfigured ? "unknown" : "not-configured",
      active: "unknown",
      onBackup: false,
      source: "none",
      reason: suspended
        ? "Cihaz askıda; gateway durumu doğrulanamıyor."
        : "Cihaz Sophos Central'a bağlı değil; gateway durumu doğrulanamıyor.",
    };
  }

  const mainSeen = wan.main.seen === true;
  const backupSeen = wan.backup.seen === true;
  const main = stateFor(mainConfigured, mainSeen, mainProbe);
  const backup = stateFor(backupConfigured, backupSeen, backupProbe);

  const source: GatewayStatus["source"] = probedAny
    ? connected
      ? "probe+passive"
      : "probe"
    : "passive";

  const probeTag = probedAny ? " (ICMP ile doğrulandı)" : "";

  if (main === "up") {
    return {
      main,
      backup,
      active: "main",
      onBackup: false,
      source,
      reason: `Main gateway aktif; trafik fiber üzerinden gidiyor.${probeTag}`,
    };
  }

  if (backup === "up") {
    return {
      main,
      backup,
      active: "backup",
      onBackup: true,
      source,
      reason: `Main gateway down; şube yedek hat (4.5G) üzerinden internete çıkıyor.${probeTag}`,
    };
  }

  return {
    main,
    backup,
    active: "none",
    onBackup: false,
    source,
    reason: probedAny
      ? "Main ve Backup IP'lerinin hiçbiri ping'e cevap vermiyor; her iki hat da down."
      : "Main ve Backup IP'lerinin hiçbiri firewall'un dış IP listesinde görünmüyor; her iki hat da down.",
  };
}

function toOutcome(probe: ProbeResult | undefined): ProbeOutcome | undefined {
  if (!probe) return { checked: false };
  return {
    checked: true,
    alive: probe.alive,
    rttMs: probe.rttMs,
    reason: probe.reason,
  };
}

function enrich(
  fw: FirewallRecord,
  tenantId: string,
  probes: Map<string, ProbeResult> | null,
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

  const pickProbe = (ip?: string): ProbeOutcome | undefined => {
    if (!ip) return undefined;
    if (!probes) return { checked: false };
    const r = probes.get(ip);
    return toOutcome(r);
  };

  const wan: EnrichedFirewall["wan"] = mapping
    ? {
        hasMapping: true,
        notes: mapping.notes,
        main: {
          configuredIp: mapping.main,
          seen: mapping.main ? ipSet.has(mapping.main) : undefined,
          probe: pickProbe(mapping.main),
        },
        backup: {
          configuredIp: mapping.backup,
          seen: mapping.backup ? ipSet.has(mapping.backup) : undefined,
          probe: pickProbe(mapping.backup),
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

function probeEnabled(): boolean {
  const v = process.env.WAN_PROBE_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function collectMappedIps(firewalls: FirewallRecord[]): string[] {
  const map = loadWanMap();
  const set = new Set<string>();
  for (const fw of firewalls) {
    const mapping = findMapping(map, [fw.hostname, fw.name, fw.serialNumber]);
    if (!mapping) continue;
    if (mapping.main) set.add(mapping.main);
    if (mapping.backup) set.add(mapping.backup);
  }
  return Array.from(set);
}

export async function getFirewallDashboardData(): Promise<FirewallDashboardPayload> {
  try {
    const { token, me, tenants } = await getSession();

    const allFirewallsPerTenant = await Promise.all(
      tenants.map((t) =>
        listFirewallsForTenant(token, t).then((fws) => ({ t, fws })),
      ),
    );

    let probes: Map<string, ProbeResult> | null = null;
    if (probeEnabled()) {
      const ips = collectMappedIps(
        allFirewallsPerTenant.flatMap((x) => x.fws),
      );
      if (ips.length > 0) {
        const timeoutMs = Number(process.env.WAN_PROBE_TIMEOUT_MS ?? 1500);
        const concurrency = Number(process.env.WAN_PROBE_CONCURRENCY ?? 16);
        probes = await pingHostsPooled(ips, {
          timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 1500,
          concurrency: Number.isFinite(concurrency) ? concurrency : 16,
        });
      }
    }

    const data = allFirewallsPerTenant.map(({ t, fws }) => {
      const enriched = fws.map((fw) => enrich(fw, t.id, probes));
      enriched.sort((a, b) => a.hostname.localeCompare(b.hostname, "tr"));
      return {
        tenant: {
          id: t.id,
          name: t.name ?? null,
          dataRegion: t.dataRegion ?? null,
          apiHost: t.apiHost,
        },
        count: fws.length,
        firewalls: enriched,
      } satisfies TenantFirewalls;
    });

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
