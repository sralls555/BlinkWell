/**
 * SparklineChart — pure SVG signal line, no axes, no labels
 *
 * Spec: react-native-svg polyline of last N data points
 * props: data: number[], color, width, height
 */
import React from 'react';
import Svg, { Polyline } from 'react-native-svg';

export interface SparklineChartProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}

export function SparklineChart({
  data,
  color,
  width = 100,
  height = 32,
  strokeWidth = 1.5,
}: SparklineChartProps) {
  if (data.length < 2) return null;

  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </Svg>
  );
}
