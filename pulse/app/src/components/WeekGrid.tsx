import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { haptics } from '@/services/haptics';
import { radius, type, usePalette, withAlpha } from '@/theme';
import { spring, staggerDelay, timing } from '@/theme/motion';
import type { PracticeDayCell } from '@/types';
import { isFuture, isToday, weekdayLabel } from '@/utils/date';

export interface WeekGridProps {
  days: PracticeDayCell[];
  color: string;
  onSelectDay?: (day: string) => void;
  compact?: boolean;
}

/**
 * The Mon→Sun practice tracker grid.
 *
 * Each cell fills bottom-up in proportion to the share of the daily target
 * that was hit, and a completed day earns a checkmark that springs in with
 * overshoot. That overshoot is deliberate: completion is the moment worth
 * celebrating, and it is the one place in the app where a bouncy spring beats
 * a precise one.
 */
export function WeekGrid({ days, color, onSelectDay, compact = false }: WeekGridProps) {
  return (
    <View style={styles.row}>
      {days.map((cell, index) => (
        <DayCell
          key={cell.day}
          cell={cell}
          index={index}
          color={color}
          compact={compact}
          onPress={onSelectDay ? () => onSelectDay(cell.day) : undefined}
        />
      ))}
    </View>
  );
}

function DayCell({
  cell,
  index,
  color,
  compact,
  onPress,
}: {
  cell: PracticeDayCell;
  index: number;
  color: string;
  compact: boolean;
  onPress?: () => void;
}) {
  const palette = usePalette();
  const fill = useSharedValue(0);
  const check = useSharedValue(cell.met ? 1 : 0);
  const wasMet = useRef(cell.met);

  useEffect(() => {
    fill.value = withDelay(staggerDelay(index), withSpring(cell.progress, spring.chart));
  }, [fill, cell.progress, index]);

  useEffect(() => {
    if (cell.met && !wasMet.current) {
      // Freshly completed: overshoot, settle, and celebrate in the hand.
      check.value = withSequence(withSpring(1.35, spring.bouncy), withSpring(1, spring.standard));
      haptics.celebrate();
    } else if (cell.met) {
      check.value = withDelay(staggerDelay(index), withSpring(1, spring.bouncy));
    } else {
      check.value = withTiming(0, timing.fast);
    }
    wasMet.current = cell.met;
  }, [cell.met, check, index]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${Math.min(1, fill.value) * 100}%`,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: check.value === 0 ? 0 : 1,
    transform: [{ scale: check.value }],
  }));

  const size = compact ? 34 : 44;
  const future = isFuture(cell.day);

  return (
    <View style={styles.cellWrap}>
      <PressableScale
        onPress={onPress}
        disabled={!onPress || future}
        haptic="select"
        hitSlop={2}
        accessibilityLabel={`${cell.day}, ${Math.round(cell.minutes)} minutes${cell.met ? ', target met' : ''}`}
      >
        <View
          style={[
            styles.cell,
            {
              width: size,
              height: size,
              backgroundColor: withAlpha(palette.text, future ? 0.03 : 0.07),
              borderColor: isToday(cell.day) ? withAlpha(color, 0.75) : 'transparent',
              borderWidth: isToday(cell.day) ? 1.5 : 0,
            },
          ]}
        >
          <Animated.View style={[styles.fill, fillStyle]}>
            <LinearGradient
              colors={[withAlpha(color, 0.95), withAlpha(color, 0.55)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.View style={[styles.check, checkStyle]}>
            <Ionicons name="checkmark" size={compact ? 16 : 20} color="#FFFFFF" />
          </Animated.View>
        </View>
      </PressableScale>

      <Text
        style={[
          type.caption,
          {
            color: isToday(cell.day) ? palette.text : palette.textTertiary,
            fontWeight: isToday(cell.day) ? '700' : '500',
            marginTop: 6,
          },
        ]}
      >
        {weekdayLabel(cell.day)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cellWrap: {
    alignItems: 'center',
  },
  cell: {
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
  },
  check: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
