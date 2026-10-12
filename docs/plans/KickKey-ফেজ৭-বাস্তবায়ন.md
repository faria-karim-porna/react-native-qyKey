# KickKey — ফেজ ৭ বাস্তবায়ন গাইড
## পালিশ ও পারফরম্যান্স (সপ্তাহ ১৩–১৪)

> **লক্ষ্য:** প্রোডাকশন-মানের অনুভূতি ও পারফরম্যান্স। প্রতিটি কী প্রেস তাৎক্ষণিক ও সন্তোষজনক লাগবে, `:ime_process`-এ RAM ৫০MB-এর নিচে থাকবে, কীবোর্ড ৮০ms-এর মধ্যে খুলবে (প্রথম প্রি-ওয়ার্মের পরে), এবং সাজেশন ১০০ms-এর মধ্যে দেখা যাবে। কীবোর্ড বিভিন্ন টেক্সট ফিল্ড টাইপে সঠিকভাবে মানিয়ে নেবে — পাসওয়ার্ড ফিল্ডে সাজেশন লুকাবে, শুধুমাত্র-নম্বর ফিল্ডে একটি কম্প্যাক্ট নম্বর গ্রিড দেখাবে, এবং URL ফিল্ডে `.com` দ্রুত-ইনসার্ট সক্রিয় করবে।
> **ফেজ ৬-এর উপর নির্মিত** — সমস্ত ফিচার বাস্তবায়িত। ফেজ ৭ নতুন ব্যবহারকারী-দৃশ্যমান ফিচার যোগ করে না; বিদ্যমান যা আছে তা অপ্টিমাইজ ও পালিশ করে।

---

## বিষয়সূচি

1. [ফেজ ৭-এ কী পরিবর্তন হয়](#1-ফেজ-৭-তে-কী-পরিবর্তন-হয়)
2. [পারফরম্যান্স লক্ষ্যমাত্রা](#2-পারফরম্যান্স-লক্ষ্যমাত্রা)
3. [ধাপ ১ — ইনলাইন স্টাইল অবজেক্ট দূর করুন](#3-ধাপ-১--ইনলাইন-স্টাইল-অবজেক্ট-দূর-করুন)
4. [ধাপ ২ — React.memo নিরীক্ষা ও ঠিক করুন](#4-ধাপ-২--reactmemo-নিরীক্ষা-ও-ঠিক-করুন)
5. [ধাপ ৩ — কী প্রেস অ্যানিমেশন](#5-ধাপ-৩--কী-প্রেস-অ্যানিমেশন)
6. [ধাপ ৪ — সাউন্ড ফিডব্যাক](#6-ধাপ-৪--সাউন্ড-ফিডব্যাক)
7. [ধাপ ৫ — ইনপুট টাইপ অভিযোজন](#7-ধাপ-৫--ইনপুট-টাইপ-অভিযোজন)
8. [ধাপ ৬ — নম্বর লেআউট](#8-ধাপ-৬--নম্বর-লেআউট)
9. [ধাপ ৭ — মেমরি-ম্যাপড Trie লোডিং](#9-ধাপ-৭--মেমরি-ম্যাপড-trie-লোডিং)
10. [ধাপ ৮ — IME RAM প্রোফাইল করুন](#10-ধাপ-৮--ime-ram-প্রোফাইল-করুন)
11. [ধাপ ৯ — কীবোর্ড খোলার লেটেন্সি প্রোফাইল করুন](#11-ধাপ-৯--কীবোর্ড-খোলার-লেটেন্সি-প্রোফাইল-করুন)
12. [ধাপ ১০ — সাজেশন লেটেন্সি প্রোফাইল করুন](#12-ধাপ-১০--সাজেশন-লেটেন্সি-প্রোফাইল-করুন)
13. [আপডেটেড KickKeyInputMethodService.kt](#13-আপডেটেড-kickkeyinputmethodservicekt)
14. [আপডেটেড KickKeyModule.kt](#14-আপডেটেড-kickkeymodulekt)
15. [আপডেটেড useKeyboardState হুক](#15-আপডেটেড-usekeyboardstate-হুক)
16. [আপডেটেড KeyboardScreen.tsx](#16-আপডেটেড-keyboardscreentsx)
17. [বিল্ড ও পরিমাপ](#17-বিল্ড-ও-পরিমাপ)
18. [যাচাই চেকলিস্ট](#18-যাচাই-চেকলিস্ট)
19. [সমস্যা সমাধান](#19-সমস্যা-সমাধান)

---

## 1. ফেজ ৭-তে কী পরিবর্তন হয়

### আপডেট করতে হবে

| ফাইল | কী পরিবর্তন হয় |
|---|---|
| `src/keyboard/Key.tsx` | স্কেল-ট্রান্সফর্ম প্রেস অ্যানিমেশন যোগ; সমস্ত ইনলাইন স্টাইল `StyleSheet.create`-এ সরান |
| `src/keyboard/KeyRow.tsx` | `React.memo` কম্পারেটর সঠিক কিনা যাচাই করুন |
| `src/keyboard/SuggestionBar.tsx` | `React.memo` কম্পারেটর যাচাই; অবশিষ্ট ইনলাইন স্টাইল দূর করুন |
| `src/keyboard/KeyboardScreen.tsx` | `inputType` প্রপ ওয়্যার করুন; নিউমেরিক/ফোনের জন্য `NumberLayout` রেন্ডার করুন |
| `src/keyboard/hooks/useKeyboardState.ts` | `inputType` স্টেট যোগ; ফিল্ড-টাইপ অভিযোজনের জন্য `onInputStarted` ইভেন্টে সাবস্ক্রাইব করুন |
| `android/.../KickKeyInputMethodService.kt` | সম্পূর্ণ `EditorInfo` ডেটা সহ `onInputStarted` ইভেন্ট এমিট করুন; সাউন্ড ইফেক্ট ইনিট যোগ |
| `android/.../KickKeyModule.kt` | `playKeySound` ফাংশন যোগ |
| `android/.../Trie.kt` | মেমরি-ম্যাপড লোডিংয়ের জন্য `MappedByteBuffer`-এ সুইচ করুন |
| `src/keyboard/layouts/numbers.ts` | নিউমেরিক / ফোন ফিল্ডের জন্য কম্প্যাক্ট নম্বর-প্যাড লেআউট |
| `src/keyboard/data/soundManager.ts` | `playKeySound` নেটিভ মেথড কল করার পাতলা JS র‍্যাপার |

### তৈরি করতে হবে (নতুন ফাইল)

| ফাইল | উদ্দেশ্য |
|---|---|
| `src/keyboard/layouts/numbers.ts` | নিউমেরিক / ফোন ফিল্ডের জন্য কম্প্যাক্ট ৩×৪ নম্বর-প্যাড লেআউট |
| `src/keyboard/data/soundManager.ts` | ঐচ্ছিক কী-প্রেস সাউন্ড র‍্যাপার |

### পরিবর্তন হবে না

`BanglaInputEngine.kt`, `SuggestionEngine.kt`, `UserWordModel.kt`, `ClipboardHandler.kt`, `HapticManager.kt`, `KickKeyApplication.kt`, সমস্ত কম্প্যানিয়ন অ্যাপ ফাইল (`app/`, `store/`, `hooks/`, `components/`), `EmojiPanel.tsx`, `ClipboardPanel.tsx`, `KeyboardHeader.tsx`, `AltCharsPopup.tsx`, `BottomRow.tsx`, নতুন `numbers.ts` ছাড়া সমস্ত লেআউট ফাইল।

---

## 2. পারফরম্যান্স লক্ষ্যমাত্রা

এই তিনটি পরিমাপযোগ্য লক্ষ্যমাত্রা ফেজ ৭-এর "সম্পন্ন" সংজ্ঞায়িত করে। প্রতিটি অপ্টিমাইজেশন ধাপের আগে ও পরে প্রতিটি পরিমাপ করুন।

| মেট্রিক | লক্ষ্যমাত্রা | কীভাবে পরিমাপ করবেন |
|---|---|---|
| IME প্রসেস RAM | < ৫০MB স্থির-অবস্থায় | Android Studio Profiler → `com.kickkey:ime_process`-এ সংযুক্ত → Memory ট্যাব |
| কীবোর্ড খোলার লেটেন্সি | < ৮০ms (প্রথম প্রি-ওয়ার্মের পরে) | `adb logcat -s KickKeyIME` — `onStartInputView` লগ এবং প্রথম React ফ্রেমের মধ্যে সময় |
| সাজেশন লেটেন্সি | টাইপিং থামার ১০০ms-এর মধ্যে | `adb logcat -s SuggestionEngine` — শেষ `onCharacterTyped` থেকে `emitSuggestions` পর্যন্ত সময় |

### বেসলাইন পরিমাপ (যেকোনো পরিবর্তনের আগে এটি করুন)

```bash
# ১. একটি মিড-রেঞ্জ ডিভাইসে ফেজ ৬ APK ইনস্টল করুন (ফ্ল্যাগশিপ নয়)
# ২. কীবোর্ড ওয়ার্ম করতে একটি টেক্সট ফিল্ড খুলুন
# ৩. logcat থেকে RAM, ওপেন-লেটেন্সি, এবং সাজেশন-লেটেন্সি নোট করুন
# ৪. নিচের প্রতিটি ধাপ প্রয়োগ করুন এবং উন্নতি নিশ্চিত করতে পুনরায় পরিমাপ করুন
```

---

## 3. ধাপ ১ — ইনলাইন স্টাইল অবজেক্ট দূর করুন

JSX-এর ভেতরে প্রতিটি `style={{ ... }}` এক্সপ্রেশন **প্রতিটি রেন্ডারে একটি নতুন JavaScript অবজেক্ট** তৈরি করে। একটি কীবোর্ডে যেটি প্রতিটি কী প্রেসে পুনরায় রেন্ডার হয়, এটি প্রতি সেকেন্ডে শত শত অপ্রয়োজনীয় হিপ বরাদ্দ যোগ করে, GC প্রেশার এবং জ্যাংক বৃদ্ধি করে।

### নিয়ম

**প্রতিটি** ইনলাইন স্টাইল `StyleSheet.create`-এ সরান। একমাত্র অনুমোদিত ডায়নামিক স্টাইল হলো সেগুলো যার মান রানটাইমে পরিবর্তিত হয় (যেমন `useKeyboardTheme` থেকে থিম রঙ, প্রেফারেন্স থেকে কী মাত্রা)।

### ঠিক করার প্যাটার্ন

```tsx
// ❌ আগে — প্রতিটি Key-এর প্রতিটি রেন্ডারে একটি নতুন অবজেক্ট তৈরি করে
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

// ✅ পরে — স্ট্যাটিক স্টাইল একটি একক ডায়নামিক অবজেক্টের সাথে একত্রিত
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

### নিরীক্ষা করার ফাইল (অগ্রাধিকার ক্রমে)

1. `Key.tsx` — প্রতিটি কী প্রেসে ~৩০টি কী জুড়ে পুনরায় রেন্ডার হয়
2. `KeyRow.tsx` — প্রতিটি Shift/Caps পরিবর্তনে পুনরায় রেন্ডার হয়
3. `SuggestionBar.tsx` — প্রতিটি টাইপ করা অক্ষরে পুনরায় রেন্ডার হয়
4. `BottomRow.tsx` — শুধুমাত্র ভাষা পরিবর্তনে পুনরায় রেন্ডার হয়
5. `KeyboardHeader.tsx` — শুধুমাত্র ভাষা/কম্পোজিং পরিবর্তনে পুনরায় রেন্ডার হয়

---

## 4. ধাপ ২ — React.memo নিরীক্ষা ও ঠিক করুন

`React.memo` ফেজ ২/৩-এ প্রয়োগ করা হয়েছিল কিন্তু কাস্টম কম্পারেটর অবশ্যই যাচাই করতে হবে। একটি ভুল কম্পারেটর নীরবে মেমোইজেশন নিষ্ক্রিয় করতে পারে (সবসময় `false` ফেরত দেয়) বা প্রয়োজনীয় পুনরায় রেন্ডার দমন করতে পারে (সবসময় `true` ফেরত দেয়)।

### `Key.tsx` — সঠিক কম্পারেটর

```tsx
export default React.memo(Key, (prev, next) => {
  // true ফেরত = পুনরায় রেন্ডার এড়িয়ে যান (props সমান)
  // false ফেরত = পুনরায় রেন্ডার করুন (props পরিবর্তিত হয়েছে)
  return (
    prev.keyDef         === next.keyDef         &&
    prev.isShift        === next.isShift        &&
    prev.isCapsLock     === next.isCapsLock     &&
    prev.theme          === next.theme          &&
    prev.onPress        === next.onPress        &&
    prev.onLongPress    === next.onLongPress    &&
    prev.onLongPressEnd === next.onLongPressEnd
  );
});
```

> **সাধারণ ভুল:** `onPress`, `onLongPress`, `onLongPressEnd` তুলনা করতে ভুলে যাওয়া। যদি parent এই ফাংশনগুলো `useCallback` ছাড়া পুনরায় তৈরি করে, `React.memo` কখনো সাহায্য করে না।

### `KeyRow.tsx` — সঠিক কম্পারেটর

```tsx
export default React.memo(KeyRow, (prev, next) =>
  prev.keys                    === next.keys                    &&
  prev.isShift                 === next.isShift                 &&
  prev.isCapsLock              === next.isCapsLock              &&
  prev.theme                   === next.theme                   &&
  prev.onKeyPress              === next.onKeyPress              &&
  prev.onBackspace             === next.onBackspace             &&
  prev.onBackspaceLongPress    === next.onBackspaceLongPress    &&
  prev.onBackspaceLongPressEnd === next.onBackspaceLongPressEnd &&
  prev.onShift                 === next.onShift
);
```

### `SuggestionBar.tsx` — সঠিক কম্পারেটর

```tsx
export default React.memo(SuggestionBar, (prev, next) =>
  prev.suggestions.length === next.suggestions.length &&
  prev.suggestions.every((s, i) => s === next.suggestions[i]) &&
  prev.currentWord === next.currentWord &&
  prev.theme       === next.theme      &&
  prev.onSelect    === next.onSelect
);
```

`JSON.stringify` কম্পারেটরে এড়িয়ে চলুন — এটি প্রতিটি রেন্ডার চেকে O(n) স্ট্রিং বরাদ্দ করে।

### মেমোইজেশন কাজ করছে কিনা নিশ্চিত করুন

```bash
# সাময়িকভাবে Key.tsx-এ এটি যোগ করুন:
console.log('Key পুনরায় রেন্ডার:', keyDef.label);
# একটি কী প্রেস করার পরে যদি পরিবর্তিত হয়নি এমন কীগুলোর জন্য এই লগ দেখেন, memo কাজ করছে না
```

---

## 5. ধাপ ৩ — কী প্রেস অ্যানিমেশন

ট্যাপে একটি সূক্ষ্ম স্কেল-ডাউন + স্কেল-আপ অ্যানিমেশন কীবোর্ডকে ফিজিক্যাল ও সাড়াশীল মনে করায়। React Native-এর `Animated` API ব্যবহার করুন — এটি নেটিভ থ্রেডে চলে এবং JS ব্লক করে না।

```tsx
// src/keyboard/Key.tsx — TouchableOpacity-কে Animated ভার্সনে প্রতিস্থাপন করুন

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

const PRESS_SCALE = 0.88;       // ট্যাপে ৮৮%-এ স্কেল ডাউন
const ANIMATION_DURATION = 80;  // ms — তাৎক্ষণিক মনে হওয়ার জন্য যথেষ্ট দ্রুত

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
    onPress(effectiveKey);   // অবিলম্বে কমিট করুন
    animatePress();           // সমান্তরালে অ্যানিমেট — await করবেন না
  }, [effectiveKey, onPress, animatePress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(keyDef);
  }, [keyDef, onLongPress]);

  const isSpecial = !!keyDef.isSpecial;
  const bgColor   = isSpecial ? theme.specialKeyBg : theme.keyBg;
  const textColor = isSpecial ? theme.specialKeyText : theme.keyText;

  return (
    <Animated.View
      style={[
        styles.keyWrapper,
        { flex: keyDef.width ?? 1, transform: [{ scale }] },
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
  keyWrapper: { marginVertical: 4 },
  key: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
  },
  keyLabel: { fontWeight: '500', textAlign: 'center' },
  iconText: { fontSize: 18, fontWeight: '400' },
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

## 6. ধাপ ৪ — সাউন্ড ফিডব্যাক

সাউন্ড ফিডব্যাক `soundEnabled` প্রেফারেন্স দ্বারা নিয়ন্ত্রিত (ফেজ ৫-এ কম্প্যানিয়ন অ্যাপের Settings স্ক্রিনে সেট করা)।

### ৬.১ `src/keyboard/data/soundManager.ts`

```typescript
// src/keyboard/data/soundManager.ts

import { NativeModules } from 'react-native';

const { KickKey } = NativeModules;

/**
 * ঐচ্ছিক কী-ক্লিক সাউন্ড বাজায়।
 * সাউন্ড নিষ্ক্রিয় থাকলে নীরবে কিছুই করে না।
 * useKeyboardState.handleKeyPress()-থেকে hapticManager.vibrate()-এর পাশাপাশি কল করা হয়।
 */
export function playKeySound(): void {
  try {
    KickKey.playKeySound();
  } catch {
    // উপেক্ষা করুন — সাউন্ড ঐচ্ছিক এবং কখনো কীবোর্ড ক্র্যাশ করা উচিত নয়
  }
}
```

### ৬.২ `KickKeyModule.kt` — `playKeySound` ফাংশন

```kotlin
// KickKeyModule.kt-এর definition()-এর ভেতরে যোগ করুন

Function("playKeySound") {
    val context = appContext.reactContext ?: return@Function
    val soundEnabled = context
        .getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
        .getBoolean("soundEnabled", false)
    if (!soundEnabled) return@Function
    try {
        val am = context.getSystemService(android.content.Context.AUDIO_SERVICE)
                as android.media.AudioManager
        // AudioManager.playSoundEffect IME ক্লিক সাউন্ডের সঠিক API।
        // এটি সিস্টেম সাউন্ড পুল ব্যবহার করে, ব্যবহারকারীর মিডিয়া ভলিউম সম্মান করে,
        // এবং MediaPlayer-এর তুলনায় প্রায় শূন্য লেটেন্সি আছে।
        am.playSoundEffect(android.media.AudioManager.FX_KEYPRESS_STANDARD, -1f)
    } catch (e: Exception) {
        android.util.Log.w("KickKeyModule", "সাউন্ড ইফেক্ট ব্যর্থ: ${e.message}")
    }
}
```

### ৬.৩ `useKeyboardState`-এ ওয়্যার করুন

```typescript
// src/keyboard/hooks/useKeyboardState.ts
// শীর্ষে এই ইম্পোর্ট যোগ করুন:
import { playKeySound } from '../data/soundManager';

// তারপর handleKeyPress, handleBackspace, handleSpace, handleEnter-এ কল করুন:
const handleKeyPress = useCallback((key: KeyDef) => {
  if (!key.code) return;
  KickKey.commitKey(key.code, language);
  playKeySound();   // ← এই লাইন যোগ করুন
  if (language === 'en') {
    setComposing('');
    if (isShift && !isCapsLock) setIsShift(false);
  }
}, [language, isShift, isCapsLock]);

const handleBackspace = useCallback(() => {
  KickKey.sendBackspace();
  playKeySound();   // ← যোগ করুন
}, []);

const handleSpace = useCallback(() => {
  KickKey.commitSpace();
  playKeySound();   // ← যোগ করুন
  setComposing('');
  if (language === 'en' && isShift && !isCapsLock) setIsShift(false);
}, [language, isShift, isCapsLock]);

const handleEnter = useCallback(() => {
  KickKey.sendEnter();
  playKeySound();   // ← যোগ করুন
  setComposing('');
}, []);
```

---

## 7. ধাপ ৫ — ইনপুট টাইপ অভিযোজন

Android একটি টেক্সট ফিল্ড ফোকাস পেলে `EditorInfo`-তে একটি `inputType` পূর্ণসংখ্যা পাস করে। KickKey-কে ফিল্ড টাইপ অনুযায়ী তার লেআউট ও আচরণ মানিয়ে নিতে হবে।

### ৭.১ `inputType` কনস্ট্যান্ট রেফারেন্স

```kotlin
// দরকারী EditorInfo.inputType মান:
// বেস টাইপ (সর্বনিম্ন ৪ বিট):
//   0x00000001 = TYPE_CLASS_TEXT
//   0x00000002 = TYPE_CLASS_NUMBER
//   0x00000003 = TYPE_CLASS_PHONE
//   0x00000004 = TYPE_CLASS_DATETIME
// টেক্সট ভ্যারিয়েশন:
//   0x00000080 = TYPE_TEXT_VARIATION_PASSWORD
//   0x00000020 = TYPE_TEXT_VARIATION_URI  (URL ফিল্ড)
//   0x00000050 = TYPE_TEXT_VARIATION_EMAIL_ADDRESS

val typeClass  = info.inputType and 0x0000000F
val isPassword = (info.inputType and 0x000000D0) != 0
val isNumber   = typeClass == 0x00000002
val isPhone    = typeClass == 0x00000003
val isUrl      = (info.inputType and 0x000000F0) == 0x00000020
val isEmail    = (info.inputType and 0x000000F0) == 0x00000050
```

### ৭.২ আপডেটেড `onStartInputView` — সম্পূর্ণ ফিল্ড তথ্য এমিট করুন

`KickKeyInputMethodService.onStartInputView()` আপডেট করুন যাতে TypeScript পাশের প্রয়োজনীয় সমস্ত তথ্য সহ একটি `onInputStarted` ইভেন্ট এমিট হয়:

```kotlin
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

    if (!isPassword && !restarting) {
        KickKeyModule.clipboardHandler?.captureCurrentClipboard()
    }

    // React Native-এ ইনপুট প্রসঙ্গ এমিট করুন
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
        val params = com.facebook.react.bridge.Arguments.createMap().apply {
            putInt("inputType", info.inputType)
            putBoolean("isPassword", isPassword)
            putBoolean("isNumber",   isNumber)
            putBoolean("isPhone",    isPhone)
            putBoolean("isUrl",      isUrl)
            putBoolean("isEmail",    isEmail)
            putString("imeAction",   imeAction)
        }
        reactContext
            .getJSModule(com.facebook.react.bridge.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("onInputStarted", params)
    } catch (e: Exception) {
        android.util.Log.w("KickKeyIME", "onInputStarted এমিট ব্যর্থ: ${e.message}")
    }

    Log.i("KickKeyIME", "InputStarted — class=$typeClass password=$isPassword number=$isNumber phone=$isPhone url=$isUrl")
}
```

---

## 8. ধাপ ৬ — নম্বর লেআউট

`TYPE_CLASS_NUMBER` বা `TYPE_CLASS_PHONE` ফিল্ডের জন্য একটি কম্প্যাক্ট নম্বর-প্যাড লেআউট।

```typescript
// src/keyboard/layouts/numbers.ts
import type { KeyDef } from '../types';

/** TYPE_CLASS_NUMBER ফিল্ডের জন্য কম্প্যাক্ট নম্বর লেআউট */
export const NUMBER_ROWS: KeyDef[][] = [
  [
    { label: '১', code: '1', altChars: ['!'] },
    { label: '২', code: '2', altChars: ['@'] },
    { label: '৩', code: '3', altChars: ['#'] },
  ],
  [
    { label: '৪', code: '4' },
    { label: '৫', code: '5', altChars: ['%'] },
    { label: '৬', code: '6' },
  ],
  [
    { label: '৭', code: '7', altChars: ['&'] },
    { label: '৮', code: '8', altChars: ['*'] },
    { label: '৯', code: '9' },
  ],
  [
    { label: '.',  code: '.', altChars: [',', '-'] },
    { label: '০',  code: '0' },
    { label: '⌫', code: '', action: 'backspace', isSpecial: true, icon: 'backspace' },
  ],
];

/** TYPE_CLASS_PHONE ফিল্ডের জন্য ফোন ডায়াল-প্যাড লেআউট */
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

`src/keyboard/layouts/index.ts` আপডেট করুন:

```typescript
export { ENGLISH_ROWS } from './english';
export { SYMBOL_ROWS }  from './symbols';
export { BANGLA_ROWS }  from './bangla';
export { NUMBER_ROWS, PHONE_ROWS } from './numbers';   // ← ফেজ ৭-এ নতুন
```

---

## 9. ধাপ ৭ — মেমরি-ম্যাপড Trie লোডিং

বর্তমান `Trie.fromStream()` সম্পূর্ণ বাইনারি ফাইল হিপ-বরাদ্দ `ByteArray`-তে পড়ে। মেমরি-ম্যাপিং পরিবর্তে OS-কে ফাইল-ডিসক্রিপ্টর পেজ ক্যাশ দিয়ে বাফার ব্যাক করতে দেয় — ডেটা কখনো পুরোপুরি Java হিপে কপি হয় না।

```kotlin
// android/app/src/main/java/com/kickkey/Trie.kt
// fromStream() companion মেথড fromAsset()-এ প্রতিস্থাপন করুন

companion object {
    private const val MAGIC = 0x54524945.toInt()
    private const val NODE_SIZE = 20
    private const val HEADER_SIZE = 12

    /**
     * একটি মেমরি-ম্যাপড বাফার ব্যবহার করে Android asset ফাইল থেকে Trie লোড করুন।
     *
     * fromStream()-এর বিপরীতে যা পুরো ফাইল একটি byte array-তে লোড করে,
     * এটি FileChannel.map() ব্যবহার করে MappedByteBuffer তৈরি করে — OS
     * তার পেজ ক্যাশ দিয়ে বাফার ব্যাক করে এবং ডেটা শুধুমাত্র অ্যাক্সেস
     * করা হলেই ফিজিক্যাল RAM-এ লোড হয়।
     *
     * ফলাফল: :ime_process-এ ~২–৪MB কম হিপ ব্যবহার।
     */
    fun fromAsset(context: android.content.Context, assetPath: String): Trie {
        // Asset Manager মেমরি ম্যাপিংয়ের জন্য সরাসরি FileDescriptor উন্মুক্ত করে না,
        // তাই একবার কপি করুন এবং কপিটি মেমরি-ম্যাপ করুন।
        val cacheFile = java.io.File(context.cacheDir, assetPath.replace("/", "_"))
        if (!cacheFile.exists() || cacheFile.length() == 0L) {
            try {
                context.assets.open(assetPath).use { input ->
                    cacheFile.parentFile?.mkdirs()
                    java.io.FileOutputStream(cacheFile).use { output ->
                        input.copyTo(output)
                    }
                }
            } catch (e: Exception) {
                // ক্যাশ লেখা ব্যর্থ হলে ফলব্যাক হিসেবে fromStream() ব্যবহার করুন
                return fromStream(context.assets.open(assetPath))
            }
        }
        return try {
            val channel = java.io.RandomAccessFile(cacheFile, "r").channel
            val buf = channel.map(
                java.nio.channels.FileChannel.MapMode.READ_ONLY,
                0,
                channel.size()
            ).order(java.nio.ByteOrder.BIG_ENDIAN)
            channel.close()
            val magic = buf.getInt(0)
            require(magic == MAGIC) { "অবৈধ Trie ফাইল: ভুল magic 0x${magic.toString(16)}" }
            Trie(buf)
        } catch (e: Exception) {
            fromStream(context.assets.open(assetPath))
        }
    }

    // ইউনিট টেস্টের জন্য fromStream() রাখুন (ইউনিট টেস্ট পরিবেশে Android Context নেই)
    fun fromStream(stream: java.io.InputStream): Trie {
        val bytes = stream.readBytes()
        val buf = java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.BIG_ENDIAN)
        val magic = buf.getInt(0)
        require(magic == MAGIC) { "অবৈধ Trie ফাইল: ভুল magic 0x${magic.toString(16)}" }
        return Trie(buf)
    }
}
```

`SuggestionEngine.kt` আপডেট করুন:

```kotlin
// SuggestionEngine.kt — loadDictionary() আপডেট করুন
private fun loadDictionary(assetPath: String): Trie {
    return Trie.fromAsset(context, assetPath)   // ← আগে: context.assets.open(assetPath).use { Trie.fromStream(it) }
}
```

---

## 10. ধাপ ৮ — IME RAM প্রোফাইল করুন

### ১০.১ কীভাবে পরিমাপ করবেন

```bash
# ১. ফিজিক্যাল ডিভাইসে APK ইনস্টল করুন
# ২. একটি টেক্সট ফিল্ড আছে এমন অ্যাপ খুলুন
# ৩. কীবোর্ড খুলতে টেক্সট ফিল্ড ট্যাপ করুন
# ৪. ইনিশিয়ালাইজেশন স্থির হওয়ার জন্য ১০ সেকেন্ড অপেক্ষা করুন
# ৫. চালান:
adb shell dumpsys meminfo com.kickkey:ime_process

# গুরুত্বপূর্ণ ফিল্ড:
# TOTAL PSS — প্রসেস দ্বারা ব্যবহৃত মোট ফিজিক্যাল মেমরি
# Java Heap — JVM এবং JS ইঞ্জিন থেকে হিপ বরাদ্দ
# Native Heap — নেটিভ বরাদ্দ (Hermes রানটাইম, Trie বাফার)
```

একটি ভালো-টিউনড ফেজ ৭ বিল্ডের জন্য প্রত্যাশিত PSS বিভাজন:

| কম্পোনেন্ট | লক্ষ্যমাত্রা |
|---|---|
| Hermes রানটাইম | ~১২–১৬MB |
| keyboard.bundle পার্সড JS | ~৩–৫MB |
| Trie ডেটা (মেমরি-ম্যাপড, হিপ নয়) | ~১–২MB |
| React Native রেন্ডারিং লেয়ার | ~৪–৬MB |
| বিবিধ নেটিভ লাইব্রেরি | ~৫–৮MB |
| **মোট লক্ষ্যমাত্রা** | **< ৪৫MB** |

### ১০.২ RAM ৫০MB-এর উপরে হলে

এই ক্রমে যাচাই করুন:

১. **মেমরি-ম্যাপড Trie সক্রিয় কিনা যাচাই করুন।** যদি `dumpsys meminfo`-এ খুব বড় Java হিপ দেখেন, পুরানো `fromStream()` পথ ব্যবহার হচ্ছে। `SuggestionEngine.kt`-এ `loadDictionary()` পরীক্ষা করুন।

২. **SuggestionEngine লিক পরীক্ষা করুন।** `computeAndEmit()`-এর ব্যাকগ্রাউন্ড থ্রেড `KickKeyApplication` প্রসঙ্গের রেফারেন্স ধরে রাখে। নিশ্চিত করুন `KickKeyInputMethodService.onDestroy()`-এ `SuggestionEngine` `null` করা হয়।

৩. **`keyboard.bundle` সাইজ কমান:**
   ```bash
   npx react-native bundle \
     --entry-file keyboard.index.js \
     --bundle-output /tmp/keyboard.bundle \
     --platform android --minify true --reset-cache
   ls -lh /tmp/keyboard.bundle
   ```
   যদি > ৫MB হয়, দুর্ঘটনাক্রমে বড় ইম্পোর্ট পরীক্ষা করুন।

---

## 11. ধাপ ৯ — কীবোর্ড খোলার লেটেন্সি প্রোফাইল করুন

### ১১.১ কীভাবে পরিমাপ করবেন

```bash
adb logcat -s KickKeyIME KickKeyApplication ReactNativeJS

# তারপর একটি টেক্সট ফিল্ড ফোকাস করুন
# খুঁজুন:
# I/KickKeyApplication: Keyboard ReactHost pre-warm complete
# I/KickKeyIME: onCreateInputView called
# I/KickKeyIME: ReactRootView started
# (প্রথম React ফ্রেম লগ — ReactNativeJS-এ দেখা যায়)
```

"onCreateInputView called" এবং প্রথম দৃশ্যমান ফ্রেমের মধ্যে গ্যাপ হলো আপনার ওপেন লেটেন্সি। লক্ষ্যমাত্রা: প্রি-ওয়ার্ম সম্পন্ন হওয়ার পরে < ৮০ms।

### ১১.২ ওপেন লেটেন্সি > ৮০ms হলে

**মূল কারণ ১: প্রথম ব্যবহারের আগে প্রি-ওয়ার্ম সম্পন্ন না হওয়া।**

`KickKeyApplication.initKeyboardRuntime()`-এর প্রি-ওয়ার্ম থ্রেড `keyboardReactHost.start()` কল করে। প্রথমবার কোল্ড-স্টার্টে এটি এখনো চলছে থাকতে পারে। পরবর্তী কীবোর্ড ওপেনগুলো (প্রি-ওয়ার্ম সম্পন্ন হওয়ার পরে) < ৮০ms হওয়া উচিত।

**মূল কারণ ২: `KeyboardScreen.tsx`-এ বড় প্রাথমিক রেন্ডার।**

নিশ্চিত করুন `EmojiPanel` এবং `ClipboardPanel` মাউন্টে রেন্ডার হয় না — সেগুলো শর্তসাপেক্ষে রেন্ডার হওয়া উচিত, অফস্ক্রিনে প্রি-রেন্ডার নয়।

**মূল কারণ ৩: `useKeyboardTheme`-এ দ্বিতীয় রেন্ডার।**

`getPreferences()` async — মাউন্টে এটি প্রথমে ডিফল্ট থিম সেট করে, তারপর async কল ফিরে আসার পরে আপডেট করে, একটি দ্বিতীয় রেন্ডার সৃষ্টি করে। প্রশমন: প্রথম-রেন্ডার ব্যবহারের জন্য একটি sync ভার্সন:

```kotlin
// KickKeyModule.kt-এ যোগ করুন — getPreferences-এর sync সংস্করণ
Function("getPreferencesSync") {
    val context = appContext.reactContext ?: return@Function emptyMap<String, Any>()
    val prefs = context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
    mapOf(/* ... getPreferences-এর মতো একই ... */)
}
```

---

## 12. ধাপ ১০ — সাজেশন লেটেন্সি প্রোফাইল করুন

### ১২.১ কীভাবে পরিমাপ করবেন

```bash
adb logcat -s SuggestionEngine

# প্রত্যাশিত:
# D/SuggestionEngine: prefix="hel" → ["hello","help","held"]

# শেষ কী প্রেস এবং logcat লাইনের মধ্যে সময় পরিমাপ করুন।
# লক্ষ্যমাত্রা: ৫০ms ডিবাউন্স সহ < ১০০ms।
```

### ১২.২ ডিবাউন্স টিউন করুন

```kotlin
// SuggestionEngine.kt-এ
private const val DEBOUNCE_MS = 50L   // ৩০–৮০ms-এর মধ্যে টিউন করুন
```

### ১২.৩ Trie সার্চ > ৫০ms লাগলে

টাইমিং ইন্সট্রুমেন্টেশন যোগ করুন:

```kotlin
private fun computeAndEmit() {
    val start = System.currentTimeMillis()
    // ... বিদ্যমান কোড ...
    val elapsed = System.currentTimeMillis() - start
    Log.d(TAG, "Trie সার্চ ${elapsed}ms নিয়েছে prefix='$currentWord'-এর জন্য")
}
```

যদি ধারাবাহিকভাবে > ৩০ms লাগে, শব্দ তালিকা সবচেয়ে-সাধারণ ৩০,০০০ শব্দে ছেঁটে দিন।

---

## 13. আপডেটেড `KickKeyInputMethodService.kt`

```kotlin
// android/app/src/main/java/com/kickkey/KickKeyInputMethodService.kt
// সম্পূর্ণ প্রতিস্থাপন

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
        KickKeyModule.hapticManager    = HapticManager(this)
        KickKeyModule.banglaEngine     = BanglaInputEngine()
        KickKeyModule.suggestionEngine = SuggestionEngine(this)
        KickKeyModule.clipboardHandler = ClipboardHandler(this)
        // সাউন্ড পুল প্রিলোড করুন যাতে প্রথম কল ব্যর্থ না হয়
        try {
            (getSystemService(AUDIO_SERVICE) as android.media.AudioManager).loadSoundEffects()
        } catch (e: Exception) {
            Log.w(TAG, "সাউন্ড পুল প্রিলোড ব্যর্থ: ${e.message}")
        }
        Log.i(TAG, "IME তৈরি — সমস্ত হ্যান্ডলার প্রস্তুত")
    }

    override fun onCreateInputView(): View {
        Log.i(TAG, "onCreateInputView")
        val app = application as? KickKeyApplication ?: run {
            Log.e(TAG, "KickKeyApplication পাওয়া যায়নি"); return View(this)
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

        if (!isPassword && !restarting) {
            KickKeyModule.clipboardHandler?.captureCurrentClipboard()
        }

        emitInputStarted(info, isPassword, isNumber, isPhone, isUrl, isEmail)
        Log.i(TAG, "InputStarted — class=$typeClass password=$isPassword number=$isNumber phone=$isPhone")
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
            Log.w(TAG, "emitInputStarted ব্যর্থ: ${e.message}")
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
        Log.i(TAG, "IME ধ্বংস হয়েছে")
    }
}
```

---

## 14. আপডেটেড `KickKeyModule.kt`

শুধুমাত্র ফেজ ৭-এর নতুন সংযোজন — `playKeySound`। ফেজ ১–৬-এর সবকিছু অপরিবর্তিত থাকে।

```kotlin
// KickKeyModule.kt-এর definition()-এ যোগ করুন

// ── ফেজ ৭-এ নতুন: সাউন্ড ফিডব্যাক ────────────────────────────────────────────────

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
        android.util.Log.w("KickKeyModule", "সাউন্ড ইফেক্ট ব্যর্থ: ${e.message}")
    }
}
```

---

## 15. আপডেটেড `useKeyboardState` হুক

ফেজ ৭ উন্নত `onInputStarted` ইভেন্ট থেকে পপুলেটেড `inputType` স্টেট ফিল্ড যোগ করে।

```typescript
// src/keyboard/hooks/useKeyboardState.ts
// শুধুমাত্র সংযোজন — ফেজ ৬ ফাইলে একত্রিত করুন

// স্টেটে যোগ করুন:
const [isPassword,  setIsPassword]  = useState(false);
const [isNumber,    setIsNumber]    = useState(false);
const [isPhone,     setIsPhone]     = useState(false);
const [isUrl,       setIsUrl]       = useState(false);
const [imeAction,   setImeAction]   = useState<string>('return');

// onInputStarted লিসেনার আপডেট করুন (ফেজ ৪-এ ইতিমধ্যে একটি মূল সংস্করণ আছে):
const subInput = emitter.addListener('onInputStarted', (data) => {
  setIsPassword(data.isPassword ?? false);
  setIsNumber(data.isNumber   ?? false);
  setIsPhone(data.isPhone     ?? false);
  setIsUrl(data.isUrl         ?? false);
  setImeAction(data.imeAction ?? 'return');

  // বিদ্যমান ফেজ ৪ আচরণ:
  if (data.isPassword) setSuggestions([]);
  setIsSymbol(false);
  setIsEmoji(false);
  setIsClipboard(false);
  setComposing('');
});

// ফেরত দেওয়া স্টেট অবজেক্টে যোগ করুন:
return {
  // ... সমস্ত বিদ্যমান ফিল্ড ...
  isPassword, isNumber, isPhone, isUrl, imeAction,
};

// KeyboardState ইন্টারফেস আপডেট করুন:
export interface KeyboardState {
  // ... বিদ্যমান ...
  isPassword: boolean;
  isNumber:   boolean;
  isPhone:    boolean;
  isUrl:      boolean;
  imeAction:  string;
}
```

---

## 16. আপডেটেড `KeyboardScreen.tsx`

নতুন ইনপুট-টাইপ স্টেট লেআউট নির্বাচন এবং Enter কী লেবেলে ওয়্যার করুন।

```tsx
// src/keyboard/KeyboardScreen.tsx
// বিদ্যমান ফেজ ৬ ফাইলে সংযোজন — শুধুমাত্র পরিবর্তিত JSX সেকশন দেখানো হয়েছে

import { ENGLISH_ROWS, BANGLA_ROWS, SYMBOL_ROWS, NUMBER_ROWS, PHONE_ROWS } from './layouts';

export default function KeyboardScreen() {
  const theme = useKeyboardTheme();
  const {
    language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard,
    suggestions, composingText, currentWord,
    isPassword, isNumber, isPhone, isUrl, imeAction,   // ← ফেজ ৭ সংযোজন
    handleKeyPress, handleBackspace, handleBackspaceLongPress,
    handleSpace, handleEnter, handleShift, handleLanguageSwitch,
    handleSymbolToggle, handleEmojiToggle, handleClipboardToggle,
    handleSuggestionSelect,
  } = useKeyboardState();

  // ফেজ ৭: ইনপুট টাইপের ভিত্তিতে সক্রিয় সারি সেট বেছে নিন
  const rows = (() => {
    if (isPhone)  return PHONE_ROWS;
    if (isNumber) return NUMBER_ROWS;
    if (isSymbol) return SYMBOL_ROWS;
    if (language === 'bn') return BANGLA_ROWS;
    return ENGLISH_ROWS;
  })();

  // ... ইমোজি / ক্লিপবোর্ড প্যানেল ফেজ ৬ থেকে অপরিবর্তিত ...

  return (
    <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
      <KeyboardHeader language={language} theme={theme} composingText={composingText} />

      {/* ফেজ ৭: পাসওয়ার্ড ফিল্ডে সাজেশন লুকান */}
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

      {/* ফেজ ৭: imeAction পাস করুন যাতে BottomRow Enter কী লেবেল সঠিকভাবে লেবেল করতে পারে */}
      <BottomRow
        theme={theme}
        language={language}
        isSymbol={isSymbol}
        imeAction={imeAction}           // ← ফেজ ৭ সংযোজন
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

### ১৬.১ `BottomRow.tsx` আপডেট করুন — ডায়নামিক Enter কী লেবেল

```tsx
// BottomRow.tsx-এ imeAction প্রপ যোগ করুন এবং Enter বাটনে ব্যবহার করুন

interface BottomRowProps {
  // ... বিদ্যমান প্রপস ...
  imeAction: string;   // ← ফেজ ৭-এ নতুন
}

// Enter বাটনে:
<TouchableOpacity style={[styles.key, special, { flex: 1.3 }]} onPress={onEnter} activeOpacity={0.55}>
  <Text style={[styles.label, { color: theme.specialKeyText, fontSize: imeAction === 'return' ? 18 : 11 }]}>
    {imeAction === 'search' ? '🔍'
      : imeAction === 'send'   ? '➤'
      : imeAction === 'done'   ? '✓'
      : imeAction === 'next'   ? '→'
      : imeAction === 'go'     ? 'যাও'
      : '↵'}
  </Text>
</TouchableOpacity>
```

---

## 17. বিল্ড ও পরিমাপ

### ১৭.১ বিল্ড করুন

```bash
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify true        # সঠিক RAM পরিমাপের জন্য true ব্যবহার করুন

cd android && ./gradlew assembleRelease   # সঠিক RAM প্রোফাইলিংয়ের জন্য রিলিজ বিল্ড
adb install -r app/build/outputs/apk/release/app-release-unsigned.apk
```

> RAM প্রোফাইলিংয়ের জন্য সবসময় **রিলিজ বিল্ড** পরিমাপ করুন — ডিবাগ বিল্ড Metro dev সার্ভার সংযোগ এবং JS প্রোফাইলিং হুক থেকে উল্লেখযোগ্য ওভারহেড বহন করে যা RAM ১০–২০MB ফুলিয়ে দেয়।

### ১৭.২ RAM বেসলাইন চেক

```bash
adb shell dumpsys meminfo com.kickkey:ime_process | grep -E "TOTAL|Java Heap|Native Heap"
```

### ১৭.৩ ওপেন লেটেন্সি

```bash
adb logcat -s KickKeyIME | grep -E "onCreateInputView|ReactRootView started"
# একটি টেক্সট ফিল্ড ট্যাপ করুন, এই দুটি লাইনের মধ্যে টাইমস্ট্যাম্প ডেল্টা নোট করুন
```

### ১৭.৪ সাজেশন লেটেন্সি

```bash
adb logcat -s SuggestionEngine
# "hel" টাইপ করুন এবং শেষ কী থেকে সাজেশন লগ লাইন পর্যন্ত সময় নোট করুন
```

---

## 18. যাচাই চেকলিস্ট

### React.memo ও ইনলাইন স্টাইল

- [ ] `src/keyboard/`-এর কোনো ফাইলে স্ট্যাটিক মান সহ `style={{ ... }}` অবশিষ্ট নেই
- [ ] `Key.tsx`-এ সাময়িকভাবে `console.log('Key পুনরায় রেন্ডার')` যোগ করলে শুধুমাত্র পরিবর্তিত কীগুলো লগ দেখায় (যেমন Shift ট্যাপে শুধুমাত্র Caps-lock Shift কীগুলো পুনরায় রেন্ডার হয়, সমস্ত ৩০টি নয়)
- [ ] `SuggestionBar` পুনরায় রেন্ডার হয় শুধুমাত্র `suggestions` বা `currentWord` পরিবর্তিত হলে

### কী প্রেস অ্যানিমেশন

- [ ] প্রতিটি কী প্রেসে ভিজ্যুয়ালি স্কেল ডাউন (~৮৮%-এ) হয় এবং ছেড়ে দিলে ফিরে আসে
- [ ] দ্রুত টাইপিংয়ের সময় অ্যানিমেশন কোনো ড্রপড ফ্রেম ছাড়া মসৃণ চলে
- [ ] অ্যানিমেশন প্রকৃত অক্ষর কমিটে কোনো উপলব্ধযোগ্য লেটেন্সি যোগ করে না

### সাউন্ড ফিডব্যাক

- [ ] কম্প্যানিয়ন অ্যাপ Settings-এ "Key Sounds" চালু করে টাইপ করলে প্রতিটি কীতে শ্রবণযোগ্য ক্লিক হয়
- [ ] "Key Sounds" বন্ধ করলে কোনো সাউন্ড নেই
- [ ] সাউন্ড প্রেফারেন্স কীবোর্ড পুনরায় খোলার মধ্যে থেকে যায়
- [ ] সাউন্ড সিস্টেম ভলিউম অনুসরণ করে

### ইনপুট টাইপ অভিযোজন

- [ ] পাসওয়ার্ড ফিল্ড ট্যাপ করলে: সাজেশন বার লুকায়
- [ ] `TYPE_CLASS_NUMBER` ফিল্ড ট্যাপ করলে: নম্বর-প্যাড লেআউট (১–৯ + `.` + `০` + ব্যাকস্পেস) দেখা যায়
- [ ] `TYPE_CLASS_PHONE` ফিল্ড ট্যাপ করলে: ডায়াল-প্যাড লেআউট (১–৯ + `*` + `০` + `#`) দেখা যায়
- [ ] স্বাভাবিক টেক্সট ফিল্ড ট্যাপ করলে: QWERTY লেআউট (অপরিবর্তিত) দেখা যায়
- [ ] Enter কী লেবেল পরিবর্তিত হয়: সার্চ ফিল্ডে 🔍, সেন্ড বাটনে ➤, "done"-এ ✓, স্বাভাবিক ফিল্ডে ↵
- [ ] নম্বর ফিল্ড থেকে টেক্সট ফিল্ডে ফিরে গেলে QWERTY লেআউট সঠিকভাবে পুনরুদ্ধার হয়

### পারফরম্যান্স লক্ষ্যমাত্রা

- [ ] `adb shell dumpsys meminfo com.kickkey:ime_process` — TOTAL PSS < ৫০MB (রিলিজ বিল্ড, কীবোর্ড খোলা)
- [ ] কীবোর্ড ওপেন লেটেন্সি প্রথম প্রি-ওয়ার্মের পরে মিড-রেঞ্জ ডিভাইসে < ৮০ms
- [ ] সাজেশন লেটেন্সি ৩-অক্ষরের ইংরেজি প্রিফিক্সের জন্য এন্ড-টু-এন্ড (৫০ms ডিবাউন্স সহ) < ১০০ms
- [ ] কোনো পরীক্ষা ডিভাইসে স্বাভাবিক টাইপিংয়ের সময় কোনো ANR ডায়ালগ নেই

---

## 19. সমস্যা সমাধান

### React.memo যোগ করার পরেও সমস্ত কী পুনরায় রেন্ডার হয়

**কারণ:** `KeyRow` থেকে `Key`-এ পাঠানো কলব্যাক ফাংশন (`onPress`, `onLongPress`, `onLongPressEnd`) প্রতিটি `KeyRow` রেন্ডারে পুনরায় তৈরি হচ্ছে, প্রতিটি `Key`-এর prop তুলনা ব্যর্থ করছে।

**সমাধান:** নিশ্চিত করুন `KeyRow`-এর প্রতিটি কলব্যাক যা `Key`-এ পাস হয় `useCallback`-এ মোড়ানো:
```typescript
const handleKeyPress = useCallback((key: KeyDef) => { ... }, [onKeyPress, onBackspace, onShift]);
const handleLongPress = useCallback((key: KeyDef) => { ... }, [onBackspaceLongPress]);
```

---

### কী প্রেস অ্যানিমেশন দৃশ্যমান ল্যাগ সৃষ্টি করে (অক্ষর কমিট দেরিতে হয়)

**কারণ:** `animatePress()` এবং `onPress(effectiveKey)` ক্রমানুসারে কল হচ্ছে, তাই কমিট ফায়ার হওয়ার আগে অ্যানিমেশন সম্পন্ন করতে হয়।

**সমাধান:** `onPress` এবং `animatePress` সমান্তরালে কল করুন, ক্রমানুসারে নয়:
```typescript
const handlePress = useCallback(() => {
  onPress(effectiveKey);    // অবিলম্বে কমিট করুন
  animatePress();           // সমান্তরালে অ্যানিমেট — await করবেন না
}, [effectiveKey, onPress, animatePress]);
```

---

### স্বাভাবিক টেক্সট ফিল্ডে নম্বর লেআউট দেখা যায়

**কারণ:** `isNumber` স্টেট `true` যখন `false` হওয়া উচিত — Kotlin থেকে `onInputStarted` ইভেন্ট ভুল `isNumber` মান পাঠাচ্ছে।

**পরীক্ষা করুন:**
```bash
adb logcat -s KickKeyIME | grep "InputStarted"
# number= ফিল্ড আপনার প্রত্যাশার সাথে মেলে কিনা যাচাই করুন
```
সবচেয়ে সাধারণ মিথ্যা ইতিবাচক: কিছু সার্চ বার `TYPE_CLASS_TEXT` + `TYPE_TEXT_VARIATION_URI` ব্যবহার করে — এগুলো QWERTY দেখানো উচিত, নম্বর প্যাড নয়। টাইপ-ক্লাস এক্সট্রাকশন যাচাই করুন:
```kotlin
val typeClass = info.inputType and 0x0000000F   // সর্বনিম্ন ৪ বিট আইসোলেট করুন
val isNumber  = typeClass == 0x00000002          // শুধুমাত্র TYPE_CLASS_NUMBER
```

---

### `MappedByteBuffer` পদ্ধতি ক্যাশ dir-এ "file not found" সৃষ্টি করে

**কারণ:** ক্যাশ ডিরেক্টরি পাথ অ্যাপ ভার্সন ইনস্টলের মধ্যে পরিবর্তিত হয়, অথবা ক্যাশ ব্যবহারকারী দ্বারা পরিষ্কার করা হয়েছে।

**সমাধান:** `fromAsset()` বাস্তবায়ন এটি পরিচালনা করে — `cacheFile.exists()` চেক করে এবং নিখোঁজ হলে assets থেকে পুনরায় কপি করে। সম্পূর্ণ ব্লকের চারপাশে try-catch নিশ্চিত করুন এবং ব্যর্থতায় `fromStream()`-এ ফলব্যাক করুন।

---

### `playKeySound` একবার কাজ করে তারপর নীরব হয়

**কারণ:** `AudioManager.playSoundEffect` প্রথম কলে সিস্টেম সাউন্ড পুল লোড না হওয়ায় ব্যর্থ হতে পারে।

**সমাধান:** `KickKeyInputMethodService.onCreate()`-এ সাউন্ড পুল প্রিলোড করুন:
```kotlin
(getSystemService(AUDIO_SERVICE) as android.media.AudioManager).loadSoundEffects()
```
(এটি সেকশন ১৩-এর সম্পূর্ণ প্রতিস্থাপনে ইতিমধ্যে অন্তর্ভুক্ত।)

---

*ফেজ ৭ সম্পন্ন। ইউনিট টেস্ট লেখতে, ফিজিক্যাল ডিভাইসে (Samsung/Xiaomi/Pixel) পরীক্ষা করতে, Play Store লিস্টিং প্রস্তুত করতে, এবং KickKey Google Play-এ জমা দিতে ফেজ ৮ — টেস্টিং ও রিলিজ — এ এগিয়ে যান।*
