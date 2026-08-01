import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uuid } from '@/db/client';
import { setHapticsEnabled } from '@/services/haptics';
import { SETTINGS_STORAGE_KEY } from '@/services/settingsSnapshot';
import { DEFAULT_STRIDE_M, DEFAULT_WEIGHT_KG } from '@/utils/metrics';

export type ThemePreference = 'system' | 'dark' | 'light';

interface SettingsState {
  dailyGoal: number;
  strideLength: number;
  weightKg: number;
  themePreference: ThemePreference;
  hapticsEnabled: boolean;

  /** Sync configuration. Empty base URL means "device only". */
  apiBaseUrl: string | null;
  syncEnabled: boolean;
  deviceId: string;

  hydrated: boolean;

  setDailyGoal: (goal: number) => void;
  setStrideLength: (metres: number) => void;
  setWeight: (kg: number) => void;
  setThemePreference: (pref: ThemePreference) => void;
  setHaptics: (enabled: boolean) => void;
  setApiBaseUrl: (url: string | null) => void;
  setSyncEnabled: (enabled: boolean) => void;
}

/**
 * Persisted to the same AsyncStorage key that `loadSettingsSnapshot` reads, so
 * background tasks running without a React tree still see the user's goal,
 * stride and sync configuration.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dailyGoal: 10000,
      strideLength: DEFAULT_STRIDE_M,
      weightKg: DEFAULT_WEIGHT_KG,
      themePreference: 'system',
      hapticsEnabled: true,

      apiBaseUrl: null,
      syncEnabled: false,
      deviceId: uuid(),

      hydrated: false,

      setDailyGoal: (goal) => set({ dailyGoal: Math.max(500, Math.round(goal)) }),
      setStrideLength: (metres) => set({ strideLength: clampRange(metres, 0.3, 1.5) }),
      setWeight: (kg) => set({ weightKg: clampRange(kg, 25, 250) }),
      setThemePreference: (themePreference) => set({ themePreference }),
      setHaptics: (hapticsEnabled) => {
        setHapticsEnabled(hapticsEnabled);
        set({ hapticsEnabled });
      },
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl: apiBaseUrl?.trim() || null }),
      setSyncEnabled: (syncEnabled) => set({ syncEnabled }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        dailyGoal: state.dailyGoal,
        strideLength: state.strideLength,
        weightKg: state.weightKg,
        themePreference: state.themePreference,
        hapticsEnabled: state.hapticsEnabled,
        apiBaseUrl: state.apiBaseUrl,
        syncEnabled: state.syncEnabled,
        deviceId: state.deviceId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) setHapticsEnabled(state.hapticsEnabled);
        useSettingsStore.setState({ hydrated: true });
      },
    },
  ),
);

const clampRange = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
