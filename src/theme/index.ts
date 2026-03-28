/**
 * BlinkWell Design System
 * Aesthetic: refined calm — Apple Health × Calm app
 */

import { createContext, useContext } from 'react';
import { Platform } from 'react-native';

// ─── Color tokens ─────────────────────────────────────────────────────────────

export const Colors = {
  // Backgrounds
  background:      '#0A0F1E',   // deep midnight
  surface:         '#111827',   // card surface
  surfaceRaised:   '#1A2235',   // elevated card
  surfaceBorder:   '#1F2D45',   // subtle border

  // Accent
  accent:          '#4F8EF7',   // calm blue
  accentSoft:      '#4F8EF714', // ~8% opacity — glow fills
  accentMid:       '#4F8EF730', // 19% — pressed states
  accentGlow:      '#4F8EF740', // 25% — ring glow

  // Semantic
  success:         '#34D399',   // healthy green
  successSoft:     '#34D39914',
  warning:         '#FBBF24',   // attention amber
  warningSoft:     '#FBBF2414',
  danger:          '#F87171',   // alert red
  dangerSoft:      '#F8717114',
  purple:          '#A78BFA',   // medium/elevated risk
  purpleSoft:      '#A78BFA14',

  // Text
  textPrimary:     '#F1F5FF',
  textSecondary:   '#8B9CC8',
  textTertiary:    '#4A5578',
  textInverse:     '#0A0F1E',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

// System fonts with Google Fonts fallbacks (loaded in App.tsx)
export const Fonts = {
  display:  Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter_700Bold',
  bold:     Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter_700Bold',
  semiBold: Platform.OS === 'ios' ? 'SF Pro Text'    : 'Inter_600SemiBold',
  medium:   Platform.OS === 'ios' ? 'SF Pro Text'    : 'Inter_500Medium',
  regular:  Platform.OS === 'ios' ? 'SF Pro Text'    : 'Inter_400Regular',
  mono:     Platform.OS === 'ios' ? 'SF Mono'        : 'SpaceMono_400Regular',
} as const;

export const FontSizes = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 38,
  '5xl': 52,
} as const;

export const LineHeights = {
  tight:  1.15,
  normal: 1.4,
  loose:  1.65,
} as const;

// ─── Spacing scale ────────────────────────────────────────────────────────────

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────

export const Radius = {
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  full: 999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  accent: {
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  success: {
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// ─── Animation durations ──────────────────────────────────────────────────────

export const Duration = {
  fast:   150,
  normal: 280,
  slow:   450,
  xslow:  700,
} as const;

// ─── Theme object ─────────────────────────────────────────────────────────────

export const Theme = {
  colors:    Colors,
  fonts:     Fonts,
  fontSizes: FontSizes,
  spacing:   Spacing,
  radius:    Radius,
  shadows:   Shadows,
  duration:  Duration,
} as const;

export type AppTheme = typeof Theme;

// ─── Context ──────────────────────────────────────────────────────────────────

import React, { type ReactNode } from 'react';

const ThemeContext = createContext<AppTheme>(Theme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return React.createElement(ThemeContext.Provider, { value: Theme }, children);
}

export function useTheme(): AppTheme {
  return useContext(ThemeContext);
}

// ─── Semantic risk helpers ────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high';

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'low':    return Colors.success;
    case 'medium': return Colors.warning;
    case 'high':   return Colors.danger;
  }
}

export function riskColorSoft(level: RiskLevel): string {
  switch (level) {
    case 'low':    return Colors.successSoft;
    case 'medium': return Colors.warningSoft;
    case 'high':   return Colors.dangerSoft;
  }
}

export function riskLabel(level: RiskLevel): string {
  switch (level) {
    case 'low':    return 'Healthy';
    case 'medium': return 'Moderate';
    case 'high':   return 'High Risk';
  }
}

export function scoreToFeeling(score: number): string {
  if (score >= 80) return 'great';
  if (score >= 60) return 'good';
  if (score >= 40) return 'strained';
  return 'recovering';
}
