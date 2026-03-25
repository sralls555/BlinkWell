import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../store/useAppStore';

export default function TwentyTwentyTimer() {
  const { twentyTwentyActive, twentyTwentySecondsLeft, setTwentyTwenty, setTwentyTwentySeconds } =
    useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (twentyTwentyActive) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTwentyTwentySeconds(20);

      Animated.timing(progress, {
        toValue: 0,
        duration: 20000,
        useNativeDriver: false,
      }).start();

      intervalRef.current = setInterval(() => {
        setTwentyTwentySeconds(useAppStore.getState().twentyTwentySecondsLeft - 1);

        if (useAppStore.getState().twentyTwentySecondsLeft <= 0) {
          clearInterval(intervalRef.current!);
          setTwentyTwenty(false);
          progress.setValue(1);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [twentyTwentyActive]);

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  if (!twentyTwentyActive) return null;

  return (
    <Modal transparent animationType="fade" visible={twentyTwentyActive}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>20-20-20 Break</Text>
          <Text style={styles.instruction}>Look at something 20 feet away</Text>

          <View style={styles.timerContainer}>
            <Text style={styles.countdown}>{Math.max(0, twentyTwentySecondsLeft)}</Text>
            <Text style={styles.seconds}>seconds</Text>
          </View>

          <Text style={styles.tip}>
            💡 Relax your eyes. Blink gently and slowly several times.
          </Text>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => {
              if (intervalRef.current) clearInterval(intervalRef.current);
              setTwentyTwenty(false);
              progress.setValue(1);
            }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    gap: 16,
    borderWidth: 1,
    borderColor: '#22c55e33',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#22c55e',
  },
  instruction: {
    fontSize: 16,
    color: '#d1d5db',
    textAlign: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  countdown: {
    fontSize: 72,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 80,
  },
  seconds: {
    fontSize: 14,
    color: '#6b7280',
  },
  tip: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 32,
    backgroundColor: '#374151',
    borderRadius: 12,
    marginTop: 4,
  },
  skipText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});
