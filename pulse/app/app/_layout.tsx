import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MeshBackground } from '@/components/MeshBackground';
import { getDb } from '@/db/client';
import { registerBackgroundTask } from '@/services/background';
import { useSyncTriggers } from '@/services/useSyncTriggers';
import { ThemeProvider, useTheme } from '@/theme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useStepsStore } from '@/store/useStepsStore';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const { isDark } = useTheme();
  const hydrated = useSettingsStore((s) => s.hydrated);
  const initialise = useStepsStore((s) => s.initialise);

  // Drains the offline sync queue on foreground and on a slow heartbeat.
  useSyncTriggers();

  // Boot order matters: settings must be hydrated before the steps store
  // reads the goal and stride, and the database must exist before either.
  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    (async () => {
      await getDb();
      if (cancelled) return;
      await initialise();
      if (cancelled) return;
      await registerBackgroundTask();
      await SplashScreen.hideAsync().catch(() => undefined);
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, initialise]);

  return (
    <View style={styles.root}>
      {/* One mesh for the whole app: it lives behind every screen so the
          gradient never restarts or jumps during navigation. */}
      <MeshBackground />

      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Stack
        screenOptions={{
          headerShown: false,
          // Transparent so the shared mesh shows through during transitions.
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="practice/[id]" />
        <Stack.Screen
          name="practice/edit"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
