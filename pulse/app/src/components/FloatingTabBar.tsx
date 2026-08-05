import { Ionicons } from '@expo/vector-icons';
// expo-router 57 vendors React Navigation rather than depending on it, so the
// tab bar prop types come from the router's own entry point.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '@/services/haptics';
import {
  TAB_BAR_HEIGHT,
  TAB_BAR_MARGIN,
  radius,
  shadow,
  spacing,
  type,
  usePalette,
  withAlpha,
} from '@/theme';
import { spring, timing } from '@/theme/motion';

/** Icon + accent per route, keyed by the file name under app/(tabs). */
const TAB_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string; accent: 'walk' | 'practice' }> = {
  index: { icon: 'walk', label: 'Walk', accent: 'walk' },
  stats: { icon: 'stats-chart', label: 'Stats', accent: 'walk' },
  practice: { icon: 'flash', label: 'Practice', accent: 'practice' },
  settings: { icon: 'settings-sharp', label: 'Settings', accent: 'walk' },
};

/**
 * Floating glass pill tab bar.
 *
 * The selection indicator is a single view that *slides* between tabs on a
 * spring rather than four views cross-fading — the continuity of one moving
 * object is what makes the bar feel like a physical control. Its travel is
 * measured from the real laid-out bar width, so it stays correct on any device
 * and on rotation.
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const tabCount = state.routes.length;
  const tabWidth = barWidth > 0 ? barWidth / tabCount : 0;

  const indicatorX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth > 0) {
      indicatorX.value = withSpring(state.index * tabWidth, spring.standard);
    }
  }, [indicatorX, state.index, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: tabWidth,
    transform: [{ translateX: indicatorX.value }],
  }));

  const activeRoute = state.routes[state.index]?.name ?? 'index';
  const activeAccent = TAB_META[activeRoute]?.accent ?? 'walk';
  const accentColors: [string, string] =
    activeAccent === 'walk'
      ? [palette.walkFrom, palette.walkTo]
      : [palette.practiceFrom, palette.practiceTo];

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, TAB_BAR_MARGIN), paddingHorizontal: spacing.lg },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.pill, shadow(palette, 'xl')]}>
        <View style={styles.clip}>
          <BlurView intensity={70} tint={palette.blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glassStrong }]} />

          {/* Lit top edge, same language as GlassCard. */}
          <View
            pointerEvents="none"
            style={[styles.topHighlight, { backgroundColor: palette.glassHighlight }]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: radius.pill,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: palette.glassBorder,
              },
            ]}
          />

          <View style={styles.row} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
            <Animated.View style={[styles.indicatorWrap, indicatorStyle]} pointerEvents="none">
              <LinearGradient
                colors={[withAlpha(accentColors[0], 0.28), withAlpha(accentColors[1], 0.18)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.indicator}
              />
            </Animated.View>

            {state.routes.map((route, index) => {
              const meta = TAB_META[route.name];
              if (!meta) return null;

              const focused = state.index === index;

              return (
                <TabButton
                  key={route.key}
                  icon={meta.icon}
                  label={meta.label}
                  focused={focused}
                  color={focused ? accentColors[0] : palette.textTertiary}
                  onPress={() => {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (!focused && !event.defaultPrevented) {
                      haptics.tap();
                      navigation.navigate(route.name);
                    }
                  }}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function TabButton({
  icon,
  label,
  focused,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
  color: string;
  onPress: () => void;
}) {
  const pressed = useSharedValue(0);
  const focus = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    focus.value = withSpring(focused ? 1 : 0, spring.standard);
  }, [focus, focused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: (1 + focus.value * 0.06) * (1 - pressed.value * 0.1) },
      { translateY: -focus.value * 1 },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + focus.value * 0.45,
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tab}
      onPressIn={() => {
        pressed.value = withTiming(1, timing.fast);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, spring.snappy);
      }}
      onPress={onPress}
    >
      <Animated.View style={iconStyle}>
        <Ionicons name={icon} size={22} color={color} />
      </Animated.View>
      <Animated.Text
        style={[type.caption, styles.label, { color }, labelStyle]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  pill: {
    borderRadius: radius.pill,
  },
  clip: {
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: StyleSheet.hairlineWidth * 2,
  },
  row: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
  },
  indicatorWrap: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    paddingHorizontal: 8,
  },
  indicator: {
    flex: 1,
    borderRadius: radius.pill,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});
