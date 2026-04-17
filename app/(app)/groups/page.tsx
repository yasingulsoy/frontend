import { Card, ErrorBox, StatCard } from "@/components/ui";
import { getFirewallDashboardData } from "@/lib/sophos/aggregate";
import { listFirewallGroups } from "@/lib/sophos/groups";
import { getSession } from "@/lib/sophos/session";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const fw = await getFirewallDashboardData();

  let error: string | null = null;
  let groupsByTenant: Array<{
    tenantId: string;
    tenantName: string | null;
    groups: Array<{
      id: string;
      name: string;
      parentName?: string;
      total: number;
      locked?: boolean;
    }>;
  }> = [];

  try {
    const { token, tenants } = await getSession();
    groupsByTenant = await Promise.all(
      tenants.map(async (t) => {
        const g = await listFirewallGroups(token, t);
        return {
          tenantId: t.id,
          tenantName: t.name ?? null,
          groups: g.map((x) => ({
            id: x.id,
            name: x.name,
            parentName: x.parentGroup?.name,
            total: x.firewalls?.total ?? 0,
            locked: x.lockedByManagingAccount,
          })),
        };
      }),
    );
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const totalGroups = groupsByTenant.reduce(
    (a, x) => a + x.groups.length,
    0,
  );
  const ungrouped =
    fw.ok && groupsByTenant.length
      ? fw.data.reduce((a, b) => {
          return a + b.firewalls.filter((f) => !f.groupId).length;
        }, 0)
      : 0;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Firewall Grupları
        </h1>
        <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
          Sophos Central firewall-groups API’sinden gelen kayıtlar
        </p>
      </header>

      {error && <ErrorBox message={error} />}

      {!error && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:mb-6 sm:grid-cols-3 sm:gap-4">
            <StatCard label="Grup sayısı" value={totalGroups} />
            <StatCard
              label="Gruba bağlı cihazlar"
              value={groupsByTenant.reduce(
                (a, x) => a + x.groups.reduce((s, g) => s + g.total, 0),
                0,
              )}
            />
            <StatCard
              label="Gruba dahil olmayan"
              value={ungrouped}
              tone={ungrouped > 0 ? "warn" : "muted"}
            />
          </div>

          <div className="space-y-6">
            {groupsByTenant.map((block) => (
              <Card
                key={block.tenantId}
                title={block.tenantName ?? "İsimsiz kiracı"}
                subtitle={`${block.groups.length} grup`}
              >
                {block.groups.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-zinc-500">
                    Bu kiracıda firewall grubu tanımlı değil.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Grup</th>
                          <th className="px-4 py-3 font-medium">Üst grup</th>
                          <th className="px-4 py-3 font-medium">
                            Cihaz sayısı
                          </th>
                          <th className="px-4 py-3 font-medium">Kilit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {block.groups.map((g) => (
                          <tr key={g.id}>
                            <td className="px-4 py-3 text-zinc-100">
                              {g.name}
                            </td>
                            <td className="px-4 py-3 text-zinc-400">
                              {g.parentName ?? "—"}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              {g.total}
                            </td>
                            <td className="px-4 py-3 text-xs text-zinc-400">
                              {g.locked ? "managing account" : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
