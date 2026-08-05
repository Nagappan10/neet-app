import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './colors';
import { useSettingsStore } from '@/store/useSettingsStore';

export * from './colors';
export * from './layout';
export * from './motion';
export * from './typography';

interface ThemeValue {
  palette: Palette;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeValue>({ palette: darkPalette, isDark: true });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const preference = useSettingsStore((s) => s.themePreference);

  const value = useMemo<ThemeValue>(() => {
    // Dark is the designed-for default, so an unknown system scheme lands there.
    const resolved =
      preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
    return {
      palette: resolved === 'light' ? lightPalette : darkPalette,
      isDark: resolved === 'dark',
    };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function usePalette(): Palette {
  return useContext(ThemeContext).palette;
}
