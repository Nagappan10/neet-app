import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { GlassCard } from '@/components/GlassCard';
import { PermissionGate } from '@/components/PermissionGate';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { StatTile } from '@/components/StatTile';
import { StreakFlame } from '@/components/StreakFlame';
import { FadeInView, GhostButton, GradientButton, SectionHeader } from '@/components/common';
import { haptics } from '@/services/haptics';
import { sessionMetrics, useSessionStore } from '@/store/useSessionStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useStepsStore } from '@/store/useStepsStore';
import { spacing, type, usePalette, withAlpha } from '@/theme';
import { spring } from '@/theme/motion';
import { formatDistance, formatDuration, formatDurationShort } from '@/utils/format';

const KEEP_AWAKE_TAG = 'pulse-session';

export default function WalkScreen() {
  const palette = usePalette();
  const router = useRouter();

  const { permission, available, checking, today, week, refresh, startDailyTracking } =
    useStepsStore();
  const { dailyGoal, strideLength, weightKg } = useSettingsStore();
  const session = useSessionStore();
  const configure = useSessionStore((s) => s.configure);

  const gradient: [string, string] = [palette.walkFrom, palette.walkTo];

  // Keep the screen on during a session — a walk tracker that sleeps mid-walk
  // is useless, and the OS would otherwise dim after 30 seconds of no touches.
  // `useKeepAwake` holds the lock for the component's whole lifetime, so the
  // lock has to be taken and released explicitly as the session starts and stops.
  useEffect(() => {
    if (session.status !== 'active') return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [session.status]);

  // `configure` is a stable store action, so this runs only when the user
  // actually changes their stride or weight — not on every session tick.
  useEffect(() => {
    configure({ strideLength, weightKg });
  }, [configure, strideLength, weightKg]);

  // Ambient daily counting runs for as long as this screen is mounted.
  useEffect(() => {
    if (permission !== 'granted' || !available) return;
    return startDailyTracking();
  }, [permission, available, startDailyTracking]);

  if (checking) return <View style={styles.flex} />;
  if (permission !== 'granted' || !available) return <PermissionGate />;

  const live = session.status !== 'idle';

  // During a session the ring tracks the session; otherwise it tracks the day.
  const ringSteps = live ? session.steps : (today?.steps ?? 0);
  const progress = dailyGoal > 0 ? (today?.steps ?? 0) / dailyGoal : 0;
  const sessionProgress = dailyGoal > 0 ? session.steps / dailyGoal : 0;

  const metrics = sessionMetrics(session.steps, session.elapsedMs, strideLength, weightKg);

  return (
    <Screen
      title={live ? 'Session' : 'Today'}
      subtitle={live ? undefined : new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      accent="walk"
      onRefresh={refresh}
      headerRight={week ? <StreakFlame days={week.streak} /> : undefined}
    >
      <FadeInView>
        <View style={styles.ringWrap}>
          <PulsingRing active={session.status === 'active'} color={palette.walkFrom}>
            <ProgressRing
              progress={live ? sessionProgress : progress}
              size={268}
              strokeWidth={20}
              colors={gradient}
              gapDegrees={0}
            >
              <View style={styles.ringCenter}>
                <Text style={[type.eyebrow, { color: palette.textTertiary }]}>
                  {live ? 'Session steps' : 'Steps'}
                </Text>
                <AnimatedNumber
                  value={ringSteps}
                  style={type.hero}
                  config={spring.gentle}
                  color={palette.text}
                />
                {live ? (
                  <Text style={[type.mono, styles.timer, { color: palette.textSecondary }]}>
                    {formatDuration(session.elapsedMs)}
                  </Text>
                ) : (
                  <Text style={[type.footnote, { color: palette.textSecondary }]}>
                    of {dailyGoal.toLocaleString()} goal
                  </Text>
                )}
              </View>
            </ProgressRing>
          </PulsingRing>
        </View>
      </FadeInView>

      {live ? (
        <LiveMetrics
          steps={session.steps}
          distanceM={metrics.distanceM}
          calories={metrics.calories}
          currentPace={session.currentPace}
          avgPace={metrics.avgPace}
          paused={session.status === 'paused'}
        />
      ) : (
        <TodaySummary
          steps={today?.steps ?? 0}
          distanceM={today?.distanceM ?? 0}
          calories={today?.calories ?? 0}
          activeMs={today?.activeMs ?? 0}
          goal={dailyGoal}
        />
      )}

      <SessionControls
        status={session.status}
        colors={gradient}
        onStart={session.start}
        onPause={session.pause}
        onResume={session.resume}
        onStop={async () => {
          const saved = await session.stop();
          await refresh();
          if (saved) router.push(`/session/${saved.id}`);
        }}
      />

      {!live && week ? (
        <FadeInView index={3}>
          <SectionHeader title="This week" action="See all" onAction={() => router.push('/stats')} />
          <GlassCard>
            <View style={styles.weekRow}>
              <StatTile
                label="Total"
                value={week.totalSteps}
                icon="footsteps"
                color={palette.walkFrom}
                index={0}
                style={styles.metricCell}
              />
              <StatTile
                label="Daily avg"
                value={week.dailyAverage}
                icon="analytics"
                index={1}
                style={styles.metricCell}
              />
              <StatTile
                label="Distance"
                text={formatDistance(week.totalDistanceM)}
                unit="km"
                icon="map"
                index={2}
                style={styles.metricCell}
              />
              <StatTile
                label="Time"
                text={formatDurationShort(week.totalActiveMs)}
                icon="time"
                index={3}
                style={styles.metricCell}
              />
            </View>
          </GlassCard>
        </FadeInView>
      ) : null}
    </Screen>
  );
}

/* ------------------------------- live metrics ----------------------------- */

function LiveMetrics({
  steps,
  distanceM,
  calories,
  currentPace,
  avgPace,
  paused,
}: {
  steps: number;
  distanceM: number;
  calories: number;
  currentPace: number;
  avgPace: number;
  paused: boolean;
}) {
  const palette = usePalette();

  return (
    <FadeInView index={1}>
      <GlassCard tint={paused ? palette.warning : undefined}>
        {paused ? (
          <View style={styles.pausedBanner}>
            <Ionicons name="pause-circle" size={15} color={palette.warning} />
            <Text style={[type.caption, { color: palette.warning, fontWeight: '700' }]}>
              PAUSED — steps are not being counted
            </Text>
          </View>
        ) : null}

        <View style={styles.metricGrid}>
          <StatTile
            label="Distance"
            value={distanceM / 1000}
            decimals={2}
            unit="km"
            icon="map"
            index={0}
            style={styles.metricCell}
          />
          <StatTile
            label="Calories"
            value={calories}
            unit="kcal"
            icon="flame"
            index={1}
            style={styles.metricCell}
          />
          <StatTile
            label="Current pace"
            value={currentPace}
            unit="spm"
            icon="speedometer"
            index={2}
            color={currentPace > 0 ? palette.walkFrom : palette.textTertiary}
            style={styles.metricCell}
          />
          <StatTile
            label="Average pace"
            value={avgPace}
            unit="spm"
            icon="trending-up"
            index={3}
            style={styles.metricCell}
          />
        </View>
      </GlassCard>
    </FadeInView>
  );
}

function TodaySummary({
  steps,
  distanceM,
  calories,
  activeMs,
  goal,
}: {
  steps: number;
  distanceM: number;
  calories: number;
  activeMs: number;
  goal: number;
}) {
  const palette = usePalette();
  const remaining = Math.max(0, goal - steps);

  return (
    <FadeInView index={1}>
      <GlassCard>
        <View style={styles.metricGrid}>
          <StatTile
            label="Distance"
            value={distanceM / 1000}
            decimals={2}
            unit="km"
            icon="map"
            index={0}
            style={styles.metricCell}
          />
          <StatTile
            label="Calories"
            value={calories}
            unit="kcal"
            icon="flame"
            index={1}
            style={styles.metricCell}
          />
          <StatTile
            label="Active time"
            text={formatDurationShort(activeMs)}
            icon="time"
            index={2}
            style={styles.metricCell}
          />
          <StatTile
            label={remaining > 0 ? 'To goal' : 'Goal met'}
            value={remaining > 0 ? remaining : steps - goal}
            unit={remaining > 0 ? 'steps' : 'over'}
            icon={remaining > 0 ? 'flag' : 'checkmark-circle'}
            color={remaining > 0 ? undefined : palette.success}
            index={3}
            style={styles.metricCell}
          />
        </View>
      </GlassCard>
    </FadeInView>
  );
}

/* -------------------------------- controls -------------------------------- */

function SessionControls({
  status,
  colors,
  onStart,
  onPause,
  onResume,
  onStop,
}: {
  status: 'idle' | 'active' | 'paused';
  colors: [string, string];
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => Promise<void>;
}) {
  const palette = usePalette();
  const [stopping, setStopping] = useState(false);

  const handleStop = useCallback(async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await onStop();
    } finally {
      setStopping(false);
    }
  }, [onStop, stopping]);

  if (status === 'idle') {
    return (
      <FadeInView index={2}>
        <GradientButton
          label="Start walking"
          icon="play"
          size="lg"
          haptic="impact"
          colors={colors}
          onPress={onStart}
        />
      </FadeInView>
    );
  }

  return (
    <FadeInView index={2}>
      <View style={styles.controlRow}>
        {status === 'active' ? (
          <GhostButton label="Pause" icon="pause" onPress={onPause} style={styles.controlItem} />
        ) : (
          <GradientButton
            label="Resume"
            icon="play"
            colors={colors}
            onPress={onResume}
            style={styles.controlItem}
          />
        )}
        <GhostButton
          label={stopping ? 'Saving…' : 'Stop'}
          icon="stop"
          tone={palette.danger}
          onPress={() => void handleStop()}
          style={styles.controlItem}
        />
      </View>
    </FadeInView>
  );
}

/**
 * A slow halo behind the ring while a session runs. It is the only thing on
 * the screen that moves continuously, which is exactly what makes "recording"
 * legible at a glance.
 */
function PulsingRing({
  active,
  color,
  children,
}: {
  active: boolean;
  color: string;
  children: React.ReactNode;
}) {
  const pulse = useSharedValue(0);
  const wasActive = useRef(active);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(withTiming(1, { duration: 2200 }), -1, true);
      if (!wasActive.current) haptics.tick();
    } else {
      pulse.value = withSequence(withSpring(0, spring.standard));
    }
    wasActive.current = active;
  }, [active, pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.4,
    transform: [{ scale: 0.94 + pulse.value * 0.12 }],
  }));

  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.pulseHalo, { backgroundColor: withAlpha(color, 0.35) }, style]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ringWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pulseWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseHalo: {
    position: 'absolute',
    width: 268,
    height: 268,
    borderRadius: 134,
  },
  ringCenter: {
    alignItems: 'center',
    gap: 2,
  },
  timer: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 2,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  metricCell: {
    width: '50%',
  },
  weekRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.base,
  },
  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  controlRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  controlItem: {
    flex: 1,
  },
});
