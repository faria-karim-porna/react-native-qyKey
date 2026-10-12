import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/store/settingsStore';
import LanguageTag from '@/app/mainApp/LanguageTag';
import { useAppColors } from '@/hooks/useAppColors';
import { useTranslation } from '@/hooks/useTranslation';

const LANGUAGES: Array<{ code: 'en' | 'bn'; label: string; native: string }> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'bn', label: 'Bangla',  native: 'বাংলা' },
];

export default function LanguageScreen() {
  const language    = useSettingsStore((s) => s.language);
  const setLanguage  = useSettingsStore((s) => s.setLanguage);
  const colors = useAppColors();
  const t = useTranslation();

  const selectedLanguage = language || 'en';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.languageTitle}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t.languageDescription}
        </Text>

        {LANGUAGES.map((lang) => {
          const isSelected = selectedLanguage === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.row,
                { backgroundColor: colors.card, borderTopColor: colors.cardBorderTL, borderLeftColor: colors.cardBorderTL, borderBottomColor: colors.cardBorderBR, borderRightColor: colors.cardBorderBR, shadowColor: colors.cardShadow },
                isSelected && { borderColor: colors.accent },
              ]}
              onPress={() => setLanguage(lang.code)}
              activeOpacity={0.8}
            >
              <View>
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{lang.label}</Text>
                <Text style={[styles.rowNative, { color: colors.textMuted }]}>{lang.native}</Text>
              </View>
              <View style={styles.rightContainer}>
                <LanguageTag code={lang.code} active={isSelected} />
                {isSelected && <Text style={[styles.checkmark, { color: colors.accent }]}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingTop: 12 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 13, lineHeight: 18, marginBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 18, marginBottom: 12, borderWidth: 2, borderColor: 'transparent', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderBottomWidth: 2, borderRightWidth: 2, shadowOffset: { width: -3, height: -3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowNative: { fontSize: 13, marginTop: 2 },
  rightContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkmark: { fontSize: 16, fontWeight: 'bold' },
});
