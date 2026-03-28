/**
 * useScreenEntry — shared screen entry animation hook
 *
 * Spec: opacity 0→1, translateY 20→0, 350ms, Easing.out(Easing.cubic)
 *
 * Usage:
 *   const { containerStyle } = useScreenEntry();
 *   return <Animated.View style={[styles.root, containerStyle]}>...</Animated.View>
 */
import { useEffect } from 'react';
import {
  useSharedValue, withTiming, useAnimatedStyle, Easing,
} from 'react-native-reanimated';

export interface ScreenEntryOptions {
  /** Delay in ms before the animation starts (default: 0) */
  delay?: number;
  /** translateY start value in px (default: 20) */
  fromY?: number;
  /** Animation duration in ms (default: 350) */
  duration?: number;
}

export function useScreenEntry({
  delay = 0,
  fromY = 20,
  duration = 350,
}: ScreenEntryOptions = {}) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(fromY);

  useEffect(() => {
    const cfg = { duration, easing: Easing.out(Easing.cubic) } as const;

    if (delay > 0) {
      const t = setTimeout(() => {
        opacity.value    = withTiming(1, cfg);
        translateY.value = withTiming(0, cfg);
      }, delay);
      return () => clearTimeout(t);
    }

    opacity.value    = withTiming(1, cfg);
    translateY.value = withTiming(0, cfg);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return { containerStyle, opacity, translateY };
}
