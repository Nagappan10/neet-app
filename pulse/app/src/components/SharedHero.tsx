import { useCallback, useRef, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { spring, timing } from '@/theme/motion';

/**
 * Shared element transitions, done by measurement.
 *
 * Reanimated 4 still exports `sharedTransitionTag`, but it is unreliable on
 * the New Architecture, so we do the honest version instead: the list row
 * measures its own position on screen at press time and passes that rect
 * through the route params. The detail screen's hero then starts life exactly
 * on top of where the row was and springs to its real position, which is
 * visually identical to a native shared element and never silently no-ops.
 */

export interface HeroRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Serialises a rect for expo-router params, which must be strings. */
export const encodeRect = (rect: HeroRect): string =>
  `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)}`;

export function decodeRect(value?: string | string[]): HeroRect | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return { x: parts[0]!, y: parts[1]!, width: parts[2]!, height: parts[3]! };
}

/**
 * Measures a row on press and hands its on-screen rect to the callback.
 * Wrap any list item that should act as a shared element origin.
 */
export function useMeasuredPress(onMeasured: (rect: HeroRect) => void) {
  const ref = useRef<View>(null);

  const handlePress = useCallback(() => {
    const node = ref.current;
    if (!node) {
      onMeasured({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      onMeasured({ x, y, width, height });
    });
  }, [onMeasured]);

  return { ref, handlePress };
}

export interface SharedHeroProps {
  /** Where the element came from. Null falls back to a plain fade-up. */
  origin: HeroRect | null;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders `children` at their natural position, but animates in from `origin`
 * on first mount.
 */
export function SharedHero({ origin, children, style }: SharedHeroProps) {
  const [target, setTarget] = useState<HeroRect | null>(null);
  const progress = useSharedValue(origin ? 0 : 1);
  const started = useRef(false);
  const ref = useRef<View>(null);

  const handleLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      if (started.current || !origin) {
        if (!origin) progress.value = withSpring(1, spring.standard);
        return;
      }
      // Measure in window coordinates so the origin rect (also window-space)
      // is directly comparable, regardless of scroll offset or insets.
      ref.current?.measureInWindow((x, y, width, height) => {
        if (started.current) return;
        started.current = true;
        setTarget({ x, y, width, height });
        progress.value = 0;
        progress.value = withSpring(1, spring.standard);
      });
    },
    [origin, progress],
  );

  const animatedStyle = useAnimatedStyle(() => {
    if (!origin || !target || target.width === 0) {
      return { opacity: progress.value, transform: [{ translateY: (1 - progress.value) * 16 }] };
    }

    const p = progress.value;
    const scaleX = origin.width / target.width;
    const scaleY = origin.height / target.height;

    // Interpolate from the origin rect's centre to the target's.
    const dx = origin.x + origin.width / 2 - (target.x + target.width / 2);
    const dy = origin.y + origin.height / 2 - (target.y + target.height / 2);

    return {
      opacity: 1,
      transform: [
        { translateX: dx * (1 - p) },
        { translateY: dy * (1 - p) },
        { scaleX: scaleX + (1 - scaleX) * p },
        { scaleY: scaleY + (1 - scaleY) * p },
      ],
    };
  });

  return (
    <Animated.View style={[animatedStyle, style]}>
      <View ref={ref} onLayout={handleLayout} collapsable={false}>
        {children}
      </View>
    </Animated.View>
  );
}

/** Content below a hero, faded in slightly behind it so the hero leads. */
export function HeroFollow({ children, delayMs = 90 }: { children: ReactNode; delayMs?: number }) {
  const opacity = useSharedValue(0);

  const handleLayout = useCallback(() => {
    opacity.value = withTiming(1, { ...timing.base, duration: timing.base.duration + delayMs });
  }, [opacity, delayMs]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: (1 - opacity.value) * 12 }],
  }));

  return (
    <Animated.View onLayout={handleLayout} style={style}>
      {children}
    </Animated.View>
  );
}
