/**
 * webapi_token — session-bound token Steam mints on demand for any
 * logged-in browser session. Many api.steampowered.com endpoints
 * (IWishlistService/GetWishlist, IPlayerService/*, ILoyaltyRewardsService/*,
 * IStoreBrowseService/GetItems, ...) accept this token in place of a
 * developer Web API key.
 *
 * Why we use it instead of a developer key:
 *   - A developer Web API key is registered to a single domain, and
 *     embedding one would force everyone using this open-source app to
 *     share rate limits with the original developer (or worse — leak
 *     the key on every commit).
 *   - The webapi_token is bound to the user's session cookie. It works
 *     only for their account, expires when their session does, and is
 *     unguessable. No shared trust.
 *
 * Source: store.steampowered.com/pointssummary/ajaxgetasyncconfig
 *   { success: true, data: { webapi_token: "..." } }
 *
 * Cached in-memory for 24h. We deliberately do NOT persist this token to
 * AsyncStorage: it is a session-bound bearer credential, and AsyncStorage on
 * Android is unencrypted SharedPreferences (similarly an unencrypted plist
 * on iOS). Keeping it in JS memory only means it dies with the process —
 * worst case is one extra request to /pointssummary/ajaxgetasyncconfig on
 * cold start to mint a fresh token from the persistent cookie jar (which is
 * the one and only credential that lives across launches, and lives only in
 * the OS-managed sandboxed cookie store — see SteamAuth.tsx §3).
 *
 * We refetch on 401 from any endpoint that uses it (handled per-fetcher).
 */
import { bridgeRunOnce } from './webviewBridge';

const TOKEN_URL = 'https://store.steampowered.com/pointssummary/ajaxgetasyncconfig';
const TTL_MS = 24 * 60 * 60 * 1000;

let cachedToken: { token: string; at: number } | null = null;

const TOKEN_INJECTED_JS = `
  (function() {
    try {
      var text = document.body ? document.body.innerText : '';
      var obj = JSON.parse(text);
      var token = obj && obj.data && obj.data.webapi_token;
      if (typeof token === 'string' && token.length > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'ok', text: token }));
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'err', message: 'no_token_in_response' }));
      }
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'err', message: String(e && e.message || e) }));
    }
    true;
  })();
`;

/** Single in-flight promise — coalesces concurrent calls into one fetch. */
let inFlight: Promise<string | null> | null = null;

/**
 * Returns a valid webapi_token, or null if the session is unauthenticated /
 * the token endpoint failed. Caller MUST handle the null path (most
 * fetchers can fall back to WebView-based HTML scrapes).
 */
export async function getWebApiToken(force = false): Promise<string | null> {
  if (!force && cachedToken && Date.now() - cachedToken.at < TTL_MS) {
    return cachedToken.token;
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const token = await bridgeRunOnce(TOKEN_URL, TOKEN_INJECTED_JS);
      if (!token) return null;
      cachedToken = { token, at: Date.now() };
      return token;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Wipe the in-memory token. Called from signOut so a subsequent sign-in
 *  for a different account can't reuse the previous user's token in the
 *  window before the next fetcher 401s. */
export function clearCachedWebApiToken(): void {
  cachedToken = null;
}
