import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { radius as radii, shadow, spacing, usePalette, withAlpha } from '@/theme';

/**
 * The frosted surface the entire app is built from.
 *
 * Real glass is not one layer, and neither is this. Bottom to top:
 *
 *   1. BlurView                  refracts the animated mesh behind it
 *   2. translucent fill          gives the glass body and colour
 *   3. inner glow gradient       fades top-to-bottom, reads as a lit surface
 *   4. 1px top highlight         rgba(255,255,255,0.18) — the lit leading edge
 *   5. hairline border           holds the shape without a harsh outline
 *
 * plus two shadow layers underneath for depth. The top highlight is the single
 * detail that most sells the effect: it is what a real bevel catching light
 * looks like, and it is the first thing missing from flat imitations.
 */

export type GlassIntensity = 'light' | 'regular' | 'strong';

export interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Inner padding. Pass 0 for edge-to-edge content such as charts. */
  padding?: number;
  borderRadius?: number;
  intensity?: GlassIntensity;
  elevation?: 'sm' | 'md' | 'lg' | 'xl';
  /** Tints the whole card toward an accent — used for active/selected states. */
  tint?: string;
  /** Animated wrapper, so callers can drive entrance/press without re-nesting. */
  animatedStyle?: StyleProp<ViewStyle>;
}

const BLUR_INTENSITY: Record<GlassIntensity, number> = {
  light: 24,
  regular: 42,
  strong: 68,
};

export function GlassCard({
  children,
  style,
  padding = spacing.base,
  borderRadius = radii.card,
  intensity = 'regular',
  elevation = 'md',
  tint,
  animatedStyle,
}: GlassCardProps) {
  const palette = usePalette();
  const isDark = palette.scheme === 'dark';

  const fill = intensity === 'strong' ? palette.glassStrong : palette.glass;

  return (
    <Animated.View style={[shadow(palette, elevation), { borderRadius }, animatedStyle, style]}>
      <View style={[styles.clip, { borderRadius }]}>
        <BlurView
          intensity={BLUR_INTENSITY[intensity]}
          tint={palette.blurTint}
          style={StyleSheet.absoluteFill}
        />

        {/* Body fill. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />

        {/* Accent wash for selected/active cards. */}
        {tint ? (
          <LinearGradient
            colors={[withAlpha(tint, isDark ? 0.22 : 0.16), withAlpha(tint, 0)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {/* Inner glow — brighter at the top, as if lit from above. */}
        <LinearGradient
          colors={[
            withAlpha('#FFFFFF', isDark ? 0.1 : 0.5),
            withAlpha('#FFFFFF', 0),
            withAlpha('#000000', isDark ? 0.06 : 0),
          ]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* The lit edge. 1px, and worth every pixel. */}
        <View
          pointerEvents="none"
          style={[styles.topHighlight, { backgroundColor: palette.glassHighlight }]}
        />

        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.glassBorder },
          ]}
        />

        <View style={{ padding }}>{children}</View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: StyleSheet.hairlineWidth * 2,
  },
});
