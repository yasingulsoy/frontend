import { NextResponse } from "next/server";
import { getFirewallDashboardData } from "@/lib/sophos/aggregate";

/**
 * Sophos Central OAuth ile tüm kiracılardaki firewall kayıtlarını döner.
 * Gizli anahtarlar yalnızca sunucuda kalır.
 */
export async function GET() {
  const payload = await getFirewallDashboardData();

  if (!payload.ok) {
    const status = payload.code === "missing_env" ? 501 : 502;
    return NextResponse.json(
      { ok: false, error: payload.error },
      { status },
    );
  }

  return NextResponse.json(payload);
}
