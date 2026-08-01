import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { spring } from '@/theme/motion';
import { usePalette, withAlpha } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** 0..1+. Values above 1 are clamped for the arc but still allowed as input. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  colors?: [string, string];
  trackColor?: string;
  children?: ReactNode;
  /** Leaves a gap at the bottom like an Apple activity ring. Degrees. */
  gapDegrees?: number;
}

/**
 * Circular progress arc.
 *
 * The arc is animated through `strokeDashoffset` on a spring rather than by
 * re-rendering an SVG path: `useAnimatedProps` writes the attribute directly
 * on the UI thread, so the ring stays smooth at 120Hz while JS is busy.
 *
 * Rotated -90° so 0% starts at twelve o'clock, and drawn with a gradient
 * stroke plus a soft under-glow so the head of the arc reads as lit.
 */
export function ProgressRing({
  progress,
  size = 260,
  strokeWidth = 18,
  colors,
  trackColor,
  children,
  gapDegrees = 0,
}: ProgressRingProps) {
  const palette = usePalette();
  const stroke = colors ?? [palette.walkFrom, palette.walkTo];

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const sweep = 1 - gapDegrees / 360;
  const arcLength = circumference * sweep;

  const animated = useSharedValue(0);

  useEffect(() => {
    // `precise` has no overshoot: a ring that springs past 100% and settles
    // back looks like a bug rather than a flourish.
    animated.value = withSpring(Math.min(progress, 1), spring.precise);
  }, [animated, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - animated.value),
  }));

  const glowProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - animated.value),
    opacity: 0.35 * Math.min(1, animated.value * 4),
  }));

  const center = size / 2;
  const rotation = -90 + gapDegrees / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={stroke[0]} />
            <Stop offset="1" stopColor={stroke[1]} />
          </LinearGradient>
        </Defs>

        {/* Track. */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor ?? withAlpha(palette.scheme === 'dark' ? '#FFFFFF' : '#000000', 0.08)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(${rotation} ${center} ${center})`}
        />

        {/* Under-glow: a wider, softer copy of the arc for bloom. */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={stroke[1]}
          strokeWidth={strokeWidth * 1.7}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(${rotation} ${center} ${center})`}
          animatedProps={glowProps}
        />

        {/* The arc itself. */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(${rotation} ${center} ${center})`}
          animatedProps={animatedProps}
        />
      </Svg>

      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

/**
 * A ring whose progress is driven by an existing shared value rather than a
 * prop — used by the live session screen, where the step count updates many
 * times a second and a React round trip per update would be wasteful.
 */
export function useRingProgress(progress: number) {
  const animated = useSharedValue(0);
  useEffect(() => {
    animated.value = withSpring(Math.min(progress, 1), spring.precise);
  }, [animated, progress]);
  return useDerivedValue(() => animated.value);
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
