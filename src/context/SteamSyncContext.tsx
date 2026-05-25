/**
 * SteamSyncContext - keeps `profile.ownedAppids` in sync with Steam.
 *
 * The initial sign-in is just a snapshot. After that, this provider mounts
 * a 0×0 invisible WebView pointed at `/dynamicstore/userdata/`. The Steam
 * session cookie persists in the Android WebView cookie jar, so each refresh
 * uses it automatically - same authenticated context the user signed in
 * with originally, no new login needed until the session genuinely expires.
 *
 * Refresh triggers:
 *  • app foregrounds (AppState → 'active')
 *  • a screen calls `useSteamSync().refreshLibrary()` (ProfileScreen wires
 *    this into useFocusEffect)
 *  • the WebView mounts for the first time (one-shot at app launch)
 *
 * The refresh is silent: the existing `ownedAppids` stay visible while the
 * refresh runs. If the response is missing `rgOwnedApps` (logged out / 2FA
 * required) we leave the cached list alone - better stale than empty.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useProfile } from './ProfileContext';

// We load /account/ instead of /dynamicstore/userdata directly. Why:
//   1. /account/ requires authentication. When the WebView has only a
//      steamcommunity.com cookie (e.g. after a sign-out that wiped the
//      store-domain jar, or any time the store cookie has expired),
//      Steam's auth check on /account/ initiates a cross-domain JWT
//      refresh - it 302-chains through login.steampowered.com, which
//      uses the community cookie to mint a fresh JWT and set
//      steamLoginSecure on store.steampowered.com via /login/transfer.
//   2. Once the redirect chain lands back on /account/, the page is
//      rendered WITH the store cookies in the jar.
//   3. Our injected JS then fetches /dynamicstore/userdata from the same
//      origin - cookies attach automatically and the response is real.
// If the user has NO community cookie either (fully signed out), /account/
// redirects to the login form and the inner fetch returns the anonymous
// empty payload - handled by the defensive check in handleMessage below.
const USERDATA_URL = 'https://store.steampowered.com/account/';

const INJECTED_JS = `
  (function() {
    try {
      fetch('/dynamicstore/userdata/?id=&l=', { credentials: 'include' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data && Array.isArray(data.rgOwnedApps)) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              kind: 'sync-ok',
              ownedAppids: data.rgOwnedApps,
              wishlistAppids: Array.isArray(data.rgWishlist) ? data.rgWishlist : [],
            }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'sync-empty' }));
          }
        })
        .catch(function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            kind: 'sync-error', message: String(e && e.message || e),
          }));
        });
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        kind: 'sync-error', message: String(e && e.message || e),
      }));
    }
    true;
  })();
`;

interface SteamSyncValue {
  /** Triggers an immediate background refresh of `profile.ownedAppids`.
   *  Safe to call from any screen - no-op if the user isn't Steam-linked. */
  refreshLibrary: () => void;
  /** True while the hidden WebView is in flight on a refresh. */
  refreshing: boolean;
}

const SteamSyncContext = createContext<SteamSyncValue>({
  refreshLibrary: () => {},
  refreshing: false,
});

export const useSteamSync = () => useContext(SteamSyncContext);

export const SteamSyncProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { profile, linked, setLinkedProfile } = useProfile();

  // `tick` re-keys the WebView each time we want a fresh fetch. Re-mounting
  // is heavier than calling .reload() but guarantees `injectedJavaScript`
  // fires again and avoids any stale-DOM weirdness - the page is just a
  // JSON blob, so the cost is small.
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  /** A refresh round-trip is in progress. Used to drop overlapping calls
   *  from AppState 'active' + Profile useFocusEffect that fire on the same
   *  wake-up tick - they coalesce into one network hit, not two. There is
   *  intentionally NO time-based throttle: every Profile open re-checks
   *  Steam live. */
  const inFlight = useRef(false);

  const stuckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStuckTimer = useCallback(() => {
    if (stuckTimer.current !== null) {
      clearTimeout(stuckTimer.current);
      stuckTimer.current = null;
    }
  }, []);

  const refreshLibrary = useCallback(() => {
    if (!linked) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    setTick((t) => t + 1);
    // Safety net: if the WebView never reports back (network down, page
    // hangs, postMessage swallowed) release the in-flight flag after a
    // generous timeout so the next refresh attempt can proceed.
    clearStuckTimer();
    stuckTimer.current = setTimeout(() => {
      inFlight.current = false;
      setRefreshing(false);
      stuckTimer.current = null;
    }, 20_000);
  }, [linked, clearStuckTimer]);

  // Auto-refresh whenever the app comes back to the foreground. Most "I
  // bought a game on Steam, then opened the app" flows hit this.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshLibrary();
    });
    return () => sub.remove();
  }, [refreshLibrary]);

  const handleMessage = useCallback(
    (event: any) => {
      inFlight.current = false;
      setRefreshing(false);
      clearStuckTimer();
      try {
        const payload = JSON.parse(event?.nativeEvent?.data ?? '{}');
        if (
          payload.kind === 'sync-ok' &&
          Array.isArray(payload.ownedAppids)
        ) {
          const ownedAppids: number[] = payload.ownedAppids;
          const wishlistAppids: number[] = Array.isArray(payload.wishlistAppids)
            ? payload.wishlistAppids
            : profile.wishlistAppids ?? [];

          // Defensive: dynamicstore returns a well-formed JSON with
          // `rgOwnedApps: []` for ANONYMOUS requests - looks identical to
          // a legitimately-empty library. Treating that as truth would
          // silently overwrite the user's real cached count with 0.
          // Skip ALL empty responses; the only people we deny a "real 0"
          // to are brand-new Steam accounts with no games yet - for them
          // fetchGamesCount() (the public HTML scrape, no cookies needed)
          // already supplies the correct 0 via profile.gamesCount, which
          // is what ProfileScreen falls back to when ownedAppids is undef
          // or empty.
          if (ownedAppids.length === 0) return;
          const prevOwned = profile.ownedAppids ?? [];
          // Only write back if either list actually changed - avoids
          // re-triggering downstream effects (PICS scan, etc.) on every
          // refresh.
          const prevWish = profile.wishlistAppids ?? [];
          const ownedSame =
            prevOwned.length === ownedAppids.length &&
            ownedAppids.every((a, i) => a === prevOwned[i]);
          const wishSame =
            prevWish.length === wishlistAppids.length &&
            wishlistAppids.every((a, i) => a === prevWish[i]);
          if (ownedSame && wishSame) return;
          setLinkedProfile({
            ...profile,
            ownedAppids,
            wishlistAppids,
            gamesCount: String(ownedAppids.length),
          });
        }
        // sync-empty / sync-error: leave the cached list alone.
      } catch {
        // Malformed payload - keep stale data.
      }
    },
    [profile, setLinkedProfile],
  );

  return (
    <SteamSyncContext.Provider value={{ refreshLibrary, refreshing }}>
      {children}
      {linked && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            top: -1000,
            left: -1000,
            opacity: 0,
          }}
        >
          <WebView
            key={tick}
            source={{ uri: USERDATA_URL }}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            cacheEnabled={false}
            injectedJavaScript={INJECTED_JS}
            onMessage={handleMessage}
            // Both apex AND wildcard patterns: rn-webview's `*.` wildcard
            // only matches subdomains, so without the apex entries
            // requests to `https://steamcommunity.com/...` (no subdomain)
            // fail the whitelist and the library calls
            // Linking.canOpenURL on the URL - producing
            // "Can't open url: ..." LogBox warnings before our gate runs.
            originWhitelist={[
              'https://steampowered.com',
              'https://*.steampowered.com',
              'https://steamcommunity.com',
              'https://*.steamcommunity.com',
            ]}
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={false}
            // Custom handler - without one, react-native-webview's default
            // hits Linking.canOpenURL for any cross-window link (e.g. the
            // /id/<name>/badges and /friends sidebar links on Steam's
            // account page), surfacing "Can't open url: ..." LogBox
            // warnings. We just refuse non-Steam navigations silently.
            // Returning false aborts the navigation without delegating to
            // Linking.
            onShouldStartLoadWithRequest={(req) => {
              const u = req.url || '';
              return (
                u.startsWith('https://store.steampowered.com/') ||
                u.startsWith('https://steamcommunity.com/') ||
                u.startsWith('https://login.steampowered.com/') ||
                u.startsWith('https://help.steampowered.com/') ||
                u.startsWith('https://checkout.steampowered.com/')
              );
            }}
            style={{ width: 1, height: 1, backgroundColor: 'transparent' }}
          />
        </View>
      )}
    </SteamSyncContext.Provider>
  );
};
