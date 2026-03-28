import React, { useEffect } from 'react';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, withTiming, useAnimatedProps, Easing,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface AnimatedRingProps {
  size: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  /** 0–1 fill progress */
  progress: number;
  duration?: number;
}

export function AnimatedRing({
  size,
  strokeWidth = 8,
  color,
  trackColor = 'rgba(255,255,255,0.07)',
  progress,
  duration = 1200,
}: AnimatedRingProps) {
  const R = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * R;
  const offset = useSharedValue(circumference);

  useEffect(() => {
    offset.value = withTiming(circumference * (1 - Math.min(1, Math.max(0, progress))), {
      duration,
      easing: Easing.out(Easing.exp),
    });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  const cx = size / 2;
  const cy = size / 2;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={cx} cy={cy} r={R}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <AnimatedCircle
        cx={cx} cy={cy} r={R}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        animatedProps={animatedProps}
        strokeLinecap="round"
        rotation="-90"
        origin={`${cx},${cy}`}
      />
    </Svg>
  );
}
