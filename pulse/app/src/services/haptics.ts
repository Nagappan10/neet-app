import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Every haptic in the app goes through here so intensity stays consistent and
 * a single flag can mute the lot. Calls are fire-and-forget: a failed haptic
 * should never interrupt an interaction.
 */

let enabled = true;

export function setHapticsEnabled(next: boolean): void {
  enabled = next;
}

export function areHapticsEnabled(): boolean {
  return enabled;
}

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

const fire = (run: () => Promise<void>): void => {
  if (!enabled || !supported) return;
  run().catch(() => undefined);
};

export const haptics = {
  /** Light tap — list rows, chart bars, segmented controls. */
  select: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** Medium — primary buttons, tab switches. */
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** Heavy — starting or stopping a session. */
  impact: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),

  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),

  /** Rigid tick used by the pull-to-refresh threshold and goal crossings. */
  tick: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),

  /**
   * Celebration used when a goal or streak lands — a rising triple tap reads
   * as more "earned" than a single notification buzz.
   */
  celebrate: () => {
    if (!enabled || !supported) return;
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    setTimeout(() => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)), 90);
    setTimeout(
      () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      190,
    );
  },
};
