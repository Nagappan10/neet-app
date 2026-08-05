import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { GlassCard } from '@/components/GlassCard';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { FadeInView, GhostButton, GradientButton, IconBadge, SectionHeader } from '@/components/common';
import { ACTIVITY_ICONS, usePracticeStore } from '@/store/usePracticeStore';
import { ACTIVITY_COLORS, radius, spacing, type, usePalette, withAlpha } from '@/theme';
import { spring } from '@/theme/motion';

const TARGET_PRESETS = [10, 15, 20, 30, 45, 60];

/** Create or edit a practice activity. Presented as a modal sheet. */
export default function EditActivityScreen() {
  const palette = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();

  const { activities, createActivity, updateActivity } = usePracticeStore();
  const existing = params.id ? activities.find((a) => a.id === params.id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<string>(existing?.icon ?? ACTIVITY_ICONS[0]);
  const [color, setColor] = useState(existing?.color ?? ACTIVITY_COLORS[0]);
  const [target, setTarget] = useState(String(existing?.targetMinutes ?? 20));
  const [saving, setSaving] = useState(false);

  const targetMinutes = Math.max(1, Math.round(Number(target) || 0));
  const canSave = name.trim().length > 0 && targetMinutes > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (existing) {
        await updateActivity({ ...existing, name: name.trim(), icon, color, targetMinutes });
      } else {
        await createActivity({ name: name.trim(), icon, color, targetMinutes });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        title={existing ? 'Edit activity' : 'New activity'}
        accent="practice"
        headerRight={
          <PressableScale onPress={router.back} haptic="select" accessibilityLabel="Cancel">
            <View style={[styles.close, { backgroundColor: withAlpha(palette.text, 0.08) }]}>
              <Ionicons name="close" size={18} color={palette.text} />
            </View>
          </PressableScale>
        }
      >
        {/* Live preview so the icon and colour choices are never abstract. */}
        <FadeInView>
          <GlassCard tint={color}>
            <View style={styles.preview}>
              <IconBadge icon={icon as never} color={color} size={48} />
              <View style={styles.flex}>
                <Text style={[type.title3, { color: palette.text }]} numberOfLines={1}>
                  {name.trim() || 'Activity name'}
                </Text>
                <Text style={[type.footnote, { color: palette.textSecondary }]}>
                  {targetMinutes} min daily target
                </Text>
              </View>
            </View>
          </GlassCard>
        </FadeInView>

        <FadeInView index={1}>
          <SectionHeader title="Name" />
          <GlassCard>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Aim Labs, Guitar, Typing…"
              placeholderTextColor={palette.textTertiary}
              maxLength={60}
              autoFocus={!existing}
              style={[
                type.body,
                styles.input,
                { color: palette.text, backgroundColor: withAlpha(palette.text, 0.06) },
              ]}
            />
          </GlassCard>
        </FadeInView>

        <FadeInView index={2}>
          <SectionHeader title="Daily target" />
          <GlassCard>
            <View style={styles.chipRow}>
              {TARGET_PRESETS.map((preset) => {
                const selected = targetMinutes === preset;
                return (
                  <PressableScale
                    key={preset}
                    haptic="select"
                    onPress={() => setTarget(String(preset))}
                    accessibilityLabel={`${preset} minutes`}
                  >
                    <View
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected
                            ? withAlpha(color, 0.22)
                            : withAlpha(palette.text, 0.06),
                          borderColor: selected ? withAlpha(color, 0.5) : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          type.subhead,
                          {
                            color: selected ? color : palette.textSecondary,
                            fontWeight: selected ? '700' : '500',
                          },
                        ]}
                      >
                        {preset}m
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>

            <TextInput
              value={target}
              onChangeText={setTarget}
              keyboardType="number-pad"
              placeholder="Custom minutes"
              placeholderTextColor={palette.textTertiary}
              style={[
                type.body,
                styles.input,
                styles.inputSpaced,
                { color: palette.text, backgroundColor: withAlpha(palette.text, 0.06) },
              ]}
            />
          </GlassCard>
        </FadeInView>

        <FadeInView index={3}>
          <SectionHeader title="Icon" />
          <GlassCard>
            <View style={styles.chipRow}>
              {ACTIVITY_ICONS.map((option) => (
                <SelectableIcon
                  key={option}
                  icon={option}
                  color={color}
                  selected={icon === option}
                  onPress={() => setIcon(option)}
                />
              ))}
            </View>
          </GlassCard>
        </FadeInView>

        <FadeInView index={4}>
          <SectionHeader title="Colour" />
          <GlassCard>
            <View style={styles.chipRow}>
              {ACTIVITY_COLORS.map((option) => (
                <SelectableColor
                  key={option}
                  color={option}
                  selected={color === option}
                  onPress={() => setColor(option)}
                />
              ))}
            </View>
          </GlassCard>
        </FadeInView>

        <FadeInView index={5}>
          <View style={styles.actions}>
            <GhostButton label="Cancel" onPress={router.back} style={styles.flex} />
            <GradientButton
              label={existing ? 'Save changes' : 'Create activity'}
              icon="checkmark"
              colors={[color, withAlpha(color, 0.7)]}
              disabled={!canSave}
              onPress={() => void handleSave()}
              style={styles.flex}
            />
          </View>
        </FadeInView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function SelectableIcon({
  icon,
  color,
  selected,
  onPress,
}: {
  icon: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const scale = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(selected ? 1 : 0, spring.bouncy);
  }, [scale, selected]);

  const style = useAnimatedStyle(() => ({
    borderColor: selected ? withAlpha(color, 0.6) : 'transparent',
    transform: [{ scale: 1 + scale.value * 0.04 }],
  }));

  return (
    <PressableScale onPress={onPress} haptic="select" accessibilityLabel={icon}>
      <Animated.View
        style={[
          styles.iconOption,
          {
            backgroundColor: selected ? withAlpha(color, 0.2) : withAlpha(palette.text, 0.06),
          },
          style,
        ]}
      >
        <Ionicons
          name={icon as never}
          size={20}
          color={selected ? color : palette.textSecondary}
        />
      </Animated.View>
    </PressableScale>
  );
}

function SelectableColor({
  color,
  selected,
  onPress,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(selected ? 1 : 0, spring.bouncy);
  }, [scale, selected]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + scale.value * 0.12 }],
    borderWidth: 1 + scale.value * 2,
  }));

  return (
    <PressableScale onPress={onPress} haptic="select" accessibilityLabel={`Colour ${color}`}>
      <Animated.View
        style={[styles.colorOption, { backgroundColor: color, borderColor: withAlpha('#FFFFFF', 0.85) }, style]}
      >
        {selected ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  input: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  inputSpaced: {
    marginTop: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconOption: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
