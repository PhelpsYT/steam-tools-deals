/**
 * Steam OpenID 2.0 helpers. Pure functions - no React, no I/O state.
 *
 * Flow recap (see SteamAuth.ts for the full security narrative):
 *   1. buildLoginUrl(nonce)         → URL the WebView loads.
 *   2. user logs in inside Steam's real login page; Steam redirects to
 *      `steamtoolsdeals://auth?openid.claimed_id=…&…&nonce=<nonce>`.
 *   3. parseReturnTo(url)            → extracts the OpenID params + steamId.
 *   4. checkAuthentication(params)   → posts params back to Steam with
 *                                       openid.mode=check_authentication.
 *                                       Returns true only if Steam signs
 *                                       off on the claim - the cryptographic
 *                                       guarantee against forged deep links.
 */

import * as Crypto from 'expo-crypto';

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
/**
 * Steam OpenID rejects non-http(s) `openid.return_to` URLs - including
 * Expo app schemes like steamtoolsdeals:// - with "Invalid return
 * protocol". We must use an HTTPS URL. We never actually load it; the
 * WebView's onShouldStartLoadWithRequest fires before any network
 * fetch is attempted, so we intercept the redirect there and tear the
 * modal down before the URL is resolved. The .app domain we use here
 * is reserved (HSTS-preloaded HTTPS only) so a stray load attempt would
 * fail cleanly - but the interceptor always wins the race in practice.
 */
const RETURN_TO    = 'https://steamtoolsdeals.app/auth';
const REALM        = 'https://steamtoolsdeals.app/';
const IDENTITY_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';

/** SteamID64 - this constant = accountId. Documented as
 *  76561197960265728 (the SteamID64 of the first-ever Steam account). */
const STEAMID64_BASE = 76561197960265728n;

// ─── Nonce ───────────────────────────────────────────────────────────────────

/** Cryptographically-random 32-byte nonce, base64url-encoded. Bound into
 *  the return_to query string so a captured deep link cannot be replayed
 *  in a later session (the in-memory nonce won't match). */
export async function generateNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  // RN doesn't expose Buffer; build the encoding manually to avoid pulling
  // in a polyfill.
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = (globalThis as any).btoa
    ? (globalThis as any).btoa(bin)
    : fallbackBtoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function fallbackBtoa(s: string): string {
  // Tiny btoa for environments without globalThis.btoa. Input is binary
  // (each char ∈ [0,255]).
  let out = '';
  for (let i = 0; i < s.length; i += 3) {
    const a = s.charCodeAt(i);
    const b = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
    const c = i + 2 < s.length ? s.charCodeAt(i + 2) : 0;
    const triplet = (a << 16) | (b << 8) | c;
    out +=
      B64_ALPHABET[(triplet >> 18) & 0x3f] +
      B64_ALPHABET[(triplet >> 12) & 0x3f] +
      (i + 1 < s.length ? B64_ALPHABET[(triplet >> 6) & 0x3f] : '=') +
      (i + 2 < s.length ? B64_ALPHABET[triplet & 0x3f] : '=');
  }
  return out;
}

// ─── URL construction ────────────────────────────────────────────────────────

export function buildLoginUrl(nonce: string): string {
  const params = new URLSearchParams({
    'openid.ns':         'http://specs.openid.net/auth/2.0',
    'openid.mode':       'checkid_setup',
    'openid.return_to':  `${RETURN_TO}?nonce=${encodeURIComponent(nonce)}`,
    'openid.realm':      REALM,
    'openid.identity':   IDENTITY_SELECT,
    'openid.claimed_id': IDENTITY_SELECT,
  });
  return `${STEAM_OPENID}?${params.toString()}`;
}

// ─── Return-URL parsing ──────────────────────────────────────────────────────

export interface OpenIdReturn {
  /** All openid.* params, ready to be POSTed back as check_authentication. */
  params: Record<string, string>;
  /** SteamID64 extracted from openid.claimed_id. */
  steamId64: string;
  /** accountId = steamId64 - STEAMID64_BASE. Useful for /miniprofile URLs. */
  accountId: number;
  /** The nonce we bound into the original return_to. */
  nonce: string | null;
}

const CLAIMED_ID_RE = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

export function parseReturnTo(url: string): OpenIdReturn | null {
  // The url is `steamtoolsdeals://auth?openid.…&nonce=…`. URLSearchParams
  // can parse the query if we strip the scheme prefix.
  const queryIdx = url.indexOf('?');
  if (queryIdx < 0) return null;
  const qs = url.slice(queryIdx + 1);
  const usp = new URLSearchParams(qs);

  const claimed = usp.get('openid.claimed_id');
  if (!claimed) return null;
  const m = CLAIMED_ID_RE.exec(claimed);
  if (!m) return null;
  const steamId64 = m[1];
  const accountId = Number(BigInt(steamId64) - STEAMID64_BASE);

  // Re-collect every openid.* param into a plain object - these are the
  // exact bytes we must POST back for check_authentication.
  const params: Record<string, string> = {};
  for (const [k, v] of usp.entries()) {
    if (k.startsWith('openid.')) params[k] = v;
  }

  return { params, steamId64, accountId, nonce: usp.get('nonce') };
}

// ─── check_authentication (signature verification) ───────────────────────────

/**
 * Steam OpenID 2.0 verification step. The redirect URL is NOT signed by a
 * key we hold - anyone could craft `steamtoolsdeals://auth?openid.…`. The
 * only trustworthy verification path is to POST the params back to Steam
 * with openid.mode=check_authentication. Steam responds with a small text
 * body containing `is_valid:true` or `is_valid:false`. Only Steam can mint
 * the HMAC of the signed fields against the OpenID association handle it
 * issued, so a `true` response means the claim genuinely came from Steam.
 *
 * No cookies / auth headers needed here - this endpoint is open.
 */
export async function checkAuthentication(params: Record<string, string>): Promise<boolean> {
  const body = new URLSearchParams(params);
  body.set('openid.mode', 'check_authentication');
  try {
    const resp = await fetch(STEAM_OPENID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) return false;
    const text = await resp.text();
    return /is_valid\s*:\s*true/i.test(text);
  } catch {
    return false;
  }
}
