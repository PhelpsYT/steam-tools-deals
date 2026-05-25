/**
 * webviewBridge — generalises the hidden-WebView pattern from
 * SteamSyncContext.tsx into a reusable promise-returning API.
 *
 * Why a singleton + queue: react-native-webview must live inside the
 * React tree. We expose a plain async function `bridgeRunOnce(uri, js)`
 * that everything else (the refresh scheduler, the fetchers) can call
 * without owning a WebView component themselves. The function enqueues
 * a request and the host component pops up to 3 in parallel — same
 * concurrency cap discussed in the plan (Steam rate-limits at roughly
 * 10 RPS per IP on community endpoints).
 *
 * Cookie behaviour: each WebView uses sharedCookiesEnabled +
 * thirdPartyCookiesEnabled, so every request implicitly carries the
 * Steam session cookie that SteamAuth's login modal landed in the jar.
 * The cookie never crosses the JS bridge — only the parsed page output
 * (whatever the injected JS posts back) does.
 *
 * Stuck-timer + inFlight: each request has a 20s timeout. The WebView
 * itself re-mounts per request (we render a fresh component with a new
 * key for each request); this guarantees injectedJavaScript fires every
 * time — same rationale as SteamSyncContext.tsx lines 80-83.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

const STUCK_TIMEOUT_MS = 20_000;
const MAX_CONCURRENT = 3;
// Both apex AND wildcard patterns are required: react-native-webview's
// originWhitelist wildcard `*.` only matches subdomains, so without the
// apex variants requests to `https://steamcommunity.com/...` (no
// subdomain) fail the whitelist and the library calls Linking.canOpenURL
// on the URL — surfacing "Can't open url: ..." LogBox warnings even
// before our onShouldStartLoadWithRequest gate runs. The wildcards still
// matter for redirects like login.steampowered.com.
const STEAM_ORIGIN_WHITELIST = [
  'https://steampowered.com',
  'https://*.steampowered.com',
  'https://steamcommunity.com',
  'https://*.steamcommunity.com',
];

// ─── Default JS — extract document.body.innerText ─────────────────────────────

export const DEFAULT_INJECTED_JS = `
  (function() {
    try {
      var text = document.body ? document.body.innerText : '';
      window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'ok', text: text }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'err', message: String(e && e.message || e) }));
    }
    true;
  })();
`;

// ─── Request / queue ─────────────────────────────────────────────────────────

interface BridgeRequest {
  id: number;
  uri: string;
  injectedJs: string;
  resolve: (text: string) => void;
  reject: (err: Error) => void;
}

let nextRequestId = 1;
const queue: BridgeRequest[] = [];

/** Notification function the host installs so the queue can wake it. */
let notifyHost: (() => void) | null = null;

/**
 * Public API. Loads `uri` in a hidden WebView, runs `injectedJs` against
 * the loaded page (default: extract document.body.innerText), and
 * resolves with whatever string the injected JS posts back via
 * `window.ReactNativeWebView.postMessage`.
 *
 * The injected JS MUST post a JSON object of shape:
 *   { kind: 'ok', text: '<payload>' }
 *   { kind: 'err', message: '<reason>' }
 * Anything else is treated as an unrecognised response (rejection).
 */
export function bridgeRunOnce(uri: string, injectedJs?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push({
      id: nextRequestId++,
      uri,
      injectedJs: injectedJs ?? DEFAULT_INJECTED_JS,
      resolve,
      reject,
    });
    if (notifyHost) notifyHost();
  });
}

// ─── Host component ──────────────────────────────────────────────────────────

interface ActiveRequest extends BridgeRequest {
  startedAt: number;
}

/**
 * Mount once near the top of the React tree (inside SteamAuthProvider).
 * Drains the queue, mounts up to MAX_CONCURRENT hidden WebViews, and
 * resolves each promise as its WebView reports back.
 */
export const WebViewBridgeHost: React.FC = () => {
  const [active, setActive] = useState<ActiveRequest[]>([]);
  // We use a ref to mirror `active` so the queue-pump (which runs outside
  // React's render cycle) can read the current set without stale state.
  const activeRef = useRef<ActiveRequest[]>([]);
  activeRef.current = active;

  // Install the queue-wake hook. The bridgeRunOnce singleton calls
  // notifyHost() after every enqueue.
  useEffect(() => {
    const pump = () => {
      // Move up to (MAX_CONCURRENT - active.length) requests from the
      // queue into active state.
      const room = MAX_CONCURRENT - activeRef.current.length;
      if (room <= 0 || queue.length === 0) return;
      const taken = queue.splice(0, room);
      const now = Date.now();
      const newlyActive: ActiveRequest[] = taken.map((r) => ({
        ...r,
        startedAt: now,
      }));
      setActive((prev) => [...prev, ...newlyActive]);
    };
    notifyHost = pump;
    // Kick once on mount in case queue items arrived before the host
    // existed.
    pump();
    return () => {
      notifyHost = null;
    };
  }, []);

  // Watchdog: reject anything that's been running > STUCK_TIMEOUT_MS.
  useEffect(() => {
    if (active.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const stuck = activeRef.current.filter(
        (r) => now - r.startedAt > STUCK_TIMEOUT_MS,
      );
      if (stuck.length === 0) return;
      for (const r of stuck) r.reject(new Error('webview_bridge_timeout'));
      setActive((prev) => prev.filter((r) => !stuck.includes(r)));
    }, 2_000);
    return () => clearInterval(timer);
  }, [active.length]);

  const handleMessage = (r: ActiveRequest, ev: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(ev.nativeEvent.data ?? '{}');
      if (payload?.kind === 'ok' && typeof payload.text === 'string') {
        r.resolve(payload.text);
      } else if (payload?.kind === 'err') {
        r.reject(new Error(String(payload.message || 'bridge_err')));
      } else {
        r.reject(new Error('bridge_bad_payload'));
      }
    } catch {
      r.reject(new Error('bridge_bad_json'));
    }
    setActive((prev) => prev.filter((p) => p.id !== r.id));
    // Pump again — there may be queued requests waiting for a free slot.
    notifyHost?.();
  };

  return (
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
      {active.map((r) => (
        <WebView
          key={r.id}
          source={{ uri: r.uri }}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          cacheEnabled={false}
          injectedJavaScript={r.injectedJs}
          onMessage={(ev) => handleMessage(r, ev)}
          onError={() => {
            r.reject(new Error('webview_error'));
            setActive((prev) => prev.filter((p) => p.id !== r.id));
            notifyHost?.();
          }}
          originWhitelist={STEAM_ORIGIN_WHITELIST}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          // Custom navigation gate — without one, react-native-webview's
          // default handler calls Linking.canOpenURL for any cross-window
          // link (e.g. /id/<name>/badges, /friends sidebar items on Steam
          // pages), surfacing "Can't open url: ..." LogBox warnings. We
          // silently refuse any navigation that isn't on a Steam domain.
          onShouldStartLoadWithRequest={(req) => {
            const u = req.url || '';
            return (
              u.startsWith('https://store.steampowered.com/') ||
              u.startsWith('https://steamcommunity.com/') ||
              u.startsWith('https://login.steampowered.com/') ||
              u.startsWith('https://help.steampowered.com/') ||
              u.startsWith('https://checkout.steampowered.com/') ||
              u.startsWith('https://api.steampowered.com/')
            );
          }}
          style={{ width: 1, height: 1, backgroundColor: 'transparent' }}
        />
      ))}
    </View>
  );
};
