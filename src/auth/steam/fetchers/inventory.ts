/**
 * Inventory fetchers — community 753/6 + per-game (lazy). Steam serves
 * inventory as JSON keyed off classid/instanceid; parser will normalise.
 */
import { register } from '../refreshScheduler';
import type { FetcherSpec } from '../types';

const community: FetcherSpec<unknown> = {
  key: 'inventory.community',
  cadence: 'WARM',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/inventory/${ctx.steamId64}/753/6`,
  // TODO: parse assets + descriptions → InventoryItem[].
  parse: () => null,
};

const contextList: FetcherSpec<unknown> = {
  key: 'inventory.contextList',
  cadence: 'WARM',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/inventory/`,
  // TODO: scrape g_rgAppContextData to know which games have inventories.
  parse: () => null,
};

export function registerInventoryFetchers(): void {
  register(community, 'inventory');
  register(contextList, 'inventory');
}
