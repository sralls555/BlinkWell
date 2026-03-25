import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { InterventionLevel } from '../services/InterventionEngine';
import { useAppStore } from '../store/useAppStore';

const { width, height } = Dimensions.get('window');

interface Props {
  level: InterventionLevel;
  message: string;
  visible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export default function InterventionOverlay({ level, message, visible, onAccept, onDismiss }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const edgePulse = useRef(new Animated.Value(0)).current;
  const settings = useAppStore((s) => s.settings);

  useEffect(() => {
    if (visible) {
      if (settings.hapticFeedback) {
        if (level === 1) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else if (level === 2) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else if (level === 3) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();

      if (level === 1) {
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(edgePulse, { toValue: 1, duration: 800, useNativeDriver: false }),
            Animated.timing(edgePulse, { toValue: 0, duration: 800, useNativeDriver: false }),
          ])
        );
        pulse.start();
        return () => pulse.stop();
      }
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      edgePulse.setValue(0);
    }
  }, [visible, level]);

  if (!visible) return null;

  // Level 1: edge pulse only, no modal
  if (level === 1) {
    const edgeOpacity = edgePulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] });
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.edgePulse, { opacity: edgeOpacity }]}
      />
    );
  }

  const bgColor = level === 3 ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)';
  const accentColor = level === 3 ? '#7c3aed' : '#f59e0b';
  const icon = level === 3 ? '🛑' : '👁️';

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim, backgroundColor: bgColor }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], borderColor: accentColor }]}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.message}>{message}</Text>

          {level === 3 && (
            <Text style={styles.subtext}>
              Look at something 20 feet away for 20 seconds to reduce eye strain.
            </Text>
          )}

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, styles.acceptBtn, { backgroundColor: accentColor }]}
              onPress={onAccept}
            >
              <Text style={styles.btnText}>{level === 3 ? 'Take Break' : 'Got it'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.dismissBtn]} onPress={onDismiss}>
              <Text style={styles.dismissText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  edgePulse: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 6,
    borderColor: '#f59e0b',
    borderRadius: 0,
    zIndex: 999,
    pointerEvents: 'none',
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 2,
    gap: 12,
  },
  icon: {
    fontSize: 48,
  },
  message: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttons: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptBtn: {},
  dismissBtn: {
    backgroundColor: '#374151',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  dismissText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});
