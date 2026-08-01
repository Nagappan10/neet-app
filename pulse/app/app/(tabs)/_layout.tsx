import Tabs from 'expo-router/js-tabs';
import { FloatingTabBar } from '@/components/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      // The floating glass pill replaces the stock bar entirely; `sceneStyle`
      // stays transparent so the app-wide mesh shows through behind it.
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Walk' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
