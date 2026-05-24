import { TextStyle } from 'react-native';
import { scaleFont, moderateScale } from './spacing';

/**
 * Typography System
 * Uses Inter - loaded in App.tsx via @expo-google-fonts/inter.
 */

// Font families - Inter weights loaded at app boot.
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  bold: 'Inter_700Bold',
  light: 'Inter_400Regular',
};

// Font weights
export const fontWeight = {
  light: '300' as TextStyle['fontWeight'],
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
};

// Font sizes (scaled for device)
export const fontSize = {
  xxs: scaleFont(10),
  xs: scaleFont(11),
  sm: scaleFont(12),
  md: scaleFont(14),
  lg: scaleFont(16),
  xl: scaleFont(18),
  xxl: scaleFont(20),
  xxxl: scaleFont(24),
  huge: scaleFont(28),
  giant: scaleFont(32),
};

// Line heights
export const lineHeight = {
  tight: 1.1,
  normal: 1.4,
  relaxed: 1.6,
};

// Pre-defined text styles
export const textStyles = {
  // Headings
  h1: {
    fontSize: fontSize.giant,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  } as TextStyle,

  h2: {
    fontSize: fontSize.huge,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  } as TextStyle,

  h3: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  } as TextStyle,

  h4: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
  } as TextStyle,

  // Body text
  body: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.md * lineHeight.normal,
  } as TextStyle,

  bodySmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.sm * lineHeight.normal,
  } as TextStyle,

  bodyLarge: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.lg * lineHeight.normal,
  } as TextStyle,

  // Labels & captions
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  } as TextStyle,

  caption: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.xs * lineHeight.normal,
  } as TextStyle,

  // Special
  price: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  } as TextStyle,

  priceSmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  } as TextStyle,

  discount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  } as TextStyle,

  button: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  } as TextStyle,

  buttonSmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
  } as TextStyle,

  // Navigation
  tabLabel: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.medium,
  } as TextStyle,

  navTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
  } as TextStyle,

  // Game specific
  gameTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.md * lineHeight.tight,
  } as TextStyle,

  gameTitleLarge: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  } as TextStyle,

  developerName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
  } as TextStyle,

  tagText: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  } as TextStyle,
};

export default {
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  textStyles,
};
