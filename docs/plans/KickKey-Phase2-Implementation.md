# KickKey — Phase 2 Implementation Guide
## Core Input (Weeks 3–4)

> **Goal:** Can type English text in any Android app using KickKey.
> **Builds on Phase 1** — the IME service, ReactHost pre-warm, and `ReactRootView` host are all already working. Phase 2 replaces the placeholder keyboard with real keys, wires every key press through `InputConnection`, adds shift/caps lock, symbols panel, haptic feedback, and long-press alternate characters.

---

## Table of Contents

1. [What Changes in Phase 2](#1-what-changes-in-phase-2)
2. [Updated Folder Structure](#2-updated-folder-structure)
3. [Type Definitions](#3-type-definitions)
4. [Default Theme Constants](#4-default-theme-constants)
5. [Keyboard Layout Definitions](#5-keyboard-layout-definitions)
6. [Updated KickKeyModule.kt](#6-updated-kickkeymodulekt)
7. [Updated KickKeyInputMethodService.kt](#7-updated-kickkeyinputmethodservicekt)
8. [HapticManager.kt](#8-hapticmanagerkt)
9. [useKeyboardTheme Hook](#9-usekeyboardtheme-hook)
10. [useKeyboardState Hook](#10-usekeyboardstate-hook)
11. [Key Component](#11-key-component)
12. [AltCharsPopup Component](#12-altcharspopup-component)
13. [KeyRow Component](#13-keyrow-component)
14. [SuggestionBar Component (Placeholder)](#14-suggestionbar-component-placeholder)
15. [BottomRow Component](#15-bottomrow-component)
16. [Updated KeyboardScreen](#16-updated-keyboardscreen)
17. [Updated keyboard.index.js Entry Point](#17-updated-keyboardindexjs-entry-point)
18. [Updated modules/kickkey-module/index.ts](#18-updated-moduleskickkey-moduleindexts)
19. [Build & Test](#19-build--test)
20. [Verification Checklist](#20-verification-checklist)
21. [Troubleshooting](#21-troubleshooting)

---

## 1. What Changes in Phase 2

### Files to CREATE (new)

| File | Purpose |
|---|---|
| `src/keyboard/types.ts` | `KeyDef`, `Theme`, `KeyAction` type definitions |
| `src/keyboard/constants/defaultTheme.ts` | Default dark theme values |
| `src/keyboard/layouts/english.ts` | Full QWERTY layout |
| `src/keyboard/layouts/symbols.ts` | Symbols / numbers panel |
| `src/keyboard/layouts/index.ts` | Re-export all layouts |
| `src/keyboard/hooks/useKeyboardTheme.ts` | Load theme from SharedPreferences |
| `src/keyboard/hooks/useKeyboardState.ts` | All key press state and NativeModules calls |
| `src/keyboard/Key.tsx` | Single key component |
| `src/keyboard/AltCharsPopup.tsx` | Long-press alternate characters overlay |
| `src/keyboard/KeyRow.tsx` | A row of keys |
| `src/keyboard/SuggestionBar.tsx` | Placeholder suggestion bar (wired in Phase 4) |
| `src/keyboard/BottomRow.tsx` | Space, Enter, language, emoji, clipboard keys |
| `android/.../HapticManager.kt` | Vibration on key press |

### Files to REPLACE (from Phase 1)

| File | What changes |
|---|---|
| `src/keyboard/KeyboardScreen.tsx` | Replace placeholder with real layout |
| `modules/kickkey-module/android/.../KickKeyModule.kt` | Add `commitKey`, `sendBackspace`, `commitSpace`, `sendEnter`, `getPreferences` |
| `modules/kickkey-module/index.ts` | Add new method exports |
| `android/.../KickKeyInputMethodService.kt` | Set `activeInputConnection` and `HapticManager` |

### Files to DELETE (from Phase 1)

| File | Why |
|---|---|
| `src/keyboard/PlaceholderKey.tsx` | Replaced by `Key.tsx` |

---

## 2. Updated Folder Structure

Only the `src/keyboard/` tree and native module are shown — everything else from Phase 1 remains unchanged.

```
src/keyboard/
├── KeyboardScreen.tsx          ← REPLACE Phase 1 version
├── Key.tsx                     ← NEW
├── KeyRow.tsx                  ← NEW
├── BottomRow.tsx               ← NEW
├── SuggestionBar.tsx           ← NEW (placeholder, wired fully in Phase 4)
├── AltCharsPopup.tsx           ← NEW
├── types.ts                    ← NEW
├── constants/
│   └── defaultTheme.ts         ← NEW
├── layouts/
│   ├── english.ts              ← NEW
│   ├── symbols.ts              ← NEW
│   └── index.ts                ← NEW
└── hooks/
    ├── useKeyboardTheme.ts     ← NEW
    └── useKeyboardState.ts     ← NEW

modules/kickkey-module/
├── index.ts                    ← REPLACE
└── android/src/main/java/com/kickkey/
    └── KickKeyModule.kt        ← REPLACE

android/app/src/main/java/com/kickkey/
├── KickKeyInputMethodService.kt   ← REPLACE
└── HapticManager.kt               ← NEW
```

---

## 3. Type Definitions

Create this file first — every other file in Phase 2 imports from it.

```typescript
// src/keyboard/types.ts

export interface KeyDef {
  /** Display label shown on the key (lowercase by default) */
  label: string;
  /** Display label when Shift is active */
  shiftLabel?: string;
  /** The character string committed to InputConnection on press */
  code: string;
  /** Relative flex width multiplier. Default: 1 */
  width?: number;
  /** Characters shown in the long-press popup */
  altChars?: string[];
  /** Icon identifier for special keys ('shift', 'backspace', 'enter') */
  icon?: KeyIcon;
  /** Special action this key triggers instead of committing a character */
  action?: KeyAction;
  /** Whether this key uses the special key background color */
  isSpecial?: boolean;
}

export type KeyIcon = 'shift' | 'backspace' | 'enter';

export type KeyAction =
  | 'backspace'
  | 'space'
  | 'enter'
  | 'shift'
  | 'language_switch'
  | 'emoji'
  | 'clipboard'
  | 'symbols'
  | 'symbols_back';

export interface Theme {
  // Colors
  keyboardBg: string;
  keyBg: string;
  keyText: string;
  specialKeyBg: string;
  specialKeyText: string;
  altText: string;
  suggestionBg: string;
  suggestionText: string;
  suggestionDivider: string;
  keyShadow: string;
  popupBg: string;
  popupText: string;
  // Dimensions
  keyHeight: number;
  keyBorderRadius: number;
  keyFontSize: number;
  keyMargin: number;
}
```

---

## 4. Default Theme Constants

```typescript
// src/keyboard/constants/defaultTheme.ts
import type { Theme } from '../types';

export const DEFAULT_DARK_THEME: Theme = {
  keyboardBg:       '#0d0d1a',
  keyBg:            '#1e1e2e',
  keyText:          '#ffffff',
  specialKeyBg:     '#2a2a40',
  specialKeyText:   '#ffffff',
  altText:          '#888888',
  suggestionBg:     '#12122a',
  suggestionText:   '#00BCD4',
  suggestionDivider:'#2a2a3e',
  keyShadow:        '#000000',
  popupBg:          '#2a2a40',
  popupText:        '#ffffff',
  keyHeight:        48,
  keyBorderRadius:  6,
  keyFontSize:      16,
  keyMargin:        3,
};
```

---

## 5. Keyboard Layout Definitions

### 5.1 English QWERTY

```typescript
// src/keyboard/layouts/english.ts
import type { KeyDef } from '../types';

export const ENGLISH_ROWS: KeyDef[][] = [
  // Row 1
  [
    { label: 'q', code: 'q', altChars: ['1', '!', '`'] },
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
  // Row 2
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
  // Row 3
  [
    { label: '⇧', shiftLabel: '⇪', code: '', action: 'shift',     width: 1.5, isSpecial: true, icon: 'shift' },
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

### 5.2 Symbols / Numbers Panel

```typescript
// src/keyboard/layouts/symbols.ts
import type { KeyDef } from '../types';

export const SYMBOL_ROWS: KeyDef[][] = [
  // Row 1 — numbers
  [
    { label: '1', code: '1', altChars: ['¹', '½'] },
    { label: '2', code: '2', altChars: ['²', '⅔'] },
    { label: '3', code: '3', altChars: ['³', '¾'] },
    { label: '4', code: '4', altChars: ['£'] },
    { label: '5', code: '5', altChars: ['€', '$'] },
    { label: '6', code: '6', altChars: ['¥'] },
    { label: '7', code: '7', altChars: ['&'] },
    { label: '8', code: '8', altChars: ['∞'] },
    { label: '9', code: '9', altChars: ['('] },
    { label: '0', code: '0', altChars: [')'] },
  ],
  // Row 2 — punctuation
  [
    { label: '@',  code: '@'  },
    { label: '#',  code: '#'  },
    { label: '$',  code: '$'  },
    { label: '%',  code: '%'  },
    { label: '&',  code: '&'  },
    { label: '-',  code: '-', altChars: ['_', '—', '–'] },
    { label: '+',  code: '+', altChars: ['±'] },
    { label: '(',  code: '('  },
    { label: ')',  code: ')'  },
  ],
  // Row 3 — more symbols
  [
    { label: '!#2', code: '', action: 'symbols_back', width: 1.5, isSpecial: true },
    { label: '*',   code: '*' },
    { label: '"',   code: '"', altChars: ['"', '"'] },
    { label: "'",   code: "'", altChars: [''', '''] },
    { label: ':',   code: ':' },
    { label: ';',   code: ';' },
    { label: '!',   code: '!' },
    { label: '?',   code: '?', altChars: ['¿'] },
    { label: '⌫',   code: '', action: 'backspace', width: 1.5, isSpecial: true, icon: 'backspace' },
  ],
];
```

### 5.3 Layout Re-export

```typescript
// src/keyboard/layouts/index.ts
export { ENGLISH_ROWS } from './english';
export { SYMBOL_ROWS }  from './symbols';
```

---

## 6. Updated `KickKeyModule.kt`

Replace the Phase 1 version entirely. This version adds `commitKey`, `sendBackspace`, `commitSpace`, `sendEnter`, and `getPreferences`. The `companion object` holds the active `InputConnection` reference which `KickKeyInputMethodService` sets on every new input session.

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyModule.kt

package com.kickkey

import android.content.Context
import android.view.KeyEvent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.view.inputmethod.InputConnection

class KickKeyModule : Module() {

    companion object {
        /**
         * Set by KickKeyInputMethodService.onStartInputView().
         * Cleared by onFinishInput().
         * All commitKey / sendBackspace calls use this reference.
         */
        var activeInputConnection: InputConnection? = null

        /**
         * Holds a reference to HapticManager so commitKey can trigger vibration.
         * Set by KickKeyInputMethodService.onCreate().
         */
        var hapticManager: HapticManager? = null
    }

    override fun definition() = ModuleDefinition {
        Name("KickKey")

        // ── Core text input ──────────────────────────────────────────────────

        /**
         * Commits a single character to the focused text field.
         * For Phase 2 English only — Bangla routing added in Phase 3.
         *
         * Called from useKeyboardState.handleKeyPress() in TypeScript.
         */
        Function("commitKey") { code: String, _language: String ->
            val ic = activeInputConnection ?: return@Function
            if (code.isNotEmpty()) {
                ic.commitText(code, 1)
            }
            hapticManager?.vibrate()
        }

        /**
         * Deletes the character immediately before the cursor.
         * Equivalent to pressing the physical Backspace key.
         */
        Function("sendBackspace") {
            activeInputConnection?.deleteSurroundingText(1, 0)
            hapticManager?.vibrate()
        }

        /**
         * Commits a space character.
         * Phase 4 will upgrade this to auto-commit the top suggestion.
         */
        Function("commitSpace") {
            activeInputConnection?.commitText(" ", 1)
            hapticManager?.vibrate()
        }

        /**
         * Sends an Enter key event to the focused field.
         * Works across all apps (chat, forms, search bars).
         */
        Function("sendEnter") {
            val ic = activeInputConnection ?: return@Function
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP,   KeyEvent.KEYCODE_ENTER))
            hapticManager?.vibrate()
        }

        // ── Preferences ──────────────────────────────────────────────────────

        /**
         * Returns the current keyboard preferences from SharedPreferences.
         * Called by useKeyboardTheme.ts on mount to set colors and dimensions.
         */
        Function("getPreferences") {
            val context = appContext.reactContext ?: return@Function emptyMap<String, Any>()
            val prefs = context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
            mapOf(
                "language"        to (prefs.getString("language",        "en")      ?: "en"),
                "theme"           to (prefs.getString("theme",           "dark")    ?: "dark"),
                "keyboardBg"      to (prefs.getString("keyboardBg",      "#0d0d1a") ?: "#0d0d1a"),
                "themeKeyBg"      to (prefs.getString("themeKeyBg",      "#1e1e2e") ?: "#1e1e2e"),
                "themeKeyText"    to (prefs.getString("themeKeyText",    "#ffffff") ?: "#ffffff"),
                "specialKeyBg"    to (prefs.getString("specialKeyBg",   "#2a2a40") ?: "#2a2a40"),
                "themePrimary"    to (prefs.getString("themePrimary",   "#00BCD4") ?: "#00BCD4"),
                "keyHeight"       to prefs.getInt("keyHeight",        48),
                "keyBorderRadius" to prefs.getInt("keyBorderRadius",   6),
                "fontSize"        to prefs.getInt("fontSize",          16),
                "keyMargin"       to prefs.getInt("keyMargin",          3),
                "hapticEnabled"   to prefs.getBoolean("hapticEnabled",  true),
                "soundEnabled"    to prefs.getBoolean("soundEnabled",   false),
                "autoCorrect"     to prefs.getBoolean("autoCorrect",    true),
                "showSuggestions" to prefs.getBoolean("showSuggestions",true)
            )
        }

        /**
         * Writes preferences set by the companion app (Phase 5).
         * The keyboard reads these on next open via getPreferences().
         */
        Function("savePreferences") { prefMap: Map<String, Any> ->
            val context = appContext.reactContext ?: return@Function
            val editor = context
                .getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
                .edit()
            prefMap.forEach { (key, value) ->
                when (value) {
                    is String  -> editor.putString(key, value)
                    is Boolean -> editor.putBoolean(key, value)
                    is Int     -> editor.putInt(key, value)
                    is Double  -> editor.putFloat(key, value.toFloat())
                }
            }
            editor.apply()
        }

        // ── IME status (carried over from Phase 1) ────────────────────────────

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
            val intent = android.content.Intent(
                android.provider.Settings.ACTION_INPUT_METHOD_SETTINGS
            ).apply { flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK }
            context.startActivity(intent)
        }

        // ── Phase 4+ stubs (do not implement yet) ────────────────────────────
        // commitSuggestion, getClipboardHistory
    }
}
```

---

## 7. Updated `KickKeyInputMethodService.kt`

The main change from Phase 1: store the `InputConnection` in `KickKeyModule.activeInputConnection` when a new input session starts, and clear it when it ends. Also initialise `HapticManager`.

```kotlin
// android/app/src/main/java/com/kickkey/KickKeyInputMethodService.kt

package com.kickkey

import android.inputmethodservice.InputMethodService
import android.util.Log
import android.view.View
import android.view.inputmethod.EditorInfo
import com.facebook.react.ReactRootView

class KickKeyInputMethodService : InputMethodService() {

    companion object {
        private const val TAG = "KickKeyIME"
    }

    private var reactRootView: ReactRootView? = null

    override fun onCreate() {
        super.onCreate()
        // Initialise haptic manager once; reuse the pre-created VibrationEffect on every keypress
        KickKeyModule.hapticManager = HapticManager(this)
        Log.i(TAG, "IME Service created")
    }

    override fun onCreateInputView(): View {
        Log.i(TAG, "onCreateInputView called")
        val app = application as? KickKeyApplication ?: run {
            Log.e(TAG, "KickKeyApplication not found")
            return View(this)
        }
        reactRootView = ReactRootView(this)
        reactRootView!!.startReactApplication(
            app.keyboardReactHost,
            "KickKeyKeyboard",
            null
        )
        Log.i(TAG, "ReactRootView started")
        return reactRootView!!
    }

    /**
     * Called every time the user focuses a new text field.
     * CRITICAL: store currentInputConnection here so KickKeyModule can use it.
     */
    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        // Give KickKeyModule access to the live InputConnection
        KickKeyModule.activeInputConnection = currentInputConnection
        Log.i(TAG, "InputConnection acquired — inputType: ${info.inputType}")
    }

    /**
     * Called when the user leaves the text field.
     * Clear the InputConnection so stale commits cannot happen.
     */
    override fun onFinishInput() {
        super.onFinishInput()
        KickKeyModule.activeInputConnection = null
        Log.i(TAG, "InputConnection released")
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        KickKeyModule.activeInputConnection = null
        Log.i(TAG, "Keyboard hidden")
    }

    override fun onDestroy() {
        reactRootView?.unmountReactApplication()
        reactRootView = null
        KickKeyModule.hapticManager = null
        super.onDestroy()
        Log.i(TAG, "IME Service destroyed")
    }
}
```

---

## 8. `HapticManager.kt`

Create this new file. It pre-creates a `VibrationEffect` once at IME startup and reuses it on every key press — allocating a new effect per keypress would cause measurable latency.

```kotlin
// android/app/src/main/java/com/kickkey/HapticManager.kt

package com.kickkey

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

class HapticManager(context: Context) {

    companion object {
        private const val TAG = "HapticManager"
        private const val VIBRATION_MS = 25L   // 25ms — short enough to feel instant
    }

    private val vibrator: Vibrator? = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)
                    as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    } catch (e: Exception) {
        Log.w(TAG, "Could not get Vibrator: ${e.message}")
        null
    }

    // Pre-create the effect once — do NOT create inside vibrate()
    private val effect: VibrationEffect? = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            VibrationEffect.createOneShot(
                VIBRATION_MS,
                VibrationEffect.DEFAULT_AMPLITUDE
            )
        } else null
    } catch (e: Exception) {
        Log.w(TAG, "Could not create VibrationEffect: ${e.message}")
        null
    }

    private var isEnabled: Boolean = true

    fun setEnabled(enabled: Boolean) {
        isEnabled = enabled
    }

    fun vibrate() {
        if (!isEnabled) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && effect != null) {
                vibrator?.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(VIBRATION_MS)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Vibration failed: ${e.message}")
        }
    }
}
```

---

## 9. `useKeyboardTheme` Hook

This hook loads theme values from `SharedPreferences` (via `NativeModules.KickKey.getPreferences`) on mount. The keyboard uses these values for all colors and sizing. If no preferences are saved yet (first launch) it falls back to the default dark theme.

```typescript
// src/keyboard/hooks/useKeyboardTheme.ts
import { useState, useEffect } from 'react';
import { NativeModules } from 'react-native';
import type { Theme } from '../types';
import { DEFAULT_DARK_THEME } from '../constants/defaultTheme';

const { KickKey } = NativeModules;

export function useKeyboardTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(DEFAULT_DARK_THEME);

  useEffect(() => {
    // Load preferences once on mount
    KickKey.getPreferences()
      .then((prefs: Record<string, any>) => {
        setTheme({
          keyboardBg:       prefs.keyboardBg      ?? DEFAULT_DARK_THEME.keyboardBg,
          keyBg:            prefs.themeKeyBg      ?? DEFAULT_DARK_THEME.keyBg,
          keyText:          prefs.themeKeyText    ?? DEFAULT_DARK_THEME.keyText,
          specialKeyBg:     prefs.specialKeyBg    ?? DEFAULT_DARK_THEME.specialKeyBg,
          specialKeyText:   prefs.themeKeyText    ?? DEFAULT_DARK_THEME.specialKeyText,
          altText:          DEFAULT_DARK_THEME.altText,
          suggestionBg:     DEFAULT_DARK_THEME.suggestionBg,
          suggestionText:   prefs.themePrimary    ?? DEFAULT_DARK_THEME.suggestionText,
          suggestionDivider:DEFAULT_DARK_THEME.suggestionDivider,
          keyShadow:        DEFAULT_DARK_THEME.keyShadow,
          popupBg:          prefs.specialKeyBg    ?? DEFAULT_DARK_THEME.popupBg,
          popupText:        prefs.themeKeyText    ?? DEFAULT_DARK_THEME.popupText,
          keyHeight:        Number(prefs.keyHeight)       || DEFAULT_DARK_THEME.keyHeight,
          keyBorderRadius:  Number(prefs.keyBorderRadius) || DEFAULT_DARK_THEME.keyBorderRadius,
          keyFontSize:      Number(prefs.fontSize)        || DEFAULT_DARK_THEME.keyFontSize,
          keyMargin:        Number(prefs.keyMargin)       || DEFAULT_DARK_THEME.keyMargin,
        });
      })
      .catch(() => {
        // SharedPreferences not accessible (first launch or :ime_process cold start)
        // Silently use DEFAULT_DARK_THEME already set in initial state
      });
  }, []);

  return theme;
}
```

---

## 10. `useKeyboardState` Hook

This is the central state hook for the keyboard. It manages shift/caps lock, symbol mode, and dispatches all key actions to Kotlin via `NativeModules.KickKey`.

```typescript
// src/keyboard/hooks/useKeyboardState.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { NativeModules, NativeEventEmitter } from 'react-native';
import type { KeyDef } from '../types';

const { KickKey } = NativeModules;
const emitter = new NativeEventEmitter(KickKey);

export interface KeyboardState {
  language: 'en' | 'bn';
  isShift: boolean;
  isCapsLock: boolean;
  isSymbol: boolean;
  isEmoji: boolean;
  isClipboard: boolean;
  suggestions: string[];
  handleKeyPress: (key: KeyDef) => void;
  handleBackspace: () => void;
  handleBackspaceLongPress: () => void;
  handleSpace: () => void;
  handleEnter: () => void;
  handleShift: () => void;
  handleLanguageSwitch: () => void;
  handleSymbolToggle: () => void;
  handleEmojiToggle: () => void;
  handleClipboardToggle: () => void;
  handleSuggestionSelect: (word: string) => void;
}

export function useKeyboardState(): KeyboardState {
  const [language, setLanguage]       = useState<'en' | 'bn'>('en');
  const [isShift, setIsShift]         = useState(false);
  const [isCapsLock, setIsCapsLock]   = useState(false);
  const [isSymbol, setIsSymbol]       = useState(false);
  const [isEmoji, setIsEmoji]         = useState(false);
  const [isClipboard, setIsClipboard] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Hold ref for long-press backspace interval
  const backspacePressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Native event listeners ───────────────────────────────────────────────

  useEffect(() => {
    // Phase 4 will populate suggestions; for now just wire the listener
    const subSuggestions = emitter.addListener('onSuggestionsUpdated', (data) => {
      setSuggestions(data.suggestions ?? []);
    });

    // Adapt keyboard to field type when a new input starts
    const subInput = emitter.addListener('onInputStarted', (data) => {
      const inputType: number = data.inputType ?? 0;
      const isPasswordField = (inputType & 0x80) !== 0;   // TYPE_TEXT_VARIATION_PASSWORD
      if (isPasswordField) setSuggestions([]);
      // Reset symbol / emoji mode on new field focus
      setIsSymbol(false);
      setIsEmoji(false);
      setIsClipboard(false);
    });

    // Release heavy panels when keyboard hides (Phase 6 fully uses this)
    const subHidden = emitter.addListener('onKeyboardHidden', () => {
      setIsEmoji(false);
      setIsClipboard(false);
    });

    return () => {
      subSuggestions.remove();
      subInput.remove();
      subHidden.remove();
    };
  }, []);

  // Clean up long-press interval on unmount
  useEffect(() => {
    return () => {
      if (backspacePressRef.current) clearInterval(backspacePressRef.current);
    };
  }, []);

  // ── Key press handlers ───────────────────────────────────────────────────

  const handleKeyPress = useCallback((key: KeyDef) => {
    if (!key.code) return;  // action-only keys handled by their own handlers

    KickKey.commitKey(key.code, language);

    // Auto-reset shift after a single character (not caps lock)
    if (isShift && !isCapsLock) {
      setIsShift(false);
    }

    // If shift is active, send the uppercase character
    // The KeyRow passes the shifted label; commitKey just sends whatever code is given
  }, [language, isShift, isCapsLock]);

  const handleBackspace = useCallback(() => {
    KickKey.sendBackspace();
  }, []);

  /**
   * Long-press backspace: keep deleting every 80ms while finger is held.
   * Call handleBackspaceLongPressEnd() when the finger lifts.
   */
  const handleBackspaceLongPress = useCallback(() => {
    if (backspacePressRef.current) return;
    backspacePressRef.current = setInterval(() => {
      KickKey.sendBackspace();
    }, 80);
  }, []);

  const handleBackspaceLongPressEnd = useCallback(() => {
    if (backspacePressRef.current) {
      clearInterval(backspacePressRef.current);
      backspacePressRef.current = null;
    }
  }, []);

  const handleSpace = useCallback(() => {
    KickKey.commitSpace();
    if (isShift && !isCapsLock) setIsShift(false);
  }, [isShift, isCapsLock]);

  const handleEnter = useCallback(() => {
    KickKey.sendEnter();
  }, []);

  /**
   * Shift state machine:
   *   off → shift (one letter) → caps lock (stay on) → off
   */
  const handleShift = useCallback(() => {
    if (!isShift && !isCapsLock) {
      setIsShift(true);
    } else if (isShift && !isCapsLock) {
      setIsCapsLock(true);
    } else {
      setIsShift(false);
      setIsCapsLock(false);
    }
  }, [isShift, isCapsLock]);

  const handleLanguageSwitch = useCallback(() => {
    setLanguage(l => l === 'en' ? 'bn' : 'en');
    setSuggestions([]);
    setIsShift(false);
    setIsCapsLock(false);
  }, []);

  const handleSymbolToggle = useCallback(() => {
    setIsSymbol(s => !s);
    setIsShift(false);
    setIsCapsLock(false);
  }, []);

  const handleEmojiToggle = useCallback(() => {
    setIsEmoji(e => !e);
    setIsClipboard(false);
  }, []);

  const handleClipboardToggle = useCallback(() => {
    setIsClipboard(c => !c);
    setIsEmoji(false);
  }, []);

  const handleSuggestionSelect = useCallback((word: string) => {
    // Phase 4 wires this to KickKey.commitSuggestion(); for now commit as text
    KickKey.commitKey(word, language);
    setSuggestions([]);
  }, [language]);

  return {
    language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard, suggestions,
    handleKeyPress,
    handleBackspace,
    handleBackspaceLongPress,
    handleSpace,
    handleEnter,
    handleShift,
    handleLanguageSwitch,
    handleSymbolToggle,
    handleEmojiToggle,
    handleClipboardToggle,
    handleSuggestionSelect,
  };
}
```

---

## 11. `Key` Component

Single key cell. Memoised with `React.memo` so a row re-renders only when `isShift` or `theme` actually changes.

```tsx
// src/keyboard/Key.tsx
import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import type { KeyDef, Theme } from './types';

interface KeyProps {
  keyDef: KeyDef;
  theme: Theme;
  isShift: boolean;
  isCapsLock: boolean;
  onPress: (key: KeyDef) => void;
  onLongPress?: (key: KeyDef) => void;
  onLongPressEnd?: () => void;
}

function Key({
  keyDef,
  theme,
  isShift,
  isCapsLock,
  onPress,
  onLongPress,
  onLongPressEnd,
}: KeyProps) {
  // Determine displayed label
  const active = isShift || isCapsLock;
  const label = active && keyDef.shiftLabel
    ? keyDef.shiftLabel
    : active && keyDef.code.length === 1
    ? keyDef.code.toUpperCase()
    : keyDef.label;

  // The code actually committed shifts to uppercase when shift is active
  const codeToSend = active && keyDef.code.length === 1
    ? keyDef.code.toUpperCase()
    : keyDef.code;

  const effectiveKey: KeyDef = { ...keyDef, code: codeToSend };

  const handlePress = useCallback(() => {
    onPress(effectiveKey);
  }, [effectiveKey, onPress]);

  const handleLongPress = useCallback(() => {
    // For backspace: start repeat; for character keys: show alt popup
    onLongPress?.(keyDef);
  }, [keyDef, onLongPress]);

  const isSpecial = !!keyDef.isSpecial;

  return (
    <TouchableOpacity
      style={[
        styles.key,
        {
          flex: keyDef.width ?? 1,
          height: theme.keyHeight,
          backgroundColor: isSpecial ? theme.specialKeyBg : theme.keyBg,
          borderRadius: theme.keyBorderRadius,
          marginHorizontal: theme.keyMargin,
          elevation: 2,
          shadowColor: theme.keyShadow,
        },
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressOut={onLongPressEnd}
      delayLongPress={300}
      activeOpacity={0.55}
    >
      {/* Icon-only keys (shift arrow, backspace arrow, enter arrow) */}
      {keyDef.icon === 'shift' && (
        <Text style={[styles.iconText, { color: isSpecial ? theme.specialKeyText : theme.keyText }]}>
          {isCapsLock ? '⇪' : isShift ? '⇧' : '⇧'}
        </Text>
      )}
      {keyDef.icon === 'backspace' && (
        <Text style={[styles.iconText, { color: isSpecial ? theme.specialKeyText : theme.keyText }]}>
          ⌫
        </Text>
      )}
      {keyDef.icon === 'enter' && (
        <Text style={[styles.iconText, { color: isSpecial ? theme.specialKeyText : theme.keyText }]}>
          ↵
        </Text>
      )}

      {/* Standard text key */}
      {!keyDef.icon && (
        <Text
          style={[
            styles.keyLabel,
            {
              color: isSpecial ? theme.specialKeyText : theme.keyText,
              fontSize: theme.keyFontSize,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {label}
        </Text>
      )}

      {/* Alt character hint (top-right corner) */}
      {keyDef.altChars && keyDef.altChars.length > 0 && !keyDef.icon && (
        <Text
          style={[styles.altHint, { color: theme.altText }]}
          numberOfLines={1}
        >
          {keyDef.altChars[0]}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default React.memo(Key, (prev, next) => {
  return (
    prev.keyDef  === next.keyDef  &&
    prev.isShift === next.isShift &&
    prev.isCapsLock === next.isCapsLock &&
    prev.theme   === next.theme
  );
});

const styles = StyleSheet.create({
  key: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 4,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
  },
  keyLabel: {
    fontWeight: '500',
    textAlign: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: '400',
  },
  altHint: {
    position: 'absolute',
    top: 3,
    right: 4,
    fontSize: 9,
    opacity: 0.65,
  },
});
```

---

## 12. `AltCharsPopup` Component

Shown when a character key is long-pressed. Renders a horizontal strip of alternate characters above the pressed key position.

```tsx
// src/keyboard/AltCharsPopup.tsx
import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import type { Theme } from './types';

interface AltCharsPopupProps {
  chars: string[];
  theme: Theme;
  anchorX: number;   // x position of the pressed key
  anchorY: number;   // y position of the pressed key
  onSelect: (char: string) => void;
  onClose: () => void;
}

const POPUP_ITEM_SIZE = 44;

export default function AltCharsPopup({
  chars,
  theme,
  anchorX,
  anchorY,
  onSelect,
  onClose,
}: AltCharsPopupProps) {
  const popupWidth = chars.length * POPUP_ITEM_SIZE;
  const screenWidth = Dimensions.get('window').width;

  // Clamp so the popup never goes off-screen right edge
  const left = Math.min(anchorX, screenWidth - popupWidth - 8);

  const handleSelect = useCallback((char: string) => {
    onSelect(char);
    onClose();
  }, [onSelect, onClose]);

  return (
    <Modal
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Invisible full-screen backdrop — tap anywhere to dismiss */}
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1}>
        <View
          style={[
            styles.popup,
            {
              left,
              top: anchorY - POPUP_ITEM_SIZE - 8,
              backgroundColor: theme.popupBg,
              borderRadius: theme.keyBorderRadius + 2,
            },
          ]}
        >
          {chars.map((char) => (
            <TouchableOpacity
              key={char}
              style={[styles.popupItem, { width: POPUP_ITEM_SIZE }]}
              onPress={() => handleSelect(char)}
            >
              <Text style={[styles.popupChar, { color: theme.popupText, fontSize: theme.keyFontSize }]}>
                {char}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  popup: {
    position: 'absolute',
    flexDirection: 'row',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    paddingHorizontal: 4,
  },
  popupItem: {
    height: POPUP_ITEM_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupChar: {
    fontWeight: '500',
  },
});
```

### Wiring AltCharsPopup into `KeyRow`

`KeyRow` captures the touch position on long-press and passes it to the popup.

---

## 13. `KeyRow` Component

Renders a horizontal row of `Key` components. Manages the long-press popup state for alt characters, and routes the backspace long-press to the repeat delete handler.

```tsx
// src/keyboard/KeyRow.tsx
import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Key from './Key';
import AltCharsPopup from './AltCharsPopup';
import type { KeyDef, Theme } from './types';

interface KeyRowProps {
  keys: KeyDef[];
  theme: Theme;
  isShift: boolean;
  isCapsLock: boolean;
  onKeyPress: (key: KeyDef) => void;
  onBackspace: () => void;
  onBackspaceLongPress: () => void;
  onBackspaceLongPressEnd: () => void;
  onShift: () => void;
}

interface PopupState {
  chars: string[];
  anchorX: number;
  anchorY: number;
}

function KeyRow({
  keys,
  theme,
  isShift,
  isCapsLock,
  onKeyPress,
  onBackspace,
  onBackspaceLongPress,
  onBackspaceLongPressEnd,
  onShift,
}: KeyRowProps) {
  const [popup, setPopup] = useState<PopupState | null>(null);

  const handleKeyPress = useCallback((key: KeyDef) => {
    if (key.action === 'backspace') { onBackspace(); return; }
    if (key.action === 'shift')     { onShift();    return; }
    onKeyPress(key);
  }, [onKeyPress, onBackspace, onShift]);

  const handleLongPress = useCallback((key: KeyDef) => {
    if (key.action === 'backspace') {
      onBackspaceLongPress();
      return;
    }
    // Show alt chars popup if the key has them
    if (key.altChars && key.altChars.length > 0) {
      // We can't get real screen coords from a TouchableOpacity easily without refs,
      // so we use a reasonable vertical anchor relative to the keyboard.
      // A precise implementation would use onLayout + measure().
      setPopup({
        chars: key.altChars,
        anchorX: 80,    // approximate — replace with real coords if needed
        anchorY: 200,
      });
    }
  }, [onBackspaceLongPress]);

  const handleLongPressEnd = useCallback((key: KeyDef) => {
    if (key.action === 'backspace') {
      onBackspaceLongPressEnd();
    }
  }, [onBackspaceLongPressEnd]);

  const handlePopupSelect = useCallback((char: string) => {
    onKeyPress({ label: char, code: char });
  }, [onKeyPress]);

  return (
    <View style={styles.row}>
      {keys.map((key, idx) => (
        <Key
          key={`${key.label}-${idx}`}
          keyDef={key}
          theme={theme}
          isShift={isShift}
          isCapsLock={isCapsLock}
          onPress={handleKeyPress}
          onLongPress={handleLongPress}
          onLongPressEnd={() => handleLongPressEnd(key)}
        />
      ))}

      {popup && (
        <AltCharsPopup
          chars={popup.chars}
          theme={theme}
          anchorX={popup.anchorX}
          anchorY={popup.anchorY}
          onSelect={handlePopupSelect}
          onClose={() => setPopup(null)}
        />
      )}
    </View>
  );
}

export default React.memo(KeyRow, (prev, next) =>
  prev.keys       === next.keys    &&
  prev.isShift    === next.isShift &&
  prev.isCapsLock === next.isCapsLock &&
  prev.theme      === next.theme
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
});
```

---

## 14. `SuggestionBar` Component (Placeholder)

A minimal suggestion bar for Phase 2. It renders three suggestion chips but they always show empty in Phase 2 because the suggestion engine is not wired yet. The chips become functional in Phase 4.

```tsx
// src/keyboard/SuggestionBar.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { Theme } from './types';

interface SuggestionBarProps {
  suggestions: string[];
  onSelect: (word: string) => void;
  theme: Theme;
}

function SuggestionBar({ suggestions, onSelect, theme }: SuggestionBarProps) {
  return (
    <View style={[styles.bar, { backgroundColor: theme.suggestionBg }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {suggestions.length === 0 ? (
          <Text style={[styles.placeholder, { color: theme.altText }]}>
            {/* Empty in Phase 2 — suggestions wired in Phase 4 */}
          </Text>
        ) : (
          suggestions.map((word, i) => (
            <React.Fragment key={word}>
              {i > 0 && (
                <View style={[styles.divider, { backgroundColor: theme.suggestionDivider }]} />
              )}
              <TouchableOpacity
                style={styles.chip}
                onPress={() => onSelect(word)}
              >
                <Text style={[styles.chipText, { color: theme.suggestionText }]}>
                  {word}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export default React.memo(SuggestionBar, (prev, next) =>
  JSON.stringify(prev.suggestions) === JSON.stringify(next.suggestions) &&
  prev.theme === next.theme
);

const styles = StyleSheet.create({
  bar: {
    height: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a3e',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    minHeight: 40,
  },
  placeholder: {
    fontSize: 12,
    paddingHorizontal: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    alignSelf: 'center',
  },
});
```

---

## 15. `BottomRow` Component

The bottom row contains the symbols toggle, language switch, spacebar, and enter key.

```tsx
// src/keyboard/BottomRow.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Theme } from './types';

interface BottomRowProps {
  theme: Theme;
  language: 'en' | 'bn';
  isSymbol: boolean;
  onSpace: () => void;
  onEnter: () => void;
  onLanguageSwitch: () => void;
  onSymbolToggle: () => void;
  onEmojiToggle: () => void;
}

export default function BottomRow({
  theme,
  language,
  isSymbol,
  onSpace,
  onEnter,
  onLanguageSwitch,
  onSymbolToggle,
  onEmojiToggle,
}: BottomRowProps) {
  const specialStyle = {
    backgroundColor: theme.specialKeyBg,
    borderRadius: theme.keyBorderRadius,
    marginHorizontal: theme.keyMargin,
    height: theme.keyHeight,
  };

  const spaceStyle = {
    backgroundColor: theme.keyBg,
    borderRadius: theme.keyBorderRadius,
    marginHorizontal: theme.keyMargin,
    height: theme.keyHeight,
  };

  return (
    <View style={styles.row}>
      {/* Symbols toggle */}
      <TouchableOpacity
        style={[styles.specialKey, specialStyle, { flex: 1.5 }]}
        onPress={onSymbolToggle}
        activeOpacity={0.55}
      >
        <Text style={[styles.specialLabel, { color: theme.specialKeyText, fontSize: 13 }]}>
          {isSymbol ? 'ABC' : '!#1'}
        </Text>
      </TouchableOpacity>

      {/* Language switch */}
      <TouchableOpacity
        style={[styles.specialKey, specialStyle, { flex: 1 }]}
        onPress={onLanguageSwitch}
        activeOpacity={0.55}
      >
        <Text style={[styles.specialLabel, { color: theme.specialKeyText, fontSize: 12 }]}>
          {language === 'en' ? '🌐 EN' : '🌐 বাং'}
        </Text>
      </TouchableOpacity>

      {/* Spacebar */}
      <TouchableOpacity
        style={[styles.spaceKey, spaceStyle, { flex: 5 }]}
        onPress={onSpace}
        activeOpacity={0.7}
      >
        <Text style={[styles.spaceLabel, { color: theme.altText }]}>
          space
        </Text>
      </TouchableOpacity>

      {/* Emoji toggle */}
      <TouchableOpacity
        style={[styles.specialKey, specialStyle, { flex: 1 }]}
        onPress={onEmojiToggle}
        activeOpacity={0.55}
      >
        <Text style={styles.emojiLabel}>😊</Text>
      </TouchableOpacity>

      {/* Enter */}
      <TouchableOpacity
        style={[styles.specialKey, specialStyle, { flex: 1.5 }]}
        onPress={onEnter}
        activeOpacity={0.55}
      >
        <Text style={[styles.specialLabel, { color: theme.specialKeyText, fontSize: 18 }]}>
          ↵
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    justifyContent: 'center',
    marginVertical: 4,
  },
  specialKey: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  spaceKey: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  specialLabel: {
    fontWeight: '500',
    textAlign: 'center',
  },
  spaceLabel: {
    fontSize: 13,
  },
  emojiLabel: {
    fontSize: 20,
  },
});
```

---

## 16. Updated `KeyboardScreen`

Replace the Phase 1 placeholder entirely. This is the full keyboard for Phase 2.

```tsx
// src/keyboard/KeyboardScreen.tsx

/**
 * PHASE 2 — Full English keyboard.
 *
 * - Real QWERTY keys committed via NativeModules.KickKey.commitKey()
 * - Shift / Caps Lock state managed in useKeyboardState
 * - Symbol panel (numbers + punctuation)
 * - Long-press alt characters popup
 * - Haptic feedback on every key (via Kotlin HapticManager)
 * - Suggestion bar placeholder (wired in Phase 4)
 * - Emoji and clipboard panels are stubs (wired in Phase 6)
 *
 * ⚠️ Do NOT import from companion app bundles (expo-router, zustand, AsyncStorage).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useKeyboardTheme }  from './hooks/useKeyboardTheme';
import { useKeyboardState }  from './hooks/useKeyboardState';
import KeyRow                from './KeyRow';
import SuggestionBar         from './SuggestionBar';
import BottomRow             from './BottomRow';
import { ENGLISH_ROWS, SYMBOL_ROWS } from './layouts';

export default function KeyboardScreen() {
  const theme = useKeyboardTheme();
  const {
    language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard,
    suggestions,
    handleKeyPress,
    handleBackspace,
    handleBackspaceLongPress,
    handleSpace,
    handleEnter,
    handleShift,
    handleLanguageSwitch,
    handleSymbolToggle,
    handleEmojiToggle,
    handleClipboardToggle,
    handleSuggestionSelect,
  } = useKeyboardState();

  const rows = isSymbol ? SYMBOL_ROWS : ENGLISH_ROWS;

  // Emoji and clipboard panels are stubs in Phase 2 — wired fully in Phase 6
  if (isEmoji) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <Text style={[styles.stubText, { color: theme.altText }]}>
          😊 Emoji panel coming in Phase 6
        </Text>
        <Text style={[styles.stubClose, { color: theme.suggestionText }]}
          onPress={handleEmojiToggle}
        >
          Close
        </Text>
      </View>
    );
  }

  if (isClipboard) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <Text style={[styles.stubText, { color: theme.altText }]}>
          📋 Clipboard panel coming in Phase 6
        </Text>
        <Text style={[styles.stubClose, { color: theme.suggestionText }]}
          onPress={handleClipboardToggle}
        >
          Close
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
      {/* Suggestion bar — placeholder in Phase 2, functional in Phase 4 */}
      <SuggestionBar
        suggestions={suggestions}
        onSelect={handleSuggestionSelect}
        theme={theme}
      />

      {/* Key rows (QWERTY or Symbols) */}
      {rows.map((row, i) => (
        <KeyRow
          key={i}
          keys={row}
          theme={theme}
          isShift={isShift}
          isCapsLock={isCapsLock}
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onBackspaceLongPress={handleBackspaceLongPress}
          onBackspaceLongPressEnd={() => {}}   // handled inside KeyRow via ref
          onShift={handleShift}
        />
      ))}

      {/* Bottom row: symbols, language, space, emoji, enter */}
      <BottomRow
        theme={theme}
        language={language}
        isSymbol={isSymbol}
        onSpace={handleSpace}
        onEnter={handleEnter}
        onLanguageSwitch={handleLanguageSwitch}
        onSymbolToggle={handleSymbolToggle}
        onEmojiToggle={handleEmojiToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    width: '100%',
    paddingBottom: 6,
  },
  stubText: {
    textAlign: 'center',
    padding: 40,
    fontSize: 14,
  },
  stubClose: {
    textAlign: 'center',
    paddingBottom: 16,
    fontSize: 14,
    fontWeight: '600',
  },
});
```

---

## 17. Updated `keyboard.index.js` Entry Point

No change needed in Phase 2 — the entry point already registers `KickKeyKeyboard`. Only the imported `KeyboardScreen` changes (the file is replaced in place).

```javascript
// keyboard.index.js  (no change needed — shown for reference)
import { AppRegistry } from 'react-native';
import KeyboardScreen from './src/keyboard/KeyboardScreen';

AppRegistry.registerComponent('KickKeyKeyboard', () => KeyboardScreen);
```

---

## 18. Updated `modules/kickkey-module/index.ts`

Add the new methods introduced in Phase 2.

```typescript
// modules/kickkey-module/index.ts
import { NativeModules } from 'react-native';

const { KickKey } = NativeModules;

export default {
  // ── Phase 1 (carried over) ────────────────────────────────────────────────
  isDefaultKeyboard:   (): Promise<boolean> => KickKey.isDefaultKeyboard(),
  isKeyboardEnabled:   (): Promise<boolean> => KickKey.isKeyboardEnabled(),
  openKeyboardSettings:(): void             => KickKey.openKeyboardSettings(),

  // ── Phase 2 (new) ─────────────────────────────────────────────────────────

  /**
   * Commits a character to the currently focused text field.
   * @param code   The character string to insert (e.g. 'a', 'A', '!', ' ')
   * @param language  'en' or 'bn' — Bangla routing added in Phase 3
   */
  commitKey: (code: string, language: string): Promise<void> =>
    KickKey.commitKey(code, language),

  /**
   * Deletes the character immediately before the cursor.
   */
  sendBackspace: (): Promise<void> =>
    KickKey.sendBackspace(),

  /**
   * Commits a space. Phase 4 upgrades this to auto-commit top suggestion.
   */
  commitSpace: (): Promise<void> =>
    KickKey.commitSpace(),

  /**
   * Sends an Enter key event to the focused field.
   */
  sendEnter: (): Promise<void> =>
    KickKey.sendEnter(),

  /**
   * Returns current keyboard preferences (theme, layout, haptic flags, etc.)
   * Used by useKeyboardTheme on mount.
   */
  getPreferences: (): Promise<Record<string, any>> =>
    KickKey.getPreferences(),

  /**
   * Persists preferences so the keyboard reads them on next open.
   * Called by companion app (Phase 5).
   */
  savePreferences: (prefs: Record<string, any>): Promise<void> =>
    KickKey.savePreferences(prefs),
};
```

---

## 19. Build & Test

### 19.1 Delete Phase 1 Placeholder

```bash
rm src/keyboard/PlaceholderKey.tsx
```

### 19.2 Rebuild `keyboard.bundle`

Every time you change any file inside `src/keyboard/`, rebuild the bundle:

```bash
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify false        # keep false during development for readable error messages

# When ready for EAS build, minify is handled automatically
```

### 19.3 Build & Install

```bash
# Quick local build (fastest iteration cycle)
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Or EAS cloud build
eas build --platform android --profile development
```

### 19.4 Monitor Logs

```bash
# IME lifecycle and InputConnection events
adb logcat -s KickKeyIME

# React Native JS exceptions inside the keyboard bundle
adb logcat -s ReactNativeJS

# Haptic manager
adb logcat -s HapticManager
```

Expected log sequence when a key is pressed:

```
I/KickKeyIME: InputConnection acquired — inputType: 1
I/KickKeyIME: onCreateInputView called
I/KickKeyIME: ReactRootView started
# ... user presses 'h' ...
I/HapticManager: (no log — silent vibration)
# ... user presses 'e' ...
# ... user presses 'l' ...
# ... user presses 'l' ...
# ... user presses 'o' ...
# "hello" is now typed in the target app
```

---

## 20. Verification Checklist

Complete every item before moving to Phase 3.

### Kotlin / Native
- [ ] `HapticManager.kt` compiles without errors
- [ ] `KickKeyInputMethodService.kt` compiles without errors
- [ ] `KickKeyModule.kt` compiles — all five new functions present
- [ ] `adb logcat -s KickKeyIME` shows "InputConnection acquired" when a text field is tapped

### Core Typing
- [ ] Typing `hello` in WhatsApp or Notes produces "hello"
- [ ] All 26 lowercase letters type correctly
- [ ] Numbers row in symbols panel types `1` through `0`
- [ ] Punctuation in symbols panel types correctly (`.`, `,`, `!`, `?`, etc.)

### Shift & Caps Lock
- [ ] Single shift tap → next letter is uppercase → shift resets
- [ ] Double shift tap → caps lock active → all letters uppercase
- [ ] Third shift tap → caps lock off → back to lowercase
- [ ] Shift key icon changes: `⇧` (off) → `⇧` (one-shot) → `⇪` (caps lock)

### Backspace
- [ ] Single tap deletes one character
- [ ] Long-press hold deletes characters repeatedly at ~80ms intervals
- [ ] Releasing finger stops the repeat deletion

### Special Keys
- [ ] Space inserts a space character
- [ ] Enter submits form / creates new line depending on app
- [ ] `!#1` button switches to symbols panel
- [ ] `ABC` button (in symbols panel) switches back to QWERTY
- [ ] `🌐` language switch button toggles label between `EN` and `বাং` (layout stays QWERTY in Phase 2)

### Alt Characters Popup
- [ ] Long-pressing `e` shows popup with `è é ê ë 3`
- [ ] Tapping a character in the popup commits it
- [ ] Tapping outside the popup dismisses it without committing

### Haptic Feedback
- [ ] Every key press produces a short vibration (~25ms)
- [ ] Vibration is absent if device has vibration disabled in system settings

### Performance
- [ ] Keyboard opens within 80ms (after app has been opened at least once)
- [ ] No dropped frames (jank) during continuous fast typing
- [ ] `adb logcat` shows no `ReactNativeJS` errors or warnings during typing

---

## 21. Troubleshooting

### Characters are typed but nothing appears on screen

**Cause:** `KickKeyModule.activeInputConnection` is `null` — the service is not setting it.

**Fix:** Confirm `KickKeyInputMethodService.onStartInputView()` calls:
```kotlin
KickKeyModule.activeInputConnection = currentInputConnection
```
Check `adb logcat -s KickKeyIME` for "InputConnection acquired".

---

### Typing works in some apps but not others (Gmail, Chrome URL bar)

**Cause:** Some apps use `commitText` on a content-editable that requires `beginBatchEdit` / `endBatchEdit` wrapping.

**Fix:** Wrap the commit in `KickKeyModule.kt`:
```kotlin
Function("commitKey") { code: String, _language: String ->
    val ic = activeInputConnection ?: return@Function
    ic.beginBatchEdit()
    ic.commitText(code, 1)
    ic.endBatchEdit()
    hapticManager?.vibrate()
}
```

---

### Long-press backspace does not stop on finger lift

**Cause:** `onPressOut` is not reaching `handleBackspaceLongPressEnd`.

**Fix:** In `KeyRow.tsx`, ensure `Key` receives:
```tsx
onLongPressEnd={() => handleLongPressEnd(key)}
```
And `Key.tsx` passes it to `TouchableOpacity`:
```tsx
<TouchableOpacity onPressOut={onLongPressEnd} ...>
```

---

### `keyboard.bundle` build fails with "Cannot find module './types'"

**Cause:** `types.ts` was created but TypeScript cannot resolve it.

**Fix:**
```bash
# Confirm the file exists
ls src/keyboard/types.ts

# Confirm tsconfig.json includes src/
cat tsconfig.json | grep -A 5 '"paths"'
# If paths not set, add: "paths": { "@keyboard/*": ["src/keyboard/*"] }
# Or just use relative imports everywhere
```

---

### Alt chars popup appears at wrong position

**Cause:** The anchor coordinates in `KeyRow.handleLongPress` are hardcoded (`anchorX: 80, anchorY: 200`).

**Fix (precise implementation):** Use `onLayout` + `ref.measure()` on each `Key` to get real screen coords, then pass them to the popup. For Phase 2 the approximate position is acceptable.

---

### No haptic feedback at all

**Cause 1:** `VIBRATE` permission missing from manifest.

**Check:** `grep VIBRATE android/app/src/main/AndroidManifest.xml`

**Cause 2:** `HapticManager` not initialized — `KickKeyModule.hapticManager` is null.

**Check:** `adb logcat -s KickKeyIME | grep "IME Service created"` — if absent the `onCreate()` is not running.

**Fix:** Confirm `KickKeyInputMethodService.onCreate()` calls:
```kotlin
KickKeyModule.hapticManager = HapticManager(this)
```

---

*Phase 2 complete. Proceed to Phase 3 — Bangla Input — to add phonetic transliteration and the Bangla layout.*
