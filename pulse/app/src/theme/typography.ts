import { Platform, type TextStyle } from 'react-native';

/**
 * Typography.
 *
 * SF Pro on iOS and Roboto on Android come free via the system font, so we
 * never ship a font file. Two rules carry most of the Apple feel:
 *
 *   1. Big numbers get heavy weights and *negative* tracking. Display type at
 *      default tracking looks loose and amateurish.
 *   2. Anything that ticks upward is `fontVariant: ['tabular-nums']`, so digit
 *      glyphs share a fixed advance width and a live counter never jitters.
 */

export const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const monoFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

/** Applied to every counter, timer and stat value in the app. */
export const tabularNums: TextStyle = {
  fontVariant: ['tabular-nums'],
};

export const type = {
  /** 64pt hero number — the live step count. */
  hero: {
    fontFamily,
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '700',
    letterSpacing: -2.2,
    ...tabularNums,
  },

  /** 44pt — session timer, secondary hero values. */
  display: {
    fontFamily,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -1.4,
    ...tabularNums,
  },

  /** 34pt — screen titles at rest. */
  largeTitle: {
    fontFamily,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: -0.8,
  },

  title1: { fontFamily, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  title2: { fontFamily, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  title3: { fontFamily, fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.3 },

  headline: { fontFamily, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontFamily, fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.2 },
  callout: { fontFamily, fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.15 },
  subhead: { fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '500', letterSpacing: -0.1 },
  footnote: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 },
  caption: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.1 },

  /** All-caps section eyebrow. Thin weight, wide tracking. */
  eyebrow: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  /** Stat card values — heavy, tight, tabular. */
  statValue: {
    fontFamily,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    ...tabularNums,
  },

  statLabel: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.2 },

  mono: { fontFamily: monoFamily, fontSize: 13, lineHeight: 18, ...tabularNums },
} satisfies Record<string, TextStyle>;

export type TypeToken = keyof typeof type;
