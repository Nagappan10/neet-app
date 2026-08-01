import {
  Easing,
  ReduceMotion,
  type WithSpringConfig,
  type WithTimingConfig,
} from 'react-native-reanimated';

/**
 * Motion presets.
 *
 * Rule one: springs, not curves. Linear and ease-in-out easing read as
 * "web page"; physical settling reads as "native". The `standard` spring
 * (damping 15 / stiffness 120) is the app's base feel and every other preset
 * is a deliberate deviation from it.
 *
 * All of these are consumed inside `useAnimatedStyle` / `withSpring` calls
 * that Reanimated runs on the UI thread, so animation never blocks on JS.
 *
 * Every preset carries `reduceMotion: System`, so when the user has switched
 * on Reduce Motion the animation jumps straight to its final value instead of
 * springing. Respecting that setting is not optional in a first-party-feeling
 * app — for some people this much motion is genuinely unpleasant.
 */

const reduceMotion = ReduceMotion.System;

export const spring = {
  /** The house spring. Cards, layout shifts, most transitions. */
  standard: { damping: 15, stiffness: 120, mass: 1, reduceMotion } satisfies WithSpringConfig,

  /** Snappier, for press states that must feel instantaneous. */
  snappy: { damping: 18, stiffness: 260, mass: 0.7, reduceMotion } satisfies WithSpringConfig,

  /** Softer and slower — big hero numbers, progress rings. */
  gentle: { damping: 20, stiffness: 90, mass: 1.1, reduceMotion } satisfies WithSpringConfig,

  /** A touch of overshoot for celebratory moments (goal met, day completed). */
  bouncy: { damping: 10, stiffness: 180, mass: 0.9, reduceMotion } satisfies WithSpringConfig,

  /** No overshoot at all — anything that must not visually cross its target. */
  precise: { damping: 26, stiffness: 200, mass: 1, reduceMotion } satisfies WithSpringConfig,

  /** Chart bars growing on mount. */
  chart: { damping: 14, stiffness: 110, mass: 1, reduceMotion } satisfies WithSpringConfig,
} as const;

/** Timings are reserved for opacity and colour, where springs make no sense. */
export const timing = {
  fast: { duration: 150, easing: Easing.out(Easing.quad), reduceMotion } satisfies WithTimingConfig,
  base: { duration: 260, easing: Easing.out(Easing.cubic), reduceMotion } satisfies WithTimingConfig,
  slow: { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion } satisfies WithTimingConfig,
  /**
   * Long, unhurried loop used by the background mesh blobs. Endless ambient
   * drift is precisely what Reduce Motion exists to switch off, so it opts in
   * to the system setting like everything else.
   */
  ambient: {
    duration: 9000,
    easing: Easing.inOut(Easing.sin),
    reduceMotion,
  } satisfies WithTimingConfig,
} as const;

/** Staggered list/chart entrances: item `i` starts 50ms after item `i - 1`. */
export const STAGGER_MS = 50;

export function staggerDelay(index: number, step = STAGGER_MS, max = 500): number {
  'worklet';
  return Math.min(index * step, max);
}

/** Press-in scale for interactive surfaces. */
export const PRESS_SCALE = 0.96;
/** Slightly less travel for large surfaces, which would otherwise feel rubbery. */
export const PRESS_SCALE_LARGE = 0.98;
