/**
 * Colour system.
 *
 * Dark is the primary theme: a near-black #0A0A0C ground that lets the mesh
 * gradient blobs bloom underneath the frosted layers. Light mode is a real
 * theme, not an inversion — glass over white needs *more* opacity and *less*
 * border contrast to avoid looking like grey plastic.
 */

export interface Palette {
  scheme: 'dark' | 'light';

  /** Page background, behind everything including the mesh. */
  background: string;
  /** Slightly raised ground for grouped sections. */
  backgroundElevated: string;

  /** Fill applied on top of the blur inside a glass card. */
  glass: string;
  glassStrong: string;
  /** 1px top highlight that gives glass its lit edge. */
  glassHighlight: string;
  glassBorder: string;

  text: string;
  textSecondary: string;
  textTertiary: string;

  separator: string;

  /** Section accents. */
  walkFrom: string;
  walkTo: string;
  practiceFrom: string;
  practiceTo: string;

  success: string;
  danger: string;
  warning: string;
  flame: string;

  /** Mesh gradient blob colours, drawn at low opacity behind the blur. */
  mesh: [string, string, string];

  /** Tint passed to BlurView. */
  blurTint: 'dark' | 'light';
  /** Shadow colour — pure black in dark, a soft navy in light. */
  shadow: string;
}

export const darkPalette: Palette = {
  scheme: 'dark',

  background: '#0A0A0C',
  backgroundElevated: '#121216',

  glass: 'rgba(255,255,255,0.06)',
  glassStrong: 'rgba(255,255,255,0.10)',
  glassHighlight: 'rgba(255,255,255,0.18)',
  glassBorder: 'rgba(255,255,255,0.08)',

  text: '#FFFFFF',
  textSecondary: 'rgba(235,235,245,0.62)',
  textTertiary: 'rgba(235,235,245,0.35)',

  separator: 'rgba(255,255,255,0.08)',

  walkFrom: '#22D3EE',
  walkTo: '#3B82F6',
  practiceFrom: '#A855F7',
  practiceTo: '#EC4899',

  success: '#30D158',
  danger: '#FF453A',
  warning: '#FFD60A',
  flame: '#FF9F0A',

  mesh: ['#1E5F8C', '#5B2A86', '#0E7490'],

  blurTint: 'dark',
  shadow: '#000000',
};

export const lightPalette: Palette = {
  scheme: 'light',

  background: '#F2F2F7',
  backgroundElevated: '#FFFFFF',

  glass: 'rgba(255,255,255,0.55)',
  glassStrong: 'rgba(255,255,255,0.72)',
  glassHighlight: 'rgba(255,255,255,0.90)',
  glassBorder: 'rgba(0,0,0,0.06)',

  text: '#000000',
  textSecondary: 'rgba(60,60,67,0.62)',
  textTertiary: 'rgba(60,60,67,0.32)',

  separator: 'rgba(60,60,67,0.12)',

  walkFrom: '#06B6D4',
  walkTo: '#2563EB',
  practiceFrom: '#8B5CF6',
  practiceTo: '#DB2777',

  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  flame: '#FF9500',

  mesh: ['#7DD3FC', '#C4B5FD', '#67E8F9'],

  blurTint: 'light',
  shadow: '#1E293B',
};

export type AccentKey = 'walk' | 'practice';

export function accentGradient(palette: Palette, accent: AccentKey): [string, string] {
  return accent === 'walk'
    ? [palette.walkFrom, palette.walkTo]
    : [palette.practiceFrom, palette.practiceTo];
}

/** Adds an alpha channel to a `#RRGGBB` string. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Preset swatches offered when creating a practice activity. */
export const ACTIVITY_COLORS = [
  '#A855F7',
  '#EC4899',
  '#F43F5E',
  '#FB923C',
  '#FACC15',
  '#4ADE80',
  '#22D3EE',
  '#3B82F6',
  '#818CF8',
  '#F472B6',
] as const;
