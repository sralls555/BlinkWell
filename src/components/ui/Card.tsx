import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface CardProps {
  children: React.ReactNode;
  /** Optional glow color — adds a colored border + subtle tint */
  glowColor?: string;
  style?: ViewStyle;
  padding?: number;
}

export function Card({ children, glowColor, style, padding = 20 }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: glowColor ? glowColor + '50' : colors.surfaceBorder,
          borderWidth: glowColor ? 1.5 : 1,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
});
