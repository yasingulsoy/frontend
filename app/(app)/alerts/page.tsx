import { Badge, Card, ErrorBox, StatCard } from "@/components/ui";
import type { Tone } from "@/components/ui";
import type { CentralAlert } from "@/lib/sophos/alerts";
import { listAlertsForTenant } from "@/lib/sophos/alerts";
import { getSession } from "@/lib/sophos/session";

export const dynamic = "force-dynamic";

type Row = CentralAlert & { _tenantName?: string | null };

function severityTone(s?: string): Tone {
  switch (s) {
    case "high":
      return "down";
    case "medium":
      return "warn";
    case "low":
      return "info";
    default:
      return "muted";
  }
}

function productTone(p?: string): Tone {
  if (!p) return "muted";
  if (p === "firewall") return "info";
  return "muted";
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{
    severity?: string;
    product?: string;
    since?: string;
  }>;
}) {
  const sp = await searchParams;
  const severity = sp.severity ?? "";
  const product = sp.product ?? "";
  const sinceDays = Number(sp.since ?? "7");

  const fromDate = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  let error: string | null = null;
  let rows: Row[] = [];

  try {
    const { token, tenants } = await getSession();
    const all = await Promise.all(
      tenants.map(async (t) => {
        const items = await listAlertsForTenant(token, t, {
          from: fromDate,
          severity: severity || undefined,
          product: product || undefined,
          maxPages: 3,
        });
        return items.map<Row>((a) => ({
          ...a,
          _tenantName: t.name ?? null,
        }));
      }),
    );
    rows = all.flat();
    rows.sort((a, b) => (b.raisedAt ?? "").localeCompare(a.raisedAt ?? ""));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const counts = {
    total: rows.length,
    high: rows.filter((r) => r.severity === "high").length,
    medium: rows.filter((r) => r.severity === "medium").length,
    low: rows.filter((r) => r.severity === "low").length,
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Uyarılar
        </h1>
        <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
          Sophos Central Common API · son {sinceDays} gün
        </p>
      </header>

      {error && <ErrorBox message={error} />}

      {!error && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:mb-6 sm:grid-cols-4 sm:gap-4">
            <StatCard label="Toplam" value={counts.total} />
            <StatCard
              label="Yüksek"
              value={counts.high}
              tone={counts.high > 0 ? "down" : "muted"}
            />
            <StatCard
              label="Orta"
              value={counts.medium}
              tone={counts.medium > 0 ? "warn" : "muted"}
            />
            <StatCard label="Düşük" value={counts.low} tone="info" />
          </div>

          <form
            method="get"
            className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:mb-6 sm:flex sm:flex-wrap sm:items-center sm:gap-3"
          >
            <select
              name="severity"
              defaultValue={severity}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            >
              <option value="">Tüm şiddetler</option>
              <option value="high">Yüksek</option>
              <option value="medium">Orta</option>
              <option value="low">Düşük</option>
            </select>
            <select
              name="product"
              defaultValue={product}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            >
              <option value="">Tüm ürünler</option>
              <option value="firewall">Firewall</option>
              <option value="endpoint">Endpoint</option>
              <option value="server">Server</option>
              <option value="wireless">Wireless</option>
            </select>
            <select
              name="since"
              defaultValue={String(sinceDays)}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            >
              <option value="1">Son 1 gün</option>
              <option value="3">Son 3 gün</option>
              <option value="7">Son 7 gün</option>
              <option value="30">Son 30 gün</option>
            </select>
            <button
              type="submit"
              className="col-span-2 rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 sm:col-span-1"
            >
              Filtrele
            </button>
          </form>

          <Card title="Uyarı listesi" subtitle={`${rows.length} kayıt`}>
            {rows.length === 0 ? (
              <div className="px-5 py-6 text-sm text-zinc-500">
                Bu kriterlere uyan uyarı yok.
              </div>
            ) : (
              <>
                {/* Mobil kartlar */}
                <ul className="divide-y divide-zinc-800 md:hidden">
                  {rows.slice(0, 500).map((r) => (
                    <li key={r.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={severityTone(r.severity)}>
                            {r.severity ?? "—"}
                          </Badge>
                          <Badge tone={productTone(r.product)}>
                            {r.product ?? "—"}
                          </Badge>
                        </div>
                        <span className="shrink-0 text-[11px] text-zinc-500">
                          {r.raisedAt
                            ? new Date(r.raisedAt).toLocaleString("tr-TR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-zinc-200">
                        {r.description ?? r.type ?? "—"}
                      </div>
                      {(r.category || r._tenantName || r.managedAgent?.name) && (
                        <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
                          {r.category && <span>{r.category}</span>}
                          {r._tenantName && <span>{r._tenantName}</span>}
                          {r.managedAgent?.name && (
                            <span>{r.managedAgent.name}</span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Masaüstü tablo */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Tarih</th>
                        <th className="px-4 py-3 font-medium">Şiddet</th>
                        <th className="px-4 py-3 font-medium">Ürün</th>
                        <th className="px-4 py-3 font-medium">Açıklama</th>
                        <th className="px-4 py-3 font-medium">Kaynak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {rows.slice(0, 500).map((r) => (
                        <tr key={r.id} className="align-top">
                          <td className="px-4 py-3 text-xs text-zinc-400">
                            {r.raisedAt
                              ? new Date(r.raisedAt).toLocaleString("tr-TR")
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={severityTone(r.severity)}>
                              {r.severity ?? "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={productTone(r.product)}>
                              {r.product ?? "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-zinc-200">
                            {r.description ?? r.type ?? "—"}
                            {r.category && (
                              <div className="mt-0.5 text-[11px] text-zinc-500">
                                {r.category}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-400">
                            <div>{r._tenantName ?? r.tenant?.name ?? "—"}</div>
                            {r.managedAgent?.name && (
                              <div className="text-[11px] text-zinc-500">
                                {r.managedAgent.name}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </main>
  );
}
