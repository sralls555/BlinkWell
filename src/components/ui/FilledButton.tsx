import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '../../theme';

export interface FilledButtonProps {
  title: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  height?: number;
  fullWidth?: boolean;
}

export function FilledButton({
  title, onPress, color, textColor = '#fff', height = 52, fullWidth = false,
}: FilledButtonProps) {
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
          { height, backgroundColor: c, borderRadius: height / 2 },
          fullWidth && styles.fullWidth,
          animStyle,
        ]}
      >
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' as any },
  btn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  text: { fontSize: 16, fontWeight: '700' },
});
