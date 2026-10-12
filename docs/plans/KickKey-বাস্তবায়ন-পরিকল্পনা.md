# KickKey — Android কাস্টম কীবোর্ড অ্যাপ
## সম্পূর্ণ বাস্তবায়ন পরিকল্পনা

> **প্ল্যাটফর্ম:** শুধুমাত্র Android · **প্রযুক্তি স্ট্যাক:** React Native + Expo + Kotlin · **ভাষা:** ইংরেজি ও বাংলা

---

## বিষয়সূচি

1. [সম্ভাব্যতা বিশ্লেষণ](#1-সম্ভাব্যতা-বিশ্লেষণ)
2. [আর্কিটেকচার ওভারভিউ](#2-আর্কিটেকচার-ওভারভিউ)
3. [দুই-বান্ডেল কৌশল](#3-দুই-বান্ডেল-কৌশল)
4. [Expo বনাম Native দায়িত্ব](#4-expo-বনাম-native-দায়িত্ব)
5. [Android IME বাস্তবায়ন](#5-android-ime-বাস্তবায়ন)
6. [Keyboard Service ও React Native UI](#6-keyboard-service-ও-react-native-ui)
7. [কাস্টম Native Module ডিজাইন](#7-কাস্টম-native-module-ডিজাইন)
8. [React Native ↔ Native যোগাযোগ](#8-react-native--native-যোগাযোগ)
9. [কীবোর্ড লেআউট সিস্টেম](#9-কীবোর্ড-লেআউট-সিস্টেম)
10. [বহুভাষিক সাপোর্ট (ইংরেজি ও বাংলা)](#10-বহুভাষিক-সাপোর্ট-ইংরেজি-ও-বাংলা)
11. [পরামর্শ ও অটোকারেক্ট আর্কিটেকচার](#11-পরামর্শ-ও-অটোকারেক্ট-আর্কিটেকচার)
12. [ইমোজি সাপোর্ট](#12-ইমোজি-সাপোর্ট)
13. [ক্লিপবোর্ড হ্যান্ডলিং](#13-ক্লিপবোর্ড-হ্যান্ডলিং)
14. [স্টেট ম্যানেজমেন্ট](#14-স্টেট-ম্যানেজমেন্ট)
15. [পারফরম্যান্স বিবেচনা](#15-পারফরম্যান্স-বিবেচনা)
16. [মেমরি ম্যানেজমেন্ট ও OOM সুরক্ষা](#16-মেমরি-ম্যানেজমেন্ট-ও-oom-সুরক্ষা)
17. [নিরাপত্তা ও গোপনীয়তা](#17-নিরাপত্তা-ও-গোপনীয়তা)
18. [প্রয়োজনীয় অনুমতি](#18-প্রয়োজনীয়-অনুমতি)
19. [পরীক্ষা কৌশল](#19-পরীক্ষা-কৌশল)
20. [বিল্ড ও ডেপ্লয়মেন্ট](#20-বিল্ড-ও-ডেপ্লয়মেন্ট)
21. [সীমাবদ্ধতা ও ঝুঁকি](#21-সীমাবদ্ধতা-ও-ঝুঁকি)
22. [ফোল্ডার স্ট্রাকচার](#22-ফোল্ডার-স্ট্রাকচার)
23. [উন্নয়ন মাইলফলক](#23-উন্নয়ন-মাইলফলক)

---

## 1. সম্ভাব্যতা বিশ্লেষণ

### ১.১ Expo + React Native দিয়ে কি এটা সম্ভব?

**সংক্ষিপ্ত উত্তর: হ্যাঁ — দুই-বান্ডেল, দুই-প্রসেস হাইব্রিড আর্কিটেকচার দিয়ে।**

Android কাস্টম কীবোর্ড হলো একটি **Android Input Method Editor (IME)** — একটি ব্যাকগ্রাউন্ড সার্ভিস যা Android সিস্টেমে নিজেকে নিবন্ধন করে এবং ব্যবহারকারী সক্রিয় করলে একটি `View` প্রদান করে। React Native-এর রেন্ডারার `Activity`-হোস্টেড প্রসঙ্গের জন্য তৈরি, কিন্তু `InputMethodService`-এ কোনো `Activity` নেই। তবে, `ReactRootView` ব্যবহার করে IME সার্ভিসের ভেতরে React Native রানটাইম ম্যানুয়ালি বুটস্ট্র্যাপ করে এই সমস্যা সমাধান করা যায় — এটি Headless JS-এর মতো একই প্রক্রিয়া।

**কীবোর্ডের UI সম্পূর্ণ React Native / TypeScript-এ তৈরি হবে। Kotlin শুধুমাত্র IME সার্ভিস লাইফসাইকেল এবং নেটিভ API কল (টেক্সট কমিট, হ্যাপটিক, ক্লিপবোর্ড) পরিচালনা করবে।**

> ⚠️ **গুরুত্বপূর্ণ:** এমন কোনো লাইব্রেরি নেই যা বিল্ড সময়ে React Native JSX কে Kotlin View-এ রূপান্তরিত করে। এই পথ বিদ্যমান নেই। React Native কম্পোনেন্ট একটি ভার্চুয়াল UI ট্রি বর্ণনা করে যা রানটাইমে JS ইঞ্জিন দ্বারা সমাধান করা হয়। সঠিক সমাধান হলো কীবোর্ড UI React Native-এ রাখা কিন্তু একটি পৃথক, ন্যূনতম JS বান্ডেলে পৃথক প্রসেসে চালানো।

| বিষয় | রায় |
|---|---|
| Android সিস্টেমে কাস্টম IME নিবন্ধন | ✅ Kotlin `InputMethodService` দ্বারা |
| IME-এ React Native UI রেন্ডার করা | ✅ `ReactRootView` + প্রি-ওয়ার্মড `ReactHost` (Activity ছাড়া) |
| যেকোনো অ্যাপে কীস্ট্রোক পাঠানো | ✅ Kotlin-এ `InputConnection` দ্বারা |
| সেটিংস / কম্প্যানিয়ন অ্যাপ React Native-এ | ✅ সম্পূর্ণ স্বাভাবিক |
| Expo Go ব্যবহার | ❌ সম্ভব নয় — কাস্টম ডেভ বিল্ড প্রয়োজন |
| Expo Modules API ব্যবহার | ✅ প্রস্তাবিত পদ্ধতি |

### ১.২ মূল পদ্ধতি: InputMethodService-এর ভেতরে ReactRootView

`InputMethodService.onCreateInputView()` একটি Android `View` ফেরত দিতে হবে। `ReactRootView` একটি Android `View`। `KickKeyApplication.onCreate()`-এ একটি `ReactHost` (Hermes JS রানটাইম + কীবোর্ড বান্ডেল) প্রি-ওয়ার্ম করে, ব্যবহারকারী কোনো টেক্সট ফিল্ডে ট্যাপ করার আগেই JS রানটাইম লোড হয়ে যায় এবং `onCreateInputView()` ~৫০–৮০ms-এ `ReactRootView` ফেরত দিতে পারে।

```
ব্যবহারকারী টেক্সট ফিল্ডে ট্যাপ করে
        │
        ▼
Android কর্তৃক onCreateInputView() কল
        │
        ▼                               ← ReactHost ইতিমধ্যে Application.onCreate()-এ প্রি-ওয়ার্মড
ReactRootView.startReactApplication()   ← চলমান JS কে View-এর সাথে সংযুক্ত করে
        │
        ▼
React Native KeyboardScreen.tsx রেন্ডার করে ← আপনার TSX কোড, সম্পূর্ণ স্টাইলড
        │
        ▼
ব্যবহারকারী কীবোর্ড দেখতে পায় (~৫০-৮০ms)
```

### ১.৩ পাঁচটি মূল প্রশ্নের উত্তর

**প্রশ্ন ১: কোন অংশগুলো শুধুমাত্র React Native দিয়ে তৈরি করা যাবে?**

- কীবোর্ড UI: সমস্ত কী স্টাইলিং, লেআউট, অ্যানিমেশন, সাজেশন বার, ইমোজি প্যানেল, ক্লিপবোর্ড প্যানেল
- কম্প্যানিয়ন/সেটিংস অ্যাপ: অনবোর্ডিং, থিম পিকার, ভাষা টগল, ডিকশনারি এডিটর
- কী লেআউট সংজ্ঞা (TypeScript অবজেক্ট)
- শব্দ তালিকা এবং ডিকশনারি ডেটা ফাইল
- অ্যাপ আইকন, ব্র্যান্ডিং, Play Store অ্যাসেট

**প্রশ্ন ২: কোন অংশগুলোতে নেটিভ Kotlin প্রয়োজন?**

- `InputMethodService` নিবন্ধন এবং লাইফসাইকেল (বাধ্যতামূলক Android প্রয়োজনীয়তা)
- Activity ছাড়া `ReactHost` / `ReactInstanceManager` বুটস্ট্র্যাপ
- `InputConnection.commitText()` — যেকোনো অ্যাপে টাইপ করা অক্ষর ইনজেক্ট করা
- `InputConnection.deleteSurroundingText()` — ব্যাকস্পেস
- `InputConnection.sendKeyEvent()` — কার্সার মুভমেন্ট, Enter কী
- হ্যাপটিক ফিডব্যাক (`VibrationEffect`)
- সিস্টেম ক্লিপবোর্ড অ্যাক্সেস (`ClipboardManager`)
- পৃথক প্রসেস ডিক্লারেশন (`:ime_process`)

**প্রশ্ন ৩: Expo Go সাপোর্ট করে?**

❌ **Expo Go এই অ্যাপ সাপোর্ট করে না।** `eas build --profile development` ব্যবহার করতে হবে। কারণ:
- `InputMethodService` অবশ্যই `AndroidManifest.xml`-এ ডিক্লেয়ার করতে হবে
- Activity ছাড়া `ReactHost` বুটস্ট্র্যাপ করতে প্যাচড নেটিভ কোড প্রয়োজন
- পৃথক প্রসেস ডিক্লারেশনের জন্য নেটিভ manifest পরিবর্তন প্রয়োজন
- `res/xml/method.xml` (IME মেটাডেটা) বান্ডেল করতে হবে

**প্রশ্ন ৪: Android-নির্দিষ্ট সীমাবদ্ধতা কী?**

- IME অবশ্যই ব্যবহারকারীকে Android Settings → Keyboard-এ ম্যানুয়ালি সক্রিয় করতে হবে
- ব্যবহারকারীকে ম্যানুয়ালি KickKey ডিফল্ট হিসেবে সেট করতে হবে (নীরবে করা যায় না)
- Android 11+ (API 30): `onStartInputView`-এর সময় IME একটি বিশেষ ছাড় পায়
- Android 12+: যেকোনো অ্যাপ ক্লিপবোর্ড পড়লে সিস্টেম টোস্ট দেখায় — এড়ানো সম্ভব নয়
- OEM স্কিন (MIUI, One UI, ColorOS): `config_killableInputMethods = true` সেট করতে পারে
- Android 13+: ব্যাকগ্রাউন্ড প্রসেস সীমাবদ্ধতা; সার্ভিস স্বয়ংক্রিয়ভাবে পুনরায় চালু হয়

**প্রশ্ন ৫: React Native কি Android IME সার্ভিসের ভেতরে কীবোর্ড UI রেন্ডার করতে পারে?**

✅ **হ্যাঁ, প্রি-ওয়ার্মড ReactHost কৌশল দিয়ে।** `Application.onCreate()`-এ JS রানটাইম ইনিশিয়ালাইজ করে (না `onCreateInputView()`-এ), কীবোর্ড বান্ডেল ব্যবহারকারী কোনো টেক্সট ফিল্ডে ট্যাপ করার আগেই প্রস্তুত থাকে। সমস্ত কী স্টাইল, আকার, রঙ, অ্যানিমেশন, এবং লেআউট TypeScript/TSX-এ লেখা হয়।

---

## 2. আর্কিটেকচার ওভারভিউ

### ২.১ প্রসেস আর্কিটেকচার

```
com.kickkey                    (মূল প্রসেস)
└── KickKeyApplication         ← বুটে কীবোর্ড ReactHost প্রি-ওয়ার্ম করে
└── MainActivity               ← কম্প্যানিয়ন অ্যাপ, React Native বান্ডেল #১ (পূর্ণ অ্যাপ)

com.kickkey:ime                (পৃথক প্রসেস — বিচ্ছিন্ন OOM স্কোর)
└── KickKeyInputMethodService  ← IME লাইফসাইকেল
    └── ReactRootView          ← React Native বান্ডেল #২ (শুধু কীবোর্ড, ~৩MB)
        └── KeyboardScreen.tsx ← আপনার TSX: কী, স্টাইল, সাজেশন বার, ইমোজি
```

### ২.২ বান্ডেল আর্কিটেকচার

```
বিল্ড আউটপুট
├── main.bundle         (~১৫–২৫MB)   পূর্ণ কম্প্যানিয়ন অ্যাপ
│   └── এন্ট্রি: index.js
│       ├── সেটিংস স্ক্রিন
│       ├── অনবোর্ডিং
│       ├── থিম পিকার
│       └── ডিকশনারি এডিটর
│
└── keyboard.bundle     (~৩–৫MB)     শুধুমাত্র কীবোর্ড UI
    └── এন্ট্রি: keyboard.index.js
        ├── KeyboardScreen.tsx
        ├── KeyRow.tsx
        ├── SuggestionBar.tsx
        ├── EmojiPanel.tsx
        └── ClipboardPanel.tsx
```

### ২.৩ ডেটা প্রবাহ

```
┌──────────────────────────────────────────────────────────────┐
│                        KickKey অ্যাপ                         │
│                                                              │
│  ┌──────────────────────────┐   ┌────────────────────────┐  │
│  │  কম্প্যানিয়ন অ্যাপ (main) │   │  IME সার্ভিস (:ime)    │  │
│  │  React Native বান্ডেল #১  │   │  React Native বান্ডেল #২│  │
│  │                          │   │                        │  │
│  │  • সেটিংস UI             │   │  • KeyboardScreen.tsx  │  │
│  │  • থিম পিকার             │   │  • KeyRow.tsx          │  │
│  │  • ভাষা টগল              │   │  • SuggestionBar.tsx   │  │
│  │  • ডিকশনারি এডিটর        │   │  • EmojiPanel.tsx      │  │
│  │  • অনবোর্ডিং             │◄──►  • ClipboardPanel.tsx  │  │
│  └──────────────────────────┘   └────────────────────────┘  │
│               │                            │                 │
│               └────── SharedPreferences ───┘                 │
│                       (ব্রিজ লেয়ার)                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. দুই-বান্ডেল কৌশল

এটি সম্পূর্ণ আর্কিটেকচারের ভিত্তি। কোনো কোড লেখার আগে এটি বোঝা অপরিহার্য।

### ৩.১ দুটি বান্ডেল কেন?

একটি ২০MB React Native বান্ডেল IME সার্ভিসের ভেতরে লোড করলে শুধু JS রানটাইমের জন্য ৮০–১৩০MB RAM ব্যবহার হবে — যা IME-কে যেকোনো <৪GB RAM ডিভাইসে কিল টার্গেটে পরিণত করবে। শুধুমাত্র কীবোর্ড কোড (নেভিগেশন, সেটিংস স্ক্রিন, Expo লাইব্রেরি নেই) দিয়ে একটি কীবোর্ড-মাত্র বান্ডেল তৈরি করলে IME প্রসেস ৩৫–৫০MB-এ থাকে।

### ৩.২ দুটি এন্ট্রি পয়েন্ট

```typescript
// index.js — কম্প্যানিয়ন অ্যাপের এন্ট্রি পয়েন্ট (মূল প্রসেস)
import { registerRootComponent } from 'expo';
import App from './src/App';
registerRootComponent(App);

// keyboard.index.js — কীবোর্ড UI-এর এন্ট্রি পয়েন্ট (:ime প্রসেস)
import { AppRegistry } from 'react-native';
import KeyboardScreen from './src/keyboard/KeyboardScreen';
AppRegistry.registerComponent('KickKeyKeyboard', () => KeyboardScreen);
// ↑ শুধুমাত্র কীবোর্ড কম্পোনেন্ট ইম্পোর্ট করুন। src/app/, src/store/, expo-router থেকে কিছুই নয়।
```

### ৩.৩ দুটি বান্ডেলের জন্য বিল্ড কমান্ড

```bash
# বান্ডেল ১: পূর্ণ কম্প্যানিয়ন অ্যাপ
npx react-native bundle \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/main.bundle \
  --platform android \
  --minify true

# বান্ডেল ২: শুধুমাত্র কীবোর্ড UI
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify true
```

### ৩.৪ মেমরি তুলনা

| পদ্ধতি | IME RAM ব্যবহার | ঝুঁকি |
|---|---|---|
| একক বান্ডেল, একই প্রসেস | ~৯০–১৩০MB | ৩GB ডিভাইসে উচ্চ কিল ঝুঁকি |
| একক বান্ডেল, পৃথক প্রসেস | ~৮০–১২০MB | মাঝারি কিল ঝুঁকি |
| **দুটি বান্ডেল, পৃথক প্রসেস (প্রস্তাবিত)** | **~৩৫–৫০MB** | **২GB+ ডিভাইসে নিরাপদ** |
| নেটিভ Kotlin UI (IME-এ কোনো RN নেই) | ~১৫–২৫MB | সর্বনিম্ন (কিন্তু RN UI নেই) |

### ৩.৫ কীবোর্ড বান্ডেলে কী ইম্পোর্ট করা যাবে না

```typescript
// ❌ keyboard.index.js বা এটি ইম্পোর্ট করা কোনো ফাইলে কখনো এগুলো ইম্পোর্ট করবেন না
import { useRouter } from 'expo-router';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../store/settingsStore';
import OnboardingScreen from '../app/onboarding/step1';

// ✅ শুধুমাত্র এগুলো ইম্পোর্ট করুন
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import KeyRow from './KeyRow';
import SuggestionBar from './SuggestionBar';
import { useKeyboardBridge } from './hooks/useKeyboardBridge';
```

---

## 4. Expo বনাম Native দায়িত্ব

### ৪.১ React Native / TypeScript পরিচালনা করে (কীবোর্ড বান্ডেল)

| ফিচার | বাস্তবায়ন |
|---|---|
| কী রেন্ডারিং | কাস্টম স্টাইল সহ `TouchableOpacity` / `Pressable` |
| কী লেআউট (সারি, প্রস্থ) | TypeScript লেআউট সংজ্ঞা + `flexbox` |
| কী প্রেস ভিজ্যুয়াল ফিডব্যাক | `onPressIn` স্টাইল পরিবর্তন + opacity |
| সাজেশন বার | `ScrollView`-এ `TouchableOpacity` চিপস |
| Shift / caps স্টেট প্রদর্শন | React `useState`, স্টাইল পরিবর্তন |
| ইমোজি প্যানেল | ইমোজি অক্ষরের `FlatList` গ্রিড |
| ক্লিপবোর্ড প্যানেল | ক্লিপবোর্ড হিস্ট্রি আইটেমের `FlatList` |
| থিম রঙ | মাউন্টে `NativeModules.KickKey.getPreferences()` দ্বারা পড়া |
| ভাষা নির্দেশক | কীবোর্ড হেডারে টেক্সট লেবেল |

### ৪.২ React Native / TypeScript পরিচালনা করে (কম্প্যানিয়ন বান্ডেল)

| ফিচার | বাস্তবায়ন |
|---|---|
| সেটিংস স্ক্রিন UI | React Native স্ক্রিন + Expo Router |
| থিম কালার পিকার | RN View + কালার পিকার |
| ভাষা টগল | RN স্টেট + SharedPreferences সিঙ্ক |
| অনবোর্ডিং উইজার্ড | React Native স্ক্রিন |
| ডিকশনারি শব্দ তালিকা এডিটর | `FlatList` + `TextInput` |
| অ্যাপ নেভিগেশন | Expo Router (ফাইল-ভিত্তিক) |
| বিল্ড পাইপলাইন | EAS Build |

### ৪.৩ নেটিভ Kotlin পরিচালনা করে

| ফিচার | প্রসেস | বাস্তবায়ন |
|---|---|---|
| IME সার্ভিস লাইফসাইকেল | `:ime` | `InputMethodService` সাবক্লাস |
| ReactHost প্রি-ওয়ার্ম | `main` | `KickKeyApplication.onCreate()` |
| ReactRootView হোস্ট | `:ime` | `onCreateInputView()` `ReactRootView` ফেরত দেয় |
| টেক্সট কমিট | `:ime` | `InputConnection.commitText()` |
| ব্যাকস্পেস | `:ime` | `InputConnection.deleteSurroundingText()` |
| এন্টার / কার্সার | `:ime` | `InputConnection.sendKeyEvent()` |
| হ্যাপটিক ফিডব্যাক | `:ime` | `VibrationEffect` |
| ক্লিপবোর্ড অ্যাক্সেস | `:ime` | `ClipboardManager` |
| SharedPreferences ব্রিজ | উভয় | `KickKeyModule.kt` |
| সাজেশন ইঞ্জিন | `:ime` | `SuggestionEngine.kt` (JS থ্রেডের বাইরে) |
| বাংলা ট্রান্সলিটারেশন | `:ime` | `BanglaInputEngine.kt` (JS থ্রেডের বাইরে) |

---

## 5. Android IME বাস্তবায়ন

### ৫.১ IME নিবন্ধন

প্রতিটি Android কীবোর্ড অবশ্যই `AndroidManifest.xml`-এ ডিক্লেয়ার করতে হবে:

```xml
<service
    android:name=".KickKeyInputMethodService"
    android:label="@string/ime_name"
    android:permission="android.permission.BIND_INPUT_METHOD"
    android:exported="true"
    android:process=":ime_process">     <!-- ← পৃথক প্রসেস: মেমরি আইসোলেশনের জন্য গুরুত্বপূর্ণ -->
    <intent-filter>
        <action android:name="android.view.InputMethod" />
    </intent-filter>
    <meta-data
        android:name="android.view.im"
        android:resource="@xml/method" />
</service>
```

### ৫.২ IME মেটাডেটা (`res/xml/method.xml`)

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

### ৫.৩ IME লাইফসাইকেল

```kotlin
class KickKeyInputMethodService : InputMethodService() {

    override fun onCreateInputView(): View {
        // ReactHost Application.onCreate()-এ প্রি-ওয়ার্মড ছিল
        // এই কল এখন দ্রুত: ~৫০–৮০ms
        val app = application as KickKeyApplication
        val reactRootView = ReactRootView(this)
        reactRootView.startReactApplication(
            app.keyboardReactHost,
            "KickKeyKeyboard",   // AppRegistry.registerComponent নামের সাথে মেলে
            null
        )
        return reactRootView
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        // ইনপুট টাইপ সম্পর্কে React Native সাইডকে জানান (ইমেইল, নম্বর, পাসওয়ার্ড...)
        val params = Arguments.createMap()
        params.putInt("inputType", info.inputType)
        sendEventToKeyboard("onInputStarted", params)
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        sendEventToKeyboard("onKeyboardHidden", null)
    }
}
```

---

## 6. Keyboard Service ও React Native UI

### ৬.১ React Native রানটাইম প্রি-ওয়ার্মিং

এটি পুরো প্রজেক্টের সবচেয়ে গুরুত্বপূর্ণ পারফরম্যান্স কৌশল। JS রানটাইম অ্যাপ বুটে ইনিশিয়ালাইজ হয়, কীবোর্ড খোলার সময় নয়।

```kotlin
// KickKeyApplication.kt
class KickKeyApplication : Application(), ReactApplication {

    lateinit var keyboardReactHost: ReactHost
        private set

    override fun onCreate() {
        super.onCreate()
        // ব্যাকগ্রাউন্ড থ্রেডে কীবোর্ড বান্ডেল প্রি-ওয়ার্ম
        // ব্যবহারকারী টেক্সট ফিল্ডে ট্যাপ করার সময়, Hermes + keyboard.bundle প্রস্তুত
        Thread {
            initKeyboardRuntime()
        }.start()
    }

    private fun initKeyboardRuntime() {
        keyboardReactHost = ReactHostBuilder()
            .setApplication(this)
            .setJSBundleAssetPath("keyboard.bundle")  // ← শুধুমাত্র কীবোর্ড বান্ডেল
            .setJSEngineResolutionAlgorithm(JSEngineResolutionAlgorithm.HERMES)
            .build()

        keyboardReactHost.start()  // JS লোড করে, Hermes চালু করে, বান্ডেল প্রি-পার্স করে
    }
}
```

### ৬.২ কীবোর্ড স্ক্রিন (React Native / TypeScript)

এটি IME দ্বারা ফেরত দেওয়া রুট কম্পোনেন্ট। সমস্ত ভিজ্যুয়াল এখানে — ১০০% React Native।

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

export default function KeyboardScreen() {
  const theme = useKeyboardTheme();       // SharedPreferences থেকে পড়ে KickKey মডিউল দ্বারা
  const {
    language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard,
    suggestions, handleKeyPress, handleBackspace, handleSpace, handleEnter,
    handleShift, handleLanguageSwitch, handleEmojiToggle, handleClipboardToggle,
    handleSuggestionSelect,
  } = useKeyboardState();

  const rows = isSymbol ? SYMBOL_ROWS : language === 'bn' ? BANGLA_ROWS : ENGLISH_ROWS;

  if (isEmoji) {
    return <EmojiPanel theme={theme} onEmojiSelect={handleKeyPress} onClose={handleEmojiToggle} />;
  }
  if (isClipboard) {
    return <ClipboardPanel theme={theme} onPaste={handleKeyPress} onClose={handleClipboardToggle} />;
  }

  return (
    <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
      <SuggestionBar suggestions={suggestions} onSelect={handleSuggestionSelect} theme={theme} />
      {rows.map((row, i) => (
        <KeyRow key={i} keys={row} theme={theme} isShift={isShift} onKeyPress={handleKeyPress} onBackspace={handleBackspace} onShift={handleShift} />
      ))}
      <BottomRow theme={theme} language={language} onSpace={handleSpace} onEnter={handleEnter} onLanguageSwitch={handleLanguageSwitch} onEmojiToggle={handleEmojiToggle} onClipboardToggle={handleClipboardToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard: { width: '100%', paddingVertical: 8, paddingHorizontal: 4 },
});
```

### ৬.৩ কী কম্পোনেন্ট (React Native / TypeScript)

```tsx
// src/keyboard/Key.tsx
export default React.memo(function Key({ keyDef, theme, isShift, onPress, flex = 1 }) {
  const label = isShift && keyDef.shiftLabel ? keyDef.shiftLabel : keyDef.label;

  return (
    <TouchableOpacity
      style={[styles.key, {
        flex,
        backgroundColor: keyDef.isSpecial ? theme.specialKeyBg : theme.keyBg,
        borderRadius: theme.keyBorderRadius,
        height: theme.keyHeight,
        elevation: 2,
      }]}
      onPress={() => onPress(keyDef)}
      onLongPress={() => showAltChars(keyDef)}
      activeOpacity={0.6}
    >
      <Text style={[styles.label, { color: keyDef.isSpecial ? theme.specialKeyText : theme.keyText, fontSize: theme.keyFontSize }]}>
        {label}
      </Text>
      {keyDef.altChars && (
        <Text style={[styles.altLabel, { color: theme.altText }]}>{keyDef.altChars[0]}</Text>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  key: { justifyContent: 'center', alignItems: 'center' },
  label: { fontWeight: '500' },
  altLabel: { position: 'absolute', top: 3, right: 5, fontSize: 9, opacity: 0.7 },
});
```

### ৬.৪ কীবোর্ড স্টেট হুক

```typescript
// src/keyboard/hooks/useKeyboardState.ts
export function useKeyboardState() {
  const [language, setLanguage] = useState<'en' | 'bn'>('en');
  const [isShift, setIsShift] = useState(false);
  const [isCapsLock, setIsCapsLock] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Kotlin SuggestionEngine থেকে সাজেশন আপডেট শুনুন
  useEffect(() => {
    const sub = emitter.addListener('onSuggestionsUpdated', (data) => {
      setSuggestions(data.suggestions);
    });
    return () => sub.remove();
  }, []);

  const handleKeyPress = useCallback((key: KeyDef) => {
    // Kotlin → InputConnection.commitText()-এ অক্ষর পাঠান
    NativeModules.KickKey.commitKey(key.code, language);
    if (isShift && !isCapsLock) setIsShift(false);
  }, [language, isShift, isCapsLock]);

  const handleBackspace = useCallback(() => {
    NativeModules.KickKey.sendBackspace();
  }, []);

  const handleSpace = useCallback(() => {
    NativeModules.KickKey.commitSpace(); // Kotlin অটোকারেক্ট লজিক পরিচালনা করে
  }, []);

  // ... বাকি হ্যান্ডলার
}
```

---

## 7. কাস্টম Native Module ডিজাইন

### ৭.১ `KickKeyModule.kt`

```kotlin
class KickKeyModule : Module() {

    companion object {
        var activeInputConnection: InputConnection? = null
        var activeSuggestionEngine: SuggestionEngine? = null
        var activeBanglaEngine: BanglaInputEngine? = null
    }

    override fun definition() = ModuleDefinition {
        Name("KickKey")

        // ── টেক্সট ইনপুট ──────────────────────────────────────────────

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
        }

        Function("commitSpace") {
            val ic = activeInputConnection ?: return@Function
            val top = activeSuggestionEngine?.getTopSuggestion()
            if (top != null) {
                val word = activeSuggestionEngine!!.getCurrentWord()
                ic.deleteSurroundingText(word.length, 0)
                ic.commitText("$top ", 1)
            } else {
                ic.commitText(" ", 1)
            }
        }

        Function("commitSuggestion") { word: String ->
            val ic = activeInputConnection ?: return@Function
            val currentWord = activeSuggestionEngine?.getCurrentWord() ?: ""
            ic.deleteSurroundingText(currentWord.length, 0)
            ic.commitText("$word ", 1)
            activeSuggestionEngine?.onWordCommitted(word)
        }

        Function("sendEnter") {
            val ic = activeInputConnection ?: return@Function
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER))
        }

        // ── প্রেফারেন্স ─────────────────────────────────────────────────

        Function("getPreferences") {
            val context = appContext.reactContext ?: return@Function emptyMap<String, Any>()
            val prefs = context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
            mapOf(
                "language" to (prefs.getString("language", "en") ?: "en"),
                "theme" to (prefs.getString("theme", "dark") ?: "dark"),
                "keyboardBg" to (prefs.getString("keyboardBg", "#111122") ?: "#111122"),
                "themeKeyBg" to (prefs.getString("themeKeyBg", "#1E1E2E") ?: "#1E1E2E"),
                "themeKeyText" to (prefs.getString("themeKeyText", "#FFFFFF") ?: "#FFFFFF"),
                "themePrimary" to (prefs.getString("themePrimary", "#00BCD4") ?: "#00BCD4"),
                "keyHeight" to prefs.getInt("keyHeight", 48),
                "keyBorderRadius" to prefs.getInt("keyBorderRadius", 6),
                "hapticEnabled" to prefs.getBoolean("hapticEnabled", true),
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
                }
            }
            editor.apply()
        }

        // ── IME স্ট্যাটাস ────────────────────────────────────────────────

        Function("isDefaultKeyboard") {
            val context = appContext.reactContext ?: return@Function false
            val current = android.provider.Settings.Secure.getString(
                context.contentResolver, android.provider.Settings.Secure.DEFAULT_INPUT_METHOD
            )
            current?.contains(context.packageName) ?: false
        }

        Function("isKeyboardEnabled") {
            val context = appContext.reactContext ?: return@Function false
            val enabled = android.provider.Settings.Secure.getString(
                context.contentResolver, android.provider.Settings.Secure.ENABLED_INPUT_METHODS
            ) ?: ""
            enabled.contains(context.packageName)
        }

        Function("openKeyboardSettings") {
            val context = appContext.reactContext ?: return@Function
            val intent = android.content.Intent(android.provider.Settings.ACTION_INPUT_METHOD_SETTINGS)
            intent.flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
        }

        Function("getClipboardHistory") {
            val context = appContext.reactContext ?: return@Function emptyList<String>()
            ClipboardHandler(context).getClipboardItems()
        }
    }
}
```

---

## 8. React Native ↔ Native যোগাযোগ

### ৮.১ যোগাযোগ চ্যানেল

```
React Native কীবোর্ড UI
    │
    ├── NativeModules.KickKey.commitKey()       → Kotlin → InputConnection.commitText()
    ├── NativeModules.KickKey.sendBackspace()   → Kotlin → InputConnection.deleteSurroundingText()
    ├── NativeModules.KickKey.commitSpace()     → Kotlin → অটোকারেক্ট লজিক + commitText()
    ├── NativeModules.KickKey.getPreferences()  → SharedPreferences → থিম/কনফিগ পড়া
    │
    └── NativeEventEmitter (Kotlin → React Native)
        ├── 'onSuggestionsUpdated'  → SuggestionBar.tsx পুনরায় রেন্ডার হয়
        ├── 'onInputStarted'        → ফিল্ড টাইপ অনুযায়ী কীবোর্ড পরিবর্তিত হয়
        └── 'onKeyboardHidden'      → ইমোজি/ক্লিপবোর্ড প্যানেল আনমাউন্ট হয়

React Native কম্প্যানিয়ন অ্যাপ
    │
    ├── NativeModules.KickKey.savePreferences() → SharedPreferences লেখা
    ├── NativeModules.KickKey.isDefaultKeyboard() → সেটআপ স্ট্যাটাস পোলিং
    └── NativeModules.KickKey.openKeyboardSettings() → Android Settings ইন্টেন্ট
```

### ৮.২ SharedPreferences কী স্কিমা

```typescript
// constants/PreferenceKeys.ts
export const PREF_KEYS = {
  LANGUAGE: 'language',              // 'en' | 'bn'
  THEME: 'theme',                    // 'dark' | 'light' | 'amoled' | 'custom'
  THEME_KEYBOARD_BG: 'keyboardBg',   // হেক্স রঙ যেমন '#111122'
  THEME_KEY_BG: 'themeKeyBg',
  THEME_KEY_TEXT: 'themeKeyText',
  THEME_PRIMARY: 'themePrimary',     // সাজেশন বারের অ্যাকসেন্ট রঙ
  KEY_HEIGHT: 'keyHeight',           // সংখ্যা (dp): 44 | 48 | 54
  KEY_BORDER_RADIUS: 'keyBorderRadius',
  HAPTIC_ENABLED: 'hapticEnabled',   // boolean
  SOUND_ENABLED: 'soundEnabled',     // boolean
  AUTO_CORRECT: 'autoCorrect',       // boolean
  SUGGESTIONS: 'showSuggestions',    // boolean
  CUSTOM_WORDS: 'customWords',       // JSON অ্যারে স্ট্রিং
} as const;
```

---

## 9. কীবোর্ড লেআউট সিস্টেম

### ৯.১ লেআউট টাইপ সংজ্ঞা

```typescript
// src/keyboard/types.ts
export interface KeyDef {
  label: string;          // প্রদর্শন লেবেল
  shiftLabel?: string;    // শিফট সক্রিয় থাকলে প্রদর্শন লেবেল
  code: string;           // আউটপুটের জন্য অক্ষর
  width?: number;         // আপেক্ষিক flex প্রস্থ (ডিফল্ট: ১)
  altChars?: string[];    // দীর্ঘ-প্রেস বিকল্প
  icon?: string;          // বিশেষ কীর জন্য আইকন নাম
  action?: KeyAction;     // বিশেষ অ্যাকশন
  isSpecial?: boolean;    // Shift, backspace, enter, ইত্যাদি
}

export type KeyAction =
  | 'backspace' | 'space' | 'enter' | 'shift'
  | 'language_switch' | 'emoji' | 'clipboard' | 'symbols';

export interface Theme {
  keyboardBg: string;
  keyBg: string;
  keyText: string;
  specialKeyBg: string;
  specialKeyText: string;
  altText: string;
  suggestionBg: string;
  suggestionText: string;
  keyHeight: number;
  keyBorderRadius: number;
  keyFontSize: number;
  keyMargin: number;
}
```

### ৯.২ ইংরেজি QWERTY লেআউট

```typescript
// src/keyboard/layouts/english.ts
export const ENGLISH_ROWS: KeyDef[][] = [
  [
    { label: 'q', code: 'q', altChars: ['1', '!'] },
    { label: 'w', code: 'w', altChars: ['2', '@'] },
    { label: 'e', code: 'e', altChars: ['3', 'è', 'é'] },
    // ... বাকি কীগুলো
    { label: 'p', code: 'p', altChars: ['0'] },
  ],
  [
    { label: 'a', code: 'a', altChars: ['à', 'á'] },
    // ...
    { label: 'l', code: 'l' },
  ],
  [
    { label: '⇧', code: '', action: 'shift', width: 1.5, isSpecial: true },
    // ... z থেকে m
    { label: '⌫', code: '', action: 'backspace', width: 1.5, isSpecial: true },
  ],
];
```

---

## 10. বহুভাষিক সাপোর্ট (ইংরেজি ও বাংলা)

### ১০.১ বাংলা ইনপুট কৌশল

বাংলায় **অ্যাভ্রো-স্টাইল ফোনেটিক ট্রান্সলিটারেশন** ব্যবহার করা হয়। ব্যবহারকারী রোমান অক্ষরে টাইপ করেন এবং ইঞ্জিন রিয়েল-টাইমে বাংলা ইউনিকোডে রূপান্তরিত করে। এটি সবচেয়ে প্রচলিত বাংলা ইনপুট পদ্ধতি (Gboard, Ridmik, Borno ব্যবহার করে)।

ফোনেটিক ইঞ্জিন **Kotlin**-এ চলে (JS থ্রেডের বাইরে) শূন্য-লেটেন্সি ট্রান্সলিটারেশনের জন্য।

### ১০.২ `BanglaInputEngine.kt`

```kotlin
class BanglaInputEngine {

    private val phoneticMap: Map<String, String> = mapOf(
        // ব্যঞ্জনবর্ণ (দীর্ঘতম মিল প্রথম)
        "kha" to "খ", "gha" to "ঘ", "nga" to "ঙ",
        "cha" to "চ", "chha" to "ছ", "jha" to "ঝ",
        "tha" to "থ", "dha" to "ধ",
        "pha" to "ফ", "bha" to "ভ",
        "sha" to "শ", "shha" to "ষ",
        "ka" to "ক", "ga" to "গ",
        "ja" to "জ", "ta" to "ত",
        "da" to "দ", "na" to "ন",
        "pa" to "প", "ba" to "ব",
        "ma" to "ম", "ya" to "য",
        "ra" to "র", "la" to "ল",
        "sa" to "স", "ha" to "হ",
        // স্বরবর্ণ
        "aa" to "আ", "ii" to "ঈ", "uu" to "ঊ",
        "a" to "অ", "i" to "ই",
        "u" to "উ", "e" to "এ", "o" to "ও",
        // মাত্রা
        "A" to "া", "I" to "ি", "U" to "ু",
        // বিশেষ
        "ng" to "ং", ":" to "ঃ"
    )

    private val buffer = StringBuilder()

    fun processKey(romanKey: String): String {
        buffer.append(romanKey)
        val input = buffer.toString()
        for (len in minOf(4, input.length) downTo 1) {
            val candidate = input.takeLast(len)
            phoneticMap[candidate]?.let { bangla ->
                repeat(len) { buffer.deleteCharAt(buffer.length - 1) }
                return bangla
            }
        }
        if (buffer.length >= 5) {
            val flushed = buffer.toString()
            buffer.clear()
            return flushed
        }
        return ""
    }

    fun onBackspace() {
        if (buffer.isNotEmpty()) buffer.deleteCharAt(buffer.length - 1)
    }
}
```

### ১০.৩ React Native-এ বাংলা লেআউট

```typescript
// src/keyboard/layouts/bangla.ts
// ফোনেটিক QWERTY ওভারলে — ইংরেজির মতো একই ভিজ্যুয়াল কীগুলো
// কিন্তু বাংলা ফোনেটিক হিন্ট সহ লেবেলযুক্ত
export const BANGLA_ROWS: KeyDef[][] = [
  [
    { label: 'ক', code: 'k', altChars: ['খ', 'গ', 'ঘ'] },
    { label: 'ও', code: 'o', altChars: ['ঔ'] },
    { label: 'এ', code: 'e', altChars: ['ঐ'] },
    { label: 'র', code: 'r', altChars: ['ড়'] },
    { label: 'ত', code: 't', altChars: ['থ', 'ট'] },
    { label: 'য', code: 'y', altChars: ['য়'] },
    { label: 'উ', code: 'u', altChars: ['ঊ', 'ু'] },
    { label: 'ই', code: 'i', altChars: ['ঈ', 'ি'] },
    { label: 'অ', code: 'a', altChars: ['আ', 'া'] },
    { label: 'প', code: 'p', altChars: ['ফ'] },
  ],
  // ... সারি ২ এবং ৩
];
```

### ১০.৪ ভাষা পরিবর্তন

```tsx
// কীবোর্ড হেডারে ভাষা নির্দেশক
<TouchableOpacity onPress={handleLanguageSwitch}>
  <Text style={{ color: theme.keyText, fontSize: 12 }}>
    {language === 'en' ? 'EN' : 'বাং'}
  </Text>
</TouchableOpacity>
```

---

## 11. পরামর্শ ও অটোকারেক্ট আর্কিটেকচার

### ১১.১ আর্কিটেকচার প্রবাহ

```
ব্যবহারকারী অক্ষর টাইপ করে
        │
        ▼ (NativeModules.KickKey.commitKey দ্বারা)
Kotlin: SuggestionEngine.onCharacterTyped()
        │
        ├── InputConnection.getTextBeforeCursor() থেকে বর্তমান শব্দ বের করা
        ├── বাইনারি Trie প্রিফিক্স সার্চ (O(m))
        ├── Levenshtein ফাজি ম্যাচ (সর্বোচ্চ দূরত্ব ২)
        └── UserWordModel ফ্রিকোয়েন্সি র‍্যাঙ্কিং
        │
        ▼ (NativeEventEmitter দ্বারা)
React Native: 'onSuggestionsUpdated' ইভেন্ট
        │
        ▼
SuggestionBar.tsx শীর্ষ ৩টি পরামর্শ সহ পুনরায় রেন্ডার হয়
```

### ১১.২ `SuggestionEngine.kt` (সারাংশ)

```kotlin
class SuggestionEngine(private val context: Context) {

    private val englishTrie: Trie by lazy { loadDictionary("dictionaries/english.bin") }
    private val banglaTrie: Trie by lazy { loadDictionary("dictionaries/bangla.bin") }

    fun onCharacterTyped(char: String) {
        // ৫০ms ডিবাউন্স: শেষ কীস্ট্রোকের পরে অপেক্ষা করুন
        updateHandler.removeCallbacks(updateRunnable)
        updateHandler.postDelayed(updateRunnable, 50)
    }

    private fun computeAndEmit() {
        val text = KickKeyModule.activeInputConnection
            ?.getTextBeforeCursor(100, 0)?.toString() ?: return
        val currentWord = text.split(Regex("\\s+")).last()

        Thread {
            val trie = if (currentWord.any { it.code > 127 }) banglaTrie else englishTrie
            val results = (trie.search(currentWord, 8) + trie.fuzzySearch(currentWord, 2, 4))
                .distinctBy { it.word }.sortedByDescending { it.score }.take(3).map { it.word }

            // React Native-এ ইভেন্ট পাঠান
            emitSuggestions(results, currentWord)
        }.start()
    }
}
```

---

## 12. ইমোজি সাপোর্ট

### ১২.১ React Native-এ ইমোজি প্যানেল

```tsx
// src/keyboard/EmojiPanel.tsx
export default function EmojiPanel({ theme, onEmojiSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <View style={[styles.panel, { backgroundColor: theme.keyboardBg }]}>
      {/* ক্যাটাগরি ট্যাব */}
      <ScrollView horizontal style={styles.tabs}>
        {EMOJI_CATEGORIES.map((cat, i) => (
          <TouchableOpacity key={i} onPress={() => setActiveCategory(i)}>
            <Text style={styles.tabIcon}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ইমোজি গ্রিড */}
      <FlatList
        data={EMOJI_CATEGORIES[activeCategory].emojis}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onEmojiSelect(item)}>
            <Text style={styles.emojiChar}>{item}</Text>
          </TouchableOpacity>
        )}
        numColumns={8}
      />

      <TouchableOpacity onPress={onClose}>
        <Text style={{ color: theme.keyText }}>ABC</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 13. ক্লিপবোর্ড হ্যান্ডলিং

### ১৩.১ Android ক্লিপবোর্ড সীমাবদ্ধতা

- **Android 10+:** IME `onStartInputView()`-এর সময় বিশেষ ছাড় পায় — ক্লিপবোর্ড পড়া যায়
- **Android 12+:** যেকোনো অ্যাপ ক্লিপবোর্ড পড়লে সিস্টেম সবসময় টোস্ট দেখায় — এড়ানো সম্ভব নয়
- KickKey SharedPreferences-এ ২০টি পর্যন্ত আইটেমের স্থানীয় ক্লিপবোর্ড হিস্ট্রি রাখে

### ১৩.২ `ClipboardHandler.kt`

```kotlin
class ClipboardHandler(private val context: Context) {

    fun getClipboardItems(): List<String> {
        val items = mutableListOf<String>()
        val clipManager = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        if (clipManager.hasPrimaryClip()) {
            val clip = clipManager.primaryClip ?: return getLocalHistory()
            for (i in 0 until clip.itemCount) {
                clip.getItemAt(i)?.coerceToText(context)?.toString()
                    ?.takeIf { it.isNotBlank() }?.let { items.add(it) }
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

---

## 14. স্টেট ম্যানেজমেন্ট

### ১৪.১ কীবোর্ড বান্ডেল স্টেট

কীবোর্ড বান্ডেল **শুধুমাত্র স্থানীয় React স্টেট** ব্যবহার করে — কোনো Zustand, AsyncStorage, বা Redux নেই। এটি কীবোর্ড বান্ডেলকে ছোট এবং দ্রুত রাখে।

```typescript
// কীবোর্ড স্টেট হলো useKeyboardState.ts-এ বিশুদ্ধ স্থানীয় React স্টেট
// থিম মাউন্টে একবার NativeModules.KickKey.getPreferences() দ্বারা লোড হয়
// পরামর্শ Kotlin থেকে NativeEventEmitter দ্বারা আসে
// কোনো গ্লোবাল স্টেট লাইব্রেরি প্রয়োজন নেই
```

### ১৪.২ কম্প্যানিয়ন অ্যাপ স্টেট

```typescript
// store/settingsStore.ts
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
      customWords: [],

      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setThemeColors: (colors) => set((s) => ({ themeColors: { ...s.themeColors, ...colors } })),
      toggleHaptic: () => set((s) => ({ hapticEnabled: !s.hapticEnabled })),
      addCustomWord: (word) => set((s) => ({ customWords: [...new Set([...s.customWords, word])] })),
      removeCustomWord: (word) => set((s) => ({ customWords: s.customWords.filter(w => w !== word) })),
    }),
    { name: 'kickkey-settings', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

### ১৪.৩ সেটিংস → Native সিঙ্ক

```typescript
// hooks/useSettingsSync.ts
export const useSettingsSync = () => {
  const settings = useSettingsStore();
  useEffect(() => {
    NativeModules.KickKey.savePreferences({
      language: settings.language,
      theme: settings.theme,
      ...settings.themeColors,
      hapticEnabled: settings.hapticEnabled,
      autoCorrect: settings.autoCorrect,
      customWords: JSON.stringify(settings.customWords),
    });
  }, [settings.language, settings.theme, settings.themeColors, settings.hapticEnabled, settings.autoCorrect]);
};
```

---

## 15. পারফরম্যান্স বিবেচনা

### ১৫.১ লক্ষ্যমাত্রা

| মেট্রিক | লক্ষ্য |
|---|---|
| কীবোর্ড খোলার লেটেন্সি (প্রি-ওয়ার্মড) | < ৮০ms |
| কীবোর্ড খোলার লেটেন্সি (কোল্ড, প্রথমবার) | < ৪০০ms |
| কী প্রেস → অক্ষর কমিট | < ১৬ms (১ ফ্রেম) |
| পরামর্শ আপডেট লেটেন্সি | < ১০০ms |
| IME প্রসেস RAM ব্যবহার | < ৫০MB |
| keyboard.bundle ডিস্কে আকার | < ৫MB |

### ১৫.২ প্রি-ওয়ার্মিং টাইমলাইন

```
অ্যাপ ব্যবহারকারী ইনস্টল করে
        ↓
ব্যবহারকারী প্রথমবার KickKey কম্প্যানিয়ন অ্যাপ খোলে
        ↓
KickKeyApplication.onCreate() চালু হয়
        ↓
ব্যাকগ্রাউন্ড থ্রেড: Hermes keyboard.bundle লোড করে → bytecode cache কম্পাইল করে
        ↓ (~৩০০–৬০০ms, একবার, ব্যবহারকারী দেখতে পায় না)
Bytecode cache ডিস্কে লেখা হয়
        ↓
প্রতিটি পরবর্তী লঞ্চ: Hermes bytecode cache থেকে লোড করে → ~৮০ms
        ↓
ব্যবহারকারী যেকোনো অ্যাপে টেক্সট ফিল্ডে ট্যাপ করে
        ↓
onCreateInputView() → ReactRootView.startReactApplication() → ~৫০ms
        ↓
কীবোর্ড দৃশ্যমান ✅
```

### ১৫.৩ রেন্ডারিং পারফরম্যান্স

```typescript
// প্রতিটি কী কম্পোনেন্টে React.memo ব্যবহার করুন
export default React.memo(Key, (prev, next) =>
  prev.keyDef === next.keyDef &&
  prev.isShift === next.isShift &&
  prev.theme === next.theme
);

// StyleSheet.create ব্যবহার করুন — ইনলাইন অবজেক্ট নয়
const styles = StyleSheet.create({
  key: { height: KEY_HEIGHT, marginHorizontal: KEY_MARGIN },
});
// ✅ নয়: style={{ height: 48 }} — প্রতি রেন্ডারে নতুন অবজেক্ট তৈরি করে
```

---

## 16. মেমরি ম্যানেজমেন্ট ও OOM সুরক্ষা

### ১৬.১ প্রসেস অনুযায়ী মেমরি বাজেট

```
:ime_process (কীবোর্ড — পৃথক OOM স্কোর)
──────────────────────────────────────────
Hermes রানটাইম (শুধু keyboard.bundle)   ~১৮–২২MB
কীবোর্ড React কম্পোনেন্ট ট্রি          ~৪–৬MB
Native ব্রিজ (শুধু KickKeyModule)       ~৫–৭MB
SuggestionEngine (মেমরি-ম্যাপড Trie)   ~৩–৫MB
ইমোজি ডেটা (lazy-loaded)               ~২–৩MB
──────────────────────────────────────────
IME প্রসেস মোট                          ~৩২–৪৩MB  ✅

main প্রসেস (কম্প্যানিয়ন — শুধু খোলা থাকলে)
──────────────────────────────────────────
Hermes + পূর্ণ RN ফ্রেমওয়ার্ক          ~৩০–৪৫MB
কম্প্যানিয়ন অ্যাপ স্ক্রিন             ~২০–৩৫MB
──────────────────────────────────────────
কম্প্যানিয়ন মোট                        ~৫০–৮০MB  ✅

সর্বোচ্চ (উভয় খোলা)                   ~৮২–১২৩MB ✅ (৩GB+ ডিভাইসে নিরাপদ)
```

### ১৬.২ Android LMK আচরণ

Android-এর Low Memory Killer (LMK) `oom_adj_score` ব্যবহার করে কোন প্রসেস কিল করবে তা নির্ধারণ করে:

- **স্ক্রিনে IME দৃশ্যমান:** perceptible প্রসেস হিসেবে বিবেচিত — খুব কম কিল অগ্রাধিকার
- **IME লুকানো (ব্যবহারকারী টাইপ করছেন না):** সার্ভিস হিসেবে বিবেচিত — মাঝারি কিল অগ্রাধিকার
- **পৃথক `:ime_process`:** স্বাধীন OOM স্কোর আছে; কম্প্যানিয়ন অ্যাপ ক্র্যাশ IME-কে প্রভাবিত করে না

কিছু OEM Android স্কিন (MIUI, ColorOS) `config_killableInputMethods = true` সেট করে। পৃথক প্রসেস ডিক্লারেশন এটি সম্পূর্ণ প্রতিরোধ করে না, কিন্তু কম্প্যানিয়ন অ্যাপ OOM থেকে IME-এ ক্যাসকেড প্রতিরোধ করে।

### ১৬.৩ হাইড হলে মেমরি মুক্ত করুন

```kotlin
override fun onWindowHidden() {
    super.onWindowHidden()
    sendEventToKeyboard("onKeyboardHidden", null)
}
```

```typescript
useEffect(() => {
  const sub = emitter.addListener('onKeyboardHidden', () => {
    setIsEmoji(false);
    setIsClipboard(false);
    // FlatList ডেটা আনমাউন্ট হয়, লিস্ট আইটেম মেমরি মুক্ত হয়
  });
  return () => sub.remove();
}, []);
```

### ১৬.৪ মেমরি-ম্যাপড ডিকশনারি

```kotlin
// মেমরি-ম্যাপড ফাইল ব্যবহার করে Trie লোড করুন
val file = File(context.filesDir, "english.bin")
val channel = FileInputStream(file).channel
val mappedBuffer = channel.map(FileChannel.MapMode.READ_ONLY, 0, channel.size())
// সক্রিয় মেমরি ফুটপ্রিন্ট: ~৩–৫MB vs সম্পূর্ণ ইন-মেমরি লোডের ~১৮–২০MB
```

---

## 17. নিরাপত্তা ও গোপনীয়তা

### ১৭.১ গোপনীয়তার নীতি

একটি কাস্টম কীবোর্ড গোপনীয়তার দৃষ্টিকোণ থেকে সবচেয়ে উচ্চ-ঝুঁকির Android অ্যাপগুলির একটি — এটি ব্যবহারকারীর প্রতিটি অক্ষর পর্যবেক্ষণ করতে পারে। KickKey স্পষ্টভাবে গোপনীয়তা-সংরক্ষণকারী হিসেবে ডিজাইন করা হয়েছে:

- **IME সার্ভিসে কোনো নেটওয়ার্ক অ্যাক্সেস নেই** — `INTERNET` অনুমতি `:ime_process`-এর জন্য ডিক্লেয়ার করা হয়নি
- **কোনো কীস্ট্রোক লগিং বা অ্যানালিটিক্স নেই**
- **কোনো ক্লাউড সিঙ্ক নেই** — সমস্ত ডেটা অন-ডিভাইসে থাকে
- **ক্লিপবোর্ড হিস্ট্রি স্থানীয়ভাবে** SharedPreferences-এ সংরক্ষিত, কখনো প্রেরণ করা হয় না

### ১৭.২ Play Store প্রয়োজনীয়তা

Google Play কীবোর্ডের জন্য একটি স্পষ্ট গোপনীয়তা নীতি প্রয়োজন:
- কী ডেটা সংগ্রহ করা হয় (উত্তর: অন-ডিভাইসে থাকে এমন কিছু ছাড়া কিছুই না)
- কীস্ট্রোক প্রেরণ করা হয় কিনা (উত্তর: না)
- ক্লিপবোর্ড ডেটা কীভাবে পরিচালনা করা হয় (উত্তর: স্থানীয়ভাবে সংরক্ষিত, কখনো প্রেরণ করা হয় না)

---

## 18. প্রয়োজনীয় অনুমতি

```xml
<!-- ন্যূনতম প্রয়োজনীয় অনুমতি -->
<uses-permission android:name="android.permission.VIBRATE" />

<!-- শুধুমাত্র কম্প্যানিয়ন অ্যাপ প্রসেসের জন্য ইন্টারনেট — :ime_process-এর জন্য নয় -->
<uses-permission android:name="android.permission.INTERNET" />
```

IME সার্ভিস নিজে **শূন্য রানটাইম অনুমতি** প্রয়োজন। কোনো `READ_CONTACTS`, `ACCESS_FINE_LOCATION`, বা `RECORD_AUDIO` নেই।

---

## 19. পরীক্ষা কৌশল

### ১৯.১ ইউনিট টেস্ট (Kotlin)

| কম্পোনেন্ট | ফ্রেমওয়ার্ক | পরীক্ষার বিষয় |
|---|---|---|
| `BanglaInputEngine` | JUnit 5 | ট্রান্সলিটারেশন নির্ভুলতা, বাফার ফ্লাশ, ব্যাকস্পেস |
| `SuggestionEngine` | JUnit 5 + Mockito | প্রিফিক্স ম্যাচ, ফাজি ম্যাচ, র‍্যাঙ্কিং |
| `Trie` | JUnit 5 | ইনসার্ট, সার্চ, ফাজি সার্চ |
| `ClipboardHandler` | JUnit 5 + Mockito | হিস্ট্রি ট্রিমিং, ডিডুপ্লিকেশন |

### ১৯.২ ইন্টিগ্রেশন টেস্ট

```kotlin
@RunWith(AndroidJUnit4::class)
class ImeIntegrationTest {

    @Test
    fun testBanglaPhoneticKa() {
        val engine = BanglaInputEngine()
        val result = engine.processKey("k") + engine.processKey("a")
        assertEquals("ক", result)
    }

    @Test
    fun testEnglishSuggestions() {
        val engine = SuggestionEngine(InstrumentationRegistry.getInstrumentation().context)
        val suggestions = engine.getSuggestions("hel", "en")
        assertTrue(suggestions.any { it.startsWith("hel") })
    }
}
```

### ১৯.৩ ম্যানুয়াল পরীক্ষার চেকলিস্ট

**মূল ইনপুট**
- [ ] ইংরেজি QWERTY টাইপিং কাজ করে: WhatsApp, Chrome, Gmail
- [ ] বাংলা ফোনেটিক ইনপুট সঠিক Unicode অক্ষর তৈরি করে
- [ ] ব্যাকস্পেস একটি অক্ষর মুছে দেয়
- [ ] শিফট কাজ করে (এক অক্ষর), ক্যাপস লক কাজ করে (ডাবল-ট্যাপ)
- [ ] সিম্বল প্যানেল খোলে

**পরামর্শ**
- [ ] টাইপ করার ১০০ms মধ্যে পরামর্শ আসে
- [ ] স্পেস প্রেস করলে শীর্ষ পরামর্শ কমিট হয়
- [ ] পাসওয়ার্ড ফিল্ডে পরামর্শ লুকানো থাকে
- [ ] বাংলা মোডে বাংলা পরামর্শ আসে

**পারফরম্যান্স**
- [ ] কীবোর্ড <৮০ms-এ খোলে (প্রথম ব্যবহারের পরে)
- [ ] কোনো ড্রপড ফ্রেম নেই (৬০fps)
- [ ] IME প্রসেস মেমরি <৫০MB (Android Studio Profiler দিয়ে যাচাই)

**সামঞ্জস্যতা**
- [ ] Android 10, 12, 14-এ কাজ করে
- [ ] Samsung One UI-তে কাজ করে
- [ ] Xiaomi MIUI-তে কাজ করে
- [ ] থিম পরিবর্তন পরবর্তী কীবোর্ড খোলায় প্রয়োগ হয়
- [ ] প্রসেস কিলের পরে কীবোর্ড পুনরুদ্ধার হয়

---

## 20. বিল্ড ও ডেপ্লয়মেন্ট

### ২০.১ পূর্বশর্ত

```bash
node >= 18.0.0
Java 17 (JDK)
Android SDK API 34
Expo CLI >= 6.0.0
EAS CLI >= 5.0.0
```

### ২০.২ `app.json` কনফিগারেশন

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
      "permissions": ["android.permission.VIBRATE"]
    },
    "plugins": [
      "./plugins/withImeService",
      "./plugins/withKeyboardBundle"
    ]
  }
}
```

### ২০.৩ Expo কনফিগ প্লাগইন — IME সার্ভিস + পৃথক প্রসেস

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
        'android:process': ':ime_process',  // ← পৃথক প্রসেস
      },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.view.InputMethod' } }] }],
      'meta-data': [{ $: { 'android:name': 'android.view.im', 'android:resource': '@xml/method' } }],
    });
    return config;
  });
};
```

### ২০.৪ বিল্ড কমান্ড

```bash
# ডেভেলপমেন্ট বিল্ড (USB দিয়ে ডিভাইসে ইনস্টল)
eas build --platform android --profile development
eas run:android

# প্রিভিউ বিল্ড (APK পরীক্ষার জন্য)
eas build --platform android --profile preview

# প্রোডাকশন বিল্ড (Play Store-এর জন্য AAB)
eas build --platform android --profile production

# Play Store-এ সাবমিট
eas submit --platform android
```

---

## 21. সীমাবদ্ধতা ও ঝুঁকি

### ২১.১ প্রযুক্তিগত সীমাবদ্ধতা

| সীমাবদ্ধতা | প্রভাব | প্রশমন |
|---|---|---|
| Activity ছাড়া `ReactHost` অনানুষ্ঠানিক | মাঝারি — RN আপগ্রেডে ভাঙতে পারে | RN ভার্সন পিন করুন; আপগ্রেড সতর্কতার সাথে পরীক্ষা করুন |
| OEM স্কিন `config_killableInputMethods=true` সেট করতে পারে | মাঝারি — চাপে IME কিল হয় | পৃথক প্রসেস IME ফুটপ্রিন্ট কমায় |
| Expo Go সাপোর্ট নেই | কম (শুধু dev friction) | দিন ১ থেকে EAS ডেভেলপমেন্ট বিল্ড ব্যবহার করুন |
| keyboard.bundle কোল্ড স্টার্ট: ~৩০০ms | কম — শুধুমাত্র প্রথমবার | `Application.onCreate()`-এ প্রি-ওয়ার্ম |
| ব্যবহারকারীকে ম্যানুয়ালি কীবোর্ড সক্রিয় করতে হবে | উচ্চ UX friction | ধাপে ধাপে UI সহ চমৎকার অনবোর্ডিং |
| বাংলা ট্রান্সলিটারেশনের শেখার বক্ররেখা আছে | মাঝারি UX | ভালো অনবোর্ডিং, দীর্ঘ-প্রেসে ফোনেটিক হিন্ট দেখান |

### ২১.২ React Native ভার্সন পিনিং

```json
{
  "dependencies": {
    "react-native": "0.76.x"  // মেজর নয়, মাইনরে পিন করুন
  }
}
```

### ২১.৩ নতুন আর্কিটেকচার সামঞ্জস্যতা

স্থিতিশীলতার জন্য **পুরানো আর্কিটেকচার** (`newArchEnabled=false`) লক্ষ্য করুন।

```properties
# android/gradle.properties
newArchEnabled=false
hermesEnabled=true
```

---

## 22. ফোল্ডার স্ট্রাকচার

```
KickKey/
├── app/                              # Expo Router — কম্প্যানিয়ন অ্যাপ স্ক্রিন
│   ├── (tabs)/
│   │   ├── index.tsx                 # হোম / সেটআপ স্ট্যাটাস
│   │   ├── settings.tsx              # সেটিংস স্ক্রিন
│   │   ├── themes.tsx                # থিম পিকার
│   │   ├── language.tsx              # ভাষা সেটিংস
│   │   └── dictionary.tsx            # কাস্টম শব্দ ডিকশনারি
│   ├── onboarding/
│   │   ├── step1-enable.tsx          # Android Settings-এ কীবোর্ড সক্রিয় করুন
│   │   ├── step2-default.tsx         # ডিফল্ট কীবোর্ড হিসেবে সেট করুন
│   │   └── step3-done.tsx            # সম্পন্ন! স্ক্রিন
│   └── _layout.tsx
│
├── src/
│   └── keyboard/                     # ← কীবোর্ড বান্ডেল (keyboard.index.js এখান থেকে ইম্পোর্ট করে)
│       ├── KeyboardScreen.tsx        # IME দ্বারা ফেরত দেওয়া রুট কম্পোনেন্ট
│       ├── KeyRow.tsx                # কীগুলোর একটি সারি
│       ├── Key.tsx                   # একটি কী
│       ├── SuggestionBar.tsx         # পরামর্শ চিপস
│       ├── BottomRow.tsx             # স্পেস, এন্টার, ভাষা, ইমোজি
│       ├── EmojiPanel.tsx            # ইমোজি পিকার প্যানেল
│       ├── ClipboardPanel.tsx        # ক্লিপবোর্ড হিস্ট্রি প্যানেল
│       ├── types.ts                  # KeyDef, Theme, KeyAction টাইপ
│       ├── layouts/
│       │   ├── english.ts
│       │   ├── bangla.ts
│       │   └── symbols.ts
│       ├── hooks/
│       │   ├── useKeyboardState.ts   # কী প্রেস হ্যান্ডলার, NativeModules কল
│       │   └── useKeyboardTheme.ts   # SharedPreferences থেকে থিম লোড
│       └── data/
│           └── emojiData.ts
│
├── assets/
│   ├── dictionaries/
│   │   ├── english.txt               # সোর্স শব্দ তালিকা
│   │   ├── english.bin               # কম্পাইলড বাইনারি Trie
│   │   ├── bangla.txt
│   │   └── bangla.bin
│   └── fonts/
│
├── components/                       # শেয়ার্ড কম্প্যানিয়ন অ্যাপ কম্পোনেন্ট
│   ├── SetupProgress.tsx
│   ├── ThemeCard.tsx
│   ├── ToggleRow.tsx
│   └── LanguageTag.tsx
│
├── hooks/                            # শুধুমাত্র কম্প্যানিয়ন অ্যাপ হুকস
│   ├── useKickKeyBridge.ts
│   ├── useSettingsSync.ts
│   └── useSetupStatus.ts
│
├── store/
│   └── settingsStore.ts              # Zustand স্টোর (শুধু কম্প্যানিয়ন)
│
├── constants/
│   ├── PreferenceKeys.ts
│   ├── Themes.ts
│   └── Colors.ts
│
├── plugins/
│   ├── withImeService.js             # Expo কনফিগ প্লাগইন: manifest + পৃথক প্রসেস
│   └── withKeyboardBundle.js         # Expo কনফিগ প্লাগইন: keyboard.bundle বিল্ড
│
├── modules/
│   └── kickkey-module/               # Expo Native Module
│       ├── index.ts
│       └── android/src/main/java/com/kickkey/
│           ├── KickKeyModule.kt
│           └── KickKeyPackage.kt
│
├── android/app/src/main/
│   ├── java/com/kickkey/
│   │   ├── KickKeyApplication.kt    # কীবোর্ড ReactHost প্রি-ওয়ার্ম করে
│   │   ├── KickKeyInputMethodService.kt
│   │   ├── BanglaInputEngine.kt
│   │   ├── SuggestionEngine.kt
│   │   ├── Trie.kt
│   │   ├── UserWordModel.kt
│   │   ├── ClipboardHandler.kt
│   │   └── HapticManager.kt
│   ├── res/xml/
│   │   └── method.xml               # IME মেটাডেটা: সাবটাইপ (en, bn)
│   └── AndroidManifest.xml
│
├── scripts/
│   └── compile-dictionaries.py      # বিল্ড-টাইম: .txt → .bin Trie কম্পাইলার
│
├── index.js                          # কম্প্যানিয়ন অ্যাপ এন্ট্রি পয়েন্ট
├── keyboard.index.js                 # কীবোর্ড বান্ডেল এন্ট্রি পয়েন্ট
├── app.json
├── eas.json
├── tsconfig.json
└── package.json
```

---

## 23. উন্নয়ন মাইলফলক

### পর্যায় ১ — ভিত্তি (সপ্তাহ ১–২)
- [ ] TypeScript সহ Expo প্রজেক্ট ইনিশিয়ালাইজ করুন
- [ ] EAS কাস্টম ডেভেলপমেন্ট বিল্ড পাইপলাইন সেটআপ
- [ ] ReactHost প্রি-ওয়ার্ম লজিক সহ `KickKeyApplication.kt` লিখুন
- [ ] manifest-এ `KickKeyInputMethodService` নিবন্ধন করুন (`:ime_process` সহ)
- [ ] `onCreateInputView()` একটি মৌলিক `ReactRootView` ফেরত দেয়
- [ ] `keyboard.index.js` এন্ট্রি পয়েন্ট তৈরি করুন
- [ ] যাচাই করুন মৌলিক `KeyboardScreen.tsx` IME-এর ভেতরে ভিজ্যুয়ালি রেন্ডার হয়
- [ ] Android Settings-এ কীবোর্ড বিকল্প হিসেবে দেখা যাচ্ছে কিনা যাচাই করুন

**মাইলফলক: একটি React Native কম্পোনেন্ট কীবোর্ড হিসেবে ভিজ্যুয়ালি রেন্ডার হয়**

---

### পর্যায় ২ — মূল ইনপুট (সপ্তাহ ৩–৪)
- [ ] `KickKeyModule.kt` বাস্তবায়ন: `commitKey`, `sendBackspace`, `commitSpace`, `sendEnter`
- [ ] ইংরেজি QWERTY লেআউট সহ `Key.tsx`, `KeyRow.tsx`, `BottomRow.tsx` তৈরি
- [ ] `useKeyboardState.ts` সমস্ত কী অ্যাকশনকে `NativeModules.KickKey`-এ ওয়্যারিং
- [ ] React Native স্টেটে Shift / Caps Lock লজিক
- [ ] সিম্বল প্যানেল লেআউট এবং টগল
- [ ] প্রতিটি কী প্রেসে হ্যাপটিক ফিডব্যাক
- [ ] দীর্ঘ-প্রেস বিকল্প অক্ষর পপআপ

**মাইলফলক: KickKey ব্যবহার করে যেকোনো Android অ্যাপে ইংরেজি টেক্সট টাইপ করা যায়**

---

### পর্যায় ৩ — বাংলা ইনপুট (সপ্তাহ ৫–৬)
- [ ] পূর্ণ ফোনেটিক ম্যাপ সহ `BanglaInputEngine.kt`
- [ ] `language === 'bn'` হলে `KickKeyModule.commitKey` বাংলা ইঞ্জিনে রুট করে
- [ ] TypeScript-এ `BANGLA_ROWS` লেআউট সংজ্ঞা
- [ ] React Native-এ ভাষা সুইচ কী (`useKeyboardState.handleLanguageSwitch`)
- [ ] কীবোর্ড হেডারে ভাষা লেবেল নির্দেশক (`EN` / `বাং`)
- [ ] ট্রান্সলিটারেশন নির্ভুলতার জন্য ইউনিট টেস্ট কভারেজ

**মাইলফলক: যেকোনো অ্যাপে ফোনেটিকভাবে বাংলা টাইপ করা যায়**

---

### পর্যায় ৪ — পরামর্শ ও অটোকারেক্ট (সপ্তাহ ৭–৮)
- [ ] ডিকশনারি কম্পাইলার স্ক্রিপ্ট: txt → বাইনারি Trie
- [ ] ইংরেজি (~৭০k শব্দ) এবং বাংলা (~৩০k শব্দ) ডিকশনারি কম্পাইল করুন
- [ ] `SuggestionEngine.kt`: প্রিফিক্স সার্চ + ফাজি + ইউজার মডেল
- [ ] Kotlin থেকে React Native-এ `onSuggestionsUpdated` ইভেন্ট এমিট
- [ ] ট্যাপযোগ্য শব্দ চিপস রেন্ডার করে `SuggestionBar.tsx`
- [ ] `useKeyboardState` সাজেশন ইভেন্টে সাবস্ক্রাইব করে
- [ ] Kotlin-এ `commitSpace` শীর্ষ পরামর্শ প্রয়োগ করে
- [ ] `UserWordModel.kt` ট্যাপ করা পরামর্শ থেকে শেখে

**মাইলফলক: ইংরেজি ও বাংলায় স্মার্ট পরামর্শ কাজ করছে**

---

### পর্যায় ৫ — কম্প্যানিয়ন অ্যাপ (সপ্তাহ ৯–১০)
- [ ] অনবোর্ডিং উইজার্ড: ৩-ধাপের প্রবাহ (সক্রিয় করুন → ডিফল্ট সেট করুন → সম্পন্ন)
- [ ] `useSetupStatus.ts`-এ `isKeyboardEnabled()` এবং `isDefaultKeyboard()` পোলিং
- [ ] সেটিংস স্ক্রিন: হ্যাপটিক, সাউন্ড, অটোকারেক্ট টগল
- [ ] থিম পিকার: ডার্ক / লাইট / AMOLED + কাস্টম কালার স্লাইডার
- [ ] ভাষা নির্বাচক স্ক্রিন
- [ ] কাস্টম ডিকশনারি: শব্দ যোগ/সরান
- [ ] `useSettingsSync.ts` পরিবর্তনে SharedPreferences-এ সমস্ত সেটিংস লেখে

**মাইলফলক: কম্প্যানিয়ন অ্যাপ সম্পূর্ণ কার্যকরী; থিম পরিবর্তন কীবোর্ডে প্রতিফলিত হয়**

---

### পর্যায় ৬ — ইমোজি ও ক্লিপবোর্ড (সপ্তাহ ১১–১২)
- [ ] ক্যাটাগরি ট্যাব এবং `FlatList` গ্রিড সহ `EmojiPanel.tsx`
- [ ] SharedPreferences-এ সাম্প্রতিক ইমোজি ট্র্যাকিং
- [ ] হিস্ট্রি `FlatList` সহ `ClipboardPanel.tsx`
- [ ] `ClipboardHandler.kt` সিস্টেম ক্লিপবোর্ড + স্থানীয় হিস্ট্রি পড়া
- [ ] `ClipboardPanel` থেকে `NativeModules.KickKey.getClipboardHistory()` কল
- [ ] কীবোর্ড হাইড ইভেন্টে ইমোজি/ক্লিপবোর্ড প্যানেল আনমাউন্ট

**মাইলফলক: ইমোজি ও ক্লিপবোর্ড প্যানেল কাজ করছে**

---

### পর্যায় ৭ — পালিশ ও পারফরম্যান্স (সপ্তাহ ১৩–১৪)
- [ ] `Key`, `KeyRow`, `SuggestionBar`-এ `React.memo` প্রয়োগ
- [ ] সর্বত্র `StyleSheet.create` ব্যবহার — কোনো ইনলাইন স্টাইল অবজেক্ট নেই
- [ ] IME প্রসেস প্রোফাইল: RAM < ৫০MB
- [ ] পরামর্শ লেটেন্সি প্রোফাইল: < ১০০ms
- [ ] কীবোর্ড খোলার লেটেন্সি প্রোফাইল: < ৮০ms
- [ ] মেমরি-ম্যাপড Trie লোডিং
- [ ] ইনপুট টাইপ অনুযায়ী কীবোর্ড মানিয়ে নেয়: পাসওয়ার্ড, নম্বর, URL
- [ ] সাউন্ড ফিডব্যাক বিকল্প
- [ ] মসৃণ কী প্রেস অ্যানিমেশন

**মাইলফলক: প্রোডাকশন-মানের অনুভব ও পারফরম্যান্স**

---

### পর্যায় ৮ — পরীক্ষা ও রিলিজ (সপ্তাহ ১৫–১৬)
- [ ] Kotlin-এর জন্য ইউনিট টেস্ট কভারেজ > ৮০%
- [ ] সমস্ত ম্যানুয়াল টেস্টিং চেকলিস্ট আইটেম চেক করা হয়েছে
- [ ] ৩+ ফিজিক্যাল ডিভাইসে পরীক্ষা: Samsung (One UI), Xiaomi (MIUI), Pixel (stock)
- [ ] Android 10, 12, 14-এ পরীক্ষা
- [ ] প্রসেস কিলের পরে IME পুনরুদ্ধার পরীক্ষা (`adb shell kill`)
- [ ] গোপনীয়তা নীতি পৃষ্ঠা (Google Play কীবোর্ড অ্যাপের জন্য প্রয়োজনীয়)
- [ ] Play Store লিস্টিং: স্ক্রিনশট, বিবরণ, গোপনীয়তা নীতির লিঙ্ক
- [ ] প্রোডাকশন EAS বিল্ড (`eas build --profile production`)
- [ ] Google Play-এ সাবমিট

**মাইলফলক: KickKey Google Play Store-এ লাইভ**

---

## সারাংশ

| দিক | সিদ্ধান্ত |
|---|---|
| কীবোর্ড UI | **React Native / TypeScript** (`KeyboardScreen.tsx`, `Key.tsx`, ইত্যাদি) |
| কীবোর্ড UI হোস্ট | `ReactRootView` `onCreateInputView()` থেকে ফেরত দেওয়া (Activity ছাড়া) |
| কম্প্যানিয়ন অ্যাপ | React Native + Expo |
| IME রানটাইম | `KickKeyApplication.onCreate()`-এ প্রি-ওয়ার্মড `ReactHost` |
| IME প্রসেস | পৃথক `:ime_process` (কম্প্যানিয়ন থেকে মেমরি আইসোলেশন) |
| কীবোর্ড বান্ডেল | `keyboard.bundle` (~৩–৫MB, শুধু কীবোর্ড কোড) |
| কম্প্যানিয়ন বান্ডেল | `main.bundle` (~১৫–২৫MB, পূর্ণ অ্যাপ) |
| টেক্সট কমিট | Kotlin `KickKeyModule` → `InputConnection.commitText()` |
| পরামর্শ | Kotlin `SuggestionEngine` → বাইনারি Trie, `NativeEventEmitter` দ্বারা RN-এ এমিট |
| বাংলা ইনপুট | Kotlin `BanglaInputEngine` (Avro-স্টাইল ফোনেটিক) |
| স্টেট (কীবোর্ড) | শুধুমাত্র স্থানীয় React `useState` |
| স্টেট (কম্প্যানিয়ন) | Zustand + AsyncStorage |
| ব্রিজ | Expo Modules API (`KickKeyModule.kt`) |
| ডেভ বিল্ড | EAS Build (কাস্টম ডেভেলপমেন্ট বিল্ড, Expo Go নয়) |
| আর্কিটেকচার | পুরানো আর্কিটেকচার (`newArchEnabled=false`) স্থিতিশীলতার জন্য |
| ন্যূনতম SDK | API 26 (Android 8.0) |
| টার্গেট SDK | API 34 (Android 14) |
| IME RAM লক্ষ্য | < ৫০MB |
| কীবোর্ড খোলার লেটেন্সি | < ৮০ms (প্রি-ওয়ার্মড) |

---

*নথি সংস্করণ: ২.০ | সর্বশেষ আপডেট: জুন ২০২৬ | লক্ষ্য: শুধুমাত্র Android*
