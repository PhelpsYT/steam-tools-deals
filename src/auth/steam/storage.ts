/**
 * AsyncStorage namespace + TTL helpers for the authenticated Steam data
 * mirror. All keys live under `@steam/*` to avoid colliding with the
 * existing `@steam_profile` key owned by ProfileContext.
 *
 * Why this is its own module: every fetcher needs read/write access to a
 * TTL'd cache. Keeping the I/O logic here means fetcher files stay pure
 * (URL + parser only) and the cache contract is in one place.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SteamUserData, FetcherKey } from './types';

// ─── Key namespace ───────────────────────────────────────────────────────────

/** Full SteamUserData blob — written after every successful fetcher run.
 *  Used to rehydrate the in-memory state on app launch BEFORE any network
 *  call completes, so the UI is never blank. */
export const KEY_USERDATA = '@steam/userdata';

/** Per-fetcher cache slot prefix. Final key is `@steam/cache/<fetcherKey>`. */
export const KEY_CACHE_PREFIX = '@steam/cache/';

/** Last-known session state — used so the UI can render the "expired" banner
 *  immediately on launch (before the session-ping completes). */
export const KEY_SESSION_STATE = '@steam/session_state';

// ─── Generic TTL'd cache ─────────────────────────────────────────────────────

export interface CacheEntry<T> {
  at: number;
  data: T;
}

export async function readCache<T>(key: FetcherKey): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (typeof parsed?.at !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: FetcherKey, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { at: Date.now(), data };
    await AsyncStorage.setItem(KEY_CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Swallow — caching is best-effort, never block the scheduler.
  }
}

export async function clearCache(key: FetcherKey): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_CACHE_PREFIX + key);
  } catch {}
}

// ─── Umbrella userdata I/O ───────────────────────────────────────────────────

export async function readUserData(): Promise<SteamUserData | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_USERDATA);
    if (!raw) return null;
    return JSON.parse(raw) as SteamUserData;
  } catch {
    return null;
  }
}

export async function writeUserData(d: SteamUserData): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_USERDATA, JSON.stringify(d));
  } catch {}
}

// ─── Session state ───────────────────────────────────────────────────────────

export type SessionState = 'signed-in' | 'expired';

export async function readSessionState(): Promise<SessionState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SESSION_STATE);
    if (raw === 'signed-in' || raw === 'expired') return raw;
    return null;
  } catch {
    return null;
  }
}

export async function writeSessionState(s: SessionState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_SESSION_STATE, s);
  } catch {}
}

// ─── Reset (sign-out) ────────────────────────────────────────────────────────

/** Clear every @steam/* key. Called from SteamAuth.signOut() after the
 *  CookieManager has been cleared for the Steam domains. */
export async function clearAllSteamStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith('@steam/'));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {}
}

// ─── Empty seed ──────────────────────────────────────────────────────────────

export function emptyUserData(): SteamUserData {
  return {
    identity: null,
    account: null,
    library: null,
    wishlist: null,
    inventory: null,
    market: null,
    social: null,
    ugc: null,
    prefs: null,
    meta: {},
  };
}
