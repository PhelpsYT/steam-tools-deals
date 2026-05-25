/**
 * Wishlist fetchers - appids + priority via IWishlistService, prices via
 * IStoreBrowseService (batched 50/call). Parsers will land incrementally.
 */
import { register } from '../refreshScheduler';
import type { FetcherSpec } from '../types';

const full: FetcherSpec<unknown> = {
  key: 'wishlist.full',
  cadence: 'HOT',
  transport: 'fetch',
  buildUrl: (ctx) => {
    const t = ctx.webapiToken;
    if (!t) return '';
    return `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?access_token=${encodeURIComponent(t)}&steamid=${ctx.steamId64}`;
  },
  // TODO: parse response.items[] → { appId, priority, date_added }.
  parse: () => null,
};

const prices: FetcherSpec<unknown> = {
  key: 'wishlist.prices',
  cadence: 'HOT',
  transport: 'fetch',
  buildUrl: (ctx) => {
    const t = ctx.webapiToken;
    if (!t) return '';
    // Final URL is built by a follow-up batched call that knows the appids;
    // here we just expose the endpoint. The full implementation will live
    // in a separate batch helper.
    return `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?access_token=${encodeURIComponent(t)}`;
  },
  parse: () => null,
};

export function registerWishlistFetchers(): void {
  register(full, 'wishlist');
  register(prices, 'wishlist');
}
