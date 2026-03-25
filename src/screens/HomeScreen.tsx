import React, { useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { sessionService } from '../services/SessionService';
import { interventionEngine } from '../services/InterventionEngine';
import { notificationService } from '../services/NotificationService';
import { useAppStore } from '../store/useAppStore';
import RiskIndicator from '../components/RiskIndicator';
import InterventionOverlay from '../components/InterventionOverlay';
import TwentyTwentyTimer from '../components/TwentyTwentyTimer';
import { formatDuration, riskColor } from '../utils/timeUtils';

export default function HomeScreen() {
  const {
    session,
    setSession,
    intervention,
    setIntervention,
    dismissIntervention,
    settings,
    setTwentyTwenty,
    twentyTwentyActive,
  } = useAppStore();

  const twentyTwentyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    sessionService.start();

    const unsub = sessionService.subscribe((stats) => {
      setSession(stats);

      // 20-20-20 rule: trigger every 20 minutes of continuous use
      if (settings.twentyTwentyEnabled && stats.timeSinceBreakMs >= 20 * 60 * 1000 && !twentyTwentyActive) {
        setTwentyTwenty(true);
        sessionService.recordBreak();
        return;
      }

      // Evaluate intervention
      if (!settings.deepWorkMode) {
        const intv = interventionEngine.evaluate(stats.riskLevel, stats.timeSinceBreakMs);
        if (intv.show) {
          setIntervention(intv);
        }
      }
    });

    return () => {
      unsub();
      sessionService.stop();
    };
  }, [settings.deepWorkMode, settings.twentyTwentyEnabled]);

  const handleInterventionAccept = () => {
    interventionEngine.recordAccepted();
    if (intervention.level === 3) {
      setTwentyTwenty(true);
    }
    sessionService.recordBreak();
    notificationService.rescheduleFromNow(20);
    dismissIntervention();
  };

  const handleInterventionDismiss = () => {
    interventionEngine.recordIgnored();
    dismissIntervention();
  };

  const timeSinceBreak = session ? formatDuration(session.timeSinceBreakMs) : '0s';
  const sessionTime = session ? formatDuration(session.sessionDurationMs) : '0s';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>BlinkWell</Text>
          {settings.deepWorkMode && (
            <View style={styles.deepWorkBadge}>
              <Text style={styles.deepWorkText}>Deep Work</Text>
            </View>
          )}
        </View>

        {/* Risk Indicator */}
        <View style={styles.section}>
          <RiskIndicator
            level={session?.riskLevel ?? 'LOW'}
            blinkRate={session?.estimatedBlinkRate ?? 15}
          />
        </View>

        {/* Time Stats */}
        <View style={styles.row}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{timeSinceBreak}</Text>
            <Text style={styles.statLabel}>Since Last Break</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{sessionTime}</Text>
            <Text style={styles.statLabel}>Session Time</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.breakBtn}
          onPress={() => {
            sessionService.recordBreak();
            notificationService.rescheduleFromNow(20);
            if (settings.hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <Text style={styles.breakBtnText}>✋ I Took a Break</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.twentyBtn}
          onPress={() => {
            setTwentyTwenty(true);
            sessionService.recordBreak();
          }}
        >
          <Text style={styles.twentyBtnText}>👁️ Start 20-20-20</Text>
        </TouchableOpacity>

        {/* Blink Tips */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Did you know?</Text>
          <Text style={styles.tipText}>
            Normal blink rate is 15–20/min. During screen use, it drops to 3–7/min, leading to dry eyes and strain.
          </Text>
        </View>

        {/* Intervention Risk Info */}
        {session && session.riskLevel !== 'LOW' && (
          <View style={[styles.riskBanner, { borderColor: riskColor(session.riskLevel) }]}>
            <Text style={[styles.riskBannerText, { color: riskColor(session.riskLevel) }]}>
              {session.riskLevel === 'MEDIUM' && '⚠️ Your blink rate is below normal. Remember to blink!'}
              {session.riskLevel === 'HIGH' && '🔴 High eye strain risk. Consider blinking consciously or taking a break.'}
              {session.riskLevel === 'CRITICAL' && '🚨 Critical strain level. Please take a 20-second eye break now.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Overlays */}
      <InterventionOverlay
        level={intervention.level}
        message={intervention.message}
        visible={intervention.show}
        onAccept={handleInterventionAccept}
        onDismiss={handleInterventionDismiss}
      />
      <TwentyTwentyTimer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#111827',
  },
  container: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#f9fafb',
    letterSpacing: -0.5,
  },
  deepWorkBadge: {
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  deepWorkText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f9fafb',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#374151',
    marginHorizontal: 16,
  },
  breakBtn: {
    backgroundColor: '#065f46',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22c55e44',
  },
  breakBtnText: {
    color: '#22c55e',
    fontSize: 17,
    fontWeight: '700',
  },
  twentyBtn: {
    backgroundColor: '#1e1b4b',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366f144',
  },
  twentyBtnText: {
    color: '#818cf8',
    fontSize: 17,
    fontWeight: '700',
  },
  tipCard: {
    backgroundColor: '#1f2937',
    borderRadius: 14,
    padding: 16,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  tipTitle: {
    color: '#818cf8',
    fontWeight: '700',
    fontSize: 13,
  },
  tipText: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 20,
  },
  riskBanner: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    backgroundColor: '#1f2937',
  },
  riskBannerText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
});
