import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '../../theme';

export interface GhostButtonProps {
  title: string;
  onPress: () => void;
  color?: string;
  height?: number;
  fullWidth?: boolean;
}

export function GhostButton({
  title, onPress, color, height = 52, fullWidth = false,
}: GhostButtonProps) {
  const { colors } = useTheme();
  const c = color ?? colors.accent;
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 14, stiffness: 200 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 200 }); }}
      style={fullWidth ? styles.fullWidth : undefined}
    >
      <Animated.View
        style={[
          styles.btn,
          { height, borderColor: c + '60', borderRadius: height / 2 },
          fullWidth && styles.fullWidth,
          animStyle,
        ]}
      >
        <Text style={[styles.text, { color: c }]}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' as any },
  btn: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  text: { fontSize: 16, fontWeight: '600' },
});
