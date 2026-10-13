import React from 'react';
import { Stack } from 'expo-router';

/**
 * Stack layout for the 5-step onboarding flow (step 4 = mandatory
 * accessibility-service grant; no other step gates the touchpad's
 * cross-app actions).
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 100,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="step1-enable" />
      <Stack.Screen name="step2-default" />
      <Stack.Screen name="step3-overlay" />
      <Stack.Screen name="step4-accessibility" />
      <Stack.Screen name="step5-done" />
    </Stack>
  );
}
