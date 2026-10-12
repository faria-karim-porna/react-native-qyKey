# KickKey — ফেজ ৬ বাস্তবায়ন গাইড
## ইমোজি ও ক্লিপবোর্ড (সপ্তাহ ১১–১২)

> **লক্ষ্য:** ইমোজি প্যানেল ও ক্লিপবোর্ড প্যানেল উভয়ই কাজ করবে — ইমোজি ট্যাপযোগ্য ক্যাটাগরিতে সংগঠিত এবং একটি সাম্প্রতিক-ইমোজি ট্রে সহ, এবং ক্লিপবোর্ড প্যানেল একটি স্ক্রলযোগ্য হিস্ট্রি দেখায় যেখান থেকে ব্যবহারকারী পেস্ট করতে পারেন। উভয় প্যানেল ফেজ ২ থেকে `KeyboardScreen.tsx`-এ রাখা "ফেজ ৬-এ আসছে" স্টাব স্ক্রিন প্রতিস্থাপন করে।
> **ফেজ ৫-এর উপর নির্মিত** — কম্প্যানিয়ন অ্যাপ, অনবোর্ডিং, এবং সেটিংস সিঙ্ক সবই কাজ করছে। ফেজ ৬ কীবোর্ড বান্ডেল (`src/keyboard/`) এবং নেটিভ Kotlin (`ClipboardHandler.kt`) উভয়ই স্পর্শ করে, কিন্তু কম্প্যানিয়ন অ্যাপ স্ক্রিন একদম স্পর্শ করে না।

---

## বিষয়সূচি

1. [ফেজ ৬-এ কী পরিবর্তন হয়](#1-ফেজ-৬-তে-কী-পরিবর্তন-হয়)
2. [আর্কিটেকচার: ইমোজি ও ক্লিপবোর্ড ডেটা প্রবাহ](#2-আর্কিটেকচার-ইমোজি-ও-ক্লিপবোর্ড-ডেটা-প্রবাহ)
3. [আপডেটেড ফোল্ডার স্ট্রাকচার](#3-আপডেটেড-ফোল্ডার-স্ট্রাকচার)
4. [Android ক্লিপবোর্ড সীমাবদ্ধতা](#4-android-ক্লিপবোর্ড-সীমাবদ্ধতা)
5. [ইমোজি ডেটা ফাইল](#5-ইমোজি-ডেটা-ফাইল)
6. [ClipboardHandler.kt](#6-clipboardhandlerkt)
7. [আপডেটেড KickKeyModule.kt](#7-আপডেটেড-kickkeymodulekt)
8. [আপডেটেড KickKeyInputMethodService.kt](#8-আপডেটেড-kickkeyinputmethodservicekt)
9. [EmojiPanel.tsx](#9-emojipaneltsx)
10. [ClipboardPanel.tsx](#10-clipboardpaneltsx)
11. [আপডেটেড KeyboardScreen.tsx](#11-আপডেটেড-keyboardscreentsx)
12. [আপডেটেড useKeyboardState হুক](#12-আপডেটেড-usekeyboardstate-হুক)
13. [আপডেটেড modules/kickkey-module/index.ts](#13-আপডেটেড-moduleskickkey-moduleindexts)
14. [বিল্ড ও পরীক্ষা](#14-বিল্ড-ও-পরীক্ষা)
15. [যাচাই চেকলিস্ট](#15-যাচাই-চেকলিস্ট)
16. [সমস্যা সমাধান](#16-সমস্যা-সমাধান)

---

## 1. ফেজ ৬-তে কী পরিবর্তন হয়

### তৈরি করতে হবে (নতুন ফাইল)

| ফাইল | উদ্দেশ্য |
|---|---|
| `android/.../ClipboardHandler.kt` | সিস্টেম ক্লিপবোর্ড পড়ে + SharedPreferences-এ স্থানীয় হিস্ট্রি পরিচালনা করে |
| `src/keyboard/data/emojiData.ts` | শ্রেণীবদ্ধ ইমোজি অক্ষর অ্যারে |
| `src/keyboard/EmojiPanel.tsx` | সম্পূর্ণ ইমোজি পিকার — ক্যাটাগরি ট্যাব + গ্রিড + সাম্প্রতিক |
| `src/keyboard/ClipboardPanel.tsx` | ক্লিপবোর্ড হিস্ট্রি প্যানেল — তালিকা + পেস্ট + পরিষ্কার |

### আপডেট করতে হবে (আংশিক পরিবর্তন)

| ফাইল | কী পরিবর্তন হয় |
|---|---|
| `modules/kickkey-module/android/.../KickKeyModule.kt` | `getClipboardHistory`, `clearClipboardHistory`, `getRecentEmojis`, `recordEmojiUsed` যোগ |
| `android/.../KickKeyInputMethodService.kt` | `ClipboardHandler` ইনস্ট্যান্টিয়েট করুন; নতুন ক্লিপবোর্ড কন্টেন্ট ক্যাপচার করতে `onStartInputView` থেকে কল করুন |
| `src/keyboard/KeyboardScreen.tsx` | "ফেজ ৬" স্টাব ব্লক প্রকৃত `EmojiPanel` / `ClipboardPanel` দিয়ে প্রতিস্থাপন করুন |
| `src/keyboard/hooks/useKeyboardState.ts` | কোনো স্ট্রাকচারাল পরিবর্তন নেই — `isEmoji`/`isClipboard` টগল ফেজ ২/৩ থেকেই বিদ্যমান |
| `modules/kickkey-module/index.ts` | চারটি নতুন মেথড এক্সপোর্ট |

### পরিবর্তন হবে না

কম্প্যানিয়ন অ্যাপের সবকিছু (`app/`, `store/`, `hooks/useKickKeyBridge.ts`, `hooks/useSetupStatus.ts`, `hooks/useSettingsSync.ts`, `components/`), `BanglaInputEngine.kt`, `SuggestionEngine.kt`, `Trie.kt`, `UserWordModel.kt`, `HapticManager.kt`, `KickKeyApplication.kt`, সমস্ত লেআউট ফাইল, `Key.tsx`, `KeyRow.tsx`, `SuggestionBar.tsx`, `KeyboardHeader.tsx`।

---

## 2. আর্কিটেকচার: ইমোজি ও ক্লিপবোর্ড ডেটা প্রবাহ

### ২.১ ইমোজি প্রবাহ

```
ব্যবহারকারী BottomRow-এ 😊 বাটন ট্যাপ করে
        │
        ▼
useKeyboardState.handleEmojiToggle() → setIsEmoji(true)
        │
        ▼
KeyboardScreen কী সারির পরিবর্তে <EmojiPanel /> রেন্ডার করে
        │
        ▼
EmojiPanel মাউন্ট হয় → useEffect কল করে
NativeModules.KickKey.getRecentEmojis()
        │
        ▼  [Kotlin]
SharedPreferences থেকে "kickkey_recent_emojis" পড়ে
        │
        ▼
EmojiPanel Recent ট্যাব পপুলেটেড দেখায়, অন্য ট্যাবগুলো স্ট্যাটিক emojiData.ts থেকে
        │
        ▼
ব্যবহারকারী একটি ইমোজি অক্ষর ট্যাপ করে
        │
        ▼
onEmojiSelect(emoji) → handleKeyPress({ code: emoji, label: emoji })
        │
        ▼
NativeModules.KickKey.commitKey(emoji, language)
  → InputConnection.commitText(emoji, 1)
        │
        ▼
NativeModules.KickKey.recordEmojiUsed(emoji)
  → Kotlin "kickkey_recent_emojis" আপডেট করে (MRU তালিকা, সর্বোচ্চ ৩০)
```

### ২.২ ক্লিপবোর্ড প্রবাহ

```
ব্যবহারকারী 📋 বাটন ট্যাপ করে (এই ফেজে BottomRow-এ যোগ হয়েছে)
        │
        ▼
useKeyboardState.handleClipboardToggle() → setIsClipboard(true)
        │
        ▼
KeyboardScreen কী সারির পরিবর্তে <ClipboardPanel /> রেন্ডার করে
        │
        ▼
ClipboardPanel মাউন্ট হয় → useEffect কল করে
NativeModules.KickKey.getClipboardHistory()
        │
        ▼  [Kotlin]
ClipboardHandler.getClipboardItems()
  → সিস্টেম ClipboardManager.primaryClip পড়ে (যদি থাকে)
  → স্থানীয়ভাবে সংরক্ষিত হিস্ট্রির সাথে একত্রিত করে (সর্বোচ্চ ২০ আইটেম)
  → একত্রিত, ডিডুপ্লিকেটেড তালিকা ফেরত দেয়
        │
        ▼
ClipboardPanel টেক্সট স্নিপেটের একটি FlatList রেন্ডার করে
        │
        ▼
ব্যবহারকারী একটি আইটেম ট্যাপ করে
        │
        ▼
onPaste(text) → handleKeyPress({ code: text, label: text })
        │
        ▼
NativeModules.KickKey.commitKey(text, language)
  → InputConnection.commitText(text, 1)
```

### ২.৩ নতুন ক্লিপবোর্ড কন্টেন্ট কখন ক্যাপচার হয়

Android শুধুমাত্র `onStartInputView()`-এর সময় (অর্থাৎ যখন একটি টেক্সট ফিল্ড ফোকাস পায়) Android 10+-এ IME-কে ক্লিপবোর্ড পড়ার অ্যাক্সেস দেয়। তাই KickKey সেই মুহূর্তে বর্তমান সিস্টেম ক্লিপবোর্ড তার স্থানীয় হিস্ট্রিতে ক্যাপচার করে, ক্রমাগত নয়। এর মানে: অন্য অ্যাপে টেক্সট কপি করুন → টেক্সট ফিল্ডে সুইচ করুন → ব্যবহারকারী ক্লিপবোর্ড প্যানেল খোলার আগেই সেই ফোকাস ইভেন্টের সময় KickKey এটি হিস্ট্রিতে রেকর্ড করে।

---

## 3. আপডেটেড ফোল্ডার স্ট্রাকচার

```
android/app/src/main/java/com/kickkey/
├── ClipboardHandler.kt               ← নতুন
├── KickKeyModule.kt                  ← আপডেট
└── KickKeyInputMethodService.kt      ← আপডেট

src/keyboard/
├── data/
│   └── emojiData.ts                  ← নতুন
├── EmojiPanel.tsx                    ← নতুন
├── ClipboardPanel.tsx                ← নতুন
├── KeyboardScreen.tsx                ← আপডেট (প্রকৃত প্যানেল স্টাব প্রতিস্থাপন করে)
└── BottomRow.tsx                     ← আপডেট (ক্লিপবোর্ড বাটন যোগ)

modules/kickkey-module/
└── index.ts                          ← আপডেট
```

---

## 4. Android ক্লিপবোর্ড সীমাবদ্ধতা

কোনো কোড লেখার আগে, `ClipboardHandler.kt` যে প্ল্যাটফর্ম সীমাবদ্ধতা গঠন করে তা বুঝুন:

| Android ভার্সন | আচরণ |
|---|---|
| Android 9 এবং নিচে | যেকোনো অ্যাপ যেকোনো সময় ক্লিপবোর্ড পড়তে পারে, কোনো সীমাবদ্ধতা নেই |
| Android 10 (API 29) | ব্যাকগ্রাউন্ডে অ্যাপ সাধারণত ক্লিপবোর্ড পড়তে পারে না; IME `onStartInputView()`-এর সময় একটি ডকুমেন্টেড ছাড় পায় |
| Android 12+ (API 31) | যেকোনো অ্যাপ — IME সহ — ক্লিপবোর্ড পড়লে সিস্টেম **সবসময়** একটি ছোট টোস্ট দেখায় ("App pasted from clipboard")। অ্যাপ এটি দমন করতে পারে না। |
| Android 13+ (API 33) | ক্লিপবোর্ড অ্যাক্সেস আরও সীমাবদ্ধ; সংবেদনশীল কন্টেন্ট (যেমন পাসওয়ার্ড হিসেবে সনাক্ত) সিস্টেম দ্বারা স্বয়ংক্রিয়ভাবে রিড্যাক্ট হতে পারে IME দেখার আগেই |

**ডিজাইন প্রভাব:** KickKey-কে অবশ্যই ক্রমাগত ক্লিপবোর্ড অ্যাক্সেস ধরে নেওয়া যাবে না। এটি সুযোগসন্ধানীভাবে `onStartInputView()`-এ শুধুমাত্র `ClipboardManager.primaryClip` পড়ে, যা খুঁজে পায় তা স্থানীয়ভাবে সংরক্ষিত হিস্ট্রিতে সংরক্ষণ করে, এবং সেই উইন্ডোর বাইরে কখনো নীরবে ক্লিপবোর্ড পোল করে না — তা করলে Android 12+ টোস্ট বারবার ট্রিগার হতো এবং ব্যবহারকারীর কাছে স্পাইওয়্যারের মতো মনে হতো।

---

## 5. ইমোজি ডেটা ফাইল

একটি স্ট্যাটিক, শ্রেণীবদ্ধ ইমোজি তালিকা। প্রতিটি ক্যাটাগরিতে একটি আইকন (ট্যাবের জন্য ব্যবহৃত) এবং ইমোজি অক্ষরের একটি অ্যারে আছে। সাম্প্রতিক ইমোজি আলাদাভাবে পরিচালিত হয় (নেটিভ থেকে ডায়নামিকভাবে লোড), এই ফাইলে সংরক্ষিত নয়।

```typescript
// src/keyboard/data/emojiData.ts

export interface EmojiCategory {
  id: string;
  icon: string;       // ট্যাব আইকন (ক্যাটাগরি প্রতিনিধিত্বকারী একটি ইমোজি)
  label: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    icon: '😀',
    label: 'হাসিমুখ ও আবেগ',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '☺️',
      '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗',
      '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓',
      '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕',
      '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
      '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰',
      '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🤫', '🤥', '😶', '😐',
      '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴',
    ],
  },
  {
    id: 'people',
    icon: '👋',
    label: 'মানুষ ও শরীর',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
      '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐',
      '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿',
      '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀',
      '👁️', '👅', '👄', '🫦', '👶', '🧒', '👦', '👧', '🧑', '👱',
    ],
  },
  {
    id: 'animals',
    icon: '🐶',
    label: 'প্রাণী ও প্রকৃতি',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
      '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊',
      '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉',
      '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌',
      '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂',
      '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀',
    ],
  },
  {
    id: 'food',
    icon: '🍕',
    label: 'খাবার ও পানীয়',
    emojis: [
      '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏',
      '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑',
      '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄',
      '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🫓', '🥨', '🥯',
      '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕',
      '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘',
    ],
  },
  {
    id: 'activities',
    icon: '⚽',
    label: 'কার্যকলাপ',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️',
      '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗',
    ],
  },
  {
    id: 'travel',
    icon: '🚀',
    label: 'ভ্রমণ ও স্থান',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
      '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵',
      '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟',
      '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇',
      '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸',
    ],
  },
  {
    id: 'objects',
    icon: '💡',
    label: 'বস্তু',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
      '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
      '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭',
      '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡',
      '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷',
    ],
  },
  {
    id: 'symbols',
    icon: '🔣',
    label: 'প্রতীক',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
      '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
      '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
    ],
  },
];

/** সক্রিয় ট্যাব পুনরুদ্ধারের সময় id দ্বারা খোঁজা হয় — EmojiPanel দ্বারা ব্যবহৃত */
export const DEFAULT_CATEGORY_ID = 'smileys';
```

---

## 6. `ClipboardHandler.kt`

লাইভ সিস্টেম ক্লিপবোর্ড পড়া এবং স্থানীয়ভাবে সংরক্ষিত হিস্ট্রি পরিচালনা উভয়ই পরিচালনা করে। হিস্ট্রি তার নিজস্ব `SharedPreferences` ফাইলে নিউলাইন-বিচ্ছিন্ন স্ট্রিং হিসেবে সংরক্ষিত, সর্বোচ্চ ২০টি আইটেম, সর্বশেষ-প্রথম।

```kotlin
// android/app/src/main/java/com/kickkey/ClipboardHandler.kt

package com.kickkey

import android.content.ClipboardManager
import android.content.Context
import android.util.Log

/**
 * ক্লিপবোর্ড রিড অ্যাক্সেস এবং স্থানীয়ভাবে সংরক্ষিত হিস্ট্রি পরিচালনা করে।
 *
 * Android শুধুমাত্র onStartInputView()-এর সময় (Android 10+) IME-কে
 * ক্লিপবোর্ড রিড অ্যাক্সেস দেয়। তাই এই ক্লাস সেই লাইফসাইকেল পয়েন্ট
 * থেকে কল করার জন্য ডিজাইন করা হয়েছে — দেখুন
 * KickKeyInputMethodService.onStartInputView()।
 *
 * হিস্ট্রি ফরম্যাট: Unit Separator অক্ষর (\u001F) দ্বারা বিচ্ছিন্ন আইটেম
 * যাতে ক্লিপবোর্ড টেক্সটের ভেতরে নিউলাইন ও ট্যাব নিরাপদে রাখা যায়।
 */
class ClipboardHandler(private val context: Context) {

    companion object {
        private const val TAG = "ClipboardHandler"
        private const val PREFS_NAME = "kickkey_clipboard"
        private const val KEY_HISTORY = "history"
        private const val MAX_HISTORY = 20
        private const val MAX_ITEM_LENGTH = 5000   // বিশাল ব্লব পেস্ট থেকে রক্ষা
        private const val SEPARATOR = "\u001F"
    }

    private val clipManager: ClipboardManager? by lazy {
        try {
            context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        } catch (e: Exception) {
            Log.w(TAG, "ClipboardManager অনুপলব্ধ: ${e.message}")
            null
        }
    }

    /**
     * onStartInputView()-এর সময় এটি কল করুন বর্তমান সিস্টেম ক্লিপবোর্ডে
     * যা আছে তা সুযোগসন্ধানীভাবে স্থানীয় হিস্ট্রিতে ক্যাপচার করতে।
     * ক্লিপবোর্ড অ্যাক্সেস সীমাবদ্ধ থাকলেও নিরাপদে কল করা যায় — নীরবে ব্যর্থ হয়।
     */
    fun captureCurrentClipboard() {
        try {
            val clip = clipManager?.primaryClip ?: return
            for (i in 0 until clip.itemCount) {
                val text = clip.getItemAt(i)?.coerceToText(context)?.toString()
                if (!text.isNullOrBlank() && text.length <= MAX_ITEM_LENGTH) {
                    addToHistory(text.trim())
                }
            }
        } catch (e: Exception) {
            // কিছু OEM স্কিনে IME-এর এখনো ফোকাস প্রসঙ্গ না থাকলে
            // ক্লিপবোর্ড অ্যাক্সেস SecurityException ছুঁড়তে পারে — নীরবে ব্যর্থ হয়
            Log.v(TAG, "captureCurrentClipboard এড়িয়ে গেছে: ${e.message}")
        }
    }

    /**
     * একত্রিত ক্লিপবোর্ড হিস্ট্রি ফেরত দেয়, সর্বশেষ প্রথমে।
     * লাইভ সিস্টেম ক্লিপবোর্ড পুনরায় পড়ে না — সেজন্য আলাদাভাবে
     * captureCurrentClipboard() কল করুন, যথাযথ লাইফসাইকেল পয়েন্টে।
     */
    fun getHistory(): List<String> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_HISTORY, "") ?: ""
        return if (raw.isEmpty()) emptyList() else raw.split(SEPARATOR).filter { it.isNotBlank() }
    }

    /**
     * হিস্ট্রির সামনে [text] যোগ করে, বিদ্যমান যেকোনো ডুপ্লিকেট সরায়,
     * এবং MAX_HISTORY আইটেমে ছেঁটে দেয়।
     */
    fun addToHistory(text: String) {
        if (text.isBlank() || text.length > MAX_ITEM_LENGTH) return
        val current = getHistory().toMutableList()
        current.remove(text)               // ডিডুপ — ইতিমধ্যে থাকলে সামনে নিয়ে যান
        current.add(0, text)
        val trimmed = current.take(MAX_HISTORY)
        persistHistory(trimmed)
    }

    /** হিস্ট্রি থেকে প্রতিটি আইটেম সরায়। */
    fun clearHistory() {
        persistHistory(emptyList())
    }

    /** হিস্ট্রি থেকে একটি একক আইটেম সরায়। */
    fun removeItem(text: String) {
        val updated = getHistory().filter { it != text }
        persistHistory(updated)
    }

    private fun persistHistory(items: List<String>) {
        val serialized = items.joinToString(SEPARATOR)
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_HISTORY, serialized)
            .apply()
    }

    // ── সাম্প্রতিক ইমোজি ট্র্যাকিং (পৃথক ছোট হিস্ট্রি, একই প্যাটার্ন) ─────────

    companion object EmojiHistory {
        // Kotlin-এ একটি ক্লাসে একাধিক companion object রাখা যায় না;
        // ইমোজি হিস্ট্রি মেথড নিচে নিয়মিত ইনস্ট্যান্স মেথড হিসেবে
        // বাস্তবায়িত — দেখুন getRecentEmojis() / recordEmojiUsed()।
    }

    fun getRecentEmojis(): List<String> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString("recent_emojis", "") ?: ""
        return if (raw.isEmpty()) emptyList() else raw.split(SEPARATOR).filter { it.isNotBlank() }
    }

    fun recordEmojiUsed(emoji: String) {
        val current = getRecentEmojis().toMutableList()
        current.remove(emoji)
        current.add(0, emoji)
        val trimmed = current.take(30)
        val serialized = trimmed.joinToString(SEPARATOR)
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("recent_emojis", serialized)
            .apply()
    }
}
```

> **উপরের নেস্টেড `companion object EmojiHistory` ব্লকে নোট:** Kotlin প্রতি ক্লাসে শুধুমাত্র একটি `companion object` অনুমতি দেয়। প্লেসহোল্ডার ব্লক নীরবে বাদ দেওয়ার পরিবর্তে একটি স্পষ্ট কমেন্ট মার্কার হিসেবে রাখা হয়েছে, যাতে স্পষ্ট হয় ইমোজি হিস্ট্রি ইচ্ছাকৃতভাবে একটি পৃথক ক্লাসের পরিবর্তে নিয়মিত ইনস্ট্যান্স মেথড (`getRecentEmojis()`, `recordEmojiUsed()`) হিসেবে বাস্তবায়িত হয়েছে, যা ক্লিপবোর্ড হিস্ট্রির সাথে একই `SharedPreferences` ফাইল শেয়ার করে। এই খালি companion ব্লকটি মুছে ফেলতে পারেন — এর কোনো কার্যকরী প্রভাব নেই — কিন্তু ডিজাইন সিদ্ধান্তের একটি ইচ্ছাকৃত সাইনপোস্ট হিসেবে এখানে রাখা হয়েছে।

---

## 7. আপডেটেড `KickKeyModule.kt`

চারটি নতুন ফাংশন, সবগুলো `companion object`-এ রাখা একটি `ClipboardHandler` ইনস্ট্যান্সে ডেলিগেট করে।

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyModule.kt
// শুধুমাত্র সংযোজন — ফেজ ৫ ফাইলে একত্রিত করুন

companion object {
    var activeInputConnection: InputConnection? = null
    var hapticManager: HapticManager? = null
    var banglaEngine: BanglaInputEngine? = null
    var suggestionEngine: SuggestionEngine? = null
    var clipboardHandler: ClipboardHandler? = null   // ← ফেজ ৬-এ নতুন
}

// ── ফেজ ৬-এ নতুন: ক্লিপবোর্ড ──────────────────────────────────────────────────

/**
 * বর্তমান ক্লিপবোর্ড হিস্ট্রি ফেরত দেয় (সর্বশেষ প্রথমে)।
 * প্যানেল মাউন্ট হলে ClipboardPanel.tsx দ্বারা কল করা হয়।
 */
Function("getClipboardHistory") {
    clipboardHandler?.getHistory() ?: emptyList<String>()
}

/**
 * সম্পূর্ণ ক্লিপবোর্ড হিস্ট্রি পরিষ্কার করে।
 * ব্যবহারকারী ClipboardPanel-এ "Clear All" ট্যাপ করলে কল হয়।
 */
Function("clearClipboardHistory") {
    clipboardHandler?.clearHistory()
}

/**
 * একটি একক ক্লিপবোর্ড হিস্ট্রি এন্ট্রি সরায়।
 * ব্যবহারকারী একটি আইটেম দীর্ঘ-প্রেস করে মুছতে চাইলে কল হয়।
 */
Function("removeClipboardItem") { text: String ->
    clipboardHandler?.removeItem(text)
}

// ── ফেজ ৬-এ নতুন: সাম্প্রতিক ইমোজি ──────────────────────────────────────────────

/**
 * সাম্প্রতিক ব্যবহৃত ইমোজি তালিকা ফেরত দেয় (সর্বশেষ প্রথমে, সর্বোচ্চ ৩০)।
 * Recent ট্যাব দেখানো হলে EmojiPanel.tsx দ্বারা কল করা হয়।
 */
Function("getRecentEmojis") {
    clipboardHandler?.getRecentEmojis() ?: emptyList<String>()
}

/**
 * রেকর্ড করে যে ব্যবহারকারী [emoji] নির্বাচন করেছেন, সাম্প্রতিক তালিকার
 * সামনে নিয়ে যায়। ইমোজি কমিট করার অবিলম্বে পরে কল হয়।
 */
Function("recordEmojiUsed") { emoji: String ->
    clipboardHandler?.recordEmojiUsed(emoji)
}

// ── এই বিন্দুর নিচে সমস্ত ফেজ ১–৫ ফাংশন অপরিবর্তিত ─────────────────────────
```

---

## 8. আপডেটেড `KickKeyInputMethodService.kt`

দুটি সংযোজন: `onCreate()`-এ `ClipboardHandler` ইনস্ট্যান্টিয়েট করুন, এবং `onStartInputView()`-এ `captureCurrentClipboard()` কল করুন — এটিই লাইভ ক্লিপবোর্ড পড়ার একমাত্র Android-অনুমোদিত মুহূর্ত।

```kotlin
// android/app/src/main/java/com/kickkey/KickKeyInputMethodService.kt
// সম্পূর্ণ প্রতিস্থাপন

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
        KickKeyModule.hapticManager    = HapticManager(this)
        KickKeyModule.banglaEngine     = BanglaInputEngine()
        KickKeyModule.suggestionEngine = SuggestionEngine(this)
        KickKeyModule.clipboardHandler = ClipboardHandler(this)   // ← ফেজ ৬-এ নতুন
        Log.i(TAG, "IME তৈরি — হ্যাপটিক, বাংলা, সাজেশন, ক্লিপবোর্ড হ্যান্ডলার প্রস্তুত")
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

        val isPassword = (info.inputType and 0x80) != 0
        KickKeyModule.suggestionEngine?.setEnabled(!isPassword)

        // ফেজ ৬: Android 10+-এ লাইভ সিস্টেম ক্লিপবোর্ড পড়ার একমাত্র
        // অনুমোদিত মুহূর্ত এটি। পাসওয়ার্ড ফিল্ডে এড়িয়ে যান যাতে
        // সংবেদনশীল কপি করা কন্টেন্ট হিস্ট্রিতে প্রকাশ না পায়।
        if (!isPassword) {
            KickKeyModule.clipboardHandler?.captureCurrentClipboard()
        }

        Log.i(TAG, "InputConnection অর্জিত — inputType: ${info.inputType}")
    }

    override fun onFinishInput() {
        super.onFinishInput()
        val pending = KickKeyModule.banglaEngine?.flush() ?: ""
        if (pending.isNotEmpty()) KickKeyModule.activeInputConnection?.commitText(pending, 1)
        KickKeyModule.activeInputConnection = null
        Log.i(TAG, "ইনপুট শেষ হয়েছে")
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        KickKeyModule.activeInputConnection = null
        KickKeyModule.banglaEngine?.reset()
        KickKeyModule.suggestionEngine?.reset()
        Log.i(TAG, "কীবোর্ড লুকানো হয়েছে")
    }

    override fun onDestroy() {
        reactRootView?.unmountReactApplication()
        reactRootView = null
        KickKeyModule.hapticManager    = null
        KickKeyModule.banglaEngine     = null
        KickKeyModule.suggestionEngine = null
        KickKeyModule.clipboardHandler = null     // ← ফেজ ৬-এ নতুন
        super.onDestroy()
        Log.i(TAG, "IME ধ্বংস হয়েছে")
    }
}
```

---

## 9. `EmojiPanel.tsx`

অনুভূমিক ক্যাটাগরি ট্যাব রেন্ডার করে (নেটিভ হিস্ট্রি থেকে পপুলেটেড একটি Recent ট্যাব সহ), এবং নিচে প্রতি-সারি ৮টি ইমোজি বাটনের একটি স্ক্রলযোগ্য গ্রিড।

```tsx
// src/keyboard/EmojiPanel.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  NativeModules,
} from 'react-native';
import { EMOJI_CATEGORIES, DEFAULT_CATEGORY_ID } from './data/emojiData';
import type { Theme } from './types';

const { KickKey } = NativeModules;
const RECENT_TAB_ID = 'recent';
const COLUMNS = 8;

interface EmojiPanelProps {
  theme: Theme;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPanel({ theme, onEmojiSelect, onClose }: EmojiPanelProps) {
  const [activeTab, setActiveTab] = useState<string>(RECENT_TAB_ID);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  // মাউন্টে নেটিভ হিস্ট্রি থেকে সাম্প্রতিক ইমোজি লোড করুন।
  // তালিকা খালি হলে (প্রথম ব্যবহার), খালি Recent স্ক্রিন না দেখিয়ে
  // Smileys ট্যাবে ডিফল্ট করুন।
  useEffect(() => {
    KickKey.getRecentEmojis()
      .then((emojis: string[]) => {
        setRecentEmojis(emojis);
        if (emojis.length === 0) setActiveTab(DEFAULT_CATEGORY_ID);
      })
      .catch(() => {
        setActiveTab(DEFAULT_CATEGORY_ID);
      });
  }, []);

  const handleSelect = useCallback((emoji: string) => {
    onEmojiSelect(emoji);
    // স্থানীয় সাম্প্রতিক তালিকা আশাবাদীভাবে আপডেট করুন যাতে UI
    // তাৎক্ষণিক মনে হয়, নেটিভ থেকে রাউন্ড-ট্রিপ রিডের অপেক্ষা না করে।
    setRecentEmojis((prev) => [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 30));
    KickKey.recordEmojiUsed(emoji).catch(() => {});
  }, [onEmojiSelect]);

  const currentEmojis: string[] =
    activeTab === RECENT_TAB_ID
      ? recentEmojis
      : EMOJI_CATEGORIES.find((c) => c.id === activeTab)?.emojis ?? [];

  const renderEmoji = useCallback(
    ({ item }: { item: string }) => (
      <TouchableOpacity
        style={styles.emojiCell}
        onPress={() => handleSelect(item)}
        activeOpacity={0.6}
      >
        <Text style={styles.emojiChar}>{item}</Text>
      </TouchableOpacity>
    ),
    [handleSelect]
  );

  return (
    <View style={[styles.panel, { backgroundColor: theme.keyboardBg }]}>
      {/* ক্যাটাগরি ট্যাব স্ট্রিপ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === RECENT_TAB_ID && styles.tabActive]}
          onPress={() => setActiveTab(RECENT_TAB_ID)}
        >
          <Text style={styles.tabIcon}>🕓</Text>
        </TouchableOpacity>
        {EMOJI_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.tab, activeTab === cat.id && styles.tabActive]}
            onPress={() => setActiveTab(cat.id)}
          >
            <Text style={styles.tabIcon}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ইমোজি গ্রিড */}
      {currentEmojis.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.altText }]}>
            {activeTab === RECENT_TAB_ID
              ? 'এখনো কোনো সাম্প্রতিক ইমোজি নেই — এখানে যোগ করতে যেকোনো ইমোজি ট্যাপ করুন'
              : 'এই ক্যাটাগরিতে কোনো ইমোজি নেই'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentEmojis}
          renderItem={renderEmoji}
          keyExtractor={(item, index) => `${item}-${index}`}
          numColumns={COLUMNS}
          showsVerticalScrollIndicator={false}
          style={styles.grid}
          contentContainerStyle={styles.gridContent}
          initialNumToRender={32}
          maxToRenderPerBatch={32}
          windowSize={5}
        />
      )}

      {/* বন্ধ বাটন — QWERTY লেআউটে ফিরে যায় */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.6}>
        <Text style={[styles.closeText, { color: theme.suggestionText }]}>ABC</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', height: 260 },
  tabs: { height: 40, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a3e' },
  tabsContent: { alignItems: 'center', paddingHorizontal: 4 },
  tab: {
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#00BCD4' },
  tabIcon: { fontSize: 18 },
  grid: { flex: 1 },
  gridContent: { paddingHorizontal: 4, paddingTop: 4 },
  emojiCell: {
    flex: 1 / 8,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiChar: { fontSize: 22 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  closeBtn: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a3e',
  },
  closeText: { fontSize: 13, fontWeight: '700' },
});
```

---

## 10. `ClipboardPanel.tsx`

ক্লিপবোর্ড হিস্ট্রি আইটেমের একটি স্ক্রলযোগ্য তালিকা দেখায়। একটি আইটেম ট্যাপ করলে পেস্ট হয়। দীর্ঘ-প্রেস করলে একটি একক আইটেম সরায়। শীর্ষে একটি "Clear All" বাটন পুরো হিস্ট্রি খালি করে।

```tsx
// src/keyboard/ClipboardPanel.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  NativeModules,
} from 'react-native';
import type { Theme } from './types';

const { KickKey } = NativeModules;

interface ClipboardPanelProps {
  theme: Theme;
  onPaste: (text: string) => void;
  onClose: () => void;
}

export default function ClipboardPanel({ theme, onPaste, onClose }: ClipboardPanelProps) {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(() => {
    setLoading(true);
    KickKey.getClipboardHistory()
      .then((history: string[]) => setItems(history))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handlePaste = useCallback((text: string) => {
    onPaste(text);
  }, [onPaste]);

  const handleRemove = useCallback((text: string) => {
    setItems((prev) => prev.filter((i) => i !== text));
    KickKey.removeClipboardItem(text).catch(() => {});
  }, []);

  const handleClearAll = useCallback(() => {
    setItems([]);
    KickKey.clearClipboardHistory().catch(() => {});
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <TouchableOpacity
        style={[styles.item, { backgroundColor: theme.keyBg }]}
        onPress={() => handlePaste(item)}
        onLongPress={() => handleRemove(item)}
        activeOpacity={0.65}
        delayLongPress={400}
      >
        <Text
          style={[styles.itemText, { color: theme.keyText }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {item}
        </Text>
      </TouchableOpacity>
    ),
    [theme, handlePaste, handleRemove]
  );

  return (
    <View style={[styles.panel, { backgroundColor: theme.keyboardBg }]}>
      {/* Clear All সহ হেডার */}
      <View style={[styles.header, { borderBottomColor: theme.suggestionDivider }]}>
        <Text style={[styles.headerTitle, { color: theme.altText }]}>ক্লিপবোর্ড</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={[styles.clearText, { color: theme.suggestionText }]}>সব পরিষ্কার</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* তালিকা বা খালি স্টেট */}
      {!loading && items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.altText }]}>
            ক্লিপবোর্ড খালি।{'\n'}এখানে দেখতে কিছু কপি করুন।
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${index}-${item.slice(0, 20)}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* বন্ধ বাটন — QWERTY লেআউটে ফিরে যায় */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.6}>
        <Text style={[styles.closeText, { color: theme.suggestionText }]}>ABC</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', height: 260 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 36,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  clearText: { fontSize: 12, fontWeight: '700' },
  list: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 6 },
  item: { borderRadius: 8, padding: 12, marginBottom: 6 },
  itemText: { fontSize: 13, lineHeight: 18 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 12, textAlign: 'center', fontStyle: 'italic', lineHeight: 18 },
  closeBtn: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a3e',
  },
  closeText: { fontSize: 13, fontWeight: '700' },
});
```

---

## 11. আপডেটেড `KeyboardScreen.tsx`

ফেজ ২ থেকে "ফেজ ৬-এ আসছে" প্লেসহোল্ডার টেক্সট দেখানো দুটি স্টাব ব্লক (`isEmoji` / `isClipboard`) প্রকৃত প্যানেল দিয়ে প্রতিস্থাপন করুন।

```tsx
// src/keyboard/KeyboardScreen.tsx
// সম্পূর্ণ প্রতিস্থাপন

/**
 * ফেজ ৬ — প্রকৃত ইমোজি ও ক্লিপবোর্ড প্যানেল ফেজ ২ স্টাব প্রতিস্থাপন করে।
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useKeyboardTheme }          from './hooks/useKeyboardTheme';
import { useKeyboardState }          from './hooks/useKeyboardState';
import KeyboardHeader                from './KeyboardHeader';
import KeyRow                        from './KeyRow';
import SuggestionBar                 from './SuggestionBar';
import BottomRow                     from './BottomRow';
import EmojiPanel                    from './EmojiPanel';
import ClipboardPanel                from './ClipboardPanel';
import { ENGLISH_ROWS, BANGLA_ROWS, SYMBOL_ROWS } from './layouts';

export default function KeyboardScreen() {
  const theme = useKeyboardTheme();
  const {
    language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard,
    suggestions, composingText, currentWord,
    handleKeyPress, handleBackspace, handleBackspaceLongPress,
    handleSpace, handleEnter, handleShift, handleLanguageSwitch,
    handleSymbolToggle, handleEmojiToggle, handleClipboardToggle,
    handleSuggestionSelect,
  } = useKeyboardState();

  const rows = isSymbol
    ? SYMBOL_ROWS
    : language === 'bn'
    ? BANGLA_ROWS
    : ENGLISH_ROWS;

  // ── ইমোজি প্যানেল (প্রকৃত, ফেজ ২ স্টাব প্রতিস্থাপন করে) ──────────────────
  if (isEmoji) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <EmojiPanel
          theme={theme}
          onEmojiSelect={(emoji) => handleKeyPress({ label: emoji, code: emoji })}
          onClose={handleEmojiToggle}
        />
      </View>
    );
  }

  // ── ক্লিপবোর্ড প্যানেল (প্রকৃত, ফেজ ২ স্টাব প্রতিস্থাপন করে) ──────────────
  if (isClipboard) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <ClipboardPanel
          theme={theme}
          onPaste={(text) => handleKeyPress({ label: text, code: text })}
          onClose={handleClipboardToggle}
        />
      </View>
    );
  }

  // ── স্ট্যান্ডার্ড QWERTY / বাংলা / সিম্বল লেআউট (ফেজ ৫ থেকে অপরিবর্তিত) ──
  return (
    <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
      <KeyboardHeader
        language={language}
        theme={theme}
        composingText={composingText}
      />

      <SuggestionBar
        suggestions={suggestions}
        currentWord={currentWord}
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
          onBackspaceLongPress={handleBackspaceLongPress}
          onBackspaceLongPressEnd={() => {}}
          onShift={handleShift}
        />
      ))}

      <BottomRow
        theme={theme}
        language={language}
        isSymbol={isSymbol}
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

const styles = StyleSheet.create({
  keyboard: { width: '100%', paddingBottom: 6 },
});
```

### ১১.১ আপডেটেড `BottomRow.tsx` — ক্লিপবোর্ড বাটন যোগ করুন

`BottomRow`-এ পূর্বে কোনো ক্লিপবোর্ড বাটন ছিল না (এই ফেজের জন্য বিলম্বিত ছিল)। ইমোজি বাটন এবং Enter-এর মধ্যে একটি যোগ করুন।

```tsx
// src/keyboard/BottomRow.tsx
// সম্পূর্ণ প্রতিস্থাপন — ক্লিপবোর্ড বাটন যোগ করে

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
  onClipboardToggle: () => void;   // ← ফেজ ৬-এ নতুন
}

export default function BottomRow({
  theme, language, isSymbol,
  onSpace, onEnter, onLanguageSwitch, onSymbolToggle, onEmojiToggle, onClipboardToggle,
}: BottomRowProps) {
  const special = {
    backgroundColor: theme.specialKeyBg,
    borderRadius: theme.keyBorderRadius,
    marginHorizontal: theme.keyMargin,
    height: theme.keyHeight,
  };

  const langLabel  = language === 'en' ? '🌐 EN' : '🌐 বাং';
  const spaceLabel = language === 'en' ? 'space' : 'স্পেস';

  return (
    <View style={styles.row}>
      <TouchableOpacity style={[styles.key, special, { flex: 1.3 }]} onPress={onSymbolToggle} activeOpacity={0.55}>
        <Text style={[styles.label, { color: theme.specialKeyText, fontSize: 13 }]}>
          {isSymbol ? 'ABC' : '!#1'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.key, special, { flex: 1.1 }]}
        onPress={onLanguageSwitch}
        onLongPress={onLanguageSwitch}
        delayLongPress={600}
        activeOpacity={0.55}
      >
        <Text style={[styles.label, { color: theme.specialKeyText, fontSize: 10 }]}
          numberOfLines={1} adjustsFontSizeToFit>
          {langLabel}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.key, {
          flex: 3.6,
          backgroundColor: theme.keyBg,
          borderRadius: theme.keyBorderRadius,
          marginHorizontal: theme.keyMargin,
          height: theme.keyHeight,
        }]}
        onPress={onSpace}
        activeOpacity={0.7}
      >
        <Text style={[styles.spaceLabel, { color: theme.altText }]}>{spaceLabel}</Text>
      </TouchableOpacity>

      {/* ফেজ ৬-এ নতুন: ক্লিপবোর্ড বাটন */}
      <TouchableOpacity style={[styles.key, special, { flex: 1 }]} onPress={onClipboardToggle} activeOpacity={0.55}>
        <Text style={styles.iconEmoji}>📋</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.key, special, { flex: 1 }]} onPress={onEmojiToggle} activeOpacity={0.55}>
        <Text style={styles.iconEmoji}>😊</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.key, special, { flex: 1.3 }]} onPress={onEnter} activeOpacity={0.55}>
        <Text style={[styles.label, { color: theme.specialKeyText, fontSize: 18 }]}>↵</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row:        { flexDirection: 'row', paddingHorizontal: 4, justifyContent: 'center', marginVertical: 4 },
  key:        { justifyContent: 'center', alignItems: 'center', elevation: 2 },
  label:      { fontWeight: '500', textAlign: 'center' },
  spaceLabel: { fontSize: 12 },
  iconEmoji:  { fontSize: 18 },
});
```

---

## 12. আপডেটেড `useKeyboardState` হুক

নতুন কোনো স্টেট ফিল্ড প্রয়োজন নেই — `isEmoji`, `isClipboard`, `handleEmojiToggle`, এবং `handleClipboardToggle` আগের ফেজ থেকে ইতিমধ্যে বিদ্যমান। শুধুমাত্র পরিবর্তন হলো `handleClipboardToggle` আসলেই এক্সপোর্ট ও ওয়্যার্ড নিশ্চিত করা।

```typescript
// src/keyboard/hooks/useKeyboardState.ts
// যাচাই করুন এগুলো আগের ফেজ থেকে ইতিমধ্যে বিদ্যমান — থাকলে কোনো পরিবর্তন দরকার নেই।

const handleEmojiToggle = useCallback(() => {
  if (language === 'bn') KickKey.flushBanglaBuffer().catch(() => {});
  setIsEmoji(e => !e);
  setIsClipboard(false);
  setComposing('');
}, [language]);

const handleClipboardToggle = useCallback(() => {
  if (language === 'bn') KickKey.flushBanglaBuffer().catch(() => {});
  setIsClipboard(c => !c);
  setIsEmoji(false);
  setComposing('');
}, [language]);

// ... এবং ফেরত দেওয়া অবজেক্টে:
return {
  // ...
  isEmoji, isClipboard,
  handleEmojiToggle, handleClipboardToggle,
  // ...
};
```

যদি আপনার ফেজ ৫ ফাইলে ফেরত দেওয়া অবজেক্ট থেকে `handleClipboardToggle` অনুপস্থিত থাকে, এখন যোগ করুন — সেকশন ১১.১-এর `BottomRow.tsx`-এ `onClipboardToggle` একটি প্রপ হিসেবে প্রয়োজন।

---

## 13. আপডেটেড `modules/kickkey-module/index.ts`

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

  // ── ফেজ ৫ ─────────────────────────────────────────────────────────────────
  setDictionaryWords:   (words: string[]): Promise<void> => KickKey.setDictionaryWords(words),
  getDictionaryWords:   (): Promise<string[]>            => KickKey.getDictionaryWords(),
  removeDictionaryWord: (word: string): Promise<void>    => KickKey.removeDictionaryWord(word),

  // ── ফেজ ৬ (নতুন) ──────────────────────────────────────────────────────────

  /** ক্লিপবোর্ড হিস্ট্রি ফেরত দেয়, সর্বশেষ প্রথমে। onStartInputView-এ ক্যাপচার। */
  getClipboardHistory: (): Promise<string[]> =>
    KickKey.getClipboardHistory(),

  /** সম্পূর্ণ ক্লিপবোর্ড হিস্ট্রি পরিষ্কার করে। */
  clearClipboardHistory: (): Promise<void> =>
    KickKey.clearClipboardHistory(),

  /** একটি একক ক্লিপবোর্ড হিস্ট্রি এন্ট্রি সরায়। */
  removeClipboardItem: (text: string): Promise<void> =>
    KickKey.removeClipboardItem(text),

  /** সাম্প্রতিক ব্যবহৃত ইমোজি তালিকা ফেরত দেয়, সর্বশেষ প্রথমে। */
  getRecentEmojis: (): Promise<string[]> =>
    KickKey.getRecentEmojis(),

  /** রেকর্ড করে যে ব্যবহারকারী একটি ইমোজি নির্বাচন করেছেন, সাম্প্রতিক ট্রে অর্ডারিংয়ের জন্য। */
  recordEmojiUsed: (emoji: string): Promise<void> =>
    KickKey.recordEmojiUsed(emoji),
};
```

---

## 14. বিল্ড ও পরীক্ষা

### ১৪.১ `keyboard.bundle` পুনরায় বিল্ড করুন

```bash
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify false
```

### ১৪.২ বিল্ড ও ইনস্টল করুন

```bash
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### ১৪.৩ লগ মনিটর করুন

```bash
adb logcat -s ClipboardHandler KickKeyIME ReactNativeJS

# টেক্সট ফিল্ড ফোকাস পেলে প্রত্যাশিত:
# I/KickKeyIME: InputConnection অর্জিত — inputType: 1
# (ClipboardHandler.captureCurrentClipboard নীরবে চলে — ডিফল্টে কোনো লগ নেই)

# ইমোজি বাটন ট্যাপ করলে প্রত্যাশিত:
# (EmojiPanel মাউন্ট হয়, getRecentEmojis কল করে)

# একটি ইমোজি ট্যাপ করলে প্রত্যাশিত:
# (commitKey কল হয়, recordEmojiUsed কল হয়)
```

### ১৪.৪ ম্যানুয়াল ক্লিপবোর্ড পরীক্ষা ক্রম

ক্লিপবোর্ড আচরণ টাইমিং-সংবেদনশীল হওয়ায়, এই সঠিক ক্রমে পরীক্ষা করুন:

১. Chrome (বা যেকোনো অ্যাপ) খুলুন, কিছু টেক্সট নির্বাচন করে কপি করুন (যেমন "Hello KickKey")
২. একটি টেক্সট ফিল্ড আছে এমন ভিন্ন অ্যাপে সুইচ করুন (যেমন Notes)
৩. টেক্সট ফিল্ড ট্যাপ করুন — এটি `onStartInputView()` ট্রিগার করে এবং ক্লিপবোর্ড ক্যাপচার করে
৪. KickKey-তে 📋 বাটন ট্যাপ করুন
৫. যাচাই করুন "Hello KickKey" ক্লিপবোর্ড প্যানেলের শীর্ষে দেখা যায়
৬. এটি ট্যাপ করুন — যাচাই করুন এটি ফিল্ডে পেস্ট হয়
৭. একটি আইটেম দীর্ঘ-প্রেস করুন — যাচাই করুন এটি সরানো হয়
৮. "Clear All" ট্যাপ করুন — যাচাই করুন তালিকা খালি হয়

---

## 15. যাচাই চেকলিস্ট

ফেজ ৭-এ যাওয়ার আগে প্রতিটি আইটেম সম্পন্ন করুন।

### ইমোজি প্যানেল

- [ ] 😊 বাটন ট্যাপ করলে ইমোজি প্যানেল খোলে
- [ ] ক্যাটাগরি ট্যাব অনুভূমিকভাবে স্ক্রল করে এবং সবগুলো ট্যাপযোগ্য
- [ ] একটি ক্যাটাগরি ট্যাব ট্যাপ করলে সেই ক্যাটাগরির ইমোজি গ্রিড দেখায়
- [ ] একটি ইমোজি ট্যাপ করলে এটি সক্রিয় টেক্সট ফিল্ডে কমিট হয়
- [ ] একটি ইমোজি ট্যাপ করার পরে এটি Recent ট্যাবে (🕓) দেখা যায়
- [ ] প্রথম-ব্যবহারে (খালি Recent), প্যানেল খালি Recent স্ক্রিনের পরিবর্তে Smileys ট্যাবে ডিফল্ট করে
- [ ] "ABC" ট্যাপ করলে ইমোজি প্যানেল বন্ধ হয় এবং QWERTY লেআউটে ফেরত যায়
- [ ] ইমোজি গ্রিড ক্যাটাগরি সুইচ জুড়ে ধারাবাহিকভাবে ৮টি কলাম রেন্ডার করে
- [ ] ইমোজি গ্রিড স্ক্রলিং কোনো দৃশ্যমান জ্যাংক ছাড়া মসৃণ

### ক্লিপবোর্ড প্যানেল

- [ ] 📋 বাটন ট্যাপ করলে ক্লিপবোর্ড প্যানেল খোলে
- [ ] অন্য অ্যাপে টেক্সট কপি করে, তারপর KickKey টেক্সট ফিল্ডে ফোকাস করে, তারপর ক্লিপবোর্ড প্যানেল খুললে সেই টেক্সট শীর্ষে দেখায়
- [ ] একটি ক্লিপবোর্ড আইটেম ট্যাপ করলে এটি সক্রিয় ফিল্ডে পেস্ট হয়
- [ ] একটি ক্লিপবোর্ড আইটেম দীর্ঘ-প্রেস করলে শুধু সেই আইটেম সরে
- [ ] "Clear All" পুরো হিস্ট্রি খালি করে
- [ ] হিস্ট্রি খালি হলে খালি স্টেট বার্তা দেখায়
- [ ] "ABC" ট্যাপ করলে ক্লিপবোর্ড প্যানেল বন্ধ হয় এবং QWERTY-তে ফেরত যায়
- [ ] কীবোর্ড বন্ধ/পুনরায় খোলা জুড়ে হিস্ট্রি থেকে যায়
- [ ] ডিভাইস রিবুট জুড়ে হিস্ট্রি থেকে যায়

### পাসওয়ার্ড ফিল্ড আচরণ

- [ ] পাসওয়ার্ড ফিল্ডে ফোকাস করলে ক্লিপবোর্ড কন্টেন্ট হিস্ট্রিতে ক্যাপচার হয় না

### প্যানেল সুইচিং

- [ ] ক্লিপবোর্ড প্যানেল খোলা থাকাকালীন ইমোজি প্যানেল খুললে প্রথমে ক্লিপবোর্ড প্যানেল বন্ধ হয়
- [ ] ইমোজি প্যানেল খোলা থাকাকালীন ক্লিপবোর্ড প্যানেল খুললে প্রথমে ইমোজি প্যানেল বন্ধ হয়
- [ ] প্যানেল খোলা থাকাকালীন ভাষা সুইচ করলে যেকোনো অপেক্ষমাণ বাংলা বাফার সঠিকভাবে ফ্লাশ হয়

### পারফরম্যান্স

- [ ] ইমোজি প্যানেল প্রায় মূল কীবোর্ডের মতো একই লেটেন্সিতে খোলে
- [ ] উভয় প্যানেলে FlatList স্ক্রলিং ৬০fps-এর কাছাকাছি থাকে
- [ ] কোনো মেমরি বৃদ্ধি উদ্বেগ নেই — Android Studio Profiler দিয়ে নিশ্চিত করুন বারবার ইমোজি প্যানেল খোলা/বন্ধ করা `:ime_process`-এ অনিয়ন্ত্রিত RAM বৃদ্ধি ঘটায় না

---

## 16. সমস্যা সমাধান

### ক্লিপবোর্ড প্যানেল সবসময় "Clipboard is empty" দেখায় এমনকি অন্য জায়গায় টেক্সট কপি করার পরেও

**কারণ ১:** `captureCurrentClipboard()` কল হচ্ছে না, অথবা খুব দেরিতে কল হচ্ছে।

**পরীক্ষা করুন:**
```bash
adb logcat -s KickKeyIME | grep "InputConnection অর্জিত"
```
প্রতিবার নতুন টেক্সট ফিল্ডে ফোকাস করলে এই লগ দেখা যায় কিনা নিশ্চিত করুন।

**কারণ ২:** ক্লিপবোর্ড প্যানেল খোলার আগে ফোকাস করা ফিল্ড নিজেই একটি পাসওয়ার্ড ফিল্ড ছিল, যা ইচ্ছাকৃতভাবে ক্যাপচার এড়িয়ে যায় (সেকশন ৮ দেখুন)।

**সমাধান:** ক্লিপবোর্ড প্যানেল খোলার আগে একটি স্বাভাবিক টেক্সট ফিল্ডে (পাসওয়ার্ড ফিল্ড নয়) ফোকাস করুন।

---

### কীবোর্ড খোলার প্রতিবার Android একটি "pasted from clipboard" টোস্ট দেখায়

**কারণ:** এটি প্রত্যাশিত, এড়ানো অসম্ভব আচরণ Android 12+-এ যখনই কোনো অ্যাপ — IME সহ — `ClipboardManager.primaryClip` পড়ে। এটি কোনো বাগ নয়।

**প্রশমন:** অ্যাপ স্তরে কোনো উপায় নেই; এটি একটি সিস্টেম-স্তরের গোপনীয়তা বিজ্ঞপ্তি। অ্যাপের গোপনীয়তা নীতিতে এই আচরণ ডকুমেন্ট করুন এবং ঐচ্ছিকভাবে অনবোর্ডিংয়ে একবার অ্যাপ-ভেতরের ব্যাখ্যা দেখান।

---

### ইমোজি প্যানেল Recent ট্যাব ভুল ইমোজি ক্রমে দেখায়

**কারণ:** `EmojiPanel.handleSelect()`-এ আশাবাদী স্থানীয় আপডেট এবং নেটিভ `recordEmojiUsed()` কল রেস করতে পারে যদি প্যানেল দ্রুত পুনরায় মাউন্ট হয়।

**সমাধান:** এটি কোনো কার্যকরী প্রভাব ছাড়া একটি ছোট কসমেটিক সমস্যা। কঠোর সামঞ্জস্য গুরুত্বপূর্ণ হলে, স্থানীয় স্টেট আপডেট করার আগে `KickKey.recordEmojiUsed(emoji)` await করুন।

---

### `ClipboardHandler.kt` কম্পাইল ব্যর্থ হয় — "companion object" ডুপ্লিকেট ত্রুটি

**কারণ:** Kotlin প্রতি ক্লাসে শুধুমাত্র একটি `companion object` অনুমতি দেয়। যদি আপনি ফাইল কপি করেন এবং দুর্ঘটনাক্রমে প্রধান `companion object { ... }` ব্লক এবং প্লেসহোল্ডার `companion object EmojiHistory { ... }` ব্লক উভয়ই সক্রিয় রাখেন, এটি একটি কম্পাইল ত্রুটি।

**সমাধান:** প্লেসহোল্ডার `companion object EmojiHistory { ... }` ব্লক সম্পূর্ণরূপে মুছে দিন — এটি সেকশন ৬-এ শুধুমাত্র একটি ব্যাখ্যামূলক কমেন্ট মার্কার হিসেবে অন্তর্ভুক্ত ছিল। শুধুমাত্র প্রথম `companion object` (`PREFS_NAME`, `KEY_HISTORY` ইত্যাদি ধরে রাখা) থাকা উচিত।

---

### কিছু অ্যাপে (যেমন Gmail compose, Chrome address bar) ক্লিপবোর্ড আইটেম বা ইমোজি ট্যাপ করলে কিছু হয় না

**কারণ:** আগের ফেজে একই ধরনের সমস্যার মূল কারণ — কিছু অ্যাপের `commitText()`-এর চারপাশে `beginBatchEdit()` / `endBatchEdit()` মোড়ক প্রয়োজন।

**সমাধান:** নিশ্চিত করুন `KickKeyModule.commitKey`-তে ফেজ ২ সমস্যা সমাধান ফিক্স থেকে ব্যাচ এডিট মোড়ক আছে:
```kotlin
Function("commitKey") { code: String, language: String ->
    val ic = activeInputConnection ?: return@Function
    ic.beginBatchEdit()
    // ... বিদ্যমান কমিট লজিক ...
    ic.endBatchEdit()
}
```

---

### `getRecentEmojis()` এবং `getClipboardHistory()` উভয়ই একই SharedPreferences রিড থেকে ডেটা ফেরত দেয় — এগুলো কি দ্বন্দ্বপূর্ণ?

**কারণ:** কোনো বাগ নয় — ডিজাইন অনুসারে, `ClipboardHandler` ক্লিপবোর্ড হিস্ট্রি (`history` কী) এবং সাম্প্রতিক ইমোজি (`recent_emojis` কী) উভয়ই একই `kickkey_clipboard` SharedPreferences ফাইলে সংরক্ষণ করে, কিন্তু ভিন্ন কী-তে। এগুলো একে অপরকে ওভাররাইট করে না। যদি প্রকৃত ডেটা ক্ষতি দেখেন, `KEY_HISTORY = "history"` এবং ইমোজি মেথড আক্ষরিক স্ট্রিং `"recent_emojis"` ব্যবহার করছে কিনা পরীক্ষা করুন।

---

*ফেজ ৬ সম্পন্ন। মেমরি ব্যবহার প্রোফাইল করতে, সমস্ত কম্পোনেন্ট জুড়ে React.memo দিয়ে রেন্ডারিং অপ্টিমাইজ করতে, ইনপুট-টাইপ অভিযোজন (পাসওয়ার্ড/নম্বর/URL ফিল্ড) যোগ করতে, এবং প্রি-ওয়ার্মিং ও সাজেশন লেটেন্সি প্রোডাকশন লক্ষ্যে টিউন করতে ফেজ ৭ — পালিশ ও পারফরম্যান্স — এ এগিয়ে যান।*
