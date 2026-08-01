import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { haptics } from '@/services/haptics';
import { PRESS_SCALE, PRESS_SCALE_LARGE, spring } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type HapticStyle = 'select' | 'tap' | 'impact' | 'none';

export interface PressableScaleProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Large surfaces travel less, or the press reads as rubbery. */
  large?: boolean;
  haptic?: HapticStyle;
  /** Dim slightly on press, in addition to scaling. */
  dim?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  hitSlop?: number;
}

/**
 * The app's universal press target: scales down on a spring and fires a haptic
 * the instant the finger lands — not on release. Feedback that waits for
 * `onPress` always feels a beat late.
 *
 * The scale runs entirely on the UI thread, so it stays smooth even when the
 * press handler kicks off a database write.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  disabled = false,
  large = false,
  haptic = 'select',
  dim = false,
  accessibilityLabel,
  accessibilityHint,
  hitSlop = 8,
}: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const target = large ? PRESS_SCALE_LARGE : PRESS_SCALE;
    return {
      transform: [{ scale: 1 - pressed.value * (1 - target) }],
      opacity: dim ? 1 - pressed.value * 0.25 : 1,
    };
  });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => {
        pressed.value = withSpring(1, spring.snappy);
        if (haptic !== 'none') haptics[haptic]();
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, spring.snappy);
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[{ opacity: disabled ? 0.4 : 1 }, animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}
