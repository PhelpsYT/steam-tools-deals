import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Linking,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme';
import { LoadingLine } from '../components';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ──────────────────────────────────────────────────────────────────

interface GameData {
  appid: number;
  name: string;
  type: string;
  short_description: string;
  header_image: string;
  developers: string[];
  publishers: string[];
  genres: string[];
  categories: string[];
  release_date: string;
  metacritic_score: number | null;
  is_free: boolean;
  price_currency: string;
  price_initial: number;
  price_final: number;
  price_discount_pct: number;
  review_score_desc: string;
  total_positive: number;
  total_negative: number;
  total_reviews: number;
  current_players: number;
  achievement_count: number;
  platforms_windows: boolean;
  platforms_mac: boolean;
  platforms_linux: boolean;
  deck_compatibility: string;
  is_discontinued: boolean;
  is_coming_soon: boolean;
  all_time_low_price: number | null;
  all_time_low_date: string | null;
  all_time_low_currency: string | null;
  website: string | null;
}

interface PriceHistoryEntry {
  cc: string;
  currency: string;
  price_initial: number;
  price_final: number;
  discount_pct: number;
  detected_at: string;
}

interface PackageData {
  package_id: number;
  name: string;
  apps: number[];
  price_currency: string;
  price_final: number;
  discount_pct: number;
  is_free: boolean;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

const IconBack: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = colors.text.primary,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill={color} />
  </Svg>
);

const IconStore: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = colors.text.primary,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M18.36 9l.6 3H5.04l.6-3h12.72M20 4H4v2h16V4zm0 3H4l-1 5v2h1v6h10v-6h4v6h2v-6h1v-2l-1-5zM6 18v-4h6v4H6z" />
  </Svg>
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number | null, currency?: string): string {
  if (!cents || cents <= 0) return 'Free';
  const val = (cents / 100).toFixed(2);
  if (currency === 'EUR') return `€${val}`;
  if (currency === 'GBP') return `£${val}`;
  if (currency === 'BRL') return `R$${val}`;
  return `$${val}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getReviewColor(desc: string | null): string {
  if (!desc) return colors.text.secondary;
  const d = desc.toLowerCase();
  if (d.includes('overwhelmingly positive')) return '#66C0F4';
  if (d.includes('very positive')) return '#66C0F4';
  if (d.includes('positive')) return '#66C0F4';
  if (d.includes('mixed')) return '#B9A074';
  if (d.includes('negative')) return colors.accent.error;
  return colors.text.secondary;
}

function getDeckLabel(deck: string | null): { label: string; color: string } {
  switch (deck) {
    case 'verified': return { label: 'Verified', color: '#59BF40' };
    case 'playable': return { label: 'Playable', color: '#FFC82C' };
    case 'unsupported': return { label: 'Unsupported', color: colors.accent.error };
    default: return { label: 'Unknown', color: colors.text.secondary };
  }
}

const CC_NAMES: Record<string, string> = {
  us: '🇺🇸 US', gb: '🇬🇧 UK', fr: '🇫🇷 EU', br: '🇧🇷 BR', au: '🇦🇺 AU',
  jp: '🇯🇵 JP', ru: '🇷🇺 RU', kr: '🇰🇷 KR', tr: '🇹🇷 TR', sg: '🇸🇬 SG',
  in: '🇮🇳 IN', ar: '🇦🇷 AR',
};

// ─── Section Component ─────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

// ─── Price History Mini Chart ───────────────────────────────────────────────

const PriceChart: React.FC<{ history: PriceHistoryEntry[] }> = ({ history }) => {
  if (history.length === 0) return <Text style={styles.dimText}>No price history yet</Text>;

  // Get US prices only, sorted by date
  const usHistory = history
    .filter(h => h.cc === 'us')
    .sort((a, b) => new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime());

  if (usHistory.length === 0) return <Text style={styles.dimText}>No US price data</Text>;

  const prices = usHistory.map(h => h.price_final);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const range = maxPrice - minPrice || 1;
  const chartW = SCREEN_WIDTH - 64;
  const chartH = 60;

  return (
    <View>
      <Svg width={chartW} height={chartH}>
        {/* Background */}
        <Rect x={0} y={0} width={chartW} height={chartH} rx={4} fill={colors.background.secondary} />
        {/* Price line */}
        {usHistory.length > 1 && (
          <Path
            d={usHistory.map((h, i) => {
              const x = (i / (usHistory.length - 1)) * (chartW - 8) + 4;
              const y = chartH - 6 - ((h.price_final - minPrice) / range) * (chartH - 12);
              return `${i === 0 ? 'M' : 'L'}${x},${y}`;
            }).join(' ')}
            stroke={colors.accent.primary}
            strokeWidth={2}
            fill="none"
          />
        )}
      </Svg>
      <View style={styles.chartLabels}>
        <Text style={styles.chartLabel}>{formatDate(usHistory[0]?.detected_at)}</Text>
        <Text style={styles.chartLabel}>{formatDate(usHistory[usHistory.length - 1]?.detected_at)}</Text>
      </View>
      <View style={styles.chartPriceLabels}>
        <Text style={[styles.chartLabel, { color: colors.accent.success }]}>Low: {formatPrice(minPrice)}</Text>
        <Text style={styles.chartLabel}>High: {formatPrice(maxPrice)}</Text>
      </View>
    </View>
  );
};

// ─── Main Screen ────────────────────────────────────────────────────────────

const GameDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { appid, gameName } = route.params;

  const [game, setGame] = useState<GameData | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [regionalPrices, setRegionalPrices] = useState<any[]>([]);
  const [allTimeLow, setAllTimeLow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Steam's public appdetails endpoint returns the game's metadata,
      // DLC list, current price, and screenshots in one call. No API key
      // needed; React Native fetch isn't subject to CORS so this works
      // straight from the device.
      const res = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=english`,
      );
      const json: any = await res.json();
      const entry = json && json[String(appid)];
      if (!entry || !entry.success || !entry.data) {
        setError('Game not found on Steam');
        setLoading(false);
        return;
      }
      const d = entry.data;
      setGame({
        appid: Number(appid),
        name: d.name || '',
        header_image: d.header_image || '',
        type: d.type || '',
        short_description: d.short_description || '',
        is_free: !!d.is_free,
        release_date: d.release_date?.date || '',
        developers: d.developers || [],
        publishers: d.publishers || [],
        genres: (d.genres || []).map((g: any) => g.description),
        categories: (d.categories || []).map((c: any) => c.description),
        screenshots: (d.screenshots || []).map((s: any) => s.path_full),
        dlc: d.dlc || [],
        price_overview: d.price_overview || null,
      } as any);
      setPriceHistory([]);
      setAllTimeLow(null);
      setPackages([]);
      setRegionalPrices([]);

      setLoading(false);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } catch (err: any) {
      setError(err?.message || 'Failed to load game data');
      setLoading(false);
    }
  }, [appid, fadeAnim]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openStorePage = () => {
    Linking.openURL(`https://store.steampowered.com/app/${appid}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <IconBack />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{gameName || 'Game Details'}</Text>
        </View>
        <View style={styles.headerDivider} />
        <LoadingLine visible={true} />
        <View style={styles.centerContainer} />
      </View>
    );
  }

  if (error || !game) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <IconBack />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{gameName || 'Game Details'}</Text>
        </View>
        <View style={styles.headerDivider} />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error || 'Game not found'}</Text>
          <TouchableOpacity onPress={fetchData} style={styles.retryButton} activeOpacity={0.7}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const reviewPct = game.total_reviews > 0
    ? Math.round((game.total_positive / game.total_reviews) * 100)
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <IconBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{game.name}</Text>
        <TouchableOpacity onPress={openStorePage} style={styles.storeButton} activeOpacity={0.7}>
          <IconStore />
        </TouchableOpacity>
      </View>
      <View style={styles.headerDivider} />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Image */}
          {game.header_image && (
            <Image
              source={{ uri: game.header_image }}
              style={styles.heroImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          )}

          {/* Status Badges */}
          <View style={styles.badgeRow}>
            {game.type && (
              <View style={[styles.badge, { backgroundColor: colors.accent.primary + '30' }]}>
                <Text style={[styles.badgeText, { color: colors.accent.primary }]}>
                  {game.type.toUpperCase()}
                </Text>
              </View>
            )}
            {game.is_discontinued && (
              <View style={[styles.badge, { backgroundColor: colors.accent.error + '30' }]}>
                <Text style={[styles.badgeText, { color: colors.accent.error }]}>DISCONTINUED</Text>
              </View>
            )}
            {game.is_coming_soon && (
              <View style={[styles.badge, { backgroundColor: colors.accent.warning + '30' }]}>
                <Text style={[styles.badgeText, { color: colors.accent.warning }]}>COMING SOON</Text>
              </View>
            )}
            {game.deck_compatibility && game.deck_compatibility !== 'unknown' && (
              <View style={[styles.badge, { backgroundColor: getDeckLabel(game.deck_compatibility).color + '30' }]}>
                <Text style={[styles.badgeText, { color: getDeckLabel(game.deck_compatibility).color }]}>
                  DECK {getDeckLabel(game.deck_compatibility).label.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Price Section */}
          <Section title="Price">
            <View style={styles.priceRow}>
              {game.is_free ? (
                <Text style={styles.priceMain}>Free to Play</Text>
              ) : game.price_final ? (
                <View style={styles.priceGroup}>
                  {game.price_discount_pct > 0 && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>-{game.price_discount_pct}%</Text>
                    </View>
                  )}
                  {game.price_discount_pct > 0 && game.price_initial && (
                    <Text style={styles.priceOriginal}>
                      {formatPrice(game.price_initial, game.price_currency)}
                    </Text>
                  )}
                  <Text style={styles.priceMain}>
                    {formatPrice(game.price_final, game.price_currency)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.dimText}>No price data</Text>
              )}
            </View>
            {/* All-Time Low */}
            {allTimeLow?.price && (
              <View style={styles.allTimeLow}>
                <Text style={styles.allTimeLowLabel}>All-Time Low:</Text>
                <Text style={styles.allTimeLowPrice}>
                  {formatPrice(allTimeLow.price, allTimeLow.currency)}
                </Text>
                {allTimeLow.date && (
                  <Text style={styles.allTimeLowDate}>({formatDate(allTimeLow.date)})</Text>
                )}
              </View>
            )}
          </Section>

          {/* Price History Chart */}
          {priceHistory.length > 0 && (
            <Section title="Price History">
              <PriceChart history={priceHistory} />
            </Section>
          )}

          {/* Regional Prices */}
          {regionalPrices.length > 0 && (
            <Section title="Regional Prices">
              <View style={styles.regionGrid}>
                {regionalPrices.map((rp: any) => (
                  <View key={rp.cc} style={styles.regionItem}>
                    <Text style={styles.regionName}>{CC_NAMES[rp.cc] || rp.cc.toUpperCase()}</Text>
                    <Text style={styles.regionPrice}>
                      {rp.is_free ? 'Free' : formatPrice(rp.price_final, rp.currency)}
                    </Text>
                    {rp.discount_pct > 0 && (
                      <Text style={styles.regionDiscount}>-{rp.discount_pct}%</Text>
                    )}
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Packages / Bundles */}
          {packages.length > 0 && (
            <Section title="Packages & Bundles">
              {packages.map((pkg) => (
                <View key={pkg.package_id} style={styles.packageRow}>
                  <View style={styles.packageInfo}>
                    <Text style={styles.packageName} numberOfLines={2}>{pkg.name}</Text>
                    <Text style={styles.packageApps}>
                      {pkg.apps.length} app{pkg.apps.length !== 1 ? 's' : ''} included
                    </Text>
                  </View>
                  <View style={styles.packagePriceCol}>
                    {pkg.is_free ? (
                      <Text style={styles.packageFree}>Free</Text>
                    ) : (
                      <Text style={styles.packagePrice}>
                        {formatPrice(pkg.price_final, pkg.price_currency)}
                      </Text>
                    )}
                    {pkg.discount_pct > 0 && (
                      <Text style={styles.packageDiscount}>-{pkg.discount_pct}%</Text>
                    )}
                  </View>
                </View>
              ))}
            </Section>
          )}

          {/* Game Info */}
          <Section title="Details">
            <View style={styles.infoGrid}>
              {game.developers?.length > 0 && (
                <InfoRow label="Developer" value={game.developers.join(', ')} />
              )}
              {game.publishers?.length > 0 && (
                <InfoRow label="Publisher" value={game.publishers.join(', ')} />
              )}
              {game.release_date && (
                <InfoRow label="Release Date" value={game.release_date} />
              )}
              {game.genres?.length > 0 && (
                <InfoRow label="Genres" value={game.genres.join(', ')} />
              )}
              {game.categories?.length > 0 && (
                <InfoRow label="Features" value={game.categories.join(', ')} />
              )}
              <InfoRow
                label="Platforms"
                value={[
                  game.platforms_windows && 'Windows',
                  game.platforms_mac && 'Mac',
                  game.platforms_linux && 'Linux',
                ].filter(Boolean).join(', ') || '-'}
              />
              {game.achievement_count > 0 && (
                <InfoRow label="Achievements" value={String(game.achievement_count)} />
              )}
              {game.current_players !== null && game.current_players >= 0 && (
                <InfoRow label="Current Players" value={game.current_players.toLocaleString()} />
              )}
            </View>
          </Section>

          {/* Reviews */}
          {game.total_reviews > 0 && (
            <Section title="Reviews">
              <View style={styles.reviewRow}>
                <Text style={[styles.reviewScore, { color: getReviewColor(game.review_score_desc) }]}>
                  {game.review_score_desc || 'No Rating'}
                </Text>
                <Text style={styles.reviewPct}>
                  {reviewPct !== null ? `${reviewPct}% positive` : ''}
                </Text>
              </View>
              <Text style={styles.reviewCount}>
                {game.total_positive?.toLocaleString()} positive / {game.total_negative?.toLocaleString()} negative ({game.total_reviews?.toLocaleString()} total)
              </Text>
            </Section>
          )}

          {/* Metacritic */}
          {game.metacritic_score && (
            <Section title="Metacritic">
              <View style={styles.metacriticRow}>
                <View style={[styles.metacriticBadge, {
                  backgroundColor: game.metacritic_score >= 75 ? '#6c3' : game.metacritic_score >= 50 ? '#fc3' : '#f00',
                }]}>
                  <Text style={styles.metacriticScore}>{game.metacritic_score}</Text>
                </View>
              </View>
            </Section>
          )}

          {/* Description */}
          {game.short_description && (
            <Section title="About">
              <Text style={styles.description}>{game.short_description}</Text>
            </Section>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

// ─── Info Row Component ─────────────────────────────────────────────────────

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

export default GameDetailScreen;

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.background.secondary,
  },
  backButton: { padding: 4, marginRight: 12 },
  headerTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    color: colors.text.primary,
    flex: 1,
  },
  storeButton: { padding: 8 },
  headerDivider: { height: 1, backgroundColor: colors.border.separator },

  // Center states
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  loadingText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text.secondary, marginTop: 12 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.accent.error, textAlign: 'center', marginBottom: 16 },
  retryButton: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.accent.primary, borderRadius: 4 },
  retryText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#fff' },

  // Hero
  heroImage: { width: '100%', height: 180, backgroundColor: colors.background.secondary },

  // Badges
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 12, gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontFamily: 'Inter_400Regular', fontSize: 11 },

  // Sections
  section: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4 },
  sectionTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },

  // Price
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  priceGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceMain: { fontFamily: 'Inter_400Regular', fontSize: 22, color: colors.text.price },
  priceOriginal: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: colors.text.secondary,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: colors.accent.sale,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  discountText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.special.discount },
  dimText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text.secondary },

  // All-Time Low
  allTimeLow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  allTimeLowLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text.secondary },
  allTimeLowPrice: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.accent.success },
  allTimeLowDate: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.text.secondary },

  // Price Chart
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  chartPriceLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  chartLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.text.secondary },

  // Regional Prices
  regionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  regionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    paddingVertical: 5,
    gap: 6,
  },
  regionName: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text.secondary, width: 50 },
  regionPrice: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text.primary },
  regionDiscount: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.accent.success },

  // Packages
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  packageInfo: { flex: 1 },
  packageName: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text.primary },
  packageApps: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  packagePriceCol: { alignItems: 'flex-end', marginLeft: 12 },
  packagePrice: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.text.price },
  packageFree: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.accent.success },
  packageDiscount: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.accent.success, marginTop: 2 },

  // Info Grid
  infoGrid: {},
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.separator,
  },
  infoLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text.secondary, width: 110 },
  infoValue: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text.primary, flex: 1 },

  // Reviews
  reviewRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  reviewScore: { fontFamily: 'Inter_400Regular', fontSize: 16 },
  reviewPct: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text.secondary },
  reviewCount: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.text.secondary, marginTop: 4 },

  // Metacritic
  metacriticRow: { flexDirection: 'row' },
  metacriticBadge: {
    width: 44,
    height: 44,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metacriticScore: { fontFamily: 'Inter_400Regular', fontSize: 20, color: '#fff' },

  // Description
  description: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text.primary, lineHeight: 20 },
});
