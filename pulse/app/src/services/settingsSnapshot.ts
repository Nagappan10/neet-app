import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_STRIDE_M, DEFAULT_WEIGHT_KG } from '@/utils/metrics';

export const SETTINGS_STORAGE_KEY = 'pulse-settings';

export interface SettingsSnapshot {
  dailyGoal: number;
  strideLength: number;
  weightKg: number;
  apiBaseUrl: string | null;
  syncEnabled: boolean;
  deviceId: string;
}

export const DEFAULT_SETTINGS: SettingsSnapshot = {
  dailyGoal: 10000,
  strideLength: DEFAULT_STRIDE_M,
  weightKg: DEFAULT_WEIGHT_KG,
  apiBaseUrl: null,
  syncEnabled: false,
  deviceId: 'local-user',
};

/**
 * Reads persisted settings without touching the React store.
 *
 * Background tasks can run in a headless JS context where no component tree
 * (and therefore no hydrated Zustand store) exists, so they go straight to the
 * same AsyncStorage key the store persists to.
 */
export async function loadSettingsSnapshot(): Promise<SettingsSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as { state?: Partial<SettingsSnapshot> };
    return { ...DEFAULT_SETTINGS, ...(parsed.state ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
