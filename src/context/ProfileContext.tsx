import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@steam_profile';

export interface ProfileData {
  avatarUrl: string;
  playerName: string;
  steamId: string;
  vanityUrl: string;
  gamesCount: string;
  walletBalance: string;
  /** Raw app IDs from rgOwnedApps (games + DLC + apps + tools, all mixed).
   *  Source of truth for the library page - each app ID is sent to PICS to
   *  fetch metadata on demand. */
  ownedAppids?: number[];
  /** App IDs on the user's Steam wishlist (rgWishlist). Used to drive the
   *  Wishlist info box and the wishlist library view. */
  wishlistAppids?: number[];
  /** Legacy fields kept optional so older code paths still compile. The
   *  Wishlist / Inventory features were removed; these are no longer
   *  rendered, but the count-fetching code still writes them. */
  inventoryCount?: string;
  wishlistCount?: string;
  onlineState: string;   // 'online' | 'offline' | 'in-game' | ''
  stateMessage: string;  // e.g. "Online", "Offline", "In-Game Counter-Strike 2"
  privacyState: string;  // 'public' | 'friendsonly' | 'private' | ''
  inGameBannerUrl: string; // game library_hero image when in-game, '' otherwise
  /** Per-section privacy state. Detected by probing each Steam endpoint. */
  privacy?: ProfilePrivacy;
  /** How the user got onto this profile. 'steam' = signed in via Steam OpenID;
   *  'search' = looked up someone via the search bar. Drives whether the
   *  Profile screen shows the auth-options layout or the data-browser layout. */
  authMethod?: 'steam' | 'search';
  /** Animated avatar-frame URL from steamcommunity.com/miniprofile/{accountid}/json.
   *  Empty / undefined when the user hasn't equipped a frame. We render this
   *  on top of the avatar so the user's actual chosen frame shows through. */
  avatarFrameUrl?: string;
  /** User's equipped profile background - animated or static. Renders as
   *  the blurred background on the Profile screen when the user is NOT
   *  in-game (in-game wins because the game's library_hero is more
   *  contextually relevant). Comes from the same miniprofile JSON. */
  profileBackgroundUrl?: string;
  /** Looping video URL for animated profile backgrounds (mp4). Steam's
   *  newer animated backgrounds are video-only - no static image
   *  fallback. When present, we render this with expo-video instead of
   *  using profileBackgroundUrl as an image source. */
  profileBackgroundVideoUrl?: string;
  /** Google identity attached to this profile. Independent from Steam - a
   *  user can be signed in to Steam, Google, both, or neither. Verified
   *  server-side via Google's JWKS in the worker; what's stored here is
   *  only what came back from that trusted verification. */
  google?: GoogleIdentity;
}

interface GoogleIdentity {
  /** Stable Google user ID. Use as primary key, not email (emails change). */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
}

export type SectionVisibility = 'public' | 'friendsonly' | 'private' | 'unknown';

export interface ProfilePrivacy {
  profile: SectionVisibility;
  games: SectionVisibility;
  inventory: SectionVisibility;
  wishlist: SectionVisibility;
  friends: SectionVisibility;
  comments: SectionVisibility;
}

const DEFAULT_AVATAR = 'https://avatars.akamai.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';

const DEFAULT_PROFILE: ProfileData = {
  avatarUrl: DEFAULT_AVATAR,
  playerName: 'Anonymous',
  steamId: '76561198012345678',
  vanityUrl: '',
  gamesCount: '-',
  walletBalance: '-',
  onlineState: '',
  stateMessage: '',
  privacyState: '',
  inGameBannerUrl: '',
};

interface ProfileContextValue {
  profile: ProfileData;
  linked: boolean;
  setLinkedProfile: (p: ProfileData) => void;
  unlinkProfile: () => void;
  /** Attach a Google identity without touching the Steam fields. Used on
   *  successful Google sign-in. */
  setGoogleIdentity: (g: GoogleIdentity) => void;
  /** Remove the Google identity, leaving Steam intact. */
  unlinkGoogle: () => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: DEFAULT_PROFILE,
  linked: false,
  setLinkedProfile: () => {},
  unlinkProfile: () => {},
  setGoogleIdentity: () => {},
  unlinkGoogle: () => {},
});

export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [linked, setLinked] = useState(false);

  // Load saved profile on mount. `linked` means "a Steam profile is
  // attached" specifically (drives the layout switch in ProfileScreen).
  // A Google-only session is NOT linked - Google identity is independent
  // and is handled via profile.google.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((json) => {
      if (!json) return;
      try {
        const saved = JSON.parse(json) as ProfileData;
        setProfile(saved);
        // Detect a real Steam profile by looking at playerName - the default
        // is 'Anonymous'; real profiles always have a persona name.
        const hasSteam =
          !!saved.playerName &&
          saved.playerName !== DEFAULT_PROFILE.playerName;
        setLinked(hasSteam);
      } catch {}
    });
  }, []);

  const setLinkedProfile = useCallback((p: ProfileData) => {
    setProfile((prev) => {
      // Preserve any existing Google identity when a Steam profile is set
      // (e.g. user signed in to Google, then to Steam - they keep both).
      const merged: ProfileData = { ...p, google: prev.google ?? p.google };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
    setLinked(true);
  }, []);

  const unlinkProfile = useCallback(() => {
    setProfile((prev) => {
      // Clear Steam fields but keep Google if attached.
      const next: ProfileData = { ...DEFAULT_PROFILE, google: prev.google };
      if (next.google) {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        AsyncStorage.removeItem(STORAGE_KEY);
      }
      return next;
    });
    setLinked(false);
  }, []);

  const setGoogleIdentity = useCallback((g: GoogleIdentity) => {
    setProfile((prev) => {
      const next = { ...prev, google: g };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const unlinkGoogle = useCallback(() => {
    setProfile((prev) => {
      const { google, ...rest } = prev;
      const next = rest as ProfileData;
      // If Steam is also gone, fully clear storage; otherwise persist the
      // Steam-only profile.
      if (linked) {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        AsyncStorage.removeItem(STORAGE_KEY);
      }
      return next;
    });
  }, [linked]);

  return (
    <ProfileContext.Provider
      value={{ profile, linked, setLinkedProfile, unlinkProfile, setGoogleIdentity, unlinkGoogle }}
    >
      {children}
    </ProfileContext.Provider>
  );
};
