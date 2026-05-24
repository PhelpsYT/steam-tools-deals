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

const USERDATA_URL =
  'https://store.steampowered.com/dynamicstore/userdata/?id=&l=';

const INJECTED_JS = `
  (function() {
    try {
      var data = JSON.parse(document.body.innerText);
      if (data && Array.isArray(data.rgOwnedApps)) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          kind: 'sync-ok',
          ownedAppids: data.rgOwnedApps,
          wishlistAppids: Array.isArray(data.rgWishlist) ? data.rgWishlist : [],
        }));
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          kind: 'sync-empty',
        }));
      }
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        kind: 'sync-error',
        message: String(e && e.message || e),
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
          // Only write back if either list actually changed - avoids
          // re-triggering downstream effects (PICS scan, etc.) on every
          // refresh.
          const prevOwned = profile.ownedAppids ?? [];
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
            originWhitelist={['https://*.steampowered.com', 'https://*.steamcommunity.com']}
            style={{ width: 1, height: 1, backgroundColor: 'transparent' }}
          />
        </View>
      )}
    </SteamSyncContext.Provider>
  );
};
