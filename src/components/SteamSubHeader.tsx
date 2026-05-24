import React, { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { colors } from '../theme';

const IconChevronDown: React.FC<{ size?: number; color?: string }> = ({
  size = 10,
  color = '#DFE3E6',
}) => (
  <Svg width={size} height={size} viewBox="0 0 10 18">
    <G transform="rotate(270, 5, 9)">
      <Path
        d="M8.02348 17.0687C8.23875 17.2795 8.51272 17.3945 8.83562 17.3945C9.48141 17.3945 10 16.8962 10 16.2638C10 15.9475 9.86301 15.66 9.63796 15.4396L2.78865 8.88495L9.63796 2.34944C9.86301 2.12903 10 1.83196 10 1.52531C10 0.89284 9.48141 0.394531 8.83562 0.394531C8.51272 0.394531 8.23875 0.509526 8.02348 0.720349L0.410959 8.00332C0.136986 8.25248 0.00978474 8.55913 0 8.89453C0 9.22993 0.136986 9.51742 0.410959 9.77615L8.02348 17.0687Z"
        fill={color}
      />
    </G>
  </Svg>
);

interface Tab {
  key: string;
  label: string;
  hasDropdown?: boolean;
}

interface SteamSubHeaderProps {
  tabs: Tab[];
  activeTab: string;
  onTabPress: (tabKey: string) => void;
}

export const SteamSubHeader: React.FC<SteamSubHeaderProps> = ({
  tabs,
  activeTab,
  onTabPress,
}) => {
  const animValues = useRef(
    tabs.reduce((acc, tab) => {
      acc[tab.key] = new Animated.Value(tab.key === activeTab ? 1 : 0);
      return acc;
    }, {} as Record<string, Animated.Value>)
  ).current;

  useEffect(() => {
    const anims = tabs.map((tab) =>
      Animated.timing(animValues[tab.key], {
        toValue: tab.key === activeTab ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      })
    );
    Animated.parallel(anims).start();
  }, [activeTab, tabs, animValues]);

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => {
          const textColor = animValues[tab.key].interpolate({
            inputRange: [0, 1],
            outputRange: ['#5f6066', '#DFE3E6'],
          });

          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onTabPress(tab.key)}
              activeOpacity={0.7}
            >
              <View style={styles.tabContent}>
                <Animated.Text
                  style={[
                    tab.hasDropdown ? styles.tabTextWithChevron : styles.tabText,
                    { color: textColor },
                  ]}
                >
                  {tab.label}
                </Animated.Text>
                {tab.hasDropdown && (
                  <View style={styles.dropdownArrow}>
                    <IconChevronDown size={10} color="#DFE3E6" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2127',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    height: 31,
    overflow: 'hidden',
    paddingTop: 4,
    paddingHorizontal: 20,
    gap: 20,
  },
  tab: {},
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tabTextWithChevron: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingRight: 4,
  },
  dropdownArrow: {
    justifyContent: 'center',
  },
});

export default SteamSubHeader;
