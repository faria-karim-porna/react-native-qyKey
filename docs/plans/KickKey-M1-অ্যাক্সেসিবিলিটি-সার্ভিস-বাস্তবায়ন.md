# KickKey — M1 বাস্তবায়ন গাইড
## Accessibility সার্ভিস + ফ্লোটিং প্যানেল

> **প্ল্যাটফর্ম:** শুধুমাত্র Android · **প্রজেক্ট:** `react-native-kickKey-deepseek` · **মাইলফলক:** M1 · **অবস্থা:** বাস্তবায়নের জন্য প্রস্তুত
> অনুমোদিত পরিকল্পনা অনুসরণ করে: [`KickKey-অ্যাক্সেসিবিলিটি-টাচপ্যাড-পরিকল্পনা.md`](./KickKey-অ্যাক্সেসিবিলিটি-টাচপ্যাড-পরিকল্পনা.md)

---

## 1. M1 কী দেবে

| পরিকল্পনা §২৬ থেকে | M1 — A11y সার্ভিস + প্যানেল |
|---|---|
| পরিধি | `KickKeyAccessibilityService`, `accessibility_service_config.xml`, কনফিগ প্লাগইন, a11y বাটন/শর্টকাট থেকে **ইনপুট ফিল্ড ফোকাস ছাড়াই** ফ্লোটিং প্যানেল খোলা |
| প্রস্থানের মানদণ্ড | ① প্যানেল খোলে/বন্ধ হয় · ② প্যানেলের ভেতরে কীবোর্ড ⇄ টাচপ্যাড স্লাইডার কাজ করে · ③ খুলতে কোনো ইনপুট ফিল্ড লাগে না |

**এক বাক্যে:** এই মাইলফলকের পর ব্যবহারকারী সিস্টেম Settings-এ "KickKey Accessibility" চালু করে, এটিকে **Accessibility বাটন বা শর্টকাটে** বরাদ্দ করে, ফোনের যেকোনো জায়গায় ট্যাপ করলে — খোলা অ্যাপের উপরে ফ্লোটিং KickKey কীবোর্ড প্যানেল দেখা যায় — ভেতরে বিদ্যমান কীবোর্ড/টাচপ্যাড স্লাইডার কাজ করে।

বাকি সবকিছু (RN cursor, ক্রস-অ্যাপ ক্লিক/স্ক্রল/ব্যাক, pro mode, Play ঘোষণা) স্পষ্টভাবে **পরিধির বাইরে** — §৮ দেখুন।

---

## 2. আর্কিটেকচার রিক্যাপ (কী যোগ হবে)

```
:ime_process
├─ KickKeyInputMethodService (IME, বর্তমান — অপরিবর্তিত)
├─ KickKeyAccessibilityService (NEW — একই প্রসেস, কোনো IPC নেই)
│    ├─ AccessibilityButtonCallback / toggleFloatingPanel() → প্যানেল দেখায়/লুকায়
│    ├─ showFloatingPanel()  → TYPE_ACCESSIBILITY_OVERLAY উইন্ডো
│    │                        যেখানে ReactSurface "KickKeyOverlay" থাকে
│    ├─ hideFloatingPanel()  → উইন্ডো সরায় + surface বন্ধ করে
│    └─ resumeHostWhenReady() → কীবোর্ড ReactHost রিজিউম করে যেন
│                               Fabric প্যানেলের JS মাউন্ট করে
│                               (IME ওয়াচডগের মতোই প্রক্রিয়া)
├─ KickKeyModule (ব্রিজ, বর্ধিত)
│    └─ isAccessibilityEnabled / openAccessibilitySettings /
│       showFloatingPanel / hideFloatingPanel  (নতুন @ReactMethod)
└─ keyboard.bundle (একই Hermes বান্ডেল, নতুন দ্বিতীয় রুট)
     ├─ "KickKeyKeyboard" (বর্তমান — IME surface)
     └─ "KickKeyOverlay"  (NEW — FloatingPanel.tsx: হেডার + ক্লোজ
                           বাটন + সম্পূর্ণ QykeyKeyboard)
```

**মূল সিদ্ধান্ত (পরিকল্পনা থেকে, ইতিমধ্যে অনুমোদিত):**
- a11y সার্ভিস **`:ime_process`**-এ চলে (IME ও কীবোর্ড ReactHost-এর মতো একই প্রসেস) → প্যানেল surface, ব্রিজ মডিউল ও সার্ভিস সব একসাথে; **শূন্য IPC**।
- প্যানেল **প্রি-ওয়ার্মড কীবোর্ড ReactHost** ও **একই `keyboard.bundle`** পুনরায় ব্যবহার করে — দ্বিতীয় রুট (`KickKeyOverlay`) নিবন্ধনই একমাত্র JS পরিবর্তন।
- প্যানেল একটি **`TYPE_ACCESSIBILITY_OVERLAY`** উইন্ডো → সার্ভিস সক্রিয় থাকলে `SYSTEM_ALERT_WINDOW` অনুমতি লাগে না।
- বান্ডেলে আগে থেকে থাকা মাউন্ট-পাইপলাইন ফিক্স (মডিউল-স্কোপ `setInterval` পাম্প) নতুন রুটে স্বয়ংক্রিয়ভাবে প্রযোজ্য।

---

## 3. ধাপে ধাপে বাস্তবায়ন

### ধাপ ১ — Accessibility সার্ভিস কনফিগ XML তৈরি করুন

**নতুন ফাইল:** `native-files/res/xml/accessibility_service_config.xml`

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

> `flagRequestAccessibilityButton`-ই "KickKey Accessibility"-কে **Accessibility বাটন** (অন-স্ক্রিন/নেভ-বার) হিসেবে ও **Accessibility শর্টকাটে** (Volume+Power / তিন-আঙুলের জেসচার) বরাদ্দযোগ্য করে। `canPerformGestures` ও `canRetrieveWindowContent` এখনই ঘোষণা করা হলো (M3-তে ক্লিক/স্ক্রলের জন্য লাগবে) — M1-এ ক্ষতিকর নয়, এবং সার্ভিসটি ব্যবহারকারীর জন্য একটি "টুল"।

---

### ধাপ ২ — কনফিগ প্লাগইন তৈরি করুন

**নতুন ফাইল:** `plugins/withAccessibilityService.js` (`withImeService.js`-এর আদলে)

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

### ধাপ ৩ — app.json-এ প্লাগইন নিবন্ধন করুন

**সম্পাদনা:** `app.json` → `"./plugins/withAccessibilityService"` যোগ করুন **`"./plugins/withImeService"`-এর পরে** (অর্ডার গুরুত্বপূর্ণ — `withImeService` Kotlin সোর্স কপি করে, এই প্লাগইন ম্যানিফেস্ট এন্ট্রি যোগ করে):

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

### ধাপ ৪ — Accessibility সার্ভিস তৈরি করুন

**নতুন ফাইল:** `native-files/java/com/kickkey/KickKeyAccessibilityService.kt`

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

        // অন-স্ক্রিন / নেভ-বার Accessibility বাটনের জন্য কলব্যাক রেজিস্টার (API 26+)
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

### ধাপ ৫ — `KickKeyModule.kt` বাড়ান

**সম্পাদনা:** `native-files/java/com/kickkey/KickKeyModule.kt`

**৫ক.** দুটি ইমপোর্ট যোগ করুন (ফাইলের উপরে, অন্য `android.*` ইমপোর্টের সাথে):

```kotlin
import android.accessibilityservice.AccessibilityServiceInfo
import android.view.accessibility.AccessibilityManager
```

**৫খ.** এই চারটি `@ReactMethod` যোগ করুন (ক্লাসের শেষে, `openOverlaySettings`-এর পরে):

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

> ভিউ-স্পর্শকারী সব কল মূল থ্রেডে পোস্ট করা হয় (বিদ্যমান `pointerShow/pointerMove/pointerHide`-এর মতোই প্যাটার্ন)।

---

### ধাপ ৬ — কীবোর্ড বান্ডেলে ওভারলে রুট নিবন্ধন করুন

**সম্পাদনা:** `keyboard.index.js`

**৬ক.** ইমপোর্ট যোগ করুন (`KeyboardScreen` ইমপোর্টের পাশে):

```js
import FloatingPanel from './src/keyboard/overlay/FloatingPanel';
```

**৬খ.** ফাইলের নিচে ( `KickKeyKeyboard` নিবন্ধনের পরে) দ্বিতীয় রুট নিবন্ধন করুন:

```js
/**
 * Register the floating-panel component for the accessibility service.
 * The name 'KickKeyOverlay' MUST match the second argument of
 * host.createSurface() in KickKeyAccessibilityService.kt
 */
AppRegistry.registerComponent('KickKeyOverlay', () => FloatingPanel);
```

> বিল্ড-স্ক্রিপ্ট পরিবর্তনের দরকার নেই: `scripts/build-keyboard-bundle.js` `keyboard.index.js` থেকে বান্ডেল করে, তাই দ্বিতীয় রুট একই `keyboard.bundle`-এর ভেতরে চলে আসে। মডিউল-স্কোপ মাউন্ট-পাম্প ইন্টারভাল বান্ডেলের প্রতিটি রুটে স্বয়ংক্রিয়ভাবে প্রযোজ্য।

---

### ধাপ ৭ — `FloatingPanel.tsx` তৈরি করুন (+ ক্লোজ আইকন)

**নতুন ফাইল:** `src/keyboard/overlay/FloatingPanel.tsx`

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

**সম্পাদনা:** `src/keyboard/qykey/icons.tsx` — ক্লোজ (✕) বাটনের জন্য FA5 `times` গ্লিফ লাগবে। `FA_PATHS`-এ যোগ করুন (`hamburger`-এর পাশে):

```ts
  times: {
    width: 352,
    d: 'M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.19 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.19 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z',
  },
```

---

### ধাপ ৮ — ব্রিজ মডিউলে টাইপড র‍্যাপার যোগ করুন

**সম্পাদনা:** `modules/kickkey-module/index.ts` — এক্সপোর্টেড অবজেক্টের শেষে যোগ করুন:

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

### ধাপ ৯ — Settings স্ক্রিনে Accessibility সেকশন যোগ করুন

**সম্পাদনা:** `app/(tabs)/settings.tsx`

**৯ক.** উপরে ইমপোর্ট যোগ করুন (`AppState` এবং `Pressable` সহ):

```tsx
import { useEffect, useState } from 'react';
import { AppState, Pressable } from 'react-native';
import KickKey from '../../modules/kickkey-module';
```

**৯খ.** কম্পোনেন্টের ভেতরে, মাউন্টে সার্ভিস স্ট্যাটাস পড়ুন এবং সিস্টেম Settings থেকে ফিরে আসার সাথে সাথে পুনরায় স্ট্যাটাস রিফ্রেশ করুন:

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
    // সিস্টেম Settings-এ টগল করে অ্যাপে ফিরে আসলে আবার চেক করা
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkA11yStatus();
    });
    return () => sub.remove();
  }, []);
  // ...বিদ্যমান সিলেক্টর...
```

**৯গ.** সেকশন UI যোগ করুন (বিদ্যমান "Typing" কার্ডের পরে, ফুটনোটের আগে):

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

**৯ঘ.** `StyleSheet.create({...})`-এ স্টাইল যোগ করুন:

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

## 4. বিল্ড ও ইনস্টল

```bash
cd react-native-kickKey-deepseek

# 1. কীবোর্ড বান্ডেল পুনর্নির্মাণ (এবার দুটি রুটই আছে: KickKeyKeyboard + KickKeyOverlay)
node scripts/build-keyboard-bundle.js

# 2. android প্রজেক্ট পুনর্নির্মাণ (withImeService + withAccessibilityService চালায়)
npx expo prebuild --platform android

# 3. প্লাগইন আউটপুট যাচাই
grep -n "KickKeyAccessibilityService" android/app/src/main/AndroidManifest.xml
ls android/app/src/main/res/xml/accessibility_service_config.xml
ls android/app/src/main/java/com/kickkey/KickKeyAccessibilityService.kt

# 4. ডেভ বিল্ড তৈরি ও ইনস্টল
npx expo run:android
```

> `android/` ইতিমধ্যে থাকলে এবং prebuild-এ ম্যানিফেস্ট/XML আপডেট না হলে (Expo বিদ্যমান ফোল্ডার পুনর্নির্মাণ এড়াতে পারে), একবার `npx expo prebuild --platform android --clean` চালান। ⚠️ এটি `android/` মুছে `app.json` + প্লাগইন থেকে পুনর্নির্মাণ করে — এখানে নিরাপদ কারণ সব নেটিভ পরিবর্তন কনফিগ প্লাগইন থেকে আসে, তবে জেনে বুঝে করবেন।

---

## 5. ডিভাইস সেটআপ (প্রতি ডিভাইসে একবার)

1. **অ্যাপটি একবার খুলুন** (যেকোনো স্ক্রিন) যেন `:ime_process` ও প্রি-ওয়ার্মড কীবোর্ড হোস্ট ইনিশিয়ালাইজ হয়।
2. **Settings → Accessibility** (Android 13+ সাইডলোডেড বিল্ডে: Settings → Apps → Special app access → Accessibility settings)।
3. **Downloaded services / Installed apps**-এর নিচে **KickKey Accessibility** ট্যাপ করুন → টগল **ON** → সিস্টেম ডায়ালগে নিশ্চিত করুন।
4. **(প্রস্তাবিত) এন্ট্রি পয়েন্ট বরাদ্দ করুন** — যেকোনো একটি:
   - **Accessibility button**: Settings → Accessibility → **Accessibility button** → চালু করুন; অথবা
   - **Accessibility shortcut**: Settings → Accessibility → **Accessibility shortcut** → KickKey বরাদ্দ করুন (Volume+Power ধরে রাখা, বা তিন-আঙুলের জেসচার)।

এবার **যেকোনো জায়গা থেকে** অন-স্ক্রিন accessibility বাটন (ফ্লোটিং সার্কেল) ট্যাপ করুন বা বরাদ্দকৃত শর্টকাট ব্যবহার করুন — ফ্লোটিং KickKey প্যানেল খুলবে।

---

## 6. ম্যানুয়াল টেস্ট স্ক্রিপ্ট (M1 প্রস্থানের মানদণ্ড)

| # | ধাপ | প্রত্যাশিত |
|---|---|---|
| 1 | **হোম স্ক্রিনে** (কোনো ইনপুট ফিল্ড ফোকাস নেই), accessibility বাটন/শর্টকাট ট্যাপ করুন | ফ্লোটিং KickKey প্যানেল দেখা যায় |
| 2 | প্যানেলে কীবোর্ড (QWERTY, উপরে-বামে স্লাইডারসহ) | — |
| 3 | **স্লাইডার** টগল করুন (উপরে-বাম) | টাচপ্যাড ভিউতে যায় (বিদ্যমান টাচপ্যাড UI) |
| 4 | আবার স্লাইডার টগল করুন | কীবোর্ডে ফিরে আসে |
| 5 | **✕** ক্লোজ বাটন ট্যাপ করুন | প্যানেল বন্ধ; নিচের অ্যাপ অপরিবর্তিত |
| 6 | আবার accessibility বাটন/শর্টকাট চালু করুন | প্যানেল আবার খোলে |
| 7 | ১–৬ ধাপ **অন্য অ্যাপের ভেতরে** (যেমন Settings, ব্রাউজার) কোনো ফিল্ড ফোকাস ছাড়াই পুনরাবৃত্তি করুন | একই আচরণ — ইনপুট ফিল্ড লাগে না |
| 8 | ঐচ্ছিক: টেক্সট ফিল্ড ফোকাসড **এবং KickKey সক্রিয় কীবোর্ড** থাকলে প্যানেল খুলে কী চাপুন | কীগুলো ফিল্ডে কমিট হয় (বিদ্যমান IME সংযোগ) |
| 9 | খোলা/বন্ধের সময় `adb logcat | grep -E "KickKeyA11y|KickKeyIME"` | কোনো এরর নেই; `Floating panel shown/hidden` লগ |

**পাস = ১–৭ সবগুলো কোনো সময়ে ইনপুট ফিল্ড ফোকাস ছাড়াই কাজ করে।**

---

## 7. সমস্যা সমাধান (Troubleshooting)

| লক্ষণ | সম্ভাব্য কারণ | সমাধান |
|---|---|---|
| সার্ভিসটি Settings → Accessibility-তে নেই | কনফিগ XML কপি হয়নি / ম্যানিফেস্ট এন্ট্রি নেই | `npx expo prebuild` (বা `--clean`) পুনরায় চালান; `accessibility_service_config.xml` + ম্যানিফেস্ট এন্ট্রি যাচাই করুন (§৪ ধাপ ৩) |
| সার্ভিস তালিকায় আছে কিন্তু "বাটন ক্লিকে কিছু হয় না" | বাটন/শর্টকাট KickKey-তে বরাদ্দ নেই, বা `flagRequestAccessibilityButton` নেই | §৫ ধাপ ৪ পুনরায় করুন; কনফিগ XML-এ ফ্ল্যাগটি যাচাই করুন |
| প্যানেল খোলে কিন্তু **ফাঁকা** | হোস্ট রিজিউম হয়নি (JS রেডিনেস সিগনাল পাওয়া যায়নি) | `adb logcat \| grep KickKeyA11y`-তে "host resumed" / "never signalled readiness" দেখুন। বান্ডেল পুনর্নির্মাণ করুন (`node scripts/build-keyboard-bundle.js`) — পুরনো বান্ডেলে `KickKeyOverlay` রুট না থাকলে AppRegistry "not registered" ওয়ার্নিং দেখায় |
| logcat-এ "Component KickKeyOverlay not registered" | ধাপ ৬-এর আগে বান্ডেল তৈরি হয়েছিল | বান্ডেল পুনর্নির্মাণ + পুনরায় ইনস্টল |
| প্যানেল অন্য উইন্ডোর **পেছনে** খোলে (OEM কুয়ার্ক) | OEM ওভারলে হ্যান্ডলিং | সিস্টেম accessibility বাটন দিয়ে পরীক্ষা করুন (সর্বোচ্চ z-order); সমস্যাটি লগ করুন — এটি পরিকল্পনা §২৪-এর পরিচিত OEM এজ |
| Android 13 "Restricted settings" সার্ভিস চালু আটকায় | সাইডলোডেড ইনস্টল | Settings → Apps → Special app access → Accessibility পথ ব্যবহার করুন (§৫ ধাপ ২) |
| খোলার পরই প্যানেল বন্ধ | `onUnbind`/`onDestroy` চালু হয়েছে (সার্ভিস নিষ্ক্রিয় বা প্রসেস কিল) | সার্ভিস পুনরায় চালু করুন; logcat-এ `onUnbind` দেখুন |

---

## 8. M1-এর পরিধির বাইরে (স্থগিত)

| মাইলফলক | স্থগিত কাজ |
|---|---|
| M2 | RN cursor surface (`KickKeyPointer`), `pointerMove` সেখানে পুনঃনির্দেশ, ফুল-স্ক্রিন ক্ল্যাম্পিং, `ImageView` বিটম্যাপ pointer সরানো |
| M3 | সার্ভিস দিয়ে `dispatchGesture` ক্লিক/স্ক্রল/ব্যাক, IME স্ট্রিপ মোড, টাচপ্যাড বাটন রিওয়্যারিং |
| M4 | Pro mode (`INJECT_EVENTS`), নোটিফিকেশন/ক্রস-প্রসেস সিগনালিং দিয়ে ইন-অ্যাপ "Open panel" এন্ট্রি, পারমিশন ফ্লো পলিশ |
| M5 | `isAccessibilityTool`, Play Console ঘোষণা, প্রাইভেসি-পলিসি সেকশন, নতুন surface-এর ওয়াচডগ, লেজি প্রি-ওয়ার্ম |

ইচ্ছাকৃতভাবে M1-এ **না** থাকা বিষয়:
- প্যানেল স্ক্রিনে টেনে সরানো (অবস্থান নির্দিষ্ট: নিচে-মাঝে)।
- কোনো ফিল্ড ফোকাস না থাকলে প্যানেল থেকে টাইপিং (যেকোনো IME-এর জন্যই অসম্ভব — কী-তে ইনপুট কানেকশন লাগে; সেটাই M3-এর টাচপ্যাড জেসচারের কাজ)।
- বিদ্যমান IME টাচপ্যাড আচরণে কোনো পরিবর্তন।

---

## 9. সমাপ্তির মানদণ্ড (Definition of Done)

- [ ] `native-files/res/xml/`-এ `accessibility_service_config.xml` আছে
- [ ] `plugins/withAccessibilityService.js` আছে এবং `app.json`-এ `withImeService`-এর **পরে** তালিকাভুক্ত
- [ ] `native-files/java/com/kickkey/`-এ `KickKeyAccessibilityService.kt` আছে
- [ ] `KickKeyModule.kt`-এ `isAccessibilityEnabled`, `openAccessibilitySettings`, `showFloatingPanel`, `hideFloatingPanel` আছে
- [ ] `keyboard.index.js`-এ `KickKeyOverlay` নিবন্ধিত; `FloatingPanel.tsx` আছে; `times` আইকন যোগ হয়েছে
- [ ] `modules/kickkey-module/index.ts`-এ চারটি টাইপড র‍্যাপার আছে
- [ ] Settings স্ক্রিনে Accessibility স্ট্যাটাস + ডিপ-লিংক বাটন দেখা যায়
- [ ] `node scripts/build-keyboard-bundle.js` + `npx expo prebuild --platform android` সফল; ম্যানিফেস্ট + xml যাচাইকৃত
- [ ] সম্পূর্ণ §৬ টেস্ট স্ক্রিপ্ট পাস (প্যানেল খোলে/বন্ধ হয়, স্লাইডার কাজ করে, ইনপুট ফিল্ড লাগে না)
- [ ] টেস্ট চলাকালীন logcat-এ `KickKeyA11y` এরর নেই

**সব চেক শেষে → M2 (RN cursor + মুভমেন্ট)-এ যান।**
