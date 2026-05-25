/**
 * Identity fetchers — drive avatar, persona, online state, level, frame,
 * background, ban state. Public profile XML + miniprofile JSON are
 * anonymous-readable; /badges/ and /edit/info/ need the session cookie.
 *
 * Security & no-throw rule lives in SteamAuth.tsx (master file).
 */
import { register } from '../refreshScheduler';
import { DEFAULT_INJECTED_JS } from '../webviewBridge';
import type { FetcherSpec, SteamIdentity, FetchContext } from '../types';

// ─── profile XML ────────────────────────────────────────────────────────────

const XML_INJECTED_JS = `
  (function() {
    try {
      // The XML page is served as text; document.body.innerText strips
      // tags. We need the raw source — use documentElement.outerHTML.
      var raw = document.documentElement ? document.documentElement.outerHTML : '';
      window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'ok', text: raw }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'err', message: String(e && e.message || e) }));
    }
    true;
  })();
`;

function extractXmlTag(xml: string, tag: string): string | undefined {
  // Matches both <tag>value</tag> and <tag><![CDATA[value]]></tag>.
  const re = new RegExp(
    `<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`,
    'i',
  );
  const m = re.exec(xml);
  return m ? m[1].trim() : undefined;
}

function parseOnlineState(s: string | undefined): SteamIdentity['onlineState'] {
  const v = (s || '').toLowerCase();
  if (v === 'in-game') return 'in-game';
  if (v === 'online') return 'online';
  if (v === 'offline') return 'offline';
  if (v === 'away') return 'away';
  if (v === 'snooze') return 'snooze';
  if (v === 'busy') return 'busy';
  return 'offline';
}

const profileXml: FetcherSpec<Partial<SteamIdentity>> = {
  key: 'identity.profileXml',
  cadence: 'HOT',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/?xml=1`,
  injectedJs: XML_INJECTED_JS,
  parse: (xml, ctx) => {
    try {
      if (!xml || !xml.includes('<profile>')) return null;
      const persona = extractXmlTag(xml, 'steamID');
      if (!persona) return null;
      const avatarSmall = extractXmlTag(xml, 'avatarIcon') || '';
      const avatarMed = extractXmlTag(xml, 'avatarMedium') || '';
      const avatarFull = extractXmlTag(xml, 'avatarFull') || '';
      const onlineState = parseOnlineState(extractXmlTag(xml, 'onlineState'));
      const stateMessage = extractXmlTag(xml, 'stateMessage') || '';
      const privacyStateRaw = (extractXmlTag(xml, 'privacyState') || '').toLowerCase();
      const privacyState: SteamIdentity['privacyState'] =
        privacyStateRaw === 'public'
          ? 'public'
          : privacyStateRaw === 'friendsonly'
            ? 'friendsonly'
            : 'private';
      const customUrl = extractXmlTag(xml, 'customURL') || '';
      const memberSince = extractXmlTag(xml, 'memberSince') || '';
      const headline = extractXmlTag(xml, 'headline');
      const summary = extractXmlTag(xml, 'summary');
      const location = extractXmlTag(xml, 'location');
      const realName = extractXmlTag(xml, 'realname');
      const vacBannedRaw = extractXmlTag(xml, 'vacBanned');
      const tradeBanRaw = (extractXmlTag(xml, 'tradeBanState') || '').toLowerCase();
      const tradeBanState: SteamIdentity['tradeBanState'] =
        tradeBanRaw === 'banned' ? 'Banned' : tradeBanRaw === 'probation' ? 'Probation' : 'None';
      const limited = extractXmlTag(xml, 'isLimitedAccount') === '1';
      const inGameInfo = extractXmlTag(xml, 'inGameInfo');
      let inGameAppId: number | undefined;
      let inGameName: string | undefined;
      if (inGameInfo) {
        inGameName = extractXmlTag(inGameInfo, 'gameName');
        const id = extractXmlTag(inGameInfo, 'gameID');
        if (id) inGameAppId = Number(id);
      }

      return {
        steamId64: ctx.steamId64,
        accountId: ctx.accountId,
        personaName: persona,
        realName,
        customUrl,
        avatar: { small: avatarSmall, medium: avatarMed, full: avatarFull },
        profileBackground: {},
        level: 0,
        xp: 0,
        xpNextLevel: 0,
        badges: [],
        onlineState,
        stateMessage,
        inGameAppId,
        inGameName,
        privacyState,
        privacy: {
          profile: privacyState === 'private' ? 'private' : privacyState === 'friendsonly' ? 'friendsonly' : 'public',
          games: 'unknown',
          inventory: 'unknown',
          wishlist: 'unknown',
          friends: 'unknown',
          comments: 'unknown',
        },
        vacBanCount: vacBannedRaw === '1' ? 1 : 0,
        gameBanCount: 0,
        isCommunityBanned: false,
        tradeBanState,
        isLimitedAccount: limited,
        memberSince,
        location,
        headline,
        summary,
      };
    } catch {
      return null;
    }
  },
};

// ─── miniprofile JSON (avatar frame, animated background, level) ─────────────

const MINIPROFILE_INJECTED_JS = `
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

interface MiniprofilePayload {
  avatarFrameUrl?: string;
  profileBackgroundImage?: string;
  profileBackgroundVideo?: string;
  level?: number;
  inGameBannerUrl?: string;
}

const miniprofile: FetcherSpec<MiniprofilePayload> = {
  key: 'identity.miniprofile',
  cadence: 'HOT',
  transport: 'webview',
  buildUrl: (ctx) =>
    `https://steamcommunity.com/miniprofile/${ctx.accountId}/json`,
  injectedJs: MINIPROFILE_INJECTED_JS,
  parse: (raw) => {
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      const result: MiniprofilePayload = {};
      const af = obj?.avatar_frame;
      if (typeof af === 'string' && af.length > 0) result.avatarFrameUrl = af;
      const bg = obj?.profile_background;
      if (bg && typeof bg === 'object') {
        if (typeof bg.image_large === 'string') result.profileBackgroundImage = bg.image_large;
        if (typeof bg.movie_webm === 'string') result.profileBackgroundVideo = bg.movie_webm;
        else if (typeof bg.movie_mp4 === 'string') result.profileBackgroundVideo = bg.movie_mp4;
      }
      if (typeof obj.level === 'number') result.level = obj.level;
      const ig = obj?.in_game;
      if (ig && typeof ig === 'object' && typeof ig.logo === 'string') {
        result.inGameBannerUrl = ig.logo;
      }
      return result;
    } catch {
      return null;
    }
  },
};

// ─── Stubs (full parsers can land later — see plan §D) ───────────────────────

const badges: FetcherSpec<unknown> = {
  key: 'identity.badges',
  cadence: 'WARM',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/badges/`,
  injectedJs: DEFAULT_INJECTED_JS,
  // TODO: scrape badges from #profile_xp_block and badges rows.
  parse: () => null,
};

const editInfo: FetcherSpec<unknown> = {
  key: 'identity.editInfo',
  cadence: 'COLD',
  transport: 'webview',
  buildUrl: (ctx) => `https://steamcommunity.com/profiles/${ctx.steamId64}/edit/info`,
  injectedJs: DEFAULT_INJECTED_JS,
  parse: () => null,
};

// ─── Registration ────────────────────────────────────────────────────────────

export function registerIdentityFetchers(): void {
  register(profileXml, 'identity');
  register(miniprofile, 'identity');
  register(badges, 'identity');
  register(editInfo, 'identity');
}

// Re-exported so SteamAuth can merge miniprofile into the existing identity
// slice without overwriting the XML-derived headline fields.
export type { MiniprofilePayload };
