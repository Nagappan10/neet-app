import { useEffect } from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';
import { spring } from '@/theme/motion';
import { usePalette } from '@/theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Worklet-safe number formatting.
 *
 * `Number.prototype.toLocaleString` is not available on the UI thread, so
 * thousands separators are inserted by hand. Doing this in a worklet is what
 * lets the counter update per-frame without a JS round trip.
 */
function formatWorklet(value: number, decimals: number, separator: boolean): string {
  'worklet';
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart = '0', fracPart] = fixed.split('.');

  let withSeparators = intPart;
  if (separator && intPart.length > 3) {
    withSeparators = '';
    for (let i = 0; i < intPart.length; i += 1) {
      const fromEnd = intPart.length - i;
      withSeparators += intPart[i];
      if (fromEnd > 1 && fromEnd % 3 === 1) withSeparators += ',';
    }
  }

  const sign = value < 0 ? '-' : '';
  return fracPart ? `${sign}${withSeparators}.${fracPart}` : `${sign}${withSeparators}`;
}

export interface AnimatedNumberProps {
  value: number;
  style?: StyleProp<TextStyle>;
  decimals?: number;
  /** Insert thousands separators. Off for values that are never large. */
  separator?: boolean;
  prefix?: string;
  suffix?: string;
  config?: WithSpringConfig;
  color?: string;
}

/**
 * A number that springs to its new value instead of snapping.
 *
 * Implemented as an uneditable `TextInput` because its `text` prop can be
 * driven from `useAnimatedProps` — a `<Text>` child would require a JS render
 * per frame. The value lives in a shared value and is formatted inside a
 * worklet, so the whole count-up runs on the UI thread at display refresh rate.
 */
export function AnimatedNumber({
  value,
  style,
  decimals = 0,
  separator = true,
  prefix = '',
  suffix = '',
  config = spring.gentle,
  color,
}: AnimatedNumberProps) {
  const palette = usePalette();
  const animated = useSharedValue(value);

  useEffect(() => {
    animated.value = withSpring(value, config);
  }, [animated, value, config]);

  const animatedProps = useAnimatedProps(() => ({
    text: `${prefix}${formatWorklet(animated.value, decimals, separator)}${suffix}`,
    defaultValue: `${prefix}${formatWorklet(animated.value, decimals, separator)}${suffix}`,
  }));

  return (
    <AnimatedTextInput
      editable={false}
      // The value is presentational; expose it to screen readers as text.
      accessibilityRole="text"
      accessibilityLabel={`${prefix}${value.toFixed(decimals)}${suffix}`}
      underlineColorAndroid="transparent"
      style={[styles.input, { color: color ?? palette.text }, style]}
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 0,
    margin: 0,
    // TextInput reserves vertical space for a cursor on Android; strip it so
    // the number sits on the same baseline as neighbouring <Text>.
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
