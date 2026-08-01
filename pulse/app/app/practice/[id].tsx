import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { GlassCard } from '@/components/GlassCard';
import { PressableScale } from '@/components/PressableScale';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { StatTile } from '@/components/StatTile';
import { StreakFlame } from '@/components/StreakFlame';
import { WeekGrid } from '@/components/WeekGrid';
import { HeroFollow, SharedHero, decodeRect } from '@/components/SharedHero';
import {
  Divider,
  EmptyState,
  GhostButton,
  GradientButton,
  IconBadge,
  SectionHeader,
} from '@/components/common';
import { listPracticeSessions } from '@/db/practice';
import { usePracticeStore } from '@/store/usePracticeStore';
import { radius, spacing, type, usePalette, withAlpha } from '@/theme';
import type { PracticeSession } from '@/types';
import { friendlyDate } from '@/utils/date';
import { formatDuration, formatMinutes } from '@/utils/format';

const QUICK_MINUTES = [5, 10, 15, 20, 30, 45];

export default function ActivityDetailScreen() {
  const palette = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; rect?: string }>();

  const {
    activities,
    stats,
    load,
    timer,
    timerElapsedMs,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    logManual,
    removeActivity,
  } = usePracticeStore();

  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [manualInput, setManualInput] = useState('');

  const origin = decodeRect(params.rect);
  const activity = activities.find((a) => a.id === params.id);
  const weekly = stats[params.id];

  const loadSessions = useCallback(async () => {
    setSessions(await listPracticeSessions(params.id, 50));
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions, stats]);

  const minutesToday = useMemo(
    () => weekly?.days.find((d) => d.day === new Date().toISOString().slice(0, 10))?.minutes ?? 0,
    [weekly],
  );

  const isTimingThis = timer?.activityId === params.id;
  // A timer already running for a *different* activity blocks starting one here.
  const timerBusyElsewhere = !!timer && !isTimingThis;

  const handleManual = useCallback(async () => {
    const minutes = Number(manualInput);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    await logManual(params.id, minutes);
    setManualInput('');
    await loadSessions();
  }, [manualInput, logManual, params.id, loadSessions]);

  if (!activity) {
    return (
      <Screen title="Activity" accent="practice">
        <GlassCard>
          <Text style={[type.body, { color: palette.textSecondary }]}>
            This activity no longer exists.
          </Text>
        </GlassCard>
      </Screen>
    );
  }

  const gradient: [string, string] = [activity.color, withAlpha(activity.color, 0.65)];
  const todayProgress = activity.targetMinutes > 0 ? minutesToday / activity.targetMinutes : 0;

  return (
    <Screen
      title={activity.name}
      subtitle={`${activity.targetMinutes} min daily target`}
      accent="practice"
      onRefresh={async () => {
        await load();
        await loadSessions();
      }}
      headerRight={
        <PressableScale
          onPress={() => router.push(`/practice/edit?id=${activity.id}`)}
          haptic="select"
          accessibilityLabel="Edit activity"
        >
          <View style={[styles.iconButton, { backgroundColor: withAlpha(palette.text, 0.08) }]}>
            <Ionicons name="pencil" size={16} color={palette.text} />
          </View>
        </PressableScale>
      }
    >
      <SharedHero origin={origin}>
        <GlassCard tint={activity.color}>
          <View style={styles.heroRow}>
            <ProgressRing
              progress={isTimingThis ? (minutesToday + timerElapsedMs / 60_000) / activity.targetMinutes : todayProgress}
              size={128}
              strokeWidth={12}
              colors={gradient}
            >
              <View style={styles.ringCenter}>
                <AnimatedNumber
                  value={isTimingThis ? minutesToday + timerElapsedMs / 60_000 : minutesToday}
                  decimals={minutesToday % 1 === 0 && !isTimingThis ? 0 : 1}
                  style={type.title2}
                  color={palette.text}
                />
                <Text style={[type.caption, { color: palette.textTertiary }]}>
                  of {activity.targetMinutes}m
                </Text>
              </View>
            </ProgressRing>

            <View style={styles.heroBody}>
              <IconBadge icon={activity.icon as never} color={activity.color} size={44} />
              <StreakFlame days={weekly?.streak ?? 0} color={activity.color} />
              {isTimingThis ? (
                <Text style={[type.mono, styles.timerText, { color: activity.color }]}>
                  {formatDuration(timerElapsedMs)}
                </Text>
              ) : null}
            </View>
          </View>
        </GlassCard>
      </SharedHero>

      <HeroFollow>
        {/* --------------------------- timer controls --------------------- */}
        {isTimingThis ? (
          <View style={styles.controlRow}>
            {timer?.running ? (
              <GhostButton label="Pause" icon="pause" onPress={pauseTimer} style={styles.flex} />
            ) : (
              <GradientButton
                label="Resume"
                icon="play"
                colors={gradient}
                onPress={resumeTimer}
                style={styles.flex}
              />
            )}
            <GhostButton
              label="Stop & log"
              icon="stop"
              tone={palette.danger}
              onPress={() => void stopTimer()}
              style={styles.flex}
            />
          </View>
        ) : (
          <GradientButton
            label={timerBusyElsewhere ? 'Another timer is running' : 'Start timer'}
            icon="play"
            size="lg"
            haptic="impact"
            colors={gradient}
            disabled={timerBusyElsewhere}
            onPress={() => startTimer(activity.id)}
          />
        )}

        <View style={{ height: spacing.base }} />

        {/* --------------------------- manual logging --------------------- */}
        <SectionHeader title="Log minutes manually" />
        <GlassCard>
          <View style={styles.quickRow}>
            {QUICK_MINUTES.map((minutes) => (
              <PressableScale
                key={minutes}
                haptic="select"
                onPress={() => {
                  void logManual(activity.id, minutes).then(loadSessions);
                }}
                accessibilityLabel={`Log ${minutes} minutes`}
              >
                <View
                  style={[
                    styles.quickChip,
                    {
                      backgroundColor: withAlpha(activity.color, 0.14),
                      borderColor: withAlpha(activity.color, 0.22),
                    },
                  ]}
                >
                  <Text style={[type.subhead, { color: activity.color, fontWeight: '700' }]}>
                    {minutes}m
                  </Text>
                </View>
              </PressableScale>
            ))}
          </View>

          <View style={styles.manualRow}>
            <TextInput
              value={manualInput}
              onChangeText={setManualInput}
              keyboardType="number-pad"
              placeholder="Custom minutes"
              placeholderTextColor={palette.textTertiary}
              style={[
                type.body,
                styles.input,
                { color: palette.text, backgroundColor: withAlpha(palette.text, 0.06) },
              ]}
              returnKeyType="done"
              onSubmitEditing={() => void handleManual()}
            />
            <GhostButton label="Add" icon="add" tone={activity.color} onPress={() => void handleManual()} />
          </View>
        </GlassCard>

        <View style={{ height: spacing.base }} />

        {/* ------------------------------ week grid ----------------------- */}
        {weekly ? (
          <>
            <SectionHeader title="This week" />
            <GlassCard>
              <WeekGrid days={weekly.days} color={activity.color} />

              <View style={[styles.statGrid, { borderTopColor: palette.separator }]}>
                <StatTile
                  label="Total"
                  text={formatMinutes(weekly.totalMinutes)}
                  icon="time"
                  color={activity.color}
                  index={0}
                  style={styles.statCell}
                />
                <StatTile
                  label="Daily average"
                  value={weekly.dailyAverage}
                  decimals={1}
                  unit="min"
                  icon="analytics"
                  index={1}
                  style={styles.statCell}
                />
                <StatTile
                  label="Days completed"
                  text={`${weekly.daysCompleted}/7`}
                  icon="checkmark-circle"
                  color={weekly.daysCompleted > 0 ? palette.success : undefined}
                  index={2}
                  style={styles.statCell}
                />
                <StatTile
                  label="Longest streak"
                  value={weekly.longestStreak}
                  unit="days"
                  icon="flame"
                  index={3}
                  style={styles.statCell}
                />
                <StatTile
                  label="Last week"
                  text={formatMinutes(weekly.previousTotalMinutes)}
                  icon="calendar"
                  index={4}
                  style={styles.statCell}
                />
                <StatTile
                  label="vs last week"
                  text=""
                  index={5}
                  style={styles.statCell}
                  delta={weekly.deltaVsPreviousPct}
                />
              </View>
            </GlassCard>
          </>
        ) : null}

        <View style={{ height: spacing.base }} />

        {/* ------------------------------- history ------------------------ */}
        <SectionHeader title="History" />
        {sessions.length === 0 ? (
          <GlassCard>
            <EmptyState
              icon="time"
              title="Nothing logged yet"
              message="Run the timer or add minutes manually and your sessions will appear here."
              color={activity.color}
            />
          </GlassCard>
        ) : (
          <GlassCard padding={0}>
            {sessions.map((session, index) => (
              <View key={session.id}>
                {index > 0 ? <Divider inset={spacing.base} /> : null}
                <View style={styles.historyRow}>
                  <Ionicons
                    name={session.source === 'manual' ? 'create-outline' : 'timer-outline'}
                    size={16}
                    color={palette.textTertiary}
                  />
                  <View style={styles.flex}>
                    <Text style={[type.subhead, { color: palette.text }]}>
                      {friendlyDate(session.day)}
                    </Text>
                    <Text style={[type.caption, { color: palette.textTertiary }]}>
                      {new Date(session.startedAt).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {session.source === 'manual' ? ' · manual entry' : ''}
                    </Text>
                  </View>
                  <Text style={[type.headline, { color: activity.color }]}>
                    {formatMinutes(session.minutes)}
                  </Text>
                </View>
              </View>
            ))}
          </GlassCard>
        )}

        <View style={{ height: spacing.base }} />

        <GhostButton
          label="Delete activity"
          icon="trash"
          tone={palette.danger}
          onPress={() => {
            void removeActivity(activity.id).then(() => router.back());
          }}
        />
      </HeroFollow>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  ringCenter: {
    alignItems: 'center',
  },
  heroBody: {
    flex: 1,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  timerText: {
    fontSize: 18,
    fontWeight: '700',
  },
  controlRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  manualRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statCell: {
    width: '33.33%',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
});
