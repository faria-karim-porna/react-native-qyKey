# KickKey — M1 Implementation Guide
## Accessibility Service + Floating Panel

> **Platform:** Android Only · **Project:** `react-native-kickKey-deepseek` · **Milestone:** M1 · **Status:** READY TO IMPLEMENT
> Follows the approved plan: [`KickKey-Accessibility-Touchpad-Plan.md`](./KickKey-Accessibility-Touchpad-Plan.md)

---

## 1. What M1 Delivers

| From plan §26 | M1 — A11y service + panel |
|---|---|
| Scope | `KickKeyAccessibilityService`, `accessibility_service_config.xml`, config plugin, floating panel opens from the a11y button/shortcut with **no input field focused** |
| Exit criteria | ① Panel opens/closes · ② Keyboard ⇄ touchpad slider works inside the panel · ③ No input field required to open it |

**In one sentence:** after this milestone the user can enable "KickKey Accessibility" in system Settings, assign it to the **Accessibility button or shortcut**, tap it anywhere on the phone, and a floating KickKey keyboard panel appears on top of whatever app is open — with the existing keyboard/touchpad slider working inside it.

Everything else (RN cursor, cross-app clicks/scroll/back, pro mode, Play declarations) is explicitly **out of scope** — see §8.

---

## 2. Architecture Recap (what gets added)

```
:ime_process
├─ KickKeyInputMethodService (IME, existing — untouched)
├─ KickKeyAccessibilityService (NEW — same process, no IPC)
│    ├─ AccessibilityButtonCallback / toggleFloatingPanel() → show/hide panel
│    ├─ showFloatingPanel()  → TYPE_ACCESSIBILITY_OVERLAY window
│    │                        hosting ReactSurface "KickKeyOverlay"
│    ├─ hideFloatingPanel()  → remove window + stop surface
│    └─ resumeHostWhenReady() → resumes the keyboard ReactHost so
│                               Fabric mounts the panel's JS (same
│                               mechanism as the IME watchdog)
├─ KickKeyModule (bridge, extended)
│    └─ isAccessibilityEnabled / openAccessibilitySettings /
│       showFloatingPanel / hideFloatingPanel  (new @ReactMethods)
└─ keyboard.bundle (same Hermes bundle, new second root)
     ├─ "KickKeyKeyboard" (existing — IME surface)
     └─ "KickKeyOverlay"  (NEW — FloatingPanel.tsx: header + close
                           button + the full QykeyKeyboard)
```

**Key decisions (from the plan, already approved):**
- The a11y service runs in **`:ime_process`** (same process as the IME and the keyboard ReactHost) → the panel surface, the bridge module and the service all live together; **zero IPC**.
- The panel reuses the **pre-warmed keyboard ReactHost** and the **same `keyboard.bundle`** — registering a second root (`KickKeyOverlay`) is the only JS change needed.
- The panel is a **`TYPE_ACCESSIBILITY_OVERLAY`** window → no `SYSTEM_ALERT_WINDOW` permission needed when the service is enabled.
- The mount pipeline fix already in the bundle (module-scope `setInterval` pump) applies to the new root automatically.

---

## 3. Step-by-Step Implementation

### Step 1 — Create the accessibility service config XML

**New file:** `native-files/res/xml/accessibility_service_config.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<accessibility-service
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="true"
    android:accessibilityFlags="flagRequestAccessibilityButton|flagDefault"
    android:settingsActivity="com.kickkey.MainActivity" />
```

> `flagRequestAccessibilityButton` is what makes "KickKey Accessibility" available as an **Accessibility button** (on-screen/nav-bar) and assignable to the **Accessibility shortcut** (Volume+Power / three-finger gesture). `canPerformGestures` and `canRetrieveWindowContent` are declared now (needed in M3 for clicks/scroll) — harmless in M1, and the service is a "tool" for the user.

---

### Step 2 — Create the config plugin

**New file:** `plugins/withAccessibilityService.js` (mirrors `withImeService.js`)

```js
// plugins/withAccessibilityService.js
const { withAndroidManifest, withDangerousMod, withStringsXml, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin that:
 * 1. Copies res/xml/accessibility_service_config.xml into android/ during prebuild.
 * 2. Adds the @string/a11y_service_name label.
 * 3. Registers KickKeyAccessibilityService in the manifest (same :ime_process as the IME).
 *
 * NOTE: KickKeyAccessibilityService.kt is copied by withImeService.js (it copies the
 * whole native-files/java/com/kickkey/ directory), so this plugin only handles the
 * XML resource + manifest entry. Keep it listed AFTER withImeService in app.json.
 */
function withAccessibilityXmlCopy(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const srcXml = path.join(
        projectRoot, 'native-files', 'res', 'xml', 'accessibility_service_config.xml'
      );
      const targetDir = path.join(
        projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml'
      );
      if (fs.existsSync(srcXml)) {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(srcXml, path.join(targetDir, 'accessibility_service_config.xml'));
        console.log('[withAccessibilityService] Copied accessibility_service_config.xml');
      } else {
        console.warn('[withAccessibilityService] accessibility_service_config.xml not found — skipped');
      }
      return config;
    },
  ]);
}

module.exports = function withAccessibilityService(config) {
  config = withAccessibilityXmlCopy(config);

  config = withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'a11y_service_name' }, _: 'KickKey Accessibility' }],
      config.modResults
    );
    return config;
  });

  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) {
      throw new Error('withAccessibilityService: Could not find <application> in AndroidManifest.xml');
    }
    if (!application.service) application.service = [];

    // Avoid duplicates on repeated prebuild
    const alreadyRegistered = application.service.some(
      (s) => s.$?.['android:name'] === '.KickKeyAccessibilityService'
    );

    if (!alreadyRegistered) {
      application.service.push({
        $: {
          'android:name': '.KickKeyAccessibilityService',
          'android:label': '@string/a11y_service_name',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported': 'true',
          'android:process': ':ime_process', // same process as IME + keyboard host
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.accessibilityservice',
              'android:resource': '@xml/accessibility_service_config',
            },
          },
        ],
      });
      console.log('[withAccessibilityService] Registered KickKeyAccessibilityService');
    }

    return config;
  });
};
```

---

### Step 3 — Register the plugin in app.json

**Edit:** `app.json` → add `"./plugins/withAccessibilityService"` **after** `"./plugins/withImeService"` (order matters — `withImeService` copies the Kotlin sources, this plugin adds the manifest entry):

```json
"plugins": [
  "expo-router",
  "./plugins/withImeService",
  "./plugins/withKeyboardBundle",
  "./plugins/withAccessibilityService",
  "expo-speech-recognition"
]
```

---

### Step 4 — Create the accessibility service

**New file:** `native-files/java/com/kickkey/KickKeyAccessibilityService.kt`

```kotlin
package com.kickkey

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.FrameLayout
import com.facebook.react.ReactHost
import com.facebook.react.common.LifecycleState
import com.facebook.react.interfaces.TaskInterface
import com.facebook.react.interfaces.fabric.ReactSurface

/**
 * KickKey's accessibility service (M1).
 *
 * Entry points:
 *  - The user assigns KickKey to the Accessibility button / shortcut
 *    (flagRequestAccessibilityButton in accessibility_service_config.xml).
 *    Tapping it fires [onAccessibilityButtonClicked] and toggles the
 *    floating panel — no input field is required.
 *  - The touchpad JS can also open/close the panel via KickKeyModule
 *    (same :ime_process, so the singleton is reachable without IPC).
 *
 * The floating panel is a TYPE_ACCESSIBILITY_OVERLAY window hosting the
 * "KickKeyOverlay" React surface from the pre-warmed keyboard ReactHost
 * (same Hermes bundle as the IME keyboard).
 *
 * Security/design rules (plan §18): the service performs NO data
 * collection. It only reacts to explicit user actions and renders the
 * panel. It does not read window content, filter key events, or request
 * touch exploration. onAccessibilityEvent stays a required no-op.
 */
class KickKeyAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "KickKeyA11y"

        // Panel = keyboard height + a slim header row. Same keyboard height
        // constant as the IME (KEYBOARD_HEIGHT_DP in KickKeyInputMethodService).
        private const val PANEL_MARGIN_DP = 12
        private const val PANEL_HEIGHT_DP = 300

        // Singleton so KickKeyModule (same :ime_process) reaches the service
        // without any IPC. @Volatile: written on the system binder thread
        // (onServiceConnected), read on the main thread.
        @Volatile
        var instance: KickKeyAccessibilityService? = null
            private set
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    private var panelSurface: ReactSurface? = null
    private var panelContainer: FrameLayout? = null
    private var panelSurfaceTask: TaskInterface<Void>? = null
    private var isPanelShowing = false

    private val panelMarginPx: Int
        get() = (PANEL_MARGIN_DP * resources.displayMetrics.density).toInt()
    private val panelWidthPx: Int
        get() = (resources.displayMetrics.widthPixels - 2 * panelMarginPx).coerceAtLeast(1)
    private val panelHeightPx: Int
        get() = (PANEL_HEIGHT_DP * resources.displayMetrics.density).toInt()

    // ── Service lifecycle ──────────────────────────────────────────────────

    private var buttonCallback: Any? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i(TAG, "Accessibility service connected")

        // Register callback for the on-screen / nav-bar Accessibility button (API 26+)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            try {
                val callback = object : android.accessibilityservice.AccessibilityButtonController.AccessibilityButtonCallback() {
                    override fun onClicked(controller: android.accessibilityservice.AccessibilityButtonController) {
                        Log.i(TAG, "Accessibility button clicked — toggling floating panel")
                        toggleFloatingPanel()
                    }

                    override fun onAvailabilityChanged(
                        controller: android.accessibilityservice.AccessibilityButtonController,
                        available: Boolean
                    ) {
                        Log.i(TAG, "Accessibility button availability changed: $available")
                    }
                }
                accessibilityButtonController.registerAccessibilityButtonCallback(callback)
                buttonCallback = callback
                Log.i(TAG, "Registered AccessibilityButtonCallback")
            } catch (e: Exception) {
                Log.w(TAG, "Failed to register AccessibilityButtonCallback: ${e.message}")
            }
        }
    }

    // Required override. Intentionally empty — the service does not consume
    // window content (no data collection, plan §18).
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    }

    // Required override.
    override fun onInterrupt() {
    }

    override fun onUnbind(intent: Intent?): Boolean {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            (buttonCallback as? android.accessibilityservice.AccessibilityButtonController.AccessibilityButtonCallback)?.let {
                try {
                    accessibilityButtonController.unregisterAccessibilityButtonCallback(it)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to unregister AccessibilityButtonCallback: ${e.message}")
                }
            }
            buttonCallback = null
        }
        hideFloatingPanel()
        instance = null
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        hideFloatingPanel()
        instance = null
        super.onDestroy()
    }

    // ── Floating panel toggle ──────────────────────────────────────────────

    fun toggleFloatingPanel() {
        mainHandler.post {
            if (isPanelShowing) hideFloatingPanel() else showFloatingPanel()
        }
    }

    // ── Floating panel ─────────────────────────────────────────────────────

    fun isPanelVisible(): Boolean = isPanelShowing

    fun showFloatingPanel() {
        if (isPanelShowing) return
        val app = application as? KickKeyApplication ?: run {
            Log.e(TAG, "KickKeyApplication not found — cannot create panel")
            return
        }

        try {
            val host = app.keyboardReactHost

            // Second surface from the SAME host + bundle as the IME keyboard.
            // The name must match the AppRegistry registration in keyboard.index.js.
            val surface = host.createSurface(this, "KickKeyOverlay", null)
            panelSurfaceTask = surface.start()
            panelSurface = surface

            val container = FrameLayout(this).apply {
                layoutParams = FrameLayout.LayoutParams(panelWidthPx, panelHeightPx)
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
            }
            surface.view?.let { view ->
                container.addView(
                    view,
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                )
            }

            val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
            val params = WindowManager.LayoutParams(
                panelWidthPx,
                panelHeightPx,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or      // never steal keyboard focus
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or // touches outside pass through
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            ).apply {
                // Position: bottom-center of the screen. x/y are absolute screen
                // coordinates with gravity TOP|START (dragging arrives later).
                gravity = Gravity.TOP or Gravity.START
                x = panelMarginPx
                y = resources.displayMetrics.heightPixels - panelHeightPx - panelMarginPx
            }

            wm.addView(container, params)
            panelContainer = container
            isPanelShowing = true

            // Fabric needs the host RESUMED to apply mount items (the exact same
            // mechanism the IME watchdog uses). Poll until the JS signals
            // readiness (keyboardReady), then resume — idempotent if already up.
            resumeHostWhenReady(host, 0)
            Log.i(TAG, "Floating panel shown (${panelWidthPx}x${panelHeightPx})")
        } catch (e: Throwable) {
            Log.e(TAG, "showFloatingPanel failed", e)
        }
    }

    fun hideFloatingPanel() {
        if (!isPanelShowing) return
        isPanelShowing = false
        try {
            panelContainer?.let {
                (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(it)
            }
        } catch (e: Exception) {
            Log.w(TAG, "hideFloatingPanel: removeView failed: ${e.message}")
        }
        panelContainer = null
        try {
            panelSurface?.stop()
        } catch (e: Exception) {
            Log.w(TAG, "hideFloatingPanel: surface stop failed: ${e.message}")
        }
        panelSurface = null
        panelSurfaceTask = null
        Log.i(TAG, "Floating panel hidden")
    }

    /**
     * Polls (50ms × up to 600 ≈ 30s) for the keyboard JS mount signal, then
     * resumes the keyboard ReactHost so Fabric's DispatchUIFrameCallback starts
     * applying mount items to the panel surface. Mirrors the IME's
     * scheduleJsReadyResume() in KickKeyInputMethodService, simplified for M1.
     */
    private fun resumeHostWhenReady(host: ReactHost, attempt: Int) {
        if (!isPanelShowing) return
        if (attempt >= 600) {
            Log.w(TAG, "Panel: JS never signalled readiness — panel may stay blank (see Troubleshooting §7)")
            return
        }
        mainHandler.postDelayed({
            if (!isPanelShowing) return@postDelayed
            // Idempotent: if the IME already resumed the host, we're done.
            if (host.lifecycleState == LifecycleState.RESUMED) return@postDelayed
            if (KickKeyModule.keyboardJsReady) {
                try {
                    host.onHostResume(null)
                    Log.i(TAG, "Panel: host resumed (lifecycle=${host.lifecycleState})")
                } catch (e: Exception) {
                    Log.w(TAG, "Panel: host resume failed: ${e.message}")
                    resumeHostWhenReady(host, attempt + 1)
                }
            } else {
                resumeHostWhenReady(host, attempt + 1)
            }
        }, 50)
    }
}
```

---

### Step 5 — Extend `KickKeyModule.kt`

**Edit:** `native-files/java/com/kickkey/KickKeyModule.kt`

**5a.** Add two imports (top of file, with the other `android.*` imports):

```kotlin
import android.accessibilityservice.AccessibilityServiceInfo
import android.view.accessibility.AccessibilityManager
```

**5b.** Add these four `@ReactMethod`s (append at the end of the class, after `openOverlaySettings`):

```kotlin
// ── Accessibility service (M1) ──────────────────────────────────────────

/**
 * Resolves true when KickKeyAccessibilityService is enabled in the system
 * accessibility settings. Works from any process (reads AccessibilityManager +
 * Settings.Secure fallback; the a11y service singleton itself only exists in :ime_process).
 */
@ReactMethod
fun isAccessibilityEnabled(promise: Promise) {
    val context = reactApplicationContext
    val am = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
    val enabledViaManager = am
        ?.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        ?.any { info ->
            val sInfo = info.resolveInfo?.serviceInfo
            (sInfo?.packageName == context.packageName &&
                (sInfo.name == "com.kickkey.KickKeyAccessibilityService" ||
                 sInfo.name?.endsWith("KickKeyAccessibilityService") == true)) ||
            info.id?.contains("KickKeyAccessibilityService") == true
        }
        ?: false

    // Fallback via Settings.Secure (mirrors isKeyboardEnabled check)
    val enabledViaSecure = if (!enabledViaManager) {
        val raw = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: ""
        raw.contains("KickKeyAccessibilityService")
    } else false

    promise.resolve(enabledViaManager || enabledViaSecure)
}

/** Deep-links to the system accessibility settings so the user can enable KickKey. */
@ReactMethod
fun openAccessibilitySettings(promise: Promise) {
    try {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
    } catch (e: Exception) {
        Log.w("KickKeyModule", "openAccessibilitySettings failed: ${e.message}")
    }
    promise.resolve(null)
}

/**
 * Shows the floating KickKey panel. Only meaningful in :ime_process (where the
 * a11y service singleton lives); resolves without error elsewhere.
 */
@ReactMethod
fun showFloatingPanel(promise: Promise) {
    Handler(Looper.getMainLooper()).post {
        KickKeyAccessibilityService.instance?.showFloatingPanel()
    }
    promise.resolve(null)
}

/** Hides the floating KickKey panel (used by the panel's own close button). */
@ReactMethod
fun hideFloatingPanel(promise: Promise) {
    Handler(Looper.getMainLooper()).post {
        KickKeyAccessibilityService.instance?.hideFloatingPanel()
    }
    promise.resolve(null)
}
```

> All view-touching calls are posted to the main thread (same pattern as the existing `pointerShow/pointerMove/pointerHide`).

---

### Step 6 — Register the overlay root in the keyboard bundle

**Edit:** `keyboard.index.js`

**6a.** Add the import (next to the `KeyboardScreen` import):

```js
import FloatingPanel from './src/keyboard/overlay/FloatingPanel';
```

**6b.** Register the second root at the bottom of the file (after the `KickKeyKeyboard` registration):

```js
/**
 * Register the floating-panel component for the accessibility service.
 * The name 'KickKeyOverlay' MUST match the second argument of
 * host.createSurface() in KickKeyAccessibilityService.kt
 */
AppRegistry.registerComponent('KickKeyOverlay', () => FloatingPanel);
```

> No build-script change: `scripts/build-keyboard-bundle.js` bundles from `keyboard.index.js`, so the second root ships inside the same `keyboard.bundle`. The module-scope mount-pump interval applies to every root in the bundle automatically.

---

### Step 7 — Create `FloatingPanel.tsx` (+ the close icon)

**New file:** `src/keyboard/overlay/FloatingPanel.tsx`

```tsx
// ============================================================
// FloatingPanel.tsx — root of the "KickKeyOverlay" React surface
// (the floating keyboard/touchpad panel opened from the
// accessibility button/shortcut — no input field required).
//
// M1 scope: a slim header with a close (✕) button + the full
// QykeyKeyboard (keyboard ⇄ touchpad slider works unchanged).
// Dragging the panel arrives in a later milestone.
// ============================================================

import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, NativeModules } from 'react-native';
import QykeyKeyboard from '../qykey/QykeyKeyboard';
import ErrorBoundary from '../ErrorBoundary';
import { FA5Icon } from '../qykey/icons';

export default function FloatingPanel() {
  // Same readiness signal the IME surface sends: lets native know the JS
  // mounted so the ReactHost can be resumed (Fabric mount pipeline).
  useEffect(() => {
    try {
      const p = NativeModules.KickKey?.keyboardReady?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
      console.warn('[KickKey] FloatingPanel keyboardReady failed:', e);
    }
  }, []);

  const close = () => {
    try {
      NativeModules.KickKey?.hideFloatingPanel?.();
    } catch (e) {
      console.warn('[KickKey] hideFloatingPanel failed:', e);
    }
  };

  return (
    <ErrorBoundary>
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title}>KickKey</Text>
          <Pressable onPress={close} hitSlop={10} style={styles.closeBtn}>
            <FA5Icon name="times" size={14} color="#888" />
          </Pressable>
        </View>
        <View style={styles.body}>
          <QykeyKeyboard />
        </View>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: '#e0e5ec',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#abb2b9',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  header: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: '#d0d7de',
    borderBottomWidth: 1,
    borderBottomColor: '#abb2b9',
  },
  title: { fontSize: 11, fontWeight: '700', color: '#444', letterSpacing: 0.5 },
  closeBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
});
```

**Edit:** `src/keyboard/qykey/icons.tsx` — the close (✕) button needs the FA5 `times` glyph. Add it to `FA_PATHS` (next to `hamburger`):

```ts
  times: {
    width: 352,
    d: 'M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.19 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.19 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z',
  },
```

---

### Step 8 — Add typed wrappers to the bridge module

**Edit:** `modules/kickkey-module/index.ts` — append at the end of the exported object:

```ts
  // ── Accessibility service (M1) ──────────────────────────────────────────

  /** True when KickKeyAccessibilityService is enabled in system accessibility settings. */
  isAccessibilityEnabled: (): Promise<boolean> => KickKey.isAccessibilityEnabled(),

  /** Deep-links to the system accessibility settings screen. */
  openAccessibilitySettings: (): Promise<void> => KickKey.openAccessibilitySettings(),

  /** Shows the floating KickKey panel (a11y service process only). */
  showFloatingPanel: (): Promise<void> => KickKey.showFloatingPanel(),

  /** Hides the floating KickKey panel (used by the panel's close button). */
  hideFloatingPanel: (): Promise<void> => KickKey.hideFloatingPanel(),
```

---

### Step 9 — Add the Accessibility section to the Settings screen

**Edit:** `app/(tabs)/settings.tsx`

**9a.** Add imports at the top (include `AppState` and `Pressable`):

```tsx
import { useEffect, useState } from 'react';
import { AppState, Pressable } from 'react-native';
import KickKey from '../../modules/kickkey-module';
```

**9b.** Inside the component, read the service status on mount AND refresh whenever the user returns from system Settings:

```tsx
export default function SettingsScreen() {
  const [a11yEnabled, setA11yEnabled] = useState<boolean | null>(null);

  const checkA11yStatus = () => {
    KickKey.isAccessibilityEnabled()
      .then((ok) => setA11yEnabled(ok))
      .catch(() => {});
  };

  useEffect(() => {
    checkA11yStatus();
    // Re-check when returning to the app after toggling in system Settings
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkA11yStatus();
    });
    return () => sub.remove();
  }, []);
  // ...existing selectors...
```

**9c.** Add the section UI (after the existing "Typing" card, before the footnote):

```tsx
        <Text style={styles.sectionLabel}>Accessibility</Text>
        <View style={styles.card}>
          <View style={styles.a11yRow}>
            <Text style={styles.a11yLabel}>Accessibility Service</Text>
            <Text style={[styles.a11yValue, { color: a11yEnabled ? '#4caf50' : '#f44336' }]}>
              {a11yEnabled === null ? 'Checking…' : a11yEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          <Pressable
            style={styles.a11yButton}
            onPress={() => KickKey.openAccessibilitySettings()}
          >
            <Text style={styles.a11yButtonText}>Open Accessibility Settings</Text>
          </Pressable>
          {a11yEnabled === false && (
            <Text style={styles.a11yHint}>
              Enable “KickKey Accessibility”, then assign it to the Accessibility
              button or shortcut to open the floating panel anywhere — no input
              field needed.
            </Text>
          )}
        </View>
```

**9d.** Add the styles to the `StyleSheet.create({...})`:

```ts
  a11yRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  a11yLabel: { color: '#fff', fontSize: 15 },
  a11yValue: { fontSize: 13, fontWeight: '600' },
  a11yButton: {
    backgroundColor: '#1e2a5a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  a11yButtonText: { color: '#8ab4f8', fontSize: 14, fontWeight: '700' },
  a11yHint: { color: '#888', fontSize: 12, lineHeight: 17, paddingBottom: 12 },
```

---

## 4. Build & Install

```bash
cd react-native-kickKey-deepseek

# 1. Rebuild the keyboard bundle (now contains BOTH roots: KickKeyKeyboard + KickKeyOverlay)
node scripts/build-keyboard-bundle.js

# 2. Regenerate the android project (runs withImeService + withAccessibilityService)
npx expo prebuild --platform android

# 3. Verify the plugin output
grep -n "KickKeyAccessibilityService" android/app/src/main/AndroidManifest.xml
ls android/app/src/main/res/xml/accessibility_service_config.xml
ls android/app/src/main/java/com/kickkey/KickKeyAccessibilityService.kt

# 4. Build & install the dev build
npx expo run:android
```

> If `android/` already exists and the manifest/xml did NOT get updated by prebuild (Expo can skip regenerating an existing folder), run `npx expo prebuild --platform android --clean` once. ⚠️ This wipes and regenerates `android/` from `app.json` + plugins — safe here because all native changes come from the config plugins, but do it knowingly.

---

## 5. Device Setup (once per device)

1. **Open the app** once (any screen) so the `:ime_process` and pre-warmed keyboard host are initialized.
2. **Settings → Accessibility** (on Android 13+ sideloaded builds: Settings → Apps → Special app access → Accessibility settings).
3. Under **Downloaded services / Installed apps**, tap **KickKey Accessibility** → toggle **ON** → confirm in the system dialog.
4. **(Recommended) Assign the entry point** — either:
   - **Accessibility button**: Settings → Accessibility → **Accessibility button** → enable; or
   - **Accessibility shortcut**: Settings → Accessibility → **Accessibility shortcut** → assign KickKey (Volume+Power hold, or three-finger gesture).

Now tap the on-screen accessibility button (floating circle) or use the assigned shortcut **from anywhere** — the floating KickKey panel opens.

---

## 6. Manual Test Script (M1 exit criteria)

| # | Step | Expected |
|---|---|---|
| 1 | On the **home screen** (no input field focused), tap the accessibility button / use the shortcut | Floating KickKey panel appears |
| 2 | Panel shows the keyboard (QWERTY, with slider at top-left) | — |
| 3 | Toggle the **slider** (top-left) | Switches to the touchpad view (existing touchpad UI) |
| 4 | Toggle the slider again | Switches back to the keyboard |
| 5 | Tap the **✕** close button | Panel closes; the app underneath is unchanged |
| 6 | Trigger the accessibility button/shortcut again | Panel reopens |
| 7 | Repeat steps 1–6 **inside another app** (e.g., Settings, a browser) with no field focused | Same behavior — no input field required |
| 8 | Optional: with a text field focused **and KickKey the active keyboard**, open the panel and press keys | Keys commit into the field (existing IME connection) |
| 9 | `adb logcat | grep -E "KickKeyA11y|KickKeyIME"` during open/close | No errors; `Floating panel shown/hidden` logs |

**Pass = all of 1–7 work with no input field focused at any point.**

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Service not listed in Settings → Accessibility | Config XML not copied / manifest entry missing | Re-run `npx expo prebuild` (or `--clean`); verify `accessibility_service_config.xml` + manifest entry exist (§4 step 3) |
| Service listed but "button click does nothing" | Button/shortcut not assigned to KickKey, or `flagRequestAccessibilityButton` missing | Re-check §5 step 4; verify the flag in the config XML |
| Panel opens but is **blank** | Host never resumed (JS ready signal not received) | Check `adb logcat \| grep KickKeyA11y` for "host resumed" / "never signalled readiness". Rebuild the bundle (`node scripts/build-keyboard-bundle.js`) — a stale bundle without the `KickKeyOverlay` root shows an AppRegistry "not registered" warning |
| "Component KickKeyOverlay not registered" in logcat | Bundle built before Step 6 | Rebuild bundle + reinstall |
| Panel opens **behind** other windows (OEM quirk) | OEM overlay handling | Test with the system accessibility button (highest z-order); log the issue — this is the known OEM edge from plan §24 |
| Android 13 "Restricted settings" blocks enabling the service | Sideloaded install | Use the Settings → Apps → Special app access → Accessibility path (§5 step 2) |
| Panel closes instantly after opening | `onUnbind`/`onDestroy` fired (service disabled or process killed) | Re-enable the service; check logcat for `onUnbind` |

---

## 8. Explicitly Out of Scope for M1 (deferred)

| Milestone | Deferred work |
|---|---|
| M2 | RN cursor surface (`KickKeyPointer`), re-point `pointerMove` to it, full-screen clamping, remove the `ImageView` bitmap pointer |
| M3 | `dispatchGesture` clicks/scroll/back via the service, IME strip mode, touchpad button rewiring |
| M4 | Pro mode (`INJECT_EVENTS`), in-app "Open panel" entry via notification/cross-process signaling, permission flows polish |
| M5 | `isAccessibilityTool`, Play Console declaration, privacy-policy section, watchdog for new surfaces, lazy pre-warm |

Also intentionally **not** in M1:
- Dragging the panel around the screen (position is fixed bottom-center).
- Making the panel non-focusable typing work when no field is focused (impossible for any IME — keys need an input connection; that's what M3's touchpad gestures are for).
- Any changes to the existing IME touchpad behavior.

---

## 9. Definition of Done

- [ ] `accessibility_service_config.xml` exists in `native-files/res/xml/`
- [ ] `plugins/withAccessibilityService.js` exists and is listed **after** `withImeService` in `app.json`
- [ ] `KickKeyAccessibilityService.kt` exists in `native-files/java/com/kickkey/`
- [ ] `KickKeyModule.kt` has `isAccessibilityEnabled`, `openAccessibilitySettings`, `showFloatingPanel`, `hideFloatingPanel`
- [ ] `keyboard.index.js` registers `KickKeyOverlay`; `FloatingPanel.tsx` exists; `times` icon added
- [ ] `modules/kickkey-module/index.ts` has the four typed wrappers
- [ ] Settings screen shows the Accessibility status + deep-link button
- [ ] `node scripts/build-keyboard-bundle.js` + `npx expo prebuild --platform android` succeed; manifest + xml verified
- [ ] Full §6 test script passes (panel opens/closes, slider works, no input field required)
- [ ] Logcat clean of `KickKeyA11y` errors during the test run

**On completion of all checks → proceed to M2 (RN cursor + movement).**
