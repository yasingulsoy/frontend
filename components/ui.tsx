import type { ReactNode } from "react";

export type Tone = "up" | "down" | "warn" | "muted" | "info";

const toneClasses: Record<Tone, string> = {
  up: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  down: "bg-red-500/15 text-red-300 ring-red-500/30",
  warn: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  muted: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  info: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
};

const dotClasses: Record<Tone, string> = {
  up: "bg-emerald-400",
  down: "bg-red-400",
  warn: "bg-amber-400",
  muted: "bg-zinc-500",
  info: "bg-sky-400",
};

export function Badge({
  tone = "muted",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "muted" }: { tone?: Tone }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${dotClasses[tone]}`}
    />
  );
}

export function StatCard({
  label,
  value,
  tone = "muted",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: Tone;
  hint?: string;
}) {
  const accent: Record<Tone, string> = {
    up: "text-emerald-300",
    down: "text-red-300",
    warn: "text-amber-200",
    muted: "text-zinc-100",
    info: "text-sky-300",
  };
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${accent[tone]}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      {(title || right) && (
        <div className="flex flex-col gap-1 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && (
              <h2 className="font-medium text-zinc-100">{title}</h2>
            )}
            {subtitle && (
              <p className="text-xs text-zinc-500">{subtitle}</p>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-900/60 bg-amber-950/40 px-5 py-4 text-amber-100">
      <p className="font-medium">Veri alınamadı</p>
      <p className="mt-2 break-words text-sm text-amber-200/90">{message}</p>
    </div>
  );
}
