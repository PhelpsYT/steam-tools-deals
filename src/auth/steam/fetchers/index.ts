/**
 * One-shot registration of every fetcher with the refresh scheduler.
 * SteamAuthProvider calls registerAllFetchers() during mount; registration
 * is idempotent (Map keys dedupe on re-register).
 */
import { registerIdentityFetchers } from './identity';
import { registerAccountFetchers } from './account';
import { registerLibraryFetchers } from './library';
import { registerWishlistFetchers } from './wishlist';
import { registerInventoryFetchers } from './inventory';
import { registerMarketFetchers } from './market';
import { registerSocialFetchers } from './social';
import { registerUgcFetchers } from './ugc';
import { registerPrefsFetchers } from './prefs';

let done = false;

export function registerAllFetchers(): void {
  if (done) return;
  registerIdentityFetchers();
  registerAccountFetchers();
  registerLibraryFetchers();
  registerWishlistFetchers();
  registerInventoryFetchers();
  registerMarketFetchers();
  registerSocialFetchers();
  registerUgcFetchers();
  registerPrefsFetchers();
  done = true;
}
