import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import type { ThemePreset } from '@assets/styles/themePresets';
import { useAppColors } from '@/hooks/useAppColors';

interface ThemeCardProps {
  preset: ThemePreset;
  isSelected: boolean;
  onPress: () => void;
}

export default function ThemeCard({ preset, isSelected, onPress }: ThemeCardProps) {
  const { colors } = preset;
  const appColors = useAppColors();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: appColors.card,
          borderTopColor: appColors.cardBorderTL,
          borderLeftColor: appColors.cardBorderTL,
          borderBottomColor: appColors.cardBorderBR,
          borderRightColor: appColors.cardBorderBR,
          shadowColor: appColors.cardShadow,
        },
        isSelected && { borderColor: appColors.accent },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Mini keyboard preview */}
      <View style={[styles.preview, { backgroundColor: colors.keyboardBg }]}>
        <View style={styles.previewRow}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.previewKey, { backgroundColor: colors.keyBg }]} />
          ))}
        </View>
        <View style={styles.previewRow}>
          <View style={[styles.previewKey, { backgroundColor: colors.specialKeyBg, flex: 2 }]} />
          <View style={[styles.previewKey, { backgroundColor: colors.themePrimary }]} />
        </View>
      </View>

      <Text style={[styles.label, { color: appColors.textPrimary }]}>{preset.label}</Text>
      {isSelected && <Text style={[styles.checkmark, { color: appColors.accent }]}>✓</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    // Neumorphic raised effect
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    shadowOffset: { width: -3, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  preview: { borderRadius: 8, padding: 8, marginBottom: 10 },
  previewRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  previewKey: { flex: 1, height: 18, borderRadius: 3 },
  label: { fontSize: 14, fontWeight: '600' },
  checkmark: { position: 'absolute', top: 12, right: 12, fontSize: 16, fontWeight: 'bold' },
});
