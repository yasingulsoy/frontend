import { fetchAllKeyPages } from "./client";
import type { TenantRow } from "./types";

/** Sophos Central Firewall API — cihaz listesi (kiracı başına) */
const FIREWALLS_PATH = "/firewall/v1/firewalls";

/** Resmi şema — önemli alanların tipi */
export type FirewallStatus = {
  managing?: string;
  reporting?: string;
  connected?: boolean;
  suspended?: boolean;
};

export type FirewallCluster = {
  id?: string;
  mode?: "activeActive" | "activePassive";
  status?: "auxiliary" | "primary" | "standalone" | "fault";
};

export type FirewallRecord = {
  id: string;
  tenant?: { id: string };
  serialNumber?: string;
  hostname?: string;
  name?: string;
  model?: string;
  firmwareVersion?: string;
  externalIpv4Addresses?: string[];
  status?: FirewallStatus;
  cluster?: FirewallCluster;
  stateChangedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  geoLocation?: { latitude?: string; longitude?: string };
};

export async function listFirewallsForTenant(
  accessToken: string,
  tenant: TenantRow,
): Promise<FirewallRecord[]> {
  const items = await fetchAllKeyPages<FirewallRecord>(
    FIREWALLS_PATH,
    accessToken,
    tenant.id,
    tenant.apiHost,
  );
  return items;
}
