import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from './GlassCard';
import { GhostButton, GradientButton } from './common';
import { radius, spacing, type, usePalette, withAlpha } from '@/theme';
import { spring } from '@/theme/motion';
import { useStepsStore } from '@/store/useStepsStore';

/**
 * Motion permission screen.
 *
 * Shown instead of the tracker whenever we cannot count steps, and it says
 * *why* we need the sensor before asking — a permission prompt with no
 * preceding explanation is the single most common cause of a hard denial, and
 * on iOS motion access cannot be re-requested in-app once refused.
 */
export function PermissionGate() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { permission, available, checking, requestAccess } = useStepsStore();

  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800 }), -1, true);
  }, [pulse]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 - pulse.value * 0.25,
    transform: [{ scale: 1 + pulse.value * 0.35 }],
  }));

  if (checking) return null;

  const denied = permission === 'denied';
  const unsupported = !available;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xxl }]}>
      <View style={styles.iconStack}>
        <Animated.View
          style={[styles.ring, { backgroundColor: withAlpha(palette.walkFrom, 0.5) }, ringStyle]}
        />
        <Animated.View style={iconStyle}>
          <LinearGradient
            colors={[palette.walkFrom, palette.walkTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBadge}
          >
            <Ionicons name={unsupported ? 'alert-circle' : 'walk'} size={40} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
      </View>

      <Text style={[type.title1, styles.centered, { color: palette.text }]}>
        {unsupported
          ? 'No step sensor found'
          : denied
            ? 'Motion access is off'
            : 'Let Pulse count your steps'}
      </Text>

      <Text style={[type.callout, styles.centered, { color: palette.textSecondary }]}>
        {unsupported
          ? 'This device has no hardware pedometer, so Pulse cannot track steps. Practice tracking still works fully.'
          : denied
            ? `Pulse needs motion access to read the ${Platform.OS === 'ios' ? 'motion & fitness' : 'physical activity'} sensor. Turn it on in Settings and come back.`
            : 'Pulse reads your device’s built-in pedometer — the same sensor the Health app uses. Nothing leaves your device unless you turn on sync.'}
      </Text>

      <GlassCard style={styles.card} padding={spacing.base}>
        <Reason
          icon="hardware-chip"
          title="Hardware accurate"
          body="Steps come from the motion coprocessor, not from guessing at accelerometer wobble."
        />
        <View style={[styles.divider, { backgroundColor: palette.separator }]} />
        <Reason
          icon="battery-charging"
          title="Barely any battery"
          body="The sensor counts in dedicated low-power silicon whether or not Pulse is running."
        />
        <View style={[styles.divider, { backgroundColor: palette.separator }]} />
        <Reason
          icon="lock-closed"
          title="Stays on your device"
          body="Everything is stored in a local database. Cloud sync is off until you enable it."
        />
      </GlassCard>

      {unsupported ? null : denied ? (
        <GhostButton
          label="Open Settings"
          icon="settings-outline"
          onPress={() => void Linking.openSettings()}
          style={styles.action}
        />
      ) : (
        <GradientButton
          label="Enable step tracking"
          icon="walk"
          size="lg"
          haptic="impact"
          colors={[palette.walkFrom, palette.walkTo]}
          onPress={() => void requestAccess()}
          style={styles.action}
        />
      )}
    </View>
  );
}

function Reason({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const palette = usePalette();
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withSequence(withTiming(0, { duration: 0 }), withSpring(1, spring.standard));
  }, [enter]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * 12 }],
  }));

  return (
    <Animated.View style={[styles.reason, style]}>
      <Ionicons name={icon} size={18} color={palette.walkFrom} style={styles.reasonIcon} />
      <View style={styles.reasonText}>
        <Text style={[type.subhead, { color: palette.text, fontWeight: '600' }]}>{title}</Text>
        <Text style={[type.footnote, { color: palette.textSecondary }]}>{body}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.base,
  },
  iconStack: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  ring: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  iconBadge: {
    width: 88,
    height: 88,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  card: {
    width: '100%',
    marginTop: spacing.sm,
  },
  reason: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  reasonIcon: {
    marginTop: 2,
  },
  reasonText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 30,
  },
  action: {
    width: '100%',
    marginTop: spacing.sm,
    borderRadius: radius.card,
  },
});
