/**
 * GamesScreen - PICS dump list with filters.
 *
 * Routed with one of three filters:
 *   • 'all'      → every owned app id (raw rgOwnedApps - games, DLC, tools, …)
 *   • 'games'    → owned app ids whose PICS `common.type === 'game'`
 *   • 'wishlist' → every wishlist app id
 *
 * For each visible app id we hit the PICS HTTP gateway and dump the raw
 * JSON in a card. Fetches are triggered on visibility so scrolling past
 * the visible window doesn't open hundreds of sockets - only what's on
 * screen (plus a small lookahead) gets fetched.
 *
 * Wishlist + games filters can have small or partial lists at first. They
 * grow as `profile.wishlistAppids` is refreshed by SteamSyncContext, and
 * (for the games filter) as the background usePicsTypes scan classifies
 * more app ids.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors } from '../theme';
import { useProfile } from '../context/ProfileContext';
import { usePicsTypes } from '../hooks/usePicsTypes';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Filter = 'all' | 'games' | 'wishlist';

const PICS_URL = (appid: number) => `https://api.steamcmd.net/v1/info/${appid}`;
const FETCH_TIMEOUT_MS = 12_000;

type AppState =
  | { kind: 'pending' }
  | { kind: 'ok'; data: any }
  | { kind: 'error'; reason: string };

async function fetchPics(appid: number): Promise<AppState> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(PICS_URL(appid), { signal: ac.signal });
    if (!r.ok) return { kind: 'error', reason: `http_${r.status}` };
    const json = await r.json();
    const appData = json?.data?.[String(appid)];
    if (!appData) return { kind: 'error', reason: 'no data in response' };
    return { kind: 'ok', data: appData };
  } catch (e: any) {
    return { kind: 'error', reason: e?.message || String(e) };
  } finally {
    clearTimeout(t);
  }
}

const FILTER_TITLES: Record<Filter, string> = {
  all: 'Library - all apps',
  games: 'Library - games only',
  wishlist: 'Wishlist',
};

const PicsCard: React.FC<{ appid: number; state: AppState }> = ({ appid, state }) => {
  const body =
    state.kind === 'pending' ? (
      <View style={styles.pendingRow}>
        <ActivityIndicator color={colors.text.primary} />
        <Text style={styles.pendingText}>fetching PICS…</Text>
      </View>
    ) : state.kind === 'error' ? (
      <Text style={styles.errorText}>error: {state.reason}</Text>
    ) : (
      <Text style={styles.json} selectable>
        {JSON.stringify(state.data, null, 2)}
      </Text>
    );

  return (
    <View style={styles.card}>
      <Text style={styles.appId}>appid {appid}</Text>
      {body}
    </View>
  );
};

const GamesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Games'>>();
  const filter: Filter = (route.params?.filter as Filter) ?? 'all';
  const { profile } = useProfile();

  // Owned ids drive every filter except 'wishlist'. Run usePicsTypes on the
  // owned list so the 'games' filter has classification data available
  // (cache from the Profile screen's earlier pass will already have most
  // entries). Empty list for 'wishlist' to skip the work.
  const ownedAppids = useMemo(
    () => profile.ownedAppids ?? [],
    [profile.ownedAppids],
  );
  const picsTypes = usePicsTypes(filter === 'games' ? ownedAppids : []);

  const visibleAppids = useMemo<number[]>(() => {
    if (filter === 'wishlist') {
      return [...(profile.wishlistAppids ?? [])].sort((a, b) => a - b);
    }
    if (filter === 'games') {
      const out: number[] = [];
      for (const a of ownedAppids) {
        if (picsTypes.types[a] === 'game') out.push(a);
      }
      return out.sort((a, b) => a - b);
    }
    return [...ownedAppids].sort((a, b) => a - b);
  }, [filter, ownedAppids, profile.wishlistAppids, picsTypes.types]);

  const [results, setResults] = useState<Record<number, AppState>>({});
  const inFlight = useRef<Set<number>>(new Set());

  /** Kick off PICS fetches for a batch of app ids. Idempotent - already
   *  fetched or in-flight ids are skipped. */
  const ensureFetched = useCallback((appids: number[]) => {
    const todo: number[] = [];
    for (const a of appids) {
      if (inFlight.current.has(a)) continue;
      if (results[a]) continue;
      inFlight.current.add(a);
      todo.push(a);
    }
    if (todo.length === 0) return;
    (async () => {
      // Small concurrency limit so we don't open dozens of sockets if the
      // user fling-scrolls across the list.
      const CONCURRENCY = 4;
      for (let i = 0; i < todo.length; i += CONCURRENCY) {
        const chunk = todo.slice(i, i + CONCURRENCY);
        const states = await Promise.all(chunk.map(fetchPics));
        setResults((prev) => {
          const next = { ...prev };
          for (let j = 0; j < chunk.length; j++) next[chunk[j]] = states[j];
          return next;
        });
      }
    })();
  }, [results]);

  // Pre-fetch the first viewport so the first scroll isn't all spinners.
  useEffect(() => {
    if (visibleAppids.length === 0) return;
    ensureFetched(visibleAppids.slice(0, 6));
  }, [visibleAppids, ensureFetched]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: number }> }) => {
      const appids = viewableItems.map((v) => v.item).filter((a): a is number => typeof a === 'number');
      if (appids.length > 0) ensureFetched(appids);
    },
  );
  // Keep the ref's closure fresh - onViewableItemsChanged can't be swapped
  // out after first render without a ref hack.
  useEffect(() => {
    onViewableItemsChanged.current = ({ viewableItems }) => {
      const appids = viewableItems.map((v: any) => v.item).filter((a: any) => typeof a === 'number');
      if (appids.length > 0) ensureFetched(appids);
    };
  }, [ensureFetched]);

  const renderItem = useCallback(
    ({ item }: { item: number }) => (
      <PicsCard appid={item} state={results[item] ?? { kind: 'pending' }} />
    ),
    [results],
  );

  const keyExtractor = useCallback((item: number) => String(item), []);

  // Crossfade in.
  const contentOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contentOpacity]);

  let subtitle: string;
  if (visibleAppids.length === 0) {
    if (filter === 'games' && !picsTypes.ready && picsTypes.total > 0) {
      subtitle = `classifying apps - ${picsTypes.processed} / ${picsTypes.total}`;
    } else if (filter === 'wishlist') {
      subtitle = 'wishlist is empty or not yet synced';
    } else {
      subtitle = 'no app ids cached - sign in via Steam first';
    }
  } else {
    subtitle = `${visibleAppids.length} app ${visibleAppids.length === 1 ? 'id' : 'ids'}`;
    if (filter === 'games' && !picsTypes.ready && picsTypes.total > 0) {
      subtitle += ` (still classifying ${picsTypes.total - picsTypes.processed})`;
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backButton}>‹  Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{FILTER_TITLES[filter]}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
        <FlatList
          data={visibleAppids}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 12,
          }}
          initialNumToRender={6}
          windowSize={5}
          maxToRenderPerBatch={6}
          removeClippedSubviews
          onViewableItemsChanged={(info) => onViewableItemsChanged.current?.(info)}
          viewabilityConfig={{ itemVisiblePercentThreshold: 1 }}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#30333A',
  },
  backButton: {
    color: colors.accent.primary,
    fontSize: 16,
    paddingVertical: 4,
  },
  title: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 6,
  },
  subtitle: {
    color: '#9aa1ab',
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface.default,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  appId: {
    color: '#9aa1ab',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingText: {
    color: '#9aa1ab',
    fontSize: 13,
  },
  errorText: {
    color: '#e57373',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  json: {
    color: colors.text.primary,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});

export default GamesScreen;
