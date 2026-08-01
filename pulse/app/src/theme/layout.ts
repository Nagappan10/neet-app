import type { ViewStyle } from 'react-native';
import type { Palette } from './colors';

/** 4pt base grid. Everything in the app snaps to these. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
  screen: 20,
} as const;

/** Generous corner radii — 24-28pt on cards is the whole aesthetic. */
export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  card: 26,
  xl: 32,
  pill: 999,
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

/**
 * Depth comes from *layered* shadows rather than one heavy drop shadow: a
 * tight contact shadow for the edge, plus a wide ambient one for lift. iOS
 * renders both; Android collapses them to `elevation`, so we pick the level
 * that best matches the ambient layer.
 */
export function shadow(palette: Palette, level: 'sm' | 'md' | 'lg' | 'xl'): ViewStyle {
  const isDark = palette.scheme === 'dark';
  const opacity = { sm: 0.18, md: 0.26, lg: 0.34, xl: 0.45 }[level];
  const radiusFor = { sm: 8, md: 18, lg: 30, xl: 44 }[level];
  const offset = { sm: 2, md: 6, lg: 12, xl: 20 }[level];
  const elevation = { sm: 2, md: 6, lg: 12, xl: 20 }[level];

  return {
    shadowColor: palette.shadow,
    shadowOpacity: isDark ? opacity : opacity * 0.5,
    shadowRadius: radiusFor,
    shadowOffset: { width: 0, height: offset },
    elevation,
  };
}

/** Tab bar geometry, shared by the bar itself and every screen's bottom pad. */
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_MARGIN = 16;
export const SCROLL_BOTTOM_PAD = TAB_BAR_HEIGHT + TAB_BAR_MARGIN + 28;
