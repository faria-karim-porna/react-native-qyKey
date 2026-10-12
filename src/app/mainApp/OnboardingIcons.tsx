import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import type { AppColors } from '@/hooks/useAppColors';
import { useAppColors } from '@/hooks/useAppColors';

// ─── Keyboard Icon (replaces ⌨️) ──────────────────────────────────────────
// Uses the same FA5 "keyboard" path from icons.tsx
const KEYBOARD_PATH =
  'M528 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h480c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48zM128 180v-40c0-6.627-5.373-12-12-12H76c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm-336 96v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm-336 96v-40c0-6.627-5.373-12-12-12H76c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm288 0v-40c0-6.627-5.373-12-12-12H172c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h232c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12z';

export function KeyboardIcon({ size = 56 }: { size?: number }) {
  const colors = useAppColors();
  const width = size * (576 / 512);
  return (
    <Svg width={width} height={size} viewBox="0 0 576 512">
      <Path d={KEYBOARD_PATH} fill={colors.accent} />
    </Svg>
  );
}

// ─── Check Circle Icon (replaces ✅) ───────────────────────────────────────
export function CheckCircleIcon({ size = 56 }: { size?: number }) {
  const colors = useAppColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Circle cx="28" cy="28" r="26" fill={colors.accent} stroke={colors.textPrimary} strokeWidth="2" />
      <Path
        d="M16 28l8 8 16-16"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ─── Celebrate / Trophy Icon (replaces 🎉) ─────────────────────────────────
export function CelebrateIcon({ size = 64 }: { size?: number }) {
  const colors = useAppColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* Trophy cup */}
      <Path
        d="M20 12h24v16c0 8-5.37 14.67-12 16-6.63-1.33-12-8-12-16V12z"
        fill={colors.accent}
        stroke={colors.textMuted}
        strokeWidth="1.5"
      />
      {/* Trophy base */}
      <Path
        d="M26 44h12v4H26z"
        fill={colors.accent}
        stroke={colors.textMuted}
        strokeWidth="1.5"
      />
      <Path
        d="M23 48h18v3H23z"
        fill={colors.accent}
        stroke={colors.textMuted}
        strokeWidth="1.5"
      />
      {/* Left handle */}
      <Path
        d="M20 16H14c0 6 2 10 6 12"
        stroke={colors.textMuted}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right handle */}
      <Path
        d="M44 16h6c0 6-2 10-6 12"
        stroke={colors.textMuted}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Star on cup */}
      <Path
        d="M32 20l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z"
        fill="#fff"
      />
      {/* Sparkle left */}
      <Path d="M12 10l2 2-2 2-2-2z" fill={colors.accent} />
      {/* Sparkle right */}
      <Path d="M52 10l2 2-2 2-2-2z" fill={colors.accent} />
    </Svg>
  );
}

// ─── Overlay Icon (replaces 🖼️ for Display over other apps) ────────────────
export function OverlayIcon({ size = 56 }: { size?: number }) {
  const colors = useAppColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Background window */}
      <Rect x="4" y="8" width="48" height="38" rx="4" fill={colors.inputBg} stroke={colors.accent} strokeWidth="2" />
      {/* Title bar */}
      <Rect x="4" y="8" width="48" height="10" rx="4" fill={colors.accent} />
      {/* Dots on title bar */}
      <Circle cx="12" cy="13" r="2" fill="#fff" />
      <Circle cx="18" cy="13" r="2" fill="#fff" />
      {/* Overlay window (floating on top) */}
      <Rect x="14" y="18" width="32" height="22" rx="3" fill={colors.card} stroke={colors.textPrimary} strokeWidth="1.5" strokeDasharray="4 2" />
      {/* Arrow indicating overlay */}
      <Path d="M30 26l-4 4 4 4" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M26 30h12" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// ─── Step Circle (replaces numbered text in cards) ─────────────────────────
interface StepCircleProps {
  number: number;
  text: string;
  colors?: AppColors;
}

export function StepCircle({ number, text, colors }: StepCircleProps) {
  // Fallback to useAppColors if no colors prop passed (backward compat)
  const fallbackColors = useAppColors();
  const c = colors ?? fallbackColors;

  return (
    <View style={stepStyles.row}>
      <View style={[stepStyles.circle, { backgroundColor: c.accent }]}>
        <Text style={[stepStyles.number, { color: c.buttonText }]}>{number}</Text>
      </View>
      <Text style={[stepStyles.text, { color: c.textPrimary }]}>{text}</Text>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  number: {
    fontSize: 12,
    fontWeight: '700',
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    flex: 1,
  },
});
