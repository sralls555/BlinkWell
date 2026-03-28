/**
 * EyeHealthSettings — camera toggle, deep work mode, today's stats, reset
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue, withTiming, useAnimatedStyle, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
import { useEyeHealth } from '../providers/EyeHealthProvider';
import { useScreenEntry } from '../hooks/useScreenEntry';
import { analyticsService, type SessionRecord } from '../services/AnalyticsService';
import { breakManager, type InterventionLog } from '../interventions/BreakManager';
import { SESSIONS_STORAGE_KEY } from '../sensing/BehaviorSensor';
import { SectionHeader } from '../components/ui/SectionHeader';
import { CustomToggle } from '../components/ui/CustomToggle';
import CameraPermissionScreen from './CameraPermissionScreen';

// ─── Row components ────────────────────────────────────────────────────────────

function SettingRow({
  icon, label, desc, control, onPress, index = 0,
}: {
  icon: string; label: string; desc?: string;
  control: React.ReactNode;
  onPress?: () => void;
  index?: number;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);
  const transY  = useSharedValue(12);

  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      transY.value  = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
    }, index * 40);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: transY.value }],
  }));

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Animated.View
        style={[
          styles.settingRow,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.surfaceBorder },
          style,
        ]}
      >
        {/* Icon bubble */}
        <View style={[styles.iconBubble, { backgroundColor: colors.accent + '18' }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>

        {/* Label */}
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
          {desc ? <Text style={[styles.rowDesc, { color: colors.textTertiary }]}>{desc}</Text> : null}
        </View>

        {/* Control */}
        <View style={styles.rowControl}>{control}</View>
      </Animated.View>
    </Pressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />;
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label, value, color, index = 0,
}: { label: string; value: string; color?: string; index?: number }) {
  const { colors } = useTheme();
  const c = color ?? colors.accent;

  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.9);

  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value   = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    }, index * 60);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.statTile,
        { backgroundColor: colors.surfaceRaised, borderColor: c + '30' },
        style,
      ]}
    >
      <Text style={[styles.tileValue, { color: c }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: colors.textTertiary }]}>{label}</Text>
    </Animated.View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function EyeHealthSettings() {
  const { colors } = useTheme();
  const { containerStyle } = useScreenEntry();
  const {
    isCameraActive, deepWorkMode, blinksPerMinute, sessionMinutes, signalSource,
    enableCamera, disableCamera, setDeepWorkMode,
  } = useEyeHealth();

  const [today,            setToday]            = useState<SessionRecord | null>(null);
  const [interventionLogs, setInterventionLogs] = useState<InterventionLog[]>([]);
  const [cameraLoading,    setCameraLoading]    = useState(false);
  const [showPermScreen,   setShowPermScreen]   = useState(false);

  const loadStats = useCallback(async () => {
    await analyticsService.load();
    setToday(analyticsService.getTodayRecord());
    setInterventionLogs(await breakManager.getLogs(20));
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Camera toggle ─────────────────────────────────────────────────────────

  const handleCameraToggle = useCallback((enable: boolean) => {
    if (enable) {
      setShowPermScreen(true);
    } else {
      disableCamera();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [disableCamera]);

  const handleEnableCamera = useCallback(async () => {
    setShowPermScreen(false);
    setCameraLoading(true);
    const granted = await enableCamera();
    setCameraLoading(false);
    if (!granted) {
      Alert.alert(
        'Camera Permission Required',
        'Go to Settings → BlinkWell → Camera and enable access.',
        [{ text: 'OK' }]
      );
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [enableCamera]);

  // ── Deep work toggle ──────────────────────────────────────────────────────

  const handleDeepWorkToggle = useCallback(async (enable: boolean) => {
    await setDeepWorkMode(enable);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [setDeepWorkMode]);

  // ── Reset today ───────────────────────────────────────────────────────────

  const handleResetToday = useCallback(() => {
    Alert.alert(
      "Reset Today's Data",
      "This will clear today's session stats. Continue?",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: async () => {
            const todayDate = new Date().toISOString().split('T')[0];
            try {
              const raw = await AsyncStorage.getItem('blinkwell_analytics');
              if (raw) {
                const recs = JSON.parse(raw).filter((r: SessionRecord) => r.date !== todayDate);
                await AsyncStorage.setItem('blinkwell_analytics', JSON.stringify(recs));
              }
              await AsyncStorage.removeItem(SESSIONS_STORAGE_KEY);
            } catch {}
            await loadStats();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [loadStats]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const todayBreaks = interventionLogs.filter(
    (l) => l.outcome === 'completed' && Date.now() - l.timestamp < 86_400_000
  ).length;

  const todayIgnored = interventionLogs.filter(
    (l) => l.outcome === 'auto_dismissed' || l.outcome === 'ignored'
  ).length;

  const complianceRate = todayBreaks + todayIgnored > 0
    ? Math.round((todayBreaks / (todayBreaks + todayIgnored)) * 100)
    : 100;

  const signalIsCamera = signalSource === 'camera';

  return (
    <Animated.View style={[styles.root, { backgroundColor: colors.background }, containerStyle]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Title ──────────────────────────────────────────────────── */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>Settings</Text>

        {/* ── Today stat tiles ─────────────────────────────────────────── */}
        <View style={styles.statRow}>
          <StatTile
            label="Breaks today"
            value={String(todayBreaks)}
            color={colors.success}
            index={0}
          />
          <StatTile
            label="Avg blink rate"
            value={today ? `${today.avgBlinkRate}/m` : '—'}
            color={colors.accent}
            index={1}
          />
          <StatTile
            label="Compliance"
            value={`${complianceRate}%`}
            color={colors.warning}
            index={2}
          />
        </View>

        {/* ── Detection ──────────────────────────────────────────────── */}
        <SectionHeader title="Detection Mode" />

        <View style={[styles.group, { borderColor: colors.surfaceBorder }]}>
          <SettingRow
            index={0}
            icon="📷"
            label="Camera Blink Detection"
            desc={isCameraActive
              ? `${blinksPerMinute}/min detected`
              : 'Measures real blink rate'}
            control={
              <CustomToggle
                value={isCameraActive}
                onValueChange={handleCameraToggle}
                disabled={cameraLoading}
                activeColor={colors.accent}
              />
            }
          />
          <Divider />
          <SettingRow
            index={1}
            icon={signalIsCamera ? '📷' : '⏱'}
            label="Signal source"
            control={
              <View style={[
                styles.badge,
                { backgroundColor: signalIsCamera ? colors.accent + '20' : colors.surfaceBorder },
              ]}>
                <Text style={[
                  styles.badgeText,
                  { color: signalIsCamera ? colors.accent : colors.textTertiary },
                ]}>
                  {signalIsCamera ? 'Camera' : 'Behavior'}
                </Text>
              </View>
            }
          />
          <Divider />
          <SettingRow
            index={2}
            icon="⏳"
            label="Session time"
            control={
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                {Math.round(sessionMinutes)}m
              </Text>
            }
          />
        </View>

        {/* ── Focus ──────────────────────────────────────────────────── */}
        <SectionHeader title="Focus" />

        <View style={[styles.group, { borderColor: colors.surfaceBorder }]}>
          <SettingRow
            index={3}
            icon="🧘"
            label="Deep Work Mode"
            desc={deepWorkMode
              ? 'L1 & L2 alerts silenced for 25 min'
              : 'Suppress subtle nudges when focused'}
            control={
              <CustomToggle
                value={deepWorkMode}
                onValueChange={handleDeepWorkToggle}
                activeColor={colors.accent}
              />
            }
          />
          {deepWorkMode && (
            <View style={[styles.infoNote, { backgroundColor: colors.accent + '12' }]}>
              <Text style={[styles.infoNoteText, { color: colors.accent }]}>
                ⚡ Level 3 alerts and 20-20-20 breaks still fire in deep work mode.
              </Text>
            </View>
          )}
        </View>

        {/* ── Privacy ────────────────────────────────────────────────── */}
        <SectionHeader title="Privacy" />

        <View style={[styles.group, { borderColor: colors.surfaceBorder }]}>
          <SettingRow
            index={4}
            icon="🔒"
            label="On-device only"
            desc="No video is stored or transmitted"
            control={
              <View style={[styles.badge, { backgroundColor: colors.success + '20' }]}>
                <Text style={[styles.badgeText, { color: colors.success }]}>Active</Text>
              </View>
            }
          />
        </View>

        {/* ── Data ───────────────────────────────────────────────────── */}
        <SectionHeader title="Data" />

        <View style={[styles.group, { borderColor: colors.surfaceBorder }]}>
          <Pressable
            onPress={handleResetToday}
            style={({ pressed }) => [styles.dangerRow, { opacity: pressed ? 0.65 : 1 }]}
          >
            <View style={[styles.iconBubble, { backgroundColor: colors.danger + '18' }]}>
              <Text style={styles.iconText}>🗑</Text>
            </View>
            <Text style={[styles.rowLabel, { color: colors.danger, flex: 1 }]}>
              Reset Today's Data
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.version, { color: colors.textTertiary }]}>
          BlinkWell v1.0.0 · All data stays on your device
        </Text>
      </ScrollView>

      {/* Camera permission modal */}
      <CameraPermissionScreen
        visible={showPermScreen}
        onEnable={handleEnableCamera}
        onSkip={() => setShowPermScreen(false)}
      />
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48, gap: 12 },

  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },

  // Stat tiles
  statRow: { flexDirection: 'row', gap: 10 },
  statTile: {
    flex: 1, borderRadius: 16, padding: 14,
    alignItems: 'center', gap: 4, borderWidth: 1,
  },
  tileValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  tileLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },

  // Setting rows grouped
  group: { borderRadius: 20, overflow: 'hidden', borderWidth: 1 },

  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 56, paddingHorizontal: 16, gap: 12, borderWidth: 0,
  },
  iconBubble: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 17 },
  rowLabel:   { fontSize: 15, fontWeight: '600' },
  rowDesc:    { fontSize: 12, marginTop: 1 },
  rowControl: { alignItems: 'flex-end' },

  divider: { height: 1, marginHorizontal: 16 },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  infoValue: { fontSize: 14, fontWeight: '600' },

  infoNote: {
    marginHorizontal: 16, marginBottom: 10, borderRadius: 10, padding: 10,
  },
  infoNoteText: { fontSize: 12, lineHeight: 18 },

  dangerRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 56, paddingHorizontal: 16, gap: 12,
  },

  version: { textAlign: 'center', fontSize: 11, marginTop: 8 },
});
