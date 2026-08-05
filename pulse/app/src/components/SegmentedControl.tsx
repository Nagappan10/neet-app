import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { radius, spacing, type, usePalette, withAlpha } from '@/theme';
import { spring } from '@/theme/motion';

export interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  color?: string;
}

/**
 * Segmented control with a thumb that slides between options on a spring.
 * Like the tab bar, one moving thumb beats N cross-fading backgrounds — it
 * gives the control a sense of physical continuity.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  color,
}: SegmentedControlProps<T>) {
  const palette = usePalette();
  const [trackWidth, setTrackWidth] = useState(0);

  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segmentWidth = trackWidth > 0 ? (trackWidth - 4) / options.length : 0;

  const x = useSharedValue(0);

  useEffect(() => {
    if (segmentWidth > 0) x.value = withSpring(index * segmentWidth, spring.standard);
  }, [x, index, segmentWidth]);

  const thumbStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: x.value }],
  }));

  return (
    <View
      style={[styles.track, { backgroundColor: withAlpha(palette.text, 0.07) }]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            backgroundColor: color ? withAlpha(color, 0.26) : palette.glassStrong,
            borderColor: palette.glassHighlight,
          },
          thumbStyle,
        ]}
      />

      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            style={styles.segment}
            haptic="select"
            hitSlop={0}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            accessibilityLabel={option.label}
          >
            <Text
              numberOfLines={1}
              style={[
                type.subhead,
                {
                  color: selected ? palette.text : palette.textSecondary,
                  fontWeight: selected ? '700' : '500',
                },
              ]}
            >
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 2,
  },
  thumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: radius.md - 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
});
