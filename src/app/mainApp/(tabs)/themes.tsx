import React from 'react';
import { Text, TouchableOpacity, ScrollView, StyleSheet, View, Appearance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/store/settingsStore';
import { THEME_PRESETS, LIGHT_PRESET, NORD_PRESET } from '@assets/styles/themePresets';
import ThemeCard from '@/app/mainApp/ThemeCard';
import { useAppColors } from '@/hooks/useAppColors';
import { useTranslation } from '@/hooks/useTranslation';

export default function ThemesScreen() {
  const theme            = useSettingsStore((s) => s.theme);
  const setTheme          = useSettingsStore((s) => s.setTheme);
  const setThemeColors     = useSettingsStore((s) => s.setThemeColors);
  const colors = useAppColors();
  const t = useTranslation();

  const selectedTheme = theme || 'system';

  const handleSelectPreset = (preset: typeof THEME_PRESETS[number]) => {
    setTheme(preset.name);
    // Store the preset palette too: the keyboard (IME process) reads these
    // colors via SharedPreferences for every non-'system' theme.
    setThemeColors(preset.colors);
  };

  const handleSelectSystem = () => {
    setTheme('system');
    const isDark = Appearance.getColorScheme() === 'dark';
    const preset = isDark ? NORD_PRESET : LIGHT_PRESET;
    setThemeColors(preset.colors);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.themesTitle}</Text>
        <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>{t.colorTheme}</Text>

        <SystemThemeCard
          isSelected={selectedTheme === 'system'}
          onPress={handleSelectSystem}
        />

        {THEME_PRESETS.map((preset) => (
          <ThemeCard key={preset.name} preset={preset} isSelected={selectedTheme === preset.name} onPress={() => handleSelectPreset(preset)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Follow-the-device option. It has no palette of its own — the app and the
 * keyboard resolve light/dark at render time (useAppColors / useKeyboardTheme).
 */
function SystemThemeCard({ isSelected, onPress }: { isSelected: boolean; onPress: () => void }) {
  const appColors = useAppColors();
  const t = useTranslation();
  const lightColors = THEME_PRESETS[0].colors;
  const darkColors = THEME_PRESETS[1].colors;

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
      {/* Mini keyboard preview: left column light palette, right column dark */}
      <View style={styles.preview}>
        <View style={styles.previewRow}>
          <View style={[styles.previewKey, { backgroundColor: lightColors.keyboardBg, flex: 1 }]} />
          <View style={[styles.previewKey, { backgroundColor: darkColors.keyboardBg, flex: 1 }]} />
        </View>
        <View style={styles.previewRow}>
          <View style={[styles.previewKey, { backgroundColor: lightColors.keyBg, flex: 1 }]} />
          <View style={[styles.previewKey, { backgroundColor: darkColors.keyBg, flex: 1 }]} />
        </View>
        <View style={styles.previewRow}>
          <View style={[styles.previewKey, { backgroundColor: lightColors.themePrimary, flex: 1 }]} />
          <View style={[styles.previewKey, { backgroundColor: darkColors.themePrimary, flex: 1 }]} />
        </View>
      </View>

      <Text style={[styles.label, { color: appColors.textPrimary }]}>{t.systemThemeLabel}</Text>
      <Text style={[styles.description, { color: appColors.textMuted }]}>{t.systemThemeDescription}</Text>
      {isSelected && <Text style={[styles.checkmark, { color: appColors.accent }]}>✓</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { padding: 20, paddingTop: 12 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 20 },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', marginBottom: 10, marginTop: 8, letterSpacing: 0.5 },
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    // Neumorphic raised effect (matches ThemeCard)
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    shadowOffset: { width: -3, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  preview: { borderRadius: 8, padding: 8, marginBottom: 10, gap: 4 },
  previewRow: { flexDirection: 'row', gap: 4 },
  previewKey: { height: 18, borderRadius: 3 },
  label: { fontSize: 14, fontWeight: '600' },
  description: { fontSize: 12, marginTop: 2 },
  checkmark: { position: 'absolute', top: 12, right: 12, fontSize: 16, fontWeight: 'bold' },
});
