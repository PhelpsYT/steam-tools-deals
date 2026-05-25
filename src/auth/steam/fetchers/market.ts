/**
 * Market fetchers - active listings + history. Both pages embed JSON in
 * a window.* global which we'll grab via injected JS in the full parser.
 */
import { register } from '../refreshScheduler';
import { DEFAULT_INJECTED_JS } from '../webviewBridge';
import type { FetcherSpec } from '../types';

const listings: FetcherSpec<unknown> = {
  key: 'market.listings',
  cadence: 'HOT',
  transport: 'webview',
  buildUrl: () => 'https://steamcommunity.com/market/mylistings/?count=100&start=0',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const history: FetcherSpec<unknown> = {
  key: 'market.history',
  cadence: 'WARM',
  transport: 'webview',
  buildUrl: () => 'https://steamcommunity.com/market/myhistory/?count=100&start=0',
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

export function registerMarketFetchers(): void {
  register(listings, 'market');
  register(history, 'market');
}
