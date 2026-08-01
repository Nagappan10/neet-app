import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { GlassCard } from '@/components/GlassCard';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { StreakFlame } from '@/components/StreakFlame';
import { WeekGrid } from '@/components/WeekGrid';
import { encodeRect, useMeasuredPress, type HeroRect } from '@/components/SharedHero';
import { DeltaChip } from '@/components/StatTile';
import { EmptyState, FadeInView, IconBadge, SectionHeader } from '@/components/common';
import { usePracticeStore } from '@/store/usePracticeStore';
import { spacing, type, usePalette, withAlpha } from '@/theme';
import type { PracticeActivity, PracticeWeeklyStats } from '@/types';
import { friendlyDate } from '@/utils/date';
import { formatMinutes } from '@/utils/format';

/**
 * All-activities overview: every activity's week at a glance, plus the running
 * timer surfaced at the top so it is reachable from anywhere in the tab.
 */
export default function PracticeScreen() {
  const palette = usePalette();
  const router = useRouter();

  const { activities, stats, loading, load, timer, timerElapsedMs, stopTimer } =
    usePracticeStore();

  useEffect(() => {
    void load();
  }, [load]);

  const openActivity = useCallback(
    (id: string, rect: HeroRect) => router.push(`/practice/${id}?rect=${encodeRect(rect)}`),
    [router],
  );

  const timedActivity = timer ? activities.find((a) => a.id === timer.activityId) : undefined;

  return (
    <Screen
      title="Practice"
      subtitle={friendlyDate(new Date().toISOString().slice(0, 10))}
      accent="practice"
      onRefresh={load}
      headerRight={
        <PressableScale
          onPress={() => router.push('/practice/edit')}
          haptic="tap"
          accessibilityLabel="New activity"
        >
          <View style={[styles.addButton, { backgroundColor: withAlpha(palette.practiceFrom, 0.18) }]}>
            <Ionicons name="add" size={22} color={palette.practiceFrom} />
          </View>
        </PressableScale>
      }
    >
      {timedActivity ? (
        <FadeInView>
          <GlassCard tint={timedActivity.color} intensity="strong">
            <View style={styles.timerBanner}>
              <IconBadge icon={timedActivity.icon as never} color={timedActivity.color} size={38} />
              <View style={styles.timerBannerBody}>
                <Text style={[type.caption, { color: palette.textTertiary }]}>
                  {timer?.running ? 'RECORDING' : 'PAUSED'}
                </Text>
                <Text style={[type.headline, { color: palette.text }]}>{timedActivity.name}</Text>
              </View>
              <AnimatedNumber
                value={timerElapsedMs / 60_000}
                decimals={1}
                suffix="m"
                style={type.title2}
                color={timedActivity.color}
              />
              <PressableScale
                onPress={() => void stopTimer()}
                haptic="impact"
                accessibilityLabel="Stop timer"
              >
                <View style={[styles.stopButton, { backgroundColor: withAlpha(palette.danger, 0.18) }]}>
                  <Ionicons name="stop" size={16} color={palette.danger} />
                </View>
              </PressableScale>
            </View>
          </GlassCard>
        </FadeInView>
      ) : null}

      {loading ? null : activities.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon="sparkles"
            title="No activities yet"
            message="Add something you want to practise daily — aim training, guitar, typing, anything with a target."
            action="Create your first activity"
            onAction={() => router.push('/practice/edit')}
            color={palette.practiceFrom}
          />
        </GlassCard>
      ) : (
        <>
          <SectionHeader title="This week" />
          {activities.map((activity, index) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              stats={stats[activity.id]}
              index={index}
              onOpen={(rect) => openActivity(activity.id, rect)}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

function ActivityCard({
  activity,
  stats,
  index,
  onOpen,
}: {
  activity: PracticeActivity;
  stats?: PracticeWeeklyStats;
  index: number;
  onOpen: (rect: HeroRect) => void;
}) {
  const palette = usePalette();
  const { ref, handlePress } = useMeasuredPress(onOpen);

  return (
    <FadeInView index={index}>
      <View ref={ref} collapsable={false}>
        <PressableScale
          onPress={handlePress}
          large
          haptic="select"
          accessibilityLabel={`${activity.name}, ${stats?.daysCompleted ?? 0} of 7 days complete`}
        >
          <GlassCard tint={activity.color}>
            <View style={styles.cardHead}>
              <IconBadge icon={activity.icon as never} color={activity.color} />

              <View style={styles.cardTitle}>
                <Text style={[type.headline, { color: palette.text }]} numberOfLines={1}>
                  {activity.name}
                </Text>
                <Text style={[type.footnote, { color: palette.textSecondary }]}>
                  {activity.targetMinutes} min daily target
                </Text>
              </View>

              <StreakFlame days={stats?.streak ?? 0} color={activity.color} compact />
              <Ionicons name="chevron-forward" size={16} color={palette.textTertiary} />
            </View>

            {stats ? (
              <>
                <View style={styles.gridWrap}>
                  <WeekGrid days={stats.days} color={activity.color} compact />
                </View>

                <View style={[styles.cardFooter, { borderTopColor: palette.separator }]}>
                  <Footer
                    label="This week"
                    value={formatMinutes(stats.totalMinutes)}
                    color={activity.color}
                  />
                  <Footer label="Daily avg" value={`${stats.dailyAverage}m`} />
                  <Footer label="Completed" value={`${stats.daysCompleted}/7`} />
                  <View style={styles.footerCell}>
                    <Text style={[type.caption, { color: palette.textTertiary }]}>vs last week</Text>
                    <DeltaChip delta={stats.deltaVsPreviousPct} />
                  </View>
                </View>
              </>
            ) : null}
          </GlassCard>
        </PressableScale>
      </View>
    </FadeInView>
  );
}

function Footer({ label, value, color }: { label: string; value: string; color?: string }) {
  const palette = usePalette();
  return (
    <View style={styles.footerCell}>
      <Text style={[type.caption, { color: palette.textTertiary }]}>{label}</Text>
      <Text style={[type.subhead, { color: color ?? palette.text, fontWeight: '700' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timerBannerBody: {
    flex: 1,
  },
  stopButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardTitle: {
    flex: 1,
    gap: 1,
  },
  gridWrap: {
    marginTop: spacing.base,
  },
  cardFooter: {
    flexDirection: 'row',
    marginTop: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerCell: {
    flex: 1,
    gap: 2,
  },
});
