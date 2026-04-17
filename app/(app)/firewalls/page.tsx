import { Badge, Card, Dot, ErrorBox, StatCard } from "@/components/ui";
import type {
  EnrichedFirewall,
  WanSide,
} from "@/lib/sophos/aggregate";
import { getFirewallDashboardData } from "@/lib/sophos/aggregate";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; status?: string; tenant?: string }>;

export default async function FirewallsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const statusFilter = sp.status ?? "all";
  const tenantFilter = sp.tenant ?? "all";

  const payload = await getFirewallDashboardData();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Firewall'lar
        </h1>
        <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
          Port3-WAN-Backup (Backup) · Port4-WAN-Main (Main)
        </p>
      </header>

      {!payload.ok && <ErrorBox message={payload.error} />}

      {payload.ok && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:mb-6 sm:grid-cols-4 sm:gap-4">
            <StatCard label="Toplam" value={payload.summary.firewallCount} />
            <StatCard
              label="Bağlı"
              value={payload.summary.connectedCount}
              tone="up"
            />
            <StatCard
              label="Offline"
              value={payload.summary.offlineCount}
              tone={payload.summary.offlineCount > 0 ? "down" : "muted"}
            />
            <StatCard
              label="Askıda"
              value={payload.summary.suspendedCount}
              tone={payload.summary.suspendedCount > 0 ? "warn" : "muted"}
            />
          </div>

          <form
            className="mb-5 grid grid-cols-1 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:mb-6 sm:grid-cols-[1fr_auto_auto_auto] sm:gap-3 sm:p-3"
            method="get"
          >
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Ara: hostname, seri, IP…"
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
            />
            <select
              name="status"
              defaultValue={statusFilter}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            >
              <option value="all">Tüm durumlar</option>
              <option value="online">Sadece bağlı</option>
              <option value="offline">Sadece offline</option>
              <option value="wan-degraded">WAN bozuk</option>
            </select>
            <select
              name="tenant"
              defaultValue={tenantFilter}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            >
              <option value="all">Tüm kiracılar</option>
              {payload.data.map((b) => (
                <option key={b.tenant.id} value={b.tenant.id}>
                  {b.tenant.name ?? b.tenant.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
            >
              Filtrele
            </button>
          </form>

          <div className="space-y-6">
            {payload.data
              .filter((b) =>
                tenantFilter === "all" ? true : b.tenant.id === tenantFilter,
              )
              .map((block) => {
                const filtered = block.firewalls.filter((fw) =>
                  matchFilter(fw, q, statusFilter),
                );
                return (
                  <Card
                    key={block.tenant.id}
                    title={block.tenant.name ?? "İsimsiz kiracı"}
                    subtitle={`${block.tenant.id.slice(0, 8)}…${
                      block.tenant.dataRegion
                        ? ` · ${block.tenant.dataRegion}`
                        : ""
                    }`}
                    right={
                      <span className="text-sm text-zinc-400">
                        {filtered.length} / {block.count} cihaz
                      </span>
                    }
                  >
                    {filtered.length === 0 ? (
                      <div className="px-5 py-6 text-sm text-zinc-500">
                        Filtreye uyan cihaz yok.
                      </div>
                    ) : (
                      <>
                        {/* Mobil: kart görünümü */}
                        <ul className="divide-y divide-zinc-800 md:hidden">
                          {filtered.map((fw) => (
                            <FirewallCard key={fw.id} fw={fw} />
                          ))}
                        </ul>
                        {/* Masaüstü: tablo */}
                        <div className="hidden overflow-x-auto md:block">
                          <table className="w-full min-w-[960px] text-left text-sm">
                            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                              <tr>
                                <th className="px-4 py-3 font-medium">
                                  Cihaz
                                </th>
                                <th className="px-4 py-3 font-medium">
                                  Durum
                                </th>
                                <th className="px-4 py-3 font-medium">
                                  Port4 · Main
                                </th>
                                <th className="px-4 py-3 font-medium">
                                  Port3 · Backup
                                </th>
                                <th className="px-4 py-3 font-medium">
                                  Dış IP'ler
                                </th>
                                <th className="px-4 py-3 font-medium">
                                  Model
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                              {filtered.map((fw) => (
                                <FirewallRow key={fw.id} fw={fw} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </Card>
                );
              })}
          </div>
        </>
      )}
    </main>
  );
}

function matchFilter(
  fw: EnrichedFirewall,
  q: string,
  status: string,
): boolean {
  if (q) {
    const hay =
      `${fw.hostname} ${fw.name ?? ""} ${fw.serialNumber ?? ""} ${fw.externalIpv4Addresses.join(" ")}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  const isOnline = fw.connected && !fw.suspended;
  if (status === "online" && !isOnline) return false;
  if (status === "offline" && isOnline) return false;
  if (status === "wan-degraded") {
    if (!fw.wan.hasMapping) return false;
    const mainOk = fw.wan.main.seen === true;
    const backupOk = fw.wan.backup.seen === true;
    if (isOnline && mainOk && backupOk) return false;
    if (!isOnline) return false;
  }
  return true;
}

function WanCell({
  side,
  connected,
}: {
  side: WanSide;
  connected: boolean;
}) {
  if (side.configuredIp === undefined) {
    return (
      <div className="text-zinc-500">
        <Badge tone="muted">eşleme yok</Badge>
      </div>
    );
  }
  if (!connected) {
    return (
      <div className="space-y-1">
        <Badge tone="down">
          <Dot tone="down" /> kapalı
        </Badge>
        <div className="font-mono text-[11px] text-zinc-500">
          {side.configuredIp}
        </div>
      </div>
    );
  }
  if (side.seen) {
    return (
      <div className="space-y-1">
        <Badge tone="up">
          <Dot tone="up" /> aktif
        </Badge>
        <div className="font-mono text-[11px] text-zinc-500">
          {side.configuredIp}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Badge tone="down">
        <Dot tone="down" /> IP yok
      </Badge>
      <div className="font-mono text-[11px] text-zinc-500">
        {side.configuredIp}
      </div>
    </div>
  );
}

function StatusBadge({ fw }: { fw: EnrichedFirewall }) {
  if (fw.suspended)
    return (
      <Badge tone="warn">
        <Dot tone="warn" /> askıda
      </Badge>
    );
  if (fw.connected)
    return (
      <Badge tone="up">
        <Dot tone="up" /> bağlı
      </Badge>
    );
  return (
    <Badge tone="down">
      <Dot tone="down" /> offline
    </Badge>
  );
}

function FirewallCard({ fw }: { fw: EnrichedFirewall }) {
  const connected = fw.connected && !fw.suspended;
  return (
    <li className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-zinc-100">
            {fw.hostname}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
            {fw.serialNumber && (
              <span className="font-mono">{fw.serialNumber}</span>
            )}
            {fw.firmwareVersion && <span>{fw.firmwareVersion}</span>}
            {fw.clusterMode && <span>HA: {fw.clusterMode}</span>}
          </div>
        </div>
        <StatusBadge fw={fw} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
            Port4 · Main
          </div>
          <WanCell side={fw.wan.main} connected={connected} />
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
            Port3 · Backup
          </div>
          <WanCell side={fw.wan.backup} connected={connected} />
        </div>
      </div>

      {fw.externalIpv4Addresses.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
            Dış IP
          </div>
          <div className="flex flex-wrap gap-1.5 font-mono text-[11px] text-zinc-300">
            {fw.externalIpv4Addresses.map((ip) => (
              <span
                key={ip}
                className="rounded bg-zinc-800/60 px-1.5 py-0.5"
              >
                {ip}
              </span>
            ))}
          </div>
        </div>
      )}

      {(fw.model || fw.stateChangedAt) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
          {fw.model && <span>{fw.model}</span>}
          {fw.stateChangedAt && (
            <span>
              {new Date(fw.stateChangedAt).toLocaleString("tr-TR")}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function FirewallRow({ fw }: { fw: EnrichedFirewall }) {
  const connected = fw.connected && !fw.suspended;

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-zinc-100">{fw.hostname}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
          {fw.serialNumber && (
            <span className="font-mono">{fw.serialNumber}</span>
          )}
          {fw.firmwareVersion && <span>{fw.firmwareVersion}</span>}
          {fw.clusterMode && <span>HA: {fw.clusterMode}</span>}
          {fw.groupName && <span>Grup: {fw.groupName}</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge fw={fw} />
        {fw.managing && (
          <div className="mt-1 text-[11px] text-zinc-500">{fw.managing}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <WanCell side={fw.wan.main} connected={connected} />
      </td>
      <td className="px-4 py-3">
        <WanCell side={fw.wan.backup} connected={connected} />
      </td>
      <td className="px-4 py-3">
        {fw.externalIpv4Addresses.length === 0 ? (
          <span className="text-zinc-500">—</span>
        ) : (
          <ul className="space-y-1 font-mono text-[11px] text-zinc-300">
            {fw.externalIpv4Addresses.map((ip) => (
              <li key={ip}>{ip}</li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-zinc-400">
        <div>{fw.model ?? "—"}</div>
        {fw.stateChangedAt && (
          <div className="mt-1 text-[11px] text-zinc-500">
            {new Date(fw.stateChangedAt).toLocaleString("tr-TR")}
          </div>
        )}
      </td>
    </tr>
  );
}
