import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface SectionHeaderProps {
  title: string;
  style?: TextStyle;
}

export function SectionHeader({ title, style }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.header, { color: colors.textTertiary }, style]}>
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 4,
    marginTop: 8,
  },
});
