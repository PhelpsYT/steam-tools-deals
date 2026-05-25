/**
 * Full TypeScript surface for the Steam authenticated data mirror.
 *
 * The security narrative + architectural "why" lives in SteamAuth.ts. This
 * file is intentionally pure types - no React, no logic - so it can be
 * imported anywhere (fetchers, screens, the scheduler) without pulling
 * heavyweight modules into the bundle.
 *
 * The umbrella shape is `SteamUserData`. Each top-level slice (identity,
 * account, library, ...) is independently nullable so the UI can render
 * partial state while the scheduler back-fills missing categories.
 */

import type { ProfilePrivacy } from '../../context/ProfileContext';

// ─── Umbrella ────────────────────────────────────────────────────────────────

export interface SteamUserData {
  identity:  SteamIdentity  | null;
  account:   SteamAccount   | null;
  library:   SteamLibrary   | null;
  wishlist:  SteamWishlist  | null;
  inventory: SteamInventory | null;
  market:    SteamMarket    | null;
  social:    SteamSocial    | null;
  ugc:       SteamUGC       | null;
  prefs:     SteamPrefs     | null;
  /** Per-fetcher metadata: when it last completed, whether it succeeded,
   *  optional error string. Used to render staleness chips + diagnose
   *  why a slice is missing. */
  meta: Record<string, FetcherMeta>;
}

export interface FetcherMeta {
  at: number;          // Date.now() of last successful parse
  ok: boolean;         // false ⇒ last attempt failed; cached data still valid
  error?: string;      // short reason code if ok === false
}

// ─── Identity ────────────────────────────────────────────────────────────────

export interface SteamIdentity {
  steamId64: string;
  /** steamId64 - 76561197960265728. Useful for /miniprofile/{accountId}. */
  accountId: number;
  personaName: string;
  realName?: string;
  customUrl: string;
  avatar: { small: string; medium: string; full: string };
  avatarFrameUrl?: string;
  profileBackground: { image?: string; video?: string };
  level: number;
  xp: number;
  xpNextLevel: number;
  badges: SteamBadge[];
  onlineState: SteamOnlineState;
  stateMessage: string;
  inGameAppId?: number;
  inGameName?: string;
  inGameBannerUrl?: string;
  privacyState: 'public' | 'friendsonly' | 'private';
  /** Per-section visibility (already used by ProfileContext). */
  privacy: ProfilePrivacy;
  vacBanCount: number;
  gameBanCount: number;
  isCommunityBanned: boolean;
  tradeBanState: 'None' | 'Probation' | 'Banned';
  isLimitedAccount: boolean;
  /** ISO date from the profile XML's <memberSince> tag. */
  memberSince: string;
  location?: string;
  headline?: string;
  summary?: string;
}

export type SteamOnlineState =
  | 'online'
  | 'offline'
  | 'in-game'
  | 'away'
  | 'snooze'
  | 'busy';

export interface SteamBadge {
  badgeId: number;
  appId?: number;
  name: string;
  description?: string;
  level: number;
  xp: number;
  scarcity?: number;
  iconUrl: string;
  earnedAt: string;       // ISO
}

// ─── Account ─────────────────────────────────────────────────────────────────

export interface SteamAccount {
  walletBalance: WalletAmount;
  steamPointsBalance?: number;
  country: string;                 // ISO 3166-1 alpha-2
  emailMasked: string;
  emailVerified: boolean;
  accountCreatedAt: string;        // ISO
  steamGuardMode: 'none' | 'email' | 'mobile';
  hasMobileAuthenticator: boolean;
  hasBackupCodes: boolean;
  authorizedDevices: AuthorizedDevice[];
  activeSessions: ActiveSession[];
  familyShare: FamilyShare;
  parentalControls?: ParentalControls;
  /** Every license/package id the user has. Drives "where did I get this?". */
  licenses: License[];
  /** Wallet activity rows - purchases, refunds, gifts, market, etc. */
  walletHistory: WalletEvent[];
}

export interface WalletAmount {
  /** Integer minor units (cents/pence). */
  amount: number;
  /** Display string from Steam (already locale-formatted). */
  formatted: string;
  /** ISO 4217 currency code. */
  currency: string;
}

export interface AuthorizedDevice {
  token: string;
  description: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export interface ActiveSession {
  browser: string;
  ip?: string;
  country?: string;
  loggedInAt: string;
}

export interface FamilyShare {
  groupId?: string;
  groupName?: string;
  members: FamilyMember[];
  /** Other accounts whose libraries this account can borrow from. */
  lenders: FamilyShareUser[];
  /** Accounts that can borrow from this account. */
  lendees: FamilyShareUser[];
}

export interface FamilyMember {
  steamId: string;
  personaName: string;
  relation: 'parent' | 'child' | 'sibling' | 'self';
}

export interface FamilyShareUser {
  steamId: string;
  personaName: string;
}

export interface ParentalControls {
  isLocked: boolean;
  allowedAppIds?: number[];
  allowedFeatures: string[];
}

export interface License {
  packageId: number;
  grantedAt: string;
  source:
    | 'Retail'
    | 'Gift'
    | 'Purchase'
    | 'FreePromo'
    | 'PreorderRefund'
    | 'Other';
  /** When this license is shared from another account. */
  ownerSteamId?: string;
}

export interface WalletEvent {
  date: string;
  type:
    | 'purchase'
    | 'refund'
    | 'gift_sent'
    | 'gift_received'
    | 'market_sale'
    | 'market_buy'
    | 'wallet_credit'
    | 'wallet_purchase'
    | 'in_game'
    | 'subscription'
    | 'other';
  items: { appId?: number; name: string }[];
  amount: { value: number; formatted: string; currency: string; sign: '+' | '-' };
  walletBalanceAfter?: { value: number; formatted: string };
  /** Raw row text - kept for forward compatibility when Steam adds new types. */
  raw?: string;
}

// ─── Library ─────────────────────────────────────────────────────────────────

export interface SteamLibrary {
  /** Mirrors profile.ownedAppids - duplicated here so consumers can read
   *  from a single SteamUserData blob. */
  ownedAppIds: number[];
  ignoredAppIds: number[];
  followedAppIds: number[];
  followedPublisherIds: number[];
  recommendedAppIds: number[];
  recommendedTagIds: number[];
  excludedTagIds: number[];
  /** Per-appid game detail - populated lazily as the user opens game pages. */
  games: Record<number, OwnedGame>;
  recentlyPlayed: RecentlyPlayed[];
  /** User-defined library categories (the tags the user assigned to games
   *  via the Steam client). */
  userTags: UserLibraryTag[];
}

export interface RecentlyPlayed {
  appId: number;
  minutes2w: number;
  minutesForever: number;
  lastPlayedAt: string;
}

export interface UserLibraryTag {
  name: string;
  appIds: number[];
}

export interface OwnedGame {
  appId: number;
  name: string;
  iconUrl: string;
  logoUrl?: string;
  playtimeForever: number;       // minutes
  playtime2Weeks: number;
  lastPlayedAt?: string;
  achievements?: AchievementSummary;
  storefrontIcon?: string;
}

export interface AchievementSummary {
  unlocked: number;
  total: number;
  list?: AchievementProgress[];
}

export interface AchievementProgress {
  apiName: string;
  displayName: string;
  iconUrl: string;
  unlocked: boolean;
  unlockedAt?: string;
  /** Global unlock percentage 0-100. */
  rarityPct?: number;
}

// ─── Wishlist ────────────────────────────────────────────────────────────────

export interface SteamWishlist {
  items: WishlistItem[];
  count: number;
  /** ISO of when the full list was last refreshed. */
  fetchedAt: string;
}

export interface WishlistItem {
  appId: number;
  name: string;
  /** Lower = higher priority (Steam convention). */
  priority: number;
  addedAt: string;
  coverImageUrl: string;
  releaseDate?: { coming_soon: boolean; date?: string };
  price?: WishlistPrice;
  platforms: { windows: boolean; mac: boolean; linux: boolean };
  reviewSummary?: string;
  tags?: string[];
}

export interface WishlistPrice {
  initial: number;
  final: number;
  discountPct: number;
  formattedInitial: string;
  formattedFinal: string;
  currency: string;
  isFree: boolean;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface SteamInventory {
  /** Steam Community items: cards, emoticons, backgrounds, gems, sale items,
   *  Steam gifts (appid 753, contextid 6). */
  community753: InventoryItem[];
  /** Per-game inventories keyed by appId. Populated lazily. */
  perGame: Record<number, InventoryItem[]>;
  /** Best-effort estimated market value of the community inventory. */
  estimatedValue?: WalletAmount;
}

export interface InventoryItem {
  assetId: string;
  classId: string;
  appId: number;
  contextId: string;
  name: string;
  marketHashName?: string;
  iconUrl: string;
  tradable: boolean;
  marketable: boolean;
  type?: string;
  rarity?: string;
  tags?: InventoryTag[];
}

export interface InventoryTag {
  category: string;
  name: string;
}

// ─── Market ──────────────────────────────────────────────────────────────────

export interface SteamMarket {
  activeListings: MarketListing[];
  listingsToConfirm: MarketListing[];
  itemsToPickUp: MarketListing[];
  history: MarketHistoryEntry[];
  /** Convenience aggregate. */
  totalListed: number;
}

export interface MarketListing {
  listingId: string;
  appId: number;
  marketHashName: string;
  price: string;
  priceValue: number;
  iconUrl: string;
}

export interface MarketHistoryEntry {
  date: string;
  action: 'sold' | 'bought' | 'listed' | 'removed';
  item: string;
  price: string;
}

// ─── Social ──────────────────────────────────────────────────────────────────

export interface SteamSocial {
  friends: Friend[];
  pendingInvitesIncoming: Friend[];
  pendingInvitesOutgoing: Friend[];
  blocked: { steamId: string; personaName: string; avatarUrl: string }[];
  groups: SteamGroup[];
  primaryGroupId?: string;
}

export interface Friend {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  onlineState: SteamOnlineState;
  currentGame?: { appId: number; name: string };
  friendSince?: string;
  isFavorite?: boolean;
}

export interface SteamGroup {
  groupId: string;
  name: string;
  memberCount: number;
  iconUrl: string;
}

// ─── UGC (user-generated content) ────────────────────────────────────────────

export interface SteamUGC {
  reviews: UserReview[];
  screenshots: ScreenshotEntry[];
  videos: VideoEntry[];
  artwork: ArtworkEntry[];
  guides: GuideEntry[];
  workshopItems: WorkshopEntry[];
}

export interface UserReview {
  appId: number;
  recommended: boolean;
  postedAt: string;
  helpful: number;
  funny: number;
  body: string;
}

export interface ScreenshotEntry {
  id: string;
  appId: number;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  postedAt: string;
}

export interface VideoEntry {
  id: string;
  appId: number;
  title: string;
  youtubeId?: string;
  postedAt: string;
}

export interface ArtworkEntry {
  id: string;
  appId: number;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  postedAt: string;
}

export interface GuideEntry {
  id: string;
  appId: number;
  title: string;
  rating: number;
  postedAt: string;
}

export interface WorkshopEntry {
  id: string;
  appId: number;
  title: string;
  previewUrl: string;
  subscriptions?: number;
  postedAt: string;
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export interface SteamPrefs {
  language: string;
  storeCurrency: string;
  storeCountry: string;
  notificationSettings: Record<string, boolean>;
  contentPreferences: ContentPreferences;
  curatorsFollowed: CuratorEntry[];
  /** Editable privacy state - distinct from identity.privacy which is the
   *  read-only inferred state. */
  privacy: ProfilePrivacy;
  giftablePackages?: number[];
}

export interface ContentPreferences {
  mature: boolean;
  nudity: boolean;
  violence: boolean;
}

export interface CuratorEntry {
  curatorId: string;
  name: string;
  followers?: number;
}

// ─── Scheduler / fetcher contracts ───────────────────────────────────────────

/** Cadence tiers drive refresh frequency. See refreshScheduler.ts. */
export type FetcherCadence = 'HOT' | 'WARM' | 'COLD' | 'ICE';

export interface FetchContext {
  steamId64: string;
  accountId: number;
  /** Token from /pointssummary/ajaxgetasyncconfig - required for many
   *  api.steampowered.com endpoints when authenticated by session cookie. */
  webapiToken: string | null;
}

export interface FetcherSpec<T> {
  /** Stable key, used by the scheduler + as the AsyncStorage cache slot. */
  key: string;
  cadence: FetcherCadence;
  transport: 'webview' | 'fetch';
  buildUrl(ctx: FetchContext): string;
  /** MUST NOT throw. Return null on parse failure - the scheduler will keep
   *  the previously-cached data rather than blank the UI. */
  parse(raw: string, ctx: FetchContext): T | null;
  /** Optional injected JS when transport === 'webview'. Default just posts
   *  back document.body.innerText. */
  injectedJs?: string;
  /** Overrides cadence default TTL if set. */
  ttlMs?: number;
}

/** Stable string keys for every fetcher the scheduler knows about. Used as
 *  Map keys and as part of AsyncStorage paths. */
export type FetcherKey =
  | 'identity.profileXml'
  | 'identity.miniprofile'
  | 'identity.badges'
  | 'identity.editInfo'
  | 'account.headline'
  | 'account.history'
  | 'account.licenses'
  | 'account.devices'
  | 'account.twofactor'
  | 'account.family'
  | 'account.parental'
  | 'account.points'
  | 'library.dynamicstore'
  | 'library.recentlyPlayed'
  | 'library.ownedGames'
  | 'library.userTags'
  | 'wishlist.full'
  | 'wishlist.prices'
  | 'inventory.community'
  | 'inventory.contextList'
  | 'market.listings'
  | 'market.history'
  | 'social.friends'
  | 'social.groups'
  | 'social.blocked'
  | 'social.pending'
  | 'ugc.reviews'
  | 'ugc.screenshots'
  | 'ugc.videos'
  | 'ugc.artwork'
  | 'ugc.guides'
  | 'ugc.workshop'
  | 'prefs.preferences'
  | 'prefs.notifications'
  | 'prefs.privacy'
  | 'prefs.curators';
