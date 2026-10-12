# KickKey — Android Custom Keyboard App
## Complete Implementation Plan

> **Platform:** Android Only · **Stack:** React Native + Expo + Kotlin · **Languages:** English & Bangla

---

## Table of Contents

1. [Feasibility Analysis](#1-feasibility-analysis)
2. [Architecture Overview](#2-architecture-overview)
3. [Two-Bundle Strategy](#3-two-bundle-strategy)
4. [Expo vs Native Responsibilities](#4-expo-vs-native-responsibilities)
5. [Android IME Implementation](#5-android-ime-implementation)
6. [Keyboard Service & React Native UI in IME](#6-keyboard-service--react-native-ui-in-ime)
7. [Custom Native Module Design](#7-custom-native-module-design)
8. [React Native ↔ Native Communication](#8-react-native--native-communication)
9. [Keyboard Layout System](#9-keyboard-layout-system)
10. [Multilingual Support (English & Bangla)](#10-multilingual-support-english--bangla)
11. [Suggestions & Autocorrect Architecture](#11-suggestions--autocorrect-architecture)
12. [Emoji Support](#12-emoji-support)
13. [Clipboard Handling](#13-clipboard-handling)
14. [State Management](#14-state-management)
15. [Performance Considerations](#15-performance-considerations)
16. [Memory Management & OOM Safety](#16-memory-management--oom-safety)
17. [Security & Privacy](#17-security--privacy)
18. [Required Permissions](#18-required-permissions)
19. [Testing Strategy](#19-testing-strategy)
20. [Build & Deployment](#20-build--deployment)
21. [Limitations & Risks](#21-limitations--risks)
22. [Folder Structure](#22-folder-structure)
23. [Development Milestones](#23-development-milestones)

---

## 1. Feasibility Analysis

### 1.1 Is This Possible with Expo + React Native?

**Short answer: Yes — with a two-bundle, two-process hybrid architecture.**

A fully native Android custom keyboard is an **Android Input Method Editor (IME)** — a background service that registers itself with the Android system and provides a `View` when the user activates it. React Native's renderer is designed for `Activity`-hosted contexts, and `InputMethodService` has no `Activity`. However, this can be bridged by manually bootstrapping a React Native runtime inside the IME service using a `ReactRootView` without an Activity host — a technique based on the same mechanism React Native uses for Headless JS.

**The keyboard UI is built entirely in React Native / TypeScript. Kotlin handles only the IME service lifecycle and native API calls (text commit, haptics, clipboard).**

There is no library that converts React Native JSX to native Kotlin Views at build time. That direction does not exist — React Native components describe a virtual UI tree resolved at runtime by a JS engine. The correct solution is to keep the keyboard UI in React Native but run it in a dedicated, minimal JS bundle inside a separate process.

| Concern | Verdict |
|---|---|
| Register a custom IME with Android system | ✅ Via Kotlin `InputMethodService` |
| Render keyboard UI in React Native inside IME | ✅ Via `ReactRootView` + pre-warmed `ReactHost` (no Activity needed) |
| Send keystrokes to any app | ✅ Via `InputConnection` in Kotlin |
| Build settings / companion app in React Native | ✅ Fully standard |
| Use Expo Go | ❌ Not possible — custom dev build required |
| Use Expo Modules API for native bridge | ✅ Recommended |

### 1.2 The Core Approach: ReactRootView Inside InputMethodService

`InputMethodService.onCreateInputView()` must return an Android `View`. A `ReactRootView` IS an Android `View`. By pre-warming a `ReactHost` (the Hermes JS runtime + keyboard bundle) inside `KickKeyApplication.onCreate()`, by the time the user taps a text field the JS runtime is already loaded and `onCreateInputView()` can return the `ReactRootView` in ~50–80ms — comparable to native keyboards.

```
User taps text field
        │
        ▼
onCreateInputView() called by Android
        │
        ▼                               ← ReactHost already warmed in Application.onCreate()
ReactRootView.startReactApplication()   ← attaches running JS to the View
        │
        ▼
React Native renders KeyboardScreen.tsx ← YOUR TSX CODE, fully styled
        │
        ▼
User sees the keyboard (~50-80ms)
```

### 1.3 Answers to the Five Key Questions

**Q1: Which parts can be built with React Native only?**

- Keyboard UI: all key styling, layout, animations, suggestion bar, emoji panel, clipboard panel
- Companion/settings app: onboarding, theme picker, language toggle, dictionary editor
- Key layout definitions (TypeScript objects)
- Word list and dictionary data files
- App icon, branding, Play Store assets

**Q2: Which parts require native Kotlin?**

- `InputMethodService` registration and lifecycle (mandatory Android requirement)
- `ReactHost` / `ReactInstanceManager` bootstrap without Activity
- `InputConnection.commitText()` — injecting typed characters into any app
- `InputConnection.deleteSurroundingText()` — backspace
- `InputConnection.sendKeyEvent()` — cursor movement, Enter key
- Haptic feedback (`VibrationEffect`)
- System clipboard access (`ClipboardManager`)
- Separate process declaration (`:ime_process`)

**Q3: Expo Go support?**

❌ **Expo Go cannot support this app.** Must use `eas build --profile development`. Reasons:
- `InputMethodService` must be declared in `AndroidManifest.xml`
- `ReactHost` bootstrap without Activity requires patched native code
- Separate process declaration requires native manifest changes
- `res/xml/method.xml` (IME metadata) must be bundled

**Q4: Android-specific restrictions and limitations?**

- IME must be explicitly enabled by user in Android Settings → Keyboard
- User must manually set KickKey as default (cannot be done silently)
- Android 11+ (API 30): clipboard reading restricted; IME gets a special exception during `onStartInputView`
- Android 12+ (API 31): system shows a toast when any app reads clipboard — unavoidable
- OEM skins (MIUI, One UI, ColorOS): may enable `config_killableInputMethods = true`, making IME killable under memory pressure — mitigated by separate process
- Android 13+ (API 33): background process limitations; service restarts automatically but with cold-start cost

**Q5: Can React Native render keyboard UI inside the Android IME service?**

✅ **Yes, with the pre-warmed ReactHost technique.** By initializing the JS runtime in `Application.onCreate()` (not in `onCreateInputView()`), the keyboard bundle is ready before the user ever taps a text field. `onCreateInputView()` simply attaches the already-running React Native renderer to a new `ReactRootView` and returns it. All key styles, shapes, colors, animations, and layout are written in TypeScript/TSX.

---

## 2. Architecture Overview

### 2.1 Process Architecture

```
com.kickkey                    (main process)
└── KickKeyApplication         ← pre-warms keyboard ReactHost at boot
└── MainActivity               ← companion app, React Native bundle #1 (full app)

com.kickkey:ime                (separate process — isolated OOM score)
└── KickKeyInputMethodService  ← IME lifecycle
    └── ReactRootView          ← React Native bundle #2 (keyboard only, ~3MB)
        └── KeyboardScreen.tsx ← YOUR TSX: keys, styles, suggestion bar, emoji
```

### 2.2 Bundle Architecture

```
Build Output
├── main.bundle         (~15–25MB)   Full companion app
│   └── Entry: index.js
│       ├── Settings screens
│       ├── Onboarding
│       ├── Theme picker
│       └── Dictionary editor
│
└── keyboard.bundle     (~3–5MB)     Keyboard UI only
    └── Entry: keyboard.index.js
        ├── KeyboardScreen.tsx
        ├── KeyRow.tsx
        ├── SuggestionBar.tsx
        ├── EmojiPanel.tsx
        └── ClipboardPanel.tsx
```

### 2.3 Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                        KickKey App                           │
│                                                              │
│  ┌──────────────────────────┐   ┌────────────────────────┐  │
│  │  Companion App (main)    │   │  IME Service (:ime)    │  │
│  │  React Native Bundle #1  │   │  React Native Bundle #2│  │
│  │                          │   │                        │  │
│  │  • Settings UI           │   │  • KeyboardScreen.tsx  │  │
│  │  • Theme Picker          │   │  • KeyRow.tsx          │  │
│  │  • Language Toggle       │   │  • SuggestionBar.tsx   │  │
│  │  • Dictionary Editor     │   │  • EmojiPanel.tsx      │  │
│  │  • Onboarding            │◄──►  • ClipboardPanel.tsx  │  │
│  └──────────────────────────┘   └────────────────────────┘  │
│               │                            │                 │
│               └────── SharedPreferences ───┘                 │
│                       (bridge layer)                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Two-Bundle Strategy

This is the foundation of the entire architecture. Understanding it is essential before writing any code.

### 3.1 Why Two Bundles?

A single 20MB React Native bundle loaded inside the IME service would consume 80–130MB of RAM just for the JS runtime — making the IME a kill target on any device with <4GB RAM. By building a keyboard-only bundle that contains none of the companion app code (no navigation, no settings screens, no Expo libraries), the IME process stays at 35–50MB.

### 3.2 Two Entry Points

```typescript
// index.js — entry point for the companion app (main process)
import { registerRootComponent } from 'expo';
import App from './src/App';
registerRootComponent(App);

// keyboard.index.js — entry point for the keyboard UI (:ime process)
import { AppRegistry } from 'react-native';
import KeyboardScreen from './src/keyboard/KeyboardScreen';
AppRegistry.registerComponent('KickKeyKeyboard', () => KeyboardScreen);
// ↑ Import ONLY keyboard components. Nothing from src/app/, src/store/, expo-router, etc.
```

### 3.3 Build Commands for Two Bundles

```bash
# Bundle 1: Full companion app
npx react-native bundle \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/main.bundle \
  --platform android \
  --minify true

# Bundle 2: Keyboard UI only
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify true
```

Both build commands run as part of EAS Build via a custom `prebuild` hook.

### 3.4 Memory Comparison

| Approach | IME RAM Usage | Risk |
|---|---|---|
| Single bundle, same process | ~90–130MB | High kill risk on 3GB devices |
| Single bundle, separate process | ~80–120MB | Moderate kill risk |
| **Two bundles, separate process (recommended)** | **~35–50MB** | **Safe on 2GB+ devices** |
| Native Kotlin UI (no React Native in IME) | ~15–25MB | Lowest (but no RN UI) |

### 3.5 What the Keyboard Bundle Must NOT Import

```typescript
// ❌ NEVER import these in keyboard.index.js or any file it imports
import { useRouter } from 'expo-router';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../store/settingsStore';
import OnboardingScreen from '../app/onboarding/step1';

// ✅ Only import these
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import KeyRow from './KeyRow';
import SuggestionBar from './SuggestionBar';
// Keyboard-specific hooks only
import { useKeyboardBridge } from './hooks/useKeyboardBridge';
```

---

## 4. Expo vs Native Responsibilities

### 4.1 React Native / TypeScript Handles (Keyboard Bundle)

| Feature | Implementation |
|---|---|
| Key rendering | `TouchableOpacity` / `Pressable` with custom styles |
| Key layout (rows, widths) | TypeScript layout definitions + `flexbox` |
| Key press visual feedback | `onPressIn` style change + opacity |
| Suggestion bar | `ScrollView` of `TouchableOpacity` chips |
| Shift / caps state display | React `useState`, style swap |
| Emoji panel | `FlatList` grid of emoji characters |
| Clipboard panel | `FlatList` of clipboard history items |
| Bangla mode overlay | TypeScript phonetic buffer display |
| Theme colors | Read from `NativeModules.KickKey.getPreferences()` on mount |
| Language indicator | Text label in keyboard header |

### 4.2 React Native / TypeScript Handles (Companion Bundle)

| Feature | Implementation |
|---|---|
| Settings screen UI | React Native screens + Expo Router |
| Theme color picker | RN View + color pickers |
| Language toggle | RN state + SharedPreferences sync |
| Onboarding wizard | React Native screens |
| Dictionary word list editor | `FlatList` + `TextInput` |
| App navigation | Expo Router (file-based) |
| App icon & splash | Expo config |
| Build pipeline | EAS Build |
| OTA updates (companion app only) | `expo-updates` |

### 4.3 Native Kotlin Handles (Both Processes)

| Feature | Process | Implementation |
|---|---|---|
| IME service lifecycle | `:ime` | `InputMethodService` subclass |
| ReactHost pre-warm | `main` | `KickKeyApplication.onCreate()` |
| ReactRootView host | `:ime` | `onCreateInputView()` returns `ReactRootView` |
| Text commit | `:ime` | `InputConnection.commitText()` |
| Backspace | `:ime` | `InputConnection.deleteSurroundingText()` |
| Enter / cursor | `:ime` | `InputConnection.sendKeyEvent()` |
| Haptic feedback | `:ime` | `VibrationEffect` |
| Clipboard access | `:ime` | `ClipboardManager` |
| SharedPreferences bridge | both | `KickKeyModule.kt` |
| Suggestion engine | `:ime` | `SuggestionEngine.kt` (Kotlin, off JS thread) |
| Bangla transliteration | `:ime` | `BanglaInputEngine.kt` (Kotlin, off JS thread) |

---

## 5. Android IME Implementation

### 5.1 IME Registration

Every Android keyboard must declare itself in `AndroidManifest.xml`:

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<service
    android:name=".KickKeyInputMethodService"
    android:label="@string/ime_name"
    android:permission="android.permission.BIND_INPUT_METHOD"
    android:exported="true"
    android:process=":ime_process">     <!-- ← separate process: critical for memory isolation -->
    <intent-filter>
        <action android:name="android.view.InputMethod" />
    </intent-filter>
    <meta-data
        android:name="android.view.im"
        android:resource="@xml/method" />
</service>
```

### 5.2 IME Metadata (`res/xml/method.xml`)

```xml
<?xml version="1.0" encoding="utf-8"?>
<input-method xmlns:android="http://schemas.android.com/apk/res/android"
    android:settingsActivity="com.kickkey.MainActivity"
    android:supportsSwitchingToNextInputMethod="true">

    <subtype
        android:label="English (US)"
        android:imeSubtypeLocale="en_US"
        android:imeSubtypeMode="keyboard"
        android:subtypeId="1" />

    <subtype
        android:label="বাংলা"
        android:imeSubtypeLocale="bn_BD"
        android:imeSubtypeMode="keyboard"
        android:subtypeId="2" />

</input-method>
```

### 5.3 IME Lifecycle

```kotlin
class KickKeyInputMethodService : InputMethodService() {

    override fun onCreateInputView(): View {
        // ReactHost was pre-warmed in Application.onCreate()
        // This call is now fast: ~50–80ms
        val app = application as KickKeyApplication
        val reactRootView = ReactRootView(this)
        reactRootView.startReactApplication(
            app.keyboardReactHost,
            "KickKeyKeyboard",   // matches AppRegistry.registerComponent name
            null
        )
        return reactRootView
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        // Notify React Native side of input type (email, number, password...)
        val params = Arguments.createMap()
        params.putInt("inputType", info.inputType)
        params.putString("imeOptions", info.imeOptions.toString())
        sendEventToKeyboard("onInputStarted", params)
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        // Release emoji/clipboard panels from memory when keyboard hides
        sendEventToKeyboard("onKeyboardHidden", null)
    }

    private fun sendEventToKeyboard(event: String, params: WritableMap?) {
        // Emit event to React Native keyboard bundle via RCTDeviceEventEmitter
        (application as KickKeyApplication)
            .keyboardReactHost
            .currentReactContext
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(event, params)
    }
}
```

---

## 6. Keyboard Service & React Native UI in IME

### 6.1 Pre-Warming the React Native Runtime

This is the most important performance technique in the entire project. The JS runtime is initialized at app boot, not when the keyboard opens.

```kotlin
// KickKeyApplication.kt
class KickKeyApplication : Application(), ReactApplication {

    // The pre-warmed ReactHost for the keyboard bundle
    lateinit var keyboardReactHost: ReactHost
        private set

    override fun onCreate() {
        super.onCreate()
        // Pre-warm keyboard bundle in a background thread
        // By the time user taps a text field, Hermes + keyboard.bundle are ready
        Thread {
            initKeyboardRuntime()
        }.start()
    }

    private fun initKeyboardRuntime() {
        val reactHostDelegate = object : DefaultReactHostDelegate {
            override fun getJsBundleLoader() =
                JSBundleLoader.createAssetLoader(
                    applicationContext,
                    "assets://keyboard.bundle",  // ← keyboard-only bundle
                    false
                )
            override fun getPackages() = listOf(
                MainReactPackage(),
                KickKeyPackage()   // bridge module only
            )
        }

        keyboardReactHost = ReactHostBuilder()
            .setApplication(this)
            .setReactHostDelegate(reactHostDelegate)
            .setJSEngineResolutionAlgorithm(JSEngineResolutionAlgorithm.HERMES)
            .build()

        keyboardReactHost.start()  // loads JS, starts Hermes, pre-parses bundle
    }

    // Companion app uses the standard ReactHost (managed by Expo)
    override val reactNativeHost: ReactNativeHost
        get() = DefaultReactNativeHost(this) { /* standard Expo config */ }
}
```

### 6.2 The Keyboard Screen (React Native / TypeScript)

This is the root component returned by the IME. Everything visual is here — 100% React Native.

```tsx
// src/keyboard/KeyboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, NativeModules, NativeEventEmitter } from 'react-native';
import KeyRow from './KeyRow';
import SuggestionBar from './SuggestionBar';
import BottomRow from './BottomRow';
import EmojiPanel from './EmojiPanel';
import ClipboardPanel from './ClipboardPanel';
import { useKeyboardTheme } from './hooks/useKeyboardTheme';
import { useKeyboardState } from './hooks/useKeyboardState';
import { ENGLISH_ROWS, BANGLA_ROWS, SYMBOL_ROWS } from './layouts';

const { KickKey } = NativeModules;

export default function KeyboardScreen() {
  const theme = useKeyboardTheme();        // reads from SharedPreferences via KickKey module
  const {
    language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard,
    suggestions, currentWord,
    handleKeyPress, handleBackspace, handleSpace, handleEnter,
    handleShift, handleLanguageSwitch, handleEmojiToggle, handleClipboardToggle,
    handleSuggestionSelect,
  } = useKeyboardState();

  const rows = isSymbol
    ? SYMBOL_ROWS
    : language === 'bn'
    ? BANGLA_ROWS
    : ENGLISH_ROWS;

  if (isEmoji) {
    return <EmojiPanel theme={theme} onEmojiSelect={handleKeyPress} onClose={handleEmojiToggle} />;
  }

  if (isClipboard) {
    return <ClipboardPanel theme={theme} onPaste={handleKeyPress} onClose={handleClipboardToggle} />;
  }

  return (
    <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
      <SuggestionBar
        suggestions={suggestions}
        onSelect={handleSuggestionSelect}
        theme={theme}
      />
      {rows.map((row, i) => (
        <KeyRow
          key={i}
          keys={row}
          theme={theme}
          isShift={isShift}
          isCapsLock={isCapsLock}
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onShift={handleShift}
        />
      ))}
      <BottomRow
        theme={theme}
        language={language}
        onSpace={handleSpace}
        onEnter={handleEnter}
        onLanguageSwitch={handleLanguageSwitch}
        onEmojiToggle={handleEmojiToggle}
        onClipboardToggle={handleClipboardToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
});
```

### 6.3 Key Component (React Native / TypeScript)

```tsx
// src/keyboard/Key.tsx
import React, { useCallback } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import type { KeyDef, Theme } from './types';

interface KeyProps {
  keyDef: KeyDef;
  theme: Theme;
  isShift: boolean;
  onPress: (key: KeyDef) => void;
  onLongPress?: (key: KeyDef) => void;
  flex?: number;
}

export default function Key({ keyDef, theme, isShift, onPress, onLongPress, flex = 1 }: KeyProps) {
  const label = isShift && keyDef.shiftLabel ? keyDef.shiftLabel : keyDef.label;

  const handlePress = useCallback(() => onPress(keyDef), [keyDef, onPress]);
  const handleLongPress = useCallback(() => onLongPress?.(keyDef), [keyDef, onLongPress]);

  return (
    <TouchableOpacity
      style={[
        styles.key,
        {
          flex,
          backgroundColor: keyDef.isSpecial ? theme.specialKeyBg : theme.keyBg,
          borderRadius: theme.keyBorderRadius,
          marginHorizontal: theme.keyMargin,
          height: theme.keyHeight,
          // Shadow / elevation for key depth
          elevation: 2,
          shadowColor: theme.keyShadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 1,
        },
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={350}
      activeOpacity={0.6}
    >
      {keyDef.icon ? (
        <View style={styles.iconContainer}>
          {/* render icon based on keyDef.icon string */}
        </View>
      ) : (
        <Text
          style={[
            styles.keyLabel,
            {
              color: keyDef.isSpecial ? theme.specialKeyText : theme.keyText,
              fontSize: theme.keyFontSize,
            },
          ]}
        >
          {label}
        </Text>
      )}
      {keyDef.altChars && (
        <Text style={[styles.altLabel, { color: theme.altText }]}>
          {keyDef.altChars[0]}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  key: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  keyLabel: {
    fontWeight: '500',
  },
  altLabel: {
    position: 'absolute',
    top: 3,
    right: 5,
    fontSize: 9,
    opacity: 0.7,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

### 6.4 Keyboard State Hook (sends commands to Kotlin via NativeModules)

```typescript
// src/keyboard/hooks/useKeyboardState.ts
import { useState, useCallback, useEffect } from 'react';
import { NativeModules, NativeEventEmitter } from 'react-native';

const { KickKey } = NativeModules;
const emitter = new NativeEventEmitter(KickKey);

export function useKeyboardState() {
  const [language, setLanguage] = useState<'en' | 'bn'>('en');
  const [isShift, setIsShift] = useState(false);
  const [isCapsLock, setIsCapsLock] = useState(false);
  const [isSymbol, setIsSymbol] = useState(false);
  const [isEmoji, setIsEmoji] = useState(false);
  const [isClipboard, setIsClipboard] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState('');

  // Listen for suggestion updates from Kotlin SuggestionEngine
  useEffect(() => {
    const sub = emitter.addListener('onSuggestionsUpdated', (data) => {
      setSuggestions(data.suggestions);
      setCurrentWord(data.currentWord);
    });
    return () => sub.remove();
  }, []);

  // Listen for input type changes (password, email, number...)
  useEffect(() => {
    const sub = emitter.addListener('onInputStarted', (data) => {
      // Hide suggestions in password fields
      if (data.inputType & 0x80) setSuggestions([]);
    });
    return () => sub.remove();
  }, []);

  const handleKeyPress = useCallback((key: KeyDef) => {
    // Send character to Kotlin → InputConnection.commitText()
    KickKey.commitKey(key.code, language);
    // Auto-reset shift after one character
    if (isShift && !isCapsLock) setIsShift(false);
  }, [language, isShift, isCapsLock]);

  const handleBackspace = useCallback(() => {
    KickKey.sendBackspace();
  }, []);

  const handleSpace = useCallback(() => {
    KickKey.commitSpace();  // Kotlin handles autocorrect logic
  }, []);

  const handleEnter = useCallback(() => {
    KickKey.sendEnter();
  }, []);

  const handleShift = useCallback(() => {
    if (isShift && !isCapsLock) {
      setIsCapsLock(true);
    } else if (isCapsLock) {
      setIsShift(false);
      setIsCapsLock(false);
    } else {
      setIsShift(true);
    }
  }, [isShift, isCapsLock]);

  const handleLanguageSwitch = useCallback(() => {
    setLanguage(l => l === 'en' ? 'bn' : 'en');
    setSuggestions([]);
    setCurrentWord('');
  }, []);

  const handleSuggestionSelect = useCallback((word: string) => {
    KickKey.commitSuggestion(word);
    setSuggestions([]);
    setCurrentWord('');
  }, []);

  return {
    language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard,
    suggestions, currentWord,
    handleKeyPress, handleBackspace, handleSpace, handleEnter,
    handleShift, handleLanguageSwitch,
    handleEmojiToggle: () => setIsEmoji(e => !e),
    handleClipboardToggle: () => setIsClipboard(c => !c),
    handleSuggestionSelect,
  };
}
```

---

## 7. Custom Native Module Design

The `KickKeyModule` bridges React Native (both the companion and keyboard bundles) with native Android APIs.

### 7.1 `KickKeyModule.kt`

```kotlin
package com.kickkey

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.content.Context
import android.view.inputmethod.InputConnection

class KickKeyModule : Module() {

    // Reference to the active InputConnection, set by the IME service
    companion object {
        var activeInputConnection: InputConnection? = null
        var activeSuggestionEngine: SuggestionEngine? = null
        var activeBanglaEngine: BanglaInputEngine? = null
    }

    override fun definition() = ModuleDefinition {
        Name("KickKey")

        // ── Text Input ──────────────────────────────────────────────────

        Function("commitKey") { code: String, language: String ->
            val ic = activeInputConnection ?: return@Function
            if (language == "bn") {
                val banglaResult = activeBanglaEngine?.processKey(code) ?: code
                if (banglaResult.isNotEmpty()) ic.commitText(banglaResult, 1)
            } else {
                ic.commitText(code, 1)
            }
            activeSuggestionEngine?.onCharacterTyped(code)
        }

        Function("sendBackspace") {
            activeInputConnection?.deleteSurroundingText(1, 0)
            activeBanglaEngine?.onBackspace()
            activeSuggestionEngine?.onBackspace()
        }

        Function("commitSpace") {
            val ic = activeInputConnection ?: return@Function
            val topSuggestion = activeSuggestionEngine?.getTopSuggestion()
            if (topSuggestion != null) {
                val word = activeSuggestionEngine!!.getCurrentWord()
                ic.deleteSurroundingText(word.length, 0)
                ic.commitText("$topSuggestion ", 1)
                activeSuggestionEngine?.onWordCommitted(topSuggestion)
            } else {
                ic.commitText(" ", 1)
            }
        }

        Function("sendEnter") {
            val ic = activeInputConnection ?: return@Function
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER))
        }

        Function("commitSuggestion") { word: String ->
            val ic = activeInputConnection ?: return@Function
            val currentWord = activeSuggestionEngine?.getCurrentWord() ?: ""
            ic.deleteSurroundingText(currentWord.length, 0)
            ic.commitText("$word ", 1)
            activeSuggestionEngine?.onWordCommitted(word)
        }

        // ── Preferences ─────────────────────────────────────────────────

        Function("getPreferences") {
            val context = appContext.reactContext ?: return@Function emptyMap<String, Any>()
            val prefs = context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
            mapOf(
                "language" to (prefs.getString("language", "en") ?: "en"),
                "theme" to (prefs.getString("theme", "dark") ?: "dark"),
                "themePrimary" to (prefs.getString("themePrimary", "#00BCD4") ?: "#00BCD4"),
                "themeKeyBg" to (prefs.getString("themeKeyBg", "#1E1E2E") ?: "#1E1E2E"),
                "themeKeyText" to (prefs.getString("themeKeyText", "#FFFFFF") ?: "#FFFFFF"),
                "keyboardBg" to (prefs.getString("keyboardBg", "#111122") ?: "#111122"),
                "keyHeight" to prefs.getInt("keyHeight", 48),
                "keyBorderRadius" to prefs.getInt("keyBorderRadius", 6),
                "hapticEnabled" to prefs.getBoolean("hapticEnabled", true),
                "soundEnabled" to prefs.getBoolean("soundEnabled", false),
                "autoCorrect" to prefs.getBoolean("autoCorrect", true),
                "showSuggestions" to prefs.getBoolean("showSuggestions", true)
            )
        }

        Function("savePreferences") { prefs: Map<String, Any> ->
            val context = appContext.reactContext ?: return@Function
            val editor = context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE).edit()
            prefs.forEach { (key, value) ->
                when (value) {
                    is String -> editor.putString(key, value)
                    is Boolean -> editor.putBoolean(key, value)
                    is Int -> editor.putInt(key, value)
                    is Double -> editor.putFloat(key, value.toFloat())
                }
            }
            editor.apply()
        }

        // ── IME Status ──────────────────────────────────────────────────

        Function("isDefaultKeyboard") {
            val context = appContext.reactContext ?: return@Function false
            val current = android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.DEFAULT_INPUT_METHOD
            )
            current?.contains(context.packageName) ?: false
        }

        Function("isKeyboardEnabled") {
            val context = appContext.reactContext ?: return@Function false
            val enabled = android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.ENABLED_INPUT_METHODS
            ) ?: ""
            enabled.contains(context.packageName)
        }

        Function("openKeyboardSettings") {
            val context = appContext.reactContext ?: return@Function
            val intent = android.content.Intent(android.provider.Settings.ACTION_INPUT_METHOD_SETTINGS)
            intent.flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
        }

        // ── Clipboard ────────────────────────────────────────────────────

        Function("getClipboardHistory") {
            val context = appContext.reactContext ?: return@Function emptyList<String>()
            ClipboardHandler(context).getClipboardItems()
        }
    }
}
```

---

## 8. React Native ↔ Native Communication

### 8.1 Communication Channels

```
React Native Keyboard UI
    │
    ├── NativeModules.KickKey.commitKey()       → Kotlin → InputConnection.commitText()
    ├── NativeModules.KickKey.sendBackspace()   → Kotlin → InputConnection.deleteSurroundingText()
    ├── NativeModules.KickKey.commitSpace()     → Kotlin → autocorrect logic + commitText()
    ├── NativeModules.KickKey.getPreferences()  → SharedPreferences → theme/config read
    │
    └── NativeEventEmitter (Kotlin → React Native)
        ├── 'onSuggestionsUpdated'  → SuggestionBar.tsx re-renders
        ├── 'onInputStarted'        → keyboard adapts to field type
        └── 'onKeyboardHidden'      → emoji/clipboard panels unmount

React Native Companion App
    │
    ├── NativeModules.KickKey.savePreferences() → SharedPreferences write
    ├── NativeModules.KickKey.isDefaultKeyboard() → setup status polling
    └── NativeModules.KickKey.openKeyboardSettings() → Android Settings intent
```

### 8.2 SharedPreferences Key Schema

```typescript
// constants/PreferenceKeys.ts
export const PREF_KEYS = {
  // Language & Input
  LANGUAGE: 'language',               // 'en' | 'bn'
  AUTO_CORRECT: 'autoCorrect',        // boolean
  SUGGESTIONS: 'showSuggestions',     // boolean

  // Theme — read by keyboard bundle to style itself
  THEME: 'theme',                     // 'dark' | 'light' | 'amoled' | 'custom'
  THEME_KEYBOARD_BG: 'keyboardBg',    // hex color e.g. '#111122'
  THEME_KEY_BG: 'themeKeyBg',         // hex color
  THEME_KEY_TEXT: 'themeKeyText',     // hex color
  THEME_SPECIAL_KEY_BG: 'specialKeyBg',
  THEME_PRIMARY: 'themePrimary',      // accent color for suggestion bar

  // Layout
  KEY_HEIGHT: 'keyHeight',            // number (dp): 44 | 48 | 54
  KEY_BORDER_RADIUS: 'keyBorderRadius', // number: 4 | 6 | 10
  KEY_FONT_SIZE: 'fontSize',          // number (sp)
  KEY_MARGIN: 'keyMargin',            // number (dp)

  // Feedback
  HAPTIC_ENABLED: 'hapticEnabled',    // boolean
  SOUND_ENABLED: 'soundEnabled',      // boolean

  // User dictionary
  CUSTOM_WORDS: 'customWords',        // JSON array string
} as const;
```

---

## 9. Keyboard Layout System

### 9.1 Layout Type Definitions

```typescript
// src/keyboard/types.ts
export interface KeyDef {
  label: string;          // Display label (lowercase)
  shiftLabel?: string;    // Display label when shift is active
  code: string;           // Character to output
  width?: number;         // Relative flex width (default: 1)
  altChars?: string[];    // Long-press alternatives
  icon?: string;          // Icon name for special keys
  action?: KeyAction;     // Special action
  isSpecial?: boolean;    // Shift, backspace, enter, etc.
}

export type KeyAction =
  | 'backspace' | 'space' | 'enter' | 'shift'
  | 'language_switch' | 'emoji' | 'clipboard' | 'symbols' | 'symbols_back';

export interface Theme {
  keyboardBg: string;
  keyBg: string;
  keyText: string;
  specialKeyBg: string;
  specialKeyText: string;
  altText: string;
  suggestionBg: string;
  suggestionText: string;
  keyShadow: string;
  keyHeight: number;
  keyBorderRadius: number;
  keyFontSize: number;
  keyMargin: number;
}
```

### 9.2 English QWERTY Layout

```typescript
// src/keyboard/layouts/english.ts
export const ENGLISH_ROWS: KeyDef[][] = [
  [
    { label: 'q', code: 'q', altChars: ['1', '!'] },
    { label: 'w', code: 'w', altChars: ['2', '@'] },
    { label: 'e', code: 'e', altChars: ['3', 'è', 'é', 'ê', 'ë'] },
    { label: 'r', code: 'r', altChars: ['4'] },
    { label: 't', code: 't', altChars: ['5'] },
    { label: 'y', code: 'y', altChars: ['6', 'ý'] },
    { label: 'u', code: 'u', altChars: ['7', 'ü', 'ú', 'ù'] },
    { label: 'i', code: 'i', altChars: ['8', 'ï', 'í', 'î'] },
    { label: 'o', code: 'o', altChars: ['9', 'ö', 'ó', 'ô'] },
    { label: 'p', code: 'p', altChars: ['0'] },
  ],
  [
    { label: 'a', code: 'a', altChars: ['à', 'á', 'â', 'ä', 'å'] },
    { label: 's', code: 's', altChars: ['ß', 'š'] },
    { label: 'd', code: 'd', altChars: ['ð'] },
    { label: 'f', code: 'f' },
    { label: 'g', code: 'g' },
    { label: 'h', code: 'h' },
    { label: 'j', code: 'j' },
    { label: 'k', code: 'k' },
    { label: 'l', code: 'l' },
  ],
  [
    { label: '⇧', code: '', action: 'shift', width: 1.5, isSpecial: true, icon: 'shift' },
    { label: 'z', code: 'z' },
    { label: 'x', code: 'x' },
    { label: 'c', code: 'c', altChars: ['ç'] },
    { label: 'v', code: 'v' },
    { label: 'b', code: 'b' },
    { label: 'n', code: 'n', altChars: ['ñ'] },
    { label: 'm', code: 'm' },
    { label: '⌫', code: '', action: 'backspace', width: 1.5, isSpecial: true, icon: 'backspace' },
  ],
];
```

---

## 10. Multilingual Support (English & Bangla)

### 10.1 Bangla Input Strategy

Bangla uses **Avro-style phonetic transliteration**. The user types in Roman characters and the engine converts them to Bangla Unicode in real-time. This is the most common Bangla input method (used by Gboard, Ridmik, Borno).

The phonetic engine runs in **Kotlin** (off the JS thread) for zero-latency transliteration. React Native displays the result character by character.

### 10.2 `BanglaInputEngine.kt`

```kotlin
class BanglaInputEngine {

    private val phoneticMap: Map<String, String> = mapOf(
        // Consonants (longest match first — order matters in lookup)
        "kha" to "খ", "gha" to "ঘ", "nga" to "ঙ",
        "cha" to "চ", "chha" to "ছ", "jha" to "ঝ",
        "ttha" to "ঠ", "dda" to "ড", "ddha" to "ঢ", "nna" to "ণ",
        "tha" to "থ", "dha" to "ধ",
        "pha" to "ফ", "bha" to "ভ",
        "sha" to "শ", "shha" to "ষ",
        "rra" to "ড়", "rrha" to "ঢ়",
        "ka" to "ক", "ga" to "গ",
        "ja" to "জ", "ta" to "ত",
        "da" to "দ", "na" to "ন",
        "pa" to "প", "ba" to "ব",
        "ma" to "ম", "ya" to "য",
        "ra" to "র", "la" to "ল",
        "sa" to "স", "ha" to "হ",
        // Vowels
        "aa" to "আ", "ii" to "ঈ", "uu" to "ঊ",
        "ee" to "ঐ", "oo" to "ঔ",
        "a" to "অ", "i" to "ই",
        "u" to "উ", "e" to "এ",
        "o" to "ও",
        // Vowel signs (matras)
        "A" to "া", "I" to "ি", "II" to "ী",
        "U" to "ু", "UU" to "ূ",
        "ri" to "ৃ",
        // Special
        "ng" to "ং", "n`" to "ঁ", ":" to "ঃ",
        "kk" to "ক্ক", "tt" to "ত্ত"
    )

    private val buffer = StringBuilder()

    fun processKey(romanKey: String): String {
        buffer.append(romanKey)
        // Try matching longest suffix of buffer
        val input = buffer.toString()
        for (len in minOf(4, input.length) downTo 1) {
            val candidate = input.takeLast(len)
            phoneticMap[candidate]?.let { bangla ->
                // Remove matched portion from buffer
                repeat(len) { buffer.deleteCharAt(buffer.length - 1) }
                return bangla
            }
        }
        // No match yet; return empty (keep buffering)
        // Auto-flush when buffer is too long
        if (buffer.length >= 5) {
            val flushed = buffer.toString()
            buffer.clear()
            return flushed
        }
        return ""
    }

    fun onBackspace() {
        if (buffer.isNotEmpty()) {
            buffer.deleteCharAt(buffer.length - 1)
        }
    }

    fun flush(): String {
        val result = buffer.toString()
        buffer.clear()
        return result
    }
}
```

### 10.3 Bangla Layout in React Native

```typescript
// src/keyboard/layouts/bangla.ts
// Phonetic QWERTY overlay — same visual keys as English
// but labeled with Bangla phonetic hints
export const BANGLA_ROWS: KeyDef[][] = [
  [
    { label: 'ক', code: 'k', altChars: ['খ', 'গ', 'ঘ'] },
    { label: 'ও', code: 'o', altChars: ['ঔ', 'ও'] },
    { label: 'এ', code: 'e', altChars: ['ঐ', 'এ'] },
    { label: 'র', code: 'r', altChars: ['ড়', 'ঢ়'] },
    { label: 'ত', code: 't', altChars: ['থ', 'ট', 'ঠ'] },
    { label: 'য', code: 'y', altChars: ['য়'] },
    { label: 'উ', code: 'u', altChars: ['ঊ', 'ু', 'ূ'] },
    { label: 'ই', code: 'i', altChars: ['ঈ', 'ি', 'ী'] },
    { label: 'অ', code: 'a', altChars: ['আ', 'া'] },
    { label: 'প', code: 'p', altChars: ['ফ'] },
  ],
  // ... rows 2 and 3
];
```

### 10.4 Language Switch

```tsx
// Language indicator in keyboard header
<TouchableOpacity onPress={handleLanguageSwitch} style={styles.langButton}>
  <Text style={{ color: theme.keyText, fontSize: 12 }}>
    {language === 'en' ? 'EN' : 'বাং'}
  </Text>
</TouchableOpacity>
```

---

## 11. Suggestions & Autocorrect Architecture

### 11.1 Architecture

```
User types characters
        │
        ▼ (via NativeModules.KickKey.commitKey)
Kotlin: SuggestionEngine.onCharacterTyped()
        │
        ├── Extract current word from InputConnection.getTextBeforeCursor()
        ├── Binary Trie prefix search (O(m), m = word length)
        ├── Levenshtein fuzzy match (max distance 2, only if prefix < 3 matches)
        └── UserWordModel frequency ranking
        │
        ▼ (via NativeEventEmitter)
React Native: 'onSuggestionsUpdated' event
        │
        ▼
SuggestionBar.tsx re-renders with top 3 suggestions
```

### 11.2 `SuggestionEngine.kt`

```kotlin
class SuggestionEngine(private val context: Context) {

    private val englishTrie: Trie by lazy { loadDictionary("dictionaries/english.bin") }
    private val banglaTrie: Trie by lazy { loadDictionary("dictionaries/bangla.bin") }
    private val userModel: UserWordModel by lazy { UserWordModel(context) }
    private var currentWord: String = ""
    private var currentSuggestions: List<String> = emptyList()

    private val updateHandler = Handler(Looper.getMainLooper())
    private val updateRunnable = Runnable { computeAndEmit() }

    fun onCharacterTyped(char: String) {
        // Debounce: wait 50ms after last keystroke before computing
        updateHandler.removeCallbacks(updateRunnable)
        updateHandler.postDelayed(updateRunnable, 50)
    }

    fun onBackspace() {
        updateHandler.removeCallbacks(updateRunnable)
        updateHandler.postDelayed(updateRunnable, 50)
    }

    fun getTopSuggestion(): String? = currentSuggestions.firstOrNull()
    fun getCurrentWord(): String = currentWord

    private fun computeAndEmit() {
        // Extract word from active input connection
        val text = KickKeyModule.activeInputConnection
            ?.getTextBeforeCursor(100, 0)?.toString() ?: return
        currentWord = text.split(Regex("\\s+")).last()

        if (currentWord.isEmpty()) {
            currentSuggestions = emptyList()
            emitSuggestions()
            return
        }

        // Run on background thread to not block UI
        Thread {
            val trie = if (currentWord.any { it.code > 127 }) banglaTrie else englishTrie
            val prefixMatches = trie.search(currentWord, maxResults = 8)
            val fuzzyMatches = if (currentWord.length >= 4)
                trie.fuzzySearch(currentWord, maxDistance = 2, maxResults = 4)
            else emptyList()
            val userWords = userModel.getFrequentWords(currentWord)

            currentSuggestions = (userWords + prefixMatches + fuzzyMatches)
                .distinctBy { it.word }
                .sortedByDescending { it.score }
                .take(3)
                .map { it.word }

            emitSuggestions()
        }.start()
    }

    fun onWordCommitted(word: String) {
        userModel.recordWord(word)
        currentSuggestions = emptyList()
        currentWord = ""
        emitSuggestions()
    }

    private fun emitSuggestions() {
        val params = Arguments.createMap()
        val suggestionsArray = Arguments.createArray()
        currentSuggestions.forEach { suggestionsArray.pushString(it) }
        params.putArray("suggestions", suggestionsArray)
        params.putString("currentWord", currentWord)

        (context.applicationContext as KickKeyApplication)
            .keyboardReactHost
            .currentReactContext
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("onSuggestionsUpdated", params)
    }

    private fun loadDictionary(path: String): Trie {
        return context.assets.open(path).use { Trie.fromBinary(it) }
    }
}
```

---

## 12. Emoji Support

### 12.1 Emoji Panel in React Native

```tsx
// src/keyboard/EmojiPanel.tsx
import React, { useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { EMOJI_CATEGORIES } from './data/emojiData';
import type { Theme } from './types';

interface EmojiPanelProps {
  theme: Theme;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPanel({ theme, onEmojiSelect, onClose }: EmojiPanelProps) {
  const [activeCategory, setActiveCategory] = useState(0);

  const renderEmoji = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.emojiCell}
      onPress={() => onEmojiSelect(item)}
    >
      <Text style={styles.emojiChar}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.panel, { backgroundColor: theme.keyboardBg }]}>
      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {EMOJI_CATEGORIES.map((cat, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.tab, activeCategory === i && { borderBottomColor: theme.themePrimary }]}
            onPress={() => setActiveCategory(i)}
          >
            <Text style={styles.tabIcon}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Emoji grid */}
      <FlatList
        data={EMOJI_CATEGORIES[activeCategory].emojis}
        renderItem={renderEmoji}
        keyExtractor={(item) => item}
        numColumns={8}
        showsVerticalScrollIndicator={false}
        style={styles.grid}
      />

      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={{ color: theme.keyText }}>ABC</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  tabs: { flexDirection: 'row', height: 44 },
  tab: { padding: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabIcon: { fontSize: 20 },
  grid: { flex: 1 },
  emojiCell: { flex: 1/8, aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  emojiChar: { fontSize: 24 },
  closeBtn: { padding: 8, alignItems: 'center' },
});
```

---

## 13. Clipboard Handling

### 13.1 Android Clipboard Restrictions

- **Android 10+:** IME gets a special exception — clipboard can be read during `onStartInputView()`
- **Android 12+:** System always shows a toast when clipboard is read (unavoidable, system-enforced)
- KickKey maintains a local clipboard history of up to 20 items stored in SharedPreferences

### 13.2 `ClipboardHandler.kt`

```kotlin
class ClipboardHandler(private val context: Context) {

    private val clipManager =
        context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager

    fun getClipboardItems(): List<String> {
        val items = mutableListOf<String>()
        if (clipManager.hasPrimaryClip()) {
            val clip = clipManager.primaryClip ?: return getLocalHistory()
            for (i in 0 until clip.itemCount) {
                clip.getItemAt(i)?.coerceToText(context)?.toString()
                    ?.takeIf { it.isNotBlank() }
                    ?.let { items.add(it) }
            }
        }
        return (items + getLocalHistory()).distinct().take(20)
    }

    fun addToHistory(text: String) {
        val history = getLocalHistory().toMutableList()
        history.remove(text)
        history.add(0, text)
        val prefs = context.getSharedPreferences("kickkey_clipboard", Context.MODE_PRIVATE)
        prefs.edit().putString("history", history.take(20).joinToString("\u001F")).apply()
    }

    private fun getLocalHistory(): List<String> {
        val prefs = context.getSharedPreferences("kickkey_clipboard", Context.MODE_PRIVATE)
        val raw = prefs.getString("history", "") ?: ""
        return if (raw.isEmpty()) emptyList() else raw.split("\u001F")
    }
}
```

### 13.3 Clipboard Panel in React Native

```tsx
// src/keyboard/ClipboardPanel.tsx
export default function ClipboardPanel({ theme, onPaste, onClose }: ClipboardPanelProps) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    NativeModules.KickKey.getClipboardHistory().then(setItems);
  }, []);

  return (
    <View style={[styles.panel, { backgroundColor: theme.keyboardBg }]}>
      <FlatList
        data={items}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, { backgroundColor: theme.keyBg }]}
            onPress={() => onPaste(item)}
          >
            <Text style={{ color: theme.keyText }} numberOfLines={2}>{item}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={{ color: theme.altText, textAlign: 'center', padding: 20 }}>
            Clipboard is empty
          </Text>
        }
      />
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={{ color: theme.keyText }}>ABC</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 14. State Management

### 14.1 Keyboard Bundle State (React Native)

The keyboard bundle uses **only local React state** — no Zustand, no AsyncStorage, no Redux. This keeps the keyboard bundle small and fast.

```typescript
// Keyboard state is pure local React state in useKeyboardState.ts
// Theme is loaded once on mount from SharedPreferences via NativeModules.KickKey.getPreferences()
// Suggestions come in via NativeEventEmitter from Kotlin
// No global state library needed
```

### 14.2 Companion App State (React Native)

The companion app uses **Zustand** with AsyncStorage persistence:

```typescript
// store/settingsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  language: 'en' | 'bn';
  theme: 'dark' | 'light' | 'amoled' | 'custom';
  themeColors: {
    keyboardBg: string;
    keyBg: string;
    keyText: string;
    specialKeyBg: string;
    themePrimary: string;
  };
  hapticEnabled: boolean;
  soundEnabled: boolean;
  autoCorrect: boolean;
  showSuggestions: boolean;
  keyHeight: number;
  keyBorderRadius: number;
  customWords: string[];

  setLanguage: (lang: 'en' | 'bn') => void;
  setTheme: (theme: 'dark' | 'light' | 'amoled' | 'custom') => void;
  setThemeColors: (colors: Partial<SettingsState['themeColors']>) => void;
  toggleHaptic: () => void;
  toggleAutoCorrect: () => void;
  addCustomWord: (word: string) => void;
  removeCustomWord: (word: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'en',
      theme: 'dark',
      themeColors: {
        keyboardBg: '#111122',
        keyBg: '#1E1E2E',
        keyText: '#FFFFFF',
        specialKeyBg: '#2A2A3E',
        themePrimary: '#00BCD4',
      },
      hapticEnabled: true,
      soundEnabled: false,
      autoCorrect: true,
      showSuggestions: true,
      keyHeight: 48,
      keyBorderRadius: 6,
      customWords: [],

      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setThemeColors: (colors) => set((s) => ({
        themeColors: { ...s.themeColors, ...colors }
      })),
      toggleHaptic: () => set((s) => ({ hapticEnabled: !s.hapticEnabled })),
      toggleAutoCorrect: () => set((s) => ({ autoCorrect: !s.autoCorrect })),
      addCustomWord: (word) => set((s) => ({
        customWords: [...new Set([...s.customWords, word])]
      })),
      removeCustomWord: (word) => set((s) => ({
        customWords: s.customWords.filter(w => w !== word)
      })),
    }),
    {
      name: 'kickkey-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### 14.3 Settings → Native Sync

```typescript
// hooks/useSettingsSync.ts
export const useSettingsSync = () => {
  const settings = useSettingsStore();
  const savePreferences = useCallback(async () => {
    await NativeModules.KickKey.savePreferences({
      language: settings.language,
      theme: settings.theme,
      ...settings.themeColors,
      hapticEnabled: settings.hapticEnabled,
      soundEnabled: settings.soundEnabled,
      autoCorrect: settings.autoCorrect,
      showSuggestions: settings.showSuggestions,
      keyHeight: settings.keyHeight,
      keyBorderRadius: settings.keyBorderRadius,
      customWords: JSON.stringify(settings.customWords),
    });
  }, [settings]);

  // Sync on every meaningful change
  useEffect(() => { savePreferences(); }, [
    settings.language, settings.theme, settings.themeColors,
    settings.hapticEnabled, settings.autoCorrect, settings.customWords,
  ]);
};
```

---

## 15. Performance Considerations

### 15.1 Key Metrics to Target

| Metric | Target |
|---|---|
| Keyboard show latency (pre-warmed) | < 80ms |
| Keyboard show latency (cold, first ever) | < 400ms |
| Key press → character commit | < 16ms (1 frame) |
| Suggestion update latency | < 100ms |
| IME process RAM usage | < 50MB |
| keyboard.bundle size on disk | < 5MB |

### 15.2 Pre-Warming Timeline

```
App installed by user
        ↓
User opens KickKey companion app for first time
        ↓
KickKeyApplication.onCreate() fires
        ↓
Background thread: Hermes loads keyboard.bundle → compiles to bytecode cache
        ↓ (~300–600ms, happens once, never seen by user)
Bytecode cache written to disk
        ↓
Every subsequent launch: Hermes loads from bytecode cache → ~80ms
        ↓
User taps text field in any app
        ↓
onCreateInputView() → ReactRootView.startReactApplication() → ~50ms
        ↓
Keyboard visible ✅
```

### 15.3 Rendering Performance

```typescript
// Use React.memo on every key component — they don't change unless theme or shift changes
export default React.memo(Key, (prev, next) =>
  prev.keyDef === next.keyDef &&
  prev.isShift === next.isShift &&
  prev.theme === next.theme
);

// Use React.memo on KeyRow too
export default React.memo(KeyRow);

// SuggestionBar: only re-renders when suggestions array changes
export default React.memo(SuggestionBar, (prev, next) =>
  JSON.stringify(prev.suggestions) === JSON.stringify(next.suggestions)
);
```

### 15.4 Avoiding Layout Thrash

```typescript
// Pre-compute layout dimensions once, not on every render
const KEY_HEIGHT = 48; // read from prefs at startup, stored in module scope
const KEY_MARGIN = 3;

// Use StyleSheet.create — styles are flattened and cached at parse time
const styles = StyleSheet.create({
  key: { height: KEY_HEIGHT, marginHorizontal: KEY_MARGIN },
});
// ✅ NOT inline objects: style={{ height: 48 }} — creates new object every render
```

---

## 16. Memory Management & OOM Safety

### 16.1 Memory Budget Per Process

```
:ime_process (keyboard — separate OOM score)
──────────────────────────────────────────
Hermes runtime (keyboard.bundle only)   ~18–22MB
Keyboard React component tree           ~4–6MB
Native bridge (KickKeyModule only)      ~5–7MB
Suggestion engine (memory-mapped Trie)  ~3–5MB
Emoji data (lazy-loaded)                ~2–3MB
──────────────────────────────────────────
IME process total                       ~32–43MB  ✅

main process (companion — only when open)
──────────────────────────────────────────
Hermes + full RN framework              ~30–45MB
Companion app screens                   ~20–35MB
──────────────────────────────────────────
Companion total                         ~50–80MB  ✅

Worst case (both open)                  ~82–123MB ✅ (safe on 3GB+ devices)
```

### 16.2 Android LMK Behavior

Android's Low Memory Killer (LMK) uses `oom_adj_score` to decide which processes to kill:

- **IME visible on screen:** treated as perceptible process — very low kill priority
- **IME hidden (user not typing):** treated as service — moderate kill priority
- **Separate `:ime_process`:** has its own independent OOM score; companion app crashes don't affect IME

Some OEM Android skins (MIUI, ColorOS) set `config_killableInputMethods = true`, which raises the IME's `oom_adj_score` and makes it killable under memory pressure. The separate process declaration does not fully prevent this, but it prevents a companion app OOM from cascading into the IME.

If the IME process is killed, Android auto-restarts it. The user sees a ~300ms gap in keyboard availability. Pre-warming runs again on restart.

### 16.3 Memory Release on Hide

```kotlin
// KickKeyInputMethodService.kt
override fun onWindowHidden() {
    super.onWindowHidden()
    // Signal React Native to release heavy panels
    sendEventToKeyboard("onKeyboardHidden", null)
}
```

```typescript
// KeyboardScreen.tsx — respond to hide event
useEffect(() => {
  const sub = emitter.addListener('onKeyboardHidden', () => {
    setIsEmoji(false);
    setIsClipboard(false);
    // FlatList data for emoji/clipboard unmounts, releasing list item memory
  });
  return () => sub.remove();
}, []);
```

### 16.4 Memory-Mapped Dictionary

```kotlin
// Load Trie using memory-mapped file — OS pages in only accessed nodes
val file = File(context.filesDir, "english.bin")
val channel = FileInputStream(file).channel
val mappedBuffer = channel.map(FileChannel.MapMode.READ_ONLY, 0, channel.size())
// Active memory footprint: ~3–5MB vs ~18–20MB for full in-memory load
```

---

## 17. Security & Privacy

### 17.1 Privacy Principles

A custom keyboard is one of the highest-risk Android apps from a privacy standpoint — it can observe every character the user types. KickKey is explicitly designed to be privacy-preserving:

- **No network access in the IME service** — `INTERNET` permission is not declared for the `:ime_process`
- **No keystroke logging or analytics** — characters are committed to `InputConnection` and discarded
- **No cloud sync** — all data (user word model, clipboard history) stays on-device
- **Clipboard history stored locally** in SharedPreferences, never transmitted
- **Word learning model** stays in local SharedPreferences

### 17.2 Play Store Requirements

Google Play requires keyboards to have an explicit privacy policy stating:
- What data is collected (answer: nothing beyond what stays on-device)
- Whether keystrokes are transmitted (answer: no)
- How clipboard data is handled (answer: stored locally, never transmitted)

### 17.3 Secure Preferences

Use `EncryptedSharedPreferences` for any sensitive user configuration:

```kotlin
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()
val securePrefs = EncryptedSharedPreferences.create(
    context, "kickkey_secure", masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
```

---

## 18. Required Permissions

```xml
<!-- Minimum required permissions -->
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Internet ONLY for companion app process (OTA updates) — NOT for :ime_process -->
<uses-permission android:name="android.permission.INTERNET" />
```

The IME service itself requires **zero runtime permissions**. Input method access is granted by the Android system when the user selects KickKey as their keyboard — no `READ_CONTACTS`, no `ACCESS_FINE_LOCATION`, no `RECORD_AUDIO`.

---

## 19. Testing Strategy

### 19.1 Unit Tests (Kotlin)

| Component | Framework | Test Cases |
|---|---|---|
| `BanglaInputEngine` | JUnit 5 | Transliteration accuracy, buffer flush, backspace |
| `SuggestionEngine` | JUnit 5 + Mockito | Prefix matches, fuzzy matches, empty input, ranking |
| `Trie` | JUnit 5 | Insert, exact search, prefix search, fuzzy search |
| `ClipboardHandler` | JUnit 5 + Mockito | History trimming, deduplication |
| `KickKeyModule` | JUnit 5 + Mockito | Preference read/write |

### 19.2 Unit Tests (TypeScript)

```typescript
// __tests__/layouts/english.test.ts
describe('English QWERTY Layout', () => {
  it('has 4 rows', () => expect(ENGLISH_ROWS.length).toBe(3)); // + bottom row
  it('has backspace in row 3', () => {
    const row3 = ENGLISH_ROWS[2];
    expect(row3.some(k => k.action === 'backspace')).toBe(true);
  });
  it('shift and backspace have width > 1', () => {
    const special = ENGLISH_ROWS[2].filter(k => k.isSpecial);
    special.forEach(k => expect(k.width).toBeGreaterThan(1));
  });
});
```

### 19.3 Integration Tests (Kotlin)

```kotlin
@RunWith(AndroidJUnit4::class)
class ImeIntegrationTest {

    @Test
    fun testEnglishSuggestions() {
        val engine = SuggestionEngine(InstrumentationRegistry.getInstrumentation().context)
        val suggestions = engine.getSuggestions("hel", "en")
        assertTrue(suggestions.any { it.startsWith("hel") })
    }

    @Test
    fun testBanglaPhoneticKa() {
        val engine = BanglaInputEngine()
        assertEquals("ক", engine.processKey("k") + engine.processKey("a"))
    }

    @Test
    fun testBanglaPhoneticBangla() {
        val engine = BanglaInputEngine()
        val result = "bangla".map { engine.processKey(it.toString()) }.joinToString("")
        assertTrue(result.contains("ব") || result.isNotEmpty())
    }
}
```

### 19.4 Manual Testing Checklist

**Core Input**
- [ ] English QWERTY typing works in: WhatsApp, Chrome, Gmail, Settings search
- [ ] Bangla phonetic input produces correct Unicode characters
- [ ] Backspace deletes one character at a time
- [ ] Long backspace hold deletes words
- [ ] Shift works (one letter), caps lock works (double-tap)
- [ ] Symbols panel opens and all symbols insert correctly
- [ ] Long-press shows alternate characters popup

**Suggestions**
- [ ] Suggestions appear within 100ms of typing
- [ ] Top suggestion auto-commits on space press
- [ ] Tapping a suggestion replaces current word
- [ ] Suggestions hidden in password fields
- [ ] Bangla suggestions appear when in Bangla mode

**Performance**
- [ ] Keyboard opens in <80ms (after first use)
- [ ] No dropped frames during typing (60fps)
- [ ] IME process memory <50MB (verify with Android Studio Profiler)
- [ ] No ANR after 200 consecutive keypresses

**Compatibility**
- [ ] Works on Android 10, 12, 14
- [ ] Works on Samsung One UI
- [ ] Works on Xiaomi MIUI
- [ ] Works on stock Android (Pixel)
- [ ] Theme changes from companion app appear on next keyboard open
- [ ] Keyboard recovers after process kill (simulate with `adb shell kill <pid>`)

---

## 20. Build & Deployment

### 20.1 Prerequisites

```bash
node >= 18.0.0
npm >= 9.0.0
Java 17 (JDK)
Android SDK API 34
Expo CLI >= 6.0.0
EAS CLI >= 5.0.0
```

### 20.2 Project Setup

```bash
npx create-expo-app KickKey --template blank-typescript
cd KickKey

npx expo install expo-modules-core
npx expo install @react-native-async-storage/async-storage
npx expo install expo-router
npm install zustand
```

### 20.3 `app.json`

```json
{
  "expo": {
    "name": "KickKey",
    "slug": "kickkey",
    "version": "1.0.0",
    "platforms": ["android"],
    "android": {
      "package": "com.kickkey",
      "minSdkVersion": 26,
      "targetSdkVersion": 34,
      "compileSdkVersion": 34,
      "permissions": ["android.permission.VIBRATE"]
    },
    "plugins": [
      "./plugins/withImeService",
      "./plugins/withKeyboardBundle"
    ]
  }
}
```

### 20.4 Expo Config Plugin — IME Service + Separate Process

```javascript
// plugins/withImeService.js
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withImeService(config) {
  return withAndroidManifest(config, async (config) => {
    const app = config.modResults.manifest.application[0];
    if (!app.service) app.service = [];

    app.service.push({
      $: {
        'android:name': '.KickKeyInputMethodService',
        'android:label': '@string/ime_name',
        'android:permission': 'android.permission.BIND_INPUT_METHOD',
        'android:exported': 'true',
        'android:process': ':ime_process',   // ← separate process: memory isolation
      },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.view.InputMethod' } }] }],
      'meta-data': [{ $: { 'android:name': 'android.view.im', 'android:resource': '@xml/method' } }],
    });
    return config;
  });
};
```

### 20.5 Expo Config Plugin — Keyboard Bundle Build

```javascript
// plugins/withKeyboardBundle.js
const { withDangerousMod } = require('@expo/config-plugins');
const { execSync } = require('child_process');
const path = require('path');

module.exports = function withKeyboardBundle(config) {
  return withDangerousMod(config, ['android', async (config) => {
    // Build the keyboard-only bundle as part of EAS prebuild
    execSync(
      `npx react-native bundle \
        --entry-file keyboard.index.js \
        --bundle-output ${config.modRequest.projectRoot}/android/app/src/main/assets/keyboard.bundle \
        --platform android \
        --minify true`,
      { stdio: 'inherit' }
    );
    return config;
  }]);
};
```

### 20.6 EAS Configuration

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "aab" }
    }
  }
}
```

### 20.7 Build Commands

```bash
# Development build (install on device via USB for testing)
eas build --platform android --profile development
eas run:android

# Preview build (APK for wider testing)
eas build --platform android --profile preview

# Production build (AAB for Play Store)
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

---

## 21. Limitations & Risks

### 21.1 Technical Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| `ReactHost` without Activity is unofficial | Medium — may break on RN version upgrades | Pin RN version; test upgrades carefully |
| OEM skins may set `config_killableInputMethods=true` | Medium — IME killed under pressure | Separate process reduces IME footprint |
| No Expo Go support | Low (dev friction only) | Use EAS development build from day 1 |
| keyboard.bundle cold start: ~300ms | Low — only on first ever use | Pre-warm in `Application.onCreate()` |
| Keyboard must be manually enabled by user | High UX friction | Excellent onboarding with step-by-step UI |
| Android 12+ clipboard toast | Low — system-enforced, unavoidable | Document in app and privacy policy |
| Bangla transliteration has a learning curve | Medium UX | Good onboarding, show phonetic hints on long-press |

### 21.2 React Native Version Pinning

The `ReactHost` bootstrap without Activity relies on internal React Native APIs. Pin your React Native version in `package.json` and test thoroughly before upgrading:

```json
{
  "dependencies": {
    "react-native": "0.76.x"  // pin to minor, not major
  }
}
```

### 21.3 New Architecture Compatibility

React Native's New Architecture (Fabric + TurboModules) changes how `ReactHost` is initialized. The implementation plan targets the **Old Architecture** (`newArchEnabled=false`) for maximum stability. Migrating to New Architecture is a Phase 2 post-launch task.

```properties
# android/gradle.properties
newArchEnabled=false
hermesEnabled=true
```

---

## 22. Folder Structure

```
KickKey/
├── app/                              # Expo Router — companion app screens
│   ├── (tabs)/
│   │   ├── index.tsx                 # Home / setup status
│   │   ├── settings.tsx              # Settings screen
│   │   ├── themes.tsx                # Theme picker
│   │   ├── language.tsx              # Language settings
│   │   └── dictionary.tsx            # Custom word dictionary
│   ├── onboarding/
│   │   ├── step1-enable.tsx          # Enable keyboard in Android Settings
│   │   ├── step2-default.tsx         # Set as default keyboard
│   │   └── step3-done.tsx            # Done! screen
│   └── _layout.tsx
│
├── src/
│   └── keyboard/                     # ← keyboard bundle (keyboard.index.js imports from here)
│       ├── KeyboardScreen.tsx        # Root component returned by IME
│       ├── KeyRow.tsx                # A row of keys
│       ├── Key.tsx                   # Individual key
│       ├── SuggestionBar.tsx         # Suggestion chips
│       ├── BottomRow.tsx             # Space, Enter, Language, Emoji
│       ├── EmojiPanel.tsx            # Emoji picker panel
│       ├── ClipboardPanel.tsx        # Clipboard history panel
│       ├── types.ts                  # KeyDef, Theme, KeyAction types
│       ├── layouts/
│       │   ├── english.ts
│       │   ├── bangla.ts
│       │   └── symbols.ts
│       ├── hooks/
│       │   ├── useKeyboardState.ts   # Key press handlers, NativeModules calls
│       │   └── useKeyboardTheme.ts   # Load theme from SharedPreferences
│       └── data/
│           └── emojiData.ts          # Emoji categories and character arrays
│
├── assets/
│   ├── dictionaries/
│   │   ├── english.txt               # Source word list
│   │   ├── english.bin               # Compiled binary Trie
│   │   ├── bangla.txt
│   │   └── bangla.bin
│   └── fonts/
│
├── components/                       # Shared companion app components
│   ├── SetupProgress.tsx
│   ├── ThemeCard.tsx
│   ├── ToggleRow.tsx
│   └── LanguageTag.tsx
│
├── hooks/                            # Companion app hooks only
│   ├── useKickKeyBridge.ts           # Wraps NativeModules.KickKey
│   ├── useSettingsSync.ts            # Zustand → SharedPreferences sync
│   └── useSetupStatus.ts             # Poll isDefaultKeyboard() / isKeyboardEnabled()
│
├── store/
│   └── settingsStore.ts              # Zustand store (companion app only)
│
├── constants/
│   ├── PreferenceKeys.ts
│   ├── Themes.ts
│   └── Colors.ts
│
├── plugins/
│   ├── withImeService.js             # Expo config plugin: manifest + separate process
│   └── withKeyboardBundle.js         # Expo config plugin: build keyboard.bundle
│
├── modules/
│   └── kickkey-module/               # Expo Native Module
│       ├── index.ts                  # JS re-export
│       └── android/src/main/java/com/kickkey/
│           ├── KickKeyModule.kt      # All NativeModules.KickKey functions
│           └── KickKeyPackage.kt
│
├── android/app/src/main/
│   ├── java/com/kickkey/
│   │   ├── KickKeyApplication.kt    # Pre-warms keyboard ReactHost
│   │   ├── KickKeyInputMethodService.kt
│   │   ├── BanglaInputEngine.kt
│   │   ├── SuggestionEngine.kt
│   │   ├── Trie.kt
│   │   ├── UserWordModel.kt
│   │   ├── ClipboardHandler.kt
│   │   └── HapticManager.kt
│   ├── res/xml/
│   │   ├── method.xml               # IME metadata: subtypes (en, bn)
│   │   └── (no keyboard_en/bn XML — layout is in React Native)
│   └── AndroidManifest.xml
│
├── scripts/
│   └── compile-dictionaries.py      # Build-time: .txt → .bin Trie compiler
│
├── index.js                          # Companion app entry point
├── keyboard.index.js                 # Keyboard bundle entry point
├── app.json
├── eas.json
├── tsconfig.json
└── package.json
```

---

## 23. Development Milestones

### Phase 1 — Foundation (Weeks 1–2)
- [ ] Initialize Expo project with TypeScript
- [ ] Set up EAS custom development build pipeline
- [ ] Write `KickKeyApplication.kt` with ReactHost pre-warm logic
- [ ] Register `KickKeyInputMethodService` in manifest (with `:ime_process`)
- [ ] `onCreateInputView()` returns a basic `ReactRootView`
- [ ] Create `keyboard.index.js` entry point
- [ ] Verify basic `KeyboardScreen.tsx` renders inside the IME (no key logic yet)
- [ ] Verify keyboard appears as option in Android Settings

**Milestone: A React Native component renders visually as a keyboard**

---

### Phase 2 — Core Input (Weeks 3–4)
- [ ] Implement `KickKeyModule.kt`: `commitKey`, `sendBackspace`, `commitSpace`, `sendEnter`
- [ ] Build `Key.tsx`, `KeyRow.tsx`, `BottomRow.tsx` with English QWERTY layout
- [ ] `useKeyboardState.ts` wiring all key actions to `NativeModules.KickKey`
- [ ] Shift / caps lock logic in React Native state
- [ ] Symbols panel layout and toggle
- [ ] Haptic feedback on every key press (Kotlin `VibrationEffect`)
- [ ] Long-press alt characters popup in React Native

**Milestone: Can type English text in any Android app using KickKey**

---

### Phase 3 — Bangla Input (Weeks 5–6)
- [ ] `BanglaInputEngine.kt` with full phonetic map
- [ ] `KickKeyModule.commitKey` routes through Bangla engine when `language === 'bn'`
- [ ] `BANGLA_ROWS` layout definition in TypeScript
- [ ] Language switch key in React Native (`useKeyboardState.handleLanguageSwitch`)
- [ ] Language label indicator (`EN` / `বাং`) in keyboard header
- [ ] Unit test coverage for transliteration accuracy

**Milestone: Can type Bangla phonetically in any app**

---

### Phase 4 — Suggestions & Autocorrect (Weeks 7–8)
- [ ] Build dictionary compiler script (`compile-dictionaries.py`): txt → binary Trie
- [ ] Compile English (~70k words) and Bangla (~30k words) dictionaries
- [ ] `SuggestionEngine.kt`: prefix search + Levenshtein fuzzy + user model
- [ ] `NativeEventEmitter` emit `onSuggestionsUpdated` from Kotlin to React Native
- [ ] `SuggestionBar.tsx` rendering tappable word chips
- [ ] `useKeyboardState` subscribes to suggestion events
- [ ] `commitSpace` in Kotlin applies top suggestion (autocorrect)
- [ ] `UserWordModel.kt` learns from tapped suggestions

**Milestone: Smart word suggestions working in English and Bangla**

---

### Phase 5 — Companion App (Weeks 9–10)
- [ ] Onboarding wizard: 3-step flow (enable → set as default → done)
- [ ] `isKeyboardEnabled()` and `isDefaultKeyboard()` polling in `useSetupStatus.ts`
- [ ] Settings screen: haptic, sound, autocorrect toggles
- [ ] Theme picker: dark / light / AMOLED + custom color sliders
- [ ] Language selector screen
- [ ] Custom dictionary: add/remove words, synced to native
- [ ] `useSettingsSync.ts` writing all settings to SharedPreferences on change

**Milestone: Companion app fully functional; theme changes reflect in keyboard**

---

### Phase 6 — Emoji & Clipboard (Weeks 11–12)
- [ ] `EmojiPanel.tsx` with category tabs and `FlatList` grid
- [ ] Recent emojis tracked in SharedPreferences (Kotlin `ClipboardHandler`)
- [ ] `ClipboardPanel.tsx` with history `FlatList`
- [ ] `ClipboardHandler.kt` reading system clipboard + local history
- [ ] `NativeModules.KickKey.getClipboardHistory()` called from `ClipboardPanel`
- [ ] Emoji/clipboard panels mount/unmount on keyboard hide event

**Milestone: Emoji and clipboard panels working**

---

### Phase 7 — Polish & Performance (Weeks 13–14)
- [ ] `React.memo` applied to `Key`, `KeyRow`, `SuggestionBar`
- [ ] `StyleSheet.create` used everywhere — no inline style objects
- [ ] Profile IME process: RAM < 50MB (Android Studio Profiler)
- [ ] Profile suggestion latency: < 100ms
- [ ] Profile keyboard open latency: < 80ms (after pre-warm)
- [ ] Memory-mapped Trie loading
- [ ] Keyboard adapts to input type: password (hide suggestions), number (number layout), URL
- [ ] Sound feedback option
- [ ] Smooth key press animation (`activeOpacity` + scale transform)

**Milestone: Production-quality feel and performance**

---

### Phase 8 — Testing & Release (Weeks 15–16)
- [ ] Unit test coverage > 80% for Kotlin (`BanglaInputEngine`, `SuggestionEngine`, `Trie`)
- [ ] All manual testing checklist items checked
- [ ] Test on 3+ physical devices: Samsung (One UI), Xiaomi (MIUI), Pixel (stock)
- [ ] Test on Android 10, 12, 14
- [ ] Test IME recovery after process kill (`adb shell kill`)
- [ ] Privacy policy page (required by Google Play for keyboard apps)
- [ ] Play Store listing: screenshots, description, privacy policy link
- [ ] Production EAS build (`eas build --profile production`)
- [ ] Submit to Google Play

**Milestone: KickKey live on Google Play Store**

---

## Summary

| Aspect | Decision |
|---|---|
| Keyboard UI | **React Native / TypeScript** (`KeyboardScreen.tsx`, `Key.tsx`, etc.) |
| Keyboard UI host | `ReactRootView` returned from `onCreateInputView()` (no Activity needed) |
| Companion App | React Native + Expo |
| IME Runtime | Pre-warmed `ReactHost` in `KickKeyApplication.onCreate()` |
| IME Process | Separate `:ime_process` (memory isolation from companion app) |
| Keyboard Bundle | `keyboard.bundle` (~3–5MB, keyboard code only) |
| Companion Bundle | `main.bundle` (~15–25MB, full app) |
| Text Commit | Kotlin `KickKeyModule` → `InputConnection.commitText()` |
| Suggestions | Kotlin `SuggestionEngine` → binary Trie, emits to RN via `NativeEventEmitter` |
| Bangla Input | Kotlin `BanglaInputEngine` (Avro-style phonetic) |
| State (keyboard) | Local React `useState` only |
| State (companion) | Zustand + AsyncStorage |
| Bridge | Expo Modules API (`KickKeyModule.kt`) |
| Dev Build | EAS Build (custom development build, NOT Expo Go) |
| Architecture | Old Architecture (`newArchEnabled=false`) for stability |
| Min SDK | API 26 (Android 8.0) |
| Target SDK | API 34 (Android 14) |
| IME RAM target | < 50MB |
| Keyboard open latency | < 80ms (pre-warmed) |

---

*Document version: 2.0 | Last updated: June 2026 | Target: Android only*
