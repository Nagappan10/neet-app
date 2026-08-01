import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { radius, spacing, type, usePalette, withAlpha } from '@/theme';
import { spring } from '@/theme/motion';
import type { DayStats } from '@/types';
import { WEEKDAY_LABELS, fromDayKey, isFuture, isToday } from '@/utils/date';

export interface HeatmapCalendarProps {
  /** One entry per day of the month, in order. */
  days: DayStats[];
  color: string;
  onSelectDay?: (day: string) => void;
  selectedDay?: string | null;
}

/**
 * Month heatmap: one cell per day, opacity scaled by step count against the
 * month's own peak so a quiet month still shows contrast rather than a wall of
 * near-black. Cells pop in on a staggered spring, walking across the grid.
 */
export function HeatmapCalendar({
  days,
  color,
  onSelectDay,
  selectedDay,
}: HeatmapCalendarProps) {
  const palette = usePalette();

  const peak = useMemo(() => Math.max(...days.map((d) => d.steps), 1), [days]);

  // Pad the front of the grid so the 1st lands under its real weekday.
  const leadingBlanks = useMemo(() => {
    if (days.length === 0) return 0;
    return (fromDayKey(days[0]!.day).getDay() + 6) % 7; // Mon = 0
  }, [days]);

  return (
    <View>
      <View style={styles.header}>
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={i} style={styles.cellWrap}>
            <Text style={[type.caption, { color: palette.textTertiary }]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <View key={`blank-${i}`} style={styles.cellWrap} />
        ))}

        {days.map((day, index) => (
          <Cell
            key={day.day}
            day={day}
            index={index + leadingBlanks}
            intensity={day.steps / peak}
            color={color}
            selected={selectedDay === day.day}
            onPress={onSelectDay ? () => onSelectDay(day.day) : undefined}
          />
        ))}
      </View>

      <Legend color={color} peak={peak} />
    </View>
  );
}

function Cell({
  day,
  index,
  intensity,
  color,
  selected,
  onPress,
}: {
  day: DayStats;
  index: number;
  intensity: number;
  color: string;
  selected: boolean;
  onPress?: () => void;
}) {
  const palette = usePalette();
  const scale = useSharedValue(0);

  useEffect(() => {
    // 14ms steps: fast enough that a 31-cell grid finishes in under half a
    // second, slow enough to still read as a sweep.
    scale.value = withDelay(Math.min(index * 14, 420), withSpring(1, spring.bouncy));
  }, [scale, index]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const future = isFuture(day.day);
  const met = day.goal > 0 && day.steps >= day.goal;

  // Floor at 0.12 so any non-zero day is visibly distinct from an empty one.
  const alpha = day.steps === 0 ? 0 : 0.12 + Math.min(1, intensity) * 0.78;

  const dayNumber = Number(day.day.slice(-2));

  return (
    <View style={styles.cellWrap}>
      <PressableScale
        onPress={onPress}
        disabled={!onPress || future}
        haptic="select"
        hitSlop={2}
        accessibilityLabel={`${day.day}, ${day.steps} steps`}
      >
        <Animated.View
          style={[
            styles.cell,
            {
              backgroundColor: future
                ? 'transparent'
                : alpha === 0
                  ? withAlpha(palette.text, 0.05)
                  : withAlpha(color, alpha),
              borderColor: selected
                ? palette.text
                : isToday(day.day)
                  ? withAlpha(color, 0.9)
                  : 'transparent',
              borderWidth: selected || isToday(day.day) ? 1.5 : 0,
            },
            style,
          ]}
        >
          <Text
            style={[
              type.caption,
              styles.cellLabel,
              {
                color:
                  alpha > 0.55
                    ? '#FFFFFF'
                    : future
                      ? palette.textTertiary
                      : palette.textSecondary,
              },
            ]}
          >
            {dayNumber}
          </Text>
          {met ? <View style={styles.metDot} /> : null}
        </Animated.View>
      </PressableScale>
    </View>
  );
}

function Legend({ color, peak }: { color: string; peak: number }) {
  const palette = usePalette();
  return (
    <View style={styles.legend}>
      <Text style={[type.caption, { color: palette.textTertiary }]}>Less</Text>
      {[0.05, 0.3, 0.55, 0.8, 1].map((step) => (
        <View
          key={step}
          style={[styles.legendSwatch, { backgroundColor: withAlpha(color, 0.12 + step * 0.78) }]}
        />
      ))}
      <Text style={[type.caption, { color: palette.textTertiary }]}>
        More · peak {peak.toLocaleString()}
      </Text>
    </View>
  );
}

const CELL_GAP = 6;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: CELL_GAP,
  },
  cellWrap: {
    width: `${100 / 7}%`,
    alignItems: 'center',
  },
  cell: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: {
    fontWeight: '600',
  },
  metDot: {
    position: 'absolute',
    bottom: 3,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.base,
    justifyContent: 'flex-end',
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
});
