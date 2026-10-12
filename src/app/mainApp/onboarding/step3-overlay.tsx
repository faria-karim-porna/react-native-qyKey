import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import SetupProgress from '@/app/mainApp/SetupProgress';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { useQyKeyBridge } from '@/hooks/useQyKeyBridge';
import { OverlayIcon, StepCircle } from '@/app/mainApp/OnboardingIcons';
import { useAppColors } from '@/hooks/useAppColors';
import { useTranslation } from '@/hooks/useTranslation';

export default function Step3Overlay() {
  const router = useRouter();
  const { isOverlayGranted } = useSetupStatus();
  const { openOverlaySettings } = useQyKeyBridge();
  const colors = useAppColors();
  const t = useTranslation();

  useEffect(() => {
    if (isOverlayGranted) {
      router.replace('/mainApp/onboarding/step4-done');
    }
  }, [isOverlayGranted]);

  return (
    <SafeAreaView style={styles.container}>
      <SetupProgress currentStep={3} />

      <View style={styles.iconContainer}>
        <OverlayIcon size={56} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t.displayOverOtherAppsTitle}</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>
        {t.step3Description}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderTopColor: colors.cardBorderTL, borderLeftColor: colors.cardBorderTL, borderBottomColor: colors.cardBorderBR, borderRightColor: colors.cardBorderBR, shadowColor: colors.cardShadow }]}>
        <StepCircle number={1} text={t.step3Step1} colors={colors} />
        <StepCircle number={2} text={t.step3Step2} colors={colors} />
        <StepCircle number={3} text={t.step3Step3} colors={colors} />
        <StepCircle number={4} text={t.step3Step4} colors={colors} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, borderTopColor: colors.cardBorderTL, borderLeftColor: colors.cardBorderTL, borderBottomColor: colors.cardBorderBR, borderRightColor: colors.cardBorderBR, shadowColor: colors.cardShadow }, pressed && styles.buttonPressed]}
        onPress={() => openOverlaySettings()}
      >
        <Text style={[styles.buttonText, { color: colors.buttonText }]}>{t.openOverlaySettings}</Text>
      </Pressable>

      <Pressable style={styles.skipButton} onPress={() => router.replace('/mainApp/onboarding/step4-done')}>
        <Text style={[styles.skipText, { color: colors.textMuted }]}>{t.skipForNow}</Text>
      </Pressable>

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t.step3Hint}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', padding: 24 },
  iconContainer: { alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  description: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  card: { borderRadius: 12, padding: 18, marginBottom: 24, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderBottomWidth: 2, borderRightWidth: 2, shadowOffset: { width: -3, height: -3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderBottomWidth: 2, borderRightWidth: 2, shadowOffset: { width: -2, height: -2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
  buttonPressed: { transform: [{ translateY: 1 }], borderTopWidth: 2, borderLeftWidth: 2, borderBottomWidth: 0, borderRightWidth: 0, shadowOffset: { width: 1, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1, elevation: 2 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  skipButton: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  skipText: { fontSize: 14, textDecorationLine: 'underline' },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 8 },
});
