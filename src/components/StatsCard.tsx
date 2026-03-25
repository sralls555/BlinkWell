import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: string;
}

export default function StatsCard({ label, value, sub, color = '#6366f1', icon }: Props) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.top}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={[styles.value, { color }]}>{value}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    flex: 1,
    minWidth: 140,
    gap: 4,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 18,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
  },
  label: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  sub: {
    fontSize: 11,
    color: '#6b7280',
  },
});
