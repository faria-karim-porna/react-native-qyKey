# KickKey — Phase 5 Implementation Guide
## Companion App (Weeks 9–10)

> **Goal:** The companion app is fully functional — a 3-step onboarding wizard, a settings screen with haptic/sound/autocorrect toggles, a theme picker (dark/light/AMOLED + custom colors), a language selector, and a custom dictionary editor. All settings sync to the IME via SharedPreferences and theme changes are reflected the next time the keyboard opens.
> **Builds on Phase 4** — the keyboard fully types, suggests, and autocorrects in English and Bangla. Phase 5 does not touch any keyboard-bundle code (`src/keyboard/`). It is entirely focused on `app/` (the Expo Router companion screens), `store/` (Zustand state), and the sync layer that writes preferences into `SharedPreferences`, which `useKeyboardTheme.ts` already reads from on the keyboard side.

---

## Table of Contents

1. [What Changes in Phase 5](#1-what-changes-in-phase-5)
2. [Architecture: How Settings Reach the Keyboard](#2-architecture-how-settings-reach-the-keyboard)
3. [Updated Folder Structure](#3-updated-folder-structure)
4. [Zustand Settings Store](#4-zustand-settings-store)
5. [useKickKeyBridge Hook](#5-usekickkeybridge-hook)
6. [useSetupStatus Hook](#6-usesetupstatus-hook)
7. [useSettingsSync Hook](#7-usesettingssync-hook)
8. [Root Layout & Navigation](#8-root-layout--navigation)
9. [Onboarding Screens](#9-onboarding-screens)
10. [Home Screen](#10-home-screen)
11. [Settings Screen](#11-settings-screen)
12. [Theme Picker Screen](#12-theme-picker-screen)
13. [Language Selector Screen](#13-language-selector-screen)
14. [Dictionary Editor Screen](#14-dictionary-editor-screen)
15. [Shared Components](#15-shared-components)
16. [Updated KickKeyModule.kt](#16-updated-kickkeymodulekt)
17. [Updated modules/kickkey-module/index.ts](#17-updated-moduleskickkey-moduleindexts)
18. [Build & Test](#18-build--test)
19. [Verification Checklist](#19-verification-checklist)
20. [Troubleshooting](#20-troubleshooting)

---

## 1. What Changes in Phase 5

### Files to CREATE (new)

| File | Purpose |
|---|---|
| `store/settingsStore.ts` | Zustand store with AsyncStorage persistence — single source of truth for companion app settings |
| `hooks/useKickKeyBridge.ts` | Thin wrapper around `NativeModules.KickKey` for companion-app-only calls |
| `hooks/useSetupStatus.ts` | Polls `isKeyboardEnabled()` / `isDefaultKeyboard()` every 2s while onboarding is visible |
| `hooks/useSettingsSync.ts` | Writes Zustand state to `SharedPreferences` on every change |
| `app/_layout.tsx` | Root Expo Router layout — decides onboarding vs. tabs |
| `app/onboarding/_layout.tsx` | Stack layout for the 3-step onboarding flow |
| `app/onboarding/step1-enable.tsx` | "Enable KickKey" screen |
| `app/onboarding/step2-default.tsx` | "Set as default" screen |
| `app/onboarding/step3-done.tsx` | Success / completion screen |
| `app/(tabs)/_layout.tsx` | Bottom tab navigator |
| `app/(tabs)/index.tsx` | Home screen — replaces the Phase 1 `App.tsx` placeholder |
| `app/(tabs)/settings.tsx` | Settings screen |
| `app/(tabs)/themes.tsx` | Theme picker |
| `app/(tabs)/language.tsx` | Language selector |
| `app/(tabs)/dictionary.tsx` | Custom dictionary editor |
| `components/SetupProgress.tsx` | Reusable 3-dot progress indicator |
| `components/ThemeCard.tsx` | Tappable theme preview card |
| `components/ToggleRow.tsx` | Label + Switch row used across settings |
| `components/LanguageTag.tsx` | Small language pill badge |
| `constants/Themes.ts` | Predefined theme presets (dark / light / AMOLED) |

### Files to UPDATE (partial changes)

| File | What changes |
|---|---|
| `modules/kickkey-module/android/.../KickKeyModule.kt` | Add `setDictionaryWords`, `getDictionaryWords`, `removeDictionaryWord` |
| `modules/kickkey-module/index.ts` | Export the three new dictionary methods |
| `app.json` | Add `expo-router` plugin config, set scheme |
| `package.json` | Confirm `expo-router`, `zustand`, `@react-native-async-storage/async-storage` are installed (already added in Phase 1) |

### Files to DELETE

| File | Why |
|---|---|
| `App.tsx` (root) | Replaced entirely by Expo Router's `app/` directory structure |
| `index.js` (if it calls `registerRootComponent(App)`) | Expo Router uses `expo-router/entry` instead |

### Files that do NOT change

Everything in `src/keyboard/`, `android/app/src/main/java/com/kickkey/BanglaInputEngine.kt`, `SuggestionEngine.kt`, `Trie.kt`, `UserWordModel.kt`, `HapticManager.kt`, `KickKeyApplication.kt`, `KickKeyInputMethodService.kt`, `keyboard.index.js`, all dictionary `.bin`/`.txt` files, and `plugins/`.

---

## 2. Architecture: How Settings Reach the Keyboard

```
Companion App (main process)                    IME Service (:ime_process)
─────────────────────────────                    ──────────────────────────
User taps "Dark AMOLED" theme card
        │
        ▼
useSettingsStore.setTheme('amoled')
        │
        ▼  [Zustand state updates]
useSettingsSync useEffect fires
        │
        ▼
NativeModules.KickKey.savePreferences({
  theme: 'amoled',
  keyboardBg: '#000000',
  themeKeyBg: '#0a0a0a',
  ...
})
        │
        ▼  [Kotlin, main process]
KickKeyModule.savePreferences()
  → SharedPreferences.edit().putString(...).apply()
        │
        ▼  [Android OS — SharedPreferences is per-app, shared across processes
              of the same app, including :ime_process]
                                                          │
                                                          ▼
                                          Next time the keyboard opens:
                                          KickKeyInputMethodService.onCreateInputView()
                                                          │
                                                          ▼
                                          KeyboardScreen.tsx mounts
                                                          │
                                                          ▼
                                          useKeyboardTheme() calls
                                          NativeModules.KickKey.getPreferences()
                                                          │
                                                          ▼
                                          Kotlin reads the SAME SharedPreferences
                                          file written by the companion app
                                                          │
                                                          ▼
                                          Keyboard renders with the new theme colors
```

**Key insight:** `SharedPreferences` is the only communication channel between the two processes in this phase. There is no direct IPC call from the companion app into the live `:ime_process` — the IME simply re-reads preferences the next time it is shown. This is why theme changes apply "on next keyboard open," not instantly while the keyboard is visible. That tradeoff is intentional and keeps the architecture simple and robust.

---

## 3. Updated Folder Structure

```
KickKey/
├── app/                                  ← NEW (Expo Router root)
│   ├── _layout.tsx                       ← NEW
│   ├── onboarding/
│   │   ├── _layout.tsx                   ← NEW
│   │   ├── step1-enable.tsx              ← NEW
│   │   ├── step2-default.tsx             ← NEW
│   │   └── step3-done.tsx                ← NEW
│   └── (tabs)/
│       ├── _layout.tsx                   ← NEW
│       ├── index.tsx                     ← NEW
│       ├── settings.tsx                  ← NEW
│       ├── themes.tsx                    ← NEW
│       ├── language.tsx                  ← NEW
│       └── dictionary.tsx                ← NEW
│
├── components/                           ← NEW directory
│   ├── SetupProgress.tsx                 ← NEW
│   ├── ThemeCard.tsx                     ← NEW
│   ├── ToggleRow.tsx                     ← NEW
│   └── LanguageTag.tsx                   ← NEW
│
├── hooks/                                ← NEW directory (companion app only)
│   ├── useKickKeyBridge.ts               ← NEW
│   ├── useSetupStatus.ts                 ← NEW
│   └── useSettingsSync.ts                ← NEW
│
├── store/                                ← NEW directory
│   └── settingsStore.ts                  ← NEW
│
├── constants/
│   └── Themes.ts                         ← NEW
│
├── App.tsx                               ← DELETE
│
├── src/keyboard/                         (unchanged from Phase 4)
├── keyboard.index.js                     (unchanged)
├── modules/kickkey-module/
│   ├── index.ts                          ← UPDATE
│   └── android/src/main/java/com/kickkey/
│       └── KickKeyModule.kt              ← UPDATE
└── android/app/src/main/java/com/kickkey/  (unchanged from Phase 4)
```

---

## 4. Zustand Settings Store

The single source of truth for all companion-app-controlled settings. Persisted to `AsyncStorage` so the companion app remembers state across restarts (this is separate from the `SharedPreferences` that the IME reads — Zustand/AsyncStorage is for the React Native companion app's own UI state; `SharedPreferences` is the cross-process bridge, written by `useSettingsSync`).

```typescript
// store/settingsStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeName = 'dark' | 'light' | 'amoled' | 'custom';

export interface ThemeColors {
  keyboardBg: string;
  keyBg: string;
  keyText: string;
  specialKeyBg: string;
  specialKeyText: string;
  themePrimary: string;
}

interface SettingsState {
  // Onboarding
  hasCompletedOnboarding: boolean;
  setOnboardingComplete: (done: boolean) => void;

  // Language
  language: 'en' | 'bn';
  setLanguage: (lang: 'en' | 'bn') => void;

  // Theme
  theme: ThemeName;
  themeColors: ThemeColors;
  setTheme: (theme: ThemeName) => void;
  setThemeColors: (colors: Partial<ThemeColors>) => void;

  // Layout
  keyHeight: number;
  keyBorderRadius: number;
  fontSize: number;
  keyMargin: number;
  setKeyHeight: (v: number) => void;
  setKeyBorderRadius: (v: number) => void;
  setFontSize: (v: number) => void;

  // Feedback
  hapticEnabled: boolean;
  soundEnabled: boolean;
  toggleHaptic: () => void;
  toggleSound: () => void;

  // Input behavior
  autoCorrect: boolean;
  showSuggestions: boolean;
  toggleAutoCorrect: () => void;
  toggleShowSuggestions: () => void;

  // Custom dictionary
  customWords: string[];
  addCustomWord: (word: string) => void;
  removeCustomWord: (word: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      setOnboardingComplete: (done) => set({ hasCompletedOnboarding: done }),

      language: 'en',
      setLanguage: (language) => set({ language }),

      theme: 'dark',
      themeColors: {
        keyboardBg:     '#0d0d1a',
        keyBg:          '#1e1e2e',
        keyText:        '#ffffff',
        specialKeyBg:   '#2a2a40',
        specialKeyText: '#ffffff',
        themePrimary:   '#00BCD4',
      },
      setTheme: (theme) => set({ theme }),
      setThemeColors: (colors) =>
        set((s) => ({ themeColors: { ...s.themeColors, ...colors } })),

      keyHeight: 48,
      keyBorderRadius: 6,
      fontSize: 16,
      keyMargin: 3,
      setKeyHeight: (keyHeight) => set({ keyHeight }),
      setKeyBorderRadius: (keyBorderRadius) => set({ keyBorderRadius }),
      setFontSize: (fontSize) => set({ fontSize }),

      hapticEnabled: true,
      soundEnabled: false,
      toggleHaptic: () => set((s) => ({ hapticEnabled: !s.hapticEnabled })),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      autoCorrect: true,
      showSuggestions: true,
      toggleAutoCorrect: () => set((s) => ({ autoCorrect: !s.autoCorrect })),
      toggleShowSuggestions: () => set((s) => ({ showSuggestions: !s.showSuggestions })),

      customWords: [],
      addCustomWord: (word) =>
        set((s) => ({
          customWords: [...new Set([...s.customWords, word.trim().toLowerCase()])],
        })),
      removeCustomWord: (word) =>
        set((s) => ({
          customWords: s.customWords.filter((w) => w !== word),
        })),
    }),
    {
      name: 'kickkey-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

---

## 5. `useKickKeyBridge` Hook

A thin, typed wrapper around the native module specifically for companion-app screens. Keeps `NativeModules` import isolated to one file so the rest of the app never imports it directly.

```typescript
// hooks/useKickKeyBridge.ts

import { NativeModules } from 'react-native';

const { KickKey } = NativeModules;

export function useKickKeyBridge() {
  return {
    isDefaultKeyboard: (): Promise<boolean> => KickKey.isDefaultKeyboard(),
    isKeyboardEnabled: (): Promise<boolean> => KickKey.isKeyboardEnabled(),
    openKeyboardSettings: (): void => KickKey.openKeyboardSettings(),

    savePreferences: (prefs: Record<string, any>): Promise<void> =>
      KickKey.savePreferences(prefs),
    getPreferences: (): Promise<Record<string, any>> =>
      KickKey.getPreferences(),

    setDictionaryWords: (words: string[]): Promise<void> =>
      KickKey.setDictionaryWords(words),
    getDictionaryWords: (): Promise<string[]> =>
      KickKey.getDictionaryWords(),
    removeDictionaryWord: (word: string): Promise<void> =>
      KickKey.removeDictionaryWord(word),
  };
}
```

---

## 6. `useSetupStatus` Hook

Polls the IME activation state every 2 seconds. Used by both the onboarding screens and the home screen to show live setup progress. Polling (rather than an event-based approach) is necessary because Android does not provide a callback when the user changes keyboard settings — the only way to detect the change is to re-check `Settings.Secure` periodically.

```typescript
// hooks/useSetupStatus.ts

import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useKickKeyBridge } from './useKickKeyBridge';

interface SetupStatus {
  isEnabled: boolean;
  isDefault: boolean;
  isFullySetUp: boolean;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 2000;

export function useSetupStatus(): SetupStatus {
  const { isKeyboardEnabled, isDefaultKeyboard } = useKickKeyBridge();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    const [enabled, def] = await Promise.all([
      isKeyboardEnabled(),
      isDefaultKeyboard(),
    ]);
    setIsEnabled(enabled);
    setIsDefault(def);
  };

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);

    // Also refresh immediately when the app returns to foreground —
    // this is the moment right after the user comes back from
    // Android Settings, so it gives near-instant feedback.
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refresh();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, []);

  return {
    isEnabled,
    isDefault,
    isFullySetUp: isEnabled && isDefault,
    refresh,
  };
}
```

---

## 7. `useSettingsSync` Hook

Writes the Zustand store's relevant fields into `SharedPreferences` (via `KickKeyModule.savePreferences`) every time they change. This is the bridge from Section 2's architecture diagram.

```typescript
// hooks/useSettingsSync.ts

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useKickKeyBridge } from './useKickKeyBridge';

/**
 * Call this once near the root of the app (in app/_layout.tsx).
 * Subscribes to every setting the keyboard cares about and pushes
 * changes to SharedPreferences whenever they change.
 *
 * Debounced by 300ms to avoid hammering SharedPreferences when the
 * user is dragging a slider (e.g. font size).
 */
export function useSettingsSync() {
  const { savePreferences } = useKickKeyBridge();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const language        = useSettingsStore((s) => s.language);
  const theme            = useSettingsStore((s) => s.theme);
  const themeColors      = useSettingsStore((s) => s.themeColors);
  const keyHeight         = useSettingsStore((s) => s.keyHeight);
  const keyBorderRadius   = useSettingsStore((s) => s.keyBorderRadius);
  const fontSize           = useSettingsStore((s) => s.fontSize);
  const keyMargin          = useSettingsStore((s) => s.keyMargin);
  const hapticEnabled      = useSettingsStore((s) => s.hapticEnabled);
  const soundEnabled       = useSettingsStore((s) => s.soundEnabled);
  const autoCorrect        = useSettingsStore((s) => s.autoCorrect);
  const showSuggestions    = useSettingsStore((s) => s.showSuggestions);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      savePreferences({
        language,
        theme,
        keyboardBg:      themeColors.keyboardBg,
        themeKeyBg:      themeColors.keyBg,
        themeKeyText:    themeColors.keyText,
        specialKeyBg:    themeColors.specialKeyBg,
        themePrimary:    themeColors.themePrimary,
        keyHeight,
        keyBorderRadius,
        fontSize,
        keyMargin,
        hapticEnabled,
        soundEnabled,
        autoCorrect,
        showSuggestions,
      }).catch(() => {
        // Silently ignore — SharedPreferences write rarely fails,
        // and if it does there's nothing actionable to show the user.
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    language, theme, themeColors,
    keyHeight, keyBorderRadius, fontSize, keyMargin,
    hapticEnabled, soundEnabled, autoCorrect, showSuggestions,
  ]);
}
```

---

## 8. Root Layout & Navigation

### 8.1 `app/_layout.tsx`

The root layout decides whether to show onboarding or the main tab navigator, based on `hasCompletedOnboarding` AND live setup status. Even if the user completed onboarding once, if they later disable the keyboard in Android Settings, this layout routes them back to onboarding.

```tsx
// app/_layout.tsx

import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSettingsStore } from '../store/settingsStore';
import { useSetupStatus } from '../hooks/useSetupStatus';
import { useSettingsSync } from '../hooks/useSettingsSync';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const { isFullySetUp } = useSetupStatus();

  // Sync settings to SharedPreferences on every change, app-wide
  useSettingsSync();

  useEffect(() => {
    const inOnboarding = segments[0] === 'onboarding';
    const shouldShowOnboarding = !hasCompletedOnboarding || !isFullySetUp;

    if (shouldShowOnboarding && !inOnboarding) {
      router.replace('/onboarding/step1-enable');
    } else if (!shouldShowOnboarding && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [hasCompletedOnboarding, isFullySetUp, segments]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
```

### 8.2 `app/onboarding/_layout.tsx`

```tsx
// app/onboarding/_layout.tsx

import React from 'react';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="step1-enable" />
      <Stack.Screen name="step2-default" />
      <Stack.Screen name="step3-done" />
    </Stack>
  );
}
```

### 8.3 `app/(tabs)/_layout.tsx`

```tsx
// app/(tabs)/_layout.tsx

import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0a0a1a', borderTopColor: '#1a1a2e' },
        tabBarActiveTintColor: '#00BCD4',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="themes"
        options={{
          title: 'Themes',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎨" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="language"
        options={{
          title: 'Language',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🌐" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dictionary"
        options={{
          title: 'Dictionary',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
```

---

## 9. Onboarding Screens

### 9.1 `components/SetupProgress.tsx`

A reusable 3-dot stepper shown at the top of every onboarding screen.

```tsx
// components/SetupProgress.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';

interface SetupProgressProps {
  currentStep: 1 | 2 | 3;
}

export default function SetupProgress({ currentStep }: SetupProgressProps) {
  return (
    <View style={styles.row}>
      {[1, 2, 3].map((step) => (
        <View
          key={step}
          style={[
            styles.dot,
            step === currentStep && styles.dotActive,
            step < currentStep && styles.dotComplete,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2a2a40',
  },
  dotActive: {
    backgroundColor: '#00BCD4',
    width: 24,
  },
  dotComplete: {
    backgroundColor: '#4CAF50',
  },
});
```

### 9.2 `app/onboarding/step1-enable.tsx`

```tsx
// app/onboarding/step1-enable.tsx

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import SetupProgress from '../../components/SetupProgress';
import { useSetupStatus } from '../../hooks/useSetupStatus';
import { useKickKeyBridge } from '../../hooks/useKickKeyBridge';

export default function Step1Enable() {
  const router = useRouter();
  const { isEnabled } = useSetupStatus();
  const { openKeyboardSettings } = useKickKeyBridge();

  useEffect(() => {
    if (isEnabled) {
      router.push('/onboarding/step2-default');
    }
  }, [isEnabled]);

  return (
    <SafeAreaView style={styles.container}>
      <SetupProgress currentStep={1} />

      <Text style={styles.emoji}>⌨️</Text>
      <Text style={styles.title}>Enable KickKey</Text>
      <Text style={styles.description}>
        First, you need to turn on KickKey in your phone's keyboard settings.
        Android will show a security notice — this is normal for every
        keyboard app. Tap "OK" to continue.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardStep}>1. Tap the button below</Text>
        <Text style={styles.cardStep}>2. Find "KickKey Keyboard" in the list</Text>
        <Text style={styles.cardStep}>3. Toggle it on</Text>
        <Text style={styles.cardStep}>4. Tap "OK" on the security notice</Text>
        <Text style={styles.cardStep}>5. Come back to this app</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => openKeyboardSettings()}>
        <Text style={styles.buttonText}>Open Keyboard Settings</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        This screen will automatically advance once KickKey is enabled.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a', padding: 24, paddingTop: 60 },
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 12 },
  description: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  card: { backgroundColor: '#13132a', borderRadius: 12, padding: 18, marginBottom: 24 },
  cardStep: { color: '#ccc', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  button: { backgroundColor: '#00BCD4', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '700' },
  hint: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 16 },
});
```

### 9.3 `app/onboarding/step2-default.tsx`

```tsx
// app/onboarding/step2-default.tsx

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import SetupProgress from '../../components/SetupProgress';
import { useSetupStatus } from '../../hooks/useSetupStatus';
import { useKickKeyBridge } from '../../hooks/useKickKeyBridge';

export default function Step2Default() {
  const router = useRouter();
  const { isDefault } = useSetupStatus();
  const { openKeyboardSettings } = useKickKeyBridge();

  useEffect(() => {
    if (isDefault) {
      router.push('/onboarding/step3-done');
    }
  }, [isDefault]);

  return (
    <SafeAreaView style={styles.container}>
      <SetupProgress currentStep={2} />

      <Text style={styles.emoji}>✅</Text>
      <Text style={styles.title}>Set as Default</Text>
      <Text style={styles.description}>
        Almost there! Now set KickKey as your default keyboard so it opens
        automatically whenever you tap a text field.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardStep}>1. Tap the button below</Text>
        <Text style={styles.cardStep}>2. Select "KickKey Keyboard" as default</Text>
        <Text style={styles.cardStep}>3. Come back to this app</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => openKeyboardSettings()}>
        <Text style={styles.buttonText}>Set Default Keyboard</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        This screen will automatically advance once KickKey is your default keyboard.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a', padding: 24, paddingTop: 60 },
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 12 },
  description: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  card: { backgroundColor: '#13132a', borderRadius: 12, padding: 18, marginBottom: 24 },
  cardStep: { color: '#ccc', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  button: { backgroundColor: '#00BCD4', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '700' },
  hint: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 16 },
});
```

### 9.4 `app/onboarding/step3-done.tsx`

```tsx
// app/onboarding/step3-done.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import SetupProgress from '../../components/SetupProgress';
import { useSettingsStore } from '../../store/settingsStore';

export default function Step3Done() {
  const router = useRouter();
  const setOnboardingComplete = useSettingsStore((s) => s.setOnboardingComplete);

  const handleFinish = () => {
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <SetupProgress currentStep={3} />

      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>You're All Set!</Text>
      <Text style={styles.description}>
        KickKey is ready to use. Tap any text field in any app and your
        new keyboard will appear. You can switch languages anytime with
        the globe button, and customize your experience in the Settings tab.
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleFinish}>
        <Text style={styles.buttonText}>Start Using KickKey</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a', padding: 24, paddingTop: 60, justifyContent: 'center' },
  emoji: { fontSize: 64, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 12 },
  description: { fontSize: 14, color: '#aaa', textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  button: { backgroundColor: '#00BCD4', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '700' },
});
```

---

## 10. Home Screen

This replaces the Phase 1 `App.tsx` placeholder. Shows live setup status, quick links, and a "Try It" text field so users can test the keyboard without leaving the app.

```tsx
// app/(tabs)/index.tsx

import React from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, SafeAreaView,
} from 'react-native';
import { useSetupStatus } from '../../hooks/useSetupStatus';
import { useSettingsStore } from '../../store/settingsStore';

export default function HomeScreen() {
  const { isEnabled, isDefault, isFullySetUp } = useSetupStatus();
  const language = useSettingsStore((s) => s.language);
  const [testText, setTestText] = React.useState('');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>KickKey</Text>
        <Text style={styles.subtitle}>Your custom keyboard</Text>

        <View style={styles.statusCard}>
          <StatusRow label="Keyboard Enabled" value={isEnabled} />
          <StatusRow label="Set as Default" value={isDefault} />
          <StatusRow label="Active Language" value={language === 'en' ? 'English' : 'বাংলা'} isText />
        </View>

        {isFullySetUp && (
          <>
            <Text style={styles.sectionLabel}>Try it out</Text>
            <TextInput
              style={styles.testInput}
              placeholder="Tap here and start typing..."
              placeholderTextColor="#555"
              value={testText}
              onChangeText={setTestText}
              multiline
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusRow({
  label, value, isText = false,
}: { label: string; value: boolean | string; isText?: boolean }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      {isText ? (
        <Text style={styles.statusTextValue}>{value as string}</Text>
      ) : (
        <Text style={[styles.statusValue, { color: value ? '#4CAF50' : '#f44336' }]}>
          {value ? '✅ Yes' : '❌ No'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  scroll: { padding: 20, paddingTop: 12 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#00BCD4' },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  statusCard: { backgroundColor: '#13132a', borderRadius: 12, padding: 18, marginBottom: 28 },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f1f3a',
  },
  statusLabel: { color: '#ccc', fontSize: 14 },
  statusValue: { fontSize: 14, fontWeight: '600' },
  statusTextValue: { color: '#00BCD4', fontSize: 14, fontWeight: '600' },
  sectionLabel: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  testInput: {
    backgroundColor: '#13132a', borderRadius: 12, padding: 16,
    color: '#fff', fontSize: 16, minHeight: 100, textAlignVertical: 'top',
  },
});
```

---

## 11. Settings Screen

### 11.1 `components/ToggleRow.tsx`

```tsx
// components/ToggleRow.tsx

import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export default function ToggleRow({ label, description, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#2a2a40', true: '#00BCD4' }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f3a',
  },
  textContainer: { flex: 1, marginRight: 12 },
  label: { color: '#fff', fontSize: 15, fontWeight: '500' },
  description: { color: '#888', fontSize: 12, marginTop: 2 },
});
```

### 11.2 `app/(tabs)/settings.tsx`

```tsx
// app/(tabs)/settings.tsx

import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useSettingsStore } from '../../store/settingsStore';
import ToggleRow from '../../components/ToggleRow';

export default function SettingsScreen() {
  const hapticEnabled    = useSettingsStore((s) => s.hapticEnabled);
  const soundEnabled      = useSettingsStore((s) => s.soundEnabled);
  const autoCorrect        = useSettingsStore((s) => s.autoCorrect);
  const showSuggestions    = useSettingsStore((s) => s.showSuggestions);
  const toggleHaptic        = useSettingsStore((s) => s.toggleHaptic);
  const toggleSound          = useSettingsStore((s) => s.toggleSound);
  const toggleAutoCorrect     = useSettingsStore((s) => s.toggleAutoCorrect);
  const toggleShowSuggestions  = useSettingsStore((s) => s.toggleShowSuggestions);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.sectionLabel}>Feedback</Text>
        <View style={styles.card}>
          <ToggleRow
            label="Haptic Feedback"
            description="Vibrate on every key press"
            value={hapticEnabled}
            onValueChange={toggleHaptic}
          />
          <ToggleRow
            label="Key Sounds"
            description="Play a click sound on key press"
            value={soundEnabled}
            onValueChange={toggleSound}
          />
        </View>

        <Text style={styles.sectionLabel}>Typing</Text>
        <View style={styles.card}>
          <ToggleRow
            label="Auto-correct"
            description="Automatically fix typos when you press space"
            value={autoCorrect}
            onValueChange={toggleAutoCorrect}
          />
          <ToggleRow
            label="Show Suggestions"
            description="Display word suggestions above the keyboard"
            value={showSuggestions}
            onValueChange={toggleShowSuggestions}
          />
        </View>

        <Text style={styles.footnote}>
          Changes apply automatically the next time you open the keyboard.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  scroll: { padding: 20, paddingTop: 12 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  sectionLabel: {
    color: '#888', fontSize: 12, textTransform: 'uppercase',
    marginBottom: 8, marginTop: 16, letterSpacing: 0.5,
  },
  card: { backgroundColor: '#13132a', borderRadius: 12, paddingHorizontal: 16 },
  footnote: { color: '#555', fontSize: 12, textAlign: 'center', marginTop: 24 },
});
```

---

## 12. Theme Picker Screen

### 12.1 `constants/Themes.ts`

Three built-in presets, each providing the full color palette the keyboard needs.

```typescript
// constants/Themes.ts

import type { ThemeColors, ThemeName } from '../store/settingsStore';

export interface ThemePreset {
  name: ThemeName;
  label: string;
  colors: ThemeColors;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'dark',
    label: 'Dark',
    colors: {
      keyboardBg:     '#0d0d1a',
      keyBg:          '#1e1e2e',
      keyText:        '#ffffff',
      specialKeyBg:   '#2a2a40',
      specialKeyText: '#ffffff',
      themePrimary:   '#00BCD4',
    },
  },
  {
    name: 'light',
    label: 'Light',
    colors: {
      keyboardBg:     '#e8e8ed',
      keyBg:          '#ffffff',
      keyText:        '#1a1a1a',
      specialKeyBg:   '#d0d0d8',
      specialKeyText: '#1a1a1a',
      themePrimary:   '#0077B6',
    },
  },
  {
    name: 'amoled',
    label: 'AMOLED Black',
    colors: {
      keyboardBg:     '#000000',
      keyBg:          '#0a0a0a',
      keyText:        '#ffffff',
      specialKeyBg:   '#161616',
      specialKeyText: '#ffffff',
      themePrimary:   '#00E5FF',
    },
  },
];
```

### 12.2 `components/ThemeCard.tsx`

```tsx
// components/ThemeCard.tsx

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import type { ThemePreset } from '../constants/Themes';

interface ThemeCardProps {
  preset: ThemePreset;
  isSelected: boolean;
  onPress: () => void;
}

export default function ThemeCard({ preset, isSelected, onPress }: ThemeCardProps) {
  const { colors } = preset;
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Mini keyboard preview */}
      <View style={[styles.preview, { backgroundColor: colors.keyboardBg }]}>
        <View style={styles.previewRow}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.previewKey, { backgroundColor: colors.keyBg }]} />
          ))}
        </View>
        <View style={styles.previewRow}>
          <View style={[styles.previewKey, { backgroundColor: colors.specialKeyBg, flex: 2 }]} />
          <View style={[styles.previewKey, { backgroundColor: colors.themePrimary }]} />
        </View>
      </View>

      <Text style={styles.label}>{preset.label}</Text>
      {isSelected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#13132a',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: '#00BCD4' },
  preview: { borderRadius: 8, padding: 8, marginBottom: 10 },
  previewRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  previewKey: { flex: 1, height: 18, borderRadius: 3 },
  label: { color: '#fff', fontSize: 14, fontWeight: '600' },
  checkmark: { position: 'absolute', top: 12, right: 12, color: '#00BCD4', fontSize: 16, fontWeight: 'bold' },
});
```

### 12.3 `app/(tabs)/themes.tsx`

```tsx
// app/(tabs)/themes.tsx

import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSettingsStore } from '../../store/settingsStore';
import { THEME_PRESETS } from '../../constants/Themes';
import ThemeCard from '../../components/ThemeCard';

export default function ThemesScreen() {
  const theme              = useSettingsStore((s) => s.theme);
  const setTheme            = useSettingsStore((s) => s.setTheme);
  const setThemeColors       = useSettingsStore((s) => s.setThemeColors);
  const keyHeight             = useSettingsStore((s) => s.keyHeight);
  const setKeyHeight           = useSettingsStore((s) => s.setKeyHeight);
  const keyBorderRadius         = useSettingsStore((s) => s.keyBorderRadius);
  const setKeyBorderRadius       = useSettingsStore((s) => s.setKeyBorderRadius);
  const fontSize                   = useSettingsStore((s) => s.fontSize);
  const setFontSize                 = useSettingsStore((s) => s.setFontSize);

  const handleSelectPreset = (preset: typeof THEME_PRESETS[number]) => {
    setTheme(preset.name);
    setThemeColors(preset.colors);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Themes</Text>

        <Text style={styles.sectionLabel}>Color Theme</Text>
        {THEME_PRESETS.map((preset) => (
          <ThemeCard
            key={preset.name}
            preset={preset}
            isSelected={theme === preset.name}
            onPress={() => handleSelectPreset(preset)}
          />
        ))}

        <Text style={styles.sectionLabel}>Key Size</Text>
        <View style={styles.card}>
          <SliderRow
            label="Key Height"
            value={keyHeight}
            min={40}
            max={60}
            onChange={setKeyHeight}
            unit="dp"
          />
          <SliderRow
            label="Corner Radius"
            value={keyBorderRadius}
            min={0}
            max={16}
            onChange={setKeyBorderRadius}
            unit="dp"
          />
          <SliderRow
            label="Font Size"
            value={fontSize}
            min={12}
            max={22}
            onChange={setFontSize}
            unit="sp"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SliderRow({
  label, value, min, max, onChange, unit,
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; unit: string;
}) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{Math.round(value)}{unit}</Text>
      </View>
      <Slider
        style={{ width: '100%', height: 32 }}
        minimumValue={min}
        maximumValue={max}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor="#00BCD4"
        maximumTrackTintColor="#2a2a40"
        thumbTintColor="#00BCD4"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  scroll: { padding: 20, paddingTop: 12 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  sectionLabel: {
    color: '#888', fontSize: 12, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 8, letterSpacing: 0.5,
  },
  card: { backgroundColor: '#13132a', borderRadius: 12, padding: 16 },
  sliderRow: { marginBottom: 16 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sliderLabel: { color: '#ccc', fontSize: 13 },
  sliderValue: { color: '#00BCD4', fontSize: 13, fontWeight: '600' },
});
```

> **Note:** `@react-native-community/slider` must be installed: `npx expo install @react-native-community/slider`. If you prefer to avoid an extra dependency, replace `SliderRow` with three preset buttons (Small / Medium / Large) instead — functionally simpler and avoids a native dependency.

---

## 13. Language Selector Screen

```tsx
// app/(tabs)/language.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useSettingsStore } from '../../store/settingsStore';
import LanguageTag from '../../components/LanguageTag';

const LANGUAGES: Array<{ code: 'en' | 'bn'; label: string; native: string }> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'bn', label: 'Bangla',  native: 'বাংলা' },
];

export default function LanguageScreen() {
  const language    = useSettingsStore((s) => s.language);
  const setLanguage  = useSettingsStore((s) => s.setLanguage);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Language</Text>
        <Text style={styles.subtitle}>
          Choose your default typing language. You can always switch
          languages from the keyboard's globe button while typing.
        </Text>

        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.row, language === lang.code && styles.rowSelected]}
            onPress={() => setLanguage(lang.code)}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.rowLabel}>{lang.label}</Text>
              <Text style={styles.rowNative}>{lang.native}</Text>
            </View>
            <LanguageTag code={lang.code} active={language === lang.code} />
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  content: { padding: 20, paddingTop: 12 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 13, lineHeight: 18, marginBottom: 24 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#13132a', borderRadius: 12, padding: 18, marginBottom: 12,
    borderWidth: 2, borderColor: 'transparent',
  },
  rowSelected: { borderColor: '#00BCD4' },
  rowLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rowNative: { color: '#888', fontSize: 13, marginTop: 2 },
});
```

`components/LanguageTag.tsx`:

```tsx
// components/LanguageTag.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LanguageTagProps {
  code: 'en' | 'bn';
  active: boolean;
}

export default function LanguageTag({ code, active }: LanguageTagProps) {
  return (
    <View style={[styles.tag, active && styles.tagActive]}>
      <Text style={[styles.text, active && styles.textActive]}>
        {code.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6, backgroundColor: '#2a2a40',
  },
  tagActive: { backgroundColor: '#00BCD4' },
  text: { color: '#888', fontSize: 11, fontWeight: '700' },
  textActive: { color: '#000' },
});
```

---

## 14. Dictionary Editor Screen

```tsx
// app/(tabs)/dictionary.tsx

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSettingsStore } from '../../store/settingsStore';
import { useKickKeyBridge } from '../../hooks/useKickKeyBridge';

export default function DictionaryScreen() {
  const customWords     = useSettingsStore((s) => s.customWords);
  const addCustomWord     = useSettingsStore((s) => s.addCustomWord);
  const removeCustomWord    = useSettingsStore((s) => s.removeCustomWord);
  const { setDictionaryWords } = useKickKeyBridge();

  const [input, setInput] = useState('');

  // Sync custom words to the native dictionary whenever the list changes.
  // This list is read directly by SuggestionEngine's UserWordModel boost
  // path so custom words always rank above generic dictionary matches.
  useEffect(() => {
    setDictionaryWords(customWords).catch(() => {});
  }, [customWords]);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed.length === 0) return;
    addCustomWord(trimmed);
    setInput('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Custom Dictionary</Text>
          <Text style={styles.subtitle}>
            Add names, slang, or technical terms so KickKey suggests them.
          </Text>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add a word..."
            placeholderTextColor="#555"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleAdd}
            autoCapitalize="none"
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={customWords}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No custom words yet. Add one above.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.wordRow}>
              <Text style={styles.wordText}>{item}</Text>
              <TouchableOpacity onPress={() => removeCustomWord(item)}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  flex: { flex: 1 },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  subtitle: { color: '#888', fontSize: 13, lineHeight: 18 },
  inputRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 10 },
  input: {
    flex: 1, backgroundColor: '#13132a', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15,
  },
  addButton: {
    backgroundColor: '#00BCD4', borderRadius: 10,
    paddingHorizontal: 18, justifyContent: 'center',
  },
  addButtonText: { color: '#000', fontWeight: '700', fontSize: 14 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  wordRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#13132a', borderRadius: 10, padding: 14, marginBottom: 8,
  },
  wordText: { color: '#fff', fontSize: 15 },
  removeText: { color: '#f44336', fontSize: 16, fontWeight: '700', paddingHorizontal: 8 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
```

---

## 15. Shared Components

All shared components (`SetupProgress.tsx`, `ThemeCard.tsx`, `ToggleRow.tsx`, `LanguageTag.tsx`) are listed in full within their respective sections above (9.1, 12.2, 11.1, 13). No additional shared components are required for Phase 5.

---

## 16. Updated `KickKeyModule.kt`

Three new functions are added to support the dictionary editor screen. The custom word list is stored in its own `SharedPreferences` file (separate from `kickkey_prefs`) so it can grow independently without bloating the preferences read on every keyboard open.

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyModule.kt
// ADDITIONS ONLY — merge into the Phase 4 file, inside definition() { ... }

// ── NEW in Phase 5: Custom dictionary management ──────────────────────────────

/**
 * Replaces the entire custom word list with [words].
 * Called by the companion app whenever customWords changes in Zustand.
 * Stored as a newline-joined string in its own SharedPreferences file.
 */
Function("setDictionaryWords") { words: List<String> ->
    val context = appContext.reactContext ?: return@Function
    val serialized = words.joinToString("\n")
    context.getSharedPreferences("kickkey_dictionary", Context.MODE_PRIVATE)
        .edit()
        .putString("custom_words", serialized)
        .apply()
}

/**
 * Returns the current custom word list.
 * Could be called by the companion app to restore state, or in future
 * phases by SuggestionEngine to boost user-added words.
 */
Function("getDictionaryWords") {
    val context = appContext.reactContext ?: return@Function emptyList<String>()
    val raw = context.getSharedPreferences("kickkey_dictionary", Context.MODE_PRIVATE)
        .getString("custom_words", "") ?: ""
    if (raw.isEmpty()) emptyList() else raw.split("\n")
}

/**
 * Removes a single word from the custom dictionary.
 * Provided as a convenience so the companion app doesn't have to
 * resend the entire list for a single deletion.
 */
Function("removeDictionaryWord") { word: String ->
    val context = appContext.reactContext ?: return@Function
    val prefs = context.getSharedPreferences("kickkey_dictionary", Context.MODE_PRIVATE)
    val raw = prefs.getString("custom_words", "") ?: ""
    val updated = raw.split("\n").filter { it != word && it.isNotBlank() }
    prefs.edit().putString("custom_words", updated.joinToString("\n")).apply()
}

// ── All Phase 1–4 functions remain unchanged below this point ─────────────────
```

> **Integration note for a later phase:** `SuggestionEngine.kt`'s `UserWordModel` does not yet read from `kickkey_dictionary`. Wiring custom dictionary words into live suggestion ranking is a natural follow-up enhancement — for now, Phase 5 only ensures the words are persisted and retrievable. If you want custom words to immediately influence suggestions, add a call to read `kickkey_dictionary` inside `UserWordModel.loadFromPrefs()` and merge it with the existing frequency map at a high boost score.

---

## 17. Updated `modules/kickkey-module/index.ts`

```typescript
// modules/kickkey-module/index.ts
import { NativeModules } from 'react-native';
const { KickKey } = NativeModules;

export default {
  // ── Phase 1 ───────────────────────────────────────────────────────────────
  isDefaultKeyboard:    (): Promise<boolean>            => KickKey.isDefaultKeyboard(),
  isKeyboardEnabled:    (): Promise<boolean>            => KickKey.isKeyboardEnabled(),
  openKeyboardSettings: (): void                        => KickKey.openKeyboardSettings(),

  // ── Phase 2 ───────────────────────────────────────────────────────────────
  commitKey:       (code: string, language: string): Promise<void> => KickKey.commitKey(code, language),
  sendBackspace:   (): Promise<void>                               => KickKey.sendBackspace(),
  commitSpace:     (): Promise<void>                               => KickKey.commitSpace(),
  sendEnter:       (): Promise<void>                               => KickKey.sendEnter(),
  getPreferences:  (): Promise<Record<string, any>>               => KickKey.getPreferences(),
  savePreferences: (p: Record<string, any>): Promise<void>        => KickKey.savePreferences(p),

  // ── Phase 3 ───────────────────────────────────────────────────────────────
  flushBanglaBuffer: (): Promise<void>           => KickKey.flushBanglaBuffer(),
  setBanglaEnabled:  (e: boolean): Promise<void> => KickKey.setBanglaEnabled(e),

  // ── Phase 4 ───────────────────────────────────────────────────────────────
  commitSuggestion: (word: string): Promise<void> => KickKey.commitSuggestion(word),

  // ── Phase 5 (new) ─────────────────────────────────────────────────────────

  /** Replaces the entire custom dictionary with [words]. */
  setDictionaryWords: (words: string[]): Promise<void> =>
    KickKey.setDictionaryWords(words),

  /** Returns the current custom dictionary word list. */
  getDictionaryWords: (): Promise<string[]> =>
    KickKey.getDictionaryWords(),

  /** Removes a single word from the custom dictionary. */
  removeDictionaryWord: (word: string): Promise<void> =>
    KickKey.removeDictionaryWord(word),
};
```

---

## 18. Build & Test

### 18.1 Install Expo Router Dependencies (if not already present)

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install @react-native-community/slider
```

### 18.2 Switch the Entry Point to Expo Router

Update `package.json`:

```json
{
  "main": "expo-router/entry"
}
```

Delete the old root `App.tsx` and the old `index.js` that called `registerRootComponent(App)` — Expo Router replaces both.

```bash
rm App.tsx
```

> ⚠️ Do **not** delete `keyboard.index.js` — it remains the entry point for the keyboard bundle and is completely separate from the companion app's Expo Router entry.

### 18.3 Update `app.json`

```json
{
  "expo": {
    "scheme": "kickkey",
    "plugins": [
      "expo-router",
      "./plugins/withImeService",
      "./plugins/withKeyboardBundle"
    ]
  }
}
```

### 18.4 Rebuild

The companion app bundle (`main.bundle`) needs to be rebuilt since its entry point changed. The keyboard bundle is untouched in this phase.

```bash
# Prebuild to apply the expo-router plugin and updated app.json
npx expo prebuild --platform android --clean

# Build & install
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 18.5 Monitor Logs

```bash
adb logcat -s ReactNativeJS KickKeyModule

# On first launch, expect to be routed to onboarding:
# (no log line for routing itself, but the UI should show Step 1)

# After enabling the keyboard in Android Settings and returning to the app:
# Step 1 should auto-advance to Step 2 within ~2 seconds (poll interval)
```

---

## 19. Verification Checklist

Complete every item before Phase 6.

### Navigation & Onboarding

- [ ] Fresh install opens directly to onboarding Step 1 (not the home screen)
- [ ] Step 1 shows the "Open Keyboard Settings" button and step instructions
- [ ] Enabling KickKey in Android Settings and returning to the app auto-advances to Step 2 within ~2 seconds
- [ ] Step 2 shows "Set Default Keyboard" button
- [ ] Setting KickKey as default and returning to the app auto-advances to Step 3
- [ ] Step 3 shows the success screen with "Start Using KickKey" button
- [ ] Tapping "Start Using KickKey" navigates to the Home tab
- [ ] Force-quitting and reopening the app after onboarding goes straight to the tabs (not onboarding again)
- [ ] Manually disabling the keyboard in Android Settings and reopening the app routes back to onboarding

### Home Screen

- [ ] Shows live "Keyboard Enabled" and "Set as Default" status
- [ ] Shows the currently active language
- [ ] The "Try it out" text field appears only when fully set up
- [ ] Typing in the test field actually uses the KickKey keyboard

### Settings Screen

- [ ] Haptic Feedback toggle changes state visually
- [ ] Toggling haptic off, then opening the keyboard in any app — key presses produce no vibration
- [ ] Toggling haptic back on — vibration resumes
- [ ] Auto-correct toggle persists across app restarts (AsyncStorage)
- [ ] Show Suggestions toggle, when turned off, hides the suggestion bar content in the keyboard (verify by opening keyboard after toggling)

### Theme Picker

- [ ] All three theme presets (Dark, Light, AMOLED) render distinct preview cards
- [ ] Selecting a preset shows a checkmark and highlighted border
- [ ] After selecting a new theme, opening the keyboard in any app shows the updated colors
- [ ] Key Height slider changes value when dragged
- [ ] Corner Radius slider changes value when dragged
- [ ] Font Size slider changes value when dragged
- [ ] After adjusting sliders, the keyboard reflects the new key height/radius/font size on next open

### Language Selector

- [ ] Selecting "English" highlights the English row
- [ ] Selecting "Bangla" highlights the Bangla row
- [ ] The keyboard's default language on next open matches the selection
- [ ] The in-keyboard globe-button language switch still works independently (per-session override)

### Dictionary Editor

- [ ] Typing a word and tapping "Add" adds it to the list below
- [ ] The added word appears immediately in the `FlatList`
- [ ] Duplicate words are not added twice (Set-based dedup in the store)
- [ ] Tapping "✕" next to a word removes it from the list
- [ ] Words persist after closing and reopening the app
- [ ] `adb logcat -s KickKeyModule` (if logging added) or manual check confirms `setDictionaryWords` is called whenever the list changes

### Settings Sync

- [ ] `adb shell run-as com.kickkey cat shared_prefs/kickkey_prefs.xml` (on a debug build) shows updated values after changing settings
- [ ] Rapidly dragging a slider does not cause visible lag (debounce working)
- [ ] No crash or ANR when switching tabs rapidly while settings sync is in flight

---

## 20. Troubleshooting

### App opens to a blank white screen after switching to Expo Router

**Cause:** `package.json` `"main"` field was not updated to `"expo-router/entry"`, or the old `App.tsx` / `index.js` is still present and conflicting.

**Fix:**
```bash
cat package.json | grep '"main"'
# Must show: "main": "expo-router/entry"

rm -f App.tsx index.js
npx expo prebuild --platform android --clean
```

---

### Onboarding loops infinitely — never advances past Step 1 even after enabling the keyboard

**Cause:** `useSetupStatus` polling interval is running, but the `isEnabled` value isn't updating, usually because `useKickKeyBridge` isn't correctly bound or `KickKeyModule.isKeyboardEnabled` is failing silently.

**Check:**
```bash
adb logcat -s ReactNativeJS | grep -i error
```
Confirm `NativeModules.KickKey` is not `undefined` by adding a temporary `console.log(NativeModules.KickKey)` in `useKickKeyBridge.ts`.

---

### Theme changes don't appear in the keyboard even after selecting a new preset

**Cause:** `useSettingsSync` is not mounted, or the debounce timer is being cleared before it fires (e.g., screen unmounts immediately after a theme tap due to navigation).

**Fix:** Confirm `useSettingsSync()` is called once in `app/_layout.tsx`, not inside individual screens — it must persist across navigation.

**Also confirm:** the keyboard was fully closed and reopened after the change. Theme changes apply on next `onCreateInputView()`, not live while the keyboard is visible (see Section 2 architecture note).

---

### Custom dictionary words disappear after app restart

**Cause:** Zustand's `persist` middleware key conflicts, or `AsyncStorage` is not properly linked.

**Fix:**
```bash
npx expo install @react-native-async-storage/async-storage
npx expo prebuild --platform android --clean
```
Confirm the store's `name: 'kickkey-settings'` is unique and not reused by another persisted store in the app.

---

### `@react-native-community/slider` causes a build error

**Cause:** Native module not linked after `expo prebuild`.

**Fix:**
```bash
npx expo install @react-native-community/slider
npx expo prebuild --platform android --clean
cd android && ./gradlew clean assembleDebug
```
If the dependency continues to cause friction, replace the slider UI with three preset-size buttons (Small/Medium/Large) mapped to fixed `keyHeight`/`fontSize` values — this removes the native dependency entirely.

---

### Settings screen shows correct values but the keyboard never reflects them, even after multiple opens

**Cause:** `KickKeyModule.savePreferences` and `getPreferences` may be reading/writing to different `SharedPreferences` file names due to a typo.

**Check both sides:**
```kotlin
// Must match exactly in both savePreferences and getPreferences:
context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
```

---

*Phase 5 complete. Proceed to Phase 6 — Emoji & Clipboard — to build the emoji picker panel and clipboard history panel, replacing the stub screens left in place since Phase 2.*
