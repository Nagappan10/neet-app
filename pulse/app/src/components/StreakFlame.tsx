import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { radius, type, usePalette, withAlpha } from '@/theme';
import { spring } from '@/theme/motion';

export interface StreakFlameProps {
  days: number;
  color?: string;
  compact?: boolean;
}

/**
 * Streak indicator. A live streak gets a flame that breathes on a slow loop —
 * enough motion to read as "burning", not enough to distract. At zero the
 * flame goes cold and static, so an unlit streak never competes for attention.
 */
export function StreakFlame({ days, color, compact = false }: StreakFlameProps) {
  const palette = usePalette();
  const tone = color ?? palette.flame;
  const active = days > 0;

  const breathe = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (active) {
      breathe.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
    } else {
      breathe.value = withTiming(0, { duration: 200 });
    }
  }, [active, breathe]);

  // Punch the badge whenever the streak count itself changes.
  useEffect(() => {
    if (active) {
      pop.value = withSequence(withSpring(1.18, spring.bouncy), withSpring(1, spring.standard));
    }
  }, [days, active, pop]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.12 }, { rotate: `${(breathe.value - 0.5) * 5}deg` }],
    opacity: active ? 0.85 + breathe.value * 0.15 : 0.35,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        compact && styles.compact,
        {
          backgroundColor: active ? withAlpha(tone, 0.16) : withAlpha(palette.text, 0.06),
          borderColor: active ? withAlpha(tone, 0.3) : 'transparent',
        },
        containerStyle,
      ]}
      accessibilityLabel={`${days} day streak`}
    >
      <Animated.View style={flameStyle}>
        <Ionicons name="flame" size={compact ? 13 : 16} color={active ? tone : palette.textTertiary} />
      </Animated.View>
      <Text
        style={[
          compact ? type.caption : type.subhead,
          { color: active ? tone : palette.textTertiary, fontWeight: '700' },
        ]}
      >
        {days}
      </Text>
      {!compact ? (
        <Text style={[type.caption, { color: palette.textTertiary }]}>
          {days === 1 ? 'day' : 'days'}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  compact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
});
