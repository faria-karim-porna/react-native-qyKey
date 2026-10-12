# KickKey — ফেজ ১ বাস্তবায়ন গাইড
## ভিত্তি (সপ্তাহ ১–২)

> **লক্ষ্য:** একটি React Native কম্পোনেন্ট Android IME সিস্টেমের ভেতরে ভিজ্যুয়ালি কীবোর্ড হিসেবে রেন্ডার হবে।
> **এখনো কোনো কী লজিক নেই** — টাইপিং, ব্যাকস্পেস, সাজেশন ফেজ ২-এ আসবে। ফেজ ১ সম্পূর্ণরূপে পাইপলাইন নিয়ে: প্রজেক্ট সেটআপ, নেটিভ ওয়্যারিং, এবং আর্কিটেকচার কাজ করছে কিনা শেষ-থেকে-শেষ প্রমাণ করা।

---

## বিষয়সূচি

1. [পূর্বশর্ত](#1-পূর্বশর্ত)
2. [প্রজেক্ট ইনিশিয়ালাইজেশন](#2-প্রজেক্ট-ইনিশিয়ালাইজেশন)
3. [ফেজ ১-এর জন্য ফোল্ডার স্ট্রাকচার](#3-ফেজ-১-এর-জন্য-ফোল্ডার-স্ট্রাকচার)
4. [Gradle ও বিল্ড কনফিগারেশন](#4-gradle-ও-বিল্ড-কনফিগারেশন)
5. [নেটিভ Kotlin ফাইল](#5-নেটিভ-kotlin-ফাইল)
6. [Android Manifest ও XML রিসোর্স](#6-android-manifest-ও-xml-রিসোর্স)
7. [Expo Native Module (KickKeyModule)](#7-expo-native-module-kickkeymodule)
8. [Expo Config Plugin](#8-expo-config-plugin)
9. [React Native এন্ট্রি পয়েন্ট](#9-react-native-এন্ট্রি-পয়েন্ট)
10. [কীবোর্ড স্ক্রিন (React Native)](#10-কীবোর্ড-স্ক্রিন-react-native)
11. [app.json কনফিগারেশন](#11-appjson-কনফিগারেশন)
12. [eas.json কনফিগারেশন](#12-easjson-কনফিগারেশন)
13. [EAS ডেভেলপমেন্ট বিল্ড](#13-eas-ডেভেলপমেন্ট-বিল্ড)
14. [ডিভাইসে দুই-ধাপ সক্রিয়করণ](#14-ডিভাইসে-দুই-ধাপ-সক্রিয়করণ)
15. [যাচাই চেকলিস্ট](#15-যাচাই-চেকলিস্ট)
16. [সমস্যা সমাধান](#16-সমস্যা-সমাধান)

---

## 1. পূর্বশর্ত

কোড লেখার আগে প্রতিটি টুল ইনস্টল ও যাচাই করুন। একটি ভুল ভার্সন হার্ড-টু-ডিবাগ বিল্ড ব্যর্থতা ঘটায়।

### ১.১ প্রয়োজনীয় টুলস

```bash
# Node.js — অবশ্যই v18 বা তার বেশি
node --version        # প্রত্যাশিত: v18.x.x বা v20.x.x

# npm
npm --version         # প্রত্যাশিত: 9.x বা তার বেশি

# Java Development Kit — অবশ্যই JDK 17 হতে হবে
java -version         # প্রত্যাশিত: openjdk 17.x.x
javac -version        # প্রত্যাশিত: javac 17.x.x

# Android SDK — ANDROID_HOME সেট করুন
echo $ANDROID_HOME    # প্রত্যাশিত: /Users/you/Library/Android/sdk (macOS)
                      #             C:\Users\you\AppData\Local\Android\Sdk (Windows)
                      #             /home/you/Android/Sdk (Linux)

# Expo CLI
npx expo --version    # প্রত্যাশিত: 6.x.x বা তার বেশি

# EAS CLI
eas --version         # প্রত্যাশিত: 5.x.x বা তার বেশি
```

### ১.২ নিখোঁজ টুলস ইনস্টল করুন

```bash
# EAS CLI গ্লোবালি ইনস্টল করুন
npm install -g eas-cli

# Expo CLI গ্লোবালি ইনস্টল করুন (ঐচ্ছিক, npx কাজ করে)
npm install -g expo-cli

# Android SDK প্ল্যাটফর্ম টুলস যাচাই করুন
adb --version         # PATH থেকে অ্যাক্সেসযোগ্য হতে হবে
```

### ১.৩ Android SDK প্রয়োজনীয়তা

Android Studio → SDK Manager খুলুন এবং নিশ্চিত করুন এগুলো ইনস্টল আছে:

- **Android SDK Platform 34** (Android 14) — কম্পাইল টার্গেট
- **Android SDK Platform 26** (Android 8.0) — ন্যূনতম সাপোর্টেড
- **Android SDK Build-Tools 34.0.0**
- **Android Emulator** (ঐচ্ছিক, কীবোর্ড পরীক্ষার জন্য ফিজিক্যাল ডিভাইস পছন্দের)

### ১.৪ EAS অ্যাকাউন্ট

```bash
# আপনার Expo / EAS অ্যাকাউন্টে লগ ইন করুন
eas login

# লগইন যাচাই করুন
eas whoami
```

---

## 2. প্রজেক্ট ইনিশিয়ালাইজেশন

### ২.১ Expo প্রজেক্ট তৈরি করুন

```bash
# TypeScript টেমপ্লেট দিয়ে নতুন Expo প্রজেক্ট তৈরি করুন
npx create-expo-app KickKey --template blank-typescript

cd KickKey

# স্ট্রাকচার যাচাই করুন
ls
# প্রত্যাশিত: app.json  App.tsx  assets/  node_modules/  package.json  tsconfig.json
```

### ২.২ মূল ডিপেন্ডেন্সি ইনস্টল করুন

```bash
# Expo Modules — নেটিভ Kotlin মডিউল লেখার জন্য প্রয়োজনীয়
npx expo install expo-modules-core

# Expo Router — কম্প্যানিয়ন অ্যাপ নেভিগেশনের জন্য (পরবর্তী ফেজে)
npx expo install expo-router

# React Native async storage (কম্প্যানিয়ন অ্যাপ, ফেজ ৫)
npx expo install @react-native-async-storage/async-storage

# Zustand — স্টেট ম্যানেজমেন্ট (কম্প্যানিয়ন অ্যাপ, ফেজ ৫)
npm install zustand
```

### ২.৩ EAS ইনিশিয়ালাইজ করুন

```bash
# প্রজেক্টে EAS ইনিশিয়ালাইজ করুন — eas.json তৈরি করে
eas init

# প্রম্পটে:
# "Would you like to create a project?" → Yes
# "Project name" → KickKey
```

### ২.৪ Android নেটিভ প্রজেক্ট Prebuild করুন

Expo Prebuild `android/` ফোল্ডার নেটিভ Android কোড সহ জেনারেট করে। কোনো Kotlin ফাইল যোগ করার আগে এটি চালাতে হবে।

```bash
npx expo prebuild --platform android

# এটি তৈরি করে:
# android/
# ├── app/
# │   ├── src/main/
# │   │   ├── java/com/kickkey/
# │   │   │   └── MainActivity.kt
# │   │   ├── res/
# │   │   └── AndroidManifest.xml
# │   └── build.gradle
# ├── build.gradle
# └── settings.gradle
```

> ⚠️ যখনই আপনি `app.json` প্লাগইন পরিবর্তন করবেন, `npx expo prebuild --platform android --clean` চালান পুনরায় জেনারেট করতে। **Prebuild জেনারেট করা ফাইলগুলো ম্যানুয়ালি সম্পাদনা করবেন না**, শুধুমাত্র এই গাইডে তালিকাভুক্তগুলো ছাড়া।

### ২.৫ Gradle প্রপার্টি সেট করুন

```bash
# android/gradle.properties খুলুন এবং এই মানগুলো সেট করুন:
```

```properties
# android/gradle.properties

# পুরানো আর্কিটেকচার ব্যবহার করুন — Activity ছাড়া ReactHost-এর জন্য প্রয়োজনীয়
newArchEnabled=false

# Hermes JS ইঞ্জিন ব্যবহার করুন — কম মেমরি ফুটপ্রিন্টের জন্য অপরিহার্য
hermesEnabled=true

# স্ট্যান্ডার্ড সেটিংস
android.useAndroidX=true
android.enableJetifier=true
```

---

## 3. ফেজ ১-এর জন্য ফোল্ডার স্ট্রাকচার

এই স্ট্রাকচার তৈরি করুন। `← এখনই তৈরি করুন` চিহ্নিত ফাইলগুলো এই ফেজে তৈরি করতে হবে।

```
KickKey/
│
├── index.js                                    ← এখনই তৈরি করুন (কম্প্যানিয়ন এন্ট্রি)
├── keyboard.index.js                           ← এখনই তৈরি করুন (কীবোর্ড বান্ডেল এন্ট্রি)
├── app.json                                    ← এখনই পরিবর্তন করুন
├── eas.json                                    ← এখনই পরিবর্তন করুন
├── tsconfig.json                               (বিদ্যমান, পরিবর্তন নেই)
├── package.json                                (বিদ্যমান, পরিবর্তন নেই)
│
├── src/
│   └── keyboard/                               ← এখনই ফোল্ডার তৈরি করুন
│       ├── KeyboardScreen.tsx                  ← এখনই তৈরি করুন
│       └── PlaceholderKey.tsx                  ← এখনই তৈরি করুন
│
├── plugins/
│   ├── withImeService.js                       ← এখনই তৈরি করুন
│   └── withKeyboardBundle.js                   ← এখনই তৈরি করুন
│
├── modules/
│   └── kickkey-module/                         ← এখনই ফোল্ডার তৈরি করুন
│       ├── index.ts                            ← এখনই তৈরি করুন
│       └── android/
│           └── src/main/java/com/kickkey/
│               ├── KickKeyModule.kt            ← এখনই তৈরি করুন
│               └── KickKeyPackage.kt           ← এখনই তৈরি করুন
│
└── android/                                    (prebuild দ্বারা জেনারেটেড)
    └── app/src/main/
        ├── java/com/kickkey/
        │   ├── MainActivity.kt                 (বিদ্যমান)
        │   ├── MainApplication.kt              (বিদ্যমান — সরাসরি সম্পাদনা করবেন না)
        │   ├── KickKeyApplication.kt           ← এখনই তৈরি করুন
        │   └── KickKeyInputMethodService.kt    ← এখনই তৈরি করুন
        ├── res/
        │   ├── values/
        │   │   └── strings.xml                 ← এখনই পরিবর্তন করুন (ime_name যোগ করুন)
        │   └── xml/
        │       └── method.xml                  ← এখনই তৈরি করুন
        └── AndroidManifest.xml                 (config plugin দ্বারা পরিচালিত)
```

---

## 4. Gradle ও বিল্ড কনফিগারেশন

### ৪.১ অ্যাপ-লেভেল `build.gradle`

`android/app/build.gradle` খুলুন এবং এগুলো যাচাই / সেট করুন:

```groovy
// android/app/build.gradle

android {
    compileSdkVersion 34
    buildToolsVersion "34.0.0"

    defaultConfig {
        applicationId "com.kickkey"
        minSdkVersion 26           // Android 8.0 ন্যূনতম
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }

    buildTypes {
        debug {
            debuggable true
        }
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}

dependencies {
    // React Native — Expo prebuild দ্বারা ইতিমধ্যে যোগ করা হয়েছে
    implementation("com.facebook.react:react-android")
    implementation("com.facebook.react:hermes-android")

    // Expo modules — Expo prebuild দ্বারা ইতিমধ্যে যোগ করা হয়েছে
    implementation project(':expo-modules-core')
}
```

### ৪.২ রুট-লেভেল `build.gradle`

```groovy
// android/build.gradle
buildscript {
    ext {
        buildToolsVersion = "34.0.0"
        minSdkVersion = 26
        compileSdkVersion = 34
        targetSdkVersion = 34
        kotlinVersion = "1.9.0"    // ← Kotlin ভার্সন নিশ্চিত করুন
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}")
    }
}
```

---

## 5. নেটিভ Kotlin ফাইল

ফেজ ১-এর জন্য দুটি সবচেয়ে গুরুত্বপূর্ণ Kotlin ফাইল। এগুলো IME সার্ভিস এবং ReactHost প্রি-ওয়ার্মিং প্রতিষ্ঠা করে।

### ৫.১ `KickKeyApplication.kt`

এই ফাইলটি ডিফল্ট Application ক্লাস প্রতিস্থাপন করে। এটি অ্যাপ স্টার্টআপে `keyboard.bundle` দিয়ে Hermes JS রানটাইম প্রি-ওয়ার্ম করে, যাতে ব্যবহারকারী কোনো টেক্সট ফিল্ডে ট্যাপ করার আগেই কীবোর্ড প্রস্তুত থাকে।

```kotlin
// android/app/src/main/java/com/kickkey/KickKeyApplication.kt

package com.kickkey

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.runtime.ReactHostBuilder
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class KickKeyApplication : Application(), ReactApplication {

    companion object {
        private const val TAG = "KickKeyApplication"
    }

    // ── কম্প্যানিয়ন অ্যাপ ReactHost (Expo দ্বারা পরিচালিত, main.bundle ব্যবহার করে) ──
    override val reactNativeHost: ReactNativeHost
        get() = ReactNativeHostWrapper(this, object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // KickKey নেটিভ মডিউল প্যাকেজ যোগ করুন
                    add(KickKeyPackage())
                }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = false   // পুরানো আর্কিটেকচার
            override val isHermesEnabled: Boolean = true
        })

    // ── কীবোর্ড ReactHost (প্রি-ওয়ার্মড, keyboard.bundle ব্যবহার করে) ────────────
    lateinit var keyboardReactHost: ReactHost
        private set

    override fun onCreate() {
        super.onCreate()

        // Expo মডিউল লাইফসাইকেল ইনিশিয়ালাইজ করুন
        ApplicationLifecycleDispatcher.onApplicationCreate(this)

        // ব্যাকগ্রাউন্ড থ্রেডে কীবোর্ড JS রানটাইম প্রি-ওয়ার্ম।
        // এটি অ্যাপ স্টার্টে চলে যাতে ব্যবহারকারী যেকোনো টেক্সট ফিল্ডে
        // ট্যাপ করার সময় Hermes + keyboard.bundle ইতিমধ্যে লোড হয়ে যায়।
        Thread {
            try {
                initKeyboardRuntime()
                Log.i(TAG, "কীবোর্ড ReactHost প্রি-ওয়ার্ম সম্পন্ন")
            } catch (e: Exception) {
                Log.e(TAG, "কীবোর্ড ReactHost প্রি-ওয়ার্ম ব্যর্থ হয়েছে", e)
            }
        }.apply {
            name = "KickKey-PreWarm"
            isDaemon = true
            start()
        }
    }

    private fun initKeyboardRuntime() {
        // keyboard.bundle লোড করে একটি ReactHost তৈরি করুন (পূর্ণ main.bundle নয়)
        // এটি শুধুমাত্র কীবোর্ড UI-এর জন্য স্বতন্ত্র React Native রানটাইম।
        keyboardReactHost = ReactHostBuilder(this)
            .setJSBundleAssetPath("keyboard.bundle")   // ← শুধুমাত্র কীবোর্ড বান্ডেল
            .setJSEngineResolutionAlgorithm(
                com.facebook.react.runtime.JSEngineResolutionAlgorithm.HERMES
            )
            .addReactPackage(KickKeyPackage())          // শুধুমাত্র আমাদের ব্রিজ প্যাকেজ
            .setIsDeveloperSupport(BuildConfig.DEBUG)
            .build()

        // JS লোড করা শুরু করুন — এটি ব্যয়বহুল ধাপ (~২০০–৫০০ms প্রথমবার)
        // এর পরে, কীবোর্ড ~৫০–৮০ms-এ খোলে
        keyboardReactHost.start()
    }

    override fun onTerminate() {
        super.onTerminate()
        ApplicationLifecycleDispatcher.onApplicationTerminate(this)
    }
}
```

### ৫.২ Manifest-এ `KickKeyApplication` নিবন্ধন করুন

> এটি সেকশন ৮-এর config plugin দ্বারা স্বয়ংক্রিয়ভাবে পরিচালিত হয়। যদি `MainApplication.kt` prebuild থেকে বিদ্যমান থাকে, এটি মুছে দিন — `KickKeyApplication.kt` সম্পূর্ণরূপে এর স্থান নেয়।

---

### ৫.৩ `KickKeyInputMethodService.kt`

এটি Android IME সার্ভিস। এটি প্রি-ওয়ার্মড `ReactHost` থেকে `ReactRootView` গ্রহণ করে এবং Android-এ কীবোর্ড ভিউ হিসেবে ফেরত দেয়। ফেজ ১-এ কীবোর্ড একটি প্লেসহোল্ডার UI রেন্ডার করে — শুধু ওয়্যারিং কাজ করছে কিনা প্রমাণ করার জন্য।

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
        Log.i(TAG, "IME সার্ভিস তৈরি হয়েছে")
    }

    /**
     * Android কর্তৃক কল করা হয় যখন একটি টেক্সট ফিল্ড ফোকাস পায় এবং
     * ব্যবহারকারীকে কীবোর্ড দেখতে হয়। সমকালীনভাবে একটি View ফেরত দিতে হবে।
     *
     * KickKeyApplication স্টার্টআপে ReactHost প্রি-ওয়ার্ম করায়,
     * এই কল দ্রুত: ~৫০–৮০ms।
     */
    override fun onCreateInputView(): View {
        Log.i(TAG, "onCreateInputView কল হয়েছে")

        val app = application as? KickKeyApplication
        if (app == null) {
            Log.e(TAG, "KickKeyApplication পাওয়া যায়নি — ফলব্যাক ভিউ ফেরত দেওয়া হচ্ছে")
            return View(this)
        }

        // ReactRootView তৈরি করুন — এটি একটি Android View
        // Android এটিকে কীবোর্ড সারফেস হিসেবে গ্রহণ করবে
        reactRootView = ReactRootView(this)
        reactRootView!!.startReactApplication(
            app.keyboardReactHost,
            "KickKeyKeyboard",   // keyboard.index.js-এ AppRegistry.registerComponent নামের সাথে মেলাতে হবে
            null                 // ফেজ ১-এ কোনো প্রারম্ভিক props নেই
        )

        Log.i(TAG, "ReactRootView তৈরি এবং শুরু হয়েছে")
        return reactRootView!!
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        Log.i(TAG, "ইনপুট শুরু — inputType: ${info.inputType}")
        // ফেজ ২ এটি ব্যবহার করবে ইনপুট টাইপ অনুযায়ী কীবোর্ড মানিয়ে নিতে
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        Log.i(TAG, "ইনপুট শেষ হয়েছে")
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        Log.i(TAG, "কীবোর্ড লুকানো হয়েছে")
        // ফেজ ৬ এখানে ইমোজি/ক্লিপবোর্ড প্যানেল মুক্ত করবে
    }

    override fun onDestroy() {
        // মেমরি লিক এড়াতে ReactRootView পরিষ্কার করুন
        reactRootView?.unmountReactApplication()
        reactRootView = null
        super.onDestroy()
        Log.i(TAG, "IME সার্ভিস ধ্বংস হয়েছে")
    }
}
```

---

## 6. Android Manifest ও XML রিসোর্স

### ৬.১ `res/values/strings.xml`

IME ডিসপ্লে নাম যোগ করুন। Android Settings → Keyboard তালিকায় এটি দেখা যায়।

```xml
<!-- android/app/src/main/res/values/strings.xml -->
<resources>
    <string name="app_name">KickKey</string>
    <string name="ime_name">KickKey Keyboard</string>
</resources>
```

### ৬.২ `res/xml/method.xml`

এই ফাইলটি ঘোষণা করে কীবোর্ড কোন ভাষা সাপোর্ট করে। Android manifest-এর `<meta-data>` ট্যাগ থেকে এটি পড়ে। যদি `xml/` ডিরেক্টরি না থাকে তৈরি করুন।

```xml
<!-- android/app/src/main/res/xml/method.xml -->
<?xml version="1.0" encoding="utf-8"?>
<input-method
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:settingsActivity="com.kickkey.MainActivity"
    android:supportsSwitchingToNextInputMethod="true">

    <!--
        প্রতিটি <subtype> একটি ভাষা বিকল্প।
        Android এগুলো কীবোর্ড ভাষা সুইচারে দেখায়।
        subtypeId অবশ্যই অনন্য পূর্ণসংখ্যা হতে হবে।
    -->
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

### ৬.৩ `AndroidManifest.xml` — config plugin কী যোগ করে

আপনি `AndroidManifest.xml` সরাসরি সম্পাদনা করবেন **না**। সেকশন ৮-এর config plugin এটি পরিচালনা করে। রেফারেন্সের জন্য, plugin `<application>` ট্যাগের ভেতরে যা যোগ করে:

```xml
<!-- plugins/withImeService.js দ্বারা স্বয়ংক্রিয়ভাবে যোগ করা হয় -->

<!-- ১. Application ক্লাস নিবন্ধন -->
<application android:name=".KickKeyApplication" ...>

    <!-- ২. IME সার্ভিস নিবন্ধন -->
    <service
        android:name=".KickKeyInputMethodService"
        android:label="@string/ime_name"
        android:permission="android.permission.BIND_INPUT_METHOD"
        android:exported="true"
        android:process=":ime_process">

        <intent-filter>
            <action android:name="android.view.InputMethod" />
        </intent-filter>

        <meta-data
            android:name="android.view.im"
            android:resource="@xml/method" />
    </service>

</application>

<!-- ৩. Vibration অনুমতি -->
<uses-permission android:name="android.permission.VIBRATE" />
```

---

## 7. Expo Native Module (KickKeyModule)

ফেজ ১-এ নেটিভ মডিউল ন্যূনতম — শুধুমাত্র ব্রিজ কাজ করছে কিনা যাচাই করতে প্রয়োজনীয় মেথডগুলো এক্সপোজ করে।

### ৭.১ মডিউল ডিরেক্টরি তৈরি করুন

```bash
mkdir -p modules/kickkey-module/android/src/main/java/com/kickkey
```

### ৭.২ `KickKeyModule.kt`

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyModule.kt

package com.kickkey

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KickKeyModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("KickKey")

        // ── ফেজ ১: শুধুমাত্র স্ট্যাটাস চেক ──────────────────────────────────────

        /**
         * true ফেরত দেয় যদি KickKey বর্তমানে ডিফল্ট কীবোর্ড হয়।
         * কম্প্যানিয়ন অ্যাপের অনবোর্ডিং স্ক্রিনে সেটআপ প্রগ্রেস দেখাতে ব্যবহৃত।
         */
        Function("isDefaultKeyboard") {
            val context = appContext.reactContext ?: return@Function false
            val currentIme = android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.DEFAULT_INPUT_METHOD
            )
            currentIme?.contains(context.packageName) ?: false
        }

        /**
         * true ফেরত দেয় যদি KickKey সক্রিয় ইনপুট মেথডের তালিকায় থাকে।
         * ব্যবহারকারীকে Android Settings-এ এটি সক্রিয় করতে হবে নির্বাচন করার আগে।
         */
        Function("isKeyboardEnabled") {
            val context = appContext.reactContext ?: return@Function false
            val enabledMethods = android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.ENABLED_INPUT_METHODS
            ) ?: ""
            enabledMethods.contains(context.packageName)
        }

        /**
         * Android-এর কীবোর্ড সেটিংস স্ক্রিন খোলে।
         * অনবোর্ডিং উইজার্ড থেকে সক্রিয়করণের মাধ্যমে ব্যবহারকারীকে গাইড করতে কল করা হয়।
         */
        Function("openKeyboardSettings") {
            val context = appContext.reactContext ?: return@Function
            val intent = android.content.Intent(
                android.provider.Settings.ACTION_INPUT_METHOD_SETTINGS
            ).apply {
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }

        // ── ফেজ ২+ মেথড এখানে যোগ করা হবে: ──────────────────────────────────
        // commitKey, sendBackspace, commitSpace, sendEnter,
        // getPreferences, savePreferences, getClipboardHistory
    }
}
```

### ৭.৩ `KickKeyPackage.kt`

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyPackage.kt

package com.kickkey

import expo.modules.kotlin.Package

class KickKeyPackage : Package {
    override fun createModules() = listOf(KickKeyModule())
}
```

### ৭.৪ `modules/kickkey-module/index.ts`

এটি TypeScript এক্সপোর্ট যা React Native কোড ইম্পোর্ট করে।

```typescript
// modules/kickkey-module/index.ts
import { NativeModules } from 'react-native';

const { KickKey } = NativeModules;

export default {
  /**
   * true ফেরত দেয় যদি KickKey বর্তমানে ডিফল্ট কীবোর্ড হিসেবে সেট থাকে।
   */
  isDefaultKeyboard: (): Promise<boolean> =>
    KickKey.isDefaultKeyboard(),

  /**
   * true ফেরত দেয় যদি KickKey সক্রিয় কীবোর্ডের তালিকায় থাকে।
   */
  isKeyboardEnabled: (): Promise<boolean> =>
    KickKey.isKeyboardEnabled(),

  /**
   * Android Settings → Keyboard খোলে ব্যবহারকারীকে সক্রিয়/পরিবর্তন করতে দেয়।
   */
  openKeyboardSettings: (): void =>
    KickKey.openKeyboardSettings(),
};
```

---

## 8. Expo Config Plugin

Config Plugin গুলো `expo prebuild`-এর সময় নেটিভ Android প্রজেক্ট প্যাচ করে। এগুলো `AndroidManifest.xml` পরিবর্তন করার, ফাইল যোগ করার, বা সার্ভিস নিবন্ধনের সঠিক উপায় — প্রতিটি prebuild-এ ওভাররাইট হয়ে যাওয়া জেনারেটেড ফাইল ম্যানুয়ালি সম্পাদনার পরিবর্তে।

### ৮.১ `plugins/withImeService.js`

এই plugin তিনটি কাজ করে:
১. `<application>` ট্যাগে `android:name=".KickKeyApplication"` সেট করে
২. পৃথক প্রসেস সহ `KickKeyInputMethodService`-এর `<service>` ডিক্লারেশন যোগ করে
৩. `VIBRATE` অনুমতি যোগ করে

```javascript
// plugins/withImeService.js

const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin যা KickKeyInputMethodService কে Android IME হিসেবে নিবন্ধন করে।
 * এছাড়াও KickKeyApplication কে Application ক্লাস হিসেবে সেট করে এবং VIBRATE অনুমতি যোগ করে।
 */
module.exports = function withImeService(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    if (!application) {
      throw new Error('withImeService: AndroidManifest.xml-এ <application> খুঁজে পাওয়া যায়নি');
    }

    // ১. কাস্টম Application ক্লাস সেট করুন
    application.$['android:name'] = '.KickKeyApplication';

    // ২. IME সার্ভিস ডিক্লারেশন যোগ করুন
    if (!application.service) {
      application.service = [];
    }

    // সার্ভিস ইতিমধ্যে নিবন্ধিত কিনা পরীক্ষা করুন (বারবার prebuild-এ ডুপ্লিকেট এড়াতে)
    const alreadyRegistered = application.service.some(
      (s) => s.$?.['android:name'] === '.KickKeyInputMethodService'
    );

    if (!alreadyRegistered) {
      application.service.push({
        $: {
          'android:name': '.KickKeyInputMethodService',
          'android:label': '@string/ime_name',
          'android:permission': 'android.permission.BIND_INPUT_METHOD',
          'android:exported': 'true',
          'android:process': ':ime_process',   // ← পৃথক প্রসেস = মেমরি আইসোলেশন
        },
        'intent-filter': [
          {
            action: [
              {
                $: { 'android:name': 'android.view.InputMethod' },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.view.im',
              'android:resource': '@xml/method',
            },
          },
        ],
      });
    }

    // ৩. VIBRATE অনুমতি যোগ করুন
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const hasVibrate = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.VIBRATE'
    );

    if (!hasVibrate) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.VIBRATE' },
      });
    }

    return config;
  });
};
```

### ৮.২ `plugins/withKeyboardBundle.js`

এই plugin EAS prebuild ধাপের অংশ হিসেবে `keyboard.bundle` বিল্ড করে, যাতে উভয় বান্ডেল সবসময় সিঙ্কে থাকে।

```javascript
// plugins/withKeyboardBundle.js

const { withDangerousMod } = require('@expo/config-plugins');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Expo config plugin যা কীবোর্ড-মাত্র JS বান্ডেল (keyboard.bundle) বিল্ড করে
 * android/app/src/main/assets/-এ প্রধান কম্প্যানিয়ন অ্যাপ বান্ডেলের পাশে।
 */
module.exports = function withKeyboardBundle(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const assetsDir = path.join(
        projectRoot, 'android', 'app', 'src', 'main', 'assets'
      );

      // assets ডিরেক্টরি নিশ্চিত করুন
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const outputPath = path.join(assetsDir, 'keyboard.bundle');
      console.log('[withKeyboardBundle] keyboard.bundle বিল্ড হচ্ছে...');

      try {
        execSync(
          [
            'npx react-native bundle',
            '--entry-file keyboard.index.js',
            `--bundle-output "${outputPath}"`,
            '--platform android',
            '--minify true',
            '--reset-cache',
          ].join(' '),
          {
            cwd: projectRoot,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' },
          }
        );
        console.log('[withKeyboardBundle] keyboard.bundle সফলভাবে বিল্ড হয়েছে');
      } catch (error) {
        console.error('[withKeyboardBundle] keyboard.bundle বিল্ড ব্যর্থ:', error.message);
        // থ্রো করবেন না — prebuild চালিয়ে যেতে দিন; বান্ডেল ইতিমধ্যে থাকতে পারে
      }

      return config;
    },
  ]);
};
```

---

## 9. React Native এন্ট্রি পয়েন্ট

### ৯.১ `index.js` — কম্প্যানিয়ন অ্যাপ এন্ট্রি পয়েন্ট

```javascript
// index.js  (প্রজেক্ট রুট)
import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent AppRegistry.registerComponent('main', () => App) কল করে
// এবং নিশ্চিত করে পরিবেশ Expo-র জন্য সঠিকভাবে সেটআপ
registerRootComponent(App);
```

### ৯.২ `App.tsx` — প্লেসহোল্ডার কম্প্যানিয়ন অ্যাপ

```tsx
// App.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import KickKeyModule from './modules/kickkey-module';

export default function App() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isDefault, setIsDefault] = useState(false);

  const checkStatus = async () => {
    const enabled = await KickKeyModule.isKeyboardEnabled();
    const def = await KickKeyModule.isDefaultKeyboard();
    setIsEnabled(enabled);
    setIsDefault(def);
  };

  useEffect(() => {
    checkStatus();
    // ব্যবহারকারী সেটিংসে থাকাকালীন প্রতি ২ সেকেন্ডে পোল করুন
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>KickKey</Text>
      <Text style={styles.subtitle}>কাস্টম কীবোর্ড</Text>

      <View style={styles.statusCard}>
        <StatusRow label="কীবোর্ড সক্রিয়" value={isEnabled} />
        <StatusRow label="ডিফল্ট হিসেবে সেট" value={isDefault} />
      </View>

      {!isEnabled && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => KickKeyModule.openKeyboardSettings()}
        >
          <Text style={styles.buttonText}>ধাপ ১: KickKey সক্রিয় করুন</Text>
        </TouchableOpacity>
      )}

      {isEnabled && !isDefault && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => KickKeyModule.openKeyboardSettings()}
        >
          <Text style={styles.buttonText}>ধাপ ২: ডিফল্ট হিসেবে সেট করুন</Text>
        </TouchableOpacity>
      )}

      {isEnabled && isDefault && (
        <View style={styles.successCard}>
          <Text style={styles.successText}>✅ KickKey সক্রিয়!</Text>
          <Text style={styles.successSub}>
            কীবোর্ড ব্যবহার করতে যেকোনো টেক্সট ফিল্ডে ট্যাপ করুন।
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function StatusRow({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, { color: value ? '#4CAF50' : '#f44336' }]}>
        {value ? '✅ হ্যাঁ' : '❌ না'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00BCD4',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 40,
  },
  statusCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 32,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  statusLabel: { color: '#ccc', fontSize: 15 },
  statusValue: { fontSize: 15, fontWeight: '600' },
  button: {
    backgroundColor: '#00BCD4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 16,
  },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '700' },
  successCard: {
    backgroundColor: '#1a2e1a',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  successText: { color: '#4CAF50', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  successSub: { color: '#888', fontSize: 14, textAlign: 'center' },
});
```

### ৯.৩ `keyboard.index.js` — কীবোর্ড বান্ডেল এন্ট্রি পয়েন্ট

এটি `KickKeyInputMethodService`-এর ভেতরে লোড হওয়া কীবোর্ড-মাত্র বান্ডেলের এন্ট্রি পয়েন্ট। এটি কম্প্যানিয়ন অ্যাপ থেকে **কিছুই** ইম্পোর্ট করবে না।

```javascript
// keyboard.index.js  (প্রজেক্ট রুট)

import { AppRegistry } from 'react-native';
import KeyboardScreen from './src/keyboard/KeyboardScreen';

/**
 * কীবোর্ড UI কম্পোনেন্ট নিবন্ধন করুন।
 * 'KickKeyKeyboard' নামটি KickKeyInputMethodService.kt-এ
 * reactRootView.startReactApplication()-এর দ্বিতীয় আর্গুমেন্টের সাথে মেলাতে হবে।
 */
AppRegistry.registerComponent('KickKeyKeyboard', () => KeyboardScreen);
```

---

## 10. কীবোর্ড স্ক্রিন (React Native)

ফেজ ১-এ এটি একটি প্লেসহোল্ডার — একটি ডার্ক প্যানেল একটি লেবেল এবং একটি ডামি কী সারি সহ। এর একমাত্র কাজ নিশ্চিত করা যে React Native IME-এর ভেতরে সঠিকভাবে রেন্ডার হয়।

### ১০.১ `src/keyboard/PlaceholderKey.tsx`

```tsx
// src/keyboard/PlaceholderKey.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface PlaceholderKeyProps {
  label: string;
  flex?: number;
}

export default function PlaceholderKey({ label, flex = 1 }: PlaceholderKeyProps) {
  return (
    <TouchableOpacity
      style={[styles.key, { flex }]}
      activeOpacity={0.7}
      onPress={() => {
        // ফেজ ২ এটিকে NativeModules.KickKey.commitKey()-এ ওয়্যার করবে
        console.log('কী প্রেস হয়েছে:', label);
      }}
    >
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  key: {
    height: 44,
    marginHorizontal: 3,
    marginVertical: 4,
    backgroundColor: '#2a2a40',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
});
```

### ১০.২ `src/keyboard/KeyboardScreen.tsx`

```tsx
// src/keyboard/KeyboardScreen.tsx

/**
 * ফেজ ১ — প্লেসহোল্ডার কীবোর্ড স্ক্রিন।
 *
 * এই কম্পোনেন্ট KickKeyInputMethodService-এর ভেতরে ReactRootView দ্বারা রেন্ডার হয়।
 * ফেজ ১-এ এর একমাত্র উদ্দেশ্য প্রমাণ করা যে React Native Android IME
 * সিস্টেমের ভেতরে সঠিকভাবে রেন্ডার হয়।
 *
 * ফেজ ২ এটিকে প্রকৃত কী সারি, NativeModules ওয়্যারিং,
 * shift লজিক, এবং সাজেশন বার দিয়ে প্রতিস্থাপন করবে।
 *
 * ⚠️  কম্প্যানিয়ন অ্যাপ থেকে কিছু ইম্পোর্ট করবেন না (expo-router, zustand,
 *     AsyncStorage, settings store)। এই ফাইল keyboard.bundle-এ বান্ডেল হয়
 *     যা ছোট (~৩–৫MB) রাখতে হবে।
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PlaceholderKey from './PlaceholderKey';

// প্লেসহোল্ডার কী সারি — কীবোর্ড আকার দেখানোর জন্য যথেষ্ট।
const ROW_1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
const ROW_2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
const ROW_3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

export default function KeyboardScreen() {
  return (
    <View style={styles.keyboard}>
      {/* হেডার — দেখায় যে React Native IME-এর ভেতরে রেন্ডার হচ্ছে */}
      <View style={styles.header}>
        <Text style={styles.headerText}>⌨ KickKey · ফেজ ১ · React Native</Text>
      </View>

      {/* প্লেসহোল্ডার সাজেশন বার */}
      <View style={styles.suggestionBar}>
        <Text style={styles.suggestionPlaceholder}>সাজেশন ফেজ ৪-এ এখানে দেখাবে</Text>
      </View>

      {/* কী সারি */}
      <View style={styles.row}>
        {ROW_1.map((key) => (
          <PlaceholderKey key={key} label={key} />
        ))}
      </View>

      <View style={styles.row}>
        {ROW_2.map((key) => (
          <PlaceholderKey key={key} label={key} />
        ))}
      </View>

      <View style={styles.row}>
        <PlaceholderKey label="⇧" flex={1.5} />
        {ROW_3.map((key) => (
          <PlaceholderKey key={key} label={key} />
        ))}
        <PlaceholderKey label="⌫" flex={1.5} />
      </View>

      {/* নিচের সারি */}
      <View style={styles.row}>
        <PlaceholderKey label="!#1" flex={1.5} />
        <PlaceholderKey label="🌐" flex={1} />
        <PlaceholderKey label="স্পেস" flex={5} />
        <PlaceholderKey label="↵" flex={1.5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    width: '100%',
    backgroundColor: '#0d0d1a',
    paddingBottom: 8,
  },
  header: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  headerText: {
    color: '#00BCD4',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  suggestionBar: {
    height: 36,
    backgroundColor: '#12122a',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  suggestionPlaceholder: {
    color: '#444',
    fontSize: 12,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
});
```

---

## 11. `app.json` কনফিগারেশন

```json
{
  "expo": {
    "name": "KickKey",
    "slug": "kickkey",
    "version": "1.0.0",
    "orientation": "portrait",
    "platforms": ["android"],
    "android": {
      "package": "com.kickkey",
      "minSdkVersion": 26,
      "targetSdkVersion": 34,
      "compileSdkVersion": 34,
      "buildToolsVersion": "34.0.0",
      "permissions": [
        "android.permission.VIBRATE"
      ],
      "blockedPermissions": [
        "android.permission.READ_CONTACTS",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.RECORD_AUDIO"
      ]
    },
    "plugins": [
      "./plugins/withImeService",
      "./plugins/withKeyboardBundle"
    ],
    "jsEngine": "hermes"
  }
}
```

---

## 12. `eas.json` কনফিগারেশন

```json
{
  "cli": {
    "version": ">= 5.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      },
      "env": {
        "NODE_ENV": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "NODE_ENV": "production"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      },
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

## 13. EAS ডেভেলপমেন্ট বিল্ড

### ১৩.১ Prebuild চালান

সমস্ত কনফিগ ফাইল প্রস্তুত হওয়ার পরে prebuild চালান। এটি আপনার plugin প্রয়োগ করে `android/` নেটিভ প্রজেক্ট পুনরায় জেনারেট করে।

```bash
# ক্লিন prebuild — সবকিছু শূন্য থেকে পুনরায় জেনারেট করে
npx expo prebuild --platform android --clean
```

Prebuild-এর পরে plugin পরিবর্তন প্রয়োগ হয়েছে কিনা যাচাই করুন:

```bash
# KickKeyApplication সেট হয়েছে কিনা নিশ্চিত করুন
grep -n "KickKeyApplication" android/app/src/main/AndroidManifest.xml
# প্রত্যাশিত: android:name=".KickKeyApplication"

# IME সার্ভিস নিবন্ধিত হয়েছে কিনা নিশ্চিত করুন
grep -n "KickKeyInputMethodService" android/app/src/main/AndroidManifest.xml
# প্রত্যাশিত: android:name=".KickKeyInputMethodService"

# পৃথক প্রসেস নিশ্চিত করুন
grep -n "ime_process" android/app/src/main/AndroidManifest.xml
# প্রত্যাশিত: android:process=":ime_process"
```

### ১৩.২ ডেভেলপমেন্ট APK বিল্ড করুন

```bash
# EAS ক্লাউডের মাধ্যমে ডেভেলপমেন্ট APK বিল্ড করুন
eas build --platform android --profile development

# EAS করবে:
# ১. আপনার প্রজেক্ট আপলোড করবে
# ২. expo prebuild চালাবে (plugin প্রয়োগ করবে, keyboard.bundle বিল্ড করবে)
# ৩. Gradle assembleDebug চালাবে
# ৪. .apk ফাইল তৈরি করবে
# ৫. QR কোড / ডাউনলোড লিঙ্ক দেবে
```

> ⏱️ প্রথম বিল্ড ১০–২০ মিনিট নেয়। পরবর্তী বিল্ড ক্যাশিং-এর কারণে দ্রুত হয়।

### ১৩.৩ ডিভাইসে ইনস্টল করুন

**বিকল্প A — EAS লিঙ্ক (সহজতম):**
EAS ড্যাশবোর্ড লিঙ্ক থেকে APK ডাউনলোড করুন এবং Android ডিভাইসে ইনস্টল করুন। প্রম্পট করলে "অজানা উৎস থেকে ইনস্টল" সক্রিয় করুন।

**বিকল্প B — USB / ADB:**
```bash
# USB দিয়ে ইনস্টল করুন (ডিভাইসে USB ডিবাগিং সক্রিয় থাকতে হবে)
eas run:android

# অথবা ম্যানুয়ালি:
adb install path/to/kickkey.apk
```

### ১৩.৪ লোকাল বিল্ড (ঐচ্ছিক — দ্রুত ইটারেশন)

```bash
# প্রথমে prebuild চালান
npx expo prebuild --platform android

# Gradle দিয়ে লোকালি বিল্ড করুন
cd android && ./gradlew assembleDebug

# সরাসরি ইনস্টল করুন
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

## 14. ডিভাইসে দুই-ধাপ সক্রিয়করণ

APK ইনস্টল করার পরে, ব্যবহারকারী Android Settings-এ দুটি ধাপ সম্পন্ন না করা পর্যন্ত কীবোর্ড কাজ করবে না। এটি একটি Android নিরাপত্তা প্রয়োজনীয়তা — কোনো কীবোর্ড নিজেকে নীরবে সক্রিয় করতে পারে না।

### ধাপ ১: ইনপুট মেথডে KickKey সক্রিয় করুন

```
Android Settings (সেটিংস)
  → General Management (সাধারণ ব্যবস্থাপনা)
    → Keyboard list & default (কীবোর্ড তালিকা ও ডিফল্ট)
      → Manage keyboards (কীবোর্ড পরিচালনা)
        → KickKey Keyboard → টগল চালু করুন
```

টগল করলে Android একটি নিরাপত্তা সতর্কতা ডায়ালগ দেখায়:
> "This input method may be able to collect all the text you type..."

**OK** ট্যাপ করুন।

### ধাপ ২: KickKey ডিফল্ট কীবোর্ড হিসেবে সেট করুন

```
Android Settings
  → General Management
    → Keyboard list & default
      → Default keyboard → KickKey Keyboard
```

**অথবা** যেকোনো টেক্সট ফিল্ড থেকে নেভিগেশন বারে কীবোর্ড আইকনে ট্যাপ করে পরিবর্তন করুন (ধাপ ১-এর পরে উপলব্ধ)।

### এটি কাজ করছে কিনা যাচাই করুন

১. যেকোনো টেক্সট ফিল্ড আছে এমন অ্যাপ খুলুন (Messages, Notes, Chrome)
২. টেক্সট ফিল্ডে ট্যাপ করুন
৩. ডার্ক ব্যাকগ্রাউন্ড এবং "⌨ KickKey · ফেজ ১ · React Native" হেডার সহ KickKey প্লেসহোল্ডার কীবোর্ড দেখা যাওয়া উচিত
৪. কীগুলো ট্যাপযোগ্য কিন্তু এখনো টাইপ হয় না — সেটি ফেজ ২

### লগ মনিটর করুন

```bash
# রিয়েল টাইমে IME সার্ভিস লগ দেখুন
adb logcat -s KickKeyIME KickKeyApplication

# কীবোর্ড খোলার সময় প্রত্যাশিত আউটপুট:
# I/KickKeyApplication: কীবোর্ড ReactHost প্রি-ওয়ার্ম সম্পন্ন
# I/KickKeyIME: IME সার্ভিস তৈরি হয়েছে
# I/KickKeyIME: onCreateInputView কল হয়েছে
# I/KickKeyIME: ReactRootView তৈরি এবং শুরু হয়েছে
```

---

## 15. যাচাই চেকলিস্ট

ফেজ ২-এ যাওয়ার আগে প্রতিটি আইটেম সম্পন্ন করুন।

### অবকাঠামো
- [ ] `node --version` v18+ দেখায়
- [ ] `java -version` JDK 17 দেখায়
- [ ] `$ANDROID_HOME` সেট এবং Android SDK-এ নির্দেশ করে
- [ ] `eas whoami` আপনার অ্যাকাউন্ট দেখায়
- [ ] `npx expo prebuild` ত্রুটি ছাড়া সম্পন্ন হয়
- [ ] `grep "KickKeyApplication" android/app/src/main/AndroidManifest.xml` ফলাফল দেখায়
- [ ] `grep "KickKeyInputMethodService" android/app/src/main/AndroidManifest.xml` ফলাফল দেখায়
- [ ] `grep "ime_process" android/app/src/main/AndroidManifest.xml` ফলাফল দেখায়
- [ ] `android/app/src/main/res/xml/method.xml` বিদ্যমান
- [ ] Prebuild-এর পরে `android/app/src/main/assets/keyboard.bundle` বিদ্যমান

### বিল্ড
- [ ] `eas build --platform android --profile development` সফলভাবে সম্পন্ন হয়
- [ ] APK ডিভাইসে ত্রুটি ছাড়া ইনস্টল হয়
- [ ] কম্প্যানিয়ন অ্যাপ ক্র্যাশ ছাড়া খোলে
- [ ] কম্প্যানিয়ন অ্যাপ প্রাথমিকভাবে "কীবোর্ড সক্রিয়: ❌ না" দেখায়

### সক্রিয়করণ
- [ ] Android Settings → কীবোর্ড পরিচালনায় KickKey দেখা যায়
- [ ] টগল চালু করার পরে কম্প্যানিয়ন অ্যাপ "কীবোর্ড সক্রিয়: ✅ হ্যাঁ" দেখায়
- [ ] ডিফল্ট হিসেবে সেট করার পরে "ডিফল্ট হিসেবে সেট: ✅ হ্যাঁ" দেখায়

### কীবোর্ড রেন্ডারিং
- [ ] যেকোনো অ্যাপে টেক্সট ফিল্ডে ট্যাপ করলে KickKey প্লেসহোল্ডার কীবোর্ড দেখায়
- [ ] ডার্ক ব্যাকগ্রাউন্ড সঠিকভাবে রেন্ডার হয়
- [ ] "⌨ KickKey · ফেজ ১ · React Native" হেডার দৃশ্যমান
- [ ] তিনটি কী সারি রেন্ডার হয়
- [ ] কীগুলো ভিজ্যুয়ালি সাড়া দেয় (ট্যাপে opacity পরিবর্তন)
- [ ] `adb logcat -s KickKeyIME` "ReactRootView তৈরি এবং শুরু হয়েছে" দেখায়

### মেমরি (ঐচ্ছিক কিন্তু প্রস্তাবিত)
- [ ] Android Studio → Profiler → `com.kickkey:ime_process`-এ সংযুক্ত করুন
- [ ] কীবোর্ড খোলার পরে RAM ৬০MB-এর নিচে থাকে নিশ্চিত করুন

---

## 16. সমস্যা সমাধান

### logcat-এ "KickKeyApplication not found"

**কারণ:** Config plugin `<application>` ট্যাগে `android:name=".KickKeyApplication"` সেট করেনি।

**সমাধান:**
```bash
npx expo prebuild --platform android --clean
grep "android:name" android/app/src/main/AndroidManifest.xml | head -5
```

এখনো না থাকলে, `plugins/withImeService.js` `app.json` → `plugins`-এ তালিকাভুক্ত আছে কিনা পরীক্ষা করুন।

---

### "keyboard.bundle not found" — প্রথম কীবোর্ড খোলায় অ্যাপ ক্র্যাশ

**কারণ:** Prebuild-এর সময় `keyboard.bundle` বিল্ড হয়নি।

**সমাধান:**
```bash
# বান্ডেল ম্যানুয়ালি বিল্ড করুন
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify false

# তারপর APK পুনরায় বিল্ড করুন
cd android && ./gradlew assembleDebug
```

---

### KickKey Android Settings → কীবোর্ড পরিচালনায় দেখা যায় না

**কারণ:** হয় manifest থেকে `<service>` ডিক্লারেশন নেই, অথবা `method.xml` নেই / ভুল।

**সমাধান:**
```bash
# সার্ভিস manifest-এ আছে কিনা পরীক্ষা করুন
grep -A 10 "KickKeyInputMethodService" android/app/src/main/AndroidManifest.xml

# method.xml বিদ্যমান কিনা পরীক্ষা করুন
ls android/app/src/main/res/xml/
```

ঠিক করার পরে, APK পুনরায় বিল্ড এবং পুনরায় ইনস্টল করুন।

---

### সাদা / ফাঁকা কীবোর্ড ভিউ — কোনো React Native কন্টেন্ট নেই

**কারণ:** `ReactHost` প্রি-ওয়ার্ম ব্যর্থ হয়েছে, অথবা `keyboard.bundle` লোড ব্যর্থ হয়েছে।

**সমাধান:**
```bash
# Application লগে ত্রুটি পরীক্ষা করুন
adb logcat -s KickKeyApplication

# খুঁজুন:
# E/KickKeyApplication: কীবোর্ড ReactHost প্রি-ওয়ার্ম ব্যর্থ হয়েছে
```

পাঠযোগ্য ত্রুটি বার্তার জন্য `--minify false` দিয়ে `keyboard.bundle` বিল্ড করুন:
```bash
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify false
```

---

### `ReactHost` / `ReactHostBuilder` ক্লাস পাওয়া যায়নি (Kotlin কম্পাইল ত্রুটি)

**কারণ:** ভুল React Native ভার্সন বা নিখোঁজ ডিপেন্ডেন্সি।

**সমাধান:** `android/app/build.gradle`-এ নিশ্চিত করুন:
```groovy
implementation("com.facebook.react:react-android")
implementation("com.facebook.react:hermes-android")
```

---

### EAS বিল্ড "Plugin withKeyboardBundle failed" সহ ব্যর্থ হয়

**কারণ:** `keyboard.index.js`-এ সিনট্যাক্স ত্রুটি, অথবা `react-native bundle` উপলব্ধ নয়।

**সমাধান:**
```bash
# প্রথমে লোকালি বান্ডেল কমান্ড পরীক্ষা করুন
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output /tmp/test.bundle \
  --platform android \
  --minify false

# টার্মিনালে দেখানো JS ত্রুটি ঠিক করুন, তারপর EAS বিল্ড পুনরায় চেষ্টা করুন
```

---

*ফেজ ১ সম্পন্ন। প্রকৃত কী প্রেস, ব্যাকস্পেস, এবং InputConnection ওয়্যার আপ করতে ফেজ ২ — মূল ইনপুট — এ এগিয়ে যান।*
