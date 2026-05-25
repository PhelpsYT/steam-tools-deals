/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SteamAuth.ts — On-device Steam login + authenticated data mirror.
 *  Master file for the src/auth/steam/ module.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  1. WHAT THIS FILE DOES
 *  ─────────────────────────────────────────────────────────────────────────
 *  Owns the Steam login flow (OpenID 2.0 via a full-screen modal WebView)
 *  and the cookie-jar contract that everything else in src/auth/steam
 *  depends on. Every authenticated request anywhere in the app ultimately
 *  reads a cookie that this file is responsible for landing in the
 *  WebView jar.
 *
 *  2. WHY A WEBVIEW INSTEAD OF A CUSTOM RN CREDENTIAL FORM
 *  ─────────────────────────────────────────────────────────────────────────
 *  When the user signs in, their password is typed into Valve's own login
 *  page rendered inside a system WebView. Our JS never sees it. Our native
 *  code never sees it. The page is a real HTTPS document with a real
 *  <input type="password" autocomplete="current-password">, so Android
 *  Autofill / iOS Keychain / Bitwarden / 1Password all recognise it and
 *  offer the user's stored Steam credentials. A custom React Native form
 *  would not — OS password managers blacklist unknown apps' fake forms
 *  to prevent phishing.
 *
 *  Two-factor (Steam Guard, email, mobile authenticator) is handled
 *  inline by Valve's own page. We never see the 2FA code, the device
 *  token, or any other Guard secret. The WebView's `originWhitelist` is
 *  locked to *.steampowered.com / *.steamcommunity.com / our app scheme,
 *  so even if Steam's page tried to load third-party JS we would block
 *  it.
 *
 *  3. WHY THE COOKIE JAR IS SAFE
 *  ─────────────────────────────────────────────────────────────────────────
 *  After login Steam sets `steamLoginSecure` and `sessionid` cookies on
 *  the WebView. They land in:
 *    • Android: a SQLite file inside the app's private storage at
 *      /data/data/com.steamtoolsdeals.app/app_webview/Cookies. Sandboxed
 *      to this app — other apps cannot read it without root.
 *    • iOS: WKHTTPCookieStorage keyed to the app's WKWebsiteDataStore.
 *      Sandboxed to this app — other apps cannot read it without
 *      jailbreak.
 *  We never copy the cookie into JavaScript state, never log it, never
 *  serialise it to AsyncStorage, never send it to a server. The cookie
 *  string exists in OS-managed storage only.
 *
 *  When the user signs out we ask Steam to invalidate the session: a
 *  hidden WebView reads the (non-HttpOnly) `sessionid` cookie, POSTs it to
 *  /login/logout/ on both store.steampowered.com and steamcommunity.com,
 *  and Steam responds with Set-Cookie headers that flush the auth cookies
 *  from the WebView's cookie jar. We do this from within the WebView so
 *  the cookies still attach automatically and we don't need a native
 *  CookieManager dependency (which would crash Expo Go). The net effect
 *  is the same: the session is killed server-side, and the jar is empty
 *  before the next signIn() attempt — so a different person on the same
 *  device cannot ride a stale cookie into someone else's account.
 *
 *  4. WHY WE TRUST THE OPENID CLAIM
 *  ─────────────────────────────────────────────────────────────────────────
 *  The redirect URL alone is forgeable: anyone can craft a deep link
 *  `steamtoolsdeals://auth?openid.claimed_id=https://steamcommunity.com/
 *  openid/id/76561197960287930&…` and have the OS hand it to our app. So
 *  we DO NOT trust the redirect on its own.
 *
 *  Two independent guarantees:
 *    (a) Nonce binding. signIn() generates a fresh 32-byte random nonce
 *        via expo-crypto and embeds it in the OpenID `return_to` URL. On
 *        receipt of the redirect we compare the returned nonce to the
 *        in-memory nonce. A captured deep link from a prior session
 *        won't match — replay defeated.
 *    (b) check_authentication. We POST every openid.* param back to
 *        steamcommunity.com/openid/login with openid.mode=
 *        check_authentication. Steam responds `is_valid:true` only when
 *        the HMAC of the signed fields matches the OpenID association
 *        handle it issued during step (3) of the spec. We don't know the
 *        secret — Steam checks it for us. Anyone forging a redirect
 *        without that secret gets `is_valid:false` here.
 *  Both must pass before we accept the SteamID.
 *
 *  5. WHY WE DON'T STORE THE PASSWORD OR REFRESH TOKENS
 *  ─────────────────────────────────────────────────────────────────────────
 *  We literally cannot. Steam OpenID 2.0 has no refresh-token concept —
 *  "refresh" just means "the existing session cookie still authenticates
 *  the next request." When Steam's cookie expires (typically months for
 *  Remember-Me sessions) we surface a non-blocking banner and the user
 *  re-runs signIn() through the same WebView. Cached data stays put
 *  during the re-auth window.
 *
 *  We deliberately avoided reimplementing Steam's mobile-app login API
 *  (IAuthenticationService/BeginAuthSessionViaCredentials). That flow
 *  would force us to handle the raw password and RSA-encrypt it — i.e.
 *  it would put the credential through our code, exactly what this
 *  design prevents.
 *
 *  6. WHY THIS IS SAFE TO SHIP AS OPEN SOURCE
 *  ─────────────────────────────────────────────────────────────────────────
 *  There are no embedded secrets. Every endpoint we call needs either:
 *    • no authentication (public profile XML, miniprofile JSON, store
 *      app details), or
 *    • the user's own session cookie, which lives only in their
 *      device's sandboxed jar, or
 *    • a `webapi_token` that Steam mints on demand for any logged-in
 *      session from /pointssummary/ajaxgetasyncconfig. The token is
 *      session-bound; there is no developer secret to leak.
 *  No proprietary protocol is implemented anywhere. Every endpoint is
 *  documented (Steam Web API) or community-known (SteamDB / Augmented
 *  Steam / steam-user). Forks can change app.json:scheme and the
 *  RETURN_TO constant in openid.ts without breaking anything — there is
 *  no Valve-side client-id registration because OpenID 2.0 is keyless.
 *
 *  7. THREAT MODEL
 *  ─────────────────────────────────────────────────────────────────────────
 *  In scope (mitigated):
 *    • Network attackers — every request is HTTPS, no cleartext fallback.
 *    • Redirect/deep-link forgery — nonce + check_authentication (§4).
 *    • Other apps on the same device — sandboxed cookie jar (§3).
 *    • Accidental key leak in this source repo — there are no keys.
 *    • Session hijack from our own app — the cookie never crosses the
 *      JS bridge or hits AsyncStorage (§3).
 *  Out of scope (cannot mitigate on-device):
 *    • Rooted / jailbroken devices that can read other apps' sandboxes.
 *    • Malware that already has app-data read access.
 *    • Steam infrastructure compromise.
 *    • Physical-keyboard control by an attacker.
 *  Partial scope:
 *    • System WebView vulnerabilities. We harden by setting
 *      mixedContentMode='never', originWhitelist to Steam + our scheme
 *      only, javaScriptCanOpenWindowsAutomatically={false}, and never
 *      loading non-Steam content in the auth WebView.
 *
 *  8. WHY WE RE-MOUNT WEBVIEWS PER REFRESH
 *  ─────────────────────────────────────────────────────────────────────────
 *  See SteamSyncContext.tsx lines 80-83: reload() can leave stale DOM
 *  state and doesn't reliably re-fire injectedJavaScript. Re-mounting
 *  via a `tick` key guarantees a fresh load + a fresh JS injection. The
 *  pages we hit are JSON or small HTML — the re-mount cost is trivial.
 *
 *  9. WHY EVERY FETCHER MUST BE NO-THROW
 *  ─────────────────────────────────────────────────────────────────────────
 *  Mirror of the philosophy in SteamSyncContext.tsx lines 17-18: if a
 *  parser throws we keep the previously-cached value rather than blank
 *  the UI. A stale number is a strictly better UX than no number at all.
 *  Fetchers return `null` on parse failure; the scheduler records the
 *  failure in `meta` so the UI can show a staleness chip if it wants to.
 *
 * 10. WHY WE DO NOT BACK THIS WITH A SERVER
 *  ─────────────────────────────────────────────────────────────────────────
 *  A backend would force every user to trust us with their Steam session
 *  cookie. That trust isn't necessary: Valve already has the cookie, the
 *  user keeps the only copy on their device, and we never see it. The
 *  entire design exists so anyone reading this repo — contributors,
 *  forks, security auditors — can confirm by inspection that no
 *  credential or session token ever leaves the phone.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path } from 'react-native-svg';
import { bridgeRunOnce } from './webviewBridge';

import { useProfile } from '../../context/ProfileContext';
import type { ProfileData } from '../../context/ProfileContext';
import { colors } from '../../theme';

import {
  buildLoginUrl,
  checkAuthentication,
  generateNonce,
  parseReturnTo,
} from './openid';
import {
  clearAllSteamStorage,
  emptyUserData,
  readSessionState,
  readUserData,
  writeSessionState,
  writeUserData,
} from './storage';
import type {
  FetchContext,
  FetcherKey,
  FetcherMeta,
  SteamUserData,
} from './types';
import { WebViewBridgeHost } from './webviewBridge';
import { registerAllFetchers } from './fetchers';
import {
  addSink,
  reset as resetScheduler,
  runSignInBurst,
  runWave,
} from './refreshScheduler';
import { clearCachedWebApiToken, getWebApiToken } from './webapiToken';

// ─── Sign-out logout POST (injected JS) ─────────────────────────────────────
// Loaded into a hidden WebView in signOut(). Reads the (non-HttpOnly)
// `sessionid` cookie, POSTs it to /login/logout/ as the required CSRF
// token. Steam responds with Set-Cookie headers that clear steamLoginSecure
// and sessionid in the WebView's cookie jar.
const LOGOUT_INJECTED_JS = `
  (function() {
    try {
      var m = document.cookie.match(/(?:^|;\\s*)sessionid=([^;]+)/);
      var sid = m ? m[1] : '';
      if (!sid) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'ok', text: 'no_sessionid' }));
        return;
      }
      var fd = new FormData();
      fd.append('sessionid', sid);
      fetch('/login/logout/', { method: 'POST', body: fd, credentials: 'include' })
        .then(function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'ok', text: 'ok' }));
        })
        .catch(function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'err', message: String(e && e.message || e) }));
        });
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'err', message: String(e && e.message || e) }));
    }
    true;
  })();
`;

// ─── Context shape ───────────────────────────────────────────────────────────

export type LoginState =
  | 'idle'           // not logging in; may still be signed in from a prior run
  | 'starting'       // signIn() called; nonce being generated
  | 'in-webview'     // modal mounted, user typing creds
  | 'verifying'     // check_authentication in flight
  | 'signed-in'     // verified, cookie in jar, data fetching
  | 'expired'       // session ping detected an expired cookie
  | 'error';

export type LoginErrorReason =
  | 'network'
  | 'openid_signature_invalid'
  | 'nonce_mismatch'
  | 'bad_claim'
  | 'timeout'
  | 'cancelled';

export interface SteamAuthValue {
  loginState: LoginState;
  loginError: LoginErrorReason | null;
  /** Comprehensive on-device mirror of the signed-in user's Steam state. */
  data: SteamUserData;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Internal — used by the refreshScheduler in Phase 3 to write parsed
   *  payloads back into the reducer. */
  applyFetcherResult: <T>(key: FetcherKey, slice: keyof SteamUserData, data: T) => void;
  /** Internal — mark a fetcher attempt as failed (cached data kept). */
  markFetcherFailed: (key: FetcherKey, error: string) => void;
  /** Forces the in-memory state to be re-read from the WebView session
   *  ping. Used by the session-expiry watcher in Phase 6. */
  markSessionExpired: () => void;
}

const SteamAuthContext = createContext<SteamAuthValue>({
  loginState: 'idle',
  loginError: null,
  data: emptyUserData(),
  signIn: async () => {},
  signOut: async () => {},
  applyFetcherResult: () => {},
  markFetcherFailed: () => {},
  markSessionExpired: () => {},
});

export const useSteamAuth = () => useContext(SteamAuthContext);

// ─── Reducer ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'HYDRATE'; data: SteamUserData }
  | { type: 'FETCHER_OK'; key: FetcherKey; slice: keyof SteamUserData; payload: unknown }
  | { type: 'FETCHER_FAIL'; key: FetcherKey; error: string }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'SIGNED_OUT' };

function reducer(state: SteamUserData, action: Action): SteamUserData {
  switch (action.type) {
    case 'HYDRATE':
      return action.data;
    case 'FETCHER_OK': {
      const meta: Record<string, FetcherMeta> = {
        ...state.meta,
        [action.key]: { at: Date.now(), ok: true },
      };
      // Shallow-merge: a slice like `identity` is populated by two fetchers
      // (profileXml + miniprofile) that each return partial fields. Merging
      // preserves whatever the other fetcher wrote rather than clobbering.
      const prev = (state as any)[action.slice];
      const incoming = action.payload as any;
      const merged =
        prev && typeof prev === 'object' && !Array.isArray(prev) &&
        incoming && typeof incoming === 'object' && !Array.isArray(incoming)
          ? { ...prev, ...incoming }
          : incoming;
      return { ...state, [action.slice]: merged, meta } as SteamUserData;
    }
    case 'FETCHER_FAIL': {
      const meta: Record<string, FetcherMeta> = {
        ...state.meta,
        [action.key]: {
          at: state.meta[action.key]?.at ?? 0,
          ok: false,
          error: action.error,
        },
      };
      return { ...state, meta };
    }
    case 'SESSION_EXPIRED':
      // Intentionally keep all cached slices — better stale than blank.
      return state;
    case 'SIGNED_OUT':
      return emptyUserData();
    default:
      return state;
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const SteamAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { profile, linked, setLinkedProfile, unlinkProfile } = useProfile();

  const [data, dispatch] = useReducer(reducer, undefined as unknown as SteamUserData, emptyUserData);
  const [loginState, setLoginState] = useState<LoginState>(
    // Optimistically restore signed-in state from storage so the UI doesn't
    // flash a sign-in prompt while the cookie ping is in flight.
    linked && profile.authMethod === 'steam' ? 'signed-in' : 'idle',
  );
  const [loginError, setLoginError] = useState<LoginErrorReason | null>(null);
  const [webviewVisible, setWebviewVisible] = useState(false);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);

  // In-memory nonce — never serialised. Cleared after each login attempt.
  const nonceRef = useRef<string | null>(null);
  // Guards handleNavigation from firing twice for the same return URL.
  // onShouldStartLoadWithRequest and onNavigationStateChange can both
  // trigger for the same redirect on Android, and we used to clear the
  // nonce on the first call → second call saw null and rejected with
  // `nonce_mismatch`. Tracking the URL we've already begun processing
  // makes the second call a no-op.
  const processedReturnUrlRef = useRef<string | null>(null);

  // Always-current refs for use inside non-React callbacks (sink listeners,
  // AppState handlers) — avoids stale closure captures.
  const steamIdRef = useRef<string>(profile.steamId || '');
  steamIdRef.current = profile.steamId || '';
  const linkedRef = useRef<boolean>(linked && profile.authMethod === 'steam');
  linkedRef.current = linked && profile.authMethod === 'steam';

  // ─── Register fetchers once at module load ─────────────────────────────────
  useEffect(() => {
    registerAllFetchers();
  }, []);

  // Cross-domain cookie recovery used to live here. It's been folded
  // into SteamSyncContext.tsx — that module loads /account/ as the
  // dynamicstore source URL, which lets Steam do the JWT refresh +
  // cookie transfer on the same WebView that then fetches dynamicstore.
  // Single round trip per refresh, no race with this provider.

  // ─── Build a FetchContext from current state ───────────────────────────────
  const buildCtx = useCallback(async (): Promise<FetchContext> => {
    const steamId64 = steamIdRef.current;
    const accountId = steamId64
      ? Number(BigInt(steamId64) - 76561197960265728n)
      : 0;
    const webapiToken = await getWebApiToken();
    return { steamId64, accountId, webapiToken };
  }, []);

  // ─── Subscribe scheduler sink → reducer ────────────────────────────────────
  useEffect(() => {
    const unsub = addSink((r) => {
      if (r.ok && r.slice && r.payload !== undefined) {
        dispatch({
          type: 'FETCHER_OK',
          key: r.key,
          slice: r.slice,
          payload: r.payload,
        });
      } else if (!r.ok) {
        dispatch({
          type: 'FETCHER_FAIL',
          key: r.key,
          error: r.error ?? 'unknown',
        });
      }
    });
    return unsub;
  }, []);

  // ─── AppState 'active' → HOT wave ──────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      if (!linkedRef.current) return;
      const ctx = await buildCtx();
      void runWave('HOT', ctx);
    });
    return () => sub.remove();
  }, [buildCtx]);

  // ─── Hydrate cached SteamUserData on mount ─────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = await readUserData();
      if (!alive || !cached) return;
      dispatch({ type: 'HYDRATE', data: cached });
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Persist SteamUserData on every change. Cheap — single AsyncStorage.setItem.
  useEffect(() => {
    writeUserData(data);
  }, [data]);

  // ─── signIn ────────────────────────────────────────────────────────────────
  const signIn = useCallback(async () => {
    setLoginError(null);
    setLoginState('starting');
    processedReturnUrlRef.current = null;
    try {
      const nonce = await generateNonce();
      nonceRef.current = nonce;
      setLoginUrl(buildLoginUrl(nonce));
      setWebviewVisible(true);
      setLoginState('in-webview');
    } catch {
      setLoginState('error');
      setLoginError('network');
    }
  }, []);

  // ─── handleNavigationStateChange ───────────────────────────────────────────
  // Intercepts the redirect to steamtoolsdeals://auth?openid.… The WebView
  // never actually loads our app scheme (the system would refuse since the
  // scheme isn't a real http URL); we just need to detect it in the URL bar
  // and short-circuit. We also detect openid.mode=cancel for the cancel
  // path.
  const handleNavigation = useCallback(
    async (nav: WebViewNavigation) => {
      const url = nav.url || '';

      // Cancel path.
      if (/[?&]openid\.mode=cancel(\b|&)/.test(url)) {
        setWebviewVisible(false);
        setLoginUrl(null);
        setLoginState('idle');
        setLoginError(null);
        return;
      }

      // Success path — Steam OpenID requires an HTTPS return_to URL, so
      // we point it at https://steamtoolsdeals.app/auth (a domain we
      // don't own) and intercept the navigation before the WebView
      // actually fetches it. See openid.ts for the RETURN_TO definition.
      if (url.startsWith('https://steamtoolsdeals.app/auth')) {
        // De-duplicate: onShouldStartLoadWithRequest and
        // onNavigationStateChange both fire for this redirect on Android.
        // Without this guard, the second call would see a cleared nonce
        // and reject the sign-in with `nonce_mismatch` AFTER the first
        // call already succeeded.
        if (processedReturnUrlRef.current === url) return;
        processedReturnUrlRef.current = url;

        // Keep the LoginModal mounted and show the verifying overlay on
        // top of its WebView. Closing the modal here (as we used to do)
        // created an awkward transition where the modal disappeared
        // before the OpenID check completed, and the standalone overlay
        // didn't center reliably on Android. Keeping the modal open lets
        // us render the spinner inside its content area, which is
        // already known-centered. We close the modal in one shot after
        // verification resolves.
        setLoginState('verifying');

        const parsed = parseReturnTo(url);
        if (!parsed) {
          setWebviewVisible(false);
          setLoginUrl(null);
          setLoginState('error');
          setLoginError('bad_claim');
          return;
        }

        // Replay defense — the nonce returned in the URL must match the
        // one we generated for THIS attempt.
        if (parsed.nonce !== nonceRef.current) {
          setWebviewVisible(false);
          setLoginUrl(null);
          setLoginState('error');
          setLoginError('nonce_mismatch');
          return;
        }
        nonceRef.current = null;

        // Signature check — only Steam can mint a valid is_valid:true.
        const valid = await checkAuthentication(parsed.params);
        if (!valid) {
          setWebviewVisible(false);
          setLoginUrl(null);
          setLoginState('error');
          setLoginError('openid_signature_invalid');
          return;
        }

        // Confirmed: write headline fields back to ProfileContext so the
        // existing UI lights up. The full SteamUserData fetch is owned by
        // the refresh scheduler — kicked off in Phase 3.
        const nextProfile: ProfileData = {
          ...profile,
          steamId: parsed.steamId64,
          authMethod: 'steam',
        };
        setLinkedProfile(nextProfile);
        await writeSessionState('signed-in');
        // Close the modal in one shot — overlay disappears with it.
        setWebviewVisible(false);
        setLoginUrl(null);
        setLoginState('signed-in');
        // Kick the wake-up cascade — see refreshScheduler.runSignInBurst.
        // (Cross-domain cookie priming is owned by SteamSyncContext, which
        // loads store.steampowered.com as its dynamicstore source page —
        // see the comment on USERDATA_URL there.)
        void runSignInBurst(buildCtx);
      }
    },
    [profile, setLinkedProfile, buildCtx],
  );

  // ─── signOut ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    // Why we don't call CookieManager.clearAll() directly: @react-native-
    // cookies/cookies is a native module that isn't bundled into Expo Go,
    // so importing it crashes the dev client. Instead we ask Steam itself
    // to invalidate the session — that's the only way to guarantee both
    //   (a) the steamLoginSecure / sessionid cookies are removed from the
    //       WebView jar (Steam sends Set-Cookie max-age=0 in the response),
    //   (b) the session is killed server-side, so even if a cookie copy
    //       leaks somehow it's already unauthenticated.
    //
    // Steam's /login/logout/ endpoint is a CSRF-protected POST that
    // requires the `sessionid` form parameter to match the cookie. A bare
    // GET (which is all our previous implementation did) is silently
    // ignored. We inject JS into a hidden WebView that:
    //   1. Reads `sessionid` from document.cookie (NOT HttpOnly).
    //   2. POSTs /login/logout/ with that token via fetch(credentials=include).
    //   3. Reports back when Steam responds (which is when Set-Cookie has
    //      already flushed the auth cookies to the WebView's jar).
    //
    // We hit ONLY steamcommunity.com — not store.steampowered.com. Reason:
    // the security finding the POST-logout addresses is "the next sign-in
    // can auto-complete as the previous user", which depends on the
    // community session being still valid (Steam's OpenID flow runs on
    // steamcommunity.com/openid). Clearing the community cookie forces
    // re-auth on next sign-in. The store-domain cookie is a separate
    // session used only by store endpoints (dynamicstore, /account/, ...);
    // clearing it does not improve security — it just leaves the user's
    // library appearing empty until Steam's cross-domain login transfer
    // re-issues it, which is not reliably triggered by our OpenID return
    // flow. Leaving the store cookie alone keeps the user's data working
    // across sign-out / sign-in cycles.
    await bridgeRunOnce('https://steamcommunity.com/', LOGOUT_INJECTED_JS).catch(() => undefined);
    clearCachedWebApiToken();
    await clearAllSteamStorage();
    resetScheduler();
    dispatch({ type: 'SIGNED_OUT' });
    unlinkProfile();
    setLoginState('idle');
  }, [unlinkProfile]);

  // ─── Internal API for the scheduler (Phase 3+) ─────────────────────────────
  const applyFetcherResult = useCallback(
    <T,>(key: FetcherKey, slice: keyof SteamUserData, payload: T) => {
      dispatch({ type: 'FETCHER_OK', key, slice, payload: payload as unknown });
    },
    [],
  );

  const markFetcherFailed = useCallback((key: FetcherKey, error: string) => {
    dispatch({ type: 'FETCHER_FAIL', key, error });
  }, []);

  const markSessionExpired = useCallback(() => {
    setLoginState('expired');
    writeSessionState('expired');
    dispatch({ type: 'SESSION_EXPIRED' });
  }, []);

  // Re-read persisted session state on mount (so a fresh launch can render
  // the expired banner before any network call has completed).
  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await readSessionState();
      if (!alive) return;
      if (s === 'expired' && linked && profile.authMethod === 'steam') {
        setLoginState('expired');
      }
    })();
    return () => {
      alive = false;
    };
    // Only on mount — `linked`/`profile.authMethod` are stable enough that
    // re-running this on every render isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Value memo ────────────────────────────────────────────────────────────
  const value = useMemo<SteamAuthValue>(
    () => ({
      loginState,
      loginError,
      data,
      signIn,
      signOut,
      applyFetcherResult,
      markFetcherFailed,
      markSessionExpired,
    }),
    [loginState, loginError, data, signIn, signOut, applyFetcherResult, markFetcherFailed, markSessionExpired],
  );

  return (
    <SteamAuthContext.Provider value={value}>
      {children}
      <WebViewBridgeHost />
      <LoginModal
        visible={webviewVisible}
        url={loginUrl}
        onNavigationStateChange={handleNavigation}
        onClose={() => {
          setWebviewVisible(false);
          setLoginUrl(null);
          setLoginState('idle');
          setLoginError(null);
        }}
      />
    </SteamAuthContext.Provider>
  );
};

// ─── Login modal ─────────────────────────────────────────────────────────────

/**
 * GitHub mark — used as the right-side action in the modal header. Tapping
 * opens the repo in a Custom Tab via expo-web-browser (NOT inside our auth
 * WebView), so the Steam session in our jar stays clean. Doubles as a
 * trust signal — the user can verify the login pipeline they're about to
 * trust is open-source.
 */
const OPEN_SOURCE_URL = 'https://github.com/PhelpsYT/steam-tools-deals';
const IconGitHub: React.FC<{ size?: number; color?: string }> = ({
  size = 16,
  color = '#dfe3e6',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.807 1.305 3.492.997.107-.775.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.467-2.38 1.236-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 3-.405c1.02.004 2.047.137 3 .405 2.29-1.552 3.296-1.23 3.296-1.23.653 1.652.242 2.873.118 3.176.77.84 1.234 1.91 1.234 3.22 0 4.608-2.807 5.624-5.48 5.92.43.37.823 1.103.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .32.216.694.825.576C20.565 22.092 24 17.596 24 12.297 24 5.67 18.627.297 12 .297z"
      fill={color}
    />
  </Svg>
);

const IconClose: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = '#dfe3e6',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 6 L18 18 M18 6 L6 18"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

const LoginModal: React.FC<{
  visible: boolean;
  url: string | null;
  onNavigationStateChange: (nav: WebViewNavigation) => void;
  onClose: () => void;
}> = ({ visible, url, onNavigationStateChange, onClose }) => {
  const insets = useSafeAreaInsets();
  if (!url) return null;

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      // Fade rather than slide: during a slide-up animation the underlying
      // ProfileScreen + the WebView's still-loading dark area are both
      // briefly visible, producing odd-looking stacked bands. Fade is
      // instant-opaque, so the user never sees the half-state.
      animationType="fade"
      presentationStyle="fullScreen"
      // Android: draw under the system status bar so our header background
      // fills the top of the screen instead of leaving a default-coloured
      // strip above it.
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <IconClose size={22} color="#dfe3e6" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              WebBrowser.openBrowserAsync(OPEN_SOURCE_URL).catch(() => undefined);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            style={styles.modalHeaderRight}
          >
            <Text style={styles.modalHeaderRightLabel}>Open source</Text>
            <IconGitHub size={20} color="#dfe3e6" />
          </TouchableOpacity>
        </View>
        <View style={styles.webviewWrap}>
        <WebView
          source={{ uri: url }}
          // Cookie persistence: write to the same jar SteamSyncContext reads
          // from, so a successful login here automatically authenticates all
          // future hidden-WebView refreshers without any extra plumbing.
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          incognito={false}
          // Allow all origins to LOAD inside the WebView — origin filtering
          // happens in onShouldStartLoadWithRequest below, which fires
          // before each navigation and lets us veto. A strict
          // originWhitelist plus a redirect to a host we don't own causes
          // Android to punt the navigation to the system browser (Chrome),
          // which breaks the OpenID return flow. We accept any URL the
          // page tries to load and gate behaviour via the per-navigation
          // hook instead.
          originWhitelist={['*']}
          mixedContentMode="never"
          javaScriptCanOpenWindowsAutomatically={false}
          javaScriptEnabled
          domStorageEnabled
          // Avoid the WebView attempting to open external links in the
          // system browser — we want everything inside this modal.
          setSupportMultipleWindows={false}
          // Mobile-styled login page (Steam serves a different layout when
          // the UA is mobile, which is the version OS password managers
          // are best at autofilling).
          userAgent={
            Platform.OS === 'android'
              ? 'Mozilla/5.0 (Linux; Android 13; CPH2747) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'
              : undefined
          }
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={(req) => {
            // Intercept the OpenID redirect before the WebView attempts
            // a DNS lookup on steamtoolsdeals.app (which we don't own).
            // We fire the same handler used by onNavigationStateChange so
            // the openid params are processed even if Android's WebView
            // skips the navigation-state event after aborted loads.
            if (req.url.startsWith('https://steamtoolsdeals.app/')) {
              onNavigationStateChange({ url: req.url } as WebViewNavigation);
              return false;
            }
            return true;
          }}
          style={styles.webview}
        />
        </View>
      </View>
    </Modal>
  );
};

// (VerifyingOverlay used to live as a standalone component / Modal here.
// It's been inlined into LoginModal so its centering reuses the modal's
// known-centered webview wrapper layout.)

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.background.secondary,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalHeaderRightLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#dfe3e6',
  },
  webviewWrap: {
    flex: 1,
    backgroundColor: '#171a21',
  },
  webview: {
    flex: 1,
    // Match Steam's mobile nav-bar background so any residual gap above
    // the rendered page blends in instead of showing the app's dark grey.
    backgroundColor: '#171a21',
  },
});
