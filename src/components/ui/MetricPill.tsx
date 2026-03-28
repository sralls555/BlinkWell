import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '../../theme';

function Sparkline({
  data, color, width = 80, height = 28,
}: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pts}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </Svg>
  );
}

export interface MetricPillProps {
  label: string;
  value: string;
  color?: string;
  sublabel?: string;
  /** Last N readings for the mini sparkline */
  sparkline?: number[];
  style?: ViewStyle;
}

export function MetricPill({ label, value, color, sublabel, sparkline, style }: MetricPillProps) {
  const { colors } = useTheme();
  const c = color ?? colors.accent;

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.surfaceBorder },
        style,
      ]}
    >
      <Text style={[styles.label, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.value, { color: c }]}>{value}</Text>
      {sublabel ? (
        <Text style={[styles.sublabel, { color: colors.textTertiary }]}>{sublabel}</Text>
      ) : null}
      {sparkline && sparkline.length >= 2 ? (
        <View style={styles.sparklineWrap}>
          <Sparkline data={sparkline} color={c} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sublabel: {
    fontSize: 11,
  },
  sparklineWrap: {
    marginTop: 4,
  },
});
