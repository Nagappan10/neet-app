import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { AnimatedNumber } from './AnimatedNumber';
import { spacing, type, usePalette, withAlpha } from '@/theme';
import { spring, staggerDelay } from '@/theme/motion';

export interface StatTileProps {
  label: string;
  /** Pass `value` for a count-up, or `text` for something non-numeric. */
  value?: number;
  text?: string;
  unit?: string;
  decimals?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  /** Position in a list, for the staggered entrance. */
  index?: number;
  style?: StyleProp<ViewStyle>;
  /** Small trailing delta chip, e.g. "+12%" against last week. */
  delta?: number | null;
}

/** A single labelled metric. The building block of every summary card. */
export function StatTile({
  label,
  value,
  text,
  unit,
  decimals = 0,
  icon,
  color,
  index = 0,
  style,
  delta,
}: StatTileProps) {
  const palette = usePalette();
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(staggerDelay(index), withSpring(1, spring.standard));
  }, [enter, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }],
  }));

  const accent = color ?? palette.text;

  return (
    <Animated.View style={[styles.tile, animatedStyle, style]}>
      <View style={styles.labelRow}>
        {icon ? <Ionicons name={icon} size={12} color={palette.textTertiary} /> : null}
        <Text style={[type.statLabel, { color: palette.textTertiary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <View style={styles.valueRow}>
        {value !== undefined ? (
          <AnimatedNumber value={value} decimals={decimals} style={type.statValue} color={accent} />
        ) : (
          <Text style={[type.statValue, { color: accent }]} numberOfLines={1}>
            {text ?? '—'}
          </Text>
        )}
        {unit ? (
          <Text style={[type.footnote, styles.unit, { color: palette.textTertiary }]}>{unit}</Text>
        ) : null}
      </View>

      {delta !== undefined ? <DeltaChip delta={delta} /> : null}
    </Animated.View>
  );
}

/** Green up / red down comparison chip. */
export function DeltaChip({ delta }: { delta: number | null }) {
  const palette = usePalette();

  if (delta === null || !Number.isFinite(delta)) {
    return <Text style={[type.caption, { color: palette.textTertiary }]}>No prior data</Text>;
  }

  const positive = delta >= 0;
  const tone = positive ? palette.success : palette.danger;

  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(tone, 0.16) }]}>
      <Ionicons name={positive ? 'arrow-up' : 'arrow-down'} size={10} color={tone} />
      <Text style={[type.caption, { color: tone, fontWeight: '700' }]}>
        {Math.abs(delta).toFixed(0)}%
      </Text>
    </View>
  );
}

/** Lays tiles out on a two-per-row grid with consistent gutters. */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  tile: {
    minWidth: 96,
    gap: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  unit: {
    fontWeight: '600',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
    columnGap: spacing.base,
  },
});
