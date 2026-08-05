import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import Svg, { Circle } from 'react-native-svg';
import { usePalette, withAlpha } from '@/theme';

export const PULL_THRESHOLD = 82;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 30;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Custom pull-to-refresh indicator: an arc that draws itself in proportion to
 * how far the user has pulled, then spins while the refresh runs.
 *
 * Driven entirely from the scroll shared value, so the arc tracks the finger
 * one-to-one with no frame lag — that direct coupling is what separates this
 * from a stock spinner that merely appears once a threshold trips.
 */
export function PullIndicator({
  pull,
  refreshing,
  color,
}: {
  /** Points overscrolled past the top; zero or negative when not pulling. */
  pull: SharedValue<number>;
  refreshing: boolean;
  color: string;
}) {
  const palette = usePalette();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      spin.value = 0;
      spin.value = withRepeat(withTiming(360, { duration: 900 }), -1, false);
    } else {
      spin.value = 0;
    }
  }, [refreshing, spin]);

  const progress = useDerivedValue(() =>
    refreshing ? 0.3 : Math.min(Math.max(pull.value, 0) / PULL_THRESHOLD, 1),
  );

  const containerStyle = useAnimatedStyle(() => {
    const p = Math.min(Math.max(pull.value, 0) / PULL_THRESHOLD, 1);
    return {
      opacity: refreshing ? 1 : p,
      transform: [
        {
          translateY: interpolate(
            Math.min(Math.max(pull.value, 0), PULL_THRESHOLD * 1.5),
            [0, PULL_THRESHOLD],
            [0, 14],
          ),
        },
        { scale: refreshing ? 1 : 0.6 + p * 0.4 },
        // Pre-threshold the ring winds up with the pull; mid-refresh it spins.
        { rotate: `${refreshing ? spin.value : p * 270}deg` },
      ],
    };
  });

  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={withAlpha(palette.text, 0.12)}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          animatedProps={circleProps}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
});
