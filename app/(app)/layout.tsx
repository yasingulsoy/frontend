import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  MobileBottomNav,
  MobileHeader,
  SideNav,
} from "@/components/SideNav";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const session = await verifySessionToken(jar.get(AUTH_COOKIE)?.value);
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <SideNav user={session.user} />
      <div className="flex min-h-screen flex-1 flex-col">
        <MobileHeader user={session.user} />
        <div className="flex-1 pb-20 md:pb-0">{children}</div>
        <MobileBottomNav />
      </div>
    </div>
  );
}
