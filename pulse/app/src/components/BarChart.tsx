import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { radius, spacing, type, usePalette, withAlpha } from '@/theme';
import { spring, staggerDelay, timing } from '@/theme/motion';
import type { DayStats } from '@/types';
import { isFuture, isToday, weekdayLabel } from '@/utils/date';

export interface BarChartProps {
  days: DayStats[];
  /** Draws a dashed goal line across the plot. */
  goal?: number;
  selectedDay?: string | null;
  onSelectDay?: (day: string) => void;
  height?: number;
  colors?: [string, string];
}

const MIN_BAR_FRACTION = 0.02; // a zero day still shows a sliver, not nothing

/**
 * Weekly step bars.
 *
 * Each bar grows from zero on mount with a spring, staggered 50ms apart so the
 * row reads as a wave rather than a wall. When the underlying data changes the
 * bars animate between values — they never snap — because the shared value is
 * re-sprung rather than re-rendered.
 */
export function BarChart({
  days,
  goal,
  selectedDay,
  onSelectDay,
  height = 180,
  colors,
}: BarChartProps) {
  const palette = usePalette();
  const stroke = colors ?? [palette.walkFrom, palette.walkTo];

  const peak = Math.max(...days.map((d) => d.steps), goal ?? 0, 1);
  const plotHeight = height - 28; // leave room for the weekday labels

  return (
    <View style={{ height }}>
      <View style={[styles.plot, { height: plotHeight }]}>
        {goal !== undefined && goal > 0 && goal <= peak ? (
          <GoalLine fraction={goal / peak} plotHeight={plotHeight} />
        ) : null}

        {days.map((day, index) => (
          <Bar
            key={day.day}
            day={day}
            index={index}
            fraction={Math.max(day.steps / peak, day.steps > 0 ? MIN_BAR_FRACTION : 0.008)}
            plotHeight={plotHeight}
            colors={stroke}
            selected={selectedDay === day.day}
            onPress={onSelectDay ? () => onSelectDay(day.day) : undefined}
          />
        ))}
      </View>

      <View style={styles.labels}>
        {days.map((day) => (
          <View key={day.day} style={styles.labelCell}>
            <Text
              style={[
                type.caption,
                {
                  color: isToday(day.day) ? palette.text : palette.textTertiary,
                  fontWeight: isToday(day.day) ? '700' : '500',
                },
              ]}
            >
              {weekdayLabel(day.day)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Bar({
  day,
  index,
  fraction,
  plotHeight,
  colors,
  selected,
  onPress,
}: {
  day: DayStats;
  index: number;
  fraction: number;
  plotHeight: number;
  colors: [string, string];
  selected: boolean;
  onPress?: () => void;
}) {
  const palette = usePalette();
  const grow = useSharedValue(0);
  const selection = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    grow.value = withDelay(staggerDelay(index), withSpring(fraction, spring.chart));
  }, [grow, fraction, index]);

  useEffect(() => {
    selection.value = withTiming(selected ? 1 : 0, timing.fast);
  }, [selection, selected]);

  const barStyle = useAnimatedStyle(() => ({
    height: Math.max(3, grow.value * plotHeight),
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: selection.value,
    transform: [{ scaleY: 0.9 + selection.value * 0.1 }],
  }));

  const future = isFuture(day.day);
  const met = day.goal > 0 && day.steps >= day.goal;

  return (
    <PressableScale
      style={styles.barCell}
      onPress={onPress}
      disabled={!onPress}
      haptic="select"
      accessibilityLabel={`${day.day}, ${day.steps} steps${met ? ', goal met' : ''}`}
    >
      <View style={styles.barTrack}>
        {/* Selection halo sits behind the bar so it reads as a glow, not a box. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.halo,
            { backgroundColor: withAlpha(colors[0], 0.14) },
            haloStyle,
          ]}
        />

        <Animated.View style={[styles.bar, barStyle]}>
          <LinearGradient
            colors={
              future
                ? [withAlpha(palette.text, 0.06), withAlpha(palette.text, 0.03)]
                : [colors[0], colors[1]]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {met ? (
          <View style={[styles.metDot, { backgroundColor: colors[0] }]} />
        ) : null}
      </View>
    </PressableScale>
  );
}

function GoalLine({ fraction, plotHeight }: { fraction: number; plotHeight: number }) {
  const palette = usePalette();
  const appear = useSharedValue(0);

  useEffect(() => {
    appear.value = withDelay(320, withTiming(1, timing.base));
  }, [appear]);

  const style = useAnimatedStyle(() => ({ opacity: appear.value * 0.5 }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.goalLine,
        { bottom: fraction * plotHeight, borderColor: palette.textTertiary },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  barCell: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  halo: {
    borderRadius: radius.md,
  },
  metDot: {
    position: 'absolute',
    top: -2,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  labels: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  labelCell: {
    flex: 1,
    alignItems: 'center',
  },
});
