/**
 * Color Palette
 */

export const colors = {
  // Primary backgrounds
  background: {
    primary: '#2a2c34',      // Main content area background
    secondary: '#1f2127',    // Header and tab bar background
    tertiary: '#1f2127',     // Input fields, elevated surfaces
    header: '#1f2127',       // Header background
    card: '#1f2127',         // Card backgrounds
  },

  // Surface colors
  surface: {
    default: '#1f2127',      // Default card/menu surface
    elevated: '#2a2c34',     // Elevated/hover states
    overlay: 'rgba(0, 0, 0, 0.8)',  // Modal overlays
    searchBar: '#1f2127',    // Search bar background
  },

  // Text colors
  text: {
    primary: '#dfe3e6',       // Near-white primary text
    secondary: '#5f6066',     // Gray muted text
    tertiary: '#5f6066',      // Same gray for other muted text
    link: '#1a9fff',          // Blue link text
    accent: '#1a9fff',        // Same blue for accent
    success: '#4caf50',       // Green text
    price: '#acdbf5',         // Price text (light blue)
    wallet: '#4caf50',        // Wallet/money green
  },

  // Accent colors
  accent: {
    primary: '#1a9fff',       // Active tabs, buttons
    primaryLight: '#66c0f4',  // Lighter accent
    secondary: '#2a2c34',     // Secondary buttons
    success: '#4caf50',       // Green (discounts, online)
    warning: '#f0ad4e',       // Yellow/orange warnings
    error: '#dc3545',         // Red errors
    sale: '#4c6b22',          // Sale badge background
  },

  // Border colors
  border: {
    default: '#2a2c34',       // Default borders
    light: '#3d4f5f',         // Lighter borders
    separator: '#404247',     // Tab bar top separator (dark gray)
    focus: '#1a9fff',         // Focus state blue
  },

  // Bottom tab bar
  tabBar: {
    background: '#1f2127',    // Tab bar background
    inactive: '#dfe3e6',      // Inactive icon color
    active: '#1a9fff',        // Active icon/indicator blue
  },

  // Specific UI elements
  ui: {
    searchBarBg: '#3d4450',   // Search bar background - slightly lighter than header
    searchBarText: '#5f6066', // Search bar placeholder
    headerBg: '#1f2127',      // Header background
    menuBg: '#1f2127',        // Menu background
    menuItemBg: '#1f2127',    // Menu item background
    divider: '#404247',       // Dividers between items
    avatarBorder: '#1f2127',  // Avatar border
  },

  // Status colors
  status: {
    online: '#57cbde',        // Online status cyan
    away: '#e6b800',          // Away status yellow
    offline: '#636363',       // Offline gray
    inGame: '#90ba3c',        // In-game green
  },

  // Special elements
  special: {
    wishlist: '#ff5f5f',      // Wishlist heart red
    discount: '#a4d007',      // Discount percentage green
    historicLow: '#00ff00',   // Historic low badge
    accentBlue: '#1a9fff',    // Accent blue
  },
};

// Semantic aliases
export const semantic = {
  screenBackground: colors.background.primary,
  cardBackground: colors.surface.default,
  inputBackground: colors.ui.searchBarBg,
  headerBackground: colors.ui.headerBg,
  headingText: colors.text.primary,
  bodyText: colors.text.secondary,
  mutedText: colors.text.tertiary,
  buttonPrimary: colors.accent.primary,
  link: colors.text.link,
};

export default colors;
