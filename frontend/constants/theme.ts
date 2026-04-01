/**
 * theme.ts
 * Central design token registry for the entire application.
 * All visual constants (spacing, typography, radii, shadows, sizes) are defined here.
 * No component or screen should use hardcoded numeric or color values.
 *
 * Usage:
 *   import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS, SIZES, SEMANTIC_COLORS } from '@/constants/theme';
 */

/** Spacing scale (multiples of 4) */
export const SPACING = {
  NONE: 0,
  XXS: 2,
  XS: 4,
  SM: 6,
  MD: 8,
  LG: 10,
  XL: 12,
  XXL: 14,
  XXXL: 16,
  '4XL': 18,
  '5XL': 20,
  '6XL': 24,
  '7XL': 32,
  '8XL': 48,
} as const;

/** Font sizes and weights used across the app */
export const TYPOGRAPHY = {
  SIZE: {
    MICRO: 8,
    TINY: 10,
    CAPTION: 11,
    SMALL: 12,
    BODY_SMALL: 13,
    BODY: 14,
    BODY_LARGE: 15,
    SUBTITLE: 16,
    TITLE_SMALL: 17,
    TITLE: 18,
    HEADING: 20,
    DISPLAY_SMALL: 24,
    DISPLAY: 30,
  },
  WEIGHT: {
    REGULAR: '400' as const,
    MEDIUM: '500' as const,
    SEMIBOLD: '600' as const,
    BOLD: '700' as const,
    EXTRABOLD: '800' as const,
  },
  LETTER_SPACING: {
    TIGHT: -0.5,
    SNUG: -0.3,
    DENSE: -0.2,
    NORMAL: 0,
    WIDE: 0.3,
    WIDER: 0.5,
    WIDEST: 0.8,
  },
  LINE_HEIGHT: {
    TIGHT: 18,
    NORMAL: 22,
    RELAXED: 24,
  },
} as const;

/** Border radii */
export const RADIUS = {
  NONE: 0,
  XS: 4,
  SM: 6,
  MD: 8,
  LG: 10,
  XL: 12,
  XXL: 14,
  ROUND: 9999,
} as const;

/** Shadow presets for elevation levels */
export const SHADOWS = {
  NONE: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  SM: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  MD: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  LG: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  XL: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

/** Fixed component sizes */
export const SIZES = {
  ICON: {
    XS: 14,
    SM: 15,
    MD: 16,
    LG: 18,
    XL: 20,
    XXL: 24,
  },
  BUTTON: {
    ICON_SIZE: 30,
    HAMBURGER_SIZE: 32,
    ICON_RADIUS: 8,
  },
  BADGE: {
    MIN_WIDTH: 14,
    HEIGHT: 14,
    RADIUS: 7,
    COUNT_RADIUS: 10,
    TAB_MIN_WIDTH: 18,
    TAB_HEIGHT: 18,
    TAB_RADIUS: 9,
  },
  AVATAR: {
    SM: 32,
    MD: 40,
    LG: 48,
    XL: 72,
  },
  CARD: {
    SUMMARY_ICON: 40,
    SUMMARY_ICON_RADIUS: 10,
    DETAIL_ICON: 48,
    DETAIL_ICON_RADIUS: 12,
  },
  SIDEBAR: {
    WIDTH: 280,
  },
  DETAIL_PANEL: {
    WIDTH: 380,
  },
  TABLET_BREAKPOINT: 768,
} as const;

/**
 * Semantic color constants that do not depend on the theme mode.
 * These are fixed colors used for specific UI elements (status badges, etc.)
 */
export const SEMANTIC_COLORS = {
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  OVERLAY: 'rgba(0,0,0,0.4)',
  HEADER_BUTTON_BG: 'rgba(255,255,255,0.15)',
  STATUS: {
    SUCCESS: '#059669',
    ERROR: '#DC2626',
    WARNING: '#D97706',
    INFO: '#2563EB',
    PARTIAL: '#2563EB',
  },
  PLAN: {
    STARTER: '#6B7280',
    PRO: '#2563EB',
    BUSINESS: '#7C3AED',
  },
  NOTIFICATION_BADGE: '#EF4444',
  SAVE_BADGE: '#059669',
} as const;
