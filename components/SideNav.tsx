"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";

const items = [
  { href: "/", label: "Genel Bakış", short: "Özet", icon: "overview" },
  { href: "/firewalls", label: "Firewall'lar", short: "Firewall", icon: "firewall" },
  { href: "/groups", label: "Gruplar", short: "Grup", icon: "groups" },
  { href: "/alerts", label: "Uyarılar", short: "Uyarı", icon: "alerts" },
] as const;

function Icon({
  name,
  className,
}: {
  name: (typeof items)[number]["icon"] | "logout";
  className?: string;
}) {
  const c = className ?? "h-4 w-4";
  switch (name) {
    case "overview":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={c}>
          <path
            d="M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6ZM13 3v6h8V3h-8Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "firewall":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={c}>
          <path
            d="M3 5h18v14H3zM3 10h18M3 15h18M8 5v14M16 5v14"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "groups":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={c}>
          <path
            d="M4 20V8l8-5 8 5v12H4Zm6-6h4v6h-4v-6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "alerts":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={c}>
          <path
            d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6Zm-2 16a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "logout":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={c}>
          <path
            d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-300">
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path
            d="M4 7l8-4 8 4v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9 12.5l2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <div className="text-sm font-semibold tracking-tight text-zinc-100">
          habbix
        </div>
        <div className="text-[10px] text-zinc-500">Ağ izleme</div>
      </div>
    </div>
  );
}

export function SideNav({ user }: { user?: string }) {
  const path = usePathname() ?? "/";

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/80 px-3 py-6 md:flex">
      <div className="mb-6 px-2">
        <Brand />
      </div>
      <nav className="space-y-1">
        {items.map((it) => {
          const active = path === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 aria-[current=page]:bg-zinc-900 aria-[current=page]:text-zinc-50"
            >
              <Icon
                name={it.icon}
                className="h-4 w-4 shrink-0 text-zinc-400 group-hover:text-zinc-200 group-aria-[current=page]:text-emerald-300"
              />
              <span className="truncate">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-zinc-800 px-2 pt-4">
        {user && (
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold uppercase text-zinc-200">
              {user.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-zinc-200">
                {user}
              </div>
              <div className="text-[10px] text-zinc-500">oturum aktif</div>
            </div>
          </div>
        )}
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-50"
          >
            <Icon name="logout" className="h-4 w-4 text-zinc-400" />
            <span>Çıkış yap</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Mobil: üstte sabit başlık */
export function MobileHeader({ user }: { user?: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur md:hidden">
      <Brand />
      <form action={logoutAction}>
        <button
          type="submit"
          aria-label={user ? `${user} oturumunu kapat` : "Çıkış yap"}
          className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] text-zinc-300 transition active:bg-zinc-800"
        >
          <Icon name="logout" className="h-3.5 w-3.5 text-zinc-400" />
          <span>Çıkış</span>
        </button>
      </form>
    </header>
  );
}

/** Mobil: altta sabit sekmeler */
export function MobileBottomNav() {
  const path = usePathname() ?? "/";
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((it) => {
        const active = path === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className="group flex flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] text-zinc-400 transition hover:text-zinc-200 aria-[current=page]:text-emerald-300"
          >
            <Icon name={it.icon} className="h-5 w-5" />
            <span>{it.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
