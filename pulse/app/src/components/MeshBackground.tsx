import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { usePalette, withAlpha } from '@/theme';
import { timing } from '@/theme/motion';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * The animated mesh that lives behind every glass surface.
 *
 * React Native has no CSS `filter: blur`, so the mesh is built the physical
 * way: three oversized gradient blobs drifting on long, offset sine loops,
 * with one heavy BlurView melting them into a continuous field. That gives the
 * frosted cards above something with real colour variation to refract —
 * without it, glassmorphism over flat #0A0A0C just looks like grey plastic.
 *
 * Everything animates via Reanimated shared values on the UI thread, so the
 * drift keeps its frame rate even while the JS thread is busy querying SQLite.
 */

interface BlobConfig {
  size: number;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  duration: number;
  colorIndex: 0 | 1 | 2;
}

const BLOBS: BlobConfig[] = [
  {
    size: SCREEN_W * 1.15,
    x: -SCREEN_W * 0.3,
    y: -SCREEN_H * 0.08,
    driftX: 60,
    driftY: 50,
    duration: 11000,
    colorIndex: 0,
  },
  {
    size: SCREEN_W * 1.0,
    x: SCREEN_W * 0.42,
    y: SCREEN_H * 0.18,
    driftX: -70,
    driftY: 70,
    duration: 14000,
    colorIndex: 1,
  },
  {
    size: SCREEN_W * 0.9,
    x: -SCREEN_W * 0.1,
    y: SCREEN_H * 0.55,
    driftX: 80,
    driftY: -60,
    duration: 17000,
    colorIndex: 2,
  },
];

function Blob({ config, progress }: { config: BlobConfig; progress: SharedValue<number> }) {
  const palette = usePalette();
  const color = palette.mesh[config.colorIndex];

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * config.driftX },
      { translateY: progress.value * config.driftY },
      { scale: 1 + progress.value * 0.12 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: config.x,
          top: config.y,
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[withAlpha(color, palette.scheme === 'dark' ? 0.55 : 0.5), withAlpha(color, 0)]}
        start={{ x: 0.3, y: 0.1 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function MeshBackgroundInner() {
  const palette = usePalette();

  // One shared progress driver per blob, each on its own period so the three
  // never line up and the field never looks like it is pulsing in unison.
  const p0 = useSharedValue(0);
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);
  const drivers = [p0, p1, p2];

  useEffect(() => {
    BLOBS.forEach((blob, i) => {
      drivers[i]!.value = withRepeat(
        withTiming(1, { ...timing.ambient, duration: blob.duration }),
        -1,
        true, // reverse, so the drift eases back rather than snapping home
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.background }]}>
      {BLOBS.map((blob, i) => (
        <Blob key={i} config={blob} progress={drivers[i]!} />
      ))}

      {/* Melts the three blobs into one continuous gradient field. */}
      <BlurView
        intensity={palette.scheme === 'dark' ? 90 : 70}
        tint={palette.blurTint}
        style={StyleSheet.absoluteFill}
      />

      {/* Vignette: darkens the extremes so hero type keeps its contrast. */}
      <LinearGradient
        colors={[
          withAlpha(palette.scheme === 'dark' ? '#000000' : '#FFFFFF', 0.45),
          'transparent',
          withAlpha(palette.scheme === 'dark' ? '#000000' : '#FFFFFF', 0.55),
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export const MeshBackground = memo(MeshBackgroundInner);
