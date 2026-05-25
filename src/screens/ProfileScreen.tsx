import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  Easing,
  TextInput,
  Keyboard,
  LayoutAnimation,
  Modal,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors } from '../theme';
import { useProfile } from '../context/ProfileContext';
import type { ProfileData, ProfilePrivacy, SectionVisibility } from '../context/ProfileContext';
import { usePicsTypes } from '../hooks/usePicsTypes';
import { useSteamSync } from '../context/SteamSyncContext';
import { useSteamAuth } from '../auth/steam/SteamAuth';
import { LoadingLine } from '../components';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 120;

const MY_CONTENT_ITEMS = [
  'My Library',
];

const DIVIDER_STANDARD = '#30333A';

// ─── Icons ───────────────────────────────────────────────────────────────────

const IconChevronRight: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = '#8B929A',
}) => (
  <Svg width={size} height={size} viewBox="0 0 10 18" fill="none">
    <Path
      d="M1.97652 0.931297C1.76125 0.72047 1.48728 0.605469 1.16438 0.605469C0.518594 0.605469 0 1.10378 0 1.73625C0 2.05247 0.136986 2.34 0.362041 2.56041L7.21135 9.11505L0.362041 15.6506C0.136986 15.871 0 16.168 0 16.4747C0 17.1072 0.518594 17.6055 1.16438 17.6055C1.48728 17.6055 1.76125 17.4905 1.97652 17.2797L9.58904 9.99668C9.86301 9.74752 9.99022 9.44087 10 9.10547C10 8.77007 9.86301 8.48258 9.58904 8.22385L1.97652 0.931297Z"
      fill={color}
    />
  </Svg>
);

/** App search icon - matches the one in SteamHeader */
const IconSearchApp: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = '#8B929A',
}) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <Path
      d="M19.7395 18.6047L15.5716 14.4186C16.8452 12.7907 17.5398 10.9302 17.5398 8.83721C17.5398 6.51163 16.6136 4.30233 14.9928 2.55814C13.3719 0.930233 11.1722 0 8.85673 0C6.54124 0 4.34153 0.930233 2.60492 2.55814C-0.868307 6.04651 -0.868307 11.6279 2.60492 15C4.22576 16.6279 6.42547 17.5581 8.85673 17.5581C10.9407 17.5581 12.9088 16.8605 14.4139 15.5814L18.5818 19.7674C18.6975 19.8837 18.9291 20 19.1606 20C19.3922 20 19.6237 19.8837 19.7395 19.7674C20.0868 19.4186 20.0868 18.9535 19.7395 18.6047ZM3.76266 13.8372C0.984081 11.0465 0.984081 6.51163 3.76266 3.72093C5.15195 2.32558 6.88857 1.62791 8.85673 1.62791C10.7091 1.62791 12.5615 2.32558 13.9508 3.72093C15.3401 5.11628 16.0347 6.86046 16.0347 8.83721C16.0347 10.6977 15.3401 12.5581 13.9508 13.9535C12.5615 15.3488 10.8249 16.0465 8.85673 16.0465C6.88857 15.9302 5.15195 15.2326 3.76266 13.8372Z"
      fill={color}
    />
  </Svg>
);

/** Warning triangle icon for private profiles */
const IconWarning: React.FC<{ size?: number; color?: string }> = ({
  size = 14,
  color = '#dc3545',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2L1 21h22L12 2z"
      fill={color}
    />
    <Path
      d="M12 15V9"
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M12 18.5a1 1 0 100-2 1 1 0 000 2z"
      fill="#fff"
    />
  </Svg>
);

/** Person / profile icon */
const IconPerson: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = '#fff',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
  </Svg>
);

const IconClear: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = '#8B929A',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 6L6 18M6 6l12 12"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Steam logo glyph (path from simpleicons.org, proper proportions). */
const IconSteam: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.624 0 11.99-5.366 11.99-12C23.97 5.376 18.603.001 11.979.001zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.456-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/>
  </Svg>
);

/** Official Google "G" logo per Google's sign-in branding spec -
 *  bolder than the Material variant, four cleanly-divided quadrants. */
const IconGoogle: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </Svg>
);

/** Steam's chevron pointing downward */
const IconChevronDown: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = 'rgba(255,255,255,0.7)',
}) => (
  <Svg width={size} height={size} viewBox="0 0 18 10" fill="none">
    <Path
      d="M0.931297 1.97652C0.72047 1.76125 0.605469 1.48728 0.605469 1.16438C0.605469 0.518594 1.10378 0 1.73625 0C2.05247 0 2.34 0.136986 2.56041 0.362041L9.11505 7.21135L15.6506 0.362041C15.871 0.136986 16.168 0 16.4747 0C17.1072 0 17.6055 0.518594 17.6055 1.16438C17.6055 1.48728 17.4905 1.76125 17.2797 1.97652L9.99668 9.58904C9.74752 9.86301 9.44087 9.99022 9.10547 10C8.77007 10 8.48258 9.86301 8.22385 9.58904L0.931297 1.97652Z"
      fill={color}
    />
  </Svg>
);

// ─── Blurred Background ──────────────────────────────────────────────────────
// Priority for what shows behind the avatar:
//   1. In-game banner (the game's library_hero) when the user is playing
//   2. Animated profile background video (Steam's modern animated bg)
//   3. Static profile background image (older equipped backgrounds)
//   4. Fall back to the avatar itself, blurred
//
// All transitions are smooth crossfades (300ms) - no abrupt swaps when the
// user starts/stops playing a game or when the first image loads.
const BlurredBackground: React.FC<{
  avatarUrl: string;
  bannerUrl?: string;
  profileBgUrl?: string;
  profileBgVideoUrl?: string;
}> = ({ avatarUrl, bannerUrl, profileBgUrl, profileBgVideoUrl }) => {
  // Video plays only when (a) we have one AND (b) we're not in-game.
  const useVideo = !bannerUrl && !!profileBgVideoUrl;
  const imageSource = bannerUrl || profileBgUrl || avatarUrl;
  const isGameBanner = !!bannerUrl;
  const isProfileBg = !bannerUrl && (!!profileBgVideoUrl || !!profileBgUrl);
  // Heavy blur ONLY when we're falling back to the avatar as the banner -
  // the avatar source is small (typically 184×184) and gets stretched to
  // full banner size, so without aggressive blur it shows visible pixel
  // grid. Game banners and profile backgrounds are already hi-res; leave
  // them sharp.
  const isAvatarFallback = !isGameBanner && !isProfileBg;
  const blurRadius = isAvatarFallback ? 30 : 0;
  const dimOpacity = isGameBanner ? 0.45 : isProfileBg ? 0.35 : 0.65;

  // Crossfade the video layer based on whether we should be showing it.
  // useNativeDriver:true keeps the animation off the JS thread so the
  // video itself doesn't stutter during the fade.
  const videoOpacity = useRef(new Animated.Value(useVideo ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(videoOpacity, {
      toValue: useVideo ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [useVideo, videoOpacity]);

  // Pre-warm the in-game banner image cache the moment we learn its URL.
  // Without this, switching from video → game banner causes a momentary
  // gap while the banner downloads - the video fades out before the new
  // image is in the cache. Prefetching closes that gap.
  useEffect(() => {
    if (bannerUrl) Image.prefetch(bannerUrl);
  }, [bannerUrl]);

  return (
    <View style={[styles.blurredBgContainer, { backgroundColor: '#1a1c24' }]}>
      {/* Image layer always rendered; expo-image's `transition` prop
          handles fade-in on first load AND fades when the source URL
          changes (e.g. game banner switches between games). */}
      <Image
        source={{ uri: imageSource }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={blurRadius}
        cachePolicy="memory-disk"
        transition={320}
      />
      {/* Video layer renders on top of the image when active. Crossfade
          with Animated.View so transitioning between video↔game-banner
          is smooth. */}
      {profileBgVideoUrl ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: videoOpacity }]} pointerEvents="none">
          <ProfileBackgroundVideo url={profileBgVideoUrl} />
        </Animated.View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dimOpacity})` }]} />
      <LinearGradient
        style={StyleSheet.absoluteFill}
        colors={['transparent', colors.background.secondary]}
        start={{ x: 0, y: 0.55 }}
        end={{ x: 0, y: 1 }}
      />
    </View>
  );
};

/** Looping muted video player for animated Steam profile backgrounds.
 *  Wrapped in its own component so we can lazy-create the player only
 *  when actually needed (not every Profile screen render). */
const ProfileBackgroundVideo: React.FC<{ url: string }> = ({ url }) => {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
};

// ─── Swipe hint: bouncing down arrow ─────────────────────────────────────────
const SwipeHint: React.FC = () => {
  const bounceY = useRef(new Animated.Value(0)).current;
  const arrowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = Animated.sequence([
      // Fade in
      Animated.timing(arrowOpacity, {
        toValue: 0.9,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(150),
      // Bounce 1
      Animated.timing(bounceY, {
        toValue: 12,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bounceY, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(100),
      // Bounce 2
      Animated.timing(bounceY, {
        toValue: 8,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bounceY, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      // Fade out
      Animated.delay(400),
      Animated.timing(arrowOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    // Play once immediately, then repeat every 5s
    bounce.start();
    const interval = setInterval(() => {
      bounceY.setValue(0);
      arrowOpacity.setValue(0);
      bounce.reset();
      bounce.start();
    }, 5000);

    return () => clearInterval(interval);
  }, [bounceY, arrowOpacity]);

  return (
    <Animated.View
      style={[
        styles.swipeHint,
        {
          transform: [{ translateY: bounceY }],
          opacity: arrowOpacity,
        },
      ]}
    >
      <IconChevronDown />
    </Animated.View>
  );
};

// ─── Profile Header ──────────────────────────────────────────────────────────
// ─── Marquee for long game names ─────────────────────────────────────────────
const MarqueeGameName: React.FC<{ name: string }> = ({ name }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const containerW = useRef(0);
  const textW = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const tryStart = useCallback(() => {
    const overflow = textW.current - containerW.current;
    if (overflow <= 0 || containerW.current === 0) return;

    if (animRef.current) animRef.current.stop();
    scrollX.setValue(0);

    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(scrollX, {
          toValue: -overflow,
          duration: overflow * 45,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
        Animated.delay(1000),
        Animated.timing(scrollX, {
          toValue: 0,
          duration: overflow * 45,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
      ]),
    );
    animRef.current.start();
  }, [scrollX]);

  return (
    <View
      style={styles.marqueeContainer}
      onLayout={(e) => { containerW.current = e.nativeEvent.layout.width; tryStart(); }}
    >
      {/* width:1000 prevents text from wrapping; container overflow:hidden clips it */}
      <Animated.View style={{ width: 1000, transform: [{ translateX: scrollX }] }}>
        <Text
          style={styles.marqueeText}
          numberOfLines={1}
          onTextLayout={(e: any) => {
            const lines = e.nativeEvent.lines;
            if (lines && lines.length > 0) {
              textW.current = lines[0].width;
              tryStart();
            }
          }}
        >
          {name}
        </Text>
      </Animated.View>
    </View>
  );
};

const STATUS_COLORS: Record<string, string> = {
  online: '#57cbde',
  'in-game': '#90ba3c',
  offline: '#636363',
};

const ProfileStatusLabel: React.FC<{ profile: ProfileData; linked: boolean }> = ({ profile, linked }) => {
  // Not connected - anonymous
  if (!linked) {
    return (
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: '#636363' }]} />
        <Text style={[styles.statusText, { color: '#636363' }]}>Not Connected</Text>
      </View>
    );
  }

  // Private profile
  if (profile.privacyState === 'private') {
    return (
      <View style={styles.statusRow}>
        <IconWarning size={13} color="#dc3545" />
        <Text style={[styles.statusText, { color: '#dc3545', marginLeft: 5 }]}>Private Profile</Text>
      </View>
    );
  }

  // Friends only profile
  if (profile.privacyState === 'friendsonly') {
    return (
      <View style={styles.statusRow}>
        <IconWarning size={13} color="#f0ad4e" />
        <Text style={[styles.statusText, { color: '#f0ad4e', marginLeft: 5 }]}>Friends Only</Text>
      </View>
    );
  }

  // Online / Offline / In-Game
  const state = profile.onlineState || 'offline';
  const dotColor = STATUS_COLORS[state] || STATUS_COLORS.offline;

  // For in-game, extract game name from stateMessage (e.g. "In-Game Counter-Strike 2")
  let label = profile.stateMessage || 'Offline';
  if (state === 'in-game' && profile.stateMessage) {
    // stateMessage is like "In-Game\nCounter-Strike 2" or "In-Game Counter-Strike 2"
    const gameName = profile.stateMessage.replace(/^In-Game\s*/i, '').trim();
    if (gameName) {
      label = gameName;
    }
  }

  if (state !== 'in-game') {
    return (
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.statusText, { color: dotColor }]}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={{ color: '#90ba3c', fontFamily: 'Inter_400Regular', fontSize: 13 }}>In-Game  </Text>
      <MarqueeGameName name={label} />
    </View>
  );
};

// Dark-gray palette used for tag chips:
//   #1F2127 = navigation bar / primary panel
//   #2A2C34 = splashscreen / surface
//   #30333A = divider standard
//   #3D4450 = raised card
//   #05603A / #027A48 = positive greens
//   #F04438 / #dd524b = error/destructive reds
//   #FFA400 = warning amber
const TAG_COLORS: Record<string, { bg: string; fg: string }> = {
  public:      { bg: '#3D4450', fg: '#c6d4df' }, // raised card / off-white text
  friendsonly: { bg: '#3D4450', fg: '#FFA400' }, // raised card / Steam amber
  private:     { bg: '#3D4450', fg: '#F04438' }, // raised card / Steam red
  unknown:     { bg: '#2A2C34', fg: '#8f98a0' }, // splash bg / muted text
};

// Per-section explanations shown on tap
const SECTION_INFO: Record<string, { what: string; whenPublic: string; whenPrivate: string }> = {
  profile: {
    what: 'The overall profile visibility setting. Controls whether anyone can see your Steam profile page.',
    whenPublic: 'Anyone can view your profile, name, avatar and most details.',
    whenPrivate: 'Only you (and friends, if friends-only) can see this profile. All sections below are hidden too.',
  },
  games: {
    what: 'Your owned-games library and total play time per game.',
    whenPublic: 'Anyone can see which games you own and how long you have played each.',
    whenPrivate: 'Your library and play times are hidden from outsiders.',
  },
  inventory: {
    what: 'Your Steam Items inventory (TF2 hats, CS skins, trading cards, gifts, etc.).',
    whenPublic: 'Anyone can browse what items you own. Required for trade offers.',
    whenPrivate: 'Item listings are hidden. Trade offers will fail.',
  },
  wishlist: {
    what: 'The list of games you have wishlisted on Steam.',
    whenPublic: 'Anyone can see your wishlist (so they can gift you stuff).',
    whenPrivate: 'Your wishlist is not visible to other users.',
  },
  friends: {
    what: 'Your Steam friends list.',
    whenPublic: 'Anyone can see who you are friends with on Steam.',
    whenPrivate: 'Your friends list is hidden.',
  },
  comments: {
    what: 'Comments left on your profile by others.',
    whenPublic: 'Anyone can post and read profile comments.',
    whenPrivate: 'No one can see or post profile comments.',
  },
};

const STATE_LABEL: Record<SectionVisibility, string> = {
  public: 'PUBLIC',
  friendsonly: 'FRIENDS ONLY',
  private: 'PRIVATE',
  unknown: 'UNKNOWN',
};

const PrivacyTag: React.FC<{ label: string; state: SectionVisibility; onPress: () => void }> = ({ label, state, onPress }) => {
  const c = TAG_COLORS[state] || TAG_COLORS.unknown;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.privacyTag, { backgroundColor: c.bg, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.privacyTagText, { color: c.fg }]}>{label}</Text>
    </Pressable>
  );
};

const PrivacyExplanationModal: React.FC<{
  visible: boolean;
  sectionKey: keyof ProfilePrivacy | null;
  state: SectionVisibility;
  onClose: () => void;
}> = ({ visible, sectionKey, state, onClose }) => {
  if (!sectionKey) return null;
  const info = SECTION_INFO[sectionKey];
  const c = TAG_COLORS[state] || TAG_COLORS.unknown;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {/* Top row: section title + status tag + close X */}
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>{sectionKey.toUpperCase()}</Text>
            <View style={[styles.privacyTag, { backgroundColor: c.bg }]}>
              <Text style={[styles.privacyTagText, { color: c.fg }]}>{STATE_LABEL[state]}</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.modalCloseX, { opacity: pressed ? 0.5 : 1 }]} hitSlop={8}>
              <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                <Path d="M1 1 L13 13 M13 1 L1 13" stroke="#8f98a0" strokeWidth={2} strokeLinecap="square" />
              </Svg>
            </Pressable>
          </View>
          <Text style={styles.modalBodyText}>{info.what}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const PrivacyTags: React.FC<{ privacy?: ProfilePrivacy }> = ({ privacy }) => {
  const [openSection, setOpenSection] = useState<keyof ProfilePrivacy | null>(null);
  if (!privacy) return null;
  const tags: Array<[keyof ProfilePrivacy, string]> = [
    ['profile',   'PROFILE'],
    ['games',     'GAMES'],
    ['inventory', 'INVENTORY'],
    ['wishlist',  'WISHLIST'],
    ['friends',   'FRIENDS'],
    ['comments',  'COMMENTS'],
  ];
  return (
    <>
      <View style={styles.privacyTagRow}>
        {tags.map(([key, label]) => (
          <PrivacyTag key={key} label={label} state={privacy[key]} onPress={() => setOpenSection(key)} />
        ))}
      </View>
      <PrivacyExplanationModal
        visible={openSection !== null}
        sectionKey={openSection}
        state={openSection ? privacy[openSection] : 'unknown'}
        onClose={() => setOpenSection(null)}
      />
    </>
  );
};

const ProfileHeader: React.FC<{ profile: ProfileData; linked: boolean }> = ({ profile, linked }) => (
  <View style={styles.profileHeader}>
    {/* Avatar + frame layered on top of each other. The frame URL is only
        populated for Steam-OAuth signed-in users (we fetch it from the
        miniprofile JSON). When the user has no equipped frame, the field
        is empty and we just show the bare avatar. */}
    <View style={styles.avatarStack}>
      <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} cachePolicy="memory-disk" />
      {profile.avatarFrameUrl ? (
        <Image
          source={{ uri: profile.avatarFrameUrl }}
          style={styles.avatarFrame}
          cachePolicy="memory-disk"
          pointerEvents="none"
        />
      ) : null}
    </View>
    <View style={styles.nameContainer}>
      <Text style={styles.playerName} numberOfLines={1}>{profile.playerName}</Text>
      <ProfileStatusLabel profile={profile} linked={linked} />
      {/* Tags only show when we're inspecting someone via search. Steam-OAuth
          sign-in is the user's own profile - no need to advertise privacy
          for sections they already control. */}
      {linked && profile.authMethod !== 'steam' && <PrivacyTags privacy={profile.privacy} />}
    </View>
  </View>
);

// ─── Info Boxes ──────────────────────────────────────────────────────────────
/**
 * Three-dot wave animation. Each dot bounces up in turn, creating a
 * left-to-right "wave". rAF-driven so it runs at the screen's native
 * refresh rate.
 */
const LoadingDots: React.FC<{ color?: string; size?: number }> = ({
  color = '#fff',
  size = 18,
}) => {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      setT((Date.now() - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const PERIOD = 1.0;       // seconds per wave
  const AMPLITUDE = 5;      // peak rise in px
  const STAGGER = 0.18;     // each dot starts this fraction of period later
  const dotY = (phase: number) => {
    const progress = ((t / PERIOD) + phase) % 1;
    // Show only the upward half of a sine wave so the dots come back to baseline.
    const lift = Math.max(0, Math.sin(progress * Math.PI * 2));
    return -lift * AMPLITUDE;
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: size }}>
      {[0, STAGGER, STAGGER * 2].map((phase, i) => (
        <Text
          key={i}
          style={{
            color,
            fontSize: size,
            lineHeight: size,
            marginHorizontal: 1,
            transform: [{ translateY: dotY(phase) }],
          }}
        >
          •
        </Text>
      ))}
    </View>
  );
};

const InfoBoxes: React.FC<{
  profile: ProfileData;
  loading?: boolean;
  /** True when the most recent fetch was rate-limited so the boxes are
   *  showing stale (still-valid but possibly outdated) numbers. */
  stale?: boolean;
  /** Number of owned items where PICS `common.type === 'game'`. Comes from
   *  the background usePicsTypes scan running in the parent. */
  gamesOnlyCount?: number;
  /** True while the PICS scan is still in progress and `gamesOnlyCount`
   *  is partial. */
  picsScanning?: boolean;
  /** Tapping "Apps" - opens the library filtered to every owned app id. */
  onAppsPress?: () => void;
  /** Tapping "Games" - opens the library filtered to PICS type === 'game'. */
  onGamesPress?: () => void;
  /** Tapping "Wishlist" - opens the library filtered to the wishlist. */
  onWishlistPress?: () => void;
  /** Legacy prop - DLC button was removed. Ignored. */
  onDLCPress?: () => void;
  onItemsPress?: () => void;
}> = ({
  profile,
  loading,
  stale,
  gamesOnlyCount,
  picsScanning,
  onAppsPress,
  onGamesPress,
  onWishlistPress,
}) => (
  <View>
    <View style={styles.infoBoxRow}>
      <TouchableOpacity style={styles.infoBox} activeOpacity={0.7} onPress={onAppsPress}>
        <View style={styles.infoBoxValueRow}>
          {loading
            ? <LoadingDots color={colors.text.primary} size={18} />
            : <Text style={styles.infoBoxNumber}>
                {profile.ownedAppids?.length ?? profile.gamesCount}
              </Text>}
        </View>
        <Text style={styles.infoBoxLabel}>Apps</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.infoBox} activeOpacity={0.7} onPress={onGamesPress}>
        <View style={styles.infoBoxValueRow}>
          {loading || picsScanning
            ? <LoadingDots color={colors.text.primary} size={18} />
            : <Text style={styles.infoBoxNumber}>{gamesOnlyCount ?? 0}</Text>}
        </View>
        <Text style={styles.infoBoxLabel}>Games</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.infoBox} activeOpacity={0.7} onPress={onWishlistPress}>
        <View style={styles.infoBoxValueRow}>
          {loading
            ? <LoadingDots color={colors.text.primary} size={18} />
            : <Text style={styles.infoBoxNumber}>
                {profile.wishlistAppids?.length ?? 0}
              </Text>}
        </View>
        <Text style={styles.infoBoxLabel}>Wishlist</Text>
      </TouchableOpacity>
    </View>
    {stale && !loading && (
      <Text style={styles.staleHint}>
        Steam is rate-limiting us. Showing the last known counts.
      </Text>
    )}
  </View>
);

// ─── Steam Profile Lookup (no API key - uses public XML profile) ────────────

interface SteamProfileResult {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  vanityUrl: string;
  onlineState: string;
  stateMessage: string;
  privacyState: string;
  inGameBannerUrl: string;
  /** Optional - set to 'steam' for Steam OpenID sign-ins so the Profile screen
   *  keeps the auth-options layout instead of switching to MyContent. */
  authMethod?: 'steam' | 'search';
  /** Animated avatar-frame URL pulled from the miniprofile JSON endpoint. */
  avatarFrameUrl?: string;
}

/**
 * Convert a 17-digit SteamID64 string to the 32-bit "account id" used by
 * the miniprofile endpoint. accountid = steamid64 - 76561197960265728.
 *
 * We do the subtraction with string arithmetic because:
 *   - The constant 76561197960265728 is greater than 2^53, so plain JS Number
 *     loses precision on these values.
 *   - We can't use BigInt - the Hermes engine that React Native runs on
 *     rejects BigInt literals at parse time (project rule).
 */
function steamId64ToAccountId(id64: string): string {
  const STEAM_BASE = '76561197960265728';
  if (!/^\d{17}$/.test(id64)) return '';
  const a = id64;
  const b = STEAM_BASE;
  let borrow = 0;
  let out = '';
  for (let i = 16; i >= 0; i--) {
    let d = (a.charCodeAt(i) - 48) - (b.charCodeAt(i) - 48) - borrow;
    if (d < 0) { d += 10; borrow = 1; } else { borrow = 0; }
    out = d + out;
  }
  return out.replace(/^0+/, '') || '0';
}

/**
 * Extract app ID for the currently-played game and build a banner URL.
 * Steam removed <inGameInfo> from the XML. The game name now only appears in
 * <stateMessage> as "In-Game<br/>Game Name". We match that name against
 * <mostPlayedGames> entries to find the appid from <gameLink>.
 */
function buildGameBannerUrl(xml: string, gameName: string): string {
  if (!gameName) return '';

  // Strategy 1: Match game name against <mostPlayedGames> entries
  const gameEntries = xml.match(/<mostPlayedGame>[\s\S]*?<\/mostPlayedGame>/g) || [];
  for (const entry of gameEntries) {
    const entryName = extractXmlTag(entry, 'gameName');
    if (entryName && entryName.toLowerCase() === gameName.toLowerCase()) {
      const appIdMatch = entry.match(/\/app[s]?\/(\d+)/);
      if (appIdMatch) {
        return `https://cdn.akamai.steamstatic.com/steam/apps/${appIdMatch[1]}/library_hero_2x.jpg`;
      }
    }
  }

  // Strategy 2: If no match in mostPlayedGames, try <inGameInfo> (legacy, may still work for some)
  const inGameBlock = xml.match(/<inGameInfo>[\s\S]*?<\/inGameInfo>/)?.[0] || '';
  if (inGameBlock) {
    const appIdMatch = inGameBlock.match(/\/apps?\/(\d+)/);
    if (appIdMatch) {
      return `https://cdn.akamai.steamstatic.com/steam/apps/${appIdMatch[1]}/library_hero_2x.jpg`;
    }
  }

  return '';
}

/**
 * Convert a SteamID classic (STEAM_X:Y:Z) or SteamID3 ([U:1:X]) to SteamID64.
 * Uses string-based arithmetic to avoid BigInt compatibility issues.
 */
function steamId64FromParts(accountId: number, authServer: number = 0): string {
  // Base: 76561197960265728
  // id64 = base + accountId * 2 + authServer  (for classic)
  // id64 = base + accountId                    (for SteamID3)
  const base = [7, 6, 5, 6, 1, 1, 9, 7, 9, 6, 0, 2, 6, 5, 7, 2, 8];
  const addVal = accountId * 2 + authServer;

  // Add addVal to the base number (right to left)
  let carry = addVal;
  const result = [...base];
  for (let i = result.length - 1; i >= 0 && carry > 0; i--) {
    const sum = result[i] + (carry % 10);
    carry = Math.floor(carry / 10) + Math.floor(sum / 10);
    result[i] = sum % 10;
  }
  return result.join('');
}

/**
 * Normalize any Steam identifier into { type, value } for fetching.
 *
 * Supports:
 *  - Full profile URL: https://steamcommunity.com/id/xxx or /profiles/xxx
 *  - SteamID64:        76561198012345678
 *  - SteamID classic:  STEAM_0:1:12345
 *  - SteamID3:         [U:1:12345]
 *  - Vanity URL:       anything else (username)
 */
function normalizeSteamQuery(raw: string): { type: 'id' | 'vanity'; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Full URL: steamcommunity.com/id/xxx or /profiles/xxx
  const urlIdMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  if (urlIdMatch) return { type: 'vanity', value: urlIdMatch[1] };

  const urlProfileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (urlProfileMatch) return { type: 'id', value: urlProfileMatch[1] };

  // SteamID classic: STEAM_X:Y:Z
  const classicMatch = trimmed.match(/^STEAM_\d+:(\d+):(\d+)$/i);
  if (classicMatch) {
    const authServer = parseInt(classicMatch[1], 10);
    const accountNumber = parseInt(classicMatch[2], 10);
    return { type: 'id', value: steamId64FromParts(accountNumber, authServer) };
  }

  // SteamID3: [U:1:X]
  const id3Match = trimmed.match(/^\[U:1:(\d+)\]$/i);
  if (id3Match) {
    const accountId = parseInt(id3Match[1], 10);
    // SteamID3 accountId = accountNumber * 2 + authServer, so base + accountId directly
    const base = [7, 6, 5, 6, 1, 1, 9, 7, 9, 6, 0, 2, 6, 5, 7, 2, 8];
    let carry = accountId;
    const result = [...base];
    for (let i = result.length - 1; i >= 0 && carry > 0; i--) {
      const sum = result[i] + (carry % 10);
      carry = Math.floor(carry / 10) + Math.floor(sum / 10);
      result[i] = sum % 10;
    }
    return { type: 'id', value: result.join('') };
  }

  // 17-digit Steam ID64
  if (/^\d{17}$/.test(trimmed)) return { type: 'id', value: trimmed };

  // Fallback: vanity URL / username
  return { type: 'vanity', value: trimmed };
}

function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))
    || xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? match[1] : null;
}

async function lookupSteamProfile(query: string): Promise<SteamProfileResult | null> {
  const parsed = normalizeSteamQuery(query);
  if (!parsed) return null;

  // Step 1: If vanity URL, resolve to steamId64 first
  let steamId64: string | null = null;
  let customUrl = '';

  const cacheBust = `_t=${Date.now()}`;

  if (parsed.type === 'vanity') {
    const vanityRes = await fetch(
      `https://steamcommunity.com/id/${encodeURIComponent(parsed.value)}/?xml=1&${cacheBust}`,
    );
    if (!vanityRes.ok) return null;
    const vanityXml = await vanityRes.text();
    steamId64 = extractXmlTag(vanityXml, 'steamID64');
    customUrl = extractXmlTag(vanityXml, 'customURL') || parsed.value;
    if (!steamId64) return null;
  } else {
    steamId64 = parsed.value;
  }

  // Step 2: Always fetch live data from /profiles/{steamId64} - never caches
  const idBase = `https://steamcommunity.com/profiles/${steamId64}`;
  const res = await fetch(`${idBase}/?xml=1&${cacheBust}`);
  if (!res.ok) return null;

  const xml = await res.text();

  const personaName = extractXmlTag(xml, 'steamID');
  const avatarUrl = extractXmlTag(xml, 'avatarFull');
  if (!customUrl) customUrl = extractXmlTag(xml, 'customURL') || '';
  const onlineState = extractXmlTag(xml, 'onlineState') || 'offline';
  const rawStateMsg = (extractXmlTag(xml, 'stateMessage') || 'Offline').replace(/<[^>]*>/g, ' ').replace(/]]>/g, '').replace(/<!\[CDATA\[/g, '').trim();
  const privacyState = extractXmlTag(xml, 'privacyState') || 'public';

  // Extract game name from stateMessage: "In-Game<br/>Game Name" (Steam removed <inGameInfo>)
  const stateMessageRaw = extractXmlTag(xml, 'stateMessage') || '';
  const inGameName = onlineState === 'in-game'
    ? stateMessageRaw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').split('\n').pop()?.trim() || null
    : null;
  const stateMessage = onlineState === 'in-game' && inGameName
    ? `In-Game ${inGameName}`
    : rawStateMsg;
  const inGameBannerUrl = onlineState === 'in-game' ? buildGameBannerUrl(xml, inGameName || '') : '';

  if (!personaName) return null;

  return {
    steamId: steamId64,
    personaName,
    avatarUrl: avatarUrl || '',
    vanityUrl: customUrl,
    onlineState,
    stateMessage,
    privacyState,
    inGameBannerUrl,
  };
}

// ─── Profile Counts ─────────────────────────────────────────────────────────

/**
 * Fetch the games count from the public Steam community profile HTML page.
 */
async function fetchGamesCount(steamId64: string): Promise<number> {
  try {
    const res = await fetch(
      `https://steamcommunity.com/profiles/${steamId64}?_t=${Date.now()}`,
    );
    if (!res.ok) return 0;
    const html = await res.text();
    const m = html.match(/games\/\?tab=all[^>]*>[\s\S]*?(\d[\d,]*)/i)
      || html.match(/>Games\s+(\d[\d,]*)</i);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch total inventory item count across ALL games.
 * Parses the g_rgAppContextData JS variable from the public inventory page,
 * which contains asset_count per game - no API key required.
 */
async function fetchInventoryCount(steamId64: string): Promise<number> {
  try {
    const res = await fetch(
      `https://steamcommunity.com/profiles/${steamId64}/inventory/?_t=${Date.now()}`,
    );
    if (!res.ok) return 0;
    const html = await res.text();

    const match = html.match(/g_rgAppContextData\s*=\s*({[\s\S]*?});/);
    if (!match) return 0;

    const appData = JSON.parse(match[1]);
    let total = 0;
    for (const appId of Object.keys(appData)) {
      total += appData[appId]?.asset_count ?? 0;
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Fetch wishlist item count using the Steam Web API (no key required).
 */
async function fetchWishlistCount(steamId64: string): Promise<number> {
  try {
    const res = await fetch(
      `https://api.steampowered.com/IWishlistService/GetWishlistItemCount/v1/?steamid=${steamId64}`,
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data?.response?.count ?? 0;
  } catch {
    return 0;
  }
}

// ─── Privacy probes - detect what's public/private per profile section ──────
const probeWithTimeout = async (url: string, init?: RequestInit, ms = 6000): Promise<Response | null> => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(t);
    return res;
  } catch { return null; }
};

// Inventory visibility - Steam's JSON endpoint. Returns the literal string "null"
// when the inventory is private, and a JSON object with total_inventory_count when public.
async function probeInventory(steamId64: string): Promise<SectionVisibility> {
  try {
    const res = await probeWithTimeout(`https://steamcommunity.com/inventory/${steamId64}/753/6?l=english&count=1`);
    if (!res) return 'unknown';
    if (res.status === 403) return 'private';
    if (!res.ok) return 'unknown';
    const text = (await res.text())?.trim();
    if (!text || text === 'null') return 'private';
    try {
      const j = JSON.parse(text);
      if (j?.success === 1 || j?.total_inventory_count !== undefined || Array.isArray(j?.assets)) return 'public';
    } catch {}
    return 'private';
  } catch { return 'unknown'; }
}

// Wishlist visibility - IWishlistService returns response.count (even 0) when public,
// empty {} when private. Reliable.
async function probeWishlist(steamId64: string): Promise<SectionVisibility> {
  try {
    const res = await probeWithTimeout(`https://api.steampowered.com/IWishlistService/GetWishlistItemCount/v1/?steamid=${steamId64}`);
    if (!res || !res.ok) return 'unknown';
    const j = await res.json();
    if (j?.response?.count !== undefined) return 'public';
    return 'private';
  } catch { return 'unknown'; }
}

async function probeComments(steamId64: string): Promise<SectionVisibility> {
  const res = await probeWithTimeout(`https://steamcommunity.com/comment/Profile/render/${steamId64}/-1/?count=1`);
  if (!res || !res.ok) return 'unknown';
  try {
    const j = await res.json();
    if (j?.success && (j.total_count !== undefined)) return 'public';
    return 'private';
  } catch { return 'unknown'; }
}

export async function probeProfilePrivacy(
  steamId64: string,
  overall: 'public' | 'friendsonly' | 'private' | string,
): Promise<ProfilePrivacy> {
  // friendsonly is ONLY meaningful for the overall profile (Steam tells us in XML).
  // From a non-friend's POV, friendsonly looks identical to private on every sub-section.
  if (overall === 'private' || overall === 'friendsonly') {
    return {
      profile: overall as SectionVisibility,
      games: 'private', inventory: 'private', wishlist: 'private',
      friends: 'private', comments: 'private',
    };
  }
  // For public profiles: probe what we can reliably probe. Games and Friends would
  // need a Steam Web API key to detect - the public HTML pages are React-rendered,
  // so we can't scrape them. We default these to 'public' (mirror profile state)
  // since "this section is hidden when the parent profile is public" is the rare case.
  const [inventory, wishlist, comments] = await Promise.all([
    probeInventory(steamId64),
    probeWishlist(steamId64),
    probeComments(steamId64),
  ]);
  return {
    profile: 'public',
    games: 'public',     // inferred from overall (no reliable non-API probe)
    inventory,
    wishlist,
    friends: 'public',   // inferred from overall (no reliable non-API probe)
    comments,
  };
}

// ─── Shared shimmer animation (lifted up so both buttons stay perfectly synced) ─
// Translate ranges are derived from the screen width so the shimmer enters/exits
// at the same relative position on any device.
const _BTN_WIDTH = Dimensions.get('window').width - 40; // matches the page's 20px horizontal padding
const SHIMMER_LAG = _BTN_WIDTH * 0.22; // Google lags by 22% of button width - combined with the 25° rotation and the gap between buttons, this lines up the two bands as one continuous diagonal
const SHIMMER_RANGE_STEAM = { from: -120, to: _BTN_WIDTH + 60 };
const SHIMMER_RANGE_GOOGLE = { from: SHIMMER_RANGE_STEAM.from - SHIMMER_LAG, to: SHIMMER_RANGE_STEAM.to - SHIMMER_LAG };

function useSharedShimmer(opts?: { native?: boolean }) {
  const native = opts?.native !== false; // default true for buttons
  const shimmerX = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }),
        Animated.delay(2400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerX, native]);
  return shimmerX;
}

/**
 * rAF-driven shimmer for use inside <Modal>. Returns a plain number from -1
 * to 1 that re-renders the component on each frame. Bridge-free, so the
 * Modal's separate native window doesn't cut us off from the animation.
 */
function useDialogShimmer(active: boolean): number {
  const [t, setT] = useState(-1);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = Date.now();
    const SWEEP_MS = 2200;
    const DELAY_MS = 2400;
    const TOTAL = SWEEP_MS + DELAY_MS;
    const easeInOutCubic = (x: number) =>
      x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    const tick = () => {
      const elapsed = (Date.now() - start) % TOTAL;
      let v;
      if (elapsed < SWEEP_MS) {
        const p = elapsed / SWEEP_MS;
        v = -1 + 2 * easeInOutCubic(p);
      } else {
        v = 1; // hold off-screen during the delay
      }
      setT(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return t;
}

// Reusable per-button shimmer - clipped to the button's overflow:hidden.
// Both buttons get the SAME shimmerX with the SAME translate range, so the two
// bands appear at the same horizontal position simultaneously. With a small
// 6px gap between buttons, the eye reads them as one continuous diagonal.
const ShimmerOverlay: React.FC<{
  /** Either an Animated.Value (button path, native-driven) or a plain
   *  number from -1..1 (dialog path, JS-driven via rAF). */
  shimmerX: Animated.Value | number;
  tint: string;
  opacity: number;
  /** Optional style override - used by the dialog where the card is taller
   *  than the auth button so the band needs more vertical bleed. */
  style?: any;
}> = ({ shimmerX, tint, opacity, style }) => {
  // Compute translateX. If shimmerX is a number, do the interpolation here;
  // if it's an Animated.Value, defer to its .interpolate.
  const translateX =
    typeof shimmerX === 'number'
      ? SHIMMER_RANGE_STEAM.from +
        ((shimmerX + 1) / 2) * (SHIMMER_RANGE_STEAM.to - SHIMMER_RANGE_STEAM.from)
      : shimmerX.interpolate({
          inputRange: [-1, 1],
          outputRange: [SHIMMER_RANGE_STEAM.from, SHIMMER_RANGE_STEAM.to],
        });
  return (
  <Animated.View
    pointerEvents="none"
    style={[
      styles.buttonShimmer,
      style,
      {
        transform: [
          { translateX },
          { rotate: '25deg' },
        ],
      },
    ]}
  >
    <LinearGradient
      colors={['transparent', `rgba(${tint},${opacity})`, 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  </Animated.View>
  );
};

const SteamSignInButton: React.FC<{
  onPress: () => void;
  shimmerX: Animated.Value;
  /** When set, the button shows the user's persona name instead of "Sign in
   *  with Steam" - i.e. the post-sign-in state. Tapping still calls onPress
   *  (parent decides whether to sign-out / re-trigger flow). */
  signedInAs?: string | null;
}> = ({ onPress, shimmerX, signedInAs }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
    <View style={styles.steamButtonOuter}>
      <LinearGradient
        colors={['#0B1929', '#163A56', '#1F5879', '#2A7AAB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.steamButtonWatermark} pointerEvents="none">
        <IconSteam size={95} color="rgba(103, 193, 245, 0.22)" />
      </View>
      <ShimmerOverlay shimmerX={shimmerX} tint="255,255,255" opacity={0.28} />
      <View style={styles.steamButtonForeground}>
        <IconSteam size={26} color="#fff" />
        <Text style={styles.authButtonSteamText} numberOfLines={1}>
          {signedInAs ? signedInAs : 'Sign in with Steam'}
        </Text>
      </View>
    </View>
  </Pressable>
);

const GoogleSignInButton: React.FC<{
  onPress: () => void;
  shimmerX: Animated.Value;
  /** When set, shows the user's Google email/name instead of the default
   *  "Sign in with Google" label. */
  signedInAs?: string | null;
}> = ({ onPress, shimmerX, signedInAs }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
    <View style={styles.googleButtonOuter}>
      <LinearGradient
        colors={['#F4F6FA', '#FFFFFF', '#F4F6FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.googleButtonWatermark} pointerEvents="none">
        <View style={{ opacity: 0.18 }}>
          <IconGoogle size={100} />
        </View>
      </View>
      <ShimmerOverlay shimmerX={shimmerX} tint="255,255,255" opacity={0.5} />
      <View style={styles.steamButtonForeground}>
        <IconGoogle size={28} />
        <Text style={styles.authButtonGoogleText} numberOfLines={1}>
          {signedInAs ? signedInAs : 'Sign in with Google'}
        </Text>
      </View>
    </View>
  </Pressable>
);

// Cluster: small 6px gap between buttons + a shared synced shimmer in each.
// 6px is small enough that the diagonal looks continuous; both buttons clip
// the band internally so nothing bleeds outside their borders.
const AuthButtonCluster: React.FC<{
  onSteamPress: () => void;
  onGooglePress: () => void;
  shimmerX: Animated.Value;
  steamSignedInAs?: string | null;
  googleSignedInAs?: string | null;
}> = ({ onSteamPress, onGooglePress, shimmerX, steamSignedInAs, googleSignedInAs }) => (
  <View>
    <SteamSignInButton onPress={onSteamPress} shimmerX={shimmerX} signedInAs={steamSignedInAs} />
    {/* Same vertical distance as between the screen-edge area and the Steam
        button (i.e. matches secondaryZone's paddingTop = 12). */}
    <View style={{ height: 12 }} />
    <GoogleSignInButton onPress={onGooglePress} shimmerX={shimmerX} signedInAs={googleSignedInAs} />
  </View>
);

// ─── Auth Options: Steam login / Google login / OR / search ──
// Used in both states:
//   - Anonymous (no profile): both buttons show "Sign in", search bar visible
//   - Steam-OAuth signed in: Steam button shows the persona name, Google still
//     shows "Sign in with Google" (account-linking is a future feature)
const AuthOptions: React.FC<{
  onSteamPress: () => void;
  onGooglePress: () => void;
  steamSignedInAs?: string | null;
  googleSignedInAs?: string | null;
}> = ({ onSteamPress, onGooglePress, steamSignedInAs, googleSignedInAs }) => {
  const shimmerX = useSharedShimmer();
  // Header reflects the current auth state of BOTH providers:
  //   neither in  → LOGIN
  //   one of each → LOGIN | LOGOUT
  //   both in     → LOGOUT
  const steamIn = !!steamSignedInAs;
  const googleIn = !!googleSignedInAs;
  const headerLabel =
    steamIn && googleIn ? 'LOGOUT'
    : !steamIn && !googleIn ? 'LOGIN'
    : 'LOGIN | LOGOUT';
  return (
  <View style={styles.authOptionsWrapper}>
    {/* Header divider - first element, so no marginTop. Bottom gap matches
        the inter-button gap (12) for a single consistent vertical rhythm. */}
    <View style={[styles.orDividerRow, { marginTop: 0, marginBottom: 12 }]}>
      <View style={styles.orDividerLine} />
      <Text style={styles.orDividerText}>{headerLabel}</Text>
      <View style={styles.orDividerLine} />
    </View>
    {/* Both buttons + a single shimmer that sweeps across BOTH of them
        as one continuous diagonal - no clipping at the gap. */}
    <AuthButtonCluster
      onSteamPress={onSteamPress}
      onGooglePress={onGooglePress}
      shimmerX={shimmerX}
      steamSignedInAs={steamSignedInAs}
      googleSignedInAs={googleSignedInAs}
    />
    {/* "Why is this safe?" link FIRST so the privacy reassurance hits before the explanation */}
    <Pressable
      onPress={() => {
        // TODO: open the project repository + a short "why this is safe" explainer video
      }}
      style={({ pressed }) => [styles.whySafeRow, pressed && { opacity: 0.6 }]}
      hitSlop={6}
    >
      <Text style={styles.whySafeText}>Why is this safe?</Text>
      <View style={styles.infoIconCircle}>
        <Text style={styles.infoIconLetter}>i</Text>
      </View>
    </Pressable>
    {/* Explainer paragraph - hidden ONLY when Steam OAuth is connected
        (we already have the user's library so the pitch is moot). Stays
        visible for anonymous and Google-only users. */}
    {!steamIn && (
      <Text style={styles.authHelperText}>
        Signing in is the <Text style={styles.authHelperBold}>easiest way</Text> to use the app. Your <Text style={styles.authHelperBold}>library, items, DLCs and wishlists</Text> load automatically, <Text style={styles.authHelperBold}>deal alerts</Text> go straight to you, and your settings <Text style={styles.authHelperBold}>follow you across devices</Text>. We <Text style={styles.authHelperBold}>only see what Steam and Google already share</Text> with any app, nothing more.
      </Text>
    )}

    {/* OR divider - visual separator only. Hidden once Steam is connected
        because the alternative path (search someone else's profile) doesn't
        make sense any more. Google-only stays visible (you might still want
        to attach Steam by searching). */}
    {!steamIn && (
      <View style={styles.orDividerRow}>
        <View style={styles.orDividerLine} />
        <Text style={styles.orDividerText}>OR</Text>
        <View style={styles.orDividerLine} />
      </View>
    )}
  </View>
  );
};

// ─── Steam Profile Search ───────────────────────────────────────────────────
const SteamProfileSearch: React.FC<{
  locked: boolean;
  lockedLabel: string;
  onSelect: (p: SteamProfileResult) => void;
  onRemove: () => void;
}> = ({ locked, lockedLabel, onSelect, onRemove }) => {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SteamProfileResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setResult(null);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const profile = await lookupSteamProfile(trimmed);
      setResult(profile);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (!text.trim()) {
        setResult(null);
        setSearched(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceTimer.current = setTimeout(() => doSearch(text), 500);
    },
    [doSearch],
  );

  const onClear = useCallback(() => {
    setQuery('');
    setResult(null);
    setSearched(false);
    setLoading(false);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  const handleSelect = useCallback((p: SteamProfileResult) => {
    onSelect(p);
    setEditing(false);
    setQuery('');
    setResult(null);
    setSearched(false);
  }, [onSelect]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setQuery('');
    setResult(null);
    setSearched(false);
    setLoading(false);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  const showSearch = !locked || editing;

  return (
    <View style={styles.searchWrapper}>
      {/* Locked state: blue button */}
      {!showSearch && (
        <Pressable
          style={({ pressed }) => [styles.lockedBlueBox, pressed && { opacity: 0.7 }]}
          onPress={() => {
            setEditing(true);
            setQuery(lockedLabel);
            setTimeout(() => doSearch(lockedLabel), 50);
          }}
        >
          <View style={styles.lockedLabelRow}>
            <IconPerson size={18} color="#fff" />
            <Text style={styles.lockedLabel} numberOfLines={1}>
              {lockedLabel}
            </Text>
          </View>
        </Pressable>
      )}

      {/* Search state */}
      {showSearch && (
        <View style={styles.searchBlueBox}>
          <View
            style={[
              styles.searchInputContainer,
              focused && styles.searchInputContainerFocused,
            ]}
          >
            <View style={styles.searchIcon}>
              <IconSearchApp color="#fff" />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search Steam ID or username..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              cursorColor="#fff"
              selectionColor="rgba(255,255,255,0.3)"
              value={query}
              onChangeText={onChangeText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={onClear} activeOpacity={0.6}>
                <IconClear color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {loading && (
            <View style={styles.loadingContainer}>
              <LoadingLine visible={true} />
            </View>
          )}

          {!loading && searched && result && (
            <TouchableOpacity
              style={styles.resultCard}
              activeOpacity={0.7}
              onPress={() => handleSelect(result)}
            >
              <Image source={{ uri: result.avatarUrl }} style={styles.resultAvatar} cachePolicy="memory-disk" />
              <View style={styles.resultInfo}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {result.personaName}
                </Text>
                <Text style={styles.resultSteamId}>{result.steamId}</Text>
              </View>
            </TouchableOpacity>
          )}

          {!loading && searched && !result && (
            <Text style={styles.noResult}>No profile found</Text>
          )}

          {/* Cancel / Remove buttons at the bottom */}
          {locked && editing ? (
            <View style={styles.editActions}>
              <TouchableOpacity onPress={handleCancel} activeOpacity={0.7} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { handleCancel(); onRemove(); }} activeOpacity={0.7} style={styles.cancelBtn}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : !locked && (query.length > 0 || searched) && (
            <View style={styles.editActions}>
              <TouchableOpacity onPress={() => { onClear(); Keyboard.dismiss(); }} activeOpacity={0.7} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// ─── My Content Menu ─────────────────────────────────────────────────────────
const MyContentMenu: React.FC<{
  onLibraryPress?: () => void;
  onWishlistPress?: () => void;
  onItemsPress?: () => void;
}> = ({ onLibraryPress, onWishlistPress, onItemsPress }) => {
  const pressHandlers: Record<string, (() => void) | undefined> = {
    'My Library': onLibraryPress,
    'Wishlist': onWishlistPress,
    'Inventory': onItemsPress,
  };

  return (
    <View style={styles.myContentContainer}>
      <Text style={styles.sectionLabel}>MY CONTENT</Text>
      {MY_CONTENT_ITEMS.map((item, index) => (
        <React.Fragment key={item}>
          <TouchableOpacity
            style={styles.listItem}
            activeOpacity={0.8}
            onPress={pressHandlers[item]}
          >
            <Text style={styles.listItemText}>{item}</Text>
          </TouchableOpacity>
          {index < MY_CONTENT_ITEMS.length - 1 && <View style={styles.divider} />}
        </React.Fragment>
      ))}
    </View>
  );
};

// ─── Confirmation dialog ─────────────────────────────────────────────────────
// Flat, rectangular (no rounded cards), blue gradient buttons (the same
// gradient our sign-in button uses), and no red destructive button -
// neutral and "danger" actions both use the blue accent. Cancel is a
// transparent button with a subtle 1px border. Card uses the same dark
// #1F2127 surface the rest of the app's secondary zone uses, so the dialog
// reads as part of the surface stack, not an overlaid Material card.
interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  /** Plain string OR a ReactNode (so callers can embed bold spans, etc.). */
  body?: React.ReactNode;
  confirmLabel: string;
  /** Pass `null` to hide the Cancel button entirely (single-button alert
   *  mode, e.g. error popups). Defaults to "Cancel" when omitted. */
  cancelLabel?: string | null;
  /** 'steam' = dark navy gradient + Steam logo watermark + white text;
   *  'google' = light gradient + Google logo watermark + dark text.
   *  Default: 'steam'. */
  variant?: 'steam' | 'google';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible, title, body, confirmLabel, cancelLabel = 'Cancel',
  variant = 'steam', onConfirm, onCancel,
}) => {
  const isGoogle = variant === 'google';
  // Native-driven Animated values silently fail to update inside RN Modal
  // on Android (the modal renders in a separate native window the JS thread
  // can't reach). We drive the shimmer with rAF + state instead - slightly
  // more JS work but reliably animates inside the modal.
  const shimmerX = useDialogShimmer(visible);
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Pressable style={dialogStyles.backdrop} onPress={onCancel}>
        <Pressable style={dialogStyles.cardWrap} onPress={() => {}}>
          <View style={dialogStyles.card}>
            {/* Card background mirrors the matching auth button: Steam = dark
                navy gradient, Google = light/white gradient. */}
            <LinearGradient
              colors={
                isGoogle
                  ? ['#F4F6FA', '#FFFFFF', '#F4F6FA']
                  : ['#0B1929', '#163A56', '#1F5879', '#2A7AAB']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Diagonal shimmer band - same animation as the sign-in buttons.
                Steam variant uses a white shimmer over the dark navy gradient;
                Google variant uses a *darker* tint (Google's neutral gray)
                because a white shimmer over white is invisible. */}
            <ShimmerOverlay
              shimmerX={shimmerX}
              tint={isGoogle ? '60,64,67' : '255,255,255'}
              opacity={isGoogle ? 0.18 : 0.28}
              // Popup is taller than a button, so bleed the rotated band
              // far past top/bottom so it sweeps the full card height.
              style={{ top: -120, bottom: -120, width: 70 }}
            />
            {/* Logo watermark - matches the corresponding sign-in button.
                Same off-the-edge positioning so the visual rhythm is consistent. */}
            <View style={dialogStyles.watermark} pointerEvents="none">
              {isGoogle ? (
                <View style={{ opacity: 0.18 }}>
                  <IconGoogle size={220} />
                </View>
              ) : (
                <IconSteam size={220} color="rgba(103, 193, 245, 0.20)" />
              )}
            </View>
            <Text style={[dialogStyles.title, isGoogle && dialogStyles.titleLight]}>
              {title}
            </Text>
            {/* Body can be either a plain string or a JSX node. Strings get
                wrapped in a Text; nodes (e.g. a bullet-list View) render
                directly - wrapping a View inside a Text breaks layout in RN. */}
            {typeof body === 'string'
              ? <Text style={[dialogStyles.body, isGoogle && dialogStyles.bodyLight]}>{body}</Text>
              : body}
            <View style={dialogStyles.buttonRow}>
              {cancelLabel !== null && (
                <Pressable
                  onPress={onCancel}
                  style={({ pressed }) => [
                    dialogStyles.btn,
                    isGoogle ? dialogStyles.btnCancelLight : dialogStyles.btnCancel,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={isGoogle ? dialogStyles.btnCancelTextLight : dialogStyles.btnCancelText}>
                    {cancelLabel}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={onConfirm}
                style={({ pressed }) => [
                  dialogStyles.btn,
                  dialogStyles.btnConfirm,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={dialogStyles.btnConfirmText}>{confirmLabel}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const dialogStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrap: {
    width: '100%',
    paddingHorizontal: 20, // matches authOptionsWrapper.paddingHorizontal
  },
  card: {
    // backgroundColor is provided by the LinearGradient overlay.
    // No borderRadius - Steam mobile is flat, rectangular cards.
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    overflow: 'hidden', // clip the gradient and watermark to the card bounds
  },
  watermark: {
    position: 'absolute',
    // Push further off the right edge so more of the logo is clipped -
    // only a sliver "peeks" in from the bottom-right corner.
    right: -90,
    bottom: -45,
  },
  bodyBold: {
    fontFamily: 'Inter_700Bold',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  bulletDot: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#fff',
    width: 16,
    lineHeight: 18,
  },
  bulletDotLight: {
    color: '#000',
  },
  bulletText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
  title: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.3,
  },
  titleLight: {
    color: '#000',
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    // Pure white on the Steam dark gradient - no gray hierarchy step.
    color: '#fff',
    lineHeight: 18,
    marginTop: 8,
  },
  bodyLight: {
    color: '#000',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 8,
  },
  btn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // clips the gradient to the button bounds
  },
  btnCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fff', // pure white border on Steam dark variant
  },
  btnCancelLight: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000', // pure black border on Google light variant
  },
  btnCancelText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#fff',
    letterSpacing: 0.4,
  },
  btnCancelTextLight: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#000',
    letterSpacing: 0.4,
  },
  btnConfirm: {
    // Same flat Steam blue as the search-id container (searchBlueBox).
    // No gradient - Steam's mobile UI uses solid fills for action buttons.
    backgroundColor: '#1A9FFF',
  },
  btnConfirmText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#fff',
    letterSpacing: 0.4,
  },
});

// ─── Account Settings ────────────────────────────────────────────────────────
const AccountSettings: React.FC<{ onSignOut: () => void }> = ({ onSignOut }) => (
  <View style={styles.accountContainer}>
    <TouchableOpacity style={styles.secondaryListItem} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={styles.secondaryItemTitle}>Account Details</Text>
        <Text style={styles.secondaryItemDesc}>Store, Security, Family</Text>
      </View>
      <IconChevronRight />
    </TouchableOpacity>
    <View style={styles.accountDivider} />
    <TouchableOpacity style={styles.secondaryListItem} activeOpacity={0.8} onPress={onSignOut}>
      <Text style={styles.logoutText}>Sign Out</Text>
    </TouchableOpacity>
  </View>
);

// ─── Main Screen with swipe-to-dismiss ───────────────────────────────────────
const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const [slideInDone, setSlideInDone] = useState(false);
  // Initialise to true unconditionally. ProfileContext hydrates the
  // saved profile from AsyncStorage in an async effect, so the very
  // first render has `linked=false` even when there IS a saved profile -
  // conditional initialisation would let the stale cached numbers
  // ("125 / 0 / 0") flash for one frame before the hydrate completes
  // and the fetch effect fires. Starting at true is safe: the count
  // boxes are only rendered when `linked` is true, and the fetch effect
  // will flip this to false once it resolves. The handler below also
  // resets it to true whenever the active steamId changes.
  const [countsLoading, setCountsLoading] = useState<boolean>(true);
  // True when the most recent count fetch hit a rate limit and we kept
  // the previous values instead of overwriting with 0/'-'. Drives the
  // small "Steam is rate-limiting us" hint under the InfoBoxes.
  const [countsStale, setCountsStale] = useState(false);
  const classifiedIdRef = useRef<string>('');
  const { profile, linked, setLinkedProfile, unlinkProfile, setGoogleIdentity, unlinkGoogle } = useProfile();

  // Background PICS scan to bucket owned app ids by `common.type`. Runs once
  // when the owned-apps list changes, caches results in AsyncStorage so the
  // second mount is instant. Drives the "Games" info box.
  const ownedAppidsList = useMemo(
    () => profile.ownedAppids ?? [],
    [profile.ownedAppids],
  );
  const picsCounts = usePicsTypes(ownedAppidsList);
  const gamesOnlyCount = picsCounts.byType.game ?? 0;
  const picsScanning = !picsCounts.ready && picsCounts.total > 0;

  // Silent library refresh: every time this screen comes into focus, hit
  // the hidden /dynamicstore/userdata/ WebView so newly bought games / DLC
  // show up without forcing the user to re-sign-in.
  const { refreshLibrary } = useSteamSync();
  useFocusEffect(
    useCallback(() => {
      refreshLibrary();
    }, [refreshLibrary]),
  );
  // Confirmation dialog state. We track which provider the user is about
  // to sign out of so the dialog body can name them correctly.
  const [signOutOpen, setSignOutOpen] = useState<null | 'steam' | 'google' | 'all'>(null);
  // Sign-in confirmation dialog: null = closed, otherwise the provider the
  // user is about to sign into. The dialog lists the features that flow
  // unlocks; tapping Continue triggers the actual OAuth flow.
  const [signInOpen, setSignInOpen] = useState<null | 'steam' | 'google'>(null);
  // Single-button styled error popup. provider drives the variant
  // (Steam dark / Google light); reason is the short error name.
  const [errorOpen, setErrorOpen] = useState<null | { provider: 'steam' | 'google'; reason: string }>(null);

  // Always-fresh ref to the latest profile - avoids stale closures in
  // callbacks defined below.
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Sign-in handlers. Steam goes through SteamAuth (OpenID + WebView,
  // see src/auth/steam/SteamAuth.tsx for the full security narrative).
  // Google is still a stub - independent identity, not yet implemented.
  const {
    signIn: runSteamSignIn,
    signOut: runSteamSignOut,
    loginError: steamLoginError,
  } = useSteamAuth();
  const runGoogleSignIn = useCallback(() => {}, []);

  // Surface SteamAuth errors through the existing styled popup. We don't
  // pop one for 'cancelled' - silent close on user-initiated dismissal.
  useEffect(() => {
    if (!steamLoginError) return;
    if (steamLoginError === 'cancelled') return;
    setErrorOpen({ provider: 'steam', reason: steamLoginError });
  }, [steamLoginError]);

  const animateProfileChange = useCallback((apply: () => void) => {
    Animated.timing(contentOpacity, {
      toValue: 0.5,
      duration: 80,
      useNativeDriver: true,
    }).start(() => {
      LayoutAnimation.configureNext({
        duration: 250,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'easeInEaseOut' },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      });
      apply();
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [contentOpacity]);

  // Fetch counts for a given steamId and merge into the LATEST profile data
  const fetchAndApplyCounts = useCallback((steamId: string) => {
    classifiedIdRef.current = steamId;
    setCountsLoading(true);

    // All counts come directly from Steam's public endpoints - no API key,
    // no backend cache. Games count from the profile HTML page; inventory
    // + wishlist from their public pages; privacy probed per-section.
    Promise.all([
      fetchGamesCount(steamId),
      fetchInventoryCount(steamId),
      fetchWishlistCount(steamId),
      probeProfilePrivacy(steamId, profileRef.current.privacyState || 'public'),
    ])
      .then(([games, inventory, wishlist, privacy]) => {
        if (classifiedIdRef.current !== steamId) return; // stale
        setCountsLoading(false);
        const prev = profileRef.current;
        // Track per-fetch whether we had to fall back to a kept value -
        // if so, the boxes are showing stale data and we should tell the user.
        let anyStale = false;
        const stable = (next: number, current: string | undefined): string => {
          if (next > 0) return String(next);
          const currentNum = parseInt(current ?? '', 10);
          if (!Number.isNaN(currentNum) && currentNum > 0) {
            anyStale = true;
            return current!;
          }
          return '-';
        };
        setLinkedProfile({
          ...prev,
          gamesCount: stable(games, prev.gamesCount),
          inventoryCount: stable(inventory, prev.inventoryCount),
          wishlistCount: stable(wishlist, prev.wishlistCount),
          privacy,
        });
        setCountsStale(anyStale);
      })
      .catch(() => {
        if (classifiedIdRef.current === steamId) setCountsLoading(false);
      });
  }, [setLinkedProfile, profileRef]);

  const handleSelectProfile = useCallback((p: SteamProfileResult) => {
    const newProfile: ProfileData = {
      avatarUrl: p.avatarUrl,
      playerName: p.personaName,
      steamId: p.steamId,
      vanityUrl: p.vanityUrl,
      gamesCount: '-',
      inventoryCount: '-',
      wishlistCount: '-',
      walletBalance: '-',
      onlineState: p.onlineState,
      stateMessage: p.stateMessage,
      privacyState: p.privacyState,
      inGameBannerUrl: p.inGameBannerUrl,
      authMethod: p.authMethod,
      avatarFrameUrl: p.avatarFrameUrl,
    };
    animateProfileChange(() => {
      setLinkedProfile(newProfile);
    });
    // Immediately start fetching counts for the new profile
    fetchAndApplyCounts(p.steamId);
  }, [setLinkedProfile, animateProfileChange, fetchAndApplyCounts]);

  // Reset countsLoading to true synchronously whenever we get a new
  // steamId we haven't fetched for yet. Without this, a sign-out →
  // sign-in cycle (or a profile swap via search) would briefly show the
  // previous user's cached numbers between the steamId update and the
  // fetch effect firing below. useLayoutEffect runs before paint, so
  // the first render with the new steamId already has dots showing.
  useLayoutEffect(() => {
    if (linked && profile.steamId && profile.steamId !== classifiedIdRef.current) {
      setCountsLoading(true);
    }
  }, [linked, profile.steamId]);

  // On mount: fetch counts for a saved profile loaded from storage
  useEffect(() => {
    if (!linked || !profile.steamId || profile.steamId === classifiedIdRef.current) return;
    fetchAndApplyCounts(profile.steamId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, profile.steamId]);

  // DLC counts are no longer pre-fetched - the phone computes the diff
  // on demand when the user taps a specific game (via Steam's appdetails
  // endpoint, which returns the DLC list directly).

  // Refresh status every time the screen is focused.

  // Live status poll. Fires once on focus, then every 10s while focused;
  // stops on blur. Pulls online/offline/in-game state, avatar, persona name,
  // and current-game banner. Updates state silently (no opacity flash).
  useFocusEffect(
    useCallback(() => {
      // Only poll the user's OWN profile (Steam OAuth signed-in). When the
      // user is search-linked to someone else's profile, we don't refresh -
      // that's not their data and they probably don't want background polls.
      if (!linked || profileRef.current.authMethod !== 'steam') return;
      // Capture the steamId this poll session is bound to. If the user
      // signs out (or switches profiles) while a fetch is in flight, the
      // late response would otherwise re-introduce stale identity into
      // the default profile and flip `linked` back to true.
      const sessionSteamId = profileRef.current.steamId;
      let cancelled = false;
      const profileBase = () =>
        `https://steamcommunity.com/profiles/${profileRef.current.steamId}`;

      const refresh = async () => {
        try {
          // Fetch profile XML AND miniprofile JSON in parallel. The
          // miniprofile is the only place to get avatar_frame +
          // profile_background, so we hit it every poll to keep those
          // fields fresh (and back-fill them for sessions saved by
          // older code paths that didn't capture them).
          const sid = profileRef.current.steamId;
          // Use the file-scope steamId64ToAccountId (string arithmetic);
          // Number() would lose precision since steamID64 > 2^53.
          const accountId = steamId64ToAccountId(sid);

          const [xmlRes, miniRes] = await Promise.all([
            fetch(`${profileBase()}/?xml=1&_t=${Date.now()}`),
            accountId
              ? fetch(`https://steamcommunity.com/miniprofile/${accountId}/json?_t=${Date.now()}`)
              : Promise.resolve(null),
          ]);
          if (!xmlRes.ok) return;
          const xml = await xmlRes.text();
          const currentProfile = profileRef.current;
          const onlineState = extractXmlTag(xml, 'onlineState') || 'offline';
          const rawStateMsg = (extractXmlTag(xml, 'stateMessage') || 'Offline').replace(/<[^>]*>/g, ' ').replace(/]]>/g, '').replace(/<!\[CDATA\[/g, '').trim();
          const stateMessageRaw = extractXmlTag(xml, 'stateMessage') || '';
          const inGameName = onlineState === 'in-game'
            ? stateMessageRaw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').split('\n').pop()?.trim() || null
            : null;
          const stateMessage = onlineState === 'in-game' && inGameName
            ? `In-Game ${inGameName}`
            : rawStateMsg;
          const privacyState = extractXmlTag(xml, 'privacyState') || 'public';
          const avatarUrl = extractXmlTag(xml, 'avatarFull') || currentProfile.avatarUrl;
          const personaName = extractXmlTag(xml, 'steamID') || currentProfile.playerName;
          const inGameBannerUrl = onlineState === 'in-game' ? buildGameBannerUrl(xml, inGameName || '') : '';

          // Parse miniprofile if available - back-fill avatar_frame +
          // profile_background. Defaults to existing values on failure.
          let avatarFrameUrl = currentProfile.avatarFrameUrl ?? '';
          let profileBackgroundUrl = currentProfile.profileBackgroundUrl ?? '';
          let profileBackgroundVideoUrl = currentProfile.profileBackgroundVideoUrl ?? '';
          if (miniRes && miniRes.ok) {
            try {
              const mini: any = await miniRes.json();
              const af = mini?.avatar_frame;
              if (typeof af === 'string') avatarFrameUrl = af;
              else if (af && typeof af === 'object') {
                avatarFrameUrl = af.image_large || af.image_small || avatarFrameUrl;
              }
              const pb = mini?.profile_background;
              if (typeof pb === 'string') {
                profileBackgroundUrl = pb;
                profileBackgroundVideoUrl = '';
              } else if (pb && typeof pb === 'object') {
                profileBackgroundUrl = pb.image_large || pb.image_small || '';
                profileBackgroundVideoUrl = pb['video/mp4'] || pb['video/webm'] || '';
              } else {
                // No background equipped - clear any stale value.
                profileBackgroundUrl = '';
                profileBackgroundVideoUrl = '';
              }
            } catch {}
          }

          // Late-arrival guard: if the user signed out or switched
          // profiles while this fetch was in flight, drop the result so
          // we don't repopulate the cleared profile with stale data.
          if (cancelled || profileRef.current.steamId !== sessionSteamId || profileRef.current.authMethod !== 'steam') {
            return;
          }
          setLinkedProfile({
            ...profileRef.current,
            onlineState,
            stateMessage,
            privacyState,
            avatarUrl,
            playerName: personaName,
            inGameBannerUrl,
            avatarFrameUrl,
            profileBackgroundUrl,
            profileBackgroundVideoUrl,
          });
        } catch {}
      };

      // Immediate refresh on focus, then poll every 10 seconds.
      refresh();
      const interval = setInterval(refresh, 10_000);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linked])
  );

  // Slide up on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setSlideInDone(true));
  }, [translateY, bgOpacity]);

  const dismissing = useRef(false);
  const dismiss = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.goBack();
    });
  }, [navigation, translateY, bgOpacity]);

  // Dismiss the profile modal, then navigate into the library list with a
  // filter telling it which PICS slice to show (every app, just games, or
  // the wishlist). Non-library targets just dismiss.
  const dismissToLibrary = useCallback(
    (filter: 'all' | 'games' | 'wishlist' | null) => {
      if (dismissing.current) return;
      dismissing.current = true;
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigation.goBack();
        if (filter) {
          (navigation as any).navigate('Games', { filter });
        }
      });
    },
    [navigation, translateY, bgOpacity],
  );
  // Compatibility wrapper for legacy MyContentMenu / older call sites that
  // still pass a subTab string. Maps the old strings to the new filter set.
  const dismissToTab = useCallback(
    (subTab: string) => {
      if (subTab === 'library') return dismissToLibrary('all');
      if (subTab === 'wishlist') return dismissToLibrary('wishlist');
      return dismissToLibrary(null);
    },
    [dismissToLibrary],
  );

  // PanResponder on the swipe zone only (top header area)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
          bgOpacity.setValue(1 - Math.min(g.dy / (DISMISS_THRESHOLD * 2), 0.6));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > 0.4) {
          dismiss();
        } else {
          // Smooth snap back
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 80,
              friction: 10,
            }),
            Animated.timing(bgOpacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.outerContainer}>
      <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]} pointerEvents={slideInDone ? 'auto' : 'none'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />
      </Animated.View>
      <Animated.View
        style={[
          styles.container,
          { marginTop: insets.top + 87, transform: [{ translateY }] },
        ]}
      >
        {/* Swipe zone: captures drag gestures, sits above ScrollView */}
        <Animated.View style={[styles.headerZone, { opacity: contentOpacity }]}>
          <BlurredBackground
            avatarUrl={profile.avatarUrl}
            bannerUrl={profile.inGameBannerUrl || undefined}
            profileBgUrl={profile.profileBackgroundUrl || undefined}
            profileBgVideoUrl={profile.profileBackgroundVideoUrl || undefined}
          />
          <View
            {...panResponder.panHandlers}
          >
            <SwipeHint />
            <ProfileHeader profile={profile} linked={linked} />
          </View>
        </Animated.View>

        {linked && profile.authMethod !== 'steam' ? (
          <>
            {/* Fixed zone: Info Boxes + Search */}
            <Animated.View style={[styles.secondaryZone, { opacity: contentOpacity }]}>
              <InfoBoxes
                profile={profile}
                loading={countsLoading}
                gamesOnlyCount={gamesOnlyCount}
                picsScanning={picsScanning}
                onAppsPress={() => dismissToLibrary('all')}
                onGamesPress={() => dismissToLibrary('games')}
                onWishlistPress={() => dismissToLibrary('wishlist')}
              />
              <SteamProfileSearch
                locked={linked}
                lockedLabel={profile.vanityUrl || profile.steamId}
                onSelect={handleSelectProfile}
                onRemove={() => animateProfileChange(() => unlinkProfile())}
              />
            </Animated.View>

            {/* Scrollable content below - only shown when linked via search */}
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            >
              <View style={styles.sectionDivider} />
              <MyContentMenu
                onLibraryPress={() => dismissToTab('library')}
                onWishlistPress={() => dismissToTab('wishlist')}
                onItemsPress={() => dismissToTab('inventory')}
              />
              <AccountSettings onSignOut={() => setSignOutOpen('all')} />
            </ScrollView>
          </>
        ) : (
          // Anonymous OR signed-in via Steam OpenID: same auth-options layout.
          // Only difference is the Steam button shows the persona name when
          // already signed in (and tapping it signs out).
          <Animated.View style={[styles.secondaryZone, { flex: 1, opacity: contentOpacity }]}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            >
              {/* Games / Wishlist / Items count strip - shown above the
                  auth area when the user is signed in via Steam OpenID.
                  Numbers come from the user's *real* Steam profile via
                  fetchAndApplyCounts (XML + community endpoints). */}
              {profile.authMethod === 'steam' && (
                <InfoBoxes
                  profile={profile}
                  loading={countsLoading}
                  stale={countsStale}
                  gamesOnlyCount={gamesOnlyCount}
                  picsScanning={picsScanning}
                  onAppsPress={() => dismissToLibrary('all')}
                  onGamesPress={() => dismissToLibrary('games')}
                  onWishlistPress={() => dismissToLibrary('wishlist')}
                />
              )}
              <AuthOptions
                steamSignedInAs={
                  // Prefer the vanity URL ("phelps1") over the display name
                  // ("phelps") - the vanity is the unique handle Steam uses
                  // in profile URLs and is what users typically recognise as
                  // their "Steam ID name".
                  profile.authMethod === 'steam'
                    ? (profile.vanityUrl || profile.playerName || profile.steamId)
                    : null
                }
                googleSignedInAs={
                  profile.google
                    ? (profile.google.name || profile.google.email)
                    : null
                }
                onSteamPress={() => {
                  if (profile.authMethod === 'steam') {
                    setSignOutOpen('steam');
                  } else {
                    setSignInOpen('steam');
                  }
                }}
                onGooglePress={() => {
                  if (profile.google) {
                    setSignOutOpen('google');
                  } else {
                    setSignInOpen('google');
                  }
                }}
              />
              {/* Search bar + helper paragraph hide ONLY when Steam OAuth
                  is connected. Google-only or anonymous keeps them visible
                  (Google sign-in by itself doesn't give us a Steam profile,
                  so the user might still want to search/attach one). The
                  bottom divider stays always so the area visually closes. */}
              {profile.authMethod !== 'steam' && (
                <>
                  <SteamProfileSearch
                    locked={linked}
                    lockedLabel={profile.vanityUrl || profile.steamId}
                    onSelect={handleSelectProfile}
                    onRemove={() => animateProfileChange(() => unlinkProfile())}
                  />
                  <Text style={styles.searchHelperText}>
                    Use the app <Text style={styles.searchHelperBold}>without signing in</Text>. You'll have to add games to your lists manually, <Text style={styles.searchHelperBold}>private data won't show up</Text>, and some features won't be available. Good for using the app <Text style={styles.searchHelperBold}>without any accounts</Text>, <Text style={styles.searchHelperBold}>trying it out</Text>, and <Text style={styles.searchHelperBold}>browsing public profiles</Text>.
                  </Text>
                </>
              )}
              <View style={styles.searchHelperDivider} />
            </ScrollView>
          </Animated.View>
        )}
      </Animated.View>
      {/* Sign-out confirm. Mounted at screen root so the modal backdrop
          covers everything, including the swipe-down area. */}
      <ConfirmDialog
        visible={signOutOpen !== null}
        variant={signOutOpen === 'google' ? 'google' : 'steam'}
        title={
          signOutOpen === 'steam' ? 'Sign out of Steam?'
          : signOutOpen === 'google' ? 'Sign out of Google?'
          : 'Sign out?'
        }
        body={(() => {
          const isGoogleVar = signOutOpen === 'google';
          const baseStyle = [dialogStyles.body, isGoogleVar && dialogStyles.bodyLight];
          if (signOutOpen === 'steam') {
            const id = profile.vanityUrl || profile.playerName;
            return id ? (
              <Text style={baseStyle}>
                You're signed in as <Text style={dialogStyles.bodyBold}>{id}</Text>. You can sign back in any time.
              </Text>
            ) : 'You can sign back in any time.';
          }
          if (signOutOpen === 'google') {
            return profile.google?.email ? (
              <Text style={baseStyle}>
                Signed in as <Text style={dialogStyles.bodyBold}>{profile.google.email}</Text>. You can sign back in any time.
              </Text>
            ) : 'You can sign back in any time.';
          }
          return 'You can sign back in any time.';
        })()}
        confirmLabel="Sign out"
        onCancel={() => setSignOutOpen(null)}
        onConfirm={() => {
          const which = signOutOpen;
          setSignOutOpen(null);
          if (which === 'steam') {
            // SteamAuth.signOut fires the async cleanup (cookie-jar logout,
            // scheduler reset, @steam/* storage wipe). It calls
            // unlinkProfile internally too, but the call below from
            // animateProfileChange is the one the LayoutAnimation actually
            // captures - unlinkProfile is idempotent so the duplicate is
            // harmless.
            void runSteamSignOut();
            animateProfileChange(() => unlinkProfile());
          } else if (which === 'google') {
            animateProfileChange(() => unlinkGoogle());
          } else {
            // 'all' - clear everything (Steam goes through SteamAuth.signOut
            // so the cookie jar + scheduler are also reset; Google is
            // independent and just gets a local unlink).
            void runSteamSignOut();
            animateProfileChange(() => {
              unlinkProfile();
              unlinkGoogle();
            });
          }
        }}
      />

      {/* Sign-IN confirmation dialog - same styled popup, but with a feature
          bullet list as the body and "Continue" as the action. Tapping
          Continue dismisses the dialog and triggers the actual OAuth flow. */}
      <ConfirmDialog
        visible={signInOpen !== null}
        variant={signInOpen === 'google' ? 'google' : 'steam'}
        title={signInOpen === 'google' ? 'Sign in with Google' : 'Sign in with Steam'}
        body={(() => {
          const items =
            signInOpen === 'google'
              ? [
                  'Pick up where you left off on any phone you sign into',
                  'Cloud backup of your filters and price alerts',
                  'Personalised notifications, only on the games you care about',
                  'One tap account recovery',
                  'Theme and currency settings follow you everywhere',
                ]
              : [
                  'Your full library imports automatically, ready to filter and sort',
                  'Wishlist deal alerts the moment prices drop',
                  'Inventory and live market value at a glance',
                  'Achievement progress and rare drop notifications',
                  'See which friends are online and what they are playing',
                ];
          const isGoogle = signInOpen === 'google';
          const provider = isGoogle ? 'Google' : 'Steam';
          return (
            <View>
              <Text style={[dialogStyles.body, isGoogle && dialogStyles.bodyLight, { marginTop: 0 }]}>
                You're about to sign in with <Text style={dialogStyles.bodyBold}>{provider}</Text>. Here's everything that becomes available to you on this app:
              </Text>
              <View style={{ marginTop: 12 }}>
                {items.map((item) => (
                  <View key={item} style={dialogStyles.bulletRow}>
                    <Text style={[dialogStyles.bulletDot, isGoogle && dialogStyles.bulletDotLight]}>•</Text>
                    <Text style={[dialogStyles.bulletText, isGoogle && dialogStyles.bodyLight]}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}
        confirmLabel="Continue"
        onCancel={() => setSignInOpen(null)}
        onConfirm={() => {
          const which = signInOpen;
          setSignInOpen(null);
          if (which === 'steam') runSteamSignIn();
          else if (which === 'google') runGoogleSignIn();
        }}
      />

      {/* Error popup (single-button, same Steam/Google styling). Used for
          sign-in failures, mis-configurations, network errors, etc. */}
      <ConfirmDialog
        visible={errorOpen !== null}
        variant={errorOpen?.provider === 'google' ? 'google' : 'steam'}
        title="Something went wrong"
        body={(() => {
          if (!errorOpen) return undefined;
          const isGoogleVar = errorOpen.provider === 'google';
          const baseStyle = [dialogStyles.body, isGoogleVar && dialogStyles.bodyLight];
          const providerName = isGoogleVar ? 'Google' : 'Steam';
          if (errorOpen.reason === 'not_configured') {
            return (
              <Text style={baseStyle}>
                {providerName} sign in is not configured yet on this build. Try again later.
              </Text>
            );
          }
          return (
            <Text style={baseStyle}>
              We couldn't finish signing you in with <Text style={dialogStyles.bodyBold}>{providerName}</Text>. Please try again.
              {'\n\n'}
              <Text style={dialogStyles.bodyBold}>Reason:</Text> {errorOpen.reason}
            </Text>
          );
        })()}
        confirmLabel="OK"
        cancelLabel={null}
        onCancel={() => setErrorOpen(null)}
        onConfirm={() => setErrorOpen(null)}
      />
    </View>
  );
};

export default ProfileScreen;

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },

  // ── Header zone with blurred bg (swipe zone) ──
  headerZone: {
    position: 'relative',
    overflow: 'hidden',
  },
  blurredBgContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  swipeHint: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 0,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center', // vertically center the (name + status + tags) column with the avatar
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 6,
  },
  avatarStack: {
    width: 90,
    height: 90,
    position: 'relative',
    // Frame extends ~12% past the avatar on each side; without
    // overflow:visible, Android clips the frame off.
    overflow: 'visible',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 0,
    backgroundColor: '#1F2127',
  },
  avatarFrame: {
    // Steam frames are sized so the avatar sits in the centre with ~12% of
    // the frame width as overhang on each side. We scale to 124% of the
    // avatar and offset by -12% to keep it centred.
    position: 'absolute',
    width: '124%',
    height: '124%',
    top: '-12%',
    left: '-12%',
  },
  nameContainer: {
    marginLeft: 16,
    flex: 1,
  },
  playerName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 24,
    color: colors.text.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    flexShrink: 1,
  },
  privacyTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 3,
    columnGap: 3,
    marginTop: 5,
  },
  privacyTag: {
    // Flat solid-bg, zero border radius, snug padding
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  privacyTagText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 8.5,
    letterSpacing: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20, // matches the page's horizontal padding (same width as the buttons)
  },
  modalCard: {
    backgroundColor: '#1F2127', // Steam mobile primary panel
    borderColor: '#30333A',     // Steam divider
    borderWidth: 1,
    padding: 18,
    width: '100%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#c6d4df',
    letterSpacing: 1.0,
    flex: 1,
  },
  modalCloseX: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBodyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#c6d4df',
    lineHeight: 18,
  },
  // ── Auth options (anonymous mode) ──
  authOptionsWrapper: {
    paddingHorizontal: 20,
    // No vertical padding here - the secondaryZone above and the gap between
    // buttons should be the *only* sources of vertical spacing, so the
    // distance from the area above to the Steam button matches the distance
    // between the two buttons exactly.
  },
  // Steam button - multi-layer composition: gradient base + watermark glyph +
  // animated shimmer + foreground content. Slightly taller than the Google
  // button so the watermark has breathing room.
  steamButtonOuter: {
    height: 56,
    overflow: 'hidden',
    backgroundColor: '#0B1929', // darkest gradient stop, fallback before LinearGradient paints
    position: 'relative',
  },
  steamButtonWatermark: {
    position: 'absolute',
    right: -10,
    top: -18,
    opacity: 0.95,
  },
  // Per-button shimmer band. Each button has overflow:hidden so the band
  // is clipped at the button's edges only - never bleeds onto the page.
  // Top/bottom bleed slightly outside (-30) so the rotated band stretches
  // edge-to-edge of the button visually.
  buttonShimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 50,
  },
  steamButtonForeground: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  authButtonSteamText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // Google button - same multi-layer treatment as Steam button.
  // White base + faded multi-color G watermark + animated shimmer (in Google
  // blue) + 1px Google-blue inner border. Text in Google's spec color #3C4043.
  googleButtonOuter: {
    height: 56,
    overflow: 'hidden',
    backgroundColor: '#F4F6FA', // very subtle off-white so the white shimmer is visible
    position: 'relative',
  },
  googleButtonWatermark: {
    position: 'absolute',
    right: -10,
    top: -18,
  },
  authButtonGoogleText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#3C4043', // Google's official text color for sign-in buttons
    letterSpacing: 0.25,
  },
  authHelperText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#8f98a0',
    marginTop: 12, // consistent with whySafeRow.marginTop and the 12px rhythm
    lineHeight: 16,
  },
  authHelperBold: {
    fontFamily: 'Inter_700Bold',
    color: '#c6d4df', // brighter than the surrounding muted grey so the bolds clearly pop
  },
  whySafeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12, // consistent with the rest of the vertical rhythm
  },
  whySafeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#66c0f4', // Steam's signature link blue - universally recognised as a tappable link
    letterSpacing: 0.2,
    // Match the (i) icon's 16px height so alignItems:'center' centres them
    // identically - without this the text's natural line box (~13px) is
    // shorter than the icon and sits ~1.5px above true centre.
    lineHeight: 16,
  },
  infoIconCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: '#66c0f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconLetter: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#66c0f4',
    lineHeight: 12,
  },
  searchHelperBold: {
    fontFamily: 'Inter_700Bold',
    color: '#c6d4df',
  },
  searchHelperDivider: {
    height: 1,
    backgroundColor: '#30333A', // same Steam divider color as the OR rule
    marginTop: 12,
    marginHorizontal: 20, // match the buttons + helper alignment
  },
  searchHelperText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#8f98a0',
    marginTop: 4,
    lineHeight: 16,
    paddingHorizontal: 20, // match the buttons' horizontal alignment exactly
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12, // matches the 12px rhythm between the two auth buttons
    marginBottom: 8,
    gap: 12,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#30333A',
  },
  orDividerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#8f98a0',
    letterSpacing: 1.5,
  },
  marqueeContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  marqueeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#a4d007',
  },
  steamId: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#8B929A',
    marginTop: 2,
  },

  // ── Secondary zone ──
  secondaryZone: {
    backgroundColor: colors.background.secondary,
    paddingTop: 12,    // matched to paddingBottom so search bar is vertically centered
    paddingBottom: 12, // (especially when anonymous, where it's the only child here)
  },

  // Info Boxes
  infoBoxRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    // No paddingTop - secondaryZone.paddingTop (12) already provides the
    // gap above. Adding our own would double it and push the boxes down
    // further than the gap below the row, leaving an asymmetric layout.
    paddingTop: 0,
    paddingBottom: 12,
  },
  infoBox: {
    flex: 1,
    // Match the Steam/Google auth button height (56) so the three count
    // boxes and the two auth buttons share the same vertical rhythm.
    height: 56,
    backgroundColor: colors.background.primary,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBoxValueRow: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBoxNumber: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoBoxSubtle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#8B929A',
  },
  infoBoxLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#8B929A',
    textAlign: 'center',
    // Small explicit gap between the number and the label so the two
    // baselines don't crash into each other on Android.
    marginTop: 2,
    lineHeight: 18,
  },
  staleHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#F0B43E', // muted amber for "warning, not error"
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    lineHeight: 14,
  },

  // Steam Profile Search
  searchWrapper: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  searchBlueBox: {
    backgroundColor: '#1A9FFF',
    borderRadius: 4,
    padding: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    height: 42,
  },
  searchInputContainerFocused: {
    borderColor: 'rgba(255,255,255,0.4)',
  },
  searchIcon: {
    paddingLeft: 12,
    paddingRight: 4,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#fff',
    paddingVertical: 0,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 4,
    marginTop: 8,
    padding: 10,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  resultInfo: {
    marginLeft: 10,
    flexShrink: 1,
  },
  resultName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#fff',
  },
  resultSteamId: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  noResult: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingVertical: 10,
  },
  lockedBlueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A9FFF',
    borderRadius: 4,
    height: 48,
    paddingHorizontal: 12,
  },
  lockedLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#fff',
  },
  lockedEditBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 6,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  removeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#dc3545',
  },

  // Section divider
  sectionDivider: {
    height: 1,
    backgroundColor: DIVIDER_STANDARD,
  },

  // ── My Content ──
  myContentContainer: {
    backgroundColor: colors.background.primary,
  },
  sectionLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#8B929A',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 2,
  },
  listItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  listItemText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 20,
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER_STANDARD,
  },

  // ── Account Settings ──
  accountContainer: {
    backgroundColor: colors.background.secondary,
    marginTop: 16,
  },
  secondaryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 12,
  },
  secondaryItemTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#BFC3CB',
  },
  secondaryItemDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#8B929A',
    marginTop: 2,
  },
  accountDivider: {
    height: 1,
    backgroundColor: DIVIDER_STANDARD,
    marginLeft: 20,
  },
  logoutText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#dc3545',
  },
});
