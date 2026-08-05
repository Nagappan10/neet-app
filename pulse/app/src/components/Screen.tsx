import { BlurView } from 'expo-blur';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PullIndicator, PULL_THRESHOLD } from './PullIndicator';
import { haptics } from '@/services/haptics';
import {
  SCROLL_BOTTOM_PAD,
  accentGradient,
  spacing,
  type,
  usePalette,
  type AccentKey,
} from '@/theme';

export interface ScreenProps {
  title: string;
  subtitle?: string;
  accent?: AccentKey;
  children: ReactNode;
  onRefresh?: () => Promise<void> | void;
  /** Rendered on the trailing side of the large title row. */
  headerRight?: ReactNode;
  contentPaddingTop?: number;
}

const HEADER_MAX = 108;
const HEADER_MIN = 56;

/**
 * Standard screen chrome: a large title that collapses into a compact,
 * blurred bar as you scroll, plus custom pull-to-refresh.
 *
 * The header parallax is driven by `useAnimatedScrollHandler`, so the shrink,
 * fade and blur all run on the UI thread and stay glued to the finger. The
 * small title cross-fades in exactly as the large one leaves, which is the
 * detail that reads as "first-party" rather than "a header that moved".
 *
 * Pull-to-refresh differs by platform for a real reason: iOS scroll views
 * report negative content offsets while rubber-banding, so the custom arc can
 * track the gesture directly. Android has no equivalent overscroll offset, so
 * there we defer to a tinted `RefreshControl` rather than fake a gesture the
 * platform does not report.
 */
export function Screen({
  title,
  subtitle,
  accent = 'walk',
  children,
  onRefresh,
  headerRight,
  contentPaddingTop = 0,
}: ScreenProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const pull = useSharedValue(0);
  const armed = useSharedValue(false);

  const gradient = accentGradient(palette, accent);
  const useCustomPull = Platform.OS === 'ios' && !!onRefresh;

  const doRefresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  const notifyArmed = useCallback(() => haptics.tick(), []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      scrollY.value = y;
      pull.value = -y;

      // Fire the "you can let go now" tick exactly once per pull.
      if (!armed.value && -y >= PULL_THRESHOLD) {
        armed.value = true;
        runOnJS(notifyArmed)();
      } else if (armed.value && -y < PULL_THRESHOLD * 0.5) {
        armed.value = false;
      }
    },
    onEndDrag: (event) => {
      if (-event.contentOffset.y >= PULL_THRESHOLD) {
        armed.value = false;
        runOnJS(doRefresh)();
      }
    },
  });

  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 44], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, 80], [0, -18], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-120, 0], [1.08, 1], Extrapolation.CLAMP) },
    ],
  }));

  const compactBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [30, 78], [0, 1], Extrapolation.CLAMP),
  }));

  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [46, 84], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [46, 84], [8, 0], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={styles.root}>
      {/* Compact blurred bar, revealed as the large title leaves. */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.compactBar,
          { height: insets.top + HEADER_MIN, paddingTop: insets.top },
          compactBarStyle,
        ]}
      >
        <BlurView intensity={60} tint={palette.blurTint} style={StyleSheet.absoluteFill} />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: palette.glass, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.separator },
          ]}
        />
        <Animated.Text
          numberOfLines={1}
          style={[type.headline, styles.compactTitle, { color: palette.text }, compactTitleStyle]}
        >
          {title}
        </Animated.Text>
      </Animated.View>

      {useCustomPull ? (
        <View style={{ position: 'absolute', top: insets.top + HEADER_MAX * 0.5, left: 0, right: 0, zIndex: 5 }}>
          <PullIndicator pull={pull} refreshing={refreshing} color={gradient[0]} />
        </View>
      ) : null}

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: SCROLL_BOTTOM_PAD + insets.bottom,
          paddingHorizontal: spacing.screen,
        }}
        refreshControl={
          onRefresh && !useCustomPull ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={doRefresh}
              tintColor={gradient[0]}
              colors={[gradient[0], gradient[1]]}
              progressBackgroundColor={palette.backgroundElevated}
            />
          ) : undefined
        }
      >
        <Animated.View style={[styles.titleBlock, largeTitleStyle]}>
          <View style={{ flex: 1 }}>
            {subtitle ? (
              <Text style={[type.eyebrow, { color: palette.textTertiary }]}>{subtitle}</Text>
            ) : null}
            <Text style={[type.largeTitle, { color: palette.text }]}>{title}</Text>
          </View>
          {headerRight}
        </Animated.View>

        <View style={{ paddingTop: contentPaddingTop, gap: spacing.base }}>{children}</View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  compactBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compactTitle: {
    textAlign: 'center',
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
    minHeight: 52,
    gap: spacing.md,
  },
});
