import React from 'react';
import { Redirect } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';
import { useSetupStatus } from '@/hooks/useSetupStatus';

export default function RootIndex() {
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const { isEnabled, isDefault, isOverlayGranted, isFullySetUp, isLoading } = useSetupStatus();

  // Wait until the native bridge check finishes to avoid flashes of wrong screens
  if (isLoading) return null;

  const shouldShowOnboarding = !hasCompletedOnboarding || !isFullySetUp;

  if (shouldShowOnboarding) {
    if (!isEnabled) {
      return <Redirect href="/mainApp/onboarding/step1-enable" />;
    }
    if (!isDefault) {
      return <Redirect href="/mainApp/onboarding/step2-default" />;
    }
    if (!isOverlayGranted) {
      return <Redirect href="/mainApp/onboarding/step3-overlay" />;
    }
    return <Redirect href="/mainApp/onboarding/step4-done" />;
  }

  return <Redirect href="/mainApp" />;
}
