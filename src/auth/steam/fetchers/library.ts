/**
 * Library fetchers — dynamicstore JSON (ownedAppIds + wishlist + ignored +
 * followed + recommended), recently-played, owned games XML with playtime.
 *
 * dynamicstore is the same endpoint SteamSyncContext already calls — the
 * parser logic here is a superset of what's inline there. Phase 5 will
 * refactor SteamSyncContext to call this fetcher instead.
 */
import { register } from '../refreshScheduler';
import type { FetcherSpec, SteamLibrary } from '../types';

// ─── dynamicstore userdata ───────────────────────────────────────────────────

const USERDATA_INJECTED_JS = `
  (function() {
    try {
      var raw = document.body ? document.body.innerText : '';
      window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'ok', text: raw }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'err', message: String(e && e.message || e) }));
    }
    true;
  })();
`;

const dynamicstore: FetcherSpec<Partial<SteamLibrary>> = {
  key: 'library.dynamicstore',
  cadence: 'HOT',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/dynamicstore/userdata/?id=&l=',
  injectedJs: USERDATA_INJECTED_JS,
  parse: (raw) => {
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      if (!Array.isArray(obj.rgOwnedApps)) return null;
      return {
        ownedAppIds: obj.rgOwnedApps as number[],
        ignoredAppIds: Array.isArray(obj.rgIgnoredApps) ? (obj.rgIgnoredApps as number[]) : [],
        followedAppIds: Array.isArray(obj.rgFollowedApps) ? (obj.rgFollowedApps as number[]) : [],
        followedPublisherIds: Array.isArray(obj.rgFollowedPublishers) ? (obj.rgFollowedPublishers as number[]) : [],
        recommendedAppIds: Array.isArray(obj.rgRecommendedApps) ? (obj.rgRecommendedApps as number[]) : [],
        recommendedTagIds: Array.isArray(obj.rgRecommendedTags) ? (obj.rgRecommendedTags as number[]) : [],
        excludedTagIds: Array.isArray(obj.rgExcludedTags) ? (obj.rgExcludedTags as number[]) : [],
        games: {},
        recentlyPlayed: [],
        userTags: [],
      };
    } catch {
      return null;
    }
  },
};

// ─── Recently played (api.steampowered.com — needs webapi_token) ─────────────

const recentlyPlayed: FetcherSpec<unknown> = {
  key: 'library.recentlyPlayed',
  cadence: 'HOT',
  transport: 'fetch',
  buildUrl: (ctx) => {
    const token = ctx.webapiToken;
    if (!token) return ''; // empty URL → fetch will fail and parser returns null
    return `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?access_token=${encodeURIComponent(token)}&steamid=${ctx.steamId64}`;
  },
  // TODO Phase 4+: parse response.games[] into RecentlyPlayed[].
  parse: () => null,
};

const ownedGames: FetcherSpec<unknown> = {
  key: 'library.ownedGames',
  cadence: 'WARM',
  transport: 'fetch',
  buildUrl: (ctx) => {
    const token = ctx.webapiToken;
    if (!token) return '';
    return `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?access_token=${encodeURIComponent(token)}&steamid=${ctx.steamId64}&include_appinfo=1&include_played_free_games=1`;
  },
  // TODO: parse into OwnedGame[].
  parse: () => null,
};

const userTags: FetcherSpec<unknown> = {
  key: 'library.userTags',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: () => 'https://steamcommunity.com/my/games/',
  parse: () => null,
};

export function registerLibraryFetchers(): void {
  register(dynamicstore, 'library');
  register(recentlyPlayed, 'library');
  register(ownedGames, 'library');
  register(userTags, 'library');
}
