# KickKey — ফেজ ২ বাস্তবায়ন গাইড
## মূল ইনপুট (সপ্তাহ ৩–৪)

> **লক্ষ্য:** KickKey ব্যবহার করে যেকোনো Android অ্যাপে ইংরেজি টেক্সট টাইপ করা যাবে।
> **ফেজ ১-এর উপর নির্মিত** — IME সার্ভিস, ReactHost প্রি-ওয়ার্ম, এবং `ReactRootView` হোস্ট ইতিমধ্যে কাজ করছে। ফেজ ২ প্লেসহোল্ডার কীবোর্ডকে প্রকৃত কী দিয়ে প্রতিস্থাপন করে, প্রতিটি কী প্রেস `InputConnection`-এর মাধ্যমে ওয়্যার করে, Shift/Caps Lock, সিম্বল প্যানেল, হ্যাপটিক ফিডব্যাক, এবং দীর্ঘ-প্রেস বিকল্প অক্ষর যোগ করে।

---

## বিষয়সূচি

1. [ফেজ ২-এ কী পরিবর্তন হয়](#1-ফেজ-২-তে-কী-পরিবর্তন-হয়)
2. [আপডেটেড ফোল্ডার স্ট্রাকচার](#2-আপডেটেড-ফোল্ডার-স্ট্রাকচার)
3. [টাইপ সংজ্ঞা](#3-টাইপ-সংজ্ঞা)
4. [ডিফল্ট থিম কনস্ট্যান্ট](#4-ডিফল্ট-থিম-কনস্ট্যান্ট)
5. [কীবোর্ড লেআউট সংজ্ঞা](#5-কীবোর্ড-লেআউট-সংজ্ঞা)
6. [আপডেটেড KickKeyModule.kt](#6-আপডেটেড-kickkeymodulekt)
7. [আপডেটেড KickKeyInputMethodService.kt](#7-আপডেটেড-kickkeyinputmethodservicekt)
8. [HapticManager.kt](#8-hapticmanagerkt)
9. [useKeyboardTheme হুক](#9-usekeyboardtheme-হুক)
10. [useKeyboardState হুক](#10-usekeyboardstate-হুক)
11. [Key কম্পোনেন্ট](#11-key-কম্পোনেন্ট)
12. [AltCharsPopup কম্পোনেন্ট](#12-altcharspopup-কম্পোনেন্ট)
13. [KeyRow কম্পোনেন্ট](#13-keyrow-কম্পোনেন্ট)
14. [SuggestionBar কম্পোনেন্ট (প্লেসহোল্ডার)](#14-suggestionbar-কম্পোনেন্ট-প্লেসহোল্ডার)
15. [BottomRow কম্পোনেন্ট](#15-bottomrow-কম্পোনেন্ট)
16. [আপডেটেড KeyboardScreen](#16-আপডেটেড-keyboardscreen)
17. [আপডেটেড keyboard.index.js এন্ট্রি পয়েন্ট](#17-আপডেটেড-keyboardindexjs-এন্ট্রি-পয়েন্ট)
18. [আপডেটেড modules/kickkey-module/index.ts](#18-আপডেটেড-moduleskickkey-moduleindexts)
19. [বিল্ড ও পরীক্ষা](#19-বিল্ড-ও-পরীক্ষা)
20. [যাচাই চেকলিস্ট](#20-যাচাই-চেকলিস্ট)
21. [সমস্যা সমাধান](#21-সমস্যা-সমাধান)

---

## 1. ফেজ ২-তে কী পরিবর্তন হয়

### তৈরি করতে হবে (নতুন ফাইল)

| ফাইল | উদ্দেশ্য |
|---|---|
| `src/keyboard/types.ts` | `KeyDef`, `Theme`, `KeyAction` টাইপ সংজ্ঞা |
| `src/keyboard/constants/defaultTheme.ts` | ডিফল্ট ডার্ক থিম মান |
| `src/keyboard/layouts/english.ts` | সম্পূর্ণ QWERTY লেআউট |
| `src/keyboard/layouts/symbols.ts` | সিম্বল / নম্বর প্যানেল |
| `src/keyboard/layouts/index.ts` | সমস্ত লেআউট রি-এক্সপোর্ট |
| `src/keyboard/hooks/useKeyboardTheme.ts` | SharedPreferences থেকে থিম লোড |
| `src/keyboard/hooks/useKeyboardState.ts` | সমস্ত কী প্রেস স্টেট এবং NativeModules কল |
| `src/keyboard/Key.tsx` | একটি কী কম্পোনেন্ট |
| `src/keyboard/AltCharsPopup.tsx` | দীর্ঘ-প্রেস বিকল্প অক্ষর ওভারলে |
| `src/keyboard/KeyRow.tsx` | কীগুলোর একটি সারি |
| `src/keyboard/SuggestionBar.tsx` | প্লেসহোল্ডার সাজেশন বার (ফেজ ৪-এ ওয়্যার) |
| `src/keyboard/BottomRow.tsx` | স্পেস, এন্টার, ভাষা, ইমোজি, ক্লিপবোর্ড কী |
| `android/.../HapticManager.kt` | কী প্রেসে ভাইব্রেশন |

### প্রতিস্থাপন করতে হবে (ফেজ ১ থেকে)

| ফাইল | কী পরিবর্তন হয় |
|---|---|
| `src/keyboard/KeyboardScreen.tsx` | প্লেসহোল্ডার → প্রকৃত লেআউট |
| `modules/kickkey-module/android/.../KickKeyModule.kt` | `commitKey`, `sendBackspace`, `commitSpace`, `sendEnter`, `getPreferences` যোগ |
| `modules/kickkey-module/index.ts` | নতুন মেথড এক্সপোর্ট |
| `android/.../KickKeyInputMethodService.kt` | `activeInputConnection` এবং `HapticManager` সেট করা |

### মুছে ফেলতে হবে (ফেজ ১ থেকে)

| ফাইল | কারণ |
|---|---|
| `src/keyboard/PlaceholderKey.tsx` | `Key.tsx` দ্বারা প্রতিস্থাপিত |

---

## 2. আপডেটেড ফোল্ডার স্ট্রাকচার

শুধুমাত্র `src/keyboard/` ট্রি এবং নেটিভ মডিউল দেখানো হয়েছে — ফেজ ১ থেকে বাকি সবকিছু অপরিবর্তিত।

```
src/keyboard/
├── KeyboardScreen.tsx          ← ফেজ ১ ভার্সন প্রতিস্থাপন করুন
├── Key.tsx                     ← নতুন
├── KeyRow.tsx                  ← নতুন
├── BottomRow.tsx               ← নতুন
├── SuggestionBar.tsx           ← নতুন (প্লেসহোল্ডার)
├── AltCharsPopup.tsx           ← নতুন
├── types.ts                    ← নতুন
├── constants/
│   └── defaultTheme.ts         ← নতুন
├── layouts/
│   ├── english.ts              ← নতুন
│   ├── symbols.ts              ← নতুন
│   └── index.ts                ← নতুন
└── hooks/
    ├── useKeyboardTheme.ts     ← নতুন
    └── useKeyboardState.ts     ← নতুন

modules/kickkey-module/
├── index.ts                    ← প্রতিস্থাপন করুন
└── android/src/main/java/com/kickkey/
    └── KickKeyModule.kt        ← প্রতিস্থাপন করুন

android/app/src/main/java/com/kickkey/
├── KickKeyInputMethodService.kt   ← প্রতিস্থাপন করুন
└── HapticManager.kt               ← নতুন
```

---

## 3. টাইপ সংজ্ঞা

এই ফাইলটি প্রথমে তৈরি করুন — ফেজ ২-এর প্রতিটি অন্য ফাইল এটি থেকে ইম্পোর্ট করে।

```typescript
// src/keyboard/types.ts

export interface KeyDef {
  /** কী-তে প্রদর্শিত লেবেল (ডিফল্ট লোয়ারকেস) */
  label: string;
  /** Shift সক্রিয় থাকলে প্রদর্শিত লেবেল */
  shiftLabel?: string;
  /** প্রেসে InputConnection-এ কমিট করা অক্ষর স্ট্রিং */
  code: string;
  /** আপেক্ষিক flex প্রস্থ গুণক। ডিফল্ট: ১ */
  width?: number;
  /** দীর্ঘ-প্রেস পপআপে দেখানো অক্ষর */
  altChars?: string[];
  /** বিশেষ কীর আইকন পরিচয় */
  icon?: KeyIcon;
  /** চরিত্র কমিটের পরিবর্তে এই কী যে বিশেষ অ্যাকশন ট্রিগার করে */
  action?: KeyAction;
  /** এই কী বিশেষ কী ব্যাকগ্রাউন্ড রঙ ব্যবহার করে কিনা */
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
  // রঙ
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
  // মাত্রা
  keyHeight: number;
  keyBorderRadius: number;
  keyFontSize: number;
  keyMargin: number;
}
```

---

## 4. ডিফল্ট থিম কনস্ট্যান্ট

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

## 5. কীবোর্ড লেআউট সংজ্ঞা

### ৫.১ ইংরেজি QWERTY

```typescript
// src/keyboard/layouts/english.ts
import type { KeyDef } from '../types';

export const ENGLISH_ROWS: KeyDef[][] = [
  // সারি ১
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
  // সারি ২
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
  // সারি ৩
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

### ৫.২ সিম্বল / নম্বর প্যানেল

```typescript
// src/keyboard/layouts/symbols.ts
import type { KeyDef } from '../types';

export const SYMBOL_ROWS: KeyDef[][] = [
  // সারি ১ — সংখ্যা
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
  // সারি ২ — বিরামচিহ্ন
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
  // সারি ৩ — আরও সিম্বল
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

### ৫.৩ লেআউট রি-এক্সপোর্ট

```typescript
// src/keyboard/layouts/index.ts
export { ENGLISH_ROWS } from './english';
export { SYMBOL_ROWS }  from './symbols';
```

---

## 6. আপডেটেড `KickKeyModule.kt`

ফেজ ১ ভার্সন সম্পূর্ণরূপে প্রতিস্থাপন করুন। এই ভার্সনে `commitKey`, `sendBackspace`, `commitSpace`, `sendEnter`, এবং `getPreferences` যোগ করা হয়েছে। `companion object` সক্রিয় `InputConnection` রেফারেন্স ধরে রাখে যা `KickKeyInputMethodService` প্রতিটি নতুন ইনপুট সেশনে সেট করে।

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
         * KickKeyInputMethodService.onStartInputView() দ্বারা সেট।
         * onFinishInput() দ্বারা পরিষ্কার।
         * সমস্ত commitKey / sendBackspace কল এই রেফারেন্স ব্যবহার করে।
         */
        var activeInputConnection: InputConnection? = null

        /**
         * commitKey হ্যাপটিক ট্রিগার করতে পারে তার জন্য HapticManager রেফারেন্স।
         * KickKeyInputMethodService.onCreate() দ্বারা সেট।
         */
        var hapticManager: HapticManager? = null
    }

    override fun definition() = ModuleDefinition {
        Name("KickKey")

        // ── মূল টেক্সট ইনপুট ──────────────────────────────────────────────────

        /**
         * ফোকাসড টেক্সট ফিল্ডে একটি অক্ষর কমিট করে।
         * ফেজ ২ শুধুমাত্র ইংরেজি — বাংলা রাউটিং ফেজ ৩-এ যোগ হবে।
         * TypeScript-এ useKeyboardState.handleKeyPress() থেকে কল করা হয়।
         */
        Function("commitKey") { code: String, _language: String ->
            val ic = activeInputConnection ?: return@Function
            if (code.isNotEmpty()) {
                ic.commitText(code, 1)
            }
            hapticManager?.vibrate()
        }

        /**
         * কার্সারের আগের অক্ষর মুছে দেয়।
         * ফিজিক্যাল Backspace কী প্রেসের সমতুল্য।
         */
        Function("sendBackspace") {
            activeInputConnection?.deleteSurroundingText(1, 0)
            hapticManager?.vibrate()
        }

        /**
         * একটি স্পেস অক্ষর কমিট করে।
         * ফেজ ৪ এটিকে শীর্ষ সাজেশন অটো-কমিটে আপগ্রেড করবে।
         */
        Function("commitSpace") {
            activeInputConnection?.commitText(" ", 1)
            hapticManager?.vibrate()
        }

        /**
         * ফোকাসড ফিল্ডে Enter কী ইভেন্ট পাঠায়।
         * সমস্ত অ্যাপে কাজ করে (চ্যাট, ফর্ম, সার্চ বার)।
         */
        Function("sendEnter") {
            val ic = activeInputConnection ?: return@Function
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP,   KeyEvent.KEYCODE_ENTER))
            hapticManager?.vibrate()
        }

        // ── প্রেফারেন্স ──────────────────────────────────────────────────────

        /**
         * SharedPreferences থেকে বর্তমান কীবোর্ড প্রেফারেন্স ফেরত দেয়।
         * মাউন্টে useKeyboardTheme.ts দ্বারা কল করা হয় রঙ ও মাত্রা সেট করতে।
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
         * কম্প্যানিয়ন অ্যাপ (ফেজ ৫) দ্বারা সেট করা প্রেফারেন্স লেখে।
         * কীবোর্ড পরবর্তী খোলায় getPreferences() দ্বারা এগুলো পড়ে।
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

        // ── IME স্ট্যাটাস (ফেজ ১ থেকে বহন করা) ────────────────────────────────

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

        // ── ফেজ ৪+ স্টাব (এখনো বাস্তবায়ন করবেন না) ──────────────────────────
        // commitSuggestion, getClipboardHistory
    }
}
```

---

## 7. আপডেটেড `KickKeyInputMethodService.kt`

ফেজ ১ থেকে মূল পরিবর্তন: নতুন ইনপুট সেশন শুরু হলে `InputConnection` কে `KickKeyModule.activeInputConnection`-এ স্টোর করুন, এবং শেষ হলে পরিষ্কার করুন। এছাড়াও `HapticManager` ইনিশিয়ালাইজ করুন।

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
        // HapticManager একবার ইনিশিয়ালাইজ করুন; প্রতিটি কী প্রেসে প্রি-তৈরি VibrationEffect পুনরায় ব্যবহার করুন
        KickKeyModule.hapticManager = HapticManager(this)
        Log.i(TAG, "IME সার্ভিস তৈরি হয়েছে")
    }

    override fun onCreateInputView(): View {
        Log.i(TAG, "onCreateInputView কল হয়েছে")
        val app = application as? KickKeyApplication ?: run {
            Log.e(TAG, "KickKeyApplication পাওয়া যায়নি")
            return View(this)
        }
        reactRootView = ReactRootView(this)
        reactRootView!!.startReactApplication(
            app.keyboardReactHost,
            "KickKeyKeyboard",
            null
        )
        Log.i(TAG, "ReactRootView শুরু হয়েছে")
        return reactRootView!!
    }

    /**
     * প্রতিবার ব্যবহারকারী নতুন টেক্সট ফিল্ডে ফোকাস করলে কল হয়।
     * গুরুত্বপূর্ণ: এখানে currentInputConnection স্টোর করুন যাতে KickKeyModule ব্যবহার করতে পারে।
     */
    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        // KickKeyModule-কে লাইভ InputConnection অ্যাক্সেস দিন
        KickKeyModule.activeInputConnection = currentInputConnection
        Log.i(TAG, "InputConnection অর্জিত — inputType: ${info.inputType}")
    }

    /**
     * ব্যবহারকারী টেক্সট ফিল্ড ছেড়ে গেলে কল হয়।
     * InputConnection পরিষ্কার করুন যাতে পুরনো কমিট না হয়।
     */
    override fun onFinishInput() {
        super.onFinishInput()
        KickKeyModule.activeInputConnection = null
        Log.i(TAG, "InputConnection মুক্ত করা হয়েছে")
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        KickKeyModule.activeInputConnection = null
        Log.i(TAG, "কীবোর্ড লুকানো হয়েছে")
    }

    override fun onDestroy() {
        reactRootView?.unmountReactApplication()
        reactRootView = null
        KickKeyModule.hapticManager = null
        super.onDestroy()
        Log.i(TAG, "IME সার্ভিস ধ্বংস হয়েছে")
    }
}
```

---

## 8. `HapticManager.kt`

এই নতুন ফাইলটি তৈরি করুন। IME স্টার্টআপে একবার `VibrationEffect` প্রি-তৈরি করে এবং প্রতিটি কী প্রেসে পুনরায় ব্যবহার করে — প্রতিটি কী প্রেসে নতুন ইফেক্ট বরাদ্দ করলে মাপযোগ্য লেটেন্সি হতো।

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
        private const val VIBRATION_MS = 25L   // ২৫ms — তাৎক্ষণিক অনুভব করার জন্য যথেষ্ট ছোট
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
        Log.w(TAG, "Vibrator পাওয়া যায়নি: ${e.message}")
        null
    }

    // ইফেক্ট একবার প্রি-তৈরি করুন — vibrate()-এর ভেতরে তৈরি করবেন না
    private val effect: VibrationEffect? = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            VibrationEffect.createOneShot(
                VIBRATION_MS,
                VibrationEffect.DEFAULT_AMPLITUDE
            )
        } else null
    } catch (e: Exception) {
        Log.w(TAG, "VibrationEffect তৈরি করা যায়নি: ${e.message}")
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
            Log.w(TAG, "ভাইব্রেশন ব্যর্থ: ${e.message}")
        }
    }
}
```

---

## 9. `useKeyboardTheme` হুক

এই হুক মাউন্টে `NativeModules.KickKey.getPreferences` দ্বারা `SharedPreferences` থেকে থিম মান লোড করে। কীবোর্ড সমস্ত রঙ ও সাইজিংয়ের জন্য এই মান ব্যবহার করে।

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
    // মাউন্টে একবার প্রেফারেন্স লোড করুন
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
        // SharedPreferences অ্যাক্সেসযোগ্য নয় (প্রথম লঞ্চ বা :ime_process কোল্ড স্টার্ট)
        // DEFAULT_DARK_THEME নীরবে ব্যবহার করুন
      });
  }, []);

  return theme;
}
```

---

## 10. `useKeyboardState` হুক

এটি কীবোর্ডের কেন্দ্রীয় স্টেট হুক। Shift/Caps Lock, সিম্বল মোড পরিচালনা করে এবং `NativeModules.KickKey` দ্বারা Kotlin-এ সমস্ত কী অ্যাকশন ডিসপ্যাচ করে।

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

  // দীর্ঘ-প্রেস ব্যাকস্পেস ইন্টারভাল-এর জন্য রেফ ধরে রাখুন
  const backspacePressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── নেটিভ ইভেন্ট লিসেনার ───────────────────────────────────────────────

  useEffect(() => {
    // ফেজ ৪ সাজেশন পপুলেট করবে; এখন শুধু লিসেনার ওয়্যার করুন
    const subSuggestions = emitter.addListener('onSuggestionsUpdated', (data) => {
      setSuggestions(data.suggestions ?? []);
    });

    // নতুন ইনপুট শুরু হলে ফিল্ড টাইপ অনুযায়ী কীবোর্ড মানিয়ে নিন
    const subInput = emitter.addListener('onInputStarted', (data) => {
      const inputType: number = data.inputType ?? 0;
      const isPasswordField = (inputType & 0x80) !== 0;   // TYPE_TEXT_VARIATION_PASSWORD
      if (isPasswordField) setSuggestions([]);
      setIsSymbol(false);
      setIsEmoji(false);
      setIsClipboard(false);
    });

    // কীবোর্ড লুকালে ভারী প্যানেল মুক্ত করুন
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

  // আনমাউন্টে দীর্ঘ-প্রেস ইন্টারভাল পরিষ্কার করুন
  useEffect(() => {
    return () => {
      if (backspacePressRef.current) clearInterval(backspacePressRef.current);
    };
  }, []);

  // ── কী প্রেস হ্যান্ডলার ───────────────────────────────────────────────────

  const handleKeyPress = useCallback((key: KeyDef) => {
    if (!key.code) return;  // অ্যাকশন-মাত্র কী তাদের নিজস্ব হ্যান্ডলার দ্বারা পরিচালিত

    KickKey.commitKey(key.code, language);

    // একটি অক্ষরের পরে Shift রিসেট করুন (Caps Lock নয়)
    if (isShift && !isCapsLock) {
      setIsShift(false);
    }
  }, [language, isShift, isCapsLock]);

  const handleBackspace = useCallback(() => {
    KickKey.sendBackspace();
  }, []);

  /**
   * দীর্ঘ-প্রেস ব্যাকস্পেস: আঙুল ধরে রাখাকালীন প্রতি ৮০ms-এ মুছতে থাকে।
   * আঙুল তুললে handleBackspaceLongPressEnd() কল করুন।
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
   * Shift স্টেট মেশিন:
   *   বন্ধ → shift (এক অক্ষর) → caps lock (সক্রিয় থাকে) → বন্ধ
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
    // ফেজ ৪ এটিকে KickKey.commitSuggestion()-এ ওয়্যার করে; এখন টেক্সট হিসেবে কমিট করুন
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

## 11. `Key` কম্পোনেন্ট

একটি কী সেল। `React.memo` দিয়ে মেমোইজড — একটি সারি শুধুমাত্র `isShift` বা `theme` পরিবর্তিত হলে পুনরায় রেন্ডার হয়।

```tsx
// src/keyboard/Key.tsx
import React, { useCallback } from 'react';
import {
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

function Key({
  keyDef,
  theme,
  isShift,
  isCapsLock,
  onPress,
  onLongPress,
  onLongPressEnd,
}: KeyProps) {
  const active = isShift || isCapsLock;

  // প্রদর্শিত লেবেল নির্ধারণ করুন
  const label = active && keyDef.shiftLabel
    ? keyDef.shiftLabel
    : active && keyDef.code.length === 1
    ? keyDef.code.toUpperCase()
    : keyDef.label;

  // কমিট করা কোড Shift সক্রিয় থাকলে আপারকেস হয়
  const codeToSend = active && keyDef.code.length === 1
    ? keyDef.code.toUpperCase()
    : keyDef.code;

  const effectiveKey: KeyDef = { ...keyDef, code: codeToSend };

  const handlePress = useCallback(() => {
    onPress(effectiveKey);
  }, [effectiveKey, onPress]);

  const handleLongPress = useCallback(() => {
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
      {/* আইকন-মাত্র কী */}
      {keyDef.icon === 'shift' && (
        <Text style={[styles.iconText, { color: isSpecial ? theme.specialKeyText : theme.keyText }]}>
          {isCapsLock ? '⇪' : '⇧'}
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

      {/* স্ট্যান্ডার্ড টেক্সট কী */}
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

      {/* Alt অক্ষর হিন্ট (উপরে-ডান কোণে) */}
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
    prev.keyDef     === next.keyDef     &&
    prev.isShift    === next.isShift    &&
    prev.isCapsLock === next.isCapsLock &&
    prev.theme      === next.theme
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

## 12. `AltCharsPopup` কম্পোনেন্ট

একটি অক্ষর কী দীর্ঘ-প্রেস করলে দেখানো হয়। প্রেস করা কীর উপরে বিকল্প অক্ষরের একটি অনুভূমিক স্ট্রিপ রেন্ডার করে।

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
  anchorX: number;   // প্রেস করা কীর X অবস্থান
  anchorY: number;   // প্রেস করা কীর Y অবস্থান
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

  // স্ক্রিনের ডান প্রান্ত থেকে বেরিয়ে না যেতে ক্ল্যাম্প করুন
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
      {/* অদৃশ্য পূর্ণ-স্ক্রিন ব্যাকড্রপ — যেকোনো জায়গায় ট্যাপ করে বন্ধ করুন */}
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
  backdrop: { flex: 1 },
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
  popupChar: { fontWeight: '500' },
});
```

---

## 13. `KeyRow` কম্পোনেন্ট

`Key` কম্পোনেন্টের একটি অনুভূমিক সারি রেন্ডার করে। Alt অক্ষরের জন্য দীর্ঘ-প্রেস পপআপ স্টেট পরিচালনা করে, এবং ব্যাকস্পেস দীর্ঘ-প্রেসকে রিপিট ডিলিট হ্যান্ডলারে রুট করে।

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
    // কীতে Alt অক্ষর থাকলে পপআপ দেখান
    if (key.altChars && key.altChars.length > 0) {
      setPopup({
        chars: key.altChars,
        anchorX: 80,    // আনুমানিক — সঠিক কো-অর্ড প্রয়োজনে onLayout + measure() ব্যবহার করুন
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

## 14. `SuggestionBar` কম্পোনেন্ট (প্লেসহোল্ডার)

ফেজ ২-এর জন্য একটি ন্যূনতম সাজেশন বার। চিপস রেন্ডার করে কিন্তু ফেজ ২-এ সবসময় খালি থাকে। ফেজ ৪-এ কার্যকর হয়।

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
            {/* ফেজ ২-এ খালি — সাজেশন ফেজ ৪-এ ওয়্যার হবে */}
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

## 15. `BottomRow` কম্পোনেন্ট

নিচের সারিতে সিম্বল টগল, ভাষা সুইচ, স্পেসবার, এবং এন্টার কী থাকে।

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
      {/* সিম্বল টগল */}
      <TouchableOpacity
        style={[styles.specialKey, specialStyle, { flex: 1.5 }]}
        onPress={onSymbolToggle}
        activeOpacity={0.55}
      >
        <Text style={[styles.specialLabel, { color: theme.specialKeyText, fontSize: 13 }]}>
          {isSymbol ? 'ABC' : '!#1'}
        </Text>
      </TouchableOpacity>

      {/* ভাষা সুইচ */}
      <TouchableOpacity
        style={[styles.specialKey, specialStyle, { flex: 1 }]}
        onPress={onLanguageSwitch}
        activeOpacity={0.55}
      >
        <Text style={[styles.specialLabel, { color: theme.specialKeyText, fontSize: 12 }]}>
          {language === 'en' ? '🌐 EN' : '🌐 বাং'}
        </Text>
      </TouchableOpacity>

      {/* স্পেসবার */}
      <TouchableOpacity
        style={[styles.spaceKey, spaceStyle, { flex: 5 }]}
        onPress={onSpace}
        activeOpacity={0.7}
      >
        <Text style={[styles.spaceLabel, { color: theme.altText }]}>
          space
        </Text>
      </TouchableOpacity>

      {/* ইমোজি টগল */}
      <TouchableOpacity
        style={[styles.specialKey, specialStyle, { flex: 1 }]}
        onPress={onEmojiToggle}
        activeOpacity={0.55}
      >
        <Text style={styles.emojiLabel}>😊</Text>
      </TouchableOpacity>

      {/* এন্টার */}
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
  specialKey: { justifyContent: 'center', alignItems: 'center', elevation: 2 },
  spaceKey:   { justifyContent: 'center', alignItems: 'center', elevation: 2 },
  specialLabel: { fontWeight: '500', textAlign: 'center' },
  spaceLabel:   { fontSize: 13 },
  emojiLabel:   { fontSize: 20 },
});
```

---

## 16. আপডেটেড `KeyboardScreen`

ফেজ ১ প্লেসহোল্ডার সম্পূর্ণরূপে প্রতিস্থাপন করুন।

```tsx
// src/keyboard/KeyboardScreen.tsx

/**
 * ফেজ ২ — সম্পূর্ণ ইংরেজি কীবোর্ড।
 *
 * - NativeModules.KickKey.commitKey() দ্বারা প্রকৃত QWERTY কী কমিট
 * - useKeyboardState-এ Shift / Caps Lock স্টেট
 * - সিম্বল প্যানেল (সংখ্যা + বিরামচিহ্ন)
 * - দীর্ঘ-প্রেস Alt অক্ষর পপআপ
 * - প্রতিটি কীতে হ্যাপটিক ফিডব্যাক (Kotlin HapticManager দ্বারা)
 * - সাজেশন বার প্লেসহোল্ডার (ফেজ ৪-এ ওয়্যার)
 * - ইমোজি ও ক্লিপবোর্ড প্যানেল স্টাব (ফেজ ৬-এ ওয়্যার)
 *
 * ⚠️ কম্প্যানিয়ন অ্যাপ বান্ডেল থেকে ইম্পোর্ট করবেন না।
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
    handleKeyPress, handleBackspace, handleBackspaceLongPress,
    handleSpace, handleEnter, handleShift, handleLanguageSwitch,
    handleSymbolToggle, handleEmojiToggle, handleClipboardToggle,
    handleSuggestionSelect,
  } = useKeyboardState();

  const rows = isSymbol ? SYMBOL_ROWS : ENGLISH_ROWS;

  // ফেজ ২-এ ইমোজি ও ক্লিপবোর্ড স্টাব — ফেজ ৬-এ সম্পূর্ণরূপে ওয়্যার হবে
  if (isEmoji) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <Text style={[styles.stubText, { color: theme.altText }]}>
          😊 ইমোজি প্যানেল ফেজ ৬-এ আসছে
        </Text>
        <Text style={[styles.stubClose, { color: theme.suggestionText }]}
          onPress={handleEmojiToggle}
        >
          বন্ধ করুন
        </Text>
      </View>
    );
  }

  if (isClipboard) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <Text style={[styles.stubText, { color: theme.altText }]}>
          📋 ক্লিপবোর্ড প্যানেল ফেজ ৬-এ আসছে
        </Text>
        <Text style={[styles.stubClose, { color: theme.suggestionText }]}
          onPress={handleClipboardToggle}
        >
          বন্ধ করুন
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
      {/* সাজেশন বার — ফেজ ২-এ প্লেসহোল্ডার, ফেজ ৪-এ কার্যকর */}
      <SuggestionBar
        suggestions={suggestions}
        onSelect={handleSuggestionSelect}
        theme={theme}
      />

      {/* কী সারি (QWERTY বা সিম্বল) */}
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

      {/* নিচের সারি: সিম্বল, ভাষা, স্পেস, ইমোজি, এন্টার */}
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

## 17. আপডেটেড `keyboard.index.js` এন্ট্রি পয়েন্ট

ফেজ ২-এ কোনো পরিবর্তন দরকার নেই — এন্ট্রি পয়েন্ট ইতিমধ্যে `KickKeyKeyboard` নিবন্ধন করে। শুধুমাত্র ইম্পোর্ট করা `KeyboardScreen` পরিবর্তিত হয় (ফাইলটি যথাস্থানে প্রতিস্থাপিত হয়)।

```javascript
// keyboard.index.js  (পরিবর্তন দরকার নেই — রেফারেন্সের জন্য দেখানো)
import { AppRegistry } from 'react-native';
import KeyboardScreen from './src/keyboard/KeyboardScreen';

AppRegistry.registerComponent('KickKeyKeyboard', () => KeyboardScreen);
```

---

## 18. আপডেটেড `modules/kickkey-module/index.ts`

ফেজ ২-এ যোগ হওয়া নতুন মেথড যোগ করুন।

```typescript
// modules/kickkey-module/index.ts
import { NativeModules } from 'react-native';

const { KickKey } = NativeModules;

export default {
  // ── ফেজ ১ (বহন করা) ────────────────────────────────────────────────────
  isDefaultKeyboard:   (): Promise<boolean> => KickKey.isDefaultKeyboard(),
  isKeyboardEnabled:   (): Promise<boolean> => KickKey.isKeyboardEnabled(),
  openKeyboardSettings:(): void             => KickKey.openKeyboardSettings(),

  // ── ফেজ ২ (নতুন) ─────────────────────────────────────────────────────────

  /**
   * বর্তমান ফোকাসড টেক্সট ফিল্ডে একটি অক্ষর কমিট করে।
   * @param code     ইনসার্ট করার অক্ষর স্ট্রিং (যেমন 'a', 'A', '!', ' ')
   * @param language 'en' বা 'bn' — বাংলা রাউটিং ফেজ ৩-এ যোগ হবে
   */
  commitKey: (code: string, language: string): Promise<void> =>
    KickKey.commitKey(code, language),

  /**
   * কার্সারের আগের অক্ষর মুছে দেয়।
   */
  sendBackspace: (): Promise<void> =>
    KickKey.sendBackspace(),

  /**
   * স্পেস কমিট করে। ফেজ ৪ এটিকে শীর্ষ সাজেশন অটো-কমিটে আপগ্রেড করে।
   */
  commitSpace: (): Promise<void> =>
    KickKey.commitSpace(),

  /**
   * ফোকাসড ফিল্ডে Enter কী ইভেন্ট পাঠায়।
   */
  sendEnter: (): Promise<void> =>
    KickKey.sendEnter(),

  /**
   * বর্তমান কীবোর্ড প্রেফারেন্স ফেরত দেয় (থিম, লেআউট, হ্যাপটিক ফ্ল্যাগ)।
   * মাউন্টে useKeyboardTheme দ্বারা ব্যবহৃত।
   */
  getPreferences: (): Promise<Record<string, any>> =>
    KickKey.getPreferences(),

  /**
   * প্রেফারেন্স পার্সিস্ট করে যাতে কীবোর্ড পরবর্তী খোলায় পড়তে পারে।
   * কম্প্যানিয়ন অ্যাপ দ্বারা কল করা হয় (ফেজ ৫)।
   */
  savePreferences: (prefs: Record<string, any>): Promise<void> =>
    KickKey.savePreferences(prefs),
};
```

---

## 19. বিল্ড ও পরীক্ষা

### ১৯.১ ফেজ ১ প্লেসহোল্ডার মুছুন

```bash
rm src/keyboard/PlaceholderKey.tsx
```

### ১৯.২ `keyboard.bundle` পুনরায় বিল্ড করুন

`src/keyboard/`-এর ভেতরে যেকোনো ফাইল পরিবর্তিত হলে বান্ডেল পুনরায় বিল্ড করুন:

```bash
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify false        # ডেভেলপমেন্টের সময় false রাখুন পাঠযোগ্য ত্রুটি বার্তার জন্য
```

### ১৯.৩ বিল্ড ও ইনস্টল করুন

```bash
# দ্রুত লোকাল বিল্ড (দ্রুততম ইটারেশন)
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk

# অথবা EAS ক্লাউড বিল্ড
eas build --platform android --profile development
```

### ১৯.৪ লগ মনিটর করুন

```bash
# IME লাইফসাইকেল এবং InputConnection ইভেন্ট
adb logcat -s KickKeyIME

# কীবোর্ড বান্ডেলে React Native JS এক্সেপশন
adb logcat -s ReactNativeJS

# হ্যাপটিক ম্যানেজার
adb logcat -s HapticManager
```

কী প্রেস করলে প্রত্যাশিত লগ সিকোয়েন্স:
```
I/KickKeyIME: InputConnection অর্জিত — inputType: 1
I/KickKeyIME: onCreateInputView কল হয়েছে
I/KickKeyIME: ReactRootView শুরু হয়েছে
# ... ব্যবহারকারী 'h' প্রেস করে ...
# ... ব্যবহারকারী 'e' প্রেস করে ...
# ... 'hello' টার্গেট অ্যাপে টাইপ হয়েছে
```

---

## 20. যাচাই চেকলিস্ট

ফেজ ৩-এ যাওয়ার আগে প্রতিটি আইটেম সম্পন্ন করুন।

### Kotlin / নেটিভ
- [ ] `HapticManager.kt` ত্রুটি ছাড়া কম্পাইল হয়
- [ ] `KickKeyInputMethodService.kt` ত্রুটি ছাড়া কম্পাইল হয়
- [ ] `KickKeyModule.kt` কম্পাইল হয় — পাঁচটি নতুন ফাংশন উপস্থিত
- [ ] `adb logcat -s KickKeyIME` টেক্সট ফিল্ড ট্যাপে "InputConnection অর্জিত" দেখায়

### মূল টাইপিং
- [ ] WhatsApp বা Notes-এ `hello` টাইপ করলে "hello" তৈরি হয়
- [ ] সমস্ত ২৬টি ছোট হাতের অক্ষর সঠিকভাবে টাইপ হয়
- [ ] সিম্বল প্যানেলে নম্বর সারি `1` থেকে `0` টাইপ করে
- [ ] সিম্বল প্যানেলে বিরামচিহ্ন সঠিকভাবে টাইপ হয়

### Shift ও Caps Lock
- [ ] একক Shift ট্যাপ → পরবর্তী অক্ষর বড় হাতে → Shift রিসেট
- [ ] ডাবল Shift ট্যাপ → Caps Lock সক্রিয় → সমস্ত অক্ষর বড় হাতে
- [ ] তৃতীয় Shift ট্যাপ → Caps Lock বন্ধ → ছোট হাতে ফিরে
- [ ] Shift কী আইকন পরিবর্তিত হয়: `⇧` (বন্ধ) → `⇧` (এক-শট) → `⇪` (Caps Lock)

### ব্যাকস্পেস
- [ ] একক ট্যাপ একটি অক্ষর মুছে
- [ ] দীর্ঘ-প্রেস ধরে রাখলে প্রতি ~৮০ms-এ অক্ষর মুছতে থাকে
- [ ] আঙুল তুললে রিপিট মুছা বন্ধ হয়

### বিশেষ কী
- [ ] স্পেস একটি স্পেস অক্ষর ইনসার্ট করে
- [ ] Enter ফর্ম সাবমিট / নতুন লাইন তৈরি করে অ্যাপ অনুযায়ী
- [ ] `!#1` বাটন সিম্বল প্যানেলে যায়
- [ ] সিম্বল প্যানেলে `ABC` বাটন QWERTY-তে ফেরত আসে
- [ ] `🌐` ভাষা সুইচ বাটন `EN` এবং `বাং` লেবেলের মধ্যে টগল করে

### Alt অক্ষর পপআপ
- [ ] `e` দীর্ঘ-প্রেস করলে `è é ê ë 3` সহ পপআপ দেখায়
- [ ] পপআপে অক্ষর ট্যাপ করলে কমিট হয়
- [ ] পপআপের বাইরে ট্যাপ করলে কমিট ছাড়া বন্ধ হয়

### হ্যাপটিক ফিডব্যাক
- [ ] প্রতিটি কী প্রেসে সংক্ষিপ্ত ভাইব্রেশন (~২৫ms)
- [ ] সিস্টেম সেটিংসে ভাইব্রেশন বন্ধ থাকলে কোনো ভাইব্রেশন নেই

### পারফরম্যান্স
- [ ] কীবোর্ড ৮০ms-এর মধ্যে খোলে
- [ ] দ্রুত ক্রমাগত টাইপিংয়ের সময় কোনো জ্যাংক নেই
- [ ] `adb logcat`-এ টাইপিংয়ের সময় `ReactNativeJS` ত্রুটি বা সতর্কতা নেই

---

## 21. সমস্যা সমাধান

### অক্ষর টাইপ হয় কিন্তু স্ক্রিনে কিছু দেখা যায় না

**কারণ:** `KickKeyModule.activeInputConnection` null — সার্ভিস এটি সেট করছে না।

**সমাধান:** নিশ্চিত করুন `KickKeyInputMethodService.onStartInputView()` কল করে:
```kotlin
KickKeyModule.activeInputConnection = currentInputConnection
```
"InputConnection অর্জিত" এর জন্য `adb logcat -s KickKeyIME` পরীক্ষা করুন।

---

### কিছু অ্যাপে টাইপিং কাজ করে কিন্তু Gmail, Chrome URL বারে করে না

**কারণ:** কিছু অ্যাপ `content-editable`-এ `beginBatchEdit` / `endBatchEdit` মোড়ক প্রয়োজন করে।

**সমাধান:** `KickKeyModule.kt`-এ কমিট মোড়ক করুন:
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

### দীর্ঘ-প্রেস ব্যাকস্পেস আঙুল তুললে বন্ধ হয় না

**কারণ:** `onPressOut` `handleBackspaceLongPressEnd`-এ পৌঁছাচ্ছে না।

**সমাধান:** `KeyRow.tsx`-এ নিশ্চিত করুন `Key` পায়:
```tsx
onLongPressEnd={() => handleLongPressEnd(key)}
```
এবং `Key.tsx` এটি `TouchableOpacity`-তে পাস করে:
```tsx
<TouchableOpacity onPressOut={onLongPressEnd} ...>
```

---

### `keyboard.bundle` বিল্ড ব্যর্থ হয় "'./types' মডিউল খুঁজে পাওয়া যায়নি"

**কারণ:** `types.ts` তৈরি হয়েছে কিন্তু TypeScript রিসলভ করতে পারছে না।

**সমাধান:**
```bash
# ফাইল বিদ্যমান কিনা নিশ্চিত করুন
ls src/keyboard/types.ts
```
আপেক্ষিক ইম্পোর্ট ব্যবহার করুন: `import type { KeyDef } from '../types'` (বা `'./types'`)

---

### Alt অক্ষর পপআপ ভুল অবস্থানে দেখায়

**কারণ:** `KeyRow.handleLongPress`-এ অ্যাঙ্কর কো-অর্ডিনেট হার্ডকোড করা (`anchorX: 80, anchorY: 200`)।

**সমাধান:** প্রতিটি `Key`-এ `onLayout` + `ref.measure()` ব্যবহার করুন প্রকৃত স্ক্রিন কো-অর্ড পেতে এবং পপআপে পাস করুন। ফেজ ২-এ আনুমানিক অবস্থান গ্রহণযোগ্য।

---

### কোনো হ্যাপটিক ফিডব্যাক নেই

**কারণ ১:** Manifest থেকে `VIBRATE` অনুমতি নেই।

**পরীক্ষা:** `grep VIBRATE android/app/src/main/AndroidManifest.xml`

**কারণ ২:** `HapticManager` ইনিশিয়ালাইজড নয় — `KickKeyModule.hapticManager` null।

**পরীক্ষা:** `adb logcat -s KickKeyIME | grep "IME সার্ভিস তৈরি"`

**সমাধান:** নিশ্চিত করুন `KickKeyInputMethodService.onCreate()` কল করে:
```kotlin
KickKeyModule.hapticManager = HapticManager(this)
```

---

*ফেজ ২ সম্পন্ন। ফোনেটিক ট্রান্সলিটারেশন এবং বাংলা লেআউট যোগ করতে ফেজ ৩ — বাংলা ইনপুট — এ এগিয়ে যান।*
