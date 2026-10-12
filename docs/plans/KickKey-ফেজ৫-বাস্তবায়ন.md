# KickKey — ফেজ ৫ বাস্তবায়ন গাইড
## কম্প্যানিয়ন অ্যাপ (সপ্তাহ ৯–১০)

> **লক্ষ্য:** কম্প্যানিয়ন অ্যাপ সম্পূর্ণরূপে কার্যকরী হবে — একটি ৩-ধাপের অনবোর্ডিং উইজার্ড, হ্যাপটিক/সাউন্ড/অটোকারেক্ট টগল সহ একটি সেটিংস স্ক্রিন, একটি থিম পিকার (ডার্ক/লাইট/AMOLED + কাস্টম রঙ), একটি ভাষা নির্বাচক, এবং একটি কাস্টম ডিকশনারি এডিটর। সমস্ত সেটিংস SharedPreferences-এর মাধ্যমে IME-তে সিঙ্ক হবে এবং থিম পরিবর্তন পরবর্তী কীবোর্ড খোলায় প্রতিফলিত হবে।
> **ফেজ ৪-এর উপর নির্মিত** — কীবোর্ড সম্পূর্ণরূপে ইংরেজি ও বাংলায় টাইপ, সাজেশন, এবং অটোকারেক্ট করে। ফেজ ৫ কোনো কীবোর্ড-বান্ডেল কোড (`src/keyboard/`) স্পর্শ করে না। এটি সম্পূর্ণরূপে `app/` (Expo Router কম্প্যানিয়ন স্ক্রিন), `store/` (Zustand স্টেট), এবং সিঙ্ক লেয়ারের উপর কেন্দ্রীভূত যা প্রেফারেন্স `SharedPreferences`-এ লেখে, যা কীবোর্ড সাইডে `useKeyboardTheme.ts` ইতিমধ্যে পড়ে।

---

## বিষয়সূচি

1. [ফেজ ৫-এ কী পরিবর্তন হয়](#1-ফেজ-৫-তে-কী-পরিবর্তন-হয়)
2. [আর্কিটেকচার: সেটিংস কীভাবে কীবোর্ডে পৌঁছায়](#2-আর্কিটেকচার-সেটিংস-কীভাবে-কীবোর্ডে-পৌঁছায়)
3. [আপডেটেড ফোল্ডার স্ট্রাকচার](#3-আপডেটেড-ফোল্ডার-স্ট্রাকচার)
4. [Zustand সেটিংস স্টোর](#4-zustand-সেটিংস-স্টোর)
5. [useKickKeyBridge হুক](#5-usekickkeybridge-হুক)
6. [useSetupStatus হুক](#6-usesetupstatus-হুক)
7. [useSettingsSync হুক](#7-usesettingssync-হুক)
8. [রুট লেআউট ও নেভিগেশন](#8-রুট-লেআউট-ও-নেভিগেশন)
9. [অনবোর্ডিং স্ক্রিন](#9-অনবোর্ডিং-স্ক্রিন)
10. [হোম স্ক্রিন](#10-হোম-স্ক্রিন)
11. [সেটিংস স্ক্রিন](#11-সেটিংস-স্ক্রিন)
12. [থিম পিকার স্ক্রিন](#12-থিম-পিকার-স্ক্রিন)
13. [ভাষা নির্বাচক স্ক্রিন](#13-ভাষা-নির্বাচক-স্ক্রিন)
14. [ডিকশনারি এডিটর স্ক্রিন](#14-ডিকশনারি-এডিটর-স্ক্রিন)
15. [শেয়ার্ড কম্পোনেন্ট](#15-শেয়ার্ড-কম্পোনেন্ট)
16. [আপডেটেড KickKeyModule.kt](#16-আপডেটেড-kickkeymodulekt)
17. [আপডেটেড modules/kickkey-module/index.ts](#17-আপডেটেড-moduleskickkey-moduleindexts)
18. [বিল্ড ও পরীক্ষা](#18-বিল্ড-ও-পরীক্ষা)
19. [যাচাই চেকলিস্ট](#19-যাচাই-চেকলিস্ট)
20. [সমস্যা সমাধান](#20-সমস্যা-সমাধান)

---

## 1. ফেজ ৫-তে কী পরিবর্তন হয়

### তৈরি করতে হবে (নতুন ফাইল)

| ফাইল | উদ্দেশ্য |
|---|---|
| `store/settingsStore.ts` | AsyncStorage পার্সিস্টেন্স সহ Zustand স্টোর — কম্প্যানিয়ন অ্যাপ সেটিংসের একক উৎস |
| `hooks/useKickKeyBridge.ts` | কম্প্যানিয়ন-অ্যাপ-মাত্র কলের জন্য `NativeModules.KickKey`-এর পাতলা র‍্যাপার |
| `hooks/useSetupStatus.ts` | অনবোর্ডিং দৃশ্যমান থাকাকালীন প্রতি ২ সেকেন্ডে `isKeyboardEnabled()` / `isDefaultKeyboard()` পোল করে |
| `hooks/useSettingsSync.ts` | প্রতিটি পরিবর্তনে Zustand স্টেট `SharedPreferences`-এ লেখে |
| `app/_layout.tsx` | রুট Expo Router লেআউট — অনবোর্ডিং বনাম ট্যাব নির্ধারণ করে |
| `app/onboarding/_layout.tsx` | ৩-ধাপের অনবোর্ডিং প্রবাহের জন্য স্ট্যাক লেআউট |
| `app/onboarding/step1-enable.tsx` | "KickKey সক্রিয় করুন" স্ক্রিন |
| `app/onboarding/step2-default.tsx` | "ডিফল্ট হিসেবে সেট করুন" স্ক্রিন |
| `app/onboarding/step3-done.tsx` | সাফল্য / সমাপ্তি স্ক্রিন |
| `app/(tabs)/_layout.tsx` | নিচের ট্যাব নেভিগেটর |
| `app/(tabs)/index.tsx` | হোম স্ক্রিন — ফেজ ১-এর `App.tsx` প্লেসহোল্ডার প্রতিস্থাপন করে |
| `app/(tabs)/settings.tsx` | সেটিংস স্ক্রিন |
| `app/(tabs)/themes.tsx` | থিম পিকার |
| `app/(tabs)/language.tsx` | ভাষা নির্বাচক |
| `app/(tabs)/dictionary.tsx` | কাস্টম ডিকশনারি এডিটর |
| `components/SetupProgress.tsx` | পুনঃব্যবহারযোগ্য ৩-ডট প্রগ্রেস নির্দেশক |
| `components/ThemeCard.tsx` | ট্যাপযোগ্য থিম প্রিভিউ কার্ড |
| `components/ToggleRow.tsx` | সেটিংসজুড়ে ব্যবহৃত লেবেল + Switch সারি |
| `components/LanguageTag.tsx` | ছোট ভাষা পিল ব্যাজ |
| `constants/Themes.ts` | পূর্বনির্ধারিত থিম প্রিসেট (ডার্ক / লাইট / AMOLED) |

### আপডেট করতে হবে (আংশিক পরিবর্তন)

| ফাইল | কী পরিবর্তন হয় |
|---|---|
| `modules/kickkey-module/android/.../KickKeyModule.kt` | `setDictionaryWords`, `getDictionaryWords`, `removeDictionaryWord` যোগ |
| `modules/kickkey-module/index.ts` | তিনটি নতুন ডিকশনারি মেথড এক্সপোর্ট |
| `app.json` | `expo-router` প্লাগইন কনফিগ যোগ, scheme সেট |
| `package.json` | `expo-router`, `zustand`, `@react-native-async-storage/async-storage` ইনস্টল আছে নিশ্চিত করুন |

### মুছে ফেলতে হবে

| ফাইল | কারণ |
|---|---|
| `App.tsx` (রুট) | Expo Router-এর `app/` ডিরেক্টরি স্ট্রাকচার দ্বারা সম্পূর্ণরূপে প্রতিস্থাপিত |
| `index.js` (যদি `registerRootComponent(App)` কল করে) | Expo Router পরিবর্তে `expo-router/entry` ব্যবহার করে |

### পরিবর্তন হবে না

`src/keyboard/`, `android/app/src/main/java/com/kickkey/BanglaInputEngine.kt`, `SuggestionEngine.kt`, `Trie.kt`, `UserWordModel.kt`, `HapticManager.kt`, `KickKeyApplication.kt`, `KickKeyInputMethodService.kt`, `keyboard.index.js`, সমস্ত ডিকশনারি `.bin`/`.txt` ফাইল, এবং `plugins/`-এর সবকিছু।

---

## 2. আর্কিটেকচার: সেটিংস কীভাবে কীবোর্ডে পৌঁছায়

```
কম্প্যানিয়ন অ্যাপ (মূল প্রসেস)                  IME সার্ভিস (:ime_process)
─────────────────────────────                    ──────────────────────────
ব্যবহারকারী "Dark AMOLED" থিম কার্ড ট্যাপ করে
        │
        ▼
useSettingsStore.setTheme('amoled')
        │
        ▼  [Zustand স্টেট আপডেট হয়]
useSettingsSync useEffect চালু হয়
        │
        ▼
NativeModules.KickKey.savePreferences({
  theme: 'amoled',
  keyboardBg: '#000000',
  ...
})
        │
        ▼  [Kotlin, মূল প্রসেস]
KickKeyModule.savePreferences()
  → SharedPreferences.edit().putString(...).apply()
        │
        ▼  [Android OS — SharedPreferences প্রতি-অ্যাপ, একই অ্যাপের
              সমস্ত প্রসেসে শেয়ার্ড, :ime_process সহ]
                                                          │
                                                          ▼
                                          পরবর্তীবার কীবোর্ড খোলার সময়:
                                          KickKeyInputMethodService.onCreateInputView()
                                                          │
                                                          ▼
                                          KeyboardScreen.tsx মাউন্ট হয়
                                                          │
                                                          ▼
                                          useKeyboardTheme() কল করে
                                          NativeModules.KickKey.getPreferences()
                                                          │
                                                          ▼
                                          Kotlin কম্প্যানিয়ন অ্যাপের লেখা
                                          একই SharedPreferences ফাইল পড়ে
                                                          │
                                                          ▼
                                          কীবোর্ড নতুন থিম রঙ সহ রেন্ডার হয়
```

**মূল অন্তর্দৃষ্টি:** এই ফেজে দুটি প্রসেসের মধ্যে যোগাযোগের একমাত্র চ্যানেল `SharedPreferences`। কম্প্যানিয়ন অ্যাপ থেকে লাইভ `:ime_process`-এ সরাসরি কোনো IPC কল নেই — IME শুধুমাত্র পরবর্তীবার দেখানোর সময় প্রেফারেন্স পুনরায় পড়ে। এজন্যই থিম পরিবর্তন "পরবর্তী কীবোর্ড খোলায়" প্রয়োগ হয়, তাৎক্ষণিকভাবে নয়। এই ট্রেডঅফ ইচ্ছাকৃত এবং আর্কিটেকচারকে সহজ ও মজবুত রাখে।

---

## 3. আপডেটেড ফোল্ডার স্ট্রাকচার

```
KickKey/
├── app/                                  ← নতুন (Expo Router রুট)
│   ├── _layout.tsx                       ← নতুন
│   ├── onboarding/
│   │   ├── _layout.tsx                   ← নতুন
│   │   ├── step1-enable.tsx              ← নতুন
│   │   ├── step2-default.tsx             ← নতুন
│   │   └── step3-done.tsx                ← নতুন
│   └── (tabs)/
│       ├── _layout.tsx                   ← নতুন
│       ├── index.tsx                     ← নতুন
│       ├── settings.tsx                  ← নতুন
│       ├── themes.tsx                    ← নতুন
│       ├── language.tsx                  ← নতুন
│       └── dictionary.tsx                ← নতুন
│
├── components/                           ← নতুন ডিরেক্টরি
│   ├── SetupProgress.tsx                 ← নতুন
│   ├── ThemeCard.tsx                     ← নতুন
│   ├── ToggleRow.tsx                     ← নতুন
│   └── LanguageTag.tsx                   ← নতুন
│
├── hooks/                                ← নতুন ডিরেক্টরি (শুধু কম্প্যানিয়ন অ্যাপ)
│   ├── useKickKeyBridge.ts               ← নতুন
│   ├── useSetupStatus.ts                 ← নতুন
│   └── useSettingsSync.ts                ← নতুন
│
├── store/                                ← নতুন ডিরেক্টরি
│   └── settingsStore.ts                  ← নতুন
│
├── constants/
│   └── Themes.ts                         ← নতুন
│
├── App.tsx                               ← মুছুন
│
├── src/keyboard/                         (ফেজ ৪ থেকে অপরিবর্তিত)
├── keyboard.index.js                     (অপরিবর্তিত)
├── modules/kickkey-module/
│   ├── index.ts                          ← আপডেট
│   └── android/src/main/java/com/kickkey/
│       └── KickKeyModule.kt              ← আপডেট
└── android/app/src/main/java/com/kickkey/  (ফেজ ৪ থেকে অপরিবর্তিত)
```

---

## 4. Zustand সেটিংস স্টোর

সমস্ত কম্প্যানিয়ন-অ্যাপ-নিয়ন্ত্রিত সেটিংসের একক উৎস। `AsyncStorage`-এ পার্সিস্টেড যাতে কম্প্যানিয়ন অ্যাপ রিস্টার্টের মধ্যে স্টেট মনে রাখে।

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
  // অনবোর্ডিং
  hasCompletedOnboarding: boolean;
  setOnboardingComplete: (done: boolean) => void;

  // ভাষা
  language: 'en' | 'bn';
  setLanguage: (lang: 'en' | 'bn') => void;

  // থিম
  theme: ThemeName;
  themeColors: ThemeColors;
  setTheme: (theme: ThemeName) => void;
  setThemeColors: (colors: Partial<ThemeColors>) => void;

  // লেআউট
  keyHeight: number;
  keyBorderRadius: number;
  fontSize: number;
  keyMargin: number;
  setKeyHeight: (v: number) => void;
  setKeyBorderRadius: (v: number) => void;
  setFontSize: (v: number) => void;

  // ফিডব্যাক
  hapticEnabled: boolean;
  soundEnabled: boolean;
  toggleHaptic: () => void;
  toggleSound: () => void;

  // ইনপুট আচরণ
  autoCorrect: boolean;
  showSuggestions: boolean;
  toggleAutoCorrect: () => void;
  toggleShowSuggestions: () => void;

  // কাস্টম ডিকশনারি
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

## 5. `useKickKeyBridge` হুক

কম্প্যানিয়ন-অ্যাপ স্ক্রিনের জন্য নেটিভ মডিউলের একটি পাতলা, টাইপড র‍্যাপার।

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

## 6. `useSetupStatus` হুক

প্রতি ২ সেকেন্ডে IME সক্রিয়করণ স্টেট পোল করে। Android কীবোর্ড সেটিংস পরিবর্তনের জন্য কোনো কলব্যাক প্রদান করে না, তাই পর্যায়ক্রমে পরীক্ষা করাই একমাত্র উপায়।

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

    // অ্যাপ ফোরগ্রাউন্ডে ফিরলে অবিলম্বে রিফ্রেশ করুন —
    // এটি Android Settings থেকে ফিরে আসার মুহূর্ত, তাই প্রায়-তাৎক্ষণিক ফিডব্যাক দেয়
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

## 7. `useSettingsSync` হুক

প্রতিবার পরিবর্তিত হলে Zustand স্টোরের প্রাসঙ্গিক ফিল্ড `SharedPreferences`-এ লেখে (`KickKeyModule.savePreferences` দ্বারা)। এটি সেকশন ২-এর আর্কিটেকচার ডায়াগ্রামের ব্রিজ।

```typescript
// hooks/useSettingsSync.ts

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useKickKeyBridge } from './useKickKeyBridge';

/**
 * অ্যাপের রুটের কাছে একবার এটি কল করুন (app/_layout.tsx-এ)।
 * কীবোর্ড যে সেটিংস নিয়ে চিন্তা করে তার প্রতিটিতে সাবস্ক্রাইব করে এবং
 * পরিবর্তন হলে SharedPreferences-এ পুশ করে।
 *
 * ৩০০ms ডিবাউন্সড যাতে ব্যবহারকারী স্লাইডার টানার সময়
 * SharedPreferences-এ অতিরিক্ত লেখা না হয়।
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
        // নীরবে উপেক্ষা করুন — SharedPreferences লেখা খুব কমই ব্যর্থ হয়
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

## 8. রুট লেআউট ও নেভিগেশন

### ৮.১ `app/_layout.tsx`

রুট লেআউট `hasCompletedOnboarding` এবং লাইভ সেটআপ স্ট্যাটাস উভয়ের ভিত্তিতে অনবোর্ডিং নাকি মূল ট্যাব নেভিগেটর দেখাবে তা নির্ধারণ করে। যদি ব্যবহারকারী একবার অনবোর্ডিং সম্পন্ন করেও পরে Android Settings-এ কীবোর্ড নিষ্ক্রিয় করেন, এই লেআউট তাদের অনবোর্ডিংয়ে ফিরিয়ে দেয়।

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

  // প্রতিটি পরিবর্তনে সেটিংস SharedPreferences-এ সিঙ্ক করুন, অ্যাপ-জুড়ে
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

### ৮.২ `app/onboarding/_layout.tsx`

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

### ৮.৩ `app/(tabs)/_layout.tsx`

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
          title: 'হোম',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'সেটিংস',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="themes"
        options={{
          title: 'থিম',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎨" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="language"
        options={{
          title: 'ভাষা',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🌐" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dictionary"
        options={{
          title: 'ডিকশনারি',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
```

---

## 9. অনবোর্ডিং স্ক্রিন

### ৯.১ `components/SetupProgress.tsx`

প্রতিটি অনবোর্ডিং স্ক্রিনের শীর্ষে দেখানো একটি পুনঃব্যবহারযোগ্য ৩-ডট স্টেপার।

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

### ৯.২ `app/onboarding/step1-enable.tsx`

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
      <Text style={styles.title}>KickKey সক্রিয় করুন</Text>
      <Text style={styles.description}>
        প্রথমে, আপনার ফোনের কীবোর্ড সেটিংসে KickKey চালু করতে হবে।
        Android একটি নিরাপত্তা নোটিশ দেখাবে — এটি প্রতিটি কীবোর্ড অ্যাপের
        জন্য স্বাভাবিক। চালিয়ে যেতে "OK" ট্যাপ করুন।
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardStep}>১. নিচের বাটন ট্যাপ করুন</Text>
        <Text style={styles.cardStep}>২. তালিকায় "KickKey Keyboard" খুঁজুন</Text>
        <Text style={styles.cardStep}>৩. এটি চালু করুন</Text>
        <Text style={styles.cardStep}>৪. নিরাপত্তা নোটিশে "OK" ট্যাপ করুন</Text>
        <Text style={styles.cardStep}>৫. এই অ্যাপে ফিরে আসুন</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => openKeyboardSettings()}>
        <Text style={styles.buttonText}>কীবোর্ড সেটিংস খুলুন</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        KickKey সক্রিয় হলে এই স্ক্রিন স্বয়ংক্রিয়ভাবে এগিয়ে যাবে।
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

### ৯.৩ `app/onboarding/step2-default.tsx`

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
      <Text style={styles.title}>ডিফল্ট হিসেবে সেট করুন</Text>
      <Text style={styles.description}>
        প্রায় শেষ! এখন KickKey কে আপনার ডিফল্ট কীবোর্ড হিসেবে সেট করুন
        যাতে আপনি কোনো টেক্সট ফিল্ডে ট্যাপ করলে এটি স্বয়ংক্রিয়ভাবে খোলে।
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardStep}>১. নিচের বাটন ট্যাপ করুন</Text>
        <Text style={styles.cardStep}>২. "KickKey Keyboard" ডিফল্ট হিসেবে নির্বাচন করুন</Text>
        <Text style={styles.cardStep}>৩. এই অ্যাপে ফিরে আসুন</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => openKeyboardSettings()}>
        <Text style={styles.buttonText}>ডিফল্ট কীবোর্ড সেট করুন</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        KickKey আপনার ডিফল্ট কীবোর্ড হলে এই স্ক্রিন স্বয়ংক্রিয়ভাবে এগিয়ে যাবে।
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

### ৯.৪ `app/onboarding/step3-done.tsx`

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
      <Text style={styles.title}>সব প্রস্তুত!</Text>
      <Text style={styles.description}>
        KickKey ব্যবহারের জন্য প্রস্তুত। যেকোনো অ্যাপে যেকোনো টেক্সট ফিল্ডে
        ট্যাপ করুন এবং আপনার নতুন কীবোর্ড দেখা যাবে। আপনি যেকোনো সময়
        গ্লোব বাটন দিয়ে ভাষা পরিবর্তন করতে পারেন, এবং Settings ট্যাবে
        আপনার অভিজ্ঞতা কাস্টমাইজ করতে পারেন।
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleFinish}>
        <Text style={styles.buttonText}>KickKey ব্যবহার শুরু করুন</Text>
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

## 10. হোম স্ক্রিন

এটি ফেজ ১-এর `App.tsx` প্লেসহোল্ডার প্রতিস্থাপন করে। লাইভ সেটআপ স্ট্যাটাস, দ্রুত লিঙ্ক, এবং একটি "চেষ্টা করুন" টেক্সট ফিল্ড দেখায় যাতে ব্যবহারকারীরা অ্যাপ ছাড়াই কীবোর্ড পরীক্ষা করতে পারেন।

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
        <Text style={styles.subtitle}>আপনার কাস্টম কীবোর্ড</Text>

        <View style={styles.statusCard}>
          <StatusRow label="কীবোর্ড সক্রিয়" value={isEnabled} />
          <StatusRow label="ডিফল্ট হিসেবে সেট" value={isDefault} />
          <StatusRow label="সক্রিয় ভাষা" value={language === 'en' ? 'English' : 'বাংলা'} isText />
        </View>

        {isFullySetUp && (
          <>
            <Text style={styles.sectionLabel}>চেষ্টা করুন</Text>
            <TextInput
              style={styles.testInput}
              placeholder="এখানে ট্যাপ করুন এবং টাইপ শুরু করুন..."
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
          {value ? '✅ হ্যাঁ' : '❌ না'}
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

## 11. সেটিংস স্ক্রিন

### ১১.১ `components/ToggleRow.tsx`

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

### ১১.২ `app/(tabs)/settings.tsx`

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
        <Text style={styles.title}>সেটিংস</Text>

        <Text style={styles.sectionLabel}>ফিডব্যাক</Text>
        <View style={styles.card}>
          <ToggleRow
            label="হ্যাপটিক ফিডব্যাক"
            description="প্রতিটি কী প্রেসে ভাইব্রেট করুন"
            value={hapticEnabled}
            onValueChange={toggleHaptic}
          />
          <ToggleRow
            label="কী সাউন্ড"
            description="কী প্রেসে ক্লিক সাউন্ড বাজান"
            value={soundEnabled}
            onValueChange={toggleSound}
          />
        </View>

        <Text style={styles.sectionLabel}>টাইপিং</Text>
        <View style={styles.card}>
          <ToggleRow
            label="অটো-কারেক্ট"
            description="স্পেস প্রেস করলে স্বয়ংক্রিয়ভাবে টাইপো ঠিক করুন"
            value={autoCorrect}
            onValueChange={toggleAutoCorrect}
          />
          <ToggleRow
            label="সাজেশন দেখান"
            description="কীবোর্ডের উপরে শব্দ সাজেশন প্রদর্শন করুন"
            value={showSuggestions}
            onValueChange={toggleShowSuggestions}
          />
        </View>

        <Text style={styles.footnote}>
          পরবর্তীবার কীবোর্ড খুললে পরিবর্তনগুলো স্বয়ংক্রিয়ভাবে প্রয়োগ হয়।
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

## 12. থিম পিকার স্ক্রিন

### ১২.১ `constants/Themes.ts`

তিনটি বিল্ট-ইন প্রিসেট, প্রতিটি কীবোর্ডের প্রয়োজনীয় সম্পূর্ণ রঙ প্যালেট প্রদান করে।

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
    label: 'ডার্ক',
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
    label: 'লাইট',
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
    label: 'AMOLED ব্ল্যাক',
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

### ১২.২ `components/ThemeCard.tsx`

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
      {/* মিনি কীবোর্ড প্রিভিউ */}
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

### ১২.৩ `app/(tabs)/themes.tsx`

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
        <Text style={styles.title}>থিম</Text>

        <Text style={styles.sectionLabel}>রঙের থিম</Text>
        {THEME_PRESETS.map((preset) => (
          <ThemeCard
            key={preset.name}
            preset={preset}
            isSelected={theme === preset.name}
            onPress={() => handleSelectPreset(preset)}
          />
        ))}

        <Text style={styles.sectionLabel}>কী আকার</Text>
        <View style={styles.card}>
          <SliderRow
            label="কী উচ্চতা"
            value={keyHeight}
            min={40}
            max={60}
            onChange={setKeyHeight}
            unit="dp"
          />
          <SliderRow
            label="কোণার ব্যাসার্ধ"
            value={keyBorderRadius}
            min={0}
            max={16}
            onChange={setKeyBorderRadius}
            unit="dp"
          />
          <SliderRow
            label="ফন্ট সাইজ"
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

> **নোট:** `@react-native-community/slider` ইনস্টল করতে হবে: `npx expo install @react-native-community/slider`। অতিরিক্ত ডিপেন্ডেন্সি এড়াতে চাইলে, `SliderRow`-এর পরিবর্তে তিনটি প্রিসেট বাটন (ছোট / মাঝারি / বড়) ব্যবহার করুন।

---

## 13. ভাষা নির্বাচক স্ক্রিন

```tsx
// app/(tabs)/language.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useSettingsStore } from '../../store/settingsStore';
import LanguageTag from '../../components/LanguageTag';

const LANGUAGES: Array<{ code: 'en' | 'bn'; label: string; native: string }> = [
  { code: 'en', label: 'ইংরেজি', native: 'English' },
  { code: 'bn', label: 'বাংলা',  native: 'বাংলা' },
];

export default function LanguageScreen() {
  const language    = useSettingsStore((s) => s.language);
  const setLanguage  = useSettingsStore((s) => s.setLanguage);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>ভাষা</Text>
        <Text style={styles.subtitle}>
          আপনার ডিফল্ট টাইপিং ভাষা নির্বাচন করুন। টাইপ করার সময়
          কীবোর্ডের গ্লোব বাটন দিয়ে আপনি যেকোনো সময় ভাষা পরিবর্তন করতে পারেন।
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

## 14. ডিকশনারি এডিটর স্ক্রিন

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

  // তালিকা পরিবর্তিত হলেই কাস্টম শব্দ নেটিভ ডিকশনারিতে সিঙ্ক করুন।
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
          <Text style={styles.title}>কাস্টম ডিকশনারি</Text>
          <Text style={styles.subtitle}>
            নাম, স্ল্যাং, বা প্রযুক্তিগত শব্দ যোগ করুন যাতে KickKey সেগুলো সাজেস্ট করে।
          </Text>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="একটি শব্দ যোগ করুন..."
            placeholderTextColor="#555"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleAdd}
            autoCapitalize="none"
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>যোগ করুন</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={customWords}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>এখনো কোনো কাস্টম শব্দ নেই। উপরে একটি যোগ করুন।</Text>
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

## 15. শেয়ার্ড কম্পোনেন্ট

সমস্ত শেয়ার্ড কম্পোনেন্ট (`SetupProgress.tsx`, `ThemeCard.tsx`, `ToggleRow.tsx`, `LanguageTag.tsx`) উপরের সংশ্লিষ্ট সেকশনে (৯.১, ১২.২, ১১.১, ১৩) সম্পূর্ণরূপে তালিকাভুক্ত। ফেজ ৫-এর জন্য অতিরিক্ত কোনো শেয়ার্ড কম্পোনেন্ট প্রয়োজন নেই।

---

## 16. আপডেটেড `KickKeyModule.kt`

ডিকশনারি এডিটর স্ক্রিন সাপোর্ট করতে তিনটি নতুন ফাংশন যোগ করা হয়েছে। কাস্টম শব্দ তালিকা তার নিজস্ব `SharedPreferences` ফাইলে (`kickkey_prefs` থেকে আলাদা) সংরক্ষিত হয় যাতে এটি প্রতিটি কীবোর্ড খোলায় পড়া প্রেফারেন্স ফুলিয়ে না দিয়ে স্বাধীনভাবে বাড়তে পারে।

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyModule.kt
// শুধুমাত্র সংযোজন — definition() { ... }-এর ভেতরে ফেজ ৪ ফাইলে একত্রিত করুন

// ── ফেজ ৫-এ নতুন: কাস্টম ডিকশনারি ম্যানেজমেন্ট ──────────────────────────────

/**
 * পুরো কাস্টম শব্দ তালিকা [words] দিয়ে প্রতিস্থাপন করে।
 * Zustand-এ customWords পরিবর্তিত হলেই কম্প্যানিয়ন অ্যাপ দ্বারা কল করা হয়।
 * নিজস্ব SharedPreferences ফাইলে নিউলাইন-জোড়া স্ট্রিং হিসেবে সংরক্ষিত।
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
 * বর্তমান কাস্টম শব্দ তালিকা ফেরত দেয়।
 */
Function("getDictionaryWords") {
    val context = appContext.reactContext ?: return@Function emptyList<String>()
    val raw = context.getSharedPreferences("kickkey_dictionary", Context.MODE_PRIVATE)
        .getString("custom_words", "") ?: ""
    if (raw.isEmpty()) emptyList() else raw.split("\n")
}

/**
 * কাস্টম ডিকশনারি থেকে একটি একক শব্দ সরায়।
 */
Function("removeDictionaryWord") { word: String ->
    val context = appContext.reactContext ?: return@Function
    val prefs = context.getSharedPreferences("kickkey_dictionary", Context.MODE_PRIVATE)
    val raw = prefs.getString("custom_words", "") ?: ""
    val updated = raw.split("\n").filter { it != word && it.isNotBlank() }
    prefs.edit().putString("custom_words", updated.joinToString("\n")).apply()
}

// ── এই বিন্দুর নিচে সমস্ত ফেজ ১–৪ ফাংশন অপরিবর্তিত ─────────────────────────
```

> **পরবর্তী ফেজের জন্য ইন্টিগ্রেশন নোট:** `SuggestionEngine.kt`-এর `UserWordModel` এখনো `kickkey_dictionary` থেকে পড়ে না। কাস্টম ডিকশনারি শব্দকে লাইভ সাজেশন র‍্যাঙ্কিংয়ে ওয়্যার করা একটি স্বাভাবিক পরবর্তী উন্নতি — এখন ফেজ ৫ শুধু নিশ্চিত করে শব্দগুলো পার্সিস্ট ও পুনরুদ্ধারযোগ্য। যদি আপনি কাস্টম শব্দকে অবিলম্বে সাজেশনে প্রভাব ফেলাতে চান, `UserWordModel.loadFromPrefs()`-এর ভেতরে `kickkey_dictionary` পড়ার একটি কল যোগ করুন এবং উচ্চ বুস্ট স্কোরে বিদ্যমান ফ্রিকোয়েন্সি ম্যাপের সাথে একত্রিত করুন।

---

## 17. আপডেটেড `modules/kickkey-module/index.ts`

```typescript
// modules/kickkey-module/index.ts
import { NativeModules } from 'react-native';
const { KickKey } = NativeModules;

export default {
  // ── ফেজ ১ ─────────────────────────────────────────────────────────────────
  isDefaultKeyboard:    (): Promise<boolean>            => KickKey.isDefaultKeyboard(),
  isKeyboardEnabled:    (): Promise<boolean>            => KickKey.isKeyboardEnabled(),
  openKeyboardSettings: (): void                        => KickKey.openKeyboardSettings(),

  // ── ফেজ ২ ─────────────────────────────────────────────────────────────────
  commitKey:       (code: string, language: string): Promise<void> => KickKey.commitKey(code, language),
  sendBackspace:   (): Promise<void>                               => KickKey.sendBackspace(),
  commitSpace:     (): Promise<void>                               => KickKey.commitSpace(),
  sendEnter:       (): Promise<void>                               => KickKey.sendEnter(),
  getPreferences:  (): Promise<Record<string, any>>               => KickKey.getPreferences(),
  savePreferences: (p: Record<string, any>): Promise<void>        => KickKey.savePreferences(p),

  // ── ফেজ ৩ ─────────────────────────────────────────────────────────────────
  flushBanglaBuffer: (): Promise<void>           => KickKey.flushBanglaBuffer(),
  setBanglaEnabled:  (e: boolean): Promise<void> => KickKey.setBanglaEnabled(e),

  // ── ফেজ ৪ ─────────────────────────────────────────────────────────────────
  commitSuggestion: (word: string): Promise<void> => KickKey.commitSuggestion(word),

  // ── ফেজ ৫ (নতুন) ──────────────────────────────────────────────────────────

  /** [words] দিয়ে সম্পূর্ণ কাস্টম ডিকশনারি প্রতিস্থাপন করে। */
  setDictionaryWords: (words: string[]): Promise<void> =>
    KickKey.setDictionaryWords(words),

  /** বর্তমান কাস্টম ডিকশনারি শব্দ তালিকা ফেরত দেয়। */
  getDictionaryWords: (): Promise<string[]> =>
    KickKey.getDictionaryWords(),

  /** কাস্টম ডিকশনারি থেকে একটি একক শব্দ সরায়। */
  removeDictionaryWord: (word: string): Promise<void> =>
    KickKey.removeDictionaryWord(word),
};
```

---

## 18. বিল্ড ও পরীক্ষা

### ১৮.১ Expo Router ডিপেন্ডেন্সি ইনস্টল করুন (যদি ইতিমধ্যে না থাকে)

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install @react-native-community/slider
```

### ১৮.২ এন্ট্রি পয়েন্ট Expo Router-এ পরিবর্তন করুন

`package.json` আপডেট করুন:

```json
{
  "main": "expo-router/entry"
}
```

পুরানো রুট `App.tsx` এবং পুরানো `index.js` মুছুন যা `registerRootComponent(App)` কল করে — Expo Router উভয়ই প্রতিস্থাপন করে।

```bash
rm App.tsx
```

> ⚠️ `keyboard.index.js` মুছবেন **না** — এটি কীবোর্ড বান্ডেলের এন্ট্রি পয়েন্ট থেকে যায় এবং কম্প্যানিয়ন অ্যাপের Expo Router এন্ট্রি থেকে সম্পূর্ণ পৃথক।

### ১৮.৩ `app.json` আপডেট করুন

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

### ১৮.৪ পুনরায় বিল্ড করুন

কম্প্যানিয়ন অ্যাপ বান্ডেল (`main.bundle`) পুনরায় বিল্ড করতে হবে কারণ এর এন্ট্রি পয়েন্ট পরিবর্তিত হয়েছে। এই ফেজে কীবোর্ড বান্ডেল অস্পৃষ্ট থাকে।

```bash
# expo-router প্লাগইন এবং আপডেটেড app.json প্রয়োগ করতে prebuild করুন
npx expo prebuild --platform android --clean

# বিল্ড ও ইনস্টল করুন
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### ১৮.৫ লগ মনিটর করুন

```bash
adb logcat -s ReactNativeJS KickKeyModule

# প্রথম লঞ্চে, অনবোর্ডিংয়ে রুট হওয়া প্রত্যাশিত:
# (রাউটিংয়ের জন্য কোনো লগ লাইন নেই, কিন্তু UI-তে Step 1 দেখানো উচিত)

# Android Settings-এ কীবোর্ড সক্রিয় করে অ্যাপে ফিরে আসার পরে:
# Step 1 ~২ সেকেন্ডের মধ্যে Step 2-এ স্বয়ংক্রিয়ভাবে এগিয়ে যাওয়া উচিত
```

---

## 19. যাচাই চেকলিস্ট

ফেজ ৬-এ যাওয়ার আগে প্রতিটি আইটেম সম্পন্ন করুন।

### নেভিগেশন ও অনবোর্ডিং

- [ ] নতুন ইনস্টল সরাসরি অনবোর্ডিং Step 1-এ খোলে (হোম স্ক্রিন নয়)
- [ ] Step 1 "Open Keyboard Settings" বাটন এবং ধাপের নির্দেশনা দেখায়
- [ ] Android Settings-এ KickKey সক্রিয় করে অ্যাপে ফিরে এলে ~২ সেকেন্ডের মধ্যে Step 2-এ স্বয়ংক্রিয়ভাবে এগিয়ে যায়
- [ ] Step 2 "Set Default Keyboard" বাটন দেখায়
- [ ] KickKey ডিফল্ট হিসেবে সেট করে অ্যাপে ফিরে এলে Step 3-এ স্বয়ংক্রিয়ভাবে এগিয়ে যায়
- [ ] Step 3 "Start Using KickKey" বাটন সহ সাফল্য স্ক্রিন দেখায়
- [ ] "Start Using KickKey" ট্যাপ করলে Home ট্যাবে নেভিগেট করে
- [ ] অনবোর্ডিংয়ের পরে অ্যাপ ফোর্স-কোয়িট করে পুনরায় খুললে সরাসরি ট্যাবে যায় (আবার অনবোর্ডিং নয়)
- [ ] Android Settings-এ ম্যানুয়ালি কীবোর্ড নিষ্ক্রিয় করে অ্যাপ পুনরায় খুললে অনবোর্ডিংয়ে ফিরে যায়

### হোম স্ক্রিন

- [ ] লাইভ "Keyboard Enabled" এবং "Set as Default" স্ট্যাটাস দেখায়
- [ ] বর্তমান সক্রিয় ভাষা দেখায়
- [ ] "Try it out" টেক্সট ফিল্ড শুধুমাত্র সম্পূর্ণ সেটআপ হলে দেখায়
- [ ] পরীক্ষা ফিল্ডে টাইপ করলে প্রকৃতপক্ষে KickKey কীবোর্ড ব্যবহৃত হয়

### সেটিংস স্ক্রিন

- [ ] Haptic Feedback টগল ভিজ্যুয়ালি স্টেট পরিবর্তন করে
- [ ] হ্যাপটিক বন্ধ করে যেকোনো অ্যাপে কীবোর্ড খুললে — কী প্রেসে কোনো ভাইব্রেশন হয় না
- [ ] হ্যাপটিক আবার চালু করলে — ভাইব্রেশন পুনরায় শুরু হয়
- [ ] Auto-correct টগল অ্যাপ রিস্টার্টের মধ্যে পার্সিস্ট হয় (AsyncStorage)
- [ ] Show Suggestions টগল বন্ধ করলে কীবোর্ডে সাজেশন বার কন্টেন্ট লুকায়

### থিম পিকার

- [ ] তিনটি থিম প্রিসেট (Dark, Light, AMOLED) আলাদা প্রিভিউ কার্ড রেন্ডার করে
- [ ] একটি প্রিসেট নির্বাচন করলে চেকমার্ক এবং হাইলাইটেড বর্ডার দেখায়
- [ ] নতুন থিম নির্বাচনের পরে যেকোনো অ্যাপে কীবোর্ড খুললে আপডেটেড রঙ দেখায়
- [ ] Key Height স্লাইডার টানলে মান পরিবর্তিত হয়
- [ ] Corner Radius স্লাইডার টানলে মান পরিবর্তিত হয়
- [ ] Font Size স্লাইডার টানলে মান পরিবর্তিত হয়
- [ ] স্লাইডার সমন্বয়ের পরে পরবর্তী খোলায় কীবোর্ড নতুন কী উচ্চতা/ব্যাসার্ধ/ফন্ট সাইজ প্রতিফলিত করে

### ভাষা নির্বাচক

- [ ] "English" নির্বাচন করলে English সারি হাইলাইট হয়
- [ ] "Bangla" নির্বাচন করলে Bangla সারি হাইলাইট হয়
- [ ] পরবর্তী খোলায় কীবোর্ডের ডিফল্ট ভাষা নির্বাচনের সাথে মেলে
- [ ] কীবোর্ডের ভেতরের গ্লোব-বাটন ভাষা সুইচ এখনও স্বাধীনভাবে কাজ করে

### ডিকশনারি এডিটর

- [ ] একটি শব্দ টাইপ করে "Add" ট্যাপ করলে নিচের তালিকায় যোগ হয়
- [ ] যোগ করা শব্দ অবিলম্বে `FlatList`-এ দেখা যায়
- [ ] ডুপ্লিকেট শব্দ দুবার যোগ হয় না
- [ ] একটি শব্দের পাশে "✕" ট্যাপ করলে তালিকা থেকে সরে যায়
- [ ] অ্যাপ বন্ধ করে পুনরায় খোলার পরে শব্দ থেকে যায়

### সেটিংস সিঙ্ক

- [ ] সেটিংস পরিবর্তনের পরে SharedPreferences-এ আপডেটেড মান দেখায়
- [ ] দ্রুত স্লাইডার টানলে দৃশ্যমান ল্যাগ হয় না (ডিবাউন্স কাজ করছে)
- [ ] সেটিংস সিঙ্ক চলাকালীন দ্রুত ট্যাব পরিবর্তনে কোনো ক্র্যাশ বা ANR নেই

---

## 20. সমস্যা সমাধান

### Expo Router-এ সুইচ করার পরে অ্যাপ খালি সাদা স্ক্রিনে খোলে

**কারণ:** `package.json`-এর `"main"` ফিল্ড `"expo-router/entry"`-এ আপডেট হয়নি, অথবা পুরানো `App.tsx` / `index.js` এখনো বিদ্যমান এবং দ্বন্দ্ব তৈরি করছে।

**সমাধান:**
```bash
cat package.json | grep '"main"'
# অবশ্যই দেখাতে হবে: "main": "expo-router/entry"

rm -f App.tsx index.js
npx expo prebuild --platform android --clean
```

---

### অনবোর্ডিং অসীমভাবে লুপ করে — কীবোর্ড সক্রিয় করার পরেও Step 1-এর পরে এগোয় না

**কারণ:** `useSetupStatus` পোলিং ইন্টারভাল চলছে, কিন্তু `isEnabled` মান আপডেট হচ্ছে না, সাধারণত `useKickKeyBridge` সঠিকভাবে বাইন্ড না হওয়ার কারণে।

**পরীক্ষা করুন:**
```bash
adb logcat -s ReactNativeJS | grep -i error
```
`useKickKeyBridge.ts`-এ অস্থায়ী `console.log(NativeModules.KickKey)` যোগ করে `NativeModules.KickKey` `undefined` নয় নিশ্চিত করুন।

---

### নতুন প্রিসেট নির্বাচনের পরেও কীবোর্ডে থিম পরিবর্তন দেখা যায় না

**কারণ:** `useSettingsSync` মাউন্ট হয়নি, অথবা ডিবাউন্স টাইমার ফায়ার হওয়ার আগেই ক্লিয়ার হচ্ছে।

**সমাধান:** নিশ্চিত করুন `useSettingsSync()` `app/_layout.tsx`-এ একবার কল করা হয়েছে, পৃথক স্ক্রিনের ভেতরে নয়।

**এছাড়াও নিশ্চিত করুন:** পরিবর্তনের পরে কীবোর্ড সম্পূর্ণরূপে বন্ধ করে পুনরায় খোলা হয়েছে। থিম পরিবর্তন পরবর্তী `onCreateInputView()`-এ প্রয়োগ হয়, কীবোর্ড দৃশ্যমান থাকাকালীন লাইভ নয়।

---

### অ্যাপ রিস্টার্টের পরে কাস্টম ডিকশনারি শব্দ অদৃশ্য হয়

**কারণ:** Zustand-এর `persist` মিডলওয়্যার কী দ্বন্দ্ব, অথবা `AsyncStorage` সঠিকভাবে লিংক হয়নি।

**সমাধান:**
```bash
npx expo install @react-native-async-storage/async-storage
npx expo prebuild --platform android --clean
```

---

### `@react-native-community/slider` বিল্ড ত্রুটি ঘটায়

**কারণ:** `expo prebuild`-এর পরে নেটিভ মডিউল লিংক হয়নি।

**সমাধান:**
```bash
npx expo install @react-native-community/slider
npx expo prebuild --platform android --clean
cd android && ./gradlew clean assembleDebug
```
যদি ডিপেন্ডেন্সি সমস্যা চলতে থাকে, স্লাইডার UI-কে তিনটি প্রিসেট-সাইজ বাটনে (Small/Medium/Large) প্রতিস্থাপন করুন।

---

### সেটিংস স্ক্রিন সঠিক মান দেখায় কিন্তু কীবোর্ড কখনো প্রতিফলিত করে না, একাধিকবার খোলার পরেও

**কারণ:** `KickKeyModule.savePreferences` এবং `getPreferences` ভুল করে বিভিন্ন `SharedPreferences` ফাইল নামে পড়তে/লিখতে পারে।

**উভয় পাশ পরীক্ষা করুন:**
```kotlin
// savePreferences এবং getPreferences উভয়ের মধ্যে অবশ্যই হুবহু মিলতে হবে:
context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
```

---

*ফেজ ৫ সম্পন্ন। স্টাব স্ক্রিন প্রতিস্থাপন করে ইমোজি পিকার প্যানেল এবং ক্লিপবোর্ড হিস্ট্রি প্যানেল তৈরি করতে ফেজ ৬ — ইমোজি ও ক্লিপবোর্ড — এ এগিয়ে যান।*
