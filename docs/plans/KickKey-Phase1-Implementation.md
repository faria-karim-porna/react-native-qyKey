# KickKey — Phase 1 Implementation Guide
## Foundation (Weeks 1–2)

> **Goal:** A React Native component renders visually as a working keyboard inside Android's IME system.
> **No key logic yet** — typing, backspace, suggestions are Phase 2. Phase 1 is purely about plumbing: project setup, native wiring, and proving the architecture works end-to-end.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Project Initialization](#2-project-initialization)
3. [Folder Structure for Phase 1](#3-folder-structure-for-phase-1)
4. [Gradle & Build Configuration](#4-gradle--build-configuration)
5. [Native Kotlin Files](#5-native-kotlin-files)
6. [Android Manifest & XML Resources](#6-android-manifest--xml-resources)
7. [Expo Native Module (KickKeyModule)](#7-expo-native-module-kickkeymodule)
8. [Expo Config Plugins](#8-expo-config-plugins)
9. [React Native Entry Points](#9-react-native-entry-points)
10. [Keyboard Screen (React Native)](#10-keyboard-screen-react-native)
11. [app.json Configuration](#11-appjson-configuration)
12. [eas.json Configuration](#12-easjson-configuration)
13. [EAS Development Build](#13-eas-development-build)
14. [Two-Step Activation on Device](#14-two-step-activation-on-device)
15. [Verification Checklist](#15-verification-checklist)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Prerequisites

Install and verify every tool before touching code. A single wrong version causes hard-to-debug build failures.

### 1.1 Required Tools

```bash
# Node.js — must be v18 or higher
node --version        # expected: v18.x.x or v20.x.x

# npm
npm --version         # expected: 9.x or higher

# Java Development Kit — must be JDK 17 exactly
java -version         # expected: openjdk 17.x.x
javac -version        # expected: javac 17.x.x

# Android SDK — set ANDROID_HOME
echo $ANDROID_HOME    # expected: /Users/you/Library/Android/sdk (macOS)
                      #           C:\Users\you\AppData\Local\Android\Sdk (Windows)
                      #           /home/you/Android/Sdk (Linux)

# Expo CLI
npx expo --version    # expected: 6.x.x or higher

# EAS CLI
eas --version         # expected: 5.x.x or higher
```

### 1.2 Install Missing Tools

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Install Expo CLI globally (optional, npx works too)
npm install -g expo-cli

# Verify Android SDK platform tools
adb --version         # must be accessible from PATH
```

### 1.3 Android SDK Requirements

Open Android Studio → SDK Manager and ensure these are installed:

- **Android SDK Platform 34** (Android 14) — compile target
- **Android SDK Platform 26** (Android 8.0) — minimum supported
- **Android SDK Build-Tools 34.0.0**
- **Android Emulator** (optional, physical device preferred for keyboard testing)

### 1.4 EAS Account

```bash
# Log in to your Expo / EAS account
eas login

# Verify login
eas whoami
```

---

## 2. Project Initialization

### 2.1 Create the Expo Project

```bash
# Create a new Expo project with TypeScript template
npx create-expo-app KickKey --template blank-typescript

cd KickKey

# Verify structure
ls
# expected: app.json  App.tsx  assets/  node_modules/  package.json  tsconfig.json
```

### 2.2 Install Core Dependencies

```bash
# Expo Modules — required for writing native Kotlin modules
npx expo install expo-modules-core

# Expo Router — for companion app navigation (used in later phases)
npx expo install expo-router

# React Native async storage (companion app, Phase 5)
npx expo install @react-native-async-storage/async-storage

# Zustand — state management (companion app, Phase 5)
npm install zustand
```

### 2.3 Initialize EAS

```bash
# Initialize EAS in the project — creates eas.json
eas init

# When prompted:
# "Would you like to create a project?" → Yes
# "Project name" → KickKey
```

### 2.4 Prebuild the Android Native Project

Expo Prebuild generates the `android/` folder with native Android code. You must run this before adding any Kotlin files.

```bash
npx expo prebuild --platform android

# This creates:
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

> ⚠️ Every time you change `app.json` plugins, run `npx expo prebuild --platform android --clean` to regenerate. **Do not manually edit files that prebuild generates**, except the ones listed in this guide.

### 2.5 Set Gradle Properties

```bash
# Open android/gradle.properties and set these values:
```

```properties
# android/gradle.properties

# Use old architecture — required for ReactHost without Activity
newArchEnabled=false

# Use Hermes JS engine — essential for low memory footprint
hermesEnabled=true

# Standard settings
android.useAndroidX=true
android.enableJetifier=true
```

---

## 3. Folder Structure for Phase 1

Create this structure. Files marked `← create now` need to be created in this phase. The rest already exist from prebuild or will be created in later phases.

```
KickKey/
│
├── index.js                                    ← create now (companion app entry)
├── keyboard.index.js                           ← create now (keyboard bundle entry)
├── app.json                                    ← modify now
├── eas.json                                    ← modify now
├── tsconfig.json                               (exists, no changes)
├── package.json                                (exists, no changes)
│
├── src/
│   └── keyboard/                               ← create folder now
│       ├── KeyboardScreen.tsx                  ← create now
│       └── PlaceholderKey.tsx                  ← create now
│
├── plugins/
│   ├── withImeService.js                       ← create now
│   └── withKeyboardBundle.js                   ← create now
│
├── modules/
│   └── kickkey-module/                         ← create folder now
│       ├── index.ts                            ← create now
│       └── android/
│           └── src/main/java/com/kickkey/
│               ├── KickKeyModule.kt            ← create now
│               └── KickKeyPackage.kt           ← create now
│
└── android/                                    (generated by prebuild)
    └── app/src/main/
        ├── java/com/kickkey/
        │   ├── MainActivity.kt                 (exists)
        │   ├── MainApplication.kt              (exists — DO NOT edit directly)
        │   ├── KickKeyApplication.kt           ← create now
        │   └── KickKeyInputMethodService.kt    ← create now
        ├── res/
        │   ├── values/
        │   │   └── strings.xml                 ← modify now (add ime_name)
        │   └── xml/
        │       └── method.xml                  ← create now
        └── AndroidManifest.xml                 (managed by config plugin)
```

---

## 4. Gradle & Build Configuration

### 4.1 App-Level `build.gradle`

Open `android/app/build.gradle` and verify / set these:

```groovy
// android/app/build.gradle

android {
    compileSdkVersion 34
    buildToolsVersion "34.0.0"

    defaultConfig {
        applicationId "com.kickkey"
        minSdkVersion 26           // Android 8.0 minimum
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
    // React Native — already added by Expo prebuild
    implementation("com.facebook.react:react-android")
    implementation("com.facebook.react:hermes-android")

    // Expo modules — already added by Expo prebuild
    implementation project(':expo-modules-core')
}
```

### 4.2 Root-Level `build.gradle`

```groovy
// android/build.gradle
buildscript {
    ext {
        buildToolsVersion = "34.0.0"
        minSdkVersion = 26
        compileSdkVersion = 34
        targetSdkVersion = 34
        kotlinVersion = "1.9.0"    // ← ensure Kotlin version is set
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}")
    }
}
```

---

## 5. Native Kotlin Files

These are the two most critical Kotlin files for Phase 1. They establish the IME service and the ReactHost pre-warming that makes the keyboard open fast.

### 5.1 `KickKeyApplication.kt`

This file replaces the default Application class. It pre-warms the Hermes JS runtime with `keyboard.bundle` at app startup, so the keyboard is ready before the user ever taps a text field.

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
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.flipper.ReactNativeFlipper
import com.facebook.react.runtime.ReactHostBuilder
import com.facebook.react.runtime.JSBundleLoader
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class KickKeyApplication : Application(), ReactApplication {

    companion object {
        private const val TAG = "KickKeyApplication"
    }

    // ── Companion app ReactHost (managed by Expo, uses main.bundle) ──────────
    override val reactNativeHost: ReactNativeHost
        get() = ReactNativeHostWrapper(this, object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // Add KickKey native module package
                    add(KickKeyPackage())
                }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = false   // old arch
            override val isHermesEnabled: Boolean = true
        })

    // ── Keyboard ReactHost (pre-warmed, uses keyboard.bundle) ────────────────
    lateinit var keyboardReactHost: ReactHost
        private set

    override fun onCreate() {
        super.onCreate()

        // Initialize Expo module lifecycle
        ApplicationLifecycleDispatcher.onApplicationCreate(this)

        // Pre-warm the keyboard JS runtime on a background thread.
        // This runs at app start so that by the time the user taps any
        // text field, Hermes + keyboard.bundle are already loaded.
        Thread {
            try {
                initKeyboardRuntime()
                Log.i(TAG, "Keyboard ReactHost pre-warm complete")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to pre-warm keyboard ReactHost", e)
            }
        }.apply {
            name = "KickKey-PreWarm"
            isDaemon = true
            start()
        }
    }

    private fun initKeyboardRuntime() {
        // Build a ReactHost that loads keyboard.bundle (not the full main.bundle)
        // This is the standalone React Native runtime for the keyboard UI only.
        keyboardReactHost = ReactHostBuilder(this)
            .setJSBundleAssetPath("keyboard.bundle")   // ← keyboard-only bundle
            .setJSEngineResolutionAlgorithm(
                com.facebook.react.runtime.JSEngineResolutionAlgorithm.HERMES
            )
            .addReactPackage(KickKeyPackage())          // only our bridge package
            .setIsDeveloperSupport(BuildConfig.DEBUG)
            .build()

        // Start loading JS — this is the expensive step (~200–500ms first time)
        // After this, keyboard opens in ~50–80ms
        keyboardReactHost.start()
    }

    override fun onTerminate() {
        super.onTerminate()
        ApplicationLifecycleDispatcher.onApplicationTerminate(this)
    }
}
```

### 5.2 Register `KickKeyApplication` in Manifest

> This is handled automatically by the config plugin in Section 8. However, if you are editing `MainApplication.kt` manually, replace its class declaration with:

```kotlin
// android/app/src/main/java/com/kickkey/MainApplication.kt
// ← If this file exists from prebuild, delete it.
// KickKeyApplication.kt takes its place entirely.
```

The config plugin will set `android:name=".KickKeyApplication"` on the `<application>` tag automatically.

---

### 5.3 `KickKeyInputMethodService.kt`

This is the Android IME service. It receives the `ReactRootView` from the pre-warmed `ReactHost` and returns it to Android as the keyboard view. In Phase 1 the keyboard renders a placeholder UI — just enough to prove the wiring works.

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
        Log.i(TAG, "IME Service created")
    }

    /**
     * Called by Android when a text field receives focus and the user
     * needs to see the keyboard. Must return a View synchronously.
     *
     * Because KickKeyApplication pre-warms the ReactHost at startup,
     * this call is fast: ~50–80ms instead of ~300–600ms cold start.
     */
    override fun onCreateInputView(): View {
        Log.i(TAG, "onCreateInputView called")

        val app = application as? KickKeyApplication
        if (app == null) {
            Log.e(TAG, "KickKeyApplication not found — returning fallback view")
            return View(this)
        }

        // Wait for ReactHost to be ready if pre-warm is still in progress.
        // This should only happen on the very first ever app launch.
        if (!::app.keyboardReactHost.isInitialized) {
            Log.w(TAG, "ReactHost not yet ready — waiting...")
            Thread.sleep(100)   // max 100ms wait; in production this is near-zero
        }

        // Create a ReactRootView — this IS an Android View
        // Android will receive this as the keyboard surface
        reactRootView = ReactRootView(this)
        reactRootView!!.startReactApplication(
            app.keyboardReactHost,
            "KickKeyKeyboard",   // must match AppRegistry.registerComponent in keyboard.index.js
            null                 // no initial props for Phase 1
        )

        Log.i(TAG, "ReactRootView created and started")
        return reactRootView!!
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        Log.i(TAG, "Input started — inputType: ${info.inputType}")
        // Phase 2 will use this to adapt keyboard to input type (password, email, number)
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        Log.i(TAG, "Input finished")
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        Log.i(TAG, "Keyboard hidden")
        // Phase 6 will release emoji/clipboard panels here
    }

    override fun onDestroy() {
        // Clean up ReactRootView to avoid memory leaks
        reactRootView?.unmountReactApplication()
        reactRootView = null
        super.onDestroy()
        Log.i(TAG, "IME Service destroyed")
    }
}
```

---

## 6. Android Manifest & XML Resources

### 6.1 `res/values/strings.xml`

Add the IME display name. This is what appears in Android Settings → Keyboard list.

```xml
<!-- android/app/src/main/res/values/strings.xml -->
<resources>
    <string name="app_name">KickKey</string>
    <string name="ime_name">KickKey Keyboard</string>
</resources>
```

### 6.2 `res/xml/method.xml`

This file declares which languages the keyboard supports. Android reads it from the `<meta-data>` tag in the manifest. Create the `xml/` directory if it doesn't exist.

```xml
<!-- android/app/src/main/res/xml/method.xml -->
<?xml version="1.0" encoding="utf-8"?>
<input-method
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:settingsActivity="com.kickkey.MainActivity"
    android:supportsSwitchingToNextInputMethod="true">

    <!--
        Each <subtype> is a language option.
        Android shows these in the keyboard language switcher.
        subtypeId must be unique integers.
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

### 6.3 `AndroidManifest.xml` — what the config plugin adds

You do **not** edit `AndroidManifest.xml` directly. The config plugin in Section 8 handles this. For reference, here is what the plugin adds inside the `<application>` tag:

```xml
<!-- Added automatically by plugins/withImeService.js -->

<!-- 1. Register the Application class -->
<application android:name=".KickKeyApplication" ...>

    <!-- 2. Register the IME service -->
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

<!-- 3. Vibration permission -->
<uses-permission android:name="android.permission.VIBRATE" />
```

---

## 7. Expo Native Module (KickKeyModule)

In Phase 1 the native module is minimal — it exposes only the methods needed to verify the bridge works. Full implementation is in Phase 2.

### 7.1 Create Module Directory

```bash
mkdir -p modules/kickkey-module/android/src/main/java/com/kickkey
```

### 7.2 `KickKeyModule.kt`

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyModule.kt

package com.kickkey

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KickKeyModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("KickKey")

        // ── Phase 1: Status checks only ──────────────────────────────────────

        /**
         * Returns true if KickKey is the currently active default keyboard.
         * Used by the companion app's onboarding screen to show setup progress.
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
         * Returns true if KickKey appears in the list of enabled input methods.
         * The user must enable it in Android Settings before it can be selected.
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
         * Opens Android's keyboard settings screen.
         * Called from the onboarding wizard to guide the user through activation.
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

        // ── Phase 2+ methods will be added here: ─────────────────────────────
        // commitKey, sendBackspace, commitSpace, sendEnter,
        // getPreferences, savePreferences, getClipboardHistory
    }
}
```

### 7.3 `KickKeyPackage.kt`

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyPackage.kt

package com.kickkey

import expo.modules.kotlin.Package

class KickKeyPackage : Package {
    override fun createModules() = listOf(KickKeyModule())
}
```

### 7.4 `modules/kickkey-module/index.ts`

This is the TypeScript export that React Native code imports.

```typescript
// modules/kickkey-module/index.ts
import { NativeModules } from 'react-native';

const { KickKey } = NativeModules;

export default {
  /**
   * Returns true if KickKey is currently set as the default keyboard.
   */
  isDefaultKeyboard: (): Promise<boolean> =>
    KickKey.isDefaultKeyboard(),

  /**
   * Returns true if KickKey is in the enabled keyboards list.
   */
  isKeyboardEnabled: (): Promise<boolean> =>
    KickKey.isKeyboardEnabled(),

  /**
   * Opens Android Settings → Keyboard to let user enable/switch keyboards.
   */
  openKeyboardSettings: (): void =>
    KickKey.openKeyboardSettings(),
};
```

---

## 8. Expo Config Plugins

Config plugins patch the native Android project during `expo prebuild`. They are the correct way to modify `AndroidManifest.xml`, add files, or register services — instead of manually editing generated files that get overwritten on every prebuild.

### 8.1 `plugins/withImeService.js`

This plugin does three things:
1. Sets `android:name=".KickKeyApplication"` on the `<application>` tag
2. Adds the `<service>` declaration for `KickKeyInputMethodService` with a separate process
3. Adds the `VIBRATE` permission

```javascript
// plugins/withImeService.js

const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin that registers KickKeyInputMethodService as an Android IME.
 * Also sets KickKeyApplication as the Application class and adds VIBRATE permission.
 */
module.exports = function withImeService(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    if (!application) {
      throw new Error('withImeService: Could not find <application> in AndroidManifest.xml');
    }

    // 1. Set custom Application class
    application.$['android:name'] = '.KickKeyApplication';

    // 2. Add IME service declaration
    if (!application.service) {
      application.service = [];
    }

    // Check if service already registered (avoid duplicates on repeated prebuild)
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
          'android:process': ':ime_process',   // ← separate process = memory isolation
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

    // 3. Add VIBRATE permission (for Phase 2 haptic feedback)
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

### 8.2 `plugins/withKeyboardBundle.js`

This plugin builds `keyboard.bundle` as part of the EAS prebuild step, so both bundles are always in sync.

```javascript
// plugins/withKeyboardBundle.js

const { withDangerousMod } = require('@expo/config-plugins');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Expo config plugin that builds the keyboard-only JS bundle (keyboard.bundle)
 * into android/app/src/main/assets/ alongside the main companion app bundle.
 *
 * This runs during `expo prebuild` and `eas build`.
 */
module.exports = function withKeyboardBundle(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const assetsDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'assets'
      );

      // Ensure assets directory exists
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const outputPath = path.join(assetsDir, 'keyboard.bundle');

      console.log('[withKeyboardBundle] Building keyboard.bundle...');

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
        console.log('[withKeyboardBundle] keyboard.bundle built successfully');
      } catch (error) {
        console.error('[withKeyboardBundle] Failed to build keyboard.bundle:', error.message);
        // Don't throw — allow prebuild to continue; bundle may already exist
      }

      return config;
    },
  ]);
};
```

---

## 9. React Native Entry Points

### 9.1 `index.js` — Companion App Entry Point

This is the entry point for the main companion app process. It registers the app component that Expo Router uses.

```javascript
// index.js  (project root)
import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App)
// and ensures the environment is set up properly for Expo
registerRootComponent(App);
```

### 9.2 `App.tsx` — Placeholder Companion App

For Phase 1 the companion app just shows a setup status screen.

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
    const isDefault = await KickKeyModule.isDefaultKeyboard();
    setIsEnabled(enabled);
    setIsDefault(isDefault);
  };

  useEffect(() => {
    checkStatus();
    // Poll every 2 seconds while user is in settings
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>KickKey</Text>
      <Text style={styles.subtitle}>Custom Keyboard</Text>

      <View style={styles.statusCard}>
        <StatusRow
          label="Keyboard Enabled"
          value={isEnabled}
        />
        <StatusRow
          label="Set as Default"
          value={isDefault}
        />
      </View>

      {!isEnabled && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => KickKeyModule.openKeyboardSettings()}
        >
          <Text style={styles.buttonText}>Step 1: Enable KickKey</Text>
        </TouchableOpacity>
      )}

      {isEnabled && !isDefault && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => KickKeyModule.openKeyboardSettings()}
        >
          <Text style={styles.buttonText}>Step 2: Set as Default</Text>
        </TouchableOpacity>
      )}

      {isEnabled && isDefault && (
        <View style={styles.successCard}>
          <Text style={styles.successText}>✅ KickKey is active!</Text>
          <Text style={styles.successSub}>
            Tap any text field to use the keyboard.
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
        {value ? '✅ Yes' : '❌ No'}
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
  statusLabel: {
    color: '#ccc',
    fontSize: 15,
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#00BCD4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 16,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  successCard: {
    backgroundColor: '#1a2e1a',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  successText: {
    color: '#4CAF50',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  successSub: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
});
```

### 9.3 `keyboard.index.js` — Keyboard Bundle Entry Point

This is the entry point for the keyboard-only bundle loaded inside `KickKeyInputMethodService`. It must import **nothing** from the companion app.

```javascript
// keyboard.index.js  (project root)

import { AppRegistry } from 'react-native';
import KeyboardScreen from './src/keyboard/KeyboardScreen';

/**
 * Register the keyboard UI component.
 * The name 'KickKeyKeyboard' MUST match the second argument of
 * reactRootView.startReactApplication() in KickKeyInputMethodService.kt
 */
AppRegistry.registerComponent('KickKeyKeyboard', () => KeyboardScreen);
```

---

## 10. Keyboard Screen (React Native)

In Phase 1 this is a placeholder — a dark panel with a label and one dummy key row. Its only job is to confirm that React Native renders correctly inside the IME. All real keys, layouts, and input logic come in Phase 2.

### 10.1 `src/keyboard/PlaceholderKey.tsx`

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
        // Phase 2 will wire this to NativeModules.KickKey.commitKey()
        console.log('Key pressed:', label);
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

### 10.2 `src/keyboard/KeyboardScreen.tsx`

```tsx
// src/keyboard/KeyboardScreen.tsx

/**
 * PHASE 1 — Placeholder keyboard screen.
 *
 * This component renders inside KickKeyInputMethodService via ReactRootView.
 * Its sole purpose in Phase 1 is to prove that React Native renders correctly
 * inside the Android IME system.
 *
 * Phase 2 will replace this with real key rows, NativeModules wiring,
 * shift logic, and the suggestion bar.
 *
 * ⚠️  DO NOT import anything from the companion app (expo-router, zustand,
 *     AsyncStorage, settings store). This file is bundled into keyboard.bundle
 *     which must stay small (~3–5MB).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import PlaceholderKey from './PlaceholderKey';

// Placeholder key rows — just enough to show a keyboard shape.
// Real layout comes in Phase 2.
const ROW_1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
const ROW_2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
const ROW_3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

export default function KeyboardScreen() {
  return (
    <View style={styles.keyboard}>
      {/* Header — shows that React Native is rendering inside the IME */}
      <View style={styles.header}>
        <Text style={styles.headerText}>⌨ KickKey · Phase 1 · React Native</Text>
      </View>

      {/* Placeholder suggestion bar */}
      <View style={styles.suggestionBar}>
        <Text style={styles.suggestionPlaceholder}>Suggestions appear here in Phase 4</Text>
      </View>

      {/* Key rows */}
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

      {/* Bottom row */}
      <View style={styles.row}>
        <PlaceholderKey label="!#1" flex={1.5} />
        <PlaceholderKey label="🌐" flex={1} />
        <PlaceholderKey label="space" flex={5} />
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

## 11. `app.json` Configuration

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

## 12. `eas.json` Configuration

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

## 13. EAS Development Build

### 13.1 Run Prebuild

Run prebuild after all config files are in place. This regenerates the `android/` native project with your plugins applied.

```bash
# Clean prebuild — regenerates everything from scratch
npx expo prebuild --platform android --clean
```

After prebuild, verify the plugin changes were applied:

```bash
# Confirm KickKeyApplication is set
grep -n "KickKeyApplication" android/app/src/main/AndroidManifest.xml
# expected: android:name=".KickKeyApplication"

# Confirm IME service is registered
grep -n "KickKeyInputMethodService" android/app/src/main/AndroidManifest.xml
# expected: android:name=".KickKeyInputMethodService"

# Confirm separate process
grep -n "ime_process" android/app/src/main/AndroidManifest.xml
# expected: android:process=":ime_process"
```

### 13.2 Build the Development APK

```bash
# Build a development APK via EAS cloud
eas build --platform android --profile development

# EAS will:
# 1. Upload your project
# 2. Run expo prebuild (applies plugins, builds keyboard.bundle)
# 3. Run Gradle assembleDebug
# 4. Produce a .apk file
# 5. Give you a QR code / download link
```

> ⏱️ First build takes 10–20 minutes. Subsequent builds are faster due to caching.

### 13.3 Install on Device

**Option A — EAS link (easiest):**
Download the APK from the EAS dashboard link and install it on your Android device. Enable "Install from unknown sources" if prompted.

**Option B — USB / ADB:**
```bash
# Install via USB (device must have USB debugging enabled)
eas run:android

# Or manually:
adb install path/to/kickkey.apk
```

### 13.4 Local Build (Optional — faster iteration)

If you have a complete Android dev environment set up locally:

```bash
# Run prebuild first
npx expo prebuild --platform android

# Build locally with Gradle
cd android && ./gradlew assembleDebug

# Install directly
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

## 14. Two-Step Activation on Device

After installing the APK, the keyboard will **not** work until the user completes two steps in Android Settings. This is an Android security requirement — no keyboard can activate itself silently.

### Step 1: Enable KickKey in Input Methods

```
Android Settings
  → General Management  (or System → Language & Input)
    → Keyboard list & default  (or On-screen keyboard / Virtual keyboard)
      → Manage keyboards
        → KickKey Keyboard  → toggle ON
```

When toggled on, Android shows a security warning dialog:
> "This input method may be able to collect all the text you type, including personal data such as passwords and credit card numbers. It comes from the app KickKey. Use this input method?"

Tap **OK** to proceed.

### Step 2: Set KickKey as Default Keyboard

```
Android Settings
  → General Management
    → Keyboard list & default
      → Default keyboard → KickKey Keyboard
```

**Or** switch from within any text field by tapping the keyboard icon in the navigation bar (available after Step 1).

### Verifying It Works

1. Open any app with a text field (Messages, Notes, Chrome address bar)
2. Tap the text field
3. The KickKey placeholder keyboard should appear with the dark background and "⌨ KickKey · Phase 1 · React Native" header
4. Keys are tappable but do not type yet — that is Phase 2

### Monitoring Logs

```bash
# View IME service logs in real time
adb logcat -s KickKeyIME KickKeyApplication

# Expected output when keyboard opens:
# I/KickKeyApplication: Keyboard ReactHost pre-warm complete
# I/KickKeyIME: IME Service created
# I/KickKeyIME: onCreateInputView called
# I/KickKeyIME: ReactRootView created and started
```

---

## 15. Verification Checklist

Complete every item before moving to Phase 2.

### Infrastructure
- [ ] `node --version` shows v18+
- [ ] `java -version` shows JDK 17
- [ ] `$ANDROID_HOME` is set and points to Android SDK
- [ ] `eas whoami` shows your account
- [ ] `npx expo prebuild` completes without errors
- [ ] `grep "KickKeyApplication" android/app/src/main/AndroidManifest.xml` returns a result
- [ ] `grep "KickKeyInputMethodService" android/app/src/main/AndroidManifest.xml` returns a result
- [ ] `grep "ime_process" android/app/src/main/AndroidManifest.xml` returns a result
- [ ] `android/app/src/main/res/xml/method.xml` exists
- [ ] `android/app/src/main/assets/keyboard.bundle` exists after prebuild

### Build
- [ ] `eas build --platform android --profile development` completes successfully
- [ ] APK installs on device without error
- [ ] Companion app opens without crashing
- [ ] Companion app shows "Keyboard Enabled: ❌ No" initially

### Activation
- [ ] KickKey appears in Android Settings → Manage keyboards
- [ ] After toggling on, companion app shows "Keyboard Enabled: ✅ Yes"
- [ ] After setting as default, companion app shows "Set as Default: ✅ Yes"

### Keyboard Rendering
- [ ] Tapping a text field in any app shows the KickKey placeholder keyboard
- [ ] The dark background renders correctly
- [ ] The "⌨ KickKey · Phase 1 · React Native" header is visible
- [ ] All three key rows render
- [ ] Keys are visually responsive (opacity changes on tap)
- [ ] `adb logcat -s KickKeyIME` shows "ReactRootView created and started"

### Memory (optional but recommended)
- [ ] Open Android Studio → Profiler → attach to `com.kickkey:ime_process`
- [ ] Confirm RAM stays below 60MB after keyboard opens

---

## 16. Troubleshooting

### "KickKeyApplication not found" in logcat

**Cause:** The config plugin did not set `android:name=".KickKeyApplication"` on the `<application>` tag.

**Fix:**
```bash
npx expo prebuild --platform android --clean
grep "android:name" android/app/src/main/AndroidManifest.xml | head -5
```

If still missing, check `plugins/withImeService.js` is listed in `app.json` → `plugins`.

---

### "keyboard.bundle not found" — app crashes on first keyboard open

**Cause:** `keyboard.bundle` was not built during prebuild.

**Fix:**
```bash
# Build the bundle manually
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify false

# Then rebuild the APK
cd android && ./gradlew assembleDebug
```

---

### KickKey doesn't appear in Android Settings → Manage keyboards

**Cause:** Either the `<service>` declaration is missing from the manifest, or `method.xml` is missing / malformed.

**Fix:**
```bash
# Check service is in manifest
grep -A 10 "KickKeyInputMethodService" android/app/src/main/AndroidManifest.xml

# Check method.xml exists
ls android/app/src/main/res/xml/
```

After fixing, rebuild and reinstall the APK. Android only rescans for new keyboards when a new APK is installed.

---

### White / blank keyboard view — no React Native content

**Cause:** `ReactHost` pre-warm failed, or `keyboard.bundle` failed to load.

**Fix:**
```bash
# Check for errors in Application logs
adb logcat -s KickKeyApplication

# Look for:
# E/KickKeyApplication: Failed to pre-warm keyboard ReactHost
# This usually means keyboard.bundle is missing or has a JS parse error
```

Build `keyboard.bundle` with `--minify false` to get readable error messages:
```bash
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify false
```

---

### `ReactHost` / `ReactHostBuilder` class not found (Kotlin compile error)

**Cause:** Wrong React Native version or missing dependency.

**Fix:** Ensure your `android/app/build.gradle` includes:
```groovy
implementation("com.facebook.react:react-android")
implementation("com.facebook.react:hermes-android")
```
And run `cd android && ./gradlew :app:dependencies | grep react` to confirm the classes are on the classpath.

---

### EAS build fails with "Plugin withKeyboardBundle failed"

**Cause:** `keyboard.index.js` has a syntax error, or `react-native bundle` is not available.

**Fix:**
```bash
# Test the bundle command locally first
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output /tmp/test.bundle \
  --platform android \
  --minify false

# Fix any JS errors shown in terminal, then retry EAS build
```

---

*Phase 1 complete. Proceed to Phase 2 — Core Input — to wire up real key presses, backspace, and InputConnection.*
