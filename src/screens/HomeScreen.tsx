import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, PanResponder, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme';
import { SteamHeader, SteamSubHeader, LoadingLine } from '../components';
import { setSwipeNavigation, setIndicatorStretch, resetIndicatorStretch } from '../navigation/TabNavigator';

// Bottom tab order for swipe navigation
const TAB_ORDER = ['Home', 'Search', 'Deals', 'Settings'];

// Steam sub-header tabs
const STORE_TABS = [
  { key: 'menu', label: 'MENU', hasDropdown: true },
  { key: 'wishlist', label: 'WISHLIST' },
  { key: 'wallet', label: 'WALLET' },
];

const HomeScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState('menu');
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const loadingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentScreen = 'Home';

  const translateY = useRef(new Animated.Value(0)).current;
  const gestureDecided = useRef(false);
  const isHorizontal = useRef(false);

  const handleTabPress = (tabKey: string) => {
    setActiveTab(tabKey);
  };

  const triggerLoading = () => {
    if (loadingTimeout.current) clearTimeout(loadingTimeout.current);
    setIsLoading(true);
    loadingTimeout.current = setTimeout(() => setIsLoading(false), 5000);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (!gestureDecided.current && (Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8)) {
          gestureDecided.current = true;
          isHorizontal.current = Math.abs(gs.dx) > Math.abs(gs.dy);
        }

        if (isHorizontal.current) {
          if (Math.abs(gs.dx) > 5) {
            const stretch = 1 + Math.min(Math.abs(gs.dx) * 0.0015, 0.4);
            setIndicatorStretch(stretch, gs.dx < 0 ? -1 : 1);
          }
        } else {
          if (gs.dy > 0) translateY.setValue(Math.min(gs.dy * 0.3, 30));
        }
      },
      onPanResponderRelease: (_, gs) => {
        const wasHorizontal = isHorizontal.current;
        gestureDecided.current = false;
        isHorizontal.current = false;

        Animated.timing(translateY, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

        const { dx, dy } = gs;
        if (wasHorizontal && Math.abs(dx) > 50) {
          const idx = TAB_ORDER.indexOf(currentScreen);
          if (dx < 0 && idx < TAB_ORDER.length - 1) { setSwipeNavigation(true); navigation.navigate(TAB_ORDER[idx + 1] as never); }
          else if (dx > 0 && idx > 0) { setSwipeNavigation(true); navigation.navigate(TAB_ORDER[idx - 1] as never); }
          else resetIndicatorStretch();
        } else if (!wasHorizontal && dy > 50) {
          triggerLoading();
        } else {
          resetIndicatorStretch();
        }
      },
      onPanResponderTerminate: () => {
        gestureDecided.current = false;
        isHorizontal.current = false;
        resetIndicatorStretch();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.secondary} />
      <View style={[styles.statusBarBg, { height: insets.top }]} />
      <SteamHeader />
      <SteamSubHeader
        tabs={STORE_TABS}
        activeTab={activeTab}
        onTabPress={handleTabPress}
      />
      <LoadingLine visible={isLoading} />

      <Animated.View
        style={[styles.content, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <Text style={styles.offlineText}>
          An internet connection is required{'\n'}to view this content
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  statusBarBg: {
    backgroundColor: colors.background.secondary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  offlineText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 20,
    color: '#DFE3E6',
    textAlign: 'center',
  },
});

export default HomeScreen;
