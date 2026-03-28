/**
 * CameraPermissionScreen — shown as a modal when camera mode is first enabled
 *
 * Features:
 *   - Animated concentric rings (SVG + reanimated)
 *   - 'See clearly, blink freely' headline
 *   - On-device privacy explanation
 *   - 'Enable camera mode' (filled) + 'Continue without camera' (ghost)
 */

import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue, withTiming, withRepeat, withSequence, withDelay,
  useAnimatedProps, useAnimatedStyle, Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';
import { FilledButton } from '../components/ui/FilledButton';
import { GhostButton } from '../components/ui/GhostButton';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Animated concentric rings illustration ────────────────────────────────────

function ConcentricRings({ color }: { color: string }) {
  const SIZE = 220;
  const CX   = SIZE / 2;
  const CY   = SIZE / 2;

  // 3 rings that pulse outward with staggered delays
  const rings = [
    { r: 36, strokeW: 3, delay: 0 },
    { r: 58, strokeW: 2, delay: 200 },
    { r: 80, strokeW: 1.5, delay: 400 },
  ];

  return (
    <View style={styles.ringIllustration}>
      <Svg width={SIZE} height={SIZE}>
        {rings.map((ring, i) => (
          <PulsingRing
            key={i}
            cx={CX} cy={CY}
            r={ring.r}
            strokeWidth={ring.strokeW}
            color={color}
            delay={ring.delay}
          />
        ))}
        {/* Center eye */}
        <Circle cx={CX} cy={CY} r={22} fill={color + '30'} />
        <Circle cx={CX} cy={CY} r={14} fill={color + '80'} />
        <Circle cx={CX} cy={CY} r={6}  fill={color} />
      </Svg>
    </View>
  );
}

function PulsingRing({
  cx, cy, r, strokeWidth, color, delay,
}: {
  cx: number; cy: number; r: number; strokeWidth: number; color: string; delay: number;
}) {
  const opacity = useSharedValue(0.7);
  const scale   = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.15, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.7,  { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    ));
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0,  { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    ));
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    opacity: opacity.value,
    r: r * scale.value,
  }));

  return (
    <AnimatedCircle
      cx={cx} cy={cy}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      animatedProps={animatedProps}
    />
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export interface CameraPermissionScreenProps {
  visible: boolean;
  onEnable: () => void;
  onSkip: () => void;
}

export default function CameraPermissionScreen({
  visible, onEnable, onSkip,
}: CameraPermissionScreenProps) {
  const { colors } = useTheme();

  // Screen entry animation
  const contentOpacity = useSharedValue(0);
  const contentTransY  = useSharedValue(24);

  useEffect(() => {
    if (visible) {
      contentOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
      contentTransY.value  = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
    } else {
      contentOpacity.value = 0;
      contentTransY.value  = 24;
    }
  }, [visible]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity:   contentOpacity.value,
    transform: [{ translateY: contentTransY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Animated.View style={[styles.content, contentStyle]}>

          {/* Illustration */}
          <ConcentricRings color={colors.accent} />

          {/* Headline */}
          <View style={styles.textBlock}>
            <Text style={[styles.headline, { color: colors.textPrimary }]}>
              See clearly,{'\n'}blink freely.
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              BlinkWell uses the front camera to measure your real blink rate.
              All processing happens on-device — no video is ever stored or uploaded.
            </Text>
          </View>

          {/* Privacy note */}
          <View style={[styles.privacyRow, { backgroundColor: colors.success + '14', borderColor: colors.success + '30' }]}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={[styles.privacyText, { color: colors.success }]}>
              100% on-device · No data leaves your phone
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <FilledButton
              title="Enable camera mode"
              onPress={onEnable}
              color={colors.accent}
              height={52}
              fullWidth
            />
            <GhostButton
              title="Continue without camera"
              onPress={onSkip}
              color={colors.textTertiary}
              height={52}
              fullWidth
            />
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 28,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 28,
  },

  ringIllustration: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  textBlock: {
    alignItems: 'center',
    gap: 14,
  },
  headline: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
    lineHeight: 38,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },

  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'stretch',
  },
  privacyIcon: { fontSize: 16 },
  privacyText: { fontSize: 13, fontWeight: '600', flex: 1 },

  buttons: {
    width: '100%',
    gap: 12,
  },
});
