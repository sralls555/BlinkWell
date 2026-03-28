/**
 * MetricTile — GlowCard with SectionHeader-style label + large value
 *              + optional SparklineChart
 *
 * Spec: label, value, unit?, sparkData?, accentColor?
 */
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { GlowCard } from './GlowCard';
import { SparklineChart } from './SparklineChart';

export interface MetricTileProps {
  label: string;
  value: string | number;
  unit?: string;
  sparkData?: number[];
  accentColor?: string;
  style?: ViewStyle;
}

export function MetricTile({ label, value, unit, sparkData, accentColor, style }: MetricTileProps) {
  const { colors, fontSizes } = useTheme();
  const color = accentColor ?? colors.accent;

  return (
    <GlowCard glowColor={color} padding={14} style={style}>
      {/* Label — SectionHeader style */}
      <Text style={[styles.label, { color: colors.textTertiary }]}>{label}</Text>

      {/* Value row */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        {unit ? (
          <Text style={[styles.unit, { color: colors.textTertiary }]}>{unit}</Text>
        ) : null}
      </View>

      {/* Sparkline */}
      {sparkData && sparkData.length >= 2 ? (
        <View style={styles.sparklineWrap}>
          <SparklineChart data={sparkData} color={color} width={90} height={28} />
        </View>
      ) : null}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.12,
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  value: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  unit: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 3,
  },
  sparklineWrap: {
    marginTop: 6,
  },
});
