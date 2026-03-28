import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Easing,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue, withSpring, useAnimatedStyle,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { useScreenEntry } from '../hooks/useScreenEntry';

// ─── Exercise definitions ─────────────────────────────────────────────────────

interface Exercise {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  durationSec: number;
  difficulty: 'Beginner' | 'All levels';
  steps: { instruction: string; durationMs: number }[];
  gradient: [string, string]; // [from, to]
}

const EXERCISES: Exercise[] = [
  {
    id: 'slow_blink',
    title: 'Slow Blink',
    tagline: 'Re-lubricate and relax',
    icon: '👁️',
    durationSec: 30,
    difficulty: 'Beginner',
    gradient: ['#4F8EF7', '#6366F1'],
    steps: [
      { instruction: 'Slowly close your eyes…',  durationMs: 2000 },
      { instruction: 'Hold gently closed…',       durationMs: 2000 },
      { instruction: 'Slowly open your eyes…',   durationMs: 2000 },
      { instruction: 'Rest…',                     durationMs: 1000 },
    ],
  },
  {
    id: 'focus_shift',
    title: 'Focus Shift',
    tagline: 'Near → far depth training',
    icon: '🔭',
    durationSec: 60,
    difficulty: 'All levels',
    gradient: ['#34D399', '#059669'],
    steps: [
      { instruction: 'Hold a finger 10 inches from your face', durationMs: 3000 },
      { instruction: 'Focus on your fingertip…',               durationMs: 4000 },
      { instruction: 'Now focus on something 20 feet away',    durationMs: 4000 },
      { instruction: 'Hold that distant focus…',               durationMs: 3000 },
      { instruction: 'Shift back to your finger',              durationMs: 3000 },
    ],
  },
  {
    id: 'palming',
    title: 'Eye Palming',
    tagline: 'Deep warmth relaxation',
    icon: '🌙',
    durationSec: 60,
    difficulty: 'Beginner',
    gradient: ['#A78BFA', '#7C3AED'],
    steps: [
      { instruction: 'Rub your palms together to warm them',   durationMs: 5000 },
      { instruction: 'Cup warm palms over your closed eyes',   durationMs: 5000 },
      { instruction: 'Feel the warmth and darkness…',          durationMs: 15000 },
      { instruction: 'Breathe slowly and let go of tension',   durationMs: 15000 },
      { instruction: 'Gently lower your hands',                durationMs: 5000 },
    ],
  },
  {
    id: 'figure8',
    title: 'Figure-8 Sweep',
    tagline: 'Strengthen eye muscles',
    icon: '∞',
    durationSec: 30,
    difficulty: 'All levels',
    gradient: ['#FBBF24', '#F59E0B'],
    steps: [
      { instruction: 'Imagine a large ∞ on the wall ahead',   durationMs: 3000 },
      { instruction: 'Trace it slowly with your eyes…',        durationMs: 6000 },
      { instruction: 'Clockwise — 3 full loops',               durationMs: 8000 },
      { instruction: 'Counter-clockwise — 3 more loops',       durationMs: 8000 },
      { instruction: 'Close and rest',                         durationMs: 3000 },
    ],
  },
];

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise, onStart, index,
}: {
  exercise: Exercise; onStart: () => void; index: number;
}) {
  const { colors } = useTheme();
  const scale  = useSharedValue(1);
  const opacity = useSharedValue(0);
  const ty      = useSharedValue(20);

  useEffect(() => {
    const delay = index * 80;
    setTimeout(() => {
      const { withTiming, withSpring } = require('react-native-reanimated');
      opacity.value = withTiming(1, { duration: 350 });
      ty.value      = withSpring(0, { damping: 16 });
    }, delay);
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: ty.value }, { scale: scale.value }],
  }));

  const handlePressIn  = () => { scale.value = withSpring(0.97, { damping: 18 }); };
  const handlePressOut = () => { scale.value = withSpring(1.0,  { damping: 12 }); };

  const [from, to] = exercise.gradient;

  return (
    <Animated.View style={[cardStyle, styles.cardWrapper]}>
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onStart(); }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: from + '30' }]}>
          {/* Left accent bar */}
          <View style={[styles.cardAccent, { backgroundColor: from }]} />

          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <View style={[styles.iconBubble, { backgroundColor: from + '20' }]}>
                <Text style={styles.cardIcon}>{exercise.icon}</Text>
              </View>
              <View style={styles.cardMeta}>
                <View style={[styles.diffBadge, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.diffText, { color: from }]}>{exercise.difficulty}</Text>
                </View>
                <Text style={[styles.duration, { color: colors.textTertiary }]}>
                  {exercise.durationSec}s
                </Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>{exercise.title}</Text>
            <Text style={styles.cardTagline}>{exercise.tagline}</Text>

            {/* Steps preview */}
            <View style={styles.stepsPreview}>
              {exercise.steps.slice(0, 3).map((s, i) => (
                <Text key={i} style={styles.stepPreviewText} numberOfLines={1}>
                  {i + 1}. {s.instruction}
                </Text>
              ))}
              {exercise.steps.length > 3 && (
                <Text style={[styles.stepPreviewText, { color: from }]}>
                  +{exercise.steps.length - 3} more…
                </Text>
              )}
            </View>

            <View style={[styles.startRow, { borderTopColor: colors.surfaceBorder }]}>
              <Text style={[styles.startText, { color: from }]}>Begin exercise →</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Active exercise modal ─────────────────────────────────────────────────────

function ActiveExercise({
  exercise, onDone,
}: {
  exercise: Exercise; onDone: () => void;
}) {
  const { colors } = useTheme();
  const [stepIdx, setStepIdx]   = useState(0);
  const [elapsed, setElapsed]   = useState(0);
  const [complete, setComplete] = useState(false);

  const progress = useRef(new RNAnimated.Value(0)).current;
  const breathe  = useRef(new RNAnimated.Value(1)).current;
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef  = useRef(0);

  const [from] = exercise.gradient;
  const total  = exercise.durationSec;

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Overall progress bar
    RNAnimated.timing(progress, {
      toValue: 1,
      duration: total * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Breathing circle
    const breathLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(breathe, { toValue: 1.14, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        RNAnimated.timing(breathe, { toValue: 1,    duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    breathLoop.start();

    // Step sequencing
    let acc = 0;
    const steps = exercise.steps;
    const timers: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((step, i) => {
      timers.push(setTimeout(() => {
        setStepIdx(i);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, acc));
      acc += step.durationMs;
    });

    // Completion
    timers.push(setTimeout(() => {
      setComplete(true);
      breathLoop.stop();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, total * 1000));

    // Elapsed counter
    interval.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => {
      timers.forEach(clearTimeout);
      breathLoop.stop();
      if (interval.current) clearInterval(interval.current);
    };
  }, []);

  const step = exercise.steps[stepIdx];
  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[styles.activeRoot, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.activeHeader}>
        <Pressable onPress={onDone} style={[styles.backBtn, { backgroundColor: colors.surfaceRaised }]}>
          <Text style={styles.backBtnText}>✕ Stop</Text>
        </Pressable>
        <Text style={[styles.activeTitle, { color: from }]}>{exercise.title}</Text>
        <Text style={[styles.activeTime, { color: colors.textTertiary }]}>
          {Math.max(0, total - elapsed)}s
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBg, { backgroundColor: colors.surfaceRaised }]}>
        <RNAnimated.View
          style={[styles.progressFill, { width: progressWidth, backgroundColor: from }]}
        />
      </View>

      {complete ? (
        // Done state
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={[styles.doneTitle, { color: from }]}>Complete!</Text>
          <Text style={styles.doneSub}>Your eyes feel refreshed.</Text>
          <Pressable
            style={[styles.doneBtn, { backgroundColor: from }]}
            onPress={onDone}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      ) : (
        // Active state
        <View style={styles.activeBody}>
          {/* Breathing circle */}
          <RNAnimated.View
            style={[
              styles.breathCircle,
              {
                backgroundColor: from + '18',
                borderColor:     from + '50',
                transform: [{ scale: breathe }],
              },
            ]}
          >
            <Text style={styles.breathIcon}>{exercise.icon}</Text>
          </RNAnimated.View>

          {/* Current instruction */}
          <Text style={styles.stepInstruction}>{step?.instruction ?? ''}</Text>

          {/* Step dots */}
          <View style={styles.stepDots}>
            {exercise.steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i <= stepIdx ? from : colors.surfaceBorder,
                    width:           i === stepIdx ? 20 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* All steps list */}
          <View style={[styles.stepsList, { backgroundColor: colors.surfaceRaised }]}>
            {exercise.steps.map((s, i) => (
              <View key={i} style={styles.stepsListRow}>
                <View style={[
                  styles.stepsListDot,
                  { backgroundColor: i < stepIdx ? from : i === stepIdx ? from : colors.surfaceBorder },
                ]} />
                <Text style={[
                  styles.stepsListText,
                  { color: i === stepIdx ? colors.textPrimary : i < stepIdx ? colors.textTertiary : colors.textSecondary },
                  i === stepIdx && { fontWeight: '700' },
                ]}>
                  {s.instruction}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── ExercisesScreen ──────────────────────────────────────────────────────────

export default function ExercisesScreen() {
  const { colors } = useTheme();
  const { containerStyle } = useScreenEntry();
  const [active, setActive] = useState<Exercise | null>(null);

  if (active) {
    return <ActiveExercise exercise={active} onDone={() => setActive(null)} />;
  }

  return (
    <Animated.View style={[styles.root, { backgroundColor: colors.background }, containerStyle]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Eye Exercises</Text>
        <Text style={styles.subtitle}>
          Guided routines to strengthen and recover your eyes
        </Text>

        {EXERCISES.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            index={i}
            onStart={() => setActive(ex)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48, gap: 16 },
  title:    { fontSize: 28, fontWeight: '900', color: '#F1F5FF', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#4A5578', lineHeight: 20, marginBottom: 4 },

  // Card
  cardWrapper: {},
  card: {
    borderRadius: 20, borderWidth: 1,
    flexDirection: 'row', overflow: 'hidden',
  },
  cardAccent: { width: 4 },
  cardBody:   { flex: 1, padding: 18, gap: 10 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconBubble: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardIcon:   { fontSize: 24 },
  cardMeta:   { alignItems: 'flex-end', gap: 4 },
  diffBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  diffText:   { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  duration:   { fontSize: 11 },
  cardTitle:  { fontSize: 18, fontWeight: '800', color: '#F1F5FF', letterSpacing: -0.3 },
  cardTagline: { fontSize: 13, color: '#8B9CC8' },
  stepsPreview: { gap: 3 },
  stepPreviewText: { fontSize: 11, color: '#4A5578', lineHeight: 16 },
  startRow:   { paddingTop: 10, marginTop: 4, borderTopWidth: 1 },
  startText:  { fontSize: 13, fontWeight: '700' },

  // Active exercise
  activeRoot:   { flex: 1 },
  activeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  backBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  backBtnText: { fontSize: 13, color: '#8B9CC8', fontWeight: '600' },
  activeTitle: { fontSize: 17, fontWeight: '800' },
  activeTime:  { fontSize: 15, fontWeight: '600', minWidth: 36, textAlign: 'right' },
  progressBg:  { height: 4, marginHorizontal: 20, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4 },

  activeBody: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, gap: 28,
  },
  breathCircle: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  breathIcon:      { fontSize: 52 },
  stepInstruction: { fontSize: 22, fontWeight: '700', color: '#F1F5FF', textAlign: 'center', lineHeight: 30 },
  stepDots:    { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot:         { height: 8, borderRadius: 4 },
  stepsList:   { width: '100%', borderRadius: 16, padding: 16, gap: 12 },
  stepsListRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepsListDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  stepsListText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // Done
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  doneEmoji: { fontSize: 64 },
  doneTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  doneSub:   { fontSize: 15, color: '#8B9CC8', textAlign: 'center' },
  doneBtn:   { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 20, marginTop: 8 },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
