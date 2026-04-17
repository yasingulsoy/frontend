import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "habbix · Giriş",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const sp = await searchParams;
  const jar = await cookies();
  const existing = await verifySessionToken(jar.get(AUTH_COOKIE)?.value);
  if (existing) {
    redirect(sp.from && sp.from.startsWith("/") ? sp.from : "/");
  }

  const hasError = sp.error === "1";
  const from = sp.from ?? "/";

  return (
    <main className="relative grid min-h-screen w-full bg-zinc-950 lg:grid-cols-2">
      {/* Sol: görsel */}
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/image.png"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950/40 via-zinc-950/10 to-zinc-950/70" />
        <div className="absolute inset-0 flex flex-col justify-end p-10">
          <div className="max-w-sm rounded-2xl border border-white/10 bg-zinc-950/60 p-5 backdrop-blur">
            <div className="text-2xl font-semibold tracking-tight text-white">
              habbix
            </div>
            <p className="mt-2 text-sm text-zinc-300">
              Dağıtık firewall altyapınızı tek bir panoda izleyin.
            </p>
          </div>
        </div>
      </div>

      {/* Sağ: form */}
      <div className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Mobilde görsel — tam görünür şekilde */}
          <div className="mb-6 lg:hidden">
            <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              <Image
                src="/image.png"
                alt=""
                width={800}
                height={900}
                priority
                sizes="(max-width: 640px) 90vw, 320px"
                className="h-auto w-full object-contain"
              />
            </div>
            <div className="mt-4 text-center">
              <div className="text-xl font-semibold tracking-tight text-zinc-100">
                habbix
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                Dağıtık firewall altyapınız için izleme panosu
              </p>
            </div>
          </div>

          <div className="mb-6 hidden lg:block">
            <div className="text-xl font-semibold tracking-tight text-zinc-100">
              Tekrar hoş geldiniz
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Devam etmek için giriş yapın.
            </p>
          </div>

          <form action={loginAction} className="space-y-4">
            <input type="hidden" name="from" value={from} />

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Kullanıcı adı
              </span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                required
                autoFocus
                spellCheck={false}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-700/60"
                placeholder="kullanıcı"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Şifre
              </span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-700/60"
                placeholder="••••••••"
              />
            </label>

            {hasError && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                Kullanıcı adı veya şifre hatalı.
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            >
              Giriş yap
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] text-zinc-600">
            © {new Date().getFullYear()} habbix
          </p>
        </div>
      </div>
    </main>
  );
}
