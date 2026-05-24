import { Dimensions, PixelRatio, Platform, StatusBar } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 14 Pro as reference)
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

/**
 * Responsive scaling functions
 * Scales sizes based on screen dimensions to work on all devices
 */

// Scale based on screen width (for horizontal elements)
export const scaleWidth = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Scale based on screen height (for vertical elements)
export const scaleHeight = (size: number): number => {
  const scale = SCREEN_HEIGHT / BASE_HEIGHT;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Moderate scale (doesn't scale as aggressively, good for fonts)
export const moderateScale = (size: number, factor: number = 0.5): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size + (scale - 1) * size * factor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Font scaling with maximum limit
export const scaleFont = (size: number): number => {
  const scale = Math.min(SCREEN_WIDTH / BASE_WIDTH, 1.3); // Cap at 1.3x
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

// Screen dimensions
export const screen = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmall: SCREEN_WIDTH < 375,
  isMedium: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414,
  isLarge: SCREEN_WIDTH >= 414,
  isTablet: SCREEN_WIDTH >= 768,
};

// Safe area insets (approximate, will be overridden by SafeAreaProvider)
export const safeArea = {
  top: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24,
  bottom: Platform.OS === 'ios' ? 34 : 0,
};

// Spacing scale (Steam uses consistent 4px grid)
export const spacing = {
  xxs: scaleWidth(2),
  xs: scaleWidth(4),
  sm: scaleWidth(8),
  md: scaleWidth(12),
  lg: scaleWidth(16),
  xl: scaleWidth(20),
  xxl: scaleWidth(24),
  xxxl: scaleWidth(32),
  huge: scaleWidth(48),
};

// Border radius
export const radius = {
  none: 0,
  xs: scaleWidth(2),
  sm: scaleWidth(4),
  md: scaleWidth(8),
  lg: scaleWidth(12),
  xl: scaleWidth(16),
  full: 9999,
};

// Icon sizes
export const iconSize = {
  xs: scaleWidth(12),
  sm: scaleWidth(16),
  md: scaleWidth(20),
  lg: scaleWidth(24),
  xl: scaleWidth(32),
  xxl: scaleWidth(48),
};

// Common component sizes
export const componentSize = {
  // Buttons
  buttonHeight: scaleHeight(44),
  buttonHeightSmall: scaleHeight(36),
  buttonHeightLarge: scaleHeight(52),

  // Inputs
  inputHeight: scaleHeight(44),
  searchBarHeight: scaleHeight(40),

  // Navigation
  tabBarHeight: scaleHeight(60) + safeArea.bottom,
  headerHeight: scaleHeight(56),

  // Cards
  gameCardWidth: scaleWidth(140),
  gameCardHeight: scaleHeight(200),
  gameListItemHeight: scaleHeight(80),

  // Images
  thumbnailSmall: scaleWidth(40),
  thumbnailMedium: scaleWidth(60),
  thumbnailLarge: scaleWidth(80),
  avatarSize: scaleWidth(40),
};

export default {
  scaleWidth,
  scaleHeight,
  moderateScale,
  scaleFont,
  screen,
  safeArea,
  spacing,
  radius,
  iconSize,
  componentSize,
};
