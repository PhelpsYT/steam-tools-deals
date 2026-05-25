/**
 * UGC fetchers - user reviews, screenshots, videos, artwork, guides,
 * workshop uploads. Every endpoint is an HTML community page.
 */
import { register } from '../refreshScheduler';
import { DEFAULT_INJECTED_JS } from '../webviewBridge';
import type { FetcherSpec } from '../types';

const reviews: FetcherSpec<unknown> = {
  key: 'ugc.reviews',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/recommended/`,
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const screenshots: FetcherSpec<unknown> = {
  key: 'ugc.screenshots',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/screenshots/?p=1`,
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const videos: FetcherSpec<unknown> = {
  key: 'ugc.videos',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/videos/`,
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const artwork: FetcherSpec<unknown> = {
  key: 'ugc.artwork',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/images/`,
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const guides: FetcherSpec<unknown> = {
  key: 'ugc.guides',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/guides/`,
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

const workshop: FetcherSpec<unknown> = {
  key: 'ugc.workshop',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/myworkshopfiles/?appid=0`,
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

export function registerUgcFetchers(): void {
  register(reviews, 'ugc');
  register(screenshots, 'ugc');
  register(videos, 'ugc');
  register(artwork, 'ugc');
  register(guides, 'ugc');
  register(workshop, 'ugc');
}
