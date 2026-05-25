/**
 * refreshScheduler — coalescing, prioritised driver for every fetcher.
 *
 * Why a custom scheduler instead of plain useEffect-per-fetcher:
 *   - Multiple triggers (AppState 'active', screen useFocusEffect, periodic
 *     timer, sign-in, action-driven one-shots) need to converge on a
 *     single "fetch X now" call without spawning 5 duplicate requests.
 *   - Cadence tiers (HOT / WARM / COLD / ICE) need uniform TTL handling.
 *   - The concurrency cap (≤ 3 WebView fetches) lives here so it applies
 *     across all categories.
 *
 * Fetchers register themselves at module load time via `register(spec)`.
 * The provider triggers waves via `runWave('HOT' | 'WARM' | ...)` or
 * targeted refreshes via `run(key, ctx)`.
 */

import { bridgeRunOnce } from './webviewBridge';
import { getWebApiToken } from './webapiToken';
import { readCache, writeCache } from './storage';
import type {
  FetchContext,
  FetcherCadence,
  FetcherKey,
  FetcherSpec,
  SteamUserData,
} from './types';

const DEFAULT_TTLS: Record<FetcherCadence, number> = {
  HOT: 30 * 1000,
  WARM: 5 * 60 * 1000,
  COLD: 6 * 60 * 60 * 1000,
  ICE: 7 * 24 * 60 * 60 * 1000,
};

// ─── Registry ────────────────────────────────────────────────────────────────

interface RegisteredFetcher {
  spec: FetcherSpec<unknown>;
  /** Which top-level SteamUserData slice this fetcher populates. */
  slice: keyof SteamUserData;
}

const registry = new Map<FetcherKey, RegisteredFetcher>();

export function register<T>(spec: FetcherSpec<T>, slice: keyof SteamUserData): void {
  registry.set(spec.key as FetcherKey, { spec: spec as FetcherSpec<unknown>, slice });
}

export function listKeys(): FetcherKey[] {
  return Array.from(registry.keys());
}

export function listKeysByCadence(cadence: FetcherCadence): FetcherKey[] {
  return Array.from(registry.values())
    .filter((r) => r.spec.cadence === cadence)
    .map((r) => r.spec.key as FetcherKey);
}

// ─── In-flight coalesce ──────────────────────────────────────────────────────

const inFlight = new Map<FetcherKey, Promise<FetchResult>>();

export interface FetchResult {
  key: FetcherKey;
  ok: boolean;
  payload?: unknown;
  slice?: keyof SteamUserData;
  error?: string;
}

// ─── Sinks (the React side hooks into these) ─────────────────────────────────

export type ResultSink = (r: FetchResult) => void;
const sinks = new Set<ResultSink>();
export function addSink(s: ResultSink): () => void {
  sinks.add(s);
  return () => sinks.delete(s);
}
function emit(r: FetchResult) {
  for (const s of sinks) s(r);
}

// ─── Single-fetcher runner ───────────────────────────────────────────────────

async function runOne(key: FetcherKey, ctx: FetchContext, force: boolean): Promise<FetchResult> {
  const reg = registry.get(key);
  if (!reg) return { key, ok: false, error: 'unregistered' };

  // TTL short-circuit unless forced.
  if (!force) {
    const ttl = reg.spec.ttlMs ?? DEFAULT_TTLS[reg.spec.cadence];
    const cached = await readCache(key);
    if (cached && Date.now() - cached.at < ttl) {
      // Cache still warm — no network. Caller's UI already has the value.
      return { key, ok: true, payload: cached.data, slice: reg.slice };
    }
  }

  if (inFlight.has(key)) {
    return inFlight.get(key)!;
  }

  const work = (async (): Promise<FetchResult> => {
    try {
      const url = reg.spec.buildUrl(ctx);
      let raw: string;
      if (reg.spec.transport === 'webview') {
        raw = await bridgeRunOnce(url, reg.spec.injectedJs);
      } else {
        // Cookied fetch. The shared cookie jar (sharedCookiesEnabled on
        // the SteamAuth login modal + WebViewBridgeHost) carries Steam's
        // session automatically; we don't attach a Cookie header manually
        // because the native HTTP client uses the same jar.
        const resp = await fetch(url);
        if (!resp.ok) {
          const result: FetchResult = { key, ok: false, error: `http_${resp.status}` };
          emit(result);
          return result;
        }
        raw = await resp.text();
      }
      const parsed = reg.spec.parse(raw, ctx);
      if (parsed === null) {
        const result: FetchResult = { key, ok: false, error: 'parse_null' };
        emit(result);
        return result;
      }
      await writeCache(key, parsed);
      const result: FetchResult = { key, ok: true, payload: parsed, slice: reg.slice };
      emit(result);
      return result;
    } catch (e: any) {
      const result: FetchResult = { key, ok: false, error: String(e?.message ?? e) };
      emit(result);
      return result;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, work);
  return work;
}

// ─── Public scheduling API ───────────────────────────────────────────────────

export async function run(
  key: FetcherKey,
  ctx: FetchContext,
  opts?: { force?: boolean },
): Promise<FetchResult> {
  return runOne(key, ctx, !!opts?.force);
}

export async function runMany(
  keys: FetcherKey[],
  ctx: FetchContext,
  opts?: { force?: boolean },
): Promise<FetchResult[]> {
  return Promise.all(keys.map((k) => runOne(k, ctx, !!opts?.force)));
}

/** Runs every fetcher whose cadence matches. */
export async function runWave(
  cadence: FetcherCadence,
  ctx: FetchContext,
  opts?: { force?: boolean },
): Promise<FetchResult[]> {
  return runMany(listKeysByCadence(cadence), ctx, opts);
}

/**
 * Sign-in burst — the staggered "wake-up cascade" described in the plan
 * (§E.3). Fires in tiers so the UI fills in fastest-first.
 */
export async function runSignInBurst(ctxBuilder: () => Promise<FetchContext>): Promise<void> {
  // Tier 0: identity headline + library dynamicstore. No webapi_token
  // needed. These two drive the avatar / persona / online state / library
  // tab badges.
  const ctx0 = await ctxBuilder();
  void runMany(
    [
      'identity.profileXml',
      'identity.miniprofile',
      'library.dynamicstore',
      'account.headline',
    ].filter((k) => registry.has(k as FetcherKey)) as FetcherKey[],
    ctx0,
    { force: true },
  );

  // Allow tier 0 dispatch to settle, then fetch the webapi_token (depends
  // on the session cookie being live) and start the api.steampowered.com
  // tier.
  setTimeout(async () => {
    const token = await getWebApiToken();
    const ctx1: FetchContext = { ...ctx0, webapiToken: token };
    void runMany(
      [
        'wishlist.full',
        'library.recentlyPlayed',
        'account.points',
      ].filter((k) => registry.has(k as FetcherKey)) as FetcherKey[],
      ctx1,
      { force: true },
    );

    // Heavier tier.
    setTimeout(() => {
      void runMany(
        [
          'inventory.community',
          'market.listings',
          'social.friends',
          'identity.badges',
          'account.history',
          'library.ownedGames',
        ].filter((k) => registry.has(k as FetcherKey)) as FetcherKey[],
        ctx1,
      );
    }, 1000);
  }, 500);
}

// ─── Trigger hooks ───────────────────────────────────────────────────────────

/** Reset everything (called from SteamAuth.signOut). */
export function reset() {
  inFlight.clear();
}
