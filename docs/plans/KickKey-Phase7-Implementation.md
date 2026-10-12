# KickKey — Phase 7 Implementation Guide
## Polish & Performance (Weeks 13–14)

> **Goal:** Production-quality feel and performance. Every key press feels instant and satisfying, RAM stays under 50MB in the `:ime_process`, the keyboard opens under 80ms (after first pre-warm), and suggestions appear within 100ms. The keyboard also adapts correctly to different text field types — password fields hide suggestions, number-only fields show a compact number grid, and URL fields enable `.com` quick-insert.
> **Builds on Phase 6** — all features are implemented. Phase 7 adds no new user-visible features; it optimises and polishes what already exists.

---

## Table of Contents

1. [What Changes in Phase 7](#1-what-changes-in-phase-7)
2. [Performance Targets](#2-performance-targets)
3. [Step 1 — Eliminate Inline Style Objects](#3-step-1--eliminate-inline-style-objects)
4. [Step 2 — Audit and Fix React.memo](#4-step-2--audit-and-fix-reactmemo)
5. [Step 3 — Key Press Animation](#5-step-3--key-press-animation)
6. [Step 4 — Sound Feedback](#6-step-4--sound-feedback)
7. [Step 5 — Input Type Adaptation](#7-step-5--input-type-adaptation)
8. [Step 6 — Number Layout](#8-step-6--number-layout)
9. [Step 7 — Memory-Mapped Trie Loading](#9-step-7--memory-mapped-trie-loading)
10. [Step 8 — Profile IME RAM](#10-step-8--profile-ime-ram)
11. [Step 9 — Profile Keyboard Open Latency](#11-step-9--profile-keyboard-open-latency)
12. [Step 10 — Profile Suggestion Latency](#12-step-10--profile-suggestion-latency)
13. [Updated KickKeyInputMethodService.kt](#13-updated-kickkeyinputmethodservicekt)
14. [Updated KickKeyModule.kt](#14-updated-kickkeymodulekt)
15. [Updated useKeyboardState Hook](#15-updated-usekeyboardstate-hook)
16. [Updated KeyboardScreen.tsx](#16-updated-keyboardscreentsx)
17. [Build & Measure](#17-build--measure)
18. [Verification Checklist](#18-verification-checklist)
19. [Troubleshooting](#19-troubleshooting)

---

## 1. What Changes in Phase 7

### Files to UPDATE

| File | What changes |
|---|---|
| `src/keyboard/Key.tsx` | Add scale-transform press animation; move all inline styles to `StyleSheet.create` |
| `src/keyboard/KeyRow.tsx` | Verify `React.memo` comparator is correct |
| `src/keyboard/SuggestionBar.tsx` | Verify `React.memo` comparator; eliminate any remaining inline styles |
| `src/keyboard/KeyboardScreen.tsx` | Wire `inputType` prop; render `NumberLayout` when type is numeric/phone |
| `src/keyboard/hooks/useKeyboardState.ts` | Add `inputType` state; subscribe to `onInputStarted` event for field-type adaptation |
| `android/.../KickKeyInputMethodService.kt` | Emit `onInputStarted` event with full `EditorInfo` data; add sound effect init |
| `android/.../KickKeyModule.kt` | Add `playKeySound` function |
| `android/.../Trie.kt` | Switch to `MappedByteBuffer` for memory-mapped loading |
| `src/keyboard/layouts/numbers.ts` | New compact number + phone layout |
| `src/keyboard/data/soundManager.ts` | Thin JS wrapper to call `playKeySound` native method |

### Files to CREATE (new)

| File | Purpose |
|---|---|
| `src/keyboard/layouts/numbers.ts` | Compact 3×4 number-pad layout for numeric / phone fields |
| `src/keyboard/data/soundManager.ts` | Optional sound-on-keypress wrapper |

### Files that do NOT change

`BanglaInputEngine.kt`, `SuggestionEngine.kt`, `UserWordModel.kt`, `ClipboardHandler.kt`, `HapticManager.kt`, `KickKeyApplication.kt`, all companion app files (`app/`, `store/`, `hooks/`, `components/`), `EmojiPanel.tsx`, `ClipboardPanel.tsx`, `KeyboardHeader.tsx`, `AltCharsPopup.tsx`, `BottomRow.tsx`, all layout files except the new `numbers.ts`.

---

## 2. Performance Targets

These are the three measurable targets that define "done" for Phase 7. Measure each one before and after each optimisation step.

| Metric | Target | How to Measure |
|---|---|---|
| IME process RAM | < 50MB steady-state | Android Studio Profiler → attach to `com.kickkey:ime_process` → Memory tab |
| Keyboard open latency | < 80ms (after first pre-warm) | `adb logcat -s KickKeyIME` — time between `onStartInputView` log and first React frame |
| Suggestion latency | < 100ms after stopping typing | `adb logcat -s SuggestionEngine` — time from last `onCharacterTyped` to `emitSuggestions` |

### Baseline measurement (do this before any changes)

```bash
# 1. Install the Phase 6 APK on a mid-range device (not flagship)
# 2. Open a text field to warm the keyboard
# 3. Note the RAM, open-latency, and suggestion-latency from logcat
# 4. Apply each step below and re-measure to confirm improvement
```

---

## 3. Step 1 — Eliminate Inline Style Objects

Every `style={{ ... }}` expression inside JSX creates a **new JavaScript object on every render**. In a keyboard that re-renders on every key press, this adds up to hundreds of unnecessary heap allocations per second, increasing GC pressure and jank.

### Rule

Move **every** inline style into `StyleSheet.create`. The only allowed dynamic styles are those whose values change at runtime (e.g., theme colors from `useKeyboardTheme`, key dimensions from preferences). These should be computed once at the hook level and stored in a ref or memo, not computed inline per key.

### Pattern to fix

```tsx
// ❌ BEFORE — creates a new object on every render of every Key
<TouchableOpacity
  style={{
    flex: keyDef.width ?? 1,
    height: theme.keyHeight,
    backgroundColor: isSpecial ? theme.specialKeyBg : theme.keyBg,
    borderRadius: theme.keyBorderRadius,
    marginHorizontal: theme.keyMargin,
    elevation: 2,
    shadowColor: theme.keyShadow,
  }}
>

// ✅ AFTER — static style merged with a single dynamic object that React caches
<TouchableOpacity
  style={[
    styles.key,
    {
      flex: keyDef.width ?? 1,
      height: theme.keyHeight,
      backgroundColor: isSpecial ? theme.specialKeyBg : theme.keyBg,
      borderRadius: theme.keyBorderRadius,
      marginHorizontal: theme.keyMargin,
      shadowColor: theme.keyShadow,
    },
  ]}
>
```

The split above separates truly static styles (border, elevation, padding, position) into `StyleSheet.create` (computed once) from dynamic ones (colors, sizing from user preferences) that must stay as objects. This alone typically reduces render time by 10–20% in heavily repeated components like `Key`.

### Files to audit

Go through every file in `src/keyboard/` and replace every `style={{ ... }}` that contains static values. Priority order:

1. `Key.tsx` — re-renders on every key press across ~30 keys
2. `KeyRow.tsx` — re-renders on every shift/caps change
3. `SuggestionBar.tsx` — re-renders on every typed character
4. `BottomRow.tsx` — re-renders only on language change
5. `KeyboardHeader.tsx` — re-renders only on language/composing change

---

## 4. Step 2 — Audit and Fix React.memo

`React.memo` was applied in Phase 2/3 but the custom comparator must be verified. A wrong comparator can silently disable memoisation (always returning `false`) or suppress necessary re-renders (always returning `true`).

### `Key.tsx` — correct comparator

```tsx
export default React.memo(Key, (prev, next) => {
  // Return true = skip re-render (props are equal)
  // Return false = re-render (props have changed)
  return (
    prev.keyDef     === next.keyDef     &&   // same reference — OK since layout arrays are static
    prev.isShift    === next.isShift    &&
    prev.isCapsLock === next.isCapsLock &&
    prev.theme      === next.theme      &&   // same reference — OK since theme object is stable
    prev.onPress    === next.onPress    &&   // must be stable (useCallback in parent)
    prev.onLongPress    === next.onLongPress &&
    prev.onLongPressEnd === next.onLongPressEnd
  );
});
```

> **Common mistake:** forgetting to compare `onPress`, `onLongPress`, `onLongPressEnd`. If the parent recreates these functions without `useCallback`, `React.memo` never helps — the callbacks are always new references on every render.

### `KeyRow.tsx` — correct comparator

```tsx
export default React.memo(KeyRow, (prev, next) =>
  prev.keys           === next.keys       &&
  prev.isShift        === next.isShift    &&
  prev.isCapsLock     === next.isCapsLock &&
  prev.theme          === next.theme      &&
  prev.onKeyPress         === next.onKeyPress         &&
  prev.onBackspace        === next.onBackspace        &&
  prev.onBackspaceLongPress    === next.onBackspaceLongPress    &&
  prev.onBackspaceLongPressEnd === next.onBackspaceLongPressEnd &&
  prev.onShift            === next.onShift
);
```

### `SuggestionBar.tsx` — correct comparator

```tsx
export default React.memo(SuggestionBar, (prev, next) =>
  prev.suggestions.length === next.suggestions.length &&
  prev.suggestions.every((s, i) => s === next.suggestions[i]) &&
  prev.currentWord === next.currentWord &&
  prev.theme       === next.theme      &&
  prev.onSelect    === next.onSelect
);
```

Avoid `JSON.stringify` in comparators — it is O(n) string allocation on every render check. The every() comparator above is O(n) too but avoids string allocation.

### Confirming memoisation works

```bash
# Enable React DevTools performance overlay or add this to Key.tsx temporarily:
console.log('Key re-render:', keyDef.label);
# If you see this log for keys that didn't change after pressing one key, memo isn't working
```

---

## 5. Step 3 — Key Press Animation

A subtle scale-down + scale-up animation on tap makes the keyboard feel physical and responsive. Use React Native's `Animated` API — it runs on the native thread and does not block JS.

```tsx
// src/keyboard/Key.tsx — replace TouchableOpacity with Animated version

import React, { useCallback, useRef } from 'react';
import {
  Animated,
  TouchableOpacity,
  Text,
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

const PRESS_SCALE = 0.88;       // scale down to 88% on tap
const ANIMATION_DURATION = 80;  // ms — fast enough to feel instant

function Key({
  keyDef, theme, isShift, isCapsLock, onPress, onLongPress, onLongPressEnd,
}: KeyProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const active = isShift || isCapsLock;

  const label = active && keyDef.shiftLabel
    ? keyDef.shiftLabel
    : active && keyDef.code.length === 1
    ? keyDef.code.toUpperCase()
    : keyDef.label;

  const codeToSend = active && keyDef.code.length === 1
    ? keyDef.code.toUpperCase()
    : keyDef.code;

  const effectiveKey: KeyDef = { ...keyDef, code: codeToSend };

  const animatePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: PRESS_SCALE,
        duration: ANIMATION_DURATION / 2,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: ANIMATION_DURATION / 2,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    animatePress();
    onPress(effectiveKey);
  }, [effectiveKey, onPress, animatePress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(keyDef);
  }, [keyDef, onLongPress]);

  const isSpecial = !!keyDef.isSpecial;
  const bgColor = isSpecial ? theme.specialKeyBg : theme.keyBg;
  const textColor = isSpecial ? theme.specialKeyText : theme.keyText;

  return (
    <Animated.View
      style={[
        styles.keyWrapper,
        {
          flex: keyDef.width ?? 1,
          transform: [{ scale }],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.key,
          {
            height: theme.keyHeight,
            backgroundColor: bgColor,
            borderRadius: theme.keyBorderRadius,
            marginHorizontal: theme.keyMargin,
            shadowColor: theme.keyShadow,
          },
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressOut={onLongPressEnd}
        delayLongPress={300}
        activeOpacity={0.75}
      >
        {keyDef.icon === 'shift' && (
          <Text style={[styles.iconText, { color: textColor }]}>
            {isCapsLock ? '⇪' : '⇧'}
          </Text>
        )}
        {keyDef.icon === 'backspace' && (
          <Text style={[styles.iconText, { color: textColor }]}>⌫</Text>
        )}
        {keyDef.icon === 'enter' && (
          <Text style={[styles.iconText, { color: textColor }]}>↵</Text>
        )}
        {!keyDef.icon && (
          <Text
            style={[styles.keyLabel, { color: textColor, fontSize: theme.keyFontSize }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {label}
          </Text>
        )}
        {keyDef.altChars && keyDef.altChars.length > 0 && !keyDef.icon && (
          <Text style={[styles.altHint, { color: theme.altText }]} numberOfLines={1}>
            {keyDef.altChars[0]}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default React.memo(Key, (prev, next) =>
  prev.keyDef         === next.keyDef         &&
  prev.isShift        === next.isShift        &&
  prev.isCapsLock     === next.isCapsLock     &&
  prev.theme          === next.theme          &&
  prev.onPress        === next.onPress        &&
  prev.onLongPress    === next.onLongPress    &&
  prev.onLongPressEnd === next.onLongPressEnd
);

const styles = StyleSheet.create({
  keyWrapper: {
    marginVertical: 4,
  },
  key: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    elevation: 2,
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

## 6. Step 4 — Sound Feedback

Sound feedback is controlled by the `soundEnabled` preference (set in the companion app's Settings screen in Phase 5). When enabled, a short click sound plays alongside the haptic feedback on every key press.

### 6.1 `src/keyboard/data/soundManager.ts`

```typescript
// src/keyboard/data/soundManager.ts

import { NativeModules } from 'react-native';

const { KickKey } = NativeModules;

/**
 * Plays the optional key-click sound.
 * Silently does nothing if sound is disabled (the Kotlin side checks the preference).
 * Called from useKeyboardState.handleKeyPress() alongside hapticManager.vibrate().
 */
export function playKeySound(): void {
  try {
    KickKey.playKeySound();
  } catch {
    // Ignore — sound is optional and should never crash the keyboard
  }
}
```

### 6.2 `KickKeyModule.kt` — `playKeySound` function

```kotlin
// Add inside definition() in KickKeyModule.kt

Function("playKeySound") {
    val context = appContext.reactContext ?: return@Function
    val prefs = context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
    val soundEnabled = prefs.getBoolean("soundEnabled", false)
    if (!soundEnabled) return@Function

    // AudioManager.playSoundEffect is the correct API for IME click sounds.
    // It uses the system sound pool, respects the user's media volume,
    // and has near-zero latency compared to MediaPlayer.
    try {
        val audioManager = context.getSystemService(android.content.Context.AUDIO_SERVICE)
                as android.media.AudioManager
        audioManager.playSoundEffect(android.media.AudioManager.FX_KEYPRESS_STANDARD, -1f)
    } catch (e: Exception) {
        android.util.Log.w("KickKeyModule", "playKeySound failed: ${e.message}")
    }
}
```

### 6.3 Wire into `useKeyboardState`

```typescript
// src/keyboard/hooks/useKeyboardState.ts
// Add this import at the top:
import { playKeySound } from '../data/soundManager';

// Then call it from handleKeyPress, handleBackspace, handleSpace, handleEnter:
const handleKeyPress = useCallback((key: KeyDef) => {
  if (!key.code) return;
  KickKey.commitKey(key.code, language);
  playKeySound();   // ← add this line
  if (language === 'en') {
    setComposing('');
    if (isShift && !isCapsLock) setIsShift(false);
  }
}, [language, isShift, isCapsLock]);

const handleBackspace = useCallback(() => {
  KickKey.sendBackspace();
  playKeySound();   // ← add this line
}, []);

const handleSpace = useCallback(() => {
  KickKey.commitSpace();
  playKeySound();   // ← add this line
  setComposing('');
  if (language === 'en' && isShift && !isCapsLock) setIsShift(false);
}, [language, isShift, isCapsLock]);

const handleEnter = useCallback(() => {
  KickKey.sendEnter();
  playKeySound();   // ← add this line
  setComposing('');
}, []);
```

---

## 7. Step 5 — Input Type Adaptation

Android passes an `inputType` integer in `EditorInfo` when a text field gains focus. KickKey must adapt its layout and behaviour to the field type. The adaptation logic lives in `KickKeyInputMethodService.onStartInputView()` (Kotlin side) and in `useKeyboardState` (TypeScript side).

### 7.1 `inputType` Constants Reference

```kotlin
// Useful EditorInfo.inputType values (combined with bitwise AND):
// Base types:
//   0x00000001 = TYPE_CLASS_TEXT
//   0x00000002 = TYPE_CLASS_NUMBER
//   0x00000003 = TYPE_CLASS_PHONE
//   0x00000004 = TYPE_CLASS_DATETIME
// Text variations (upper 12 bits):
//   0x00000080 = TYPE_TEXT_VARIATION_PASSWORD
//   0x000000E0 = TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
//   0x00000100 = TYPE_TEXT_VARIATION_WEB_EDIT_TEXT
//   0x000000B0 = TYPE_TEXT_VARIATION_WEB_PASSWORD
//   0x00000020 = TYPE_TEXT_VARIATION_URI  (URL field)
//   0x00000050 = TYPE_TEXT_VARIATION_EMAIL_ADDRESS
//   0x00000060 = TYPE_TEXT_VARIATION_EMAIL_SUBJECT
// Number variation:
//   0x00002001 = TYPE_CLASS_NUMBER | TYPE_NUMBER_FLAG_DECIMAL
//   0x00004001 = TYPE_CLASS_NUMBER | TYPE_NUMBER_FLAG_SIGNED

val typeClass = info.inputType and 0x0000000F
val isText        = typeClass == android.view.inputmethod.InputType.TYPE_CLASS_TEXT
val isNumber      = typeClass == android.view.inputmethod.InputType.TYPE_CLASS_NUMBER
val isPhone       = typeClass == android.view.inputmethod.InputType.TYPE_CLASS_PHONE
val isPassword    = (info.inputType and 0x00000080) != 0
val isUrl         = (info.inputType and 0x00000020) != 0
val isEmail       = (info.inputType and 0x00000050) != 0 // actually 0x50 = TYPE_TEXT_VARIATION_EMAIL_ADDRESS
```

### 7.2 Updated `onStartInputView` — emit full field info

Update `KickKeyInputMethodService.onStartInputView()` to emit an `onInputStarted` event with all the information the TypeScript side needs:

```kotlin
// android/app/src/main/java/com/kickkey/KickKeyInputMethodService.kt
// Updated onStartInputView() only — everything else from Phase 6 stays

override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
    super.onStartInputView(info, restarting)
    KickKeyModule.activeInputConnection = currentInputConnection
    KickKeyModule.banglaEngine?.reset()
    KickKeyModule.suggestionEngine?.reset()

    if (!restarting) {
        KickKeyModule.clipboardHandler?.captureCurrentClipboard()
    }

    val typeClass = info.inputType and 0x0000000F
    val isPassword = (info.inputType and 0x000000D0) != 0   // covers all password variations
    val isNumber   = typeClass == 0x00000002
    val isPhone    = typeClass == 0x00000003
    val isUrl      = (info.inputType and 0x000000F0) == 0x00000020
    val isEmail    = (info.inputType and 0x000000F0) == 0x00000050

    KickKeyModule.suggestionEngine?.setEnabled(!isPassword)

    // Emit input context to React Native so the keyboard can adapt its layout
    try {
        val app = application as? KickKeyApplication ?: return
        val reactContext = app.keyboardReactHost.currentReactContext ?: return
        val params = com.facebook.react.bridge.Arguments.createMap()
        params.putInt("inputType", info.inputType)
        params.putBoolean("isPassword", isPassword)
        params.putBoolean("isNumber",   isNumber)
        params.putBoolean("isPhone",    isPhone)
        params.putBoolean("isUrl",      isUrl)
        params.putBoolean("isEmail",    isEmail)
        params.putString("imeAction",   when (info.imeOptions and EditorInfo.IME_MASK_ACTION) {
            EditorInfo.IME_ACTION_SEARCH -> "search"
            EditorInfo.IME_ACTION_SEND   -> "send"
            EditorInfo.IME_ACTION_DONE   -> "done"
            EditorInfo.IME_ACTION_NEXT   -> "next"
            EditorInfo.IME_ACTION_GO     -> "go"
            else                         -> "return"
        })
        reactContext
            .getJSModule(com.facebook.react.bridge.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("onInputStarted", params)
    } catch (e: Exception) {
        android.util.Log.w("KickKeyIME", "onInputStarted emit failed: ${e.message}")
    }

    Log.i("KickKeyIME", "InputConnection acquired — inputType: ${info.inputType} isPassword=$isPassword isNumber=$isNumber isPhone=$isPhone")
}
```

---

## 8. Step 6 — Number Layout

A compact number-pad layout shown when the text field is `TYPE_CLASS_NUMBER` or `TYPE_CLASS_PHONE`. For phone fields, show a standard 1–9 + `*` `0` `#` dial pad. For number fields, show 1–9 + `.` `0` `⌫`.

```typescript
// src/keyboard/layouts/numbers.ts
import type { KeyDef } from '../types';

/** Compact number layout for TYPE_CLASS_NUMBER fields */
export const NUMBER_ROWS: KeyDef[][] = [
  [
    { label: '1', code: '1', altChars: ['!'] },
    { label: '2', code: '2', altChars: ['@'] },
    { label: '3', code: '3', altChars: ['#'] },
  ],
  [
    { label: '4', code: '4' },
    { label: '5', code: '5', altChars: ['%'] },
    { label: '6', code: '6' },
  ],
  [
    { label: '7', code: '7', altChars: ['&'] },
    { label: '8', code: '8', altChars: ['*'] },
    { label: '9', code: '9' },
  ],
  [
    { label: '.', code: '.', altChars: [',', '-'] },
    { label: '0', code: '0' },
    { label: '⌫', code: '', action: 'backspace', isSpecial: true, icon: 'backspace' },
  ],
];

/** Phone dial-pad layout for TYPE_CLASS_PHONE fields */
export const PHONE_ROWS: KeyDef[][] = [
  [
    { label: '1', code: '1' },
    { label: '2', code: '2' },
    { label: '3', code: '3' },
  ],
  [
    { label: '4', code: '4' },
    { label: '5', code: '5' },
    { label: '6', code: '6' },
  ],
  [
    { label: '7', code: '7' },
    { label: '8', code: '8' },
    { label: '9', code: '9' },
  ],
  [
    { label: '*',  code: '*' },
    { label: '0',  code: '0', altChars: ['+'] },
    { label: '#',  code: '#' },
  ],
  [
    { label: '⌫', code: '', action: 'backspace', isSpecial: true, icon: 'backspace', width: 3 },
  ],
];
```

Add to `src/keyboard/layouts/index.ts`:

```typescript
export { ENGLISH_ROWS } from './english';
export { SYMBOL_ROWS }  from './symbols';
export { BANGLA_ROWS }  from './bangla';
export { NUMBER_ROWS, PHONE_ROWS } from './numbers';   // ← NEW Phase 7
```

---

## 9. Step 7 — Memory-Mapped Trie Loading

The current `Trie.fromStream()` reads the entire binary file into a heap-allocated `ByteArray`, then wraps it in a `ByteBuffer`. For a 50k-word English dictionary this can be 3–6MB of heap allocation that stays live for the entire IME session.

Memory-mapping instead lets the OS back the buffer with a file-descriptor page cache — the Trie data is never fully copied into the Java heap unless actually accessed, and can be evicted by the OS under memory pressure.

```kotlin
// android/app/src/main/java/com/kickkey/Trie.kt
// Replace the fromStream() companion method with fromAsset()

companion object {
    private const val MAGIC = 0x54524945.toInt()
    private const val NODE_SIZE = 20
    private const val HEADER_SIZE = 12

    /**
     * Load a Trie from an Android asset file using a memory-mapped buffer.
     *
     * Unlike fromStream() which loads the entire file into a byte array,
     * this uses FileChannel.map() to create a MappedByteBuffer — the OS
     * backs the buffer with its page cache and the data is only loaded into
     * physical RAM as it is accessed, up to the OS's eviction policy.
     *
     * Result: ~2–4MB less heap usage in the :ime_process.
     */
    fun fromAsset(context: android.content.Context, assetPath: String): Trie {
        // Copy asset to a temp file — AssetManager doesn't expose a FileDescriptor
        // directly for memory mapping, so we copy once and memory-map the copy.
        val cacheFile = java.io.File(context.cacheDir, assetPath.replace("/", "_"))
        if (!cacheFile.exists() || cacheFile.length() == 0L) {
            context.assets.open(assetPath).use { input ->
                cacheFile.parentFile?.mkdirs()
                java.io.FileOutputStream(cacheFile).use { output ->
                    input.copyTo(output)
                }
            }
        }
        val channel = java.io.RandomAccessFile(cacheFile, "r").channel
        val buf = channel.map(
            java.nio.channels.FileChannel.MapMode.READ_ONLY,
            0,
            channel.size()
        ).order(java.nio.ByteOrder.BIG_ENDIAN)
        channel.close()

        val magic = buf.getInt(0)
        require(magic == MAGIC) { "Invalid Trie file: bad magic 0x${magic.toString(16)}" }
        return Trie(buf)
    }

    // Keep fromStream() for unit tests (no Android Context available in unit test environment)
    fun fromStream(stream: java.io.InputStream): Trie {
        val bytes = stream.readBytes()
        val buf = java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.BIG_ENDIAN)
        val magic = buf.getInt(0)
        require(magic == MAGIC) { "Invalid Trie file: bad magic 0x${magic.toString(16)}" }
        return Trie(buf)
    }
}
```

Update `SuggestionEngine.kt` to use `fromAsset()`:

```kotlin
// In SuggestionEngine.kt — update loadDictionary()
private fun loadDictionary(assetPath: String): Trie {
    return Trie.fromAsset(context, assetPath)   // ← was: context.assets.open(assetPath).use { Trie.fromStream(it) }
}
```

---

## 10. Step 8 — Profile IME RAM

### 10.1 How to measure

```bash
# 1. Install the APK on a physical device
# 2. Open any app with a text field
# 3. Tap the text field to open the keyboard
# 4. Wait 10 seconds for initialization to settle
# 5. Run:
adb shell dumpsys meminfo com.kickkey:ime_process

# Key fields to look at:
# TOTAL PSS — total physical memory used by the process
# Java Heap — heap allocations from the JVM and JS engine
# Native Heap — native allocations (Hermes runtime, Trie buffers)
```

Expected PSS breakdown for a well-tuned Phase 7 build:

| Component | Target |
|---|---|
| Hermes runtime | ~12–16MB |
| keyboard.bundle parsed JS | ~3–5MB |
| Trie data (memory-mapped, not heap) | ~1–2MB |
| React Native rendering layer | ~4–6MB |
| Misc native libs | ~5–8MB |
| **Total target** | **< 45MB** |

### 10.2 If RAM is above 50MB

Work through this checklist in order:

1. **Verify memory-mapped Trie is active.** Check `adb logcat -s SuggestionEngine` — if you see "Trie loaded" but also a very large Java heap in `dumpsys meminfo`, the old `fromStream()` path is still being used. Check `loadDictionary()` in `SuggestionEngine.kt`.

2. **Check for SuggestionEngine leak.** The background thread in `computeAndEmit()` holds a reference to the `KickKeyApplication` context. Confirm `SuggestionEngine` is set to `null` in `KickKeyInputMethodService.onDestroy()`.

3. **Reduce `keyboard.bundle` size.** Run:
   ```bash
   npx react-native bundle \
     --entry-file keyboard.index.js \
     --bundle-output /tmp/keyboard.bundle \
     --platform android \
     --minify true \
     --reset-cache
   ls -lh /tmp/keyboard.bundle
   ```
   If the bundle is > 5MB, check for accidental large imports (e.g., importing from the companion app, loading all emoji as Unicode escape sequences instead of raw characters).

4. **Profile with Android Studio.** Open Android Studio → Profiler → attach to `com.kickkey:ime_process` → take a Heap Dump → sort by "Retained Size" to find the biggest allocations.

---

## 11. Step 9 — Profile Keyboard Open Latency

### 11.1 How to measure

```bash
# Enable detailed timing logs
adb logcat -s KickKeyIME KickKeyApplication ReactNativeJS

# Then focus a text field
# Look for:
# I/KickKeyApplication: Keyboard ReactHost pre-warm complete
# I/KickKeyIME: onCreateInputView called
# I/KickKeyIME: ReactRootView started
# (first React frame log — appears in ReactNativeJS)
```

The gap between "onCreateInputView called" and the first visible frame is your open latency. Target: < 80ms after the pre-warm has completed.

### 11.2 If open latency is > 80ms

**Root cause 1: Pre-warm not completing before first use.**

The pre-warm thread in `KickKeyApplication.initKeyboardRuntime()` calls `keyboardReactHost.start()`. If this hasn't finished by the time the user taps their first ever text field, `onCreateInputView` blocks waiting for it. Solution: on cold app start, pre-warm happens in the background thread — this is expected on very first launch. Subsequent keyboard opens (after the pre-warm completes) should be < 80ms.

**Root cause 2: Large initial render in `KeyboardScreen.tsx`.**

If `KeyboardScreen` renders too many components on mount (e.g., all 8 emoji categories, or the full suggestion history), the first frame is slow. Ensure `EmojiPanel` and `ClipboardPanel` are NOT mounted until the user actually opens them — they should be conditionally rendered, not pre-rendered offscreen.

**Root cause 3: `useKeyboardTheme` triggering a second render.**

`getPreferences()` is async — on mount it sets initial state (default theme), then updates it after the async call returns, causing a second render. This is expected but the second render can be perceived as a flash. Mitigation: pre-cache the preferences in a native singleton on startup so `getPreferences()` can be synchronous:

```kotlin
// KickKeyModule.kt — add a synchronous version for first-render use
Function("getPreferencesSync") {
    // Same as getPreferences() but return directly (already on JS thread via bridge)
    // This avoids the async microtask delay
    val context = appContext.reactContext ?: return@Function emptyMap<String, Any>()
    val prefs = context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
    mapOf(/* ... same as getPreferences ... */)
}
```

Then in `useKeyboardTheme.ts`, call `getPreferencesSync()` (a synchronous bridge call) on first render, avoiding the async round-trip and second re-render.

---

## 12. Step 10 — Profile Suggestion Latency

### 12.1 How to measure

```bash
adb logcat -s SuggestionEngine

# Expected:
# D/SuggestionEngine: prefix="hel" → ["hello","help","held"]

# Measure the time between the last key press and the logcat line.
# Target: < 100ms including the 50ms debounce.
# Actual computation should take < 50ms.
```

### 12.2 Tune the debounce

The 50ms debounce in `SuggestionEngine.kt` is appropriate for normal typing speeds. If users report that suggestions feel "late", reduce to 30ms. If the Trie search causes ANR-like stalls on low-end devices, increase to 80ms.

```kotlin
// In SuggestionEngine.kt
private const val DEBOUNCE_MS = 50L   // tune between 30–80ms
```

### 12.3 If Trie search takes > 50ms

Add timing instrumentation:

```kotlin
private fun computeAndEmit() {
    val start = System.currentTimeMillis()
    val ic = KickKeyModule.activeInputConnection ?: return
    // ... existing code ...
    val elapsed = System.currentTimeMillis() - start
    Log.d(TAG, "Trie search took ${elapsed}ms for prefix='$currentWord'")
}
```

If search consistently takes > 30ms, the Trie is too large. Consider:
1. Trimming the word list to the 30,000 most-common words (covers ~99% of normal usage)
2. Splitting the Trie into a "fast Trie" (top 5,000 words, loaded eagerly) and a "slow Trie" (full list, loaded lazily)

---

## 13. Updated `KickKeyInputMethodService.kt`

This is the full replacement incorporating the Phase 7 additions (detailed `onInputStarted` event, clipboard capture skip on restart, sound init).

```kotlin
// android/app/src/main/java/com/kickkey/KickKeyInputMethodService.kt
// Full replacement

package com.kickkey

import android.inputmethodservice.InputMethodService
import android.util.Log
import android.view.View
import android.view.inputmethod.EditorInfo
import com.facebook.react.ReactRootView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.DeviceEventManagerModule

class KickKeyInputMethodService : InputMethodService() {

    companion object {
        private const val TAG = "KickKeyIME"
    }

    private var reactRootView: ReactRootView? = null

    override fun onCreate() {
        super.onCreate()
        KickKeyModule.hapticManager     = HapticManager(this)
        KickKeyModule.banglaEngine      = BanglaInputEngine()
        KickKeyModule.suggestionEngine  = SuggestionEngine(this)
        KickKeyModule.clipboardHandler  = ClipboardHandler(this)
        Log.i(TAG, "IME created — all handlers ready")
    }

    override fun onCreateInputView(): View {
        Log.i(TAG, "onCreateInputView")
        val app = application as? KickKeyApplication ?: run {
            Log.e(TAG, "KickKeyApplication not found"); return View(this)
        }
        reactRootView = ReactRootView(this)
        reactRootView!!.startReactApplication(app.keyboardReactHost, "KickKeyKeyboard", null)
        return reactRootView!!
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        KickKeyModule.activeInputConnection = currentInputConnection
        KickKeyModule.banglaEngine?.reset()
        KickKeyModule.suggestionEngine?.reset()

        val typeClass  = info.inputType and 0x0000000F
        val isPassword = (info.inputType and 0x000000D0) != 0
        val isNumber   = typeClass == 0x00000002
        val isPhone    = typeClass == 0x00000003
        val isUrl      = (info.inputType and 0x000000F0) == 0x00000020
        val isEmail    = (info.inputType and 0x000000F0) == 0x00000050

        KickKeyModule.suggestionEngine?.setEnabled(!isPassword)

        // Capture clipboard only on a fresh focus, not on keyboard re-show
        if (!isPassword && !restarting) {
            KickKeyModule.clipboardHandler?.captureCurrentClipboard()
        }

        // Emit input field context to React Native
        emitInputStarted(info, isPassword, isNumber, isPhone, isUrl, isEmail)

        Log.i(TAG, "InputStarted — class=$typeClass password=$isPassword number=$isNumber phone=$isPhone url=$isUrl")
    }

    private fun emitInputStarted(
        info: EditorInfo,
        isPassword: Boolean, isNumber: Boolean, isPhone: Boolean,
        isUrl: Boolean, isEmail: Boolean,
    ) {
        try {
            val app = application as? KickKeyApplication ?: return
            val reactContext = app.keyboardReactHost.currentReactContext ?: return
            val imeAction = when (info.imeOptions and EditorInfo.IME_MASK_ACTION) {
                EditorInfo.IME_ACTION_SEARCH -> "search"
                EditorInfo.IME_ACTION_SEND   -> "send"
                EditorInfo.IME_ACTION_DONE   -> "done"
                EditorInfo.IME_ACTION_NEXT   -> "next"
                EditorInfo.IME_ACTION_GO     -> "go"
                else                         -> "return"
            }
            val params = Arguments.createMap().apply {
                putInt("inputType", info.inputType)
                putBoolean("isPassword", isPassword)
                putBoolean("isNumber",   isNumber)
                putBoolean("isPhone",    isPhone)
                putBoolean("isUrl",      isUrl)
                putBoolean("isEmail",    isEmail)
                putString("imeAction",   imeAction)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onInputStarted", params)
        } catch (e: Exception) {
            Log.w(TAG, "emitInputStarted failed: ${e.message}")
        }
    }

    override fun onFinishInput() {
        super.onFinishInput()
        val pending = KickKeyModule.banglaEngine?.flush() ?: ""
        if (pending.isNotEmpty()) KickKeyModule.activeInputConnection?.commitText(pending, 1)
        KickKeyModule.activeInputConnection = null
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        KickKeyModule.activeInputConnection = null
        KickKeyModule.banglaEngine?.reset()
        KickKeyModule.suggestionEngine?.reset()
    }

    override fun onDestroy() {
        reactRootView?.unmountReactApplication()
        reactRootView = null
        KickKeyModule.hapticManager    = null
        KickKeyModule.banglaEngine     = null
        KickKeyModule.suggestionEngine = null
        KickKeyModule.clipboardHandler = null
        super.onDestroy()
        Log.i(TAG, "IME destroyed")
    }
}
```

---

## 14. Updated `KickKeyModule.kt`

Only the new Phase 7 addition — `playKeySound`. Everything from Phases 1–6 remains unchanged.

```kotlin
// Add inside definition() in KickKeyModule.kt — Phase 7 only

// ── NEW Phase 7: Sound feedback ────────────────────────────────────────────────

Function("playKeySound") {
    val context = appContext.reactContext ?: return@Function
    val soundEnabled = context
        .getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
        .getBoolean("soundEnabled", false)
    if (!soundEnabled) return@Function
    try {
        val am = context.getSystemService(android.content.Context.AUDIO_SERVICE)
                as android.media.AudioManager
        am.playSoundEffect(android.media.AudioManager.FX_KEYPRESS_STANDARD, -1f)
    } catch (e: Exception) {
        android.util.Log.w("KickKeyModule", "Sound effect failed: ${e.message}")
    }
}
```

---

## 15. Updated `useKeyboardState` Hook

Phase 7 adds `inputType` state fields populated by the enhanced `onInputStarted` event.

```typescript
// src/keyboard/hooks/useKeyboardState.ts
// ADDITIONS ONLY — merge into the Phase 6 file

// Add to state:
const [isPassword,  setIsPassword]  = useState(false);
const [isNumber,    setIsNumber]    = useState(false);
const [isPhone,     setIsPhone]     = useState(false);
const [isUrl,       setIsUrl]       = useState(false);
const [imeAction,   setImeAction]   = useState<string>('return');

// Update the onInputStarted listener (Phase 4 already has a basic one):
const subInput = emitter.addListener('onInputStarted', (data) => {
  setIsPassword(data.isPassword ?? false);
  setIsNumber(data.isNumber   ?? false);
  setIsPhone(data.isPhone     ?? false);
  setIsUrl(data.isUrl         ?? false);
  setImeAction(data.imeAction ?? 'return');

  // Existing Phase 4 behaviour:
  if (data.isPassword) setSuggestions([]);
  setIsSymbol(false);
  setIsEmoji(false);
  setIsClipboard(false);
  setComposing('');
});

// Add to returned state object:
return {
  // ... all existing fields ...
  isPassword, isNumber, isPhone, isUrl, imeAction,
  // ...
};

// Also update the KeyboardState interface:
export interface KeyboardState {
  // ... existing ...
  isPassword: boolean;
  isNumber:   boolean;
  isPhone:    boolean;
  isUrl:      boolean;
  imeAction:  string;
}
```

---

## 16. Updated `KeyboardScreen.tsx`

Wire the new input-type state into layout selection and Enter key label.

```tsx
// src/keyboard/KeyboardScreen.tsx
// ADDITIONS to the existing Phase 6 file — only the changed JSX sections shown

import { ENGLISH_ROWS, BANGLA_ROWS, SYMBOL_ROWS, NUMBER_ROWS, PHONE_ROWS } from './layouts';

export default function KeyboardScreen() {
  const theme = useKeyboardTheme();
  const {
    language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard,
    suggestions, composingText, currentWord,
    isPassword, isNumber, isPhone, isUrl, imeAction,   // ← Phase 7 additions
    handleKeyPress, handleBackspace, handleBackspaceLongPress,
    handleSpace, handleEnter, handleShift, handleLanguageSwitch,
    handleSymbolToggle, handleEmojiToggle, handleClipboardToggle,
    handleSuggestionSelect,
  } = useKeyboardState();

  // Phase 7: pick the active row set based on input type
  const rows = (() => {
    if (isPhone)  return PHONE_ROWS;
    if (isNumber) return NUMBER_ROWS;
    if (isSymbol) return SYMBOL_ROWS;
    if (language === 'bn') return BANGLA_ROWS;
    return ENGLISH_ROWS;
  })();

  // ... emoji / clipboard panels unchanged from Phase 6 ...

  return (
    <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
      <KeyboardHeader language={language} theme={theme} composingText={composingText} />

      {/* Phase 7: hide suggestions in password fields or when disabled */}
      {!isPassword && (
        <SuggestionBar
          suggestions={suggestions}
          currentWord={currentWord}
          onSelect={handleSuggestionSelect}
          theme={theme}
        />
      )}

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
          onBackspaceLongPressEnd={() => {}}
          onShift={handleShift}
        />
      ))}

      {/* Phase 7: pass imeAction so BottomRow can label the Enter key appropriately */}
      <BottomRow
        theme={theme}
        language={language}
        isSymbol={isSymbol}
        imeAction={imeAction}           // ← Phase 7 addition
        onSpace={handleSpace}
        onEnter={handleEnter}
        onLanguageSwitch={handleLanguageSwitch}
        onSymbolToggle={handleSymbolToggle}
        onEmojiToggle={handleEmojiToggle}
        onClipboardToggle={handleClipboardToggle}
      />
    </View>
  );
}
```

### 16.1 Update `BottomRow.tsx` — dynamic Enter key label

```tsx
// In BottomRow.tsx — add imeAction prop and use it on the Enter button

interface BottomRowProps {
  // ... existing props ...
  imeAction: string;   // ← NEW Phase 7
}

// In the Enter button:
<TouchableOpacity style={[styles.key, special, { flex: 1.3 }]} onPress={onEnter} activeOpacity={0.55}>
  <Text style={[styles.label, { color: theme.specialKeyText, fontSize: imeAction === 'return' ? 18 : 11 }]}>
    {imeAction === 'search' ? '🔍'
      : imeAction === 'send'   ? '➤'
      : imeAction === 'done'   ? '✓'
      : imeAction === 'next'   ? '→'
      : imeAction === 'go'     ? 'Go'
      : '↵'}
  </Text>
</TouchableOpacity>
```

---

## 17. Build & Measure

### 17.1 Build

```bash
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify true        # use true for production-quality measurement

cd android && ./gradlew assembleRelease   # release build for accurate RAM profiling
adb install -r app/build/outputs/apk/release/app-release-unsigned.apk
```

> For RAM profiling, always measure a **release build** — debug builds carry significant overhead from the Metro dev server connection and JS profiling hooks that inflates RAM by 10–20MB.

### 17.2 RAM baseline check

```bash
adb shell dumpsys meminfo com.kickkey:ime_process | grep -E "TOTAL|Java Heap|Native Heap"
```

### 17.3 Open latency

```bash
adb logcat -s KickKeyIME | grep -E "onCreateInputView|ReactRootView started"
# Tap a text field, note the timestamp delta between these two lines
```

### 17.4 Suggestion latency

```bash
adb logcat -s SuggestionEngine
# Type "hel" and note the time from last key to the suggestions log line
```

---

## 18. Verification Checklist

### React.memo and Inline Styles

- [ ] No `style={{ ... }}` with static values remains in any file in `src/keyboard/`
- [ ] `console.log('Key re-render')` added temporarily to `Key.tsx` shows only the keys that actually changed (e.g., only caps-lock shift keys re-render on Shift tap, not all 30 keys)
- [ ] Same test for `KeyRow.tsx` — only the affected rows re-render
- [ ] `SuggestionBar` re-renders only when `suggestions` or `currentWord` changes, not on every keypress that doesn't change suggestions

### Key Press Animation

- [ ] Every key visually scales down slightly (to ~88%) on press and springs back on release
- [ ] Animation runs smoothly with no dropped frames during rapid typing
- [ ] Animation does not add perceptible latency to the actual character commit (character appears before animation completes — they run in parallel)

### Sound Feedback

- [ ] Turning on "Key Sounds" in the companion app Settings and then typing produces an audible click on every key
- [ ] Turning off "Key Sounds" produces no sound
- [ ] Sound preference persists across keyboard reopen
- [ ] Sound follows system volume (AudioManager handles this automatically)

### Input Type Adaptation

- [ ] Tapping a password field: suggestion bar is hidden
- [ ] Tapping a `TYPE_CLASS_NUMBER` field: number-pad layout (1–9 + `.` + `0` + backspace) appears
- [ ] Tapping a `TYPE_CLASS_PHONE` field: dial-pad layout (1–9 + `*` + `0` + `#`) appears
- [ ] Tapping a normal text field: QWERTY layout appears (unchanged)
- [ ] Enter key label changes: search field shows 🔍, send button shows ➤, "done" shows ✓, normal field shows ↵
- [ ] Switching from a number field back to a text field restores the QWERTY layout correctly

### Performance Targets

- [ ] `adb shell dumpsys meminfo com.kickkey:ime_process` — TOTAL PSS < 50MB (release build, keyboard open)
- [ ] Keyboard open latency (log delta between `onCreateInputView` and first frame) < 80ms on a mid-range device after first pre-warm
- [ ] Suggestion latency < 100ms end-to-end (including 50ms debounce) for 3-letter English prefixes
- [ ] No ANR (Application Not Responding) dialog on any test device during normal typing

---

## 19. Troubleshooting

### All keys still re-render after adding React.memo

**Cause:** The callback functions (`onPress`, `onLongPress`, `onLongPressEnd`) passed from `KeyRow` to `Key` are being recreated on every `KeyRow` render, making every `Key`'s prop comparison fail.

**Fix:** Ensure every callback in `KeyRow` that is passed down to `Key` is wrapped with `useCallback`:
```typescript
const handleKeyPress = useCallback((key: KeyDef) => { ... }, [onKeyPress, onBackspace, onShift]);
const handleLongPress = useCallback((key: KeyDef) => { ... }, [onBackspaceLongPress]);
```

---

### Key press animation causes visible lag (character commits late)

**Cause:** `animatePress()` is called before `onPress(effectiveKey)` in sequence, so the animation must complete before the commit fires.

**Fix:** Call `onPress` and `animatePress` in parallel, not in sequence:
```typescript
const handlePress = useCallback(() => {
  onPress(effectiveKey);    // commit immediately
  animatePress();           // animate in parallel — don't await
}, [effectiveKey, onPress, animatePress]);
```

---

### Number layout appears in a normal text field

**Cause:** `isNumber` state is `true` when it should be `false` — the `onInputStarted` event from Kotlin is sending incorrect `isNumber` value.

**Check:**
```bash
adb logcat -s KickKeyIME | grep "InputStarted"
# Verify the number= field matches what you expect for the field type
```
The most common false positive: some search bars and address bars use `TYPE_CLASS_TEXT` with `TYPE_TEXT_VARIATION_URI` — these should show QWERTY, not the number pad. Verify the type-class extraction:
```kotlin
val typeClass = info.inputType and 0x0000000F   // isolate the 4 lowest bits
val isNumber  = typeClass == 0x00000002          // TYPE_CLASS_NUMBER only
```

---

### `MappedByteBuffer` approach causes "file not found" on cache dir

**Cause:** The cache directory path changes between app version installs, or the cache was cleared by the user.

**Fix:** The `fromAsset()` implementation already handles this — it checks `cacheFile.exists()` and re-copies from assets if missing. Ensure the temp file creation code runs without throwing by adding a try-catch around the entire block:
```kotlin
try {
    if (!cacheFile.exists() || cacheFile.length() == 0L) { ... }
} catch (e: Exception) {
    // Fall back to the in-memory fromStream() approach
    return fromStream(context.assets.open(assetPath))
}
```

---

### `playKeySound` works once then goes silent

**Cause:** `AudioManager.playSoundEffect` requires the system sound pool to be loaded, which can fail on very first call and then work thereafter. Some devices also have audio focus requirements.

**Fix:** Wrap the call in a try-catch (already done), and consider calling `AudioManager.loadSoundEffects()` once in `KickKeyInputMethodService.onCreate()` to pre-load the sound pool:
```kotlin
override fun onCreate() {
    super.onCreate()
    // ... existing init ...
    try {
        (getSystemService(AUDIO_SERVICE) as android.media.AudioManager).loadSoundEffects()
    } catch (e: Exception) {
        android.util.Log.w(TAG, "Sound pool preload failed: ${e.message}")
    }
}
```

---

*Phase 7 complete. Proceed to Phase 8 — Testing & Release — to write unit tests, test on physical devices (Samsung/Xiaomi/Pixel), prepare the Play Store listing, and submit KickKey to Google Play.*
