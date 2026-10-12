import React from 'react';
import { Stack } from 'expo-router';

// mainApp is now a route segment (root Stack → mainApp Stack → (tabs)/onboarding),
// so it needs its own layout to preserve the previous navigation structure.
export default function MainAppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
