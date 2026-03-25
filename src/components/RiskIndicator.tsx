import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { RiskLevel } from '../services/SessionService';
import { riskColor, riskLabel } from '../utils/timeUtils';

interface Props {
  level: RiskLevel;
  blinkRate: number;
}

export default function RiskIndicator({ level, blinkRate }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const color = riskColor(level);

  useEffect(() => {
    if (level === 'HIGH' || level === 'CRITICAL') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [level]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.circle,
          { backgroundColor: color + '22', borderColor: color, transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Text style={styles.emoji}>👁️</Text>
        <Text style={[styles.rate, { color }]}>{blinkRate}/min</Text>
      </Animated.View>
      <Text style={[styles.label, { color }]}>{riskLabel(level)}</Text>
      <Text style={styles.sublabel}>Estimated Blink Rate</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  circle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emoji: {
    fontSize: 32,
  },
  rate: {
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  sublabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
