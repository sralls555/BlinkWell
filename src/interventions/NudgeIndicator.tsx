/**
 * NudgeIndicator — Level 1 floating pill (bottom-right)
 *
 * Entry: spring slide-up + fade in
 * Exit:  slide down + fade out
 * Pulse: dot scales 1.0 → 1.4 in a soft loop
 * Auto-dismisses after 8 s if untapped
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue, withTiming, withSpring, withRepeat, withSequence,
  useAnimatedStyle, Easing, runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';

export interface NudgeIndicatorProps {
  visible: boolean;
  onTap: () => void;
  onAutoDismiss: () => void;
}

const AUTO_DISMISS_MS = 8_000;

export default function NudgeIndicator({ visible, onTap, onAutoDismiss }: NudgeIndicatorProps) {
  const { colors } = useTheme();

  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(24);
  const dotScale   = useSharedValue(1);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPulse = useCallback(() => {
    dotScale.value = withTiming(1, { duration: 200 });
  }, []);

  const startPulse = useCallback(() => {
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const animateOut = useCallback((cb: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopPulse();
    opacity.value    = withTiming(0, { duration: 220 });
    translateY.value = withTiming(24, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(cb)();
    });
  }, [stopPulse]);

  useEffect(() => {
    if (visible) {
      opacity.value    = 0;
      translateY.value = 24;

      opacity.value    = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 16, stiffness: 140 });

      // Start pulse after entry
      const pulseTimer = setTimeout(startPulse, 350);
      timerRef.current = setTimeout(() => animateOut(onAutoDismiss), AUTO_DISMISS_MS);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      return () => {
        clearTimeout(pulseTimer);
        if (timerRef.current) clearTimeout(timerRef.current);
        stopPulse();
      };
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopPulse();
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="box-none">
      <Pressable
        onPress={() => animateOut(onTap)}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <View style={[
          styles.pill,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.accent + '60',
            shadowColor: colors.accent,
          },
        ]}>
          {/* Pulsing dot */}
          <Animated.View
            style={[styles.dotWrapper, dotStyle]}
          >
            <View style={[styles.dot, { backgroundColor: colors.accent }]} />
            <View style={[styles.dotRing, { borderColor: colors.accent + '40' }]} />
          </Animated.View>

          <Text style={[styles.label, { color: colors.textPrimary }]}>
            Time to blink
          </Text>

          <View style={[styles.hint, { backgroundColor: colors.accent + '18' }]}>
            <Text style={[styles.hintText, { color: colors.accent }]}>tap</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 92,   // sits above 72px tab bar + 20px padding
    right: 16,
    zIndex: 998,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 16,
    gap: 9,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  dotWrapper: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
  },
  dotRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    position: 'absolute',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  hintText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
