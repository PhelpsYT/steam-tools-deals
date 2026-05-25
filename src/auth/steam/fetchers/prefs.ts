/**
 * Preferences fetchers — store prefs, notifications, privacy editable
 * state, curators followed. All under store.steampowered.com and need
 * the session cookie.
 */
import { register } from '../refreshScheduler';
import { DEFAULT_INJECTED_JS } from '../webviewBridge';
import type { FetcherSpec } from '../types';

const preferences: FetcherSpec<unknown> = {
  key: 'prefs.preferences',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/account/preferences/',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const notifications: FetcherSpec<unknown> = {
  key: 'prefs.notifications',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/account/notificationsettings/',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const privacy: FetcherSpec<unknown> = {
  key: 'prefs.privacy',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/account/privacy/',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const curators: FetcherSpec<unknown> = {
  key: 'prefs.curators',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: () => 'https://store.steampowered.com/curators/mycurators/',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

export function registerPrefsFetchers(): void {
  register(preferences, 'prefs');
  register(notifications, 'prefs');
  register(privacy, 'prefs');
  register(curators, 'prefs');
}
