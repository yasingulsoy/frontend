import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ProbeResult = {
  ip: string;
  alive: boolean;
  rttMs: number | null;
  /** Kısa hata/sebep açıklaması (UI tooltip için). */
  reason?: string;
};

/**
 * IPv4 doğrulaması — child process'e rastgele string geçmesini engeller.
 * (Ping komutuna shell injection riski için savunma katmanı.)
 */
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

function isValidIpv4(ip: string): boolean {
  if (!IPV4_RE.test(ip)) return false;
  return ip.split(".").every((o) => {
    const n = Number(o);
    return n >= 0 && n <= 255;
  });
}

function parseRttMs(stdout: string): number | null {
  const m =
    /time[=<]([\d.]+)\s*ms/i.exec(stdout) ??
    /Ortalama\s*=\s*(\d+)\s*ms/i.exec(stdout) ??
    /Average\s*=\s*(\d+)\s*ms/i.exec(stdout);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * ICMP ping: OS yerel `ping` komutunu çağırır. Sunucu tarafında çalışır.
 * Windows:  ping -n <count> -w <ms>    host
 * Linux:    ping -c <count> -W <secs>  host
 * macOS:    ping -c <count> -t <secs>  host
 */
export async function pingHost(
  ip: string,
  opts: { timeoutMs?: number; count?: number } = {},
): Promise<ProbeResult> {
  const timeoutMs = Math.max(200, opts.timeoutMs ?? 1500);
  const count = Math.max(1, Math.min(5, opts.count ?? 1));

  if (!isValidIpv4(ip)) {
    return { ip, alive: false, rttMs: null, reason: "geçersiz IPv4" };
  }

  const platform = process.platform;
  let cmd: string;
  let args: string[];

  if (platform === "win32") {
    cmd = "ping";
    args = ["-n", String(count), "-w", String(timeoutMs), ip];
  } else if (platform === "darwin") {
    const secs = Math.max(1, Math.ceil(timeoutMs / 1000));
    cmd = "ping";
    args = ["-c", String(count), "-t", String(secs), ip];
  } else {
    const secs = Math.max(1, Math.ceil(timeoutMs / 1000));
    cmd = "ping";
    args = ["-c", String(count), "-W", String(secs), ip];
  }

  try {
    const { stdout } = await execFileAsync(cmd, args, {
      timeout: timeoutMs * count + 1500,
      windowsHide: true,
      maxBuffer: 1024 * 64,
    });
    const rtt = parseRttMs(stdout);
    return { ip, alive: true, rttMs: rtt };
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stdout?: string; killed?: boolean };
    const out = err.stdout ?? "";
    if (/TTL=/i.test(out) || /bytes from/i.test(out)) {
      return { ip, alive: true, rttMs: parseRttMs(out) };
    }
    if (err.killed) {
      return { ip, alive: false, rttMs: null, reason: "zaman aşımı" };
    }
    if (err.code === "ENOENT") {
      return {
        ip,
        alive: false,
        rttMs: null,
        reason: "sunucuda ping komutu yok",
      };
    }
    return {
      ip,
      alive: false,
      rttMs: null,
      reason: err.message?.slice(0, 80) ?? "cevapsız",
    };
  }
}

/**
 * Birden fazla IP'yi sınırlı eşzamanlılıkla (havuzlu) ping'ler,
 * aynı IP tekrar ederse tek seferde çözüp sonucu tüm isteyenlere döner.
 */
export async function pingHostsPooled(
  ips: string[],
  opts: {
    timeoutMs?: number;
    count?: number;
    concurrency?: number;
  } = {},
): Promise<Map<string, ProbeResult>> {
  const concurrency = Math.max(1, Math.min(64, opts.concurrency ?? 16));
  const unique = Array.from(new Set(ips.filter(Boolean)));
  const out = new Map<string, ProbeResult>();

  let i = 0;
  const worker = async () => {
    while (i < unique.length) {
      const idx = i++;
      const ip = unique[idx];
      const res = await pingHost(ip, {
        timeoutMs: opts.timeoutMs,
        count: opts.count,
      });
      out.set(ip, res);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, unique.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
}
