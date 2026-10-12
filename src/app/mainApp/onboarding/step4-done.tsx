import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import SetupProgress from '@/app/mainApp/SetupProgress';
import { useSettingsStore } from '@/store/settingsStore';
import { CelebrateIcon } from '@/app/mainApp/OnboardingIcons';
import { useAppColors } from '@/hooks/useAppColors';
import { useTranslation } from '@/hooks/useTranslation';

export default function Step4Done() {
  const router = useRouter();
  const setOnboardingComplete = useSettingsStore((s) => s.setOnboardingComplete);
  const colors = useAppColors();
  const t = useTranslation();

  const handleFinish = () => {
    setOnboardingComplete(true);
    router.replace('/mainApp');
  };

  return (
    <SafeAreaView style={styles.container}>
      <SetupProgress currentStep={4} />

      <View style={styles.iconContainer}>
        <CelebrateIcon size={64} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t.allSet}</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>
        {t.step4Description}
      </Text>

      <Pressable
        style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, borderTopColor: colors.cardBorderTL, borderLeftColor: colors.cardBorderTL, borderBottomColor: colors.cardBorderBR, borderRightColor: colors.cardBorderBR, shadowColor: colors.cardShadow }, pressed && styles.buttonPressed]}
        onPress={handleFinish}
      >
        <Text style={[styles.buttonText, { color: colors.buttonText }]}>{t.startUsingQyKey}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', padding: 24 },
  iconContainer: { alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  description: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderBottomWidth: 2, borderRightWidth: 2, shadowOffset: { width: -2, height: -2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
  buttonPressed: { transform: [{ translateY: 1 }], borderTopWidth: 2, borderLeftWidth: 2, borderBottomWidth: 0, borderRightWidth: 0, shadowOffset: { width: 1, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1, elevation: 2 },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
