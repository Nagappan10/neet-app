import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { GlassCard } from '@/components/GlassCard';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Divider, FadeInView, GhostButton, SectionHeader } from '@/components/common';
import { isBackgroundTaskRegistered } from '@/services/background';
import { lastSyncedAt, pendingCount, resetWatermark, runSync } from '@/services/sync';
import { usePracticeStore } from '@/store/usePracticeStore';
import { useSettingsStore, type ThemePreference } from '@/store/useSettingsStore';
import { useStepsStore } from '@/store/useStepsStore';
import { radius, spacing, type, usePalette, withAlpha } from '@/theme';
import { DEFAULT_STRIDE_M } from '@/utils/metrics';

const GOAL_PRESETS = [5000, 7500, 10000, 12500, 15000];

export default function SettingsScreen() {
  const palette = usePalette();

  const settings = useSettingsStore();
  const refreshSteps = useStepsStore((s) => s.refresh);
  const reloadPractice = usePracticeStore((s) => s.load);

  const [goalInput, setGoalInput] = useState(String(settings.dailyGoal));
  const [strideInput, setStrideInput] = useState(settings.strideLength.toFixed(3));
  const [weightInput, setWeightInput] = useState(String(settings.weightKg));
  const [urlInput, setUrlInput] = useState(settings.apiBaseUrl ?? '');

  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [backgroundOn, setBackgroundOn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const refreshSyncState = useCallback(async () => {
    setPending(await pendingCount());
    setLastSync(await lastSyncedAt());
    setBackgroundOn(await isBackgroundTaskRegistered());
  }, []);

  useEffect(() => {
    void refreshSyncState();
  }, [refreshSyncState]);

  const commitGoal = useCallback(async () => {
    const goal = Number(goalInput);
    if (Number.isFinite(goal) && goal > 0) {
      settings.setDailyGoal(goal);
      await refreshSteps();
    }
    setGoalInput(String(useSettingsStore.getState().dailyGoal));
  }, [goalInput, settings, refreshSteps]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await runSync();
      setSyncMessage(
        result.ok
          ? `Pushed ${result.pushed}, pulled ${result.pulled}.`
          : (result.error ?? 'Sync failed.'),
      );
      if (result.ok) {
        await refreshSteps();
        await reloadPractice();
      }
    } finally {
      setSyncing(false);
      await refreshSyncState();
    }
  }, [refreshSteps, reloadPractice, refreshSyncState]);

  return (
    <Screen title="Settings" accent="walk">
      {/* ----------------------------- daily goal ------------------------- */}
      <FadeInView>
        <SectionHeader title="Daily step goal" />
        <GlassCard>
          <View style={styles.chipRow}>
            {GOAL_PRESETS.map((preset) => {
              const selected = settings.dailyGoal === preset;
              return (
                <PressableScale
                  key={preset}
                  haptic="select"
                  onPress={() => {
                    settings.setDailyGoal(preset);
                    setGoalInput(String(preset));
                    void refreshSteps();
                  }}
                  accessibilityLabel={`${preset} steps`}
                >
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? withAlpha(palette.walkFrom, 0.22)
                          : withAlpha(palette.text, 0.06),
                        borderColor: selected ? withAlpha(palette.walkFrom, 0.5) : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        type.subhead,
                        {
                          color: selected ? palette.walkFrom : palette.textSecondary,
                          fontWeight: selected ? '700' : '500',
                        },
                      ]}
                    >
                      {(preset / 1000).toFixed(preset % 1000 === 0 ? 0 : 1)}k
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          <Field
            label="Custom goal"
            value={goalInput}
            onChangeText={setGoalInput}
            onBlur={() => void commitGoal()}
            keyboardType="number-pad"
            suffix="steps"
          />
        </GlassCard>
      </FadeInView>

      {/* ------------------------------ body ------------------------------ */}
      <FadeInView index={1}>
        <SectionHeader title="Measurements" />
        <GlassCard>
          <Field
            label="Stride length"
            value={strideInput}
            onChangeText={setStrideInput}
            onBlur={() => {
              const value = Number(strideInput);
              settings.setStrideLength(Number.isFinite(value) ? value : DEFAULT_STRIDE_M);
              setStrideInput(useSettingsStore.getState().strideLength.toFixed(3));
              void refreshSteps();
            }}
            keyboardType="decimal-pad"
            suffix="m"
            hint="Walk 10 steps, measure the distance, divide by 10. Distance and calories both depend on this."
          />
          <Divider />
          <Field
            label="Body weight"
            value={weightInput}
            onChangeText={setWeightInput}
            onBlur={() => {
              const value = Number(weightInput);
              settings.setWeight(Number.isFinite(value) ? value : 70);
              setWeightInput(String(useSettingsStore.getState().weightKg));
              void refreshSteps();
            }}
            keyboardType="decimal-pad"
            suffix="kg"
            hint="Used for the MET-based calorie estimate."
          />
        </GlassCard>
      </FadeInView>

      {/* ---------------------------- appearance -------------------------- */}
      <FadeInView index={2}>
        <SectionHeader title="Appearance" />
        <GlassCard>
          <SegmentedControl<ThemePreference>
            options={[
              { value: 'system', label: 'System' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            value={settings.themePreference}
            onChange={settings.setThemePreference}
            color={palette.walkFrom}
          />

          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={[type.subhead, { color: palette.text, fontWeight: '600' }]}>
                Haptic feedback
              </Text>
              <Text style={[type.caption, { color: palette.textTertiary }]}>
                Taps, transitions and goal celebrations.
              </Text>
            </View>
            <Switch
              value={settings.hapticsEnabled}
              onValueChange={settings.setHaptics}
              trackColor={{ true: palette.walkFrom, false: withAlpha(palette.text, 0.15) }}
            />
          </View>
        </GlassCard>
      </FadeInView>

      {/* ------------------------------- sync ----------------------------- */}
      <FadeInView index={3}>
        <SectionHeader title="Cloud sync" />
        <GlassCard>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={[type.subhead, { color: palette.text, fontWeight: '600' }]}>
                Enable sync
              </Text>
              <Text style={[type.caption, { color: palette.textTertiary }]}>
                Off by default. Everything works offline either way — sync only
                adds a backup and multi-device merge.
              </Text>
            </View>
            <Switch
              value={settings.syncEnabled}
              onValueChange={settings.setSyncEnabled}
              trackColor={{ true: palette.walkFrom, false: withAlpha(palette.text, 0.15) }}
            />
          </View>

          <Divider />

          <Field
            label="Server URL"
            value={urlInput}
            onChangeText={setUrlInput}
            onBlur={() => settings.setApiBaseUrl(urlInput)}
            keyboardType="url"
            placeholder="http://192.168.1.10:4000"
            hint="Your machine's LAN address — localhost points at the device itself, not your computer."
          />

          <Divider />

          <View style={styles.syncStatus}>
            <StatusLine
              icon="cloud-upload-outline"
              label="Pending changes"
              value={String(pending)}
            />
            <StatusLine
              icon="time-outline"
              label="Last synced"
              value={lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
            />
            <StatusLine
              icon="refresh-outline"
              label="Background refresh"
              value={backgroundOn ? 'Registered' : 'Not registered'}
            />
            <StatusLine
              icon="finger-print-outline"
              label="Device ID"
              value={settings.deviceId.slice(0, 8)}
            />
          </View>

          {syncMessage ? (
            <Text style={[type.caption, styles.syncMessage, { color: palette.textSecondary }]}>
              {syncMessage}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <GhostButton
              label={syncing ? 'Syncing…' : 'Sync now'}
              icon="sync"
              tone={palette.walkFrom}
              onPress={() => void handleSync()}
              style={styles.flex}
            />
            <GhostButton
              label="Full re-pull"
              icon="cloud-download-outline"
              onPress={() => {
                void resetWatermark().then(handleSync);
              }}
              style={styles.flex}
            />
          </View>
        </GlassCard>
      </FadeInView>

      <FadeInView index={4}>
        <Text style={[type.caption, styles.footer, { color: palette.textTertiary }]}>
          Pulse · steps read from the device’s hardware pedometer · data stored
          locally in SQLite
        </Text>
      </FadeInView>
    </Screen>
  );
}

/* -------------------------------- helpers --------------------------------- */

function Field({
  label,
  value,
  onChangeText,
  onBlur,
  keyboardType,
  suffix,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  keyboardType?: 'number-pad' | 'decimal-pad' | 'url';
  suffix?: string;
  hint?: string;
  placeholder?: string;
}) {
  const palette = usePalette();

  return (
    <View style={styles.field}>
      <Text style={[type.caption, { color: palette.textTertiary }]}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={palette.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            type.body,
            styles.input,
            { color: palette.text, backgroundColor: withAlpha(palette.text, 0.06) },
          ]}
        />
        {suffix ? (
          <Text style={[type.subhead, { color: palette.textTertiary }]}>{suffix}</Text>
        ) : null}
      </View>
      {hint ? (
        <Text style={[type.caption, { color: palette.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

function StatusLine({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const palette = usePalette();
  return (
    <View style={styles.statusLine}>
      <Ionicons name={icon} size={14} color={palette.textTertiary} />
      <Text style={[type.footnote, styles.flex, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[type.footnote, { color: palette.text, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  field: {
    gap: 6,
    paddingVertical: spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.md,
  },
  syncStatus: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncMessage: {
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footer: {
    textAlign: 'center',
    marginTop: spacing.base,
  },
});
