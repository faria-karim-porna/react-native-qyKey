import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppColors } from '@/hooks/useAppColors';

interface LanguageTagProps {
  code: 'en' | 'bn';
  active: boolean;
}

export default function LanguageTag({ code, active }: LanguageTagProps) {
  const colors = useAppColors();

  return (
    <View style={[
      styles.tag,
      {
        backgroundColor: active ? colors.accent : colors.inputBg,
        borderTopColor: colors.cardBorderTL,
        borderLeftColor: colors.cardBorderTL,
        borderBottomColor: colors.cardBorderBR,
        borderRightColor: colors.cardBorderBR,
      },
    ]}>
      <Text style={[styles.text, { color: active ? colors.buttonText : colors.textSecondary }]}>
        {code.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    // Neumorphic inset effect
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
  text: { fontSize: 11, fontWeight: '700' },
});
