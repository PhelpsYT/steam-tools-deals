/**
 * usePicsTypes - background scan of PICS to bucket owned apps by `common.type`.
 *
 * For each owned app id we call the public PICS gateway and remember the
 * `common.type` value (game | dlc | application | tool | demo | music | …).
 * Results are cached in AsyncStorage with a 30-day TTL so the second run is
 * instant. Fetches go out in small concurrent batches so we don't open 500
 * sockets at once on a phone.
 *
 * Why this lives here and not in PicsScreen: the Profile info-box needs the
 * count of `type === 'game'` to render the "Games" badge next to the raw
 * "Apps" count, independently of whether the user has opened the library
 * screen yet.
 */
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@pics_types_v1';
const PICS_URL = (appid: number) => `https://api.steamcmd.net/v1/info/${appid}`;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BATCH = 5;
const FETCH_TIMEOUT_MS = 12_000;

interface CacheEntry {
  /** Lowercased PICS `common.type` (e.g. 'game'). 'unknown' when the
   *  upstream returned nothing parseable - cached so we don't keep
   *  re-fetching dead ids. */
  type: string;
  /** Last fetch unix ms. */
  at: number;
}

type Cache = Record<string, CacheEntry>;

interface PicsTypeCounts {
  /** Count of cached app ids per type. Keys are lowercased PICS types. */
  byType: Record<string, number>;
  /** Per-appid type lookup (lowercased). Missing entries = not yet scanned. */
  types: Record<number, string>;
  /** Number of app ids we've processed (cached or freshly fetched). */
  processed: number;
  /** Total app ids requested. */
  total: number;
  /** True once every requested app id has a cache entry. */
  ready: boolean;
}

async function loadCache(): Promise<Cache> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Cache;
  } catch {
    return {};
  }
}

async function saveCache(c: Cache): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {}
}

async function fetchType(appid: number): Promise<string | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(PICS_URL(appid), { signal: ac.signal });
    if (!r.ok) return null;
    const j = await r.json();
    const type = j?.data?.[String(appid)]?.common?.type;
    if (typeof type !== 'string') return null;
    return type.toLowerCase();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function usePicsTypes(appids: number[]): PicsTypeCounts {
  const [cache, setCache] = useState<Cache>({});
  const [processed, setProcessed] = useState(0);
  const total = appids.length;

  // Key the effect on the actual list contents - joining is fine, app ids are
  // numbers so the string is bounded by the list length.
  const key = appids.length === 0 ? '' : appids.join(',');

  useEffect(() => {
    let alive = true;

    (async () => {
      const loaded = await loadCache();
      if (!alive) return;
      setCache(loaded);

      const now = Date.now();
      const need = appids.filter((a) => {
        const e = loaded[String(a)];
        return !e || now - e.at > TTL_MS;
      });
      let done = appids.length - need.length;
      setProcessed(done);
      if (need.length === 0) return;

      const c: Cache = { ...loaded };
      for (let i = 0; i < need.length; i += BATCH) {
        if (!alive) return;
        const chunk = need.slice(i, i + BATCH);
        const results = await Promise.all(chunk.map(fetchType));
        for (let j = 0; j < chunk.length; j++) {
          const type = results[j] ?? 'unknown';
          c[String(chunk[j])] = { type, at: Date.now() };
        }
        done += chunk.length;
        if (!alive) return;
        setCache({ ...c });
        setProcessed(done);
      }
      await saveCache(c);
    })();

    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const byType: Record<string, number> = {};
  const types: Record<number, string> = {};
  for (const a of appids) {
    const e = cache[String(a)];
    if (e) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      types[a] = e.type;
    }
  }

  return {
    byType,
    types,
    processed,
    total,
    ready: total > 0 && processed >= total,
  };
}
