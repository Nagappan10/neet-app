import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { GlassCard } from '@/components/GlassCard';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { StatTile } from '@/components/StatTile';
import { GhostButton, SectionHeader } from '@/components/common';
import { HeroFollow, SharedHero, decodeRect } from '@/components/SharedHero';
import { deleteSession, getSession } from '@/db/walking';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useStepsStore } from '@/store/useStepsStore';
import { spacing, type, usePalette, withAlpha } from '@/theme';
import type { WalkingSession } from '@/types';
import { friendlyDate } from '@/utils/date';
import { formatDistance, formatDuration, formatDurationShort } from '@/utils/format';

export default function SessionDetailScreen() {
  const palette = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; rect?: string }>();

  const dailyGoal = useSettingsStore((s) => s.dailyGoal);
  const refreshSteps = useStepsStore((s) => s.refresh);

  const [session, setSession] = useState<WalkingSession | null>(null);
  const [loading, setLoading] = useState(true);

  // The rect the tapped row occupied, so the hero can start exactly there.
  const origin = decodeRect(params.rect);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await getSession(params.id);
      if (!cancelled) {
        setSession(found);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleDelete = useCallback(async () => {
    if (!session) return;
    await deleteSession(session.id);
    await refreshSteps();
    router.back();
  }, [session, refreshSteps, router]);

  if (loading) return <Screen title="Session" accent="walk"><View /></Screen>;

  if (!session) {
    return (
      <Screen title="Session" accent="walk" headerRight={<CloseButton onPress={router.back} />}>
        <GlassCard>
          <Text style={[type.body, { color: palette.textSecondary }]}>
            This session no longer exists.
          </Text>
        </GlassCard>
      </Screen>
    );
  }

  const startTime = new Date(session.startedAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const endTime = session.endedAt
    ? new Date(session.endedAt).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

  return (
    <Screen
      title={friendlyDate(session.day)}
      subtitle="Walking session"
      accent="walk"
      headerRight={<CloseButton onPress={router.back} />}
    >
      <SharedHero origin={origin}>
        <GlassCard>
          <View style={styles.heroRow}>
            <ProgressRing
              progress={dailyGoal > 0 ? session.steps / dailyGoal : 0}
              size={132}
              strokeWidth={12}
              colors={[palette.walkFrom, palette.walkTo]}
            >
              <View style={styles.ringCenter}>
                <AnimatedNumber value={session.steps} style={type.title2} color={palette.text} />
                <Text style={[type.caption, { color: palette.textTertiary }]}>steps</Text>
              </View>
            </ProgressRing>

            <View style={styles.heroStats}>
              <Text style={[type.eyebrow, { color: palette.textTertiary }]}>Duration</Text>
              <Text style={[type.display, styles.duration, { color: palette.text }]}>
                {formatDuration(session.durationMs)}
              </Text>
              <Text style={[type.footnote, { color: palette.textSecondary }]}>
                {startTime} → {endTime}
              </Text>
            </View>
          </View>
        </GlassCard>
      </SharedHero>

      <HeroFollow>
        <SectionHeader title="Breakdown" />
        <GlassCard>
          <View style={styles.grid}>
            <StatTile
              label="Distance"
              value={session.distanceM / 1000}
              decimals={2}
              unit="km"
              icon="map"
              index={0}
              style={styles.cell}
            />
            <StatTile
              label="Calories"
              value={session.calories}
              unit="kcal"
              icon="flame"
              index={1}
              style={styles.cell}
            />
            <StatTile
              label="Average pace"
              value={session.avgPace}
              unit="spm"
              icon="speedometer"
              index={2}
              style={styles.cell}
            />
            <StatTile
              label="Active time"
              text={formatDurationShort(session.durationMs)}
              icon="time"
              index={3}
              style={styles.cell}
            />
            <StatTile
              label="Metres / step"
              value={session.steps > 0 ? session.distanceM / session.steps : 0}
              decimals={2}
              unit="m"
              icon="resize"
              index={4}
              style={styles.cell}
            />
            <StatTile
              label="Distance"
              text={formatDistance(session.distanceM)}
              unit="km total"
              icon="navigate"
              index={5}
              style={styles.cell}
            />
          </View>
        </GlassCard>

        <View style={{ height: spacing.base }} />

        <GhostButton
          label="Delete session"
          icon="trash"
          tone={palette.danger}
          onPress={() => void handleDelete()}
        />
      </HeroFollow>
    </Screen>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const palette = usePalette();
  return (
    <GhostButton
      label=""
      icon="close"
      onPress={onPress}
      tone={palette.text}
      style={[styles.close, { backgroundColor: withAlpha(palette.text, 0.08) }]}
    />
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  ringCenter: {
    alignItems: 'center',
  },
  heroStats: {
    flex: 1,
    gap: 2,
  },
  duration: {
    fontSize: 32,
    lineHeight: 36,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  cell: {
    width: '50%',
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
});
