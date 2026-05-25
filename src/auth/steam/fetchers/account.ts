/**
 * Account fetchers — wallet, currency, country, email state, Steam Guard,
 * authorized devices, family share, licenses, wallet history, points.
 *
 * All endpoints under store.steampowered.com need the session cookie.
 * Most pages are HTML — we extract by scraping the embedded JS vars and
 * data-* attributes. Parsers are stubs for now; the scheduler still calls
 * them so the wiring is exercised. Filling in each parser is independent
 * and ships incrementally.
 */
import { register } from '../refreshScheduler';
import { DEFAULT_INJECTED_JS } from '../webviewBridge';
import type { FetcherSpec, SteamAccount } from '../types';

const WALLET_INJECTED_JS = `
  (function() {
    try {
      var raw = document.documentElement ? document.documentElement.outerHTML : '';
      window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'ok', text: raw }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'err', message: String(e && e.message || e) }));
    }
    true;
  })();
`;

const headline: FetcherSpec<Partial<SteamAccount>> = {
  key: 'account.headline',
  cadence: 'WARM',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/account/',
  injectedJs: WALLET_INJECTED_JS,
  parse: (html) => {
    try {
      // Best-effort wallet balance scrape. Steam serves the balance inside
      // <a class="global_action_link" id="header_wallet_balance">$12.34</a>
      // or a similarly-shaped element depending on locale.
      const m = /id=["']header_wallet_balance["'][^>]*>([^<]+)</.exec(html);
      const formatted = m ? m[1].trim() : '';
      if (!formatted) return null;
      return {
        walletBalance: { amount: 0, formatted, currency: '' },
        country: '',
        emailMasked: '',
        emailVerified: false,
        accountCreatedAt: '',
        steamGuardMode: 'none',
        hasMobileAuthenticator: false,
        hasBackupCodes: false,
        authorizedDevices: [],
        activeSessions: [],
        familyShare: { members: [], lenders: [], lendees: [] },
        licenses: [],
        walletHistory: [],
      };
    } catch {
      return null;
    }
  },
};

const history: FetcherSpec<unknown> = {
  key: 'account.history',
  cadence: 'WARM',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/account/history/',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const licenses: FetcherSpec<unknown> = {
  key: 'account.licenses',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/account/licenses/',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const devices: FetcherSpec<unknown> = {
  key: 'account.devices',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/account/managedevices/',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const twofactor: FetcherSpec<unknown> = {
  key: 'account.twofactor',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/twofactor/manage',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const family: FetcherSpec<unknown> = {
  key: 'account.family',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/account/familymanagement/',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const parental: FetcherSpec<unknown> = {
  key: 'account.parental',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/parental/',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const points: FetcherSpec<unknown> = {
  key: 'account.points',
  cadence: 'WARM',
  transport: 'fetch',
  buildUrl: (ctx) => {
    const t = ctx.webapiToken;
    if (!t) return '';
    return `https://api.steampowered.com/ILoyaltyRewardsService/GetSummary/v1/?access_token=${encodeURIComponent(t)}&steamid=${ctx.steamId64}`;
  },
  parse: () => null,
};

export function registerAccountFetchers(): void {
  register(headline, 'account');
  register(history, 'account');
  register(licenses, 'account');
  register(devices, 'account');
  register(twofactor, 'account');
  register(family, 'account');
  register(parental, 'account');
  register(points, 'account');
}
