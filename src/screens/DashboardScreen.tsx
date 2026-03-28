import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue, withTiming, withSpring,
  useAnimatedStyle, interpolate, Extrapolation,
} from 'react-native-reanimated';
import Svg, { Path, Rect, Line, Text as SvgText } from 'react-native-svg';

import { useTheme, riskColor } from '../theme';
import { analyticsService, type SessionRecord } from '../services/AnalyticsService';
import { useEyeHealth } from '../providers/EyeHealthProvider';
import { useScreenEntry } from '../hooks/useScreenEntry';

// ─── Bar chart ────────────────────────────────────────────────────────────────

const CHART_H = 110;
const CHART_W = 280;
const BAR_GAP = 6;

function BarChart({ records }: { records: SessionRecord[] }) {
  const { colors } = useTheme();
  const data = records.slice(0, 7).reverse();
  if (!data.length) return null;

  const maxStrain = Math.max(...data.map((r) => r.strainScore), 10);
  const barW = (CHART_W - BAR_GAP * (data.length - 1)) / data.length;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();

  return (
    <Svg width={CHART_W} height={CHART_H + 24}>
      {/* Baseline */}
      <Line
        x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H}
        stroke={colors.surfaceBorder} strokeWidth={1}
      />
      {data.map((rec, i) => {
        const x     = i * (barW + BAR_GAP);
        const barH  = Math.max(4, (rec.strainScore / maxStrain) * (CHART_H - 12));
        const y     = CHART_H - barH;
        const color = rec.strainScore < 30 ? colors.success
                    : rec.strainScore < 60 ? colors.warning
                    :                        colors.danger;
        const recDay   = new Date(rec.date).getDay();
        const isToday  = recDay === today && i === data.length - 1;

        return (
          <React.Fragment key={i}>
            <Rect
              x={x} y={y} width={barW} height={barH}
              rx={5} fill={color}
              opacity={isToday ? 1 : 0.55}
            />
            <SvgText
              x={x + barW / 2} y={CHART_H + 16}
              textAnchor="middle"
              fontSize={10} fill={isToday ? colors.textSecondary : colors.textTertiary}
              fontWeight={isToday ? '700' : '400'}
            >
              {isToday ? 'Today' : days[recDay]}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Trend line ───────────────────────────────────────────────────────────────

function TrendLine({ data, color, label }: { data: number[]; color: string; label: string }) {
  const { colors } = useTheme();
  if (data.length < 2) return null;
  const W = 220, H = 48;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H * 0.85 - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Svg width={W} height={H}>
        <Path
          d={`M ${pts.join(' L ')}`}
          stroke={color} strokeWidth={2.5}
          fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// ─── Animated stat card ───────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, delay = 0 }: {
  icon: string; label: string; value: string; color: string; delay?: number;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);
  const tx      = useSharedValue(12);

  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 400 });
      tx.value      = withSpring(0, { damping: 16, stiffness: 120 });
    }, delay);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: tx.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.statCard,
        style,
        { backgroundColor: colors.surfaceRaised, borderColor: color + '30' },
      ]}
    >
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ─── DashboardScreen ──────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { colors }  = useTheme();
  const { containerStyle } = useScreenEntry();
  const { riskLevel, riskScore } = useEyeHealth();
  const [records,  setRecords]  = useState<SessionRecord[]>([]);
  const [streak,   setStreak]   = useState(0);
  const [tab,      setTab]      = useState<'week' | 'trends'>('week');

  useEffect(() => {
    analyticsService.load().then(() => {
      setRecords(analyticsService.getRecentRecords(7));
      setStreak(analyticsService.getStreak());
    });
  }, []);

  const today   = analyticsService.getTodayRecord();
  const score   = Math.round((1 - Math.min(riskScore, 1)) * 100);
  const blinkHistory = records.map((r) => r.avgBlinkRate).reverse();
  const strainHistory = records.map((r) => r.strainScore).reverse();

  return (
    <Animated.View style={[styles.root, { backgroundColor: colors.background }, containerStyle]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Title ──────────────────────────────────────────────────── */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Analytics</Text>
          <View style={[styles.liveBadge, { backgroundColor: colors.success + '20', borderColor: colors.success + '40' }]}>
            <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.liveText, { color: colors.success }]}>Live</Text>
          </View>
        </View>

        {/* ── Streak hero ─────────────────────────────────────────────── */}
        <View style={[styles.streakHero, { backgroundColor: colors.surfaceRaised }]}>
          <View>
            <Text style={styles.streakNum}>{streak}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
            <Text style={styles.streakSub}>Consecutive healthy sessions</Text>
          </View>
          <Text style={styles.streakFlame}>
            {streak >= 7 ? '🔥🔥' : streak >= 3 ? '🔥' : '💧'}
          </Text>
        </View>

        {/* ── Today stat cards ─────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Today</Text>
        <View style={styles.statGrid}>
          <StatCard icon="👁️" label="Blink Rate" value={today ? `${today.avgBlinkRate}/m` : '—'} color={colors.accent}    delay={0}   />
          <StatCard icon="🎯" label="Health Score" value={String(score)}                          color={colors.success}  delay={80}  />
          <StatCard icon="✋" label="Breaks"       value={today ? String(today.breaksTaken) : '0'} color={colors.warning}  delay={160} />
          <StatCard icon="📊" label="Strain"       value={today ? String(today.strainScore) : '0'} color={colors.danger}   delay={240} />
        </View>

        {/* ── Tab switcher ─────────────────────────────────────────────── */}
        <View style={[styles.tabs, { backgroundColor: colors.surfaceRaised }]}>
          {(['week', 'trends'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[
                styles.tab,
                tab === t && { backgroundColor: colors.accent + '25' },
              ]}
            >
              <Text style={[
                styles.tabText,
                { color: tab === t ? colors.accent : colors.textTertiary },
              ]}>
                {t === 'week' ? '7-Day Chart' : 'Trends'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Week chart ───────────────────────────────────────────────── */}
        {tab === 'week' && (
          <View style={[styles.chartCard, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={styles.chartTitle}>Eye Strain Score</Text>
            <Text style={styles.chartSub}>Lower is better · scale 0–100</Text>
            {records.length > 0
              ? <BarChart records={records} />
              : <Text style={styles.emptyText}>No data yet. Keep using BlinkWell!</Text>
            }
          </View>
        )}

        {/* ── Trends ──────────────────────────────────────────────────── */}
        {tab === 'trends' && (
          <View style={[styles.chartCard, { backgroundColor: colors.surfaceRaised, gap: 24 }]}>
            {blinkHistory.length >= 2
              ? <TrendLine data={blinkHistory} color={colors.accent} label="Blink Rate (avg/min)" />
              : null}
            {strainHistory.length >= 2
              ? <TrendLine data={strainHistory} color={colors.danger} label="Strain Score" />
              : null}
            {blinkHistory.length < 2 && (
              <Text style={styles.emptyText}>Need 2+ sessions to show trends.</Text>
            )}
          </View>
        )}

        {/* ── Recent sessions ──────────────────────────────────────────── */}
        {records.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            {records.slice(0, 5).map((rec, i) => {
              const rc = rec.strainScore < 30 ? colors.success
                       : rec.strainScore < 60 ? colors.warning
                       :                        colors.danger;
              return (
                <View
                  key={i}
                  style={[styles.sessionRow, { backgroundColor: colors.surfaceRaised, borderLeftColor: rc }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionDate}>{rec.date}</Text>
                    <Text style={styles.sessionDetail}>
                      {rec.totalScreenTimeMin}m screen · {rec.breaksTaken} breaks
                    </Text>
                  </View>
                  <View style={styles.sessionRight}>
                    <Text style={[styles.sessionBlink, { color: rc }]}>
                      {rec.avgBlinkRate}/min
                    </Text>
                    <Text style={styles.sessionStrain}>strain {rec.strainScore}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {records.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySub}>Your stats will appear after your first session.</Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48, gap: 16 },

  titleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:       { fontSize: 28, fontWeight: '900', color: '#F1F5FF', letterSpacing: -0.5 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11, fontWeight: '700' },

  streakHero: {
    borderRadius: 22, padding: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  streakNum:   { fontSize: 52, fontWeight: '900', color: '#FBBF24', letterSpacing: -2, lineHeight: 56 },
  streakLabel: { fontSize: 16, fontWeight: '700', color: '#F1F5FF' },
  streakSub:   { fontSize: 12, color: '#4A5578', marginTop: 2 },
  streakFlame: { fontSize: 48 },

  sectionTitle: {
    fontSize: 11, color: '#4A5578', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 4,
  },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%', borderRadius: 18, padding: 16,
    gap: 4, borderWidth: 1,
  },
  statIcon:  { fontSize: 22 },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: '#4A5578', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  tabs:      { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  tab:       { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  tabText:   { fontSize: 13, fontWeight: '600' },

  chartCard: { borderRadius: 20, padding: 20, alignItems: 'center', gap: 12 },
  chartTitle: { fontSize: 15, fontWeight: '700', color: '#F1F5FF', alignSelf: 'flex-start' },
  chartSub:   { fontSize: 11, color: '#4A5578', alignSelf: 'flex-start', marginBottom: 4 },
  emptyText:  { color: '#4A5578', fontSize: 13, textAlign: 'center', paddingVertical: 20 },

  sessionRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 14, borderLeftWidth: 3, gap: 12,
  },
  sessionDate:   { fontSize: 13, color: '#8B9CC8', fontWeight: '500' },
  sessionDetail: { fontSize: 11, color: '#4A5578', marginTop: 2 },
  sessionRight:  { alignItems: 'flex-end' },
  sessionBlink:  { fontSize: 15, fontWeight: '700' },
  sessionStrain: { fontSize: 11, color: '#4A5578', marginTop: 2 },

  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#F1F5FF' },
  emptySub:   { fontSize: 13, color: '#4A5578', textAlign: 'center' },
});
