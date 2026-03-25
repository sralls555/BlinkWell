import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  color?: string;
}

function ToggleRow({ label, description, value, onToggle, color = '#6366f1' }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#374151', true: color + '80' }}
        thumbColor={value ? color : '#6b7280'}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, updateSettings } = useAppStore();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interventions</Text>
          <View style={styles.card}>
            <ToggleRow
              label="Level 1 — Subtle Nudge"
              description="Soft edge pulse when blink rate drops slightly"
              value={settings.level1Enabled}
              onToggle={(v) => updateSettings({ level1Enabled: v })}
              color="#f59e0b"
            />
            <View style={styles.sep} />
            <ToggleRow
              label="Level 2 — Moderate Alert"
              description="Pop-up reminder when blink rate is low"
              value={settings.level2Enabled}
              onToggle={(v) => updateSettings({ level2Enabled: v })}
              color="#ef4444"
            />
            <View style={styles.sep} />
            <ToggleRow
              label="Level 3 — Strong Alert"
              description="Blur overlay and forced break prompt"
              value={settings.level3Enabled}
              onToggle={(v) => updateSettings({ level3Enabled: v })}
              color="#7c3aed"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Break Reminders</Text>
          <View style={styles.card}>
            <ToggleRow
              label="20-20-20 Rule"
              description="Auto-trigger eye break every 20 minutes of screen use"
              value={settings.twentyTwentyEnabled}
              onToggle={(v) => updateSettings({ twentyTwentyEnabled: v })}
              color="#22c55e"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          <View style={styles.card}>
            <ToggleRow
              label="Haptic Feedback"
              description="Vibration on interventions and breaks"
              value={settings.hapticFeedback}
              onToggle={(v) => updateSettings({ hapticFeedback: v })}
              color="#6366f1"
            />
            <View style={styles.sep} />
            <ToggleRow
              label="Deep Work Mode"
              description="Suppress all interventions during focus sessions"
              value={settings.deepWorkMode}
              onToggle={(v) => updateSettings({ deepWorkMode: v })}
              color="#3b82f6"
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About BlinkWell</Text>
          <Text style={styles.infoText}>
            BlinkWell monitors your screen time to intelligently detect reduced blinking behavior and intervene before eye strain sets in.{'\n\n'}
            Based on research: normal blink rate is 15–20/min. During screen use, this drops to 3–7/min — BlinkWell helps you maintain healthy eye habits.{'\n\n'}
            🔒 Privacy-first: all data stays on your device.
          </Text>
          <Text style={styles.version}>Version 1.0.0 MVP</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111827' },
  container: { padding: 20, gap: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '900', color: '#f9fafb' },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 15, color: '#f9fafb', fontWeight: '600' },
  toggleDesc: { fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 16 },
  sep: { height: 1, backgroundColor: '#374151', marginHorizontal: 16 },
  infoCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#818cf8' },
  infoText: { fontSize: 13, color: '#9ca3af', lineHeight: 22 },
  version: { fontSize: 11, color: '#4b5563' },
});
