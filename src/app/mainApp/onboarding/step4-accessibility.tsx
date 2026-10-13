import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import SetupProgress from '@/app/mainApp/SetupProgress';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { useQyKeyBridge } from '@/hooks/useQyKeyBridge';
import { AccessibilityIcon, StepCircle } from '@/app/mainApp/OnboardingIcons';
import { useAppColors } from '@/hooks/useAppColors';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Onboarding step 4 — mandatory Accessibility Service grant.
 *
 * The touchpad's cross-app actions (tap / click / scroll under the cursor,
 * Back, and now the Forward fallback) are performed by the QyKey accessibility
 * service — no other permission can substitute for it. So unlike the optional
 * overlay step, this step has no "skip": the wizard only advances to the done
 * screen once `isAccessibilityEnabled` (polled every 2s) turns true.
 */
export default function Step4Accessibility() {
  const router = useRouter();
  const { isAccessibilityEnabled } = useSetupStatus();
  const { openAccessibilitySettings } = useQyKeyBridge();
  const colors = useAppColors();
  const t = useTranslation();

  useEffect(() => {
    if (isAccessibilityEnabled) {
      router.replace('/mainApp/onboarding/step5-done');
    }
  }, [isAccessibilityEnabled]);

  return (
    <SafeAreaView style={styles.container}>
      <SetupProgress currentStep={4} />

      <View style={styles.iconContainer}>
        <AccessibilityIcon size={56} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t.enableA11yTitle}</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>
        {t.step4A11yDescription}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderTopColor: colors.cardBorderTL, borderLeftColor: colors.cardBorderTL, borderBottomColor: colors.cardBorderBR, borderRightColor: colors.cardBorderBR, shadowColor: colors.cardShadow }]}>
        <StepCircle number={1} text={t.step4A11yStep1} colors={colors} />
        <StepCircle number={2} text={t.step4A11yStep2} colors={colors} />
        <StepCircle number={3} text={t.step4A11yStep3} colors={colors} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, borderTopColor: colors.cardBorderTL, borderLeftColor: colors.cardBorderTL, borderBottomColor: colors.cardBorderBR, borderRightColor: colors.cardBorderBR, shadowColor: colors.cardShadow }, pressed && styles.buttonPressed]}
        onPress={() => openAccessibilitySettings()}
      >
        <Text style={[styles.buttonText, { color: colors.buttonText }]}>{t.openAccessibilitySettings}</Text>
      </Pressable>

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t.step4A11yHint}
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
  hint: { fontSize: 12, textAlign: 'center', marginTop: 16 },
});
