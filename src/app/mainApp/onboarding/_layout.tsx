import React from 'react';
import { Stack } from 'expo-router';

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
      <Stack.Screen name="step4-done" />
    </Stack>
  );
}
