/**
 * Social fetchers — friends, groups, blocked, pending invites. All are
 * HTML pages that require the session cookie.
 */
import { register } from '../refreshScheduler';
import { DEFAULT_INJECTED_JS } from '../webviewBridge';
import type { FetcherSpec } from '../types';

const friends: FetcherSpec<unknown> = {
  key: 'social.friends',
  cadence: 'WARM',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/friends/`,
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const groups: FetcherSpec<unknown> = {
  key: 'social.groups',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/groups/`,
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const blocked: FetcherSpec<unknown> = {
  key: 'social.blocked',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/blocked/`,
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const pending: FetcherSpec<unknown> = {
  key: 'social.pending',
  cadence: 'WARM',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/home_pending/`,
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

export function registerSocialFetchers(): void {
  register(friends, 'social');
  register(groups, 'social');
  register(blocked, 'social');
  register(pending, 'social');
}
