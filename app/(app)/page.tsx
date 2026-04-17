import Link from "next/link";
import { Badge, Card, Dot, ErrorBox, StatCard } from "@/components/ui";
import { getFirewallDashboardData } from "@/lib/sophos/aggregate";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const payload = await getFirewallDashboardData();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Genel Bakış
        </h1>
        <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
          Sophos Central Firewall altyapısının özet durumu
        </p>
      </header>

      {!payload.ok && <ErrorBox message={payload.error} />}

      {payload.ok && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Firewall"
              value={payload.summary.firewallCount}
              hint={`${payload.summary.tenantCount} kiracı`}
            />
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

          <Card
            title="Cihaz sağlığı"
            subtitle="Kiracı başına bağlantı ve WAN durumu"
            right={
              <Link
                href="/firewalls"
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                tümünü aç →
              </Link>
            }
          >
            <div className="divide-y divide-zinc-800">
              {payload.data.map((block) => {
                const connected = block.firewalls.filter(
                  (f) => f.connected && !f.suspended,
                ).length;
                const offline = block.firewalls.filter(
                  (f) => !f.connected && !f.suspended,
                ).length;
                const mainActive = block.firewalls.filter(
                  (f) => f.connected && f.wan.main.seen === true,
                ).length;
                const backupActive = block.firewalls.filter(
                  (f) => f.connected && f.wan.backup.seen === true,
                ).length;
                const mapped = block.firewalls.filter(
                  (f) => f.wan.hasMapping,
                ).length;

                return (
                  <div
                    key={block.tenant.id}
                    className="grid grid-cols-3 gap-3 px-4 py-4 sm:grid-cols-6 sm:px-5"
                  >
                    <div className="col-span-3 sm:col-span-2">
                      <div className="text-sm font-medium text-zinc-100">
                        {block.tenant.name ?? "İsimsiz kiracı"}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {block.tenant.dataRegion ?? "—"}
                      </div>
                    </div>
                    <MiniStat label="cihaz" value={block.count} />
                    <MiniStat
                      label="bağlı"
                      value={connected}
                      tone={connected === block.count ? "up" : "muted"}
                    />
                    <MiniStat
                      label="offline"
                      value={offline}
                      tone={offline > 0 ? "down" : "muted"}
                    />
                    <MiniStat
                      label="WAN eşleme"
                      value={`${mapped}/${block.count}`}
                      hint={
                        mapped > 0
                          ? `Main ${mainActive} · Backup ${backupActive}`
                          : "config dosyasına ekleyin"
                      }
                    />
                  </div>
                );
              })}
              {payload.data.length === 0 && (
                <div className="px-5 py-6 text-sm text-zinc-500">
                  Kiracı bulunamadı.
                </div>
              )}
            </div>
          </Card>

          <div className="mt-6 grid gap-4 sm:mt-8 md:grid-cols-2">
            <Card title="WAN durumu özeti" subtitle="Eşleme yapılmış cihazlar">
              <WanOverview payload={payload} />
            </Card>

            <Card
              title="Çevrimdışı cihazlar"
              subtitle="Hemen aksiyon gerekebilir"
            >
              <OfflineList payload={payload} />
            </Card>
          </div>
        </>
      )}
    </main>
  );
}

function MiniStat({
  label,
  value,
  tone = "muted",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "up" | "down" | "muted" | "warn";
  hint?: string;
}) {
  const color =
    tone === "up"
      ? "text-emerald-300"
      : tone === "down"
        ? "text-red-300"
        : tone === "warn"
          ? "text-amber-200"
          : "text-zinc-100";
  return (
    <div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      {hint && <div className="text-[11px] text-zinc-500">{hint}</div>}
    </div>
  );
}

function WanOverview({
  payload,
}: {
  payload: Extract<
    Awaited<ReturnType<typeof getFirewallDashboardData>>,
    { ok: true }
  >;
}) {
  const all = payload.data.flatMap((b) => b.firewalls);
  const mapped = all.filter((f) => f.wan.hasMapping);
  const both = mapped.filter(
    (f) => f.connected && f.wan.main.seen && f.wan.backup.seen,
  ).length;
  const onlyMain = mapped.filter(
    (f) =>
      f.connected && f.wan.main.seen === true && f.wan.backup.seen !== true,
  ).length;
  const onlyBackup = mapped.filter(
    (f) =>
      f.connected && f.wan.backup.seen === true && f.wan.main.seen !== true,
  ).length;
  const noneUp = mapped.filter(
    (f) => f.connected && !f.wan.main.seen && !f.wan.backup.seen,
  ).length;

  if (mapped.length === 0) {
    return (
      <div className="px-5 py-6 text-sm text-zinc-500">
        WAN eşlemesi henüz tanımlı değil.{" "}
        <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">
          config/firewall-wan-map.json
        </code>{" "}
        dosyasına ekleyin.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-800">
      <WanRow label="Her iki WAN aktif" count={both} tone="up" />
      <WanRow label="Sadece Main aktif" count={onlyMain} tone="warn" />
      <WanRow label="Sadece Backup aktif" count={onlyBackup} tone="warn" />
      <WanRow label="Hiçbir IP eşleşmedi" count={noneUp} tone="down" />
    </ul>
  );
}

function WanRow({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "up" | "down" | "warn" | "muted";
}) {
  return (
    <li className="flex items-center justify-between px-4 py-3 text-sm sm:px-5">
      <div className="flex items-center gap-2">
        <Dot tone={tone} />
        <span className="text-zinc-200">{label}</span>
      </div>
      <span className="font-semibold tabular-nums text-zinc-100">{count}</span>
    </li>
  );
}

function OfflineList({
  payload,
}: {
  payload: Extract<
    Awaited<ReturnType<typeof getFirewallDashboardData>>,
    { ok: true }
  >;
}) {
  const offline = payload.data
    .flatMap((b) => b.firewalls)
    .filter((f) => !f.connected || f.suspended);

  if (offline.length === 0) {
    return (
      <div className="px-5 py-6 text-sm text-emerald-300">
        Tüm cihazlar bağlı görünüyor.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-800">
      {offline.slice(0, 10).map((f) => (
        <li
          key={f.id}
          className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5"
        >
          <div>
            <div className="font-medium text-zinc-100">{f.hostname}</div>
            <div className="text-[11px] text-zinc-500">
              {f.model ?? f.serialNumber ?? ""}
            </div>
          </div>
          {f.suspended ? (
            <Badge tone="warn">askıda</Badge>
          ) : (
            <Badge tone="down">offline</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
