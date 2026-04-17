import fs from "node:fs";
import path from "node:path";

export type WanMapEntry = {
  main?: string;
  backup?: string;
  notes?: string;
};

export type WanMap = Record<string, WanMapEntry>;

let cached: WanMap | null = null;

/**
 * İsteğe bağlı: her firewall için Main / Backup public IP’leri.
 *
 * Dosya: frontend/config/firewall-wan-map.json
 * Anahtar olarak `hostname`, `name` veya `serialNumber` kullanılabilir
 * (hepsi karşılaştırmada deneniyor, büyük/küçük harf duyarsız).
 */
export function loadWanMap(): WanMap {
  if (cached) return cached;
  try {
    const p = path.join(process.cwd(), "config", "firewall-wan-map.json");
    if (!fs.existsSync(p)) {
      cached = {};
      return cached;
    }
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as WanMap;
    const normalized: WanMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      normalized[k.trim().toLowerCase()] = v;
    }
    cached = normalized;
    return cached;
  } catch {
    cached = {};
    return cached;
  }
}

export function findMapping(
  map: WanMap,
  keys: Array<string | undefined>,
): WanMapEntry | undefined {
  for (const k of keys) {
    if (!k) continue;
    const entry = map[k.trim().toLowerCase()];
    if (entry) return entry;
  }
  return undefined;
}
