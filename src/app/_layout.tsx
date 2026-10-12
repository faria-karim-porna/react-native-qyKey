import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useSettingsStore } from '@/store/settingsStore';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { useSettingsSync } from '@/hooks/useSettingsSync';
import { useAppColors } from '@/hooks/useAppColors';
import { Circuit } from '@/app/circuit/Circuit';
import type { KeyboardThemeColors } from '@/hooks/useKeyboardTheme';

// Android permissions are granted app-wide, but the keyboard runs in a separate
// `:ime_process` that has no Activity — so the RECORD_AUDIO prompt can only be
// shown from here. Ask exactly once (when the status is still undetermined).
let micPermissionAsked = false;
async function ensureMicrophonePermission() {
  if (micPermissionAsked || !ExpoSpeechRecognitionModule) return;
  micPermissionAsked = true;
  try {
    const current = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    if (current?.status === 'undetermined') {
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    }
  } catch (e) {
    console.warn('Microphone permission request failed:', e);
  }
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const { isEnabled, isDefault, isOverlayGranted, isFullySetUp, isLoading } = useSetupStatus();
  const colors = useAppColors();

  // Build a KeyboardThemeColors-compatible object for the Circuit
  const circuitThemeColors: KeyboardThemeColors = useMemo(() => ({
    keyboardBg: colors.circuitBg,
    keyBg: colors.circuitBg,
    keyText: colors.circuitWire,
    specialKeyBg: colors.circuitGlow,
    specialKeyText: colors.circuitWire,
    themePrimary: colors.circuitWire,
    keyHeight: 38,
    keyBorderRadius: 5,
    fontSize: 16,
    navBarBottomInset: 0,
  }), [colors]);

  // Sync settings to SharedPreferences on every change, app-wide
  useSettingsSync();

  // Ask for the microphone permission once (first app open) so voice typing
  // works inside the keyboard — the IME process cannot show the dialog itself.
  useEffect(() => {
    const t = setTimeout(ensureMicrophonePermission, 1200);
    return () => clearTimeout(t);
  }, []);

  // Track the last redirect target so a completed redirect isn't repeated when
  // unrelated deps change (e.g. `segments` on every tab switch). The gate is
  // re-evaluated whenever the setup values themselves change.
  const lastRedirectRef = useRef<string | null>(null);
  useEffect(() => {
    // Wait until the first async bridge check has resolved before redirecting.
    if (isLoading) return;

    const inMainApp = segments[0] === 'mainApp';
    const shouldShowOnboarding = !hasCompletedOnboarding || !isFullySetUp;

    if (shouldShowOnboarding && !inMainApp) {
      const targetStep = !isEnabled
        ? '/mainApp/onboarding/step1-enable'
        : !isDefault
          ? '/mainApp/onboarding/step2-default'
          : !isOverlayGranted
            ? '/mainApp/onboarding/step3-overlay'
            : '/mainApp/onboarding/step4-done';
      if (lastRedirectRef.current !== targetStep) {
        lastRedirectRef.current = targetStep;
        router.replace(targetStep as any);
      }
    } else if (!shouldShowOnboarding && inMainApp && lastRedirectRef.current !== '/mainApp') {
      lastRedirectRef.current = '/mainApp';
      router.replace('/mainApp');
    }
  }, [hasCompletedOnboarding, isFullySetUp, isEnabled, isDefault, isOverlayGranted, isLoading, segments, router]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.rootBg }]} edges={['top']}>
      <View
        style={[StyleSheet.absoluteFill, styles.backgroundOffset, { top: insets.top }]}
        pointerEvents="none"
      >
        <Circuit animated themeColors={circuitThemeColors} />
      </View>

      <View style={[StyleSheet.absoluteFill, { top: 0, backgroundColor: colors.overlay }]} pointerEvents="none" />

      <StatusBar style={colors.statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="mainApp" />
      </Stack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backgroundOffset: {
    top: 0,
    overflow: 'hidden',
  },
});
