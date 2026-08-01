import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { BarChart } from '@/components/BarChart';
import { GlassCard } from '@/components/GlassCard';
import { HeatmapCalendar } from '@/components/HeatmapCalendar';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { DeltaChip, StatTile } from '@/components/StatTile';
import { StreakFlame } from '@/components/StreakFlame';
import { Divider, EmptyState, FadeInView, SectionHeader } from '@/components/common';
import { encodeRect, useMeasuredPress } from '@/components/SharedHero';
import { listSessions } from '@/db/walking';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useStepsStore } from '@/store/useStepsStore';
import { radius, spacing, type, usePalette, withAlpha } from '@/theme';
import type { DayStats, WalkingSession } from '@/types';
import { addDays, addMonths, friendlyDate, monthLabel, startOfWeek, toDayKey } from '@/utils/date';
import { formatDistance, formatDurationShort, formatSteps } from '@/utils/format';

type Range = 'week' | 'month';

export default function StatsScreen() {
  const palette = usePalette();
  const router = useRouter();

  const { week, month, monthKey, weekStart, refresh, loadMonth, setWeekStart } = useStepsStore();
  const dailyGoal = useSettingsStore((s) => s.dailyGoal);

  const [range, setRange] = useState<Range>('week');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [sessions, setSessions] = useState<WalkingSession[]>([]);

  const loadSessions = useCallback(async () => {
    setSessions(await listSessions(40));
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const onRefresh = useCallback(async () => {
    await refresh();
    await loadSessions();
  }, [refresh, loadSessions]);

  const selected = useMemo(() => {
    if (!selectedDay) return null;
    return (
      week?.days.find((d) => d.day === selectedDay) ??
      month.find((d) => d.day === selectedDay) ??
      null
    );
  }, [selectedDay, week, month]);

  const isCurrentWeek = weekStart === startOfWeek();

  return (
    <Screen title="Stats" subtitle="Walking" accent="walk" onRefresh={onRefresh}>
      <FadeInView>
        <SegmentedControl
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
          value={range}
          onChange={(next) => {
            setRange(next);
            setSelectedDay(null);
          }}
          color={palette.walkFrom}
        />
      </FadeInView>

      {range === 'week' ? (
        <>
          <FadeInView index={1}>
            <GlassCard>
              <PeriodHeader
                label={
                  isCurrentWeek
                    ? 'This week'
                    : `${friendlyDate(weekStart)} – ${friendlyDate(addDays(weekStart, 6))}`
                }
                onPrev={() => void setWeekStart(addDays(weekStart, -7))}
                onNext={isCurrentWeek ? undefined : () => void setWeekStart(addDays(weekStart, 7))}
              />

              {week ? (
                <BarChart
                  days={week.days}
                  goal={dailyGoal}
                  selectedDay={selectedDay}
                  onSelectDay={(day) => setSelectedDay((prev) => (prev === day ? null : day))}
                  colors={[palette.walkFrom, palette.walkTo]}
                />
              ) : null}

              {/* Tapping a bar expands its day inline; layout animates so the
                  card grows rather than the detail popping into place. */}
              <Animated.View layout={LinearTransition.springify().damping(15).stiffness(120)}>
                {selected ? <DayDetail day={selected} /> : null}
              </Animated.View>
            </GlassCard>
          </FadeInView>

          {week ? (
            <FadeInView index={2}>
              <SectionHeader title="Weekly summary" />
              <GlassCard>
                <View style={styles.summaryHead}>
                  <View>
                    <Text style={[type.eyebrow, { color: palette.textTertiary }]}>Total steps</Text>
                    <View style={styles.totalRow}>
                      <AnimatedNumber
                        value={week.totalSteps}
                        style={type.display}
                        color={palette.text}
                      />
                    </View>
                    <DeltaChip delta={week.deltaVsPreviousPct} />
                  </View>
                  <StreakFlame days={week.streak} />
                </View>

                <Divider />

                <View style={styles.summaryGrid}>
                  <StatTile
                    label="Daily average"
                    value={week.dailyAverage}
                    icon="analytics"
                    index={0}
                    style={styles.summaryCell}
                  />
                  <StatTile
                    label="Best day"
                    text={week.bestDay ? formatSteps(week.bestDay.steps) : '—'}
                    unit={week.bestDay ? friendlyDate(week.bestDay.day) : undefined}
                    icon="trophy"
                    color={palette.walkFrom}
                    index={1}
                    style={styles.summaryCell}
                  />
                  <StatTile
                    label="Time walked"
                    text={formatDurationShort(week.totalActiveMs)}
                    icon="time"
                    index={2}
                    style={styles.summaryCell}
                  />
                  <StatTile
                    label="Distance"
                    text={formatDistance(week.totalDistanceM)}
                    unit="km"
                    icon="map"
                    index={3}
                    style={styles.summaryCell}
                  />
                  <StatTile
                    label="Goals met"
                    text={`${week.daysGoalMet}/7`}
                    icon="checkmark-circle"
                    color={week.daysGoalMet > 0 ? palette.success : undefined}
                    index={4}
                    style={styles.summaryCell}
                  />
                  <StatTile
                    label="Calories"
                    value={week.totalCalories}
                    unit="kcal"
                    icon="flame"
                    index={5}
                    style={styles.summaryCell}
                  />
                </View>
              </GlassCard>
            </FadeInView>
          ) : null}
        </>
      ) : (
        <FadeInView index={1}>
          <GlassCard>
            <PeriodHeader
              label={monthLabel(monthKey)}
              onPrev={() => void loadMonth(addMonths(monthKey, -1))}
              onNext={
                monthKey >= toDayKey().slice(0, 7)
                  ? undefined
                  : () => void loadMonth(addMonths(monthKey, 1))
              }
            />
            <HeatmapCalendar
              days={month}
              color={palette.walkFrom}
              selectedDay={selectedDay}
              onSelectDay={(day) => setSelectedDay((prev) => (prev === day ? null : day))}
            />
            <Animated.View layout={LinearTransition.springify().damping(15).stiffness(120)}>
              {selected ? <DayDetail day={selected} /> : null}
            </Animated.View>
          </GlassCard>
        </FadeInView>
      )}

      <FadeInView index={3}>
        <SectionHeader title="Session history" />
        {sessions.length === 0 ? (
          <GlassCard>
            <EmptyState
              icon="footsteps"
              title="No sessions yet"
              message="Start a walk from the Walk tab and it will show up here."
              color={palette.walkFrom}
            />
          </GlassCard>
        ) : (
          <GlassCard padding={0}>
            {sessions.map((session, index) => (
              <View key={session.id}>
                {index > 0 ? <Divider inset={spacing.base} /> : null}
                <SessionRow
                  session={session}
                  index={index}
                  onOpen={(rect) =>
                    router.push(`/session/${session.id}?rect=${encodeRect(rect)}`)
                  }
                />
              </View>
            ))}
          </GlassCard>
        )}
      </FadeInView>
    </Screen>
  );
}

/* ------------------------------- sub-views -------------------------------- */

function PeriodHeader({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.periodHeader}>
      <PressableScale onPress={onPrev} disabled={!onPrev} hitSlop={12} haptic="select">
        <Ionicons name="chevron-back" size={20} color={palette.textSecondary} />
      </PressableScale>
      <Text style={[type.headline, { color: palette.text }]}>{label}</Text>
      <PressableScale onPress={onNext} disabled={!onNext} hitSlop={12} haptic="select">
        <Ionicons
          name="chevron-forward"
          size={20}
          color={onNext ? palette.textSecondary : 'transparent'}
        />
      </PressableScale>
    </View>
  );
}

/** Expanded detail for a tapped bar or heatmap cell. */
function DayDetail({ day }: { day: DayStats }) {
  const palette = usePalette();
  const met = day.goal > 0 && day.steps >= day.goal;

  return (
    <View style={[styles.dayDetail, { borderTopColor: palette.separator }]}>
      <View style={styles.dayDetailHead}>
        <Text style={[type.headline, { color: palette.text }]}>{friendlyDate(day.day)}</Text>
        {met ? (
          <View style={[styles.metPill, { backgroundColor: withAlpha(palette.success, 0.16) }]}>
            <Ionicons name="checkmark" size={11} color={palette.success} />
            <Text style={[type.caption, { color: palette.success, fontWeight: '700' }]}>
              Goal met
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.dayDetailGrid}>
        <StatTile
          label="Steps"
          value={day.steps}
          icon="footsteps"
          color={palette.walkFrom}
          index={0}
          style={styles.dayDetailCell}
        />
        <StatTile
          label="Distance"
          value={day.distanceM / 1000}
          decimals={2}
          unit="km"
          icon="map"
          index={1}
          style={styles.dayDetailCell}
        />
        <StatTile
          label="Active time"
          text={formatDurationShort(day.activeMs)}
          icon="time"
          index={2}
          style={styles.dayDetailCell}
        />
        <StatTile
          label="Calories"
          value={day.calories}
          unit="kcal"
          icon="flame"
          index={3}
          style={styles.dayDetailCell}
        />
        <StatTile
          label="Sessions"
          value={day.sessions}
          icon="list"
          index={4}
          style={styles.dayDetailCell}
        />
        <StatTile
          label="Goal"
          value={day.goal}
          icon="flag"
          index={5}
          style={styles.dayDetailCell}
        />
      </View>
    </View>
  );
}

function SessionRow({
  session,
  index,
  onOpen,
}: {
  session: WalkingSession;
  index: number;
  onOpen: (rect: { x: number; y: number; width: number; height: number }) => void;
}) {
  const palette = usePalette();
  const { ref, handlePress } = useMeasuredPress(onOpen);

  const time = new Date(session.startedAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <FadeInView index={index}>
      <View ref={ref} collapsable={false}>
        <PressableScale
          onPress={handlePress}
          large
          haptic="select"
          style={styles.sessionRow}
          accessibilityLabel={`Walk on ${friendlyDate(session.day)}, ${session.steps} steps`}
        >
          <View style={[styles.sessionIcon, { backgroundColor: withAlpha(palette.walkFrom, 0.16) }]}>
            <Ionicons name="walk" size={18} color={palette.walkFrom} />
          </View>

          <View style={styles.sessionBody}>
            <Text style={[type.subhead, { color: palette.text, fontWeight: '600' }]}>
              {friendlyDate(session.day)}
              <Text style={{ color: palette.textTertiary, fontWeight: '400' }}> · {time}</Text>
            </Text>
            <Text style={[type.footnote, { color: palette.textSecondary }]}>
              {formatDurationShort(session.durationMs)} · {formatDistance(session.distanceM)} km
            </Text>
          </View>

          <View style={styles.sessionTrailing}>
            <Text style={[type.headline, { color: palette.text }]}>
              {formatSteps(session.steps)}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={palette.textTertiary} />
          </View>
        </PressableScale>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
    marginTop: spacing.base,
  },
  summaryCell: {
    width: '33.33%',
  },
  dayDetail: {
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dayDetailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  metPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  dayDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.base,
  },
  dayDetailCell: {
    width: '33.33%',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBody: {
    flex: 1,
    gap: 1,
  },
  sessionTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
