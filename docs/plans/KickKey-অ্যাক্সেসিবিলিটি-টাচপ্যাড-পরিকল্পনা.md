# KickKey — Accessibility মেনু ও সিস্টেম-জুড়ে Touchpad
## সম্ভাব্যতা বিশ্লেষণ ও বাস্তবায়ন পরিকল্পনা

> **প্ল্যাটফর্ম:** শুধুমাত্র Android · **প্রযুক্তি স্ট্যাক:** React Native + Expo + Kotlin · **ভাষা:** ইংরেজি ও বাংলা · **প্রজেক্ট:** `react-native-kickKey-deepseek` · **অবস্থা:** পরিকল্পনা — অনুমোদনের অপেক্ষায়

---

## বিষয়সূচি

1. [সারসংক্ষেপ ও সম্ভাব্যতা রায়](#1-সারসংক্ষেপ-ও-সম্ভাব্যতা-রায়)
2. [বর্তমান অবস্থা বিশ্লেষণ](#2-বর্তমান-অবস্থা-বিশ্লেষণ)
3. [প্রস্তাবিত আর্কিটেকচার](#3-প্রস্তাবিত-আর্কিটেকচার)
4. [Accessibility মেনু ইন্টিগ্রেশন](#4-accessibility-মেনু-ইন্টিগ্রেশন)
5. [Touchpad আর্কিটেকচার](#5-touchpad-আর্কিটেকচার)
6. [Pointer / Cursor বাস্তবায়ন](#6-pointer--cursor-বাস্তবায়ন)
7. [Kotlin Native বাস্তবায়ন](#7-kotlin-native-বাস্তবায়ন)
8. [React Native বাস্তবায়ন](#8-react-native-বাস্তবায়ন)
9. [React Native ↔ Kotlin যোগাযোগ](#9-react-native--kotlin-যোগাযোগ)
10. [মাউস-সদৃশ ইনপুট সিমুলেশন](#10-মাউস-সদৃশ-ইনপুট-সিমুলেশন)
11. [ক্লিক হ্যান্ডলিং](#11-ক্লিক-হ্যান্ডলিং)
12. [স্ক্রলিং](#12-স্ক্রলিং)
13. [Back / Forward অ্যাকশন](#13-back--forward-অ্যাকশন)
14. [অনুমতি (Permissions)](#14-অনুমতি-permissions)
15. [Accessibility সার্ভিস ডিজাইন](#15-accessibility-সার্ভিস-ডিজাইন)
16. [স্টেট ম্যানেজমেন্ট](#16-স্টেট-ম্যানেজমেন্ট)
17. [পারফরম্যান্স বিবেচনা](#17-পারফরম্যান্স-বিবেচনা)
18. [নিরাপত্তা ও গোপনীয়তা](#18-নিরাপত্তা-ও-গোপনীয়তা)
19. [Android কম্প্যাটিবিলিটি](#19-android-কম্প্যাটিবিলিটি)
20. [Expo / কাস্টম ডেভেলপমেন্ট বিল্ড প্রয়োজনীয়তা](#20-expo--কাস্টম-ডেভেলপমেন্ট-বিল্ড-প্রয়োজনীয়তা)
21. [পরীক্ষা কৌশল](#21-পরীক্ষা-কৌশল)
22. [বিল্ড ও ডেপ্লয়মেন্ট](#22-বিল্ড-ও-ডেপ্লয়মেন্ট)
23. [Google Play Store বিবেচনা](#23-google-play-store-বিবেচনা)
24. [সম্ভাব্য সীমাবদ্ধতা ও ঝুঁকি](#24-সম্ভাব্য-সীমাবদ্ধতা-ও-ঝুঁকি)
25. [প্রস্তাবিত ফোল্ডার স্ট্রাকচার](#25-প্রস্তাবিত-ফোল্ডার-স্ট্রাকচার)
26. [উন্নয়ন মাইলফলক](#26-উন্নয়ন-মাইলফলক)
27. [বাস্তবায়নের আগে প্রয়োজনীয় সিদ্ধান্ত](#27-বাস্তবায়নের-আগে-প্রয়োজনীয়-সিদ্ধান্ত)

---

## 1. সারসংক্ষেপ ও সম্ভাব্যতা রায়

**সংক্ষিপ্ত উত্তর: হ্যাঁ — প্রতিটি প্রয়োজনীয়তা অর্জনযোগ্য, তবে দুটি গুরুত্বপূর্ণ প্ল্যাটফর্ম-সীমাবদ্ধতা আছে যা পুরো ডিজাইনকে আকার দেয়।**

KickKey ইতিমধ্যেই একটি হাইব্রিড অ্যাপ: একটি Kotlin `InputMethodService`-এর ভেতরে, আলাদা `:ime_process`-এ চলে React Native কীবোর্ড UI, এবং `KickKeyModule` নেটিভ ব্রিজের মাধ্যমে যোগাযোগ করে। দুটি নতুন ফিচারই এই ভিত্তির উপর দাঁড়াবে:

| প্রয়োজনীয়তা | রায় | পদ্ধতি |
|---|---|---|
| কীবোর্ড **Accessibility মেনুতে** | ⚠️ আংশিক — নিচে নোট দেখুন | সিস্টেম Accessibility মেনু থার্ড-পার্টি অ্যাপ দ্বারা বাড়ানো যায় না। সমর্থিত বিকল্প হলো **Accessibility বাটন / শর্টকাট**, যা KickKey-এর নিজস্ব accessibility সার্ভিসে বরাদ্দ হয়। |
| **ইনপুট ফিল্ড ছাড়াই** কীবোর্ড খোলা | ✅ | একটি সক্রিয় `AccessibilityService` ফ্লোটিং ওভারলে উইন্ডো (`TYPE_ACCESSIBILITY_OVERLAY`) দেখাতে পারে, যেখানে RN কীবোর্ড থাকে — ফোকাসড ফিল্ড লাগে না। |
| সিস্টেম-জুড়ে pointer / cursor | ✅ (নিজের আঁকা) | একটি ছোট RN "cursor surface" স্বচ্ছ ওভারলে উইন্ডোতে, `WindowManager.updateViewLayout()` দিয়ে অবস্থান পরিবর্তন হয়। |
| **অন্য অ্যাপে** pointer নেওয়া | ✅ | ওভারলে উইন্ডোর কোনো সীমানা নেই; cursor যেকোনো জায়গায় বসানো যায়। |
| অন্য অ্যাপে ক্লিক | ✅ | `AccessibilityService.dispatchGesture()` সিস্টেম-জুড়ে প্রকৃত টাচ জেসচার ইনজেক্ট করে (API 24+)। |
| অন্য অ্যাপে স্ক্রল | ✅ (সোয়াইপ-ভিত্তিক) | `dispatchGesture()` উল্লম্ব সোয়াইপ, অথবা ফোকাসড নোডে `ACTION_SCROLL_FORWARD/BACKWARD`। |
| **Back** বাটন | ✅ | `performGlobalAction(GLOBAL_ACTION_BACK)`। |
| **Forward** বাটন | ⚠️ সীমিত | `GLOBAL_ACTION_FORWARD` নেই এবং a11y-তে কী ইনজেকশন নেই। শুধুমাত্র ADB "pro mode" (`INJECT_EVENTS`) বা অ্যাপের নিজস্ব টুলবার বাটনে ট্যাপে কাজ করে। |
| প্রকৃত মাউস **hover** (লিংক হাইলাইট ইত্যাদি) | ⚠️ পাবলিক API-তে নেই | প্রয়োজন `INJECT_EVENTS` (signature অনুমতি, Android 12+ এ ব্লকড, Android ≤ 11 এ ADB দিয়ে সম্ভব / root লাগে)। §১০ "Pro mode" দেখুন। |
| মাউস-হুইল স্ক্রল | ⚠️ পাবলিক API-তে নেই | একই `INJECT_EVENTS` সীমাবদ্ধতা; Play-নিরাপদ পথ হলো সোয়াইপ-ভিত্তিক স্ক্রল। |
| Touchpad + cursor-এর UI React Native-এ | ✅ | Touchpad UI ইতিমধ্যে আছে (`Touchpad.tsx`); cursor হবে একটি নতুন RN surface। |
| সিস্টেম-স্তরের কাজ Kotlin-এ | ✅ | নতুন `KickKeyAccessibilityService` + জেসচার ইনজেকশন Kotlin-এ। |
| Expo Custom Modules যথেষ্ট | ✅ | কনফিগ প্লাগইন + কপি-করা Kotlin ফাইল প্যাটার্ন (IME-তে ব্যবহৃত) সহজেই বাড়ানো যায়। |

### ১.১ দশটি সম্ভাব্যতা প্রশ্নের উত্তর

1. **কীবোর্ড কি Android Accessibility মেনুতে যোগ করা যায়?** — **সিস্টেম** Accessibility মেনু (Settings → Accessibility → Accessibility Menu) শুধুমাত্র সিস্টেম অ্যাকশন (Back, Home, Recents, Screenshot…) ও ব্যবহারকারী-নির্ধারিত ফিচার শর্টকাট দেখায়। **থার্ড-পার্টি অ্যাপ এতে এন্ট্রি যোগ করতে পারে না।** কিছু OEM মেনু (যেমন Samsung-এর "Assistant menu") কাস্টম শর্টকাট দেয়, কিন্তু স্টক Android-এ নয়। সঠিক, সম্পূর্ণ সমর্থিত উপায়: KickKey একটি `AccessibilityService` নিবন্ধন করে; ব্যবহারকারী এটিকে **Accessibility বাটন** বা **শর্টকাটে** (Volume+Power / তিন-আঙুলের জেসচার) বরাদ্দ করে; ট্যাপ করলে `onAccessibilityButtonClicked()` চালু হয় এবং KickKey প্যানেল খোলে — একটি ট্যাপ, কোনো ইনপুট ফিল্ড লাগে না। **রায়: accessibility বাটন/শর্টকাট পথে সম্ভব (ব্যবহারকারী অনুমোদন করেছেন); সিস্টেম মেনুর ভেতরে আক্ষরিক এন্ট্রি হিসেবে সম্ভব নয়।**

2. **ইনপুট ফিল্ড ছাড়া কীবোর্ড খোলা যায় কি?** — হ্যাঁ। `InputMethodService` শুধু ফোকাসড ফিল্ড থাকলে দেখায়, কিন্তু **accessibility-সার্ভিস ওভারলে উইন্ডোর জন্য তা লাগে না**। ফ্লোটিং কীবোর্ড/টাচপ্যাড প্যানেল একটি `TYPE_ACCESSIBILITY_OVERLAY` উইন্ডো, যা একই RN কীবোর্ড বান্ডেল হোস্ট করে।

3. **অ্যাপ কি সিস্টেম-জুড়ে pointer তৈরি ও নিয়ন্ত্রণ করতে পারে?** — হ্যাঁ, তবে এটি **আমাদের নিজের আঁকা pointer**, OS-এর cursor নয়। OS cursor শুধুমাত্র ফিজিক্যাল ইনপুট ডিভাইসের জন্য; সিস্টেম cursor তৈরি করার বা `HOVER_MOVE` ইভেন্ট ইনজেক্ট করার কোনো পাবলিক API নেই। আমাদের RN cursor একটি ওভারলে উইন্ডো, যা স্ক্রিনের যেকোনো জায়গায় বসে।

4. **Accessibility Service কি মাউস-সদৃশ অ্যাকশন (ক্লিক, স্ক্রল) করতে পারে?** — হ্যাঁ, **টাচ-সমতুল্য** অ্যাকশনের জন্য: ট্যাপ (লেফট ক্লিক), লং-প্রেস (রাইট-ক্লিকের আনুমানিক), সোয়াইপ (স্ক্রল, ড্র্যাগ)। `dispatchGesture()` যেকোনো উইন্ডোতে ইনজেক্ট করে, তাই এটি সব অ্যাপে কাজ করে। তবে hover বা হুইল ইভেন্ট তৈরি করতে পারে না।

5. **Pointer কি অন্য অ্যাপ্লিকেশনের উপর দিয়ে যেতে পারে?** — হ্যাঁ। ওভারলে উইন্ডোটি স্ক্রিন কোঅর্ডিনেটে (`WindowManager.LayoutParams.x/y`, `gravity = TOP|START`) বসে; "আমাদের অ্যাপ"-এর মধ্যে সীমাবদ্ধ নয়। Cursor-এর অবস্থানে পাঠানো ক্লিক/সোয়াইপ নিচের অ্যাপকেই প্রভাবিত করে।

6. **কোন অনুমতি প্রয়োজন?** — `BIND_ACCESSIBILITY_SERVICE` (সার্ভিস ঘোষণা), `SYSTEM_ALERT_WINDOW` (শুধু ফলব্যাক পথ), `VIBRATE` (ইতিমধ্যে আছে)। `INJECT_EVENTS` (signature অনুমতি) শুধু ঐচ্ছিক ADB pro mode-এর জন্য। Android 13+ এ নোটিফিকেশন এন্ট্রি পয়েন্ট চাইলে `POST_NOTIFICATIONS`।

7. **Accessibility Service আবশ্যক নাকি অন্য API?** — আবশ্যক। সিস্টেম-জুড়ে ইনপুট ইনজেকশন বা গ্লোবাল অ্যাকশনের **কোনো বিকল্প পাবলিক API নেই**। `InputManager.injectInputEvent()`-এর জন্য `INJECT_EVENTS` দরকার (signature/privileged; Android 12+ এ targetSdk 31+ হলে ব্লকড)। Accessibility Service-ই একমাত্র Play-আইনি ইনজেকশন চ্যানেল।

8. **Expo Custom Modules কি যথেষ্ট?** — হ্যাঁ। বর্তমান আর্কিটেকচার (কনফিগ প্লাগইন `withImeService.js` দিয়ে Kotlin কপি + ম্যানিফেস্ট এডিট + `KickKeyModule` ব্রিজ) accessibility সার্ভিস পর্যন্ত বাড়ে: নতুন প্লাগইন সার্ভিস + কনফিগ XML ঘোষণা করবে; নতুন Kotlin ক্লাস একইভাবে কপি হবে; নতুন `@ReactMethod` API গুলো JS-কে দেবে।

9. **সংস্করণ-নির্দিষ্ট সীমাবদ্ধতা** — §১৯ দেখুন। মূল বিষয়: `dispatchGesture`-এর জন্য API 24+ লাগে (KickKey-এর RN 0.86 minSdk = 24 — ঠিক আছে); `injectInputEvent` targetSdk 31+ হলে ব্লকড (Android 12+); Android 13-এর "Restricted settings" সাইডলোডকৃত a11y সার্ভিসে অতিরিক্ত ধাপ চায়; Android 14+ এ Play কনসোলে a11y ব্যবহারের কারণ ঘোষণা বাধ্যতামূলক।

10. **নিরাপত্তা / গোপনীয়তা / Play নীতি** — Accessibility একটি সংবেদনশীল অনুমতি। Play-তে নীতি ঘোষণা, `android:isAccessibilityTool` সিদ্ধান্ত এবং ব্যবহারকারী-দৃশ্যমান কারণ দরকার। ডিভাইস থেকে কোনো ডেটা বের হয় না; সার্ভিস শুধু ব্যবহারকারীর স্পষ্ট ট্রিগার করা জেসচারই করে। §১৮ ও §২৩ দেখুন।

---

## 2. বর্তমান অবস্থা বিশ্লেষণ

### ২.১ যা ইতিমধ্যে আছে (`react-native-kickKey-deepseek`-এ যাচাইকৃত)

- **দুটি প্রসেস**: মূল অ্যাপ প্রসেস (Expo Router UI) এবং `:ime_process` (`KickKeyInputMethodService`-এ `withImeService.js` দিয়ে ঘোষিত)।
- **কীবোর্ড ReactHost**: `KickKeyApplication.initKeyboardRuntime()` দ্বিতীয় একটি `ReactHost` তৈরি করে যা `assets://keyboard.bundle` (Hermes) লোড করে, IME প্রসেসে প্রি-ওয়ার্ম করা হয়। `KickKeyInputMethodService` `keyboard.index.js` থেকে `KickKeyKeyboard` নামে একটি `ReactSurface` তৈরি করে `FrameLayout`-এ।
- **Touchpad টগল** (JS-এ ইতিমধ্যে বাস্তবায়িত):
  - `useKeyboardState.ts`-এ `toggleMode` (ডিফল্ট `false`)।
  - `QykeyKeyboard.tsx`-এ `KeyboardSlider` রেন্ডার হয়; `toggleMode === true` হলে মূল কী-এরিয়া `<Touchpad />` দিয়ে প্রতিস্থাপিত হয় (`styles.touchpadArea`)।
  - `Touchpad.tsx`-এ ড্র্যাগ সারফেস, স্থানীয় ভিজ্যুয়াল কার্সর ডট, **L / R** বাটন, **স্ক্রল আপ/ডাউন** কেয়ারেট, **ব্যাক/ফরোয়ার্ড** শেভরন এবং পারমিশন ব্যানার আছে।
- **নেটিভ টাচপ্যাড ব্যাকএন্ড** (বর্তমান, `KickKeyModule.kt`): DPAD `moveCursor`, `PAGE_UP/PAGE_DOWN` `scrollPage`, `ALT+DPAD` `navigateHistory`, `DPAD_CENTER/KEYCODE_MENU` `mouseClick` — সবগুলো `InputConnection` দিয়ে, অর্থাৎ এগুলো **শুধু ফোকাসড টেক্সট ফিল্ড**-কে প্রভাবিত করে, অন্য অ্যাপ নয়।
- **নেটিভ pointer** (বর্তমান): 28dp `ImageView` বিটম্যাপ তীর `TYPE_APPLICATION_OVERLAY` উইন্ডোতে (`pointerShow/pointerMove/pointerHide`), `SYSTEM_ALERT_WINDOW` লাগে, কীবোর্ডের উপরে ক্ল্যাম্পড, **ক্লিকযোগ্য নয়** (কোথাও ট্যাপ ডিসপ্যাচ হয় না — সিস্টেম-জুড়ে ক্লিকের ব্যবস্থা নেই)।

### ২.২ যা পরিবর্তন হবে

| অংশ | বর্তমান | লক্ষ্য |
|---|---|---|
| Cursor | নেটিভ `ImageView` বিটম্যাপ | **RN কম্পোনেন্ট**, আলাদা ওভারলে "cursor surface"-এ |
| Pointer অবস্থান | অ্যাপ-এরিয়া (কীবোর্ডের উপরে) ক্ল্যাম্পড | **স্ক্রিনের যেকোনো জায়গায়** |
| ক্লিক / স্ক্রল / ব্যাক / ফরোয়ার্ড | `InputConnection` কী-ইভেন্ট (শুধু টেক্সট ফিল্ড) | **`dispatchGesture` + `GLOBAL_ACTION_BACK` via Accessibility Service** (সব অ্যাপ) |
| ইনপুট ফিল্ড ছাড়া এন্ট্রি | সম্ভব নয় | **A11y বাটন/শর্টকাট + ইন-অ্যাপ বাটন → ফ্লোটিং কীবোর্ড ওভারলে** |
| ঐচ্ছিক "pro mode" | — | `INJECT_EVENTS` via ADB — প্রকৃত hover / হুইল / Forward (Android ≤ 11) |

---

## 3. প্রস্তাবিত আর্কিটেকচার

```
┌──────────────────────────────  :ime_process  ──────────────────────────────┐
│                                                                            │
│  KickKeyApplication (কীবোর্ড ReactHost, প্রি-ওয়ার্মড)                     │
│   ├─ ReactSurface "KickKeyKeyboard"  ← IME ইনপুট ভিউ (বর্তমান)            │
│   ├─ ReactSurface "KickKeyPointer"   ← NEW: RN cursor ওভারলে উইন্ডো        │
│   └─ ReactSurface "KickKeyOverlay"   ← NEW: ফ্লোটিং কীবোর্ড/টাচপ্যাড       │
│                                        প্যানেল (a11y শর্টকাট থেকে খোলে)   │
│                                                                            │
│  KickKeyInputMethodService (IME, বর্তমান)                                 │
│  KickKeyAccessibilityService (NEW, একই প্রসেস — কোনো IPC লাগবে না)         │
│   ├─ dispatchGesture()        → ট্যাপ / লং-প্রেস / সোয়াইপ (যেকোনো অ্যাপ)   │
│   ├─ performGlobalAction()    → BACK (HOME, RECENTS, ...)                  │
│   ├─ TYPE_ACCESSIBILITY_OVERLAY উইন্ডো → cursor + ফ্লোটিং প্যানেল          │
│   └─ onAccessibilityButtonClicked() → ফ্লোটিং প্যানেল খোলে                 │
│                                                                            │
│  KickKeyModule (ব্রিজ, বর্তমান) — টাচপ্যাড মেথডগুলো accessibility          │
│   সার্ভিস সিংগলটনে পুনঃনির্দেশিত:                                          │
│   pointerShow/Move/Hide, clickAtCursor, scrollAtCursor, navBack/Forward,   │
│   isA11yEnabled, openA11ySettings, pro-mode INJECT_EVENTS র‍্যাপার          │
└────────────────────────────────────────────────────────────────────────────┘
```

**কেন Accessibility Service `:ime_process`-এ থাকবে (সুপারিশকৃত):**
- কীবোর্ড ReactHost সেখানে ইতিমধ্যে প্রি-ওয়ার্মড; ফ্লোটিং প্যানেল, cursor surface ও IME — সব **একই** JS বান্ডেল ও হোস্ট থেকে রেন্ডার হয়।
- টাচপ্যাড JS → `KickKeyModule` → সার্ভিস কলগুলো **একই প্রসেসে** (কোনো AIDL, সিরিয়ালাইজেশন বা লেটেন্সি নেই)।

**বিকল্প (নথিভুক্ত, সুপারিশকৃত নয়):** সার্ভিস মূল প্রসেসে + `:ime_process` থেকে বাউন্ড-সার্ভিস/AIDL ব্রিজ। বেশি জটিলতা, প্রতিটি pointer মুভে IPC লেটেন্সি, এবং React surface প্রসেস জুড়ে বিভক্ত। শুধুমাত্র ডিভাইস টেস্টে OEM-রা সেকেন্ডারি প্রসেসে a11y সার্ভিস নিয়ে সমস্যা দেখালে (বিরল, §২৪) এই ফলব্যাকে যাব।

### ৩.১ ডেটা ফ্লো — টাচপ্যাড ড্র্যাগ → স্ক্রিনে pointer

```
Touchpad সারফেসে আঙুলের ড্র্যাগ (Touchpad.tsx PanResponder)
   → onPointerMove(dx, dy)                    [প্রতি ফ্রেম, থ্রটলড]
   → KickKeyModule.pointerMove(dx, dy)        [JS → Kotlin, প্রতি ফ্রেমে এক কল]
   → Kotlin: cursorX += dx; cursorY += dy     [স্ক্রিনে ক্ল্যাম্পড]
   → WindowManager.updateViewLayout(cursor উইন্ডো)
   → (ঐচ্ছিক pro mode) HOVER_MOVE MotionEvent ইনজেকশন
```

### ৩.২ ডেটা ফ্লো — ক্লিক / স্ক্রল / ব্যাক

```
Touchpad.tsx-এ L বাটন (বা ট্যাপ-টু-ক্লিক)
   → onMouseClick('left') → KickKeyModule.mouseClick('left')
   → KickKeyAccessibilityService.dispatchGesture(
        (cursorX, cursorY) তে ট্যাপ, ~60ms)
   → cursor-এর নিচের অ্যাপটি প্রকৃত টাচ পায়
```

```
স্ক্রল আপ/ডাউন বাটন (ধরে রাখলে রিপিট)
   → onScrollPage('up') → KickKeyModule.scrollPage('up')
   → ফোকাসড নোডে performAction(ACTION_SCROLL_BACKWARD),
     ফলব্যাক: cursor অবস্থানে উল্লম্ব সোয়াইপ dispatchGesture
```

```
ব্যাক শেভরন → onNavigateHistory('backward')
   → KickKeyModule.navigateBack() → performGlobalAction(GLOBAL_ACTION_BACK)
ফরোয়ার্ড শেভরন → a11y পথ: নো-অপ + ইঙ্গিত; pro mode: KEYCODE_FORWARD ইনজেকশন
```

---

## 4. Accessibility মেনু ইন্টিগ্রেশন

### ৪.১ Android-এ "Accessibility মেনু" বলতে কী বোঝায় (যাচাইকৃত)

সিস্টেম **Accessibility মেনু** হলো Google-এর মালিকানাধীন একটি ওভারলে (Settings → Accessibility → Accessibility Menu), যার বিষয়বস্তু নির্দিষ্ট: সিস্টেম অ্যাকশন (Back, Home, Recents, Notifications, Quick Settings, Screenshot, Volume…) এবং ব্যবহারকারী-বরাদ্দ করা ফিচার শর্টকাট। **থার্ড-পার্টি অ্যাপের জন্য এই মেনুতে এন্ট্রি যোগ করার কোনো API নেই।**

### ৪.২ KickKey-এর সমর্থিত সমতুল্য (ব্যবহারকারী অনুমোদিত)

1. **Accessibility বাটন** — সার্ভিস `flagRequestAccessibilityButton` ঘোষণা করে; ব্যবহারকারী অন-স্ক্রিন/নেভ-বার accessibility বাটন চালু করেন, অথবা **শর্টকাটে** (Volume+Power ধরে রাখা, বা তিন-আঙুলের জেসচার) KickKey বরাদ্দ করেন। ট্রিগার হলে `onAccessibilityButtonClicked()` ফ্লোটিং KickKey প্যানেল খোলে।
2. **ইন-অ্যাপ এন্ট্রি** — সেটিংস স্ক্রিনে "Enable KickKey accessibility" বাটন (`Settings.ACTION_ACCESSIBILITY_SETTINGS` ডিপ লিংক); সক্রিয় হলে ঐচ্ছিক নোটিফিকেশন অ্যাকশন "Open KickKey panel"।
3. **খোলার সময়** — সার্ভিস একটি `TYPE_ACCESSIBILITY_OVERLAY` উইন্ডো দেখায় যেখানে ReactSurface `KickKeyOverlay` থাকে (একই `QykeyKeyboard` বান্ডেল, ডিফল্ট কীবোর্ড মোড, স্লাইডার দিয়ে টাচপ্যাড মোড)। কোনো ইনপুট ফিল্ড ফোকাসড বা প্রয়োজন হয় না।

### ৪.৩ ব্যবহারকারী যা দেখবেন

```
Settings → Accessibility → (Accessibility button | Shortcut) → KickKey
   → যেকোনো সময়, যেকোনো জায়গায় বাটন/শর্টকাট ট্যাপ করুন
   → ফ্লোটিং KickKey প্যানেল দেখা যায় (কীবোর্ড ⇄ টাচপ্যাড স্লাইডারসহ)
   → টাচপ্যাড ব্যবহার করুন: cursor পুরো স্ক্রিনে ঘোরে, L/R ক্লিক,
     স্ক্রল, ব্যাক — সবই নিচের অ্যাপে কাজ করে
   → বাইরে ট্যাপ / হাইড বাটন → প্যানেল বন্ধ
```

---

## 5. Touchpad আর্কিটেকচার

- **অবস্থান:** বিদ্যমান `Touchpad.tsx`-ই একমাত্র টাচপ্যাড UI থাকবে — (ক) IME কীবোর্ডে `toggleMode` চালু থাকলে, অথবা (খ) a11y বাটন থেকে খোলা ফ্লোটিং প্যানেলে।
- **আচরণ আপগ্রেড:** DPAD-কেয়ারেট স্টেপিং (`STEP_THRESHOLD` জমা → `onMoveCursor`) **প্রতিস্থাপিত** হবে ক্রমাগত pointer মুভমেন্ট দিয়ে: প্রতিটি PanResponder মুভ একটি আপেক্ষিক `(dx, dy)` ডেল্টা পাঠায়; Kotlin cursor উইন্ডোর অবস্থান আপডেট করে। "ট্যাপ টু ক্লিক" (দ্রুত তুলে নেওয়া, নড়াচড়া ছাড়া) ঐচ্ছিক সেটিং হবে।
- **স্ক্রিন কভারেজ সমস্যা:** প্যানেল যখন IME কীবোর্ড, তখন এর উইন্ডো নিচের ~275dp ঢেকে রাখে — সেখানে ডিসপ্যাচ করা ট্যাপ কীবোর্ডেই পড়বে, অ্যাপে নয়। দুটি প্রশমন, দুটোই বাস্তবায়ন হবে:
  - **ফ্লোটিং প্যানেল** (a11y এন্ট্রি) ড্র্যাগযোগ্য ও বন্ধযোগ্য — ব্যবহারকারী পথ থেকে সরিয়ে রাখতে পারেন।
  - প্যানেল যখন IME কীবোর্ড এবং টাচপ্যাড মোড চালু, তখন IME উইন্ডো **পাতলা টাচপ্যাড স্ট্রিপে** (~90dp) সঙ্কুচিত করি (`updateSoftInputWindowLayout` / নতুন মাপা কন্টেইনার) — বাকি স্ক্রিন মুক্ত। বিদ্যমান `KEYBOARD_HEIGHT_DP` ধ্রুবক টাচপ্যাড মোডে ডাইনামিক মান দিয়ে প্রতিস্থাপিত হয়।
- **ড্র্যাগ (মাউস-ড্র্যাগ) সাপোর্ট:** **L** চেপে ড্র্যাগ করলে একটি একক `dispatchGesture` স্ট্রোক (ডাউন → মুভ → আপ) হয় — স্লাইডার টানা ও কন্টেন্ট ড্র্যাগ-স্ক্রল, ফিজিক্যাল মাউসের মতো।

---

## 6. Pointer / Cursor বাস্তবায়ন

**প্রয়োজনীয়তা: cursor UI React Native-এ।** বর্তমান `ImageView` বিটম্যাপ একটি আলাদা RN surface দিয়ে প্রতিস্থাপিত হবে:

1. **`keyboard.index.js`** দ্বিতীয় কম্পোনেন্ট নিবন্ধন করবে:
   ```js
   AppRegistry.registerComponent('KickKeyPointer', () => KickKeyPointerRoot);
   ```
   `KickKeyPointerRoot` একটি ছোট, স্থির, `pointerEvents="none"` তীর রেন্ডার করে (`react-native-svg` দিয়ে আঁকা — ইতিমধ্যে ডিপেন্ডেন্সি), ~28–36dp, ড্রপ শ্যাডোসহ।
2. **Kotlin** কীবোর্ড `ReactHost` থেকে দ্বিতীয় `ReactSurface` তৈরি করে (`host.createSurface(this, "KickKeyPointer", null)`) এবং এর ভিউ `WindowManager` উইন্ডোতে যোগ করে:
   - `TYPE_ACCESSIBILITY_OVERLAY` (`SYSTEM_ALERT_WINDOW` লাগে না, a11y সার্ভিস সক্রিয়) — প্রাথমিক।
   - ফলব্যাক: `TYPE_APPLICATION_OVERLAY` (`SYSTEM_ALERT_WINDOW` প্রয়োজন) — শুধু IME-কেসে, সার্ভিস সক্রিয় না থাকলে।
   - ফ্ল্যাগ: `FLAG_NOT_FOCUSABLE | FLAG_NOT_TOUCHABLE | FLAG_LAYOUT_NO_LIMITS`, `PixelFormat.TRANSLUCENT`, `gravity = TOP|START`, কোনো সীমানা নেই → **স্ক্রিনের যেকোনো জায়গায় বসানো যায়**।
3. **মুভমেন্ট:** `pointerMove(dx, dy)` (JS থেকে প্রতি ফ্রেমে সর্বোচ্চ একবার) `cursorX/cursorY` আপডেট করে (পুরো স্ক্রিনে ক্ল্যাম্পড — `0..screenW`, `0..screenH`) এবং `updateViewLayout()` কল করে। RN তীর নিজে মুভের সময় কখনো রি-রেন্ডার হয় না — অবস্থান নেটিভ লেআউট প্যারামিটারে থাকে।
4. **Cursor স্টেটের মালিকানা:** নেটিভই একমাত্র সোর্স অফ ট্রুথ (`cursorX`, `cursorY`)। ক্লিক/স্ক্রল/ব্যাক মেথডগুলো তা পড়ে — টাচপ্যাড surface ও cursor surface-এর মধ্যে সিঙ্কের দরকার নেই।

---

## 7. Kotlin Native বাস্তবায়ন

নতুন ফাইল (সবগুলো `native-files/java/com/kickkey/`-তে; বিদ্যমানগুলোর মতো কনফিগ প্লাগইন কপি করবে):

### `KickKeyAccessibilityService.kt`
- `AccessibilityService` এক্সটেন্ড করে; `BIND_ACCESSIBILITY_SERVICE` + `res/xml/accessibility_service_config.xml` দিয়ে ঘোষিত।
- **সিংগলটন** (`companion object { @Volatile var instance }`) — যেন `KickKeyModule` IPC ছাড়া পৌঁছাতে পারে।
- মূল মেথড:
  ```kotlin
  fun tapAt(x: Float, y: Float)                 // dispatchGesture ডাউন+আপ, ~60ms
  fun longPressAt(x: Float, y: Float)           // ~600ms স্ট্রোক (রাইট-ক্লিক প্রক্সি)
  fun swipe(fromX, fromY, toX, toY, dur)        // স্ক্রল / ড্র্যাগ
  fun dragStroke(start, end, dur)               // L-ড্র্যাগ
  fun navigateBack()  = performGlobalAction(GLOBAL_ACTION_BACK)
  fun navigateHome()  = performGlobalAction(GLOBAL_ACTION_HOME)
  fun scrollNode(direction: Int)                // ফোকাসড নোডে ACTION_SCROLL_*
  fun showFloatingPanel() / hideFloatingPanel() // ওভারলে উইন্ডো + RN surface
  fun showCursor() / moveCursorWindow(dx, dy) / hideCursor()
  fun isEnabled() / onAccessibilityButtonClicked() / onServiceConnected()
  ```
- জেসচার হেল্পার `MotionEvent.obtain(...)` স্ট্রোক থেকে `GestureDescription` তৈরি করে (সব ইনজেক্টেড ইভেন্টই প্রকৃত, ফ্রেমওয়ার্ক-উৎসিত `MotionEvent`)।

### `KickKeyInputMethodService.kt` (পরিবর্তন)
- টাচপ্যাড-মোড সঙ্কোচন: `toggleMode` সক্রিয় হলে ডাইনামিক উইন্ডো উচ্চতা (JS নতুন `@ReactMethod setTouchpadMode(on)` দিয়ে নেটিভকে জানায়)।
- বাকি IME লজিক অপরিবর্তিত।

### `KickKeyModule.kt` (টাচপ্যাড API পুনঃনির্দেশ)
- `pointerShow / pointerMove / pointerHide` → সার্ভিস সিংগলটনে রুট (cursor ওভারলে উইন্ডো), `ImageView`-এর বদলে।
- `mouseClick(button)` → `tapAt(cursorX, cursorY)` / `longPressAt(...)`।
- `scrollPage(direction)` → `scrollNode(...)` + সোয়াইপ ফলব্যাক।
- `navigateHistory(direction)` → Back গ্লোবাল অ্যাকশনে; Forward pro mode / নো-অপ।
- নতুন: `setTouchpadMode(on)`, `isAccessibilityEnabled(promise)`, `openAccessibilitySettings(promise)`, `proModeInject(event: ...)` (ADB পথ)।

### Pro-mode র‍্যাপার (ঐচ্ছিক, ADB)
- `InputManager.injectInputEvent()` — `HOVER_MOVE`, `ACTION_SCROLL` (হুইল) এবং `KEYCODE_FORWARD`-এর জন্য; রানটাইম চেক যে `INJECT_EVENTS` সত্যিই গ্র্যান্টেড (`checkSelfPermission`), না হলে মসৃণভাবে a11y পথে ফলব্যাক।

---

## 8. React Native বাস্তবায়ন

- **`keyboard.index.js`** — `KickKeyPointer` নিবন্ধন (এবং ফ্লোটিং প্যানেল `KickKeyKeyboard`-কে আলাদা ইনিশিয়াল প্রপসে পুনরায় ব্যবহার করে, যেমন `{ surface: 'overlay' }`)।
- **নতুন `src/keyboard/pointer/PointerRoot.tsx`** — cursor কম্পোনেন্ট: `react-native-svg` তীর, `pointerEvents="none"`, সম্পূর্ণ স্বচ্ছ ব্যাকগ্রাউন্ড। স্থির; মুভে রি-রেন্ডার নেই।
- **নতুন `src/keyboard/overlay/FloatingPanel.tsx`** — ওভারলে surface-এর র‍্যাপার: গোলাকার, গাঢ় কার্ড; ড্র্যাগ হ্যান্ডেল, ক্লোজ বাটন এবং বিদ্যমান `QykeyKeyboard` (কীবোর্ড ⇄ টাচপ্যাড স্লাইডার অপরিবর্তিত কাজ করে)। নেটিভ উইন্ডো প্যারামিটার দিয়ে অবস্থান; ড্র্যাগ হ্যান্ডেল `pointerMove`-ধরনের নেটিভ কল দিয়ে আপডেট করে।
- **`Touchpad.tsx`** — DPAD-স্টেপ লজিকের বদলে ক্রমাগত ডেল্টা; "ট্যাপ টু ক্লিক" (সক্রিয় করলে); L/R/স্ক্রল/ব্যাক/ফরোয়ার্ড ওয়্যারিং থাকে (এবার নতুন নেটিভ মেথডে ম্যাপ হয়)।
- **`useKeyboardState.ts`** — হ্যান্ডলারগুলো নতুন API-তে; `setTouchpadMode`, `isAccessibilityEnabled`, pro-mode টগল যোগ।
- **সেটিংস স্ক্রিন (`app/(tabs)/settings.tsx`)** — "Enable accessibility" রো (ডিপ লিংক), স্ট্যাটাস রো (চালু/বন্ধ), pro-mode টগল (পারমিশন শনাক্ত হলে দেখা যাবে)।
- **`modules/kickkey-module/index.ts`** — সব নতুন মেথডের টাইপড র‍্যাপার।

---

## 9. React Native ↔ Kotlin যোগাযোগ

বিদ্যমান ব্রিজ প্যাটার্নই পুনরায় ব্যবহার হবে — **সুপারিশকৃত ডিজাইনে কোনো নতুন IPC নেই** (একই প্রসেস)।

| দিক | প্রক্রিয়া | উদাহরণ |
|---|---|---|
| JS → Kotlin | `KickKey`-তে `@ReactMethod` প্রমিস কল | `pointerMove`, `mouseClick`, `scrollPage`, `navigateBack`, `setTouchpadMode`, `isAccessibilityEnabled` |
| Kotlin → JS | `DeviceEventManagerModule.RCTDeviceEventEmitter.emit(...)` | `onAccessibilityStateChanged`, `onPanelHidden`, `onProModeChanged` |
| ফ্রেম-রেট পথ | প্রতি ফ্রেমে একটি `pointerMove(dx, dy)` (JS-এ `requestAnimationFrame` দিয়ে থ্রটলড) | ড্র্যাগ আপডেট |
| ওভারলে surface | একই `ReactHost` — surface `KickKeyKeyboard` / `KickKeyPointer` / `KickKeyOverlay` বান্ডেল ও `KickKeyModule` ইনস্ট্যান্স ভাগ করে | ক্রস-surface মেসেজিং লাগে না (নেটিভ cursor অবস্থানের মালিক) |

ফলব্যাক আর্কিটেকচার (মূল প্রসেসে a11y সার্ভিস) প্রয়োজন হলে ব্রিজ হবে বাউন্ড সার্ভিস: `:ime_process` `KickKeyTouchpadBridgeService` (AIDL বা Messenger) বাইন্ড করে একই ওয়ান-ওয়ে কল ফরোয়ার্ড করে; ব্রিজ সার্ভিস সিংগলটনে ফরোয়ার্ড করে। এটি ইচ্ছাকৃতভাবে ডিফল্ট নয়।

---

## 10. মাউস-সদৃশ ইনপুট সিমুলেশন

### Play-নিরাপদ পথ (ডিফল্ট) — Accessibility Service
| অ্যাকশন | সিমুলেশন |
|---|---|
| Pointer মুভমেন্ট | `updateViewLayout` দিয়ে আমাদের RN cursor ওভারলে সরানো |
| লেফট ক্লিক | `dispatchGesture` ট্যাপ (cursor-এ ডাউন+আপ) |
| রাইট ক্লিক | `dispatchGesture` লং-প্রেস (~600ms) — বেশিরভাগ অ্যাপে কনটেক্সট মেনু খোলে |
| ড্র্যাগ | এক স্ট্রোক: ডাউন → মুভ → আপ |
| স্ক্রল | উল্লম্ব সোয়াইপ স্ট্রোক (ধরে রাখলে রিপিট) এবং/অথবা ফোকাসড নোডে `ACTION_SCROLL_*` |
| Back | `GLOBAL_ACTION_BACK` |
| Home / Recents / Notifications | `GLOBAL_ACTION_*` (উপলব্ধ) |
| Forward | উপলব্ধ নয় (কোনো API নেই) — নিচে দেখুন |

### Pro mode (ঐচ্ছিক, ADB / ব্যক্তিগত ডিভাইস) — `INJECT_EVENTS`
- `adb shell pm grant com.kickkey android.permission.INJECT_EVENTS`
- সক্রিয় করে প্রকৃত **hover** (`HOVER_MOVE` — লিংক হাইলাইট, টুলটিপ), **হুইল স্ক্রল** (`ACTION_SCROLL`) এবং **Forward** (`KEYCODE_FORWARD`)।
- ⚠️ **Android 12+ `injectInputEvent` ব্লক করে যেসব অ্যাপ API 31+ টার্গেট করে** (অনুমতি থাকলেও SecurityException)। বাস্তবে এই পথটি **Android ≤ 11**-এ adb গ্র্যান্টে, বা root করা ডিভাইসে কাজ করে। Play Store-এ কখনো নয়।

---

## 11. ক্লিক হ্যান্ডলিং

- **লেফট ক্লিক** (`L` বাটন বা ট্যাপ-টু-ক্লিক): `tapAt(cursorX, cursorY)` — cursor-এর নিচের অ্যাপে ইনজেক্টেড প্রকৃত ট্যাপ। Play Store-এর প্রতিটি মাউস/টাচপ্যাড অ্যাপ এভাবেই কাজ করে।
- **রাইট ক্লিক** (`R` বাটন): cursor-এ লং-প্রেস স্ট্রোক। Android-এ নেটিভ রাইট-ক্লিক নেই; লং-প্রেসই স্বীকৃত সমতুল্য (লঞ্চার, ব্রাউজার, টেক্সট সিলেকশনে কনটেক্সট মেনু খোলে)। সময়সীমা কনফিগারযোগ্য।
- **ডাবল ক্লিক** (ঐচ্ছিক): দুটি দ্রুত ট্যাপ (কিছু অ্যাপে শব্দ-নির্বাচনের জন্য টগলযোগ্য)।
- **ক্লিক বনাম প্যানেল ওভারল্যাপ**: ফ্লোটিং প্যানেলের নিজের আয়তনে কখনো ক্লিক ডিসপ্যাচ হবে না; Kotlin প্যানেল উইন্ডোর rect ডিসপ্যাচ টার্গেট থেকে বাদ দেয় (সেখানে ক্লিক মানে প্যানেল লুকানো/উপেক্ষা)।
- সব জেসচার ইনজেকশন সার্ভিসের মূল হ্যান্ডলারে কমপ্লিশন কলব্যাকসহ চলে; দ্রুত পরপর ক্লিক কিউ করা হয় (সর্বোচ্চ ~১০/সেকেন্ড)।

---

## 12. স্ক্রলিং

- **বাটন**: স্ক্রল আপ/ডাউন কেয়ারেট ধরে রাখলে রিপিট হয় (বিদ্যমান ব্যাকস্পেস রিপিটের মতো JS অটো-রিপিট)।
- **স্ক্রল টার্গেট** (অগ্রাধিকার ক্রমে):
  1. ফোকাসড নোড: `AccessibilityNodeInfo.performAction(ACTION_SCROLL_BACKWARD/FORWARD)`।
  2. ফলব্যাক: `dispatchGesture` উল্লম্ব সোয়াইপ (যেমন cursor+200px থেকে cursor−200px, ~300ms) — cursor-এর নিচের অ্যাপ স্ক্রল করে।
  3. Pro mode: মাউস-সদৃশ পিক্সেল-পারফেক্ট স্ক্রলের জন্য `MotionEvent.ACTION_SCROLL` হুইল ইভেন্ট।
- **ড্র্যাগ-টু-স্ক্রল**: L ধরে ড্র্যাগ করলে ক্রমাগত স্ক্রল স্ট্রোক হয় (স্ক্রলবার টানার মতো)।

---

## 13. Back / Forward অ্যাকশন

| | Back | Forward |
|---|---|---|
| a11y পথ | ✅ `performGlobalAction(GLOBAL_ACTION_BACK)` | ❌ কোনো গ্লোবাল অ্যাকশন নেই, a11y-তে কী ইনজেকশন নেই |
| Pro mode (ADB ≤ Android 11) | ✅ (একই) | ✅ `KEYCODE_FORWARD` |
| Forward-এর ফলব্যাক | — | ট্যাপ-ভিত্তিক: ফ্লোটিং প্যানেলে Forward প্রথমে ফোকাসড নোডে `ACTION_SCROLL_FORWARD` চেষ্টা করে, তারপর হালকা "এই Android সংস্করণে সমর্থিত নয়" ইঙ্গিত দিয়ে নো-অপ |

বিদ্যমান শেভরন বাটন থাকবে; নেটিভ ম্যাপিং `ALT+DPAD` (টেক্সট-কেয়ারেট হ্যাক) থেকে উপরের দিকে বদলাবে। নোট: ফিল্ড ফোকাসড থাকলে `ALT+DPAD_LEFT/RIGHT` কেয়ারেট মুভমেন্ট *টেক্সট-নেভিগেশন* মোড হিসেবে ঐচ্ছিক রাখা হয়।

---

## 14. অনুমতি (Permissions)

| অনুমতি | স্তর | কিসের জন্য |
|---|---|---|
| `android.permission.BIND_ACCESSIBILITY_SERVICE` | normal (সার্ভিস অ্যাট্রিবিউট) | a11y সার্ভিস ঘোষণা |
| `SYSTEM_ALERT_WINDOW` | special (রানটাইম) | a11y সক্রিয় না থাকলে ফলব্যাক cursor/প্যানেল ওভারলে |
| `android.permission.VIBRATE` | normal | বিদ্যমান (ইতিমধ্যে ঘোষিত) |
| `android.permission.POST_NOTIFICATIONS` | রানটাইম (API 33+) | ঐচ্ছিক নোটিফিকেশন এন্ট্রি পয়েন্ট |
| `android.permission.INJECT_EVENTS` | signature/privileged | শুধু pro mode; ম্যানিফেস্টে ঘোষিত, ইনস্টলে কখনো গ্র্যান্ট হয় না; `adb pm grant` বা root দিয়ে |
| `android.permission.FOREGROUND_SERVICE*` | — | দরকার নেই (a11y সার্ভিস সিস্টেম-বাউন্ড) |

রানটাইম পারমিশন ফ্লো: a11y সেটিংসে ব্যবহারকারী নিজে চালু করেন (আমরা ডিপ লিংক করি); `SYSTEM_ALERT_WINDOW` বিদ্যমান ওভারলে-সেটিংস ফ্লো দিয়ে; `POST_NOTIFICATIONS` স্ট্যান্ডার্ড রানটাইম রিকোয়েস্ট দিয়ে।

---

## 15. Accessibility সার্ভিস ডিজাইন

`res/xml/accessibility_service_config.xml` (কনফিগ প্লাগইন কপি করবে):

```xml
<accessibility-service
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="true"
    android:accessibilityFlags="flagRequestAccessibilityButton|flagDefault"
    android:settingsActivity="com.kickkey.MainActivity" />
```

ম্যানিফেস্ট এন্ট্রি (নতুন `withAccessibilityService.js` প্লাগইন যোগ করবে, `withImeService.js`-এর আদলে):

```xml
<service
    android:name=".KickKeyAccessibilityService"
    android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
    android:exported="true"
    android:label="@string/a11y_service_name"
    android:process=":ime_process">   <!-- IME + কীবোর্ড হোস্টের মতো একই প্রসেস -->
    <intent-filter>
        <action android:name="android.accessibilityservice.AccessibilityService" />
    </intent-filter>
    <meta-data
        android:name="android.accessibilityservice"
        android:resource="@xml/accessibility_service_config" />
</service>
```

ডিজাইন নিয়ম:
- **কোনো ডেটা সংগ্রহ নেই।** সার্ভিস শুধু *স্পষ্ট ব্যবহারকারী অ্যাকশনে* (টাচপ্যাডের বাটন ট্যাপ) সাড়া দিয়ে সংশ্লিষ্ট জেসচার করে। কিছু লগ, ট্রান্সমিট বা সংরক্ষণ করে না।
- `onAccessibilityButtonClicked()` → ফ্লোটিং প্যানেল খোলে; `onServiceConnected()` → সিংগলটন প্রকাশ + JS-কে জানায় (`onAccessibilityStateChanged`)।
- `onAccessibilityEvent` ন্যূনতম রাখুন (শুধু `scrollNode`-এর ফোকাস ট্র্যাকিংয়ের জন্য প্রয়োজনীয়) — ব্যাটারি/পারফ খরচ কমাতে।
- সার্ভিস মাঝপথে নিষ্ক্রিয় হলে সব টাচপ্যাড ফিচার মসৃণভাবে বর্তমান টেক্সট-ফিল্ড আচরণে নেমে আসবে + Settings-এ নেওয়ার ব্যানার দেখাবে।

---

## 16. স্টেট ম্যানেজমেন্ট

- **নেটিভ (একমাত্র সোর্স অফ ট্রুথ):** `cursorX/cursorY`, প্যানেল দৃশ্যমানতা, টাচপ্যাড মোড, pro-mode প্রাপ্যতা — সার্ভিস/মডিউল সিংগলটনের সরল ফিল্ড (কোনো IPC নেই)।
- **JS (বিদ্যমান zustand/হুক):** `toggleMode` ইতিমধ্যে `useKeyboardState`-এ আছে; যোগ হবে `isAccessibilityEnabled`, `touchpadMode` (স্ট্রিপ বনাম ফুল), `tapToClick`, `proMode` — বিদ্যমান `savePreferences` পদ্ধতিতে সংরক্ষিত।
- **Cursor surface** কোনো স্টেট ধরে না — এটি স্থির তীর রেন্ডার করে; নেটিভ অবস্থানের মালিক।
- **ইভেন্ট:** `onAccessibilityStateChanged`, `onProModeChanged` Kotlin থেকে ধাক্কা দেওয়া হয়; টাচপ্যাড surface তা পড়ে ব্যানার/বাটন আপডেট করে।

---

## 17. পারফরম্যান্স বিবেচনা

- **Pointer মুভ:** JS-এ প্রতি ফ্রেমে এক `pointerMove` (`Touchpad.tsx`-এ `requestAnimationFrame` গেট); নেটিভ শুধু `LayoutParams.x/y` + `updateViewLayout` আপডেট করে (কোনো বিটম্যাপ পুনর্নির্মাণ, কোনো রি-রেন্ডার নেই)। লক্ষ্য: 60Hz, <1ms নেটিভ খরচ।
- **Cursor surface:** স্থির কন্টেন্ট, মুভে রি-রেন্ডার নেই — cursor রুটের JS বান্ডেল ক্ষুদ্র; ইতিমধ্যে লোড হওয়া কীবোর্ড Hermes বান্ডেল ভাগ করে।
- **জেসচার কিউ:** ক্লিক/সোয়াইপ ছোট কিউ দিয়ে সিরিয়ালাইজড, প্রতি-জেসচার কমপ্লিশন কলব্যাক; রিপিট-স্ক্রল থ্রটলড (~১৫০ms ব্যবধান)।
- **মেমরি:** a11y সার্ভিস `:ime_process`-এ থাকায় প্রসেসটি চালু হতে পারে এমনকি ব্যবহারকারী কীবোর্ড না খুললেও। ReactHost প্রি-ওয়ার্ম এমনভাবে গেট করুন যেন 911KB বান্ডেল + Hermes রানটাইম প্রসেস শুরুতে অলসভাবে নয়, প্রথম surface তৈরির সময় লোড হয় (`KickKeyApplication.onCreate`-এ ছোট পরিবর্তন)।
- **ওয়াচডগ পুনঃব্যবহার:** বিদ্যমান IME স্টার্টআপ ওয়াচডগ / মাউন্ট-পাম্প মেশিনারি নতুন ওভারলে ও cursor surface-এ অপরিবর্তিত প্রযোজ্য (একই ব্ল্যাক-স্ক্রিন ফেইলর শ্রেণি)।

---

## 18. নিরাপত্তা ও গোপনীয়তা

- Accessibility হলো Android-এর সবচেয়ে সংবেদনশীল অনুমতি। আমরা এটি **শুধু** ব্যবহারকারী-ট্রিগারড জেসচারে ব্যবহার করি; কোনো স্ক্রিন-কন্টেন্ট স্ক্র্যাপিং, কী-লগিং বা ক্রেডেনশিয়াল অ্যাক্সেস নেই।
- সার্ভিসের `accessibilityEventTypes` উইন্ডো-স্টেট/কন্টেন্ট-চেঞ্জে সীমিত (শুধু ফোকাসড-নোড স্ক্রলের জন্য); টাচ-এক্সপ্লোরেশন, ফিল্টার-কী-ইভেন্ট বা ন্যূনতমের বেশি `canRead*` চাওয়া হবে না।
- ওভারলে কখনো অন্য অ্যাপের ইনপুট আটকায় না (cursor-এ `FLAG_NOT_TOUCHABLE`; প্যানেল শুধু নিজের surface-ই ইন্টারসেপ্ট করে)।
- সার্ভিস থেকে কোনো নেটওয়ার্ক অ্যাক্সেস নেই; সব লজিক লোকাল। প্রাইভেসি পলিসি (`privacy-policy.md`) এ accessibility সার্ভিস ও টাচপ্যাড নিয়ে একটি অংশ যোগ করতে হবে।
- অন-ডিভাইস ডিসক্লোজার: প্রথম লঞ্চে ডায়ালগ — a11y সার্ভিস কী করে ও কেন, তারপর Settings-এ ডিপ লিংক।

---

## 19. Android কম্প্যাটিবিলিটি

| Android | API | অবস্থা |
|---|---|---|
| 7.0 | 24 | `dispatchGesture` উপলব্ধ (RN 0.86-এর ন্যূনতম সমর্থিত)। `TYPE_ACCESSIBILITY_OVERLAY` ঠিক আছে (22+)। |
| 8–11 | 26–30 | ✅ সম্পূর্ণ a11y পথ + ADB pro mode (`INJECT_EVENTS` adb গ্র্যান্টে কাজ করে)। |
| 12 | 31 | ⚠️ targetSdk 31+ হলে `injectInputEvent` ব্লকড → pro mode মৃত; a11y পথ অপ্রভাবিত। |
| 13 | 33 | "Restricted settings": সাইডলোডেড ইনস্টলে a11y চালু করতে অতিরিক্ত ধাপ (অ্যাপে নথিভুক্ত)। `POST_NOTIFICATIONS` রানটাইম। |
| 14+ | 34–36 | এই ডিজাইনে কোনো ব্লকিং পরিবর্তন নেই; Play ঘোষণা + `isAccessibilityTool` বাধ্যতামূলক। |
| OEM | — | Samsung-এর "Assistant menu" সরাসরি মেনু এন্ট্রির অতিরিক্ত সুযোগ দিতে পারে; বোনাস হিসেবে ধরুন, নির্ভরতা নয়। |

পরীক্ষার ম্যাট্রিক্স: ন্যূনতম Android 10, 12, 13, 14; জেসচার-নেভ বনাম 3-বাটন নেভ; একটি স্টক লঞ্চার ও একটি OEM (Samsung/Xiaomi) ডিভাইস।

---

## 20. Expo / কাস্টম ডেভেলপমেন্ট বিল্ড প্রয়োজনীয়তা

- **Expo Go এ চলবে না** (IME-এর ক্ষেত্রে ইতিমধ্যে সত্য) — আজকের মতোই **কাস্টম ডেভেলপমেন্ট বিল্ড / prebuild** প্রয়োজন।
- **কনফিগ প্লাগইন** (নতুন `plugins/withAccessibilityService.js`), `withImeService.js` প্যাটার্ন অনুসরণ করে:
  - নতুন Kotlin ফাইল → `android/app/src/main/java/com/kickkey/`-এ কপি;
  - `accessibility_service_config.xml` → `res/xml/`-এ কপি;
  - ম্যানিফেস্টে `<service>` ব্লক + `POST_NOTIFICATIONS` অনুমতি যোগ;
  - `android:isAccessibilityTool` সেট (সিদ্ধান্ত §২৩)।
- **বান্ডেল বিল্ড:** `scripts/build-keyboard-bundle.js` ইতিমধ্যে `keyboard.index.js` থেকে `keyboard.bundle` তৈরি করে; `KickKeyPointer` নিবন্ধন একই বান্ডেলে দ্বিতীয় রুট যোগ করে — বিল্ড-স্ক্রিপ্ট পরিবর্তনের দরকার নেই।
- নতুন npm ডিপেন্ডেন্সি লাগবে না (`react-native-svg` ইতিমধ্যে আছে)। ট্যাপ-টু-ক্লিক ইত্যাদি সব ইন-ট্রি।

---

## 21. পরীক্ষা কৌশল

1. **ম্যানুয়াল ডিভাইস টেস্ট স্ক্রিপ্ট** (মূল): সার্ভিস চালু → a11y বাটন/শর্টকাট বরাদ্দ → ফোকাসড ফিল্ড ছাড়া ফ্লোটিং প্যানেল খোলা → অন্য অ্যাপে cursor পুরো স্ক্রিনে ঘোরে → লঞ্চার/ব্রাউজার/সেটিংসে L/R ক্লিক কাজ করে → স্ক্রল আপ/ডাউন লিস্ট স্ক্রল করে → Back নেভিগেট করে → প্যানেল বন্ধ হলে অ্যাপ মারা যায় না।
2. **IME টাচপ্যাড রিগ্রেশন:** বিদ্যমান টগল ফ্লো; ফিল্ড ফোকাসড থাকলে DPAD কেয়ারেট মোড কাজ করে; pointer এখন পুরো স্ক্রিনে দেখা যায়।
3. **এজ কেস:** স্ক্রিন রোটেশন, ফোল্ডেবল/মাল্টি-উইন্ডো, জেসচার-নেভ বনাম 3-বাটন, ইমার্সিভ অ্যাপ (ভিডিও), ব্যাংকিং অ্যাপ (ইনজেক্টেড টাচ উপেক্ষা করতে পারে — প্রত্যাশিত, নথিভুক্ত), সার্ভিস কিল/রিস্টার্ট, Android 13 restricted settings ফ্লো।
4. **ইউনিট (Robolectric):** জেসচার-ডেসক্রিপশন বিল্ডার, ক্ল্যাম্পিং গণিত, রিপিট-থ্রটলিং, pro-mode পারমিশন চেক।
5. **ইনস্ট্রুমেন্টেশন (ঐচ্ছিক):** ইমুলেটরে `dispatchGesture` কলব্যাক যাচাই করার টেস্ট-অনলি a11y সার্ভিস।
6. **পারফ চেক:** 60Hz pointer মুভে কোনো ড্রপড ফ্রেম নেই (`systrace` / React DevTools দিয়ে প্রোফাইল)।

---

## 22. বিল্ড ও ডেপ্লয়মেন্ট

আজকের পাইপলাইনই অপরিবর্তিত থাকবে:
1. `node scripts/build-keyboard-bundle.js` (keyboard.bundle-এ এবার কীবোর্ড + pointer + ওভারলে রুট)।
2. `npx expo prebuild --platform android` (`withImeService` + নতুন `withAccessibilityService` চালায়)।
3. ডেভের জন্য `npx expo run:android`; রিলিজের জন্য `eas build -p android` (বিদ্যমান `eas.json`)।
4. ব্যক্তিগত ডিভাইসে pro mode: APK ইনস্টল, তারপর `adb shell pm grant com.kickkey android.permission.INJECT_EVENTS`।
5. ভার্সন বাম্প + বিদ্যমান ডক্সে (`todo.md`, ফেজ ডক) চেঞ্জলগ।

---

## 23. Google Play Store বিবেচনা

- **Accessibility ঘোষণা:** API 31+ টার্গেট করা যেকোনো অ্যাপে `AccessibilityService` থাকলে **Play Console-এর "Accessibility Service" ডিক্লারেশন** সম্পূর্ণ করতে হবে এবং সার্ভিসে `android:isAccessibilityTool` সেট করতে হবে।
  - সুপারিশ: `isAccessibilityTool="true"` সেট করুন এবং টাচপ্যাডকে **সহায়ক ইনপুট এইড** হিসেবে বর্ণনা করুন (মোটর-প্রতিবন্ধী ব্যবহারকারী যারা সরাসরি টাচ করতে পারেন না) — ভার্চুয়াল মাউস/টাচপ্যাডের জন্য এটি সৎ ফ্রেমিং।
  - Play Console ঘোষণায় মূল কার্যকারিতা বলতে হবে এবং ডেটা অপব্যবহার নেই নিশ্চিত করতে হবে। ইন-অ্যাপ কারণ ডায়ালগ (§১৮) ঘোষণার সাথে সামঞ্জস্যপূর্ণ রাখুন।
- **ওভারলে অনুমতি:** বৈধ ফ্লোটিং-UI উদ্দেশ্যে `SYSTEM_ALERT_WINDOW` গ্রহণযোগ্য (ওভারলে অ্যাপের মূল অংশ হলে ও ডিসক্লোজড হলে Play অনুমতি দেয়); আমাদের প্রাথমিক পথে (a11y ওভারলে) এটির দরকারই নেই।
- **ঝুঁকি:** রিভিউয়াররা "জেসচার ইনজেকশন" অ্যাপ নিবিড়ভাবে দেখতে পারেন। প্রশমন: কোনো ডেটা সংগ্রহ নেই, ন্যূনতম ইভেন্ট টাইপ, স্পষ্ট ব্যবহারকারী-দৃশ্যমান উদ্দেশ্য, সিস্টেম সুরক্ষা বাইপাস নেই, বিদ্যমান কীবোর্ড/IME ডেটা-হ্যান্ডলিং প্রয়োজনীয়তা মেনে চলা।
- Pro mode (`INJECT_EVENTS`) Play-তে **অদৃশ্য** থাকতে হবে: অনুমতি ঘোষিত কিন্তু স্টোর কখনো গ্র্যান্ট করে না; ফিচারটি কেবল তখনই সক্রিয় হয় যখন অনুমতি সত্যিই থাকে (root/adb ইনস্টল)।

---

## 24. সম্ভাব্য সীমাবদ্ধতা ও ঝুঁকি

| # | সীমাবদ্ধতা / ঝুঁকি | প্রশমন |
|---|---|---|
| 1 | পাবলিক API দিয়ে প্রকৃত hover (লিংক হাইলাইট) নেই | নথিভুক্ত; cursor + ট্যাপ-ডিসপ্যাচই Play-স্ট্যান্ডার্ড আচরণ; pro mode-এ Android ≤ 11-এ hover |
| 2 | a11y দিয়ে Forward কী নেই | Pro mode; স্ক্রল-ফরোয়ার্ড ফলব্যাক; সৎ UI ইঙ্গিত |
| 3 | a11y দিয়ে মাউস-হুইল ইভেন্ট নেই | সোয়াইপ-ভিত্তিক স্ক্রল; pro-mode হুইল |
| 4 | প্যানেল লক্ষ্য ঢাকলে ক্লিক প্যানেলে পড়ে | প্যানেল ড্র্যাগযোগ্য/বন্ধযোগ্য; টাচপ্যাড মোডে IME স্ট্রিপে সঙ্কুচিত; প্যানেল rect-এ ক্লিক উপেক্ষা |
| 5 | নন-ডিফল্ট প্রসেসে a11y সার্ভিস (OEM এজ) | ডিভাইস টেস্টিং; ফলব্যাক আর্কিটেকচার (মূল প্রসেস + AIDL) নথিভুক্ত ও প্রস্তুত |
| 6 | সাইডলোডে Android 13 restricted settings ঘর্ষণ | অ্যাপে নির্দেশনা + ডিপ লিংক |
| 7 | accessibility ঘোষণায় Play রিভিউ ঝুঁকি | সৎ `isAccessibilityTool`, কোনো ডেটা সংগ্রহ নেই, কারণ ডায়ালগ |
| 8 | ব্যাংকিং/সিকিউর অ্যাপ ইনজেক্টেড টাচ প্রত্যাখ্যান করতে পারে | প্রত্যাশিত; নথিভুক্ত আচরণ, বাগ নয় |
| 9 | মেমরি: a11y সার্ভিসে প্রসেস চালু কিন্তু কীবোর্ড নয় | কীবোর্ড হোস্টের অলস প্রি-ওয়ার্ম (§১৭) |
| 10 | IME ফোকাসড থাকলে `dispatchGesture` IME উইন্ডোতে যায় | স্ট্রিপ মোড + প্যানেল পুনঃস্থাপন (§৫) |

---

## 25. প্রস্তাবিত ফোল্ডার স্ট্রাকচার

```
react-native-kickKey-deepseek/
├─ native-files/
│  ├─ java/com/kickkey/
│  │  ├─ KickKeyAccessibilityService.kt        NEW
│  │  ├─ TouchpadGestureController.kt          NEW (জেসচার বিল্ডার + কিউ)
│  │  ├─ PointerOverlay.kt                     NEW (cursor উইন্ডো ম্যানেজমেন্ট)
│  │  ├─ FloatingPanelController.kt            NEW (প্যানেল উইন্ডো + surface)
│  │  ├─ ProModeInjector.kt                    NEW (INJECT_EVENTS র‍্যাপার)
│  │  └─ KickKeyModule.kt / KickKeyInputMethodService.kt   (পরিবর্তিত)
│  └─ res/xml/
│     ├─ method.xml                            (বিদ্যমান)
│     └─ accessibility_service_config.xml      NEW
├─ plugins/
│  ├─ withImeService.js                        (বিদ্যমান)
│  └─ withAccessibilityService.js              NEW
├─ keyboard.index.js                           (KickKeyPointer + ওভারলে প্রপস নিবন্ধন)
├─ src/keyboard/
│  ├─ pointer/PointerRoot.tsx                  NEW (RN cursor তীর)
│  ├─ overlay/FloatingPanel.tsx                NEW (ড্র্যাগযোগ্য প্যানেল র‍্যাপার)
│  ├─ qykey/Touchpad.tsx                       (পরিবর্তিত: ক্রমাগত ডেল্টা)
│  ├─ qykey/QykeyKeyboard.tsx                  (ছোট: টাচপ্যাড স্ট্রিপ ইঙ্গিত)
│  └─ hooks/useKeyboardState.ts                (পরিবর্তিত)
├─ app/(tabs)/settings.tsx                     (a11y চালু + pro mode রো)
└─ modules/kickkey-module/index.ts             (টাইপড র‍্যাপার)
```

---

## 26. উন্নয়ন মাইলফলক

| মাইলফলক | পরিধি | প্রস্থানের মানদণ্ড |
|---|---|---|
| **M1 — A11y সার্ভিস + প্যানেল** | সার্ভিস, কনফিগ XML, প্লাগইন, ফোকাসড ফিল্ড ছাড়াই a11y বাটন/শর্টকাট থেকে ফ্লোটিং প্যানেল | প্যানেল খোলে/বন্ধ হয়; ভেতরে স্লাইডার কাজ করে; ইনপুট ফিল্ড লাগে না |
| **M2 — RN cursor + মুভমেন্ট** | `KickKeyPointer` surface, ওভারলে উইন্ডো, প্রতি-ফ্রেম `pointerMove`, ফুল-স্ক্রিন ক্ল্যাম্পিং; ImageView বিটম্যাপ সরানো | Cursor RN-এ রেন্ডার হয়, 60Hz-এ পুরো স্ক্রিনে ঘোরে |
| **M3 — ক্রস-অ্যাপ ইনপুট** | `tapAt`/`longPressAt`/সোয়াইপ/`GLOBAL_ACTION_BACK`, স্ক্রল ফলব্যাক, IME স্ট্রিপ মোড, বাটন ওয়্যারিং | L/R/স্ক্রল/ব্যাক প্রকৃত অ্যাপে কাজ করে (লঞ্চার, ব্রাউজার, সেটিংস) |
| **M4 — Pro mode + সেটিংস** | `INJECT_EVENTS` র‍্যাপার (hover/হুইল/Forward), সেটিংস UI, পারমিশন ফ্লো, নোটিফিকেশন | Android ≤ 11 ডিভাইসে pro mode; অন্যত্র মসৃণ ফলব্যাক |
| **M5 — হার্ডনিং** | নতুন surface-এর ওয়াচডগ, অলস প্রি-ওয়ার্ম, Play ঘোষণা, প্রাইভেসি-পলিসি অংশ, EN/BN ডক্স, ডিভাইস ম্যাট্রিক্স টেস্টিং | রিলিজ ক্যান্ডিডেট §২১ ম্যাট্রিক্স পাস করে |

**মোট আনুমানিক প্রচেষ্টা:** M1–M3 মূল কাজ (প্রায় ৬০%); M4 সংযোজন; M5 কমপ্লায়েন্স + পলিশ।

---

## 27. বাস্তবায়নের আগে প্রয়োজনীয় সিদ্ধান্ত

1. **প্রসেস অবস্থান** — অনুমোদিত সুপারিশ: `:ime_process`-এর ভেতরে a11y সার্ভিস (কোনো IPC নেই)। ফলব্যাক (মূল প্রসেস + AIDL) শুধু ডিভাইস টেস্ট ব্যর্থ হলে। *(ডিফল্ট: সুপারিশকৃত পথে এগোন।)*
2. **`isAccessibilityTool`** — `true` সেট করুন এবং Play ঘোষণায় টাচপ্যাডকে সহায়ক ইনপুট এইড হিসেবে ফ্রেম করুন। *(ডিফল্ট: true।)*
3. **ট্যাপ-টু-ক্লিক** — অপ্ট-ইন সেটিং হিসেবে রাখবেন? *(ডিফল্ট: চালু, টগলযোগ্য।)*
4. **রাইট-ক্লিক সিমুলেশন** — লং-প্রেস (~600ms)। গ্রহণযোগ্য কি, নাকি বিকল্প (টাচপ্যাডে দুই-আঙুল ট্যাপ)? *(ডিফল্ট: লং-প্রেস + ঐচ্ছিক দুই-আঙুল।)*
5. **IME স্ট্রিপ মোড** — IME কীবোর্ডের টাচপ্যাড ট্যাব সক্রিয় থাকলে কীবোর্ড পাতলা স্ট্রিপে সঙ্কুচিত হবে। গ্রহণযোগ্য কি? *(ডিফল্ট: হ্যাঁ।)*

> **অবস্থা: অনুমোদনের অপেক্ষায়।** কোনো কোড পরিবর্তন হয়নি (ওয়ার্কিং ট্রি পরিষ্কার)। অনুমোদন পেলে M1 দিয়ে বাস্তবায়ন শুরু হবে।
