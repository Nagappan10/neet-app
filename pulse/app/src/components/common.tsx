import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { radius, shadow, spacing, type, usePalette, withAlpha } from '@/theme';
import { spring, staggerDelay } from '@/theme/motion';

/* ------------------------------ entrance ---------------------------------- */

/**
 * Wraps children in the app's standard staggered entrance: fade up on a
 * spring, delayed by position. Used by every list and card stack so the whole
 * app enters with one consistent rhythm.
 */
export function FadeInView({
  children,
  index = 0,
  style,
  distance = 18,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  distance?: number;
}) {
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(staggerDelay(index), withSpring(1, spring.standard));
  }, [enter, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * distance }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

/* ------------------------------- section ---------------------------------- */

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[type.eyebrow, { color: palette.textTertiary }]}>{title}</Text>
      {action && onAction ? (
        <PressableScale onPress={onAction} haptic="select" hitSlop={12}>
          <Text style={[type.footnote, { color: palette.walkFrom, fontWeight: '600' }]}>
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/* ------------------------------- buttons ---------------------------------- */

export interface GradientButtonProps {
  label: string;
  onPress: () => void;
  colors: [string, string];
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg';
  haptic?: 'select' | 'tap' | 'impact';
}

export function GradientButton({
  label,
  onPress,
  colors,
  icon,
  disabled,
  style,
  size = 'md',
  haptic = 'tap',
}: GradientButtonProps) {
  const palette = usePalette();
  const large = size === 'lg';

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      large
      style={[shadow(palette, 'md'), style]}
      accessibilityLabel={label}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientButton, large && styles.gradientButtonLarge]}
      >
        {icon ? <Ionicons name={icon} size={large ? 20 : 17} color="#FFFFFF" /> : null}
        <Text style={[large ? type.headline : type.subhead, styles.buttonLabel]}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

/** Low-emphasis action, used beside a gradient primary. */
export function GhostButton({
  label,
  onPress,
  icon,
  tone,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const color = tone ?? palette.text;

  return (
    <PressableScale onPress={onPress} haptic="select" style={style} accessibilityLabel={label}>
      <View
        style={[
          styles.ghostButton,
          { backgroundColor: withAlpha(color, 0.12), borderColor: withAlpha(color, 0.18) },
        ]}
      >
        {icon ? <Ionicons name={icon} size={17} color={color} /> : null}
        <Text style={[type.subhead, { color, fontWeight: '600' }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

/* ------------------------------ empty state -------------------------------- */

export function EmptyState({
  icon,
  title,
  message,
  action,
  onAction,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
  color?: string;
}) {
  const palette = usePalette();
  const tone = color ?? palette.walkFrom;

  return (
    <FadeInView style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: withAlpha(tone, 0.14) }]}>
        <Ionicons name={icon} size={26} color={tone} />
      </View>
      <Text style={[type.title3, { color: palette.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.footnote, { color: palette.textSecondary, textAlign: 'center' }]}>
        {message}
      </Text>
      {action && onAction ? (
        <GhostButton label={action} onPress={onAction} tone={tone} style={{ marginTop: spacing.sm }} />
      ) : null}
    </FadeInView>
  );
}

/* -------------------------------- divider ---------------------------------- */

export function Divider({ inset = 0 }: { inset?: number }) {
  const palette = usePalette();
  return (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.separator, marginLeft: inset }} />
  );
}

/** Small rounded icon badge, tinted to an activity or section colour. */
export function IconBadge({
  icon,
  color,
  size = 40,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.iconBadge,
        {
          width: size,
          height: size,
          borderRadius: size / 3,
          backgroundColor: withAlpha(color, 0.16),
          borderColor: withAlpha(color, 0.24),
        },
      ]}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  gradientButtonLarge: {
    paddingVertical: 17,
    borderRadius: radius.card,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
