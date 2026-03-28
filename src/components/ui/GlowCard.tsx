/**
 * GlowCard — surface card with optional colored glow border + shadow
 *
 * Spec: background=surface, borderRadius=lg, optional border glow
 * implemented as shadow with glowColor at low opacity.
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface GlowCardProps {
  children: React.ReactNode;
  /** Hex color string — drives both border tint and shadow */
  glowColor?: string;
  style?: ViewStyle;
  padding?: number;
}

export function GlowCard({ children, glowColor, style, padding = 20 }: GlowCardProps) {
  const { colors, radius, shadows } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding,
          borderColor: glowColor ? glowColor + '50' : colors.surfaceBorder,
          borderWidth: glowColor ? 1.5 : 1,
          // Shadow driven by glowColor when provided, otherwise default
          shadowColor: glowColor ?? '#000',
          shadowOffset: { width: 0, height: glowColor ? 0 : 4 },
          shadowOpacity: glowColor ? 0.3 : 0.2,
          shadowRadius: glowColor ? 16 : 8,
          elevation: 6,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
});
