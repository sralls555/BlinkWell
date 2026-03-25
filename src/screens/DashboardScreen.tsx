import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { analyticsService, SessionRecord } from '../services/AnalyticsService';
import StatsCard from '../components/StatsCard';
import { riskColor } from '../utils/timeUtils';

function BarChart({ records }: { records: SessionRecord[] }) {
  const maxStrain = Math.max(...records.map((r) => r.strainScore), 1);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.chart}>
      <Text style={styles.chartTitle}>Eye Strain Score (7 days)</Text>
      <View style={styles.bars}>
        {records
          .slice(0, 7)
          .reverse()
          .map((rec, i) => {
            const day = days[new Date(rec.date).getDay()];
            const barH = (rec.strainScore / 100) * 80;
            const color =
              rec.strainScore < 30
                ? '#22c55e'
                : rec.strainScore < 60
                ? '#f59e0b'
                : '#ef4444';
            return (
              <View key={i} style={styles.barCol}>
                <Text style={[styles.barValue, { color }]}>{rec.strainScore}</Text>
                <View style={[styles.bar, { height: Math.max(4, barH), backgroundColor: color }]} />
                <Text style={styles.barDay}>{day}</Text>
              </View>
            );
          })}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    analyticsService.load().then(() => {
      setRecords(analyticsService.getRecentRecords(7));
      setStreak(analyticsService.getStreak());
    });
  }, []);

  const today = analyticsService.getTodayRecord();
  const avgBlink = today?.avgBlinkRate ?? 15;
  const strainScore = today?.strainScore ?? 0;
  const totalBreaks = today?.breaksTaken ?? 0;
  const accepted = today?.interventionsAccepted ?? 0;
  const ignored = today?.interventionsIgnored ?? 0;
  const compliance =
    accepted + ignored > 0 ? Math.round((accepted / (accepted + ignored)) * 100) : 100;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Dashboard</Text>

        {/* Streak */}
        <View style={styles.streakCard}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <View>
            <Text style={styles.streakCount}>{streak} day streak</Text>
            <Text style={styles.streakSub}>Consecutive healthy blink days</Text>
          </View>
        </View>

        {/* Today Stats */}
        <Text style={styles.sectionTitle}>Today</Text>
        <View style={styles.grid}>
          <StatsCard
            label="Avg Blink Rate"
            value={`${avgBlink}/min`}
            color={avgBlink >= 12 ? '#22c55e' : avgBlink >= 8 ? '#f59e0b' : '#ef4444'}
            icon="👁️"
          />
          <StatsCard
            label="Strain Score"
            value={`${strainScore}`}
            sub="0 = best, 100 = worst"
            color={strainScore < 30 ? '#22c55e' : strainScore < 60 ? '#f59e0b' : '#ef4444'}
            icon="📊"
          />
        </View>
        <View style={styles.grid}>
          <StatsCard label="Breaks Taken" value={`${totalBreaks}`} icon="✋" color="#6366f1" />
          <StatsCard
            label="Compliance"
            value={`${compliance}%`}
            sub="Reminders accepted"
            color="#22d3ee"
            icon="✅"
          />
        </View>

        {/* Chart */}
        {records.length > 0 && <BarChart records={records} />}

        {/* Weekly Records Table */}
        {records.length > 0 && (
          <View style={styles.table}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            {records.map((rec, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tableDate}>{rec.date}</Text>
                <Text style={[styles.tableRate, { color: riskColor(rec.avgBlinkRate >= 12 ? 'LOW' : rec.avgBlinkRate >= 8 ? 'MEDIUM' : 'HIGH') }]}>
                  {rec.avgBlinkRate}/min
                </Text>
                <Text style={styles.tableTime}>{rec.totalScreenTimeMin}m screen</Text>
              </View>
            ))}
          </View>
        )}

        {records.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No data yet. Start a session to see your stats!</Text>
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
  sectionTitle: { fontSize: 14, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  streakCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  streakEmoji: { fontSize: 36 },
  streakCount: { fontSize: 22, fontWeight: '800', color: '#f59e0b' },
  streakSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  grid: { flexDirection: 'row', gap: 12 },
  chart: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  chartTitle: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
    paddingTop: 16,
  },
  barCol: { alignItems: 'center', flex: 1, gap: 4 },
  barValue: { fontSize: 10, fontWeight: '700' },
  bar: { width: 20, borderRadius: 4 },
  barDay: { fontSize: 10, color: '#6b7280' },
  table: { gap: 8 },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  tableDate: { color: '#9ca3af', fontSize: 13 },
  tableRate: { fontSize: 13, fontWeight: '700' },
  tableTime: { color: '#6b7280', fontSize: 12 },
  emptyCard: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#6b7280', textAlign: 'center', fontSize: 14 },
});
