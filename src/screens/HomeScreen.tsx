import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedProps,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { useScreenEntry } from '../hooks/useScreenEntry';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { useEyeHealth } from '../providers/EyeHealthProvider';
import { useTheme, riskColor, riskColorSoft, scoreToFeeling } from '../theme';
import { sessionService } from '../services/SessionService';
import { notificationService } from '../services/NotificationService';
import { analyticsService } from '../services/AnalyticsService';
import { breakManager } from '../interventions/BreakManager';
import { formatDuration } from '../utils/timeUtils';

// ─── Animated SVG primitives ──────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Health ring constants ────────────────────────────────────────────────────

const RING_SIZE       = 210;
const RING_STROKE     = 14;
const RING_RADIUS     = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMF    = 2 * Math.PI * RING_RADIUS;

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color, width = 80, height = 28 }: {
  data: number[]; color: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  return (
    <Svg width={width} height={height}>
      <Path
        d={`M ${pts.join(' L ')}`}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
    </Svg>
  );
}

// ─── Health ring ──────────────────────────────────────────────────────────────

function HealthRing({ score, riskLvl }: { score: number; riskLvl: string }) {
  const { colors } = useTheme();
  const progress   = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  // Count-up animation for the number
  const [displayScore, setDisplayScore] = useState(0);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const target = score;
    let current  = 0;
    if (countRef.current) clearInterval(countRef.current);
    countRef.current = setInterval(() => {
      current = Math.min(current + 2, target);
      setDisplayScore(current);
      if (current >= target) clearInterval(countRef.current!);
    }, 18);

    progress.value = withSpring(score / 100, {
      damping: 18, stiffness: 60, mass: 1.2,
    });
    glowOpacity.value = withTiming(1, { duration: 800 });

    return () => { if (countRef.current) clearInterval(countRef.current); };
  }, [score]);

  const ringColor = score >= 70 ? colors.success
                  : score >= 40 ? colors.warning
                  :               colors.danger;

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMF * (1 - progress.value),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const feeling = scoreToFeeling(score);

  return (
    <View style={styles.ringContainer}>
      {/* Ambient glow behind ring */}
      <Animated.View
        style={[
          styles.ringGlow,
          glowStyle,
          { backgroundColor: ringColor + '18' },
        ]}
      />

      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={ringColor} stopOpacity={1} />
            <Stop offset="100%" stopColor={ringColor + 'AA'} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
          stroke={colors.surfaceRaised}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        {/* Progress */}
        <AnimatedCircle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
          stroke={ringColor}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMF}
          animatedProps={animatedProps}
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>

      {/* Center content */}
      <View style={styles.ringCenter}>
        <Text style={[styles.ringScore, { color: ringColor }]}>{displayScore}</Text>
        <Text style={styles.ringScoreLabel}>Health Score</Text>
        <View style={[styles.feelingPill, { backgroundColor: ringColor + '20' }]}>
          <Text style={[styles.feelingText, { color: ringColor }]}>
            Feeling {feeling}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Metric pill ──────────────────────────────────────────────────────────────

function MetricPill({
  icon, label, value, sub, color, sparkData,
}: {
  icon: string; label: string; value: string;
  sub?: string; color: string; sparkData?: number[];
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: colors.surfaceRaised }]}>
      <View style={styles.pillTop}>
        <Text style={styles.pillIcon}>{icon}</Text>
        <Text style={[styles.pillValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.pillLabel}>{label}</Text>
      {sparkData && sparkData.length >= 2 && (
        <View style={styles.pillSpark}>
          <Sparkline data={sparkData} color={color} width={72} height={22} />
        </View>
      )}
      {sub && <Text style={styles.pillSub}>{sub}</Text>}
    </View>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionButton({
  icon, label, color, onPress,
}: {
  icon: string; label: string; color: string; onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.94, { damping: 15 }, () => {
      scale.value = withSpring(1, { damping: 12 });
    });
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={{ flex: 1 }}>
      <Animated.View
        style={[
          styles.actionBtn,
          animStyle,
          { backgroundColor: color + '1A', borderColor: color + '40' },
        ]}
      >
        <Text style={styles.actionIcon}>{icon}</Text>
        <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors, spacing, radius } = useTheme();
  const { containerStyle } = useScreenEntry();
  const {
    riskLevel, riskScore, blinksPerMinute, sessionMinutes,
    isCameraActive, deepWorkMode, recommendation, signalSource,
    setDeepWorkMode,
  } = useEyeHealth();

  // Blink rate history for sparkline (last 10 readings from analytics)
  const [sparkData, setSparkData] = useState<number[]>([]);
  const [sessionStats, setSessionStats] = useState({
    timeSinceBreakMs: 0,
    sessionDurationMs: 0,
  });

  const score = Math.round((1 - Math.min(riskScore, 1)) * 100);
  const rc    = riskColor(riskLevel);

  useEffect(() => {
    analyticsService.load().then(() => {
      const records = analyticsService.getRecentRecords(10);
      if (records.length) setSparkData(records.map((r) => r.avgBlinkRate).reverse());
    });

    const unsub = sessionService.subscribe((stats) => {
      setSessionStats({
        timeSinceBreakMs:  stats.timeSinceBreakMs,
        sessionDurationMs: stats.sessionDurationMs,
      });
    });
    sessionService.start();
    return () => { unsub(); sessionService.stop(); };
  }, []);

  const handleBreak = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sessionService.recordBreak();
    notificationService.rescheduleFromNow(20);
  }, []);

  const handleTwentyTwenty = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    breakManager.triggerTwentyTwenty();
  }, []);

  const sessionTime = formatDuration(sessionStats.sessionDurationMs);
  const breakTime   = formatDuration(sessionStats.timeSinceBreakMs);

  return (
    <Animated.View style={[styles.root, { backgroundColor: colors.background }, containerStyle]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>BlinkWell</Text>
            <Text style={styles.appSub}>
              {signalSource === 'camera' ? '📷 Camera mode' : '⏱ Behavior mode'}
            </Text>
          </View>
          <Pressable
            onPress={() => setDeepWorkMode(!deepWorkMode)}
            style={[
              styles.deepWorkChip,
              {
                backgroundColor: deepWorkMode ? colors.accent + '25' : colors.surfaceRaised,
                borderColor:     deepWorkMode ? colors.accent + '60' : colors.surfaceBorder,
              },
            ]}
          >
            <Text style={[
              styles.deepWorkText,
              { color: deepWorkMode ? colors.accent : colors.textTertiary },
            ]}>
              {deepWorkMode ? '🧠 Focus' : '🧠 Focus'}
            </Text>
          </Pressable>
        </View>

        {/* ── Health ring ──────────────────────────────────────────── */}
        <HealthRing score={score} riskLvl={riskLevel} />

        {/* ── Metric pills ─────────────────────────────────────────── */}
        <View style={styles.pillRow}>
          <MetricPill
            icon="👁️"
            label="Blink Rate"
            value={isCameraActive ? `${blinksPerMinute}/min` : '—/min'}
            sub={isCameraActive ? undefined : 'Enable camera'}
            color={
              blinksPerMinute >= 12 ? colors.success
              : blinksPerMinute >= 6 ? colors.warning
              : colors.danger
            }
            sparkData={sparkData.length >= 2 ? sparkData : undefined}
          />
          <MetricPill
            icon="⏱"
            label="Break in"
            value={breakTime}
            sub="since last break"
            color={
              sessionStats.timeSinceBreakMs < 5 * 60_000  ? colors.success
              : sessionStats.timeSinceBreakMs < 15 * 60_000 ? colors.warning
              : colors.danger
            }
          />
        </View>

        {/* ── Risk status card ─────────────────────────────────────── */}
        <View style={[
          styles.riskCard,
          { backgroundColor: rc + '12', borderColor: rc + '35' },
        ]}>
          <View style={[styles.riskDot, { backgroundColor: rc }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.riskTitle, { color: rc }]}>
              {riskLevel === 'low'    ? 'Eyes are healthy'
               : riskLevel === 'medium' ? 'Blink rate dropping'
               :                          'Take a break now'}
            </Text>
            <Text style={styles.riskDesc} numberOfLines={2}>{recommendation}</Text>
          </View>
        </View>

        {/* ── Session bar ──────────────────────────────────────────── */}
        <View style={[styles.sessionCard, { backgroundColor: colors.surfaceRaised }]}>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>Session</Text>
            <Text style={[styles.sessionValue, { color: colors.accent }]}>{sessionTime}</Text>
          </View>
          <View style={styles.sessionBarBg}>
            <View
              style={[
                styles.sessionBarFill,
                {
                  width: `${Math.min((sessionStats.sessionDurationMs / (60 * 60_000)) * 100, 100)}%`,
                  backgroundColor: colors.accent,
                },
              ]}
            />
          </View>
          <Text style={styles.sessionBarLabel}>1 hour target</Text>
        </View>

        {/* ── Action buttons ───────────────────────────────────────── */}
        <View style={styles.actionRow}>
          <ActionButton
            icon="✋"
            label="Took a Break"
            color={colors.success}
            onPress={handleBreak}
          />
          <ActionButton
            icon="👁️"
            label="20-20-20"
            color={colors.accent}
            onPress={handleTwentyTwenty}
          />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:       { flex: 1 },
  scroll:     { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48, gap: 18 },

  // Header
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appTitle:      { fontSize: 26, fontWeight: '800', color: '#F1F5FF', letterSpacing: -0.5 },
  appSub:        { fontSize: 12, color: '#4A5578', marginTop: 2 },
  deepWorkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
  },
  deepWorkText: { fontSize: 13, fontWeight: '600' },

  // Ring
  ringContainer: {
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginVertical: 8,
  },
  ringGlow: {
    position: 'absolute',
    width: RING_SIZE + 40, height: RING_SIZE + 40,
    borderRadius: (RING_SIZE + 40) / 2,
  },
  ringCenter: {
    position: 'absolute', alignItems: 'center', gap: 4,
  },
  ringScore:      { fontSize: 54, fontWeight: '900', letterSpacing: -2, lineHeight: 58 },
  ringScoreLabel: { fontSize: 12, color: '#4A5578', fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' },
  feelingPill:    { marginTop: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  feelingText:    { fontSize: 12, fontWeight: '700' },

  // Pills
  pillRow:   { flexDirection: 'row', gap: 12 },
  pill: {
    flex: 1, borderRadius: 20, padding: 16, gap: 6,
    borderWidth: 1, borderColor: '#1F2D45',
  },
  pillTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pillIcon:  { fontSize: 18 },
  pillValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  pillLabel: { fontSize: 11, color: '#4A5578', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  pillSpark: { marginTop: 2 },
  pillSub:   { fontSize: 11, color: '#4A5578' },

  // Risk card
  riskCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 14, borderWidth: 1,
  },
  riskDot:   { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  riskTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  riskDesc:  { fontSize: 12, color: '#8B9CC8', lineHeight: 18 },

  // Session card
  sessionCard: { borderRadius: 16, padding: 16, gap: 8 },
  sessionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionLabel: { fontSize: 13, color: '#8B9CC8', fontWeight: '500' },
  sessionValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  sessionBarBg: { height: 5, backgroundColor: '#1F2D45', borderRadius: 999, overflow: 'hidden' },
  sessionBarFill: { height: 5, borderRadius: 999 },
  sessionBarLabel: { fontSize: 11, color: '#4A5578', textAlign: 'right' },

  // Actions
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', gap: 6,
    borderWidth: 1,
  },
  actionIcon:  { fontSize: 22 },
  actionLabel: { fontSize: 13, fontWeight: '700' },
});
