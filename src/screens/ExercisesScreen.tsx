import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface Exercise {
  id: string;
  title: string;
  description: string;
  icon: string;
  durationSec: number;
  steps: string[];
  color: string;
}

const EXERCISES: Exercise[] = [
  {
    id: 'slow_blink',
    title: 'Slow Blink Training',
    description: 'Consciously blink slowly to re-lubricate your eyes.',
    icon: '👁️',
    durationSec: 30,
    steps: [
      'Close your eyes halfway',
      'Hold for 2 seconds',
      'Close fully for 2 seconds',
      'Open slowly',
      'Repeat 10 times',
    ],
    color: '#6366f1',
  },
  {
    id: 'focus_shift',
    title: 'Focus Shifting',
    description: 'Train your eyes to shift between near and far objects.',
    icon: '🔭',
    durationSec: 60,
    steps: [
      'Hold a finger 10 inches from your face',
      'Focus on your finger for 5 seconds',
      'Shift focus to something 20 feet away',
      'Hold for 5 seconds',
      'Repeat 10 times',
    ],
    color: '#22d3ee',
  },
  {
    id: 'eye_closure',
    title: 'Eye Closure Relaxation',
    description: 'Deep relaxation to restore moisture and reduce fatigue.',
    icon: '😌',
    durationSec: 60,
    steps: [
      'Close your eyes gently',
      'Place warm palms over your eyes',
      'Breathe slowly and deeply',
      'Feel the warmth relax your eyes',
      'Hold for 60 seconds',
    ],
    color: '#22c55e',
  },
  {
    id: '8_figure',
    title: 'Figure-8 Eye Movement',
    description: 'Strengthen eye muscles with a controlled motion exercise.',
    icon: '∞',
    durationSec: 30,
    steps: [
      'Imagine a large figure-8 on the wall',
      'Trace the 8 with your eyes slowly',
      'Go clockwise for 5 reps',
      'Go counter-clockwise for 5 reps',
      'Keep head still throughout',
    ],
    color: '#f59e0b',
  },
];

function ExerciseModal({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(exercise.durationSec);
  const [done, setDone] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: exercise.durationSec * 1000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setDone(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        // Advance steps
        const stepInterval = Math.floor(exercise.durationSec / exercise.steps.length);
        const elapsed = exercise.durationSec - t + 1;
        setCurrentStep(Math.min(Math.floor(elapsed / stepInterval), exercise.steps.length - 1));
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.modal, { borderColor: exercise.color + '44' }]}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalIcon}>{exercise.icon}</Text>
        <Text style={[styles.modalTitle, { color: exercise.color }]}>{exercise.title}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <Animated.View style={[styles.progressFill, { width: barWidth, backgroundColor: exercise.color }]} />
      </View>

      {!done ? (
        <>
          <Text style={styles.timeLeft}>{timeLeft}s</Text>
          <View style={styles.stepCard}>
            <Text style={styles.stepNum}>Step {currentStep + 1}/{exercise.steps.length}</Text>
            <Text style={styles.stepText}>{exercise.steps[currentStep]}</Text>
          </View>
          <View style={styles.allSteps}>
            {exercise.steps.map((s, i) => (
              <Text
                key={i}
                style={[styles.stepItem, i === currentStep && { color: exercise.color, fontWeight: '700' }]}
              >
                {i < currentStep ? '✓' : `${i + 1}.`} {s}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.doneView}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={styles.doneText}>Exercise Complete!</Text>
          <Text style={styles.doneSub}>Your eyes are feeling better now.</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.closeBtn, { backgroundColor: exercise.color + '22', borderColor: exercise.color }]} onPress={onClose}>
        <Text style={[styles.closeBtnText, { color: exercise.color }]}>{done ? 'Done' : 'Stop'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ExercisesScreen() {
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Eye Exercises</Text>
        <Text style={styles.subtitle}>Guided exercises to strengthen and relax your eyes</Text>

        {activeExercise ? (
          <ExerciseModal exercise={activeExercise} onClose={() => setActiveExercise(null)} />
        ) : (
          <View style={styles.list}>
            {EXERCISES.map((ex) => (
              <TouchableOpacity
                key={ex.id}
                style={[styles.card, { borderLeftColor: ex.color }]}
                onPress={() => {
                  setActiveExercise(ex);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardIcon}>{ex.icon}</Text>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{ex.title}</Text>
                    <Text style={styles.cardDuration}>{ex.durationSec}s</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc}>{ex.description}</Text>
                <Text style={[styles.startBtn, { color: ex.color }]}>Start →</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111827' },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '900', color: '#f9fafb' },
  subtitle: { fontSize: 14, color: '#6b7280' },
  list: { gap: 14 },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 18,
    borderLeftWidth: 4,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { fontSize: 28 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#f9fafb' },
  cardDuration: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardDesc: { fontSize: 13, color: '#9ca3af', lineHeight: 20 },
  startBtn: { fontSize: 13, fontWeight: '700', marginTop: 4 },

  // Modal
  modal: {
    backgroundColor: '#1f2937',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalIcon: { fontSize: 28 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  progressBg: { height: 6, backgroundColor: '#374151', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 4 },
  timeLeft: { fontSize: 40, fontWeight: '900', color: '#f9fafb', textAlign: 'center' },
  stepCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  stepNum: { fontSize: 11, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' },
  stepText: { fontSize: 16, color: '#f9fafb', fontWeight: '600', lineHeight: 24 },
  allSteps: { gap: 6 },
  stepItem: { fontSize: 13, color: '#6b7280', lineHeight: 20 },
  doneView: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  doneEmoji: { fontSize: 48 },
  doneText: { fontSize: 22, fontWeight: '800', color: '#22c55e' },
  doneSub: { fontSize: 14, color: '#9ca3af' },
  closeBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  closeBtnText: { fontWeight: '700', fontSize: 16 },
});
