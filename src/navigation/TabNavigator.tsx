import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Animated, Easing } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_COUNT = 4;
const TAB_WIDTH = SCREEN_WIDTH / TAB_COUNT;

// Global flag to track if navigation was triggered by swipe
let isSwipeNavigation = false;

export const setSwipeNavigation = (value: boolean) => {
  isSwipeNavigation = value;
};

// Global callback for indicator stretch during drag (with direction)
let onIndicatorStretch: ((stretchAmount: number, direction: number) => void) | null = null;
let onIndicatorReset: (() => void) | null = null;

export const setIndicatorStretch = (stretch: number, direction: number) => {
  if (onIndicatorStretch) {
    onIndicatorStretch(stretch, direction);
  }
};

export const resetIndicatorStretch = () => {
  if (onIndicatorReset) {
    onIndicatorReset();
  }
};

const registerIndicatorStretchCallback = (callback: (stretch: number, direction: number) => void) => {
  onIndicatorStretch = callback;
};

const registerIndicatorResetCallback = (callback: () => void) => {
  onIndicatorReset = callback;
};

// Import screens
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import DealsScreen from '../screens/DealsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const ICON_SIZE = 20;

interface IconDef {
  path: string;
  viewBox: string;
  fillRule?: 'evenodd' | 'nonzero';
  clipRule?: 'evenodd' | 'nonzero';
  size?: number;
}

const ICON_PATHS: Record<string, IconDef> = {
  Home: {
    path: 'M20 10.2216L10.2216 20L0 9.77837V0H9.77837L20 10.2216Z',
    viewBox: '0 0 20 20',
  },
  Search: {
    path: 'M33 3H3V33C3 33.5523 3.44772 34 4 34H32C32.5523 34 33 33.5523 33 33V3ZM6.75 7.37209H19.8665V15.659H6.75V7.37209ZM29.233 18.5734V21.4881H6.75V18.5734H29.233ZM29.233 27.3182V24.4034H6.75V27.3182H29.233Z',
    viewBox: '0 0 36 36',
    fillRule: 'evenodd',
    clipRule: 'evenodd',
  },
  Deals: {
    path: 'M18 13.75V15H2V13.75L4.28571 10.625V6.25C4.28571 4.5924 4.88775 3.00269 5.95939 1.83058C7.03103 0.65848 8.48448 0 10 0C11.5155 0 12.969 0.65848 14.0406 1.83058C15.1122 3.00269 15.7143 4.5924 15.7143 6.25V10.625L18 13.75ZM10 20C10.7083 19.9991 11.399 19.7583 11.9772 19.3106C12.5553 18.863 12.9925 18.2304 13.2286 17.5H6.77143C7.00754 18.2304 7.44471 18.863 8.02283 19.3106C8.60096 19.7583 9.29166 19.9991 10 20Z',
    viewBox: '0 0 20 20',
  },
  Settings: {
    path: 'M0 14.85C0 14.2149 0.514873 13.7 1.15 13.7H22.85C23.4851 13.7 24 14.2149 24 14.85C24 15.4851 23.4851 16 22.85 16H1.15C0.514872 16 0 15.4851 0 14.85ZM0 8.05C0 7.41487 0.514873 6.9 1.15 6.9H22.85C23.4851 6.9 24 7.41487 24 8.05C24 8.68513 23.4851 9.2 22.85 9.2H1.15C0.514872 9.2 0 8.68513 0 8.05ZM0 1.15C0 0.514873 0.514873 0 1.15 0H22.85C23.4851 0 24 0.514873 24 1.15C24 1.78513 23.4851 2.3 22.85 2.3H1.15C0.514872 2.3 0 1.78513 0 1.15Z',
    viewBox: '0 0 24 16',
  },
};

const TabIcon: React.FC<{ routeName: string; focused: boolean }> = ({ routeName, focused }) => {
  const iconColor = focused ? colors.tabBar.active : colors.tabBar.inactive;
  const iconData = ICON_PATHS[routeName] || ICON_PATHS.Home;
  const size = iconData.size || ICON_SIZE;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={iconData.viewBox}
      fill="currentColor"
      color={iconColor}
      preserveAspectRatio="xMidYMid meet"
    >
      <Path
        d={iconData.path}
        fill={iconColor}
        fillRule={iconData.fillRule}
        clipRule={iconData.clipRule}
      />
    </Svg>
  );
};

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const indicatorPosition = useRef(new Animated.Value(state.index * TAB_WIDTH)).current;
  const indicatorOffsetX = useRef(new Animated.Value(0)).current;
  const previousIndex = useRef(state.index);

  useEffect(() => {
    registerIndicatorStretchCallback((stretch: number, direction: number) => {
      const maxShift = TAB_WIDTH * 0.20;
      const shiftAmount = ((stretch - 1) / 0.4) * maxShift;
      indicatorOffsetX.setValue(-direction * shiftAmount);
    });
    registerIndicatorResetCallback(() => {
      Animated.timing(indicatorOffsetX, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      onIndicatorStretch = null;
      onIndicatorReset = null;
    };
  }, []);

  useEffect(() => {
    const targetPosition = state.index * TAB_WIDTH;

    Animated.timing(indicatorPosition, {
      toValue: targetPosition,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.timing(indicatorOffsetX, {
      toValue: 0,
      duration: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    isSwipeNavigation = false;
    previousIndex.current = state.index;
  }, [state.index]);

  const translateX = Animated.add(indicatorPosition, indicatorOffsetX);

  return (
    <View style={[tabBarStyles.container, { paddingBottom: insets.bottom }]}>
      <View style={tabBarStyles.topLine} />

      <View style={tabBarStyles.tabsRow}>
        <Animated.View style={[tabBarStyles.animatedIndicatorContainer, { transform: [{ translateX }] }]}>
          <LinearGradient
            colors={['#66C0F4', '#2D73FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={tabBarStyles.animatedIndicator}
          />
        </Animated.View>

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              isSwipeNavigation = false;
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={tabBarStyles.tab}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <View style={tabBarStyles.iconContainer}>
                <TabIcon routeName={route.name} focused={isFocused} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const tabBarStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.tabBar.background,
    borderTopWidth: 0,
  },
  topLine: {
    height: 0,
    backgroundColor: 'transparent',
  },
  tabsRow: {
    flexDirection: 'row',
    height: 54,
    position: 'relative',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  animatedIndicatorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: TAB_WIDTH,
    height: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  animatedIndicator: {
    width: '70%',
    height: 2,
    borderRadius: 1,
  },
  iconContainer: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    minWidth: 20,
  },
});

export const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Deals" component={DealsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export default TabNavigator;
