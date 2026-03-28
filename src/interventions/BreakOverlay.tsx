/**
 * BreakOverlay — Level 3 / 20-20-20 full-screen break
 *
 * Phases:
 *   1. look_away  — breathing circle + 20s countdown, instruction fades in at 2s
 *   2. blink_dots — tap 3 slow-blink dots to confirm
 *   3. done       — celebration + auto-close
 *
 * Dismiss ghost-pill appears after 15 s.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue, withTiming, withRepeat, withSequence,
  useAnimatedStyle, Easing, runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import type { InterventionLevel, InterventionOutcome } from './BreakManager';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BreakOverlayProps {
  visible: boolean;
  level: InterventionLevel;
  onComplete: (outcome: InterventionOutcome) => void;
}

type Phase = 'look_away' | 'blink_dots' | 'done';

// ─── Breathing circle ─────────────────────────────────────────────────────────

function BreathingCircle({
  secondsLeft, active,
}: { secondsLeft: number; active: boolean }) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.8);
  const glow  = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      scale.value = withTiming(1, { duration: 300 });
      glow.value  = withTiming(0, { duration: 300 });
      return;
    }
    // 4-second breathe cycle: expand → contract
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      scale.value = 1;
      glow.value  = 0;
    };
  }, [active]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value * 0.6,
  }));

  return (
    <Animated.View
      style={[
        styles.circleOuter,
        { shadowColor: colors.accent },
        ringStyle,
      ]}
    >
      {/* Glow ring */}
      <View style={[styles.glowRing, { borderColor: colors.accent + '50' }]} />

      {/* Inner */}
      <View style={[styles.circleInner, { borderColor: colors.accent + '80' }]}>
        {/* Countdown */}
        <Text style={[styles.countdownNum, { color: colors.textPrimary }]}>
          {secondsLeft}
        </Text>
        <Text style={[styles.countdownUnit, { color: colors.textTertiary }]}>sec</Text>
      </View>
    </Animated.View>
  );
}

// ─── Blink dots (3 taps to confirm slow blinks) ───────────────────────────────

function BlinkDots({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const [tapped, setTapped] = useState<boolean[]>([false, false, false]);

  const handleTap = (i: number) => {
    if (tapped[i]) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = [...tapped];
    next[i] = true;
    setTapped(next);
    if (next.every(Boolean)) {
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onDone();
      }, 400);
    }
  };

  return (
    <View style={styles.dotsSection}>
      <Text style={[styles.dotsLabel, { color: colors.textSecondary }]}>
        Tap each dot after each slow blink
      </Text>
      <View style={styles.dotsRow}>
        {tapped.map((done, i) => (
          <Pressable
            key={i}
            onPress={() => handleTap(i)}
            style={[
              styles.blinkDot,
              {
                backgroundColor: done ? colors.success : colors.surfaceRaised,
                borderColor: done ? colors.success : colors.accent + '60',
              },
            ]}
          >
            <Text style={{ fontSize: 18 }}>{done ? '✓' : '👁️'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── BreakOverlay ─────────────────────────────────────────────────────────────

export default function BreakOverlay({ visible, level, onComplete }: BreakOverlayProps) {
  const { colors } = useTheme();
  const [phase,       setPhase]       = useState<Phase>('look_away');
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [canDismiss,  setCanDismiss]  = useState(false);

  // Screen-level animations
  const screenOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(32);
  // Instruction text fade (delayed 2s)
  const instructionOpacity = useSharedValue(0);
  // Dismiss button fade (delayed 15s)
  const dismissOpacity = useSharedValue(0);

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    dismissTimers.current.forEach(clearTimeout);
    dismissTimers.current = [];
  };

  useEffect(() => {
    if (!visible) {
      clearTimers();
      screenOpacity.value = withTiming(0, { duration: 250 });
      return;
    }

    // Reset
    setPhase('look_away');
    setSecondsLeft(20);
    setCanDismiss(false);
    instructionOpacity.value = 0;
    dismissOpacity.value = 0;

    // Entrance
    screenOpacity.value  = withTiming(1, { duration: 350 });
    cardTranslateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });

    // Instruction fades in at 2s
    dismissTimers.current.push(
      setTimeout(() => {
        instructionOpacity.value = withTiming(1, { duration: 600 });
      }, 2000)
    );

    // Dismiss unlocks at 15s
    dismissTimers.current.push(
      setTimeout(() => {
        setCanDismiss(true);
        dismissOpacity.value = withTiming(1, { duration: 400 });
      }, 15_000)
    );

    // Countdown tick
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          setPhase('blink_dots');
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    return clearTimers;
  }, [visible]);

  const handleComplete = useCallback(() => {
    setPhase('done');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => onComplete('completed'), 1400);
  }, [onComplete]);

  const handleDismiss = useCallback(() => {
    clearTimers();
    screenOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
      if (finished) runOnJS(onComplete)('dismissed');
    });
  }, [onComplete]);

  const screenStyle  = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const cardStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: cardTranslateY.value }] }));
  const instrStyle   = useAnimatedStyle(() => ({ opacity: instructionOpacity.value }));
  const dismissStyle = useAnimatedStyle(() => ({ opacity: dismissOpacity.value }));

  if (!visible) return null;

  const is2020 = level === '20-20-20';
  const accent = is2020 ? colors.success : colors.accent;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      {/* Backdrop — deep midnight blue */}
      <Animated.View style={[styles.backdrop, screenStyle]}>
        <Animated.View style={[styles.card, { backgroundColor: colors.surface }, cardStyle]}>

          {/* ── Header badge ─────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: accent + '22' }]}>
              <Text style={[styles.badgeText, { color: accent }]}>
                {is2020 ? '20-20-20 Break' : 'Eye Break'}
              </Text>
            </View>
          </View>

          {/* ── Look-away phase ───────────────────────────────────────── */}
          {phase === 'look_away' && (
            <>
              <BreathingCircle secondsLeft={secondsLeft} active />

              <Animated.View style={[styles.instructionBlock, instrStyle]}>
                <Text style={[styles.instrMain, { color: colors.textPrimary }]}>
                  Look at something far away
                </Text>
                <Text style={[styles.instrSub, { color: colors.textSecondary }]}>
                  Focus on a point 20 feet away.{'\n'}Let your eyes relax and blink naturally.
                </Text>
              </Animated.View>
            </>
          )}

          {/* ── Blink dots phase ──────────────────────────────────────── */}
          {phase === 'blink_dots' && (
            <>
              <BreathingCircle secondsLeft={0} active={false} />
              <BlinkDots onDone={handleComplete} />
            </>
          )}

          {/* ── Done phase ────────────────────────────────────────────── */}
          {phase === 'done' && (
            <View style={styles.doneBlock}>
              <Text style={styles.doneEmoji}>🎉</Text>
              <Text style={[styles.doneTitle, { color: colors.success }]}>Eyes refreshed!</Text>
              <Text style={[styles.doneSub, { color: colors.textSecondary }]}>
                Great job protecting your vision.{'\n'}Keep up the healthy habits!
              </Text>
            </View>
          )}

          {/* ── Ghost dismiss pill ────────────────────────────────────── */}
          {canDismiss && phase !== 'done' && (
            <Animated.View style={dismissStyle}>
              <Pressable
                onPress={handleDismiss}
                style={[styles.dismissPill, { borderColor: colors.textTertiary + '40' }]}
              >
                <Text style={[styles.dismissText, { color: colors.textTertiary }]}>
                  Skip for now
                </Text>
              </Pressable>
            </Animated.View>
          )}

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 28, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 32,
    padding: 28,
    alignItems: 'center',
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 16,
  },

  header: {
    width: '100%',
    alignItems: 'flex-start',
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Breathing circle
  circleOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 32,
  },
  glowRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
  },
  circleInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  countdownNum: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 52,
  },
  countdownUnit: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  instructionBlock: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  instrMain: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  instrSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Blink dots
  dotsSection: { alignItems: 'center', gap: 14 },
  dotsLabel:   { fontSize: 14, textAlign: 'center' },
  dotsRow:     { flexDirection: 'row', gap: 20 },
  blinkDot: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Done
  doneBlock: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  doneEmoji: { fontSize: 56 },
  doneTitle: { fontSize: 26, fontWeight: '900' },
  doneSub:   { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Dismiss pill
  dismissPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  dismissText: { fontSize: 14, fontWeight: '600' },
});
