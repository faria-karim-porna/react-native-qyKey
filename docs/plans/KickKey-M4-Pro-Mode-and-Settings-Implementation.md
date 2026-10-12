# KickKey — M4 Implementation Guide
## Pro Mode (`INJECT_EVENTS`), Settings UI, Permission Flows & Panel Notification

> **Platform:** Android Only · **Project:** `react-native-kickKey-deepseek` · **Milestone:** M4 · **Status:** READY TO IMPLEMENT
> Follows the approved plan: [`KickKey-Accessibility-Touchpad-Plan.md`](./KickKey-Accessibility-Touchpad-Plan.md)
> Prerequisites: M1 (a11y service + panel) + M2 (RN cursor) + M3 (cross-app clicks/scroll/back). See the M1/M2/M3 guides in this folder.

---

## 1. What M4 Delivers

| From plan §26 | M4 — Pro mode + settings |
|---|---|
| Scope | `INJECT_EVENTS` wrapper (`ProModeInjector.kt`: hover / wheel / Forward), settings UI (tap-to-click, pro-mode toggle, a11y status rows), permission flows (ADB grant, `POST_NOTIFICATIONS`), notification entry point |
| Exit criteria | **Pro mode works on an Android ≤ 11 device** (real hover, wheel scroll, Forward); **graceful fallback everywhere else** (M3 behavior, nothing breaks) |

**In one sentence:** after this milestone the touchpad gains an optional **pro mode** — unlocked by the signature `INJECT_EVENTS` permission granted over ADB (or root) on Android ≤ 11 — that replaces the a11y approximations with **true mouse behavior** (hover highlights links/tooltips, wheel scroll is pixel-perfect, Forward actually navigates), and the companion app gets a proper **settings surface** for accessibility status, pro mode, tap-to-click and the panel notification.

The plan's capability table (§10, §13) — pro mode **adds** to the M3 a11y path, it never replaces it:

| Feature | a11y path (default, M3) | Pro mode (Android ≤ 11 + `adb pm grant`) |
|---|---|---|
| Pointer movement | RN cursor overlay (M2) | same |
| Left / Right click | `dispatchGesture` tap / long-press (M3) | same — `INJECT_EVENTS` not needed |
| Back | `GLOBAL_ACTION_BACK` (M3) | same |
| **Hover** | none (cursor only) | `HOVER_MOVE` — link highlights, tooltips, hover states |
| **Scroll** | focused-node `ACTION_SCROLL` → swipe stroke | `MotionEvent.ACTION_SCROLL` wheel events (pixel-perfect, mouse-like) |
| **Forward** | `ACTION_SCROLL_FORWARD` on focused node → "not supported" hint | `KEYCODE_FORWARD` — real browser/activity history forward |

**Fallback rule (plan §15 + §19):** pro mode only ever activates when two things are true at runtime — (1) `INJECT_EVENTS` is actually granted (`checkSelfPermission`), and (2) the user enabled it in Settings. On any other device (Play Store installs, Android 12+, permission not granted) every pro-mode call is a **no-op** and the touchpad behaves exactly as it did after M3. Nothing about M4 can break the a11y path.

**Platform caveat, restated clearly (plan §10, §19):** `InputManager.injectInputEvent()` is **blocked on Android 12+ for apps targeting API 31+** — it throws `SecurityException` even with the permission. Pro mode is realistically an **Android ≤ 11 + ADB grant** feature (or rooted devices). `INJECT_EVENTS` is declared in the manifest but **never granted by the Play Store**, so pro mode stays undetectable-in-Play: the feature simply doesn't exist on store installs.

---

## 2. Architecture Recap

```
                          ┌──────────────────────────────────────────────┐
                          │                 Companion app                │
                          │  app/(tabs)/settings.tsx (M4)               │
                          │    • Accessibility card (status + deep link) │
                          │    • Pro mode card (hidden unless granted)   │
                          │    • Touchpad card (tap-to-click)            │
                          │    • Notifications card (panel notification) │
                          └───────────────┬──────────────────────────────┘
                                          │ KickKey.isProModeAvailable() / setProModeEnabled()
                                          │ requestNotificationPermission() / togglePanelNotification()
                                          ▼
                          KickKeyModule (KickKeyModule.kt, M4 additions)
   ┌──────────────────────────────────────┼───────────────────────────────────────┐
   │                                      │                                       │
   ▼                                      ▼                                       ▼
ProModeInjector.kt (NEW)        KickKeyAccessibilityService.kt        KickKeyNotificationReceiver.kt (NEW)
   └─ isAvailable/isEnabled      └─ scrollAt: wheel FIRST in pro       └─ ACTION_OPEN_PANEL broadcast
   └─ hover(x,y) → HOVER_MOVE       mode, then node action, then         └─ KickKeyAccessibilityService
   └─ wheel(x,y,dy) → ACTION_SCROLL  swipe (M3)                            .instance?.showFloatingPanel()
   └─ forward() → KEYCODE_FORWARD  └─ navigateHistory('forward'):
   └─ inject() try/catch → false     pro-mode forward, else M3
        on Android 12+ SecurityException

   Events: onProModeChanged, onNotificationPermissionChanged (Kotlin → JS)
   Prefs (kickkey_prefs): proModeEnabled, tapToClick (M3), panelNotification
```

Same-process note: `ProModeInjector` is called from the `:ime_process` (service + keyboard bundle) and from the main process (settings screen, where it only reads `isAvailable`/`isEnabled` — never injects). Both processes share the same UID, so a `POST_NOTIFICATIONS` grant requested from the settings screen applies to the `:ime_process` notification too.

---

## 3. Step-by-Step Implementation

### Step 1 — Create `ProModeInjector.kt`

**New file:** `native-files/java/com/kickkey/ProModeInjector.kt`

The single wrapper around `InputManager.injectInputEvent()`. Everything is permission-guarded at runtime; every call degrades to `false`/no-op when pro mode is off, so callers keep their M3 fallbacks.

```kotlin
package com.kickkey

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import android.util.Log
import android.view.InputEvent
import android.view.InputManager
import android.view.KeyEvent
import android.view.MotionEvent

object ProModeInjector {

    private const val TAG = "KickKeyProMode"

    /** True when android.permission.INJECT_EVENTS is actually granted (adb/root). */
    fun isAvailable(context: Context): Boolean =
        context.checkSelfPermission(Manifest.permission.INJECT_EVENTS) ==
            PackageManager.PERMISSION_GRANTED

    /** True when the permission is granted AND the user enabled pro mode in Settings. */
    fun isEnabled(context: Context): Boolean {
        if (!isAvailable(context)) return false
        val prefs = context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
        return prefs.getBoolean("proModeEnabled", false)
    }

    // ── Hover ──────────────────────────────────────────────────────────────
    /** True mouse hover at (x, y) — link highlights, tooltips, hover states. */
    fun hover(context: Context, x: Float, y: Float) {
        if (!isEnabled(context)) return
        val now = SystemClock.uptimeMillis()
        val event = MotionEvent.obtain(
            now, now, MotionEvent.ACTION_HOVER_MOVE, x, y, 0
        )
        inject(context, event)
    }

    // ── Wheel ──────────────────────────────────────────────────────────────
    /**
     * Mouse-wheel scroll: MotionEvent.ACTION_SCROLL with a vertical-axis delta.
     * deltaY > 0 scrolls content up ("see above"), deltaY < 0 scrolls down.
     * (Sign can be flipped per-device; see §5 test #4.)
     */
    fun wheel(context: Context, x: Float, y: Float, deltaY: Float) {
        if (!isEnabled(context)) return
        val now = SystemClock.uptimeMillis()
        val event = MotionEvent.obtain(
            now, now, MotionEvent.ACTION_SCROLL, x, y, 0
        )
        event.setAxisValue(MotionEvent.AXIS_VSCROLL, deltaY)
        inject(context, event)
    }

    // ── Forward ────────────────────────────────────────────────────────────
    /** True when the KEYCODE_FORWARD down/up pair was injected. */
    fun forward(context: Context): Boolean {
        if (!isEnabled(context)) return false
        val down = inject(context, KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_FORWARD))
        val up   = inject(context, KeyEvent(KeyEvent.ACTION_UP,   KeyEvent.KEYCODE_FORWARD))
        return down && up
    }

    // ── Core ───────────────────────────────────────────────────────────────
    private fun inject(context: Context, event: InputEvent): Boolean {
        return try {
            val inputManager =
                context.getSystemService(Context.INPUT_SERVICE) as InputManager
            inputManager.injectInputEvent(
                event,
                InputManager.INJECT_INPUT_EVENT_MODE_ASYNC
            )
            true
        } catch (e: SecurityException) {
            // Android 12+ blocks injectInputEvent for targetSdk 31+ even with
            // the permission. Log once and fall through — callers keep the
            // M3 a11y path. Do NOT throw into the JS bridge.
            Log.w(TAG, "injectInputEvent blocked: ${e.message}")
            false
        } finally {
            event.recycle()
        }
    }
}
```

> API notes: `checkSelfPermission` is API 23+ (minSdk 24 — fine). `KEYCODE_FORWARD` is a platform constant (125). `MotionEvent.setAxisValue(AXIS_VSCROLL, …)` is the standard way to synthesize wheel input.

---

### Step 2 — Route pro mode through `KickKeyAccessibilityService.kt`

**Edit:** `native-files/java/com/kickkey/KickKeyAccessibilityService.kt`

**2a.** Scroll priority — pro mode wheel goes **first** in `scrollAt` (plan §12: ① wheel ② node action ③ swipe). Replace the head of the existing `scrollAt`:

```kotlin
    /** Returns true when the scroll was handled. direction: "up" | "down" */
    fun scrollAt(direction: String, x: Float, y: Float): Boolean {
        // ① Pro mode: pixel-perfect wheel event at the cursor (plan §12.3).
        if (ProModeInjector.isEnabled(applicationContext)) {
            val deltaY = if (direction == "up") 1f else -1f
            ProModeInjector.wheel(
                applicationContext,
                PointerOverlay.cursorX,
                PointerOverlay.cursorY,
                deltaY
            )
            return true
        }

        // ② a11y node action, ③ swipe fallback — unchanged from M3.
        val nodeAction = if (direction == "up") {
            AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
        } else {
            AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
        }
        if (performScrollOnFocusedNode(nodeAction)) return true

        val now = SystemClock.uptimeMillis()
        if (now - lastScrollDispatchMs < SCROLL_THROTTLE_MS) return true
        lastScrollDispatchMs = now

        val maxY = resources.displayMetrics.heightPixels.toFloat()
        val fromY = (if (direction == "up") y - SCROLL_SWIPE_DISTANCE_PX
                     else y + SCROLL_SWIPE_DISTANCE_PX).coerceIn(0f, maxY)
        val toY = (if (direction == "up") y + SCROLL_SWIPE_DISTANCE_PX
                   else y - SCROLL_SWIPE_DISTANCE_PX).coerceIn(0f, maxY)
        dispatchGestureSafe(buildSwipeGesture(x, fromY, x, toY, SCROLL_SWIPE_DURATION_MS))
        return true
    }
```

**2b.** Forward — pro mode `KEYCODE_FORWARD` before the M3 best-effort. Change the existing `navigateHistory` forward branch in `KickKeyModule.kt` (Step 4) to call this; the service method is:

```kotlin
    /** Forward: pro mode KEYCODE_FORWARD first, else M3 node-scroll fallback. */
    fun forwardHistory(): Boolean =
        if (ProModeInjector.isEnabled(applicationContext)) {
            ProModeInjector.forward(applicationContext)
        } else {
            performScrollOnFocusedNode(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
        }
```

**2c.** Panel notification (M4 entry point, plan §4.2 + §14). Add a notification channel + a "Tap to open the KickKey touchpad panel" notification whose content intent broadcasts to the new receiver (Step 3):

```kotlin
    // ── M4: panel notification entry point ────────────────────────────────

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            PANEL_CHANNEL_ID, "KickKey panel",
            NotificationManager.IMPORTANCE_LOW
        )
        channel.description = "Opens the KickKey touchpad panel"
        nm.createNotificationChannel(channel)
    }

    /** Posts the persistent "open panel" notification (no-op without permission). */
    fun showPanelNotification() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
        ) return
        ensureNotificationChannel()

        val openPanel = Intent(this, KickKeyNotificationReceiver::class.java)
            .setAction(KickKeyNotificationReceiver.ACTION_OPEN_PANEL)
        val pending = PendingIntent.getBroadcast(
            this, 0, openPanel,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = Notification.Builder(this, PANEL_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_more)
            .setContentTitle("KickKey")
            .setContentText("Tap to open the KickKey touchpad panel")
            .setContentIntent(pending)
            .setOngoing(false)
            .build()
        getSystemService(Context.NOTIFICATION_SERVICE)
            .let { it as NotificationManager }
            .notify(PANEL_NOTIFICATION_ID, notification)
    }

    fun hidePanelNotification() {
        getSystemService(Context.NOTIFICATION_SERVICE)
            .let { it as NotificationManager }
            .cancel(PANEL_NOTIFICATION_ID)
    }

    companion object {
        // ...existing constants...
        private const val PANEL_CHANNEL_ID = "kickkey_panel"
        private const val PANEL_NOTIFICATION_ID = 1001
    }
```

---

### Step 3 — Create `KickKeyNotificationReceiver.kt`

**New file:** `native-files/java/com/kickkey/KickKeyNotificationReceiver.kt`

A tiny manifest-declared receiver in the `:ime_process` — the notification's content intent lands here and asks the (already running) accessibility service to show the floating panel:

```kotlin
package com.kickkey

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class KickKeyNotificationReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_OPEN_PANEL) return
        Log.i(TAG, "Notification action received — opening panel")
        val svc = KickKeyAccessibilityService.instance
        if (svc != null) {
            svc.showFloatingPanel()
        } else {
            // Service not running: start it; its onServiceConnected shows the
            // panel (M1 already handles the cold-start path).
            context.startService(Intent(context, KickKeyAccessibilityService::class.java))
        }
    }

    companion object {
        const val ACTION_OPEN_PANEL = "com.kickkey.action.OPEN_PANEL"
        private const val TAG = "KickKeyNotifReceiver"
    }
}
```

---

### Step 4 — Extend `KickKeyModule.kt`

**Edit:** `native-files/java/com/kickkey/KickKeyModule.kt`

The module is a `ReactContextBaseJavaModule` (existing style).

**4a.** Add imports (top of file):

```kotlin
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
```

**4b.** Register a permission-result listener in `init` (classic RN pattern for runtime permissions from a module):

```kotlin
    private val permissionListener = object : BaseActivityEventListener() {
        override fun onRequestPermissionsResult(
            requestCode: Int, permissions: Array<out String>, grantResults: IntArray
        ) {
            if (requestCode == REQ_POST_NOTIFICATIONS) {
                val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
                val params = Arguments.createMap().apply {
                    putBoolean("granted", granted)
                }
                emitEvent("onNotificationPermissionChanged", params)
            }
        }
    }

    init {
        reactApplicationContext.addActivityEventListener(permissionListener)
    }
```

**4c.** New `@ReactMethod`s (append near the touchpad methods):

```kotlin
    // ── Pro mode (M4) ──────────────────────────────────────────────────────

    @ReactMethod
    fun isProModeAvailable(promise: Promise) {
        promise.resolve(ProModeInjector.isAvailable(reactApplicationContext))
    }

    /** Persists the user toggle; emits onProModeChanged to keyboard + settings. */
    @ReactMethod
    fun setProModeEnabled(enabled: Boolean, promise: Promise) {
        val ctx = reactApplicationContext
        ctx.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
            .edit().putBoolean("proModeEnabled", enabled).apply()
        val params = Arguments.createMap().apply {
            putBoolean("available", ProModeInjector.isAvailable(ctx))
            putBoolean("enabled", enabled)
        }
        emitEvent("onProModeChanged", params)
        promise.resolve(null)
    }

    /** Hover at the cursor's current screen position (native owns it). */
    @ReactMethod
    fun proModeHover(promise: Promise) {
        ProModeInjector.hover(
            reactApplicationContext,
            PointerOverlay.cursorX,
            PointerOverlay.cursorY
        )
        promise.resolve(null)
    }

    /** Wheel scroll at the cursor. deltaY > 0 = up, < 0 = down. */
    @ReactMethod
    fun proModeWheel(deltaY: Double, promise: Promise) {
        ProModeInjector.wheel(
            reactApplicationContext,
            PointerOverlay.cursorX,
            PointerOverlay.cursorY,
            deltaY.toFloat()
        )
        promise.resolve(null)
    }

    /** True when KEYCODE_FORWARD was injected (pro mode only). */
    @ReactMethod
    fun proModeForward(promise: Promise) {
        promise.resolve(ProModeInjector.forward(reactApplicationContext))
    }

    // ── Panel notification (M4) ────────────────────────────────────────────

    /** API 33+: system permission dialog; older: resolves true immediately. */
    @ReactMethod
    fun requestNotificationPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT < 33) {
            promise.resolve(true)
            return
        }
        val activity = currentActivity
        if (activity != null) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                REQ_POST_NOTIFICATIONS
            )
            promise.resolve(null) // result arrives via onRequestPermissionsResult
        } else {
            promise.resolve(false)
        }
    }

    /** Shows/hides the "open panel" notification via the a11y service. */
    @ReactMethod
    fun togglePanelNotification(on: Boolean, promise: Promise) {
        val ctx = reactApplicationContext
        val svc = KickKeyAccessibilityService.instance
        if (on) svc?.showPanelNotification() else svc?.hidePanelNotification()
        ctx.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
            .edit().putBoolean("panelNotification", on).apply()
        promise.resolve(null)
    }
```

**4d.** Re-point `navigateHistory('forward')` to the service's pro-mode-aware method (edit the existing forward branch from M3):

```kotlin
            } else {
                // Forward: pro mode KEYCODE_FORWARD first, then M3 best-effort
                // node scroll; false → JS shows the "not supported" hint.
                promise.resolve(svc?.forwardHistory() ?: false)
            }
```

**4e.** Add the constants to the module's `companion object`:

```kotlin
        private const val REQ_POST_NOTIFICATIONS = 5001
```

**4f.** Make sure `pointerMove` already feeds hover in pro mode — add one line to the existing `pointerMove` (after `PointerOverlay.move`):

```kotlin
    @ReactMethod
    fun pointerMove(dx: Double, dy: Double, promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            PointerOverlay.move(dx.toFloat(), dy.toFloat())
            // M4: true hover follows the pointer while pro mode is enabled.
            ProModeInjector.hover(
                reactApplicationContext,
                PointerOverlay.cursorX,
                PointerOverlay.cursorY
            )
            KickKeyAccessibilityService.instance?.onDragDelta(dx.toFloat(), dy.toFloat())
            promise.resolve(null)
        }
    }
```

`emitEvent` helper (if not already present in the file):

```kotlin
    private fun emitEvent(name: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(name, params)
    }
```

---

### Step 5 — Manifest additions in `plugins/withAccessibilityService.js`

**Edit:** `plugins/withAccessibilityService.js` (created in M1 — copy pattern from `withImeService.js`). Add to the manifest edits:

```xml
<!-- Permissions -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INJECT_EVENTS" />

<!-- Panel notification receiver (same :ime_process as the a11y service) -->
<receiver
    android:name=".KickKeyNotificationReceiver"
    android:exported="false"
    android:process=":ime_process">
    <intent-filter>
        <action android:name="com.kickkey.action.OPEN_PANEL" />
    </intent-filter>
</receiver>
```

Also copy the two new Kotlin files (`ProModeInjector.kt`, `KickKeyNotificationReceiver.kt`) into `android/app/src/main/java/com/kickkey/` the same way the plugin already copies the other files.

> `INJECT_EVENTS` is a **signature/privileged** permission: declaring it costs nothing, the Play Store never grants it, and it never triggers a runtime dialog. This is what keeps pro mode undetectable-in-Play (plan §23).

---

### Step 6 — Bridge module wrappers

**Edit:** `modules/kickkey-module/index.ts`

```ts
  // ── Pro mode (M4) ───────────────────────────────────────────────────────

  /** True when android.permission.INJECT_EVENTS is granted (adb/root only). */
  isProModeAvailable: (): Promise<boolean> => KickKey.isProModeAvailable(),

  /** Persist the pro-mode toggle; native emits onProModeChanged. */
  setProModeEnabled: (enabled: boolean): Promise<void> =>
    KickKey.setProModeEnabled(enabled),

  /** Hover at the cursor's screen position (no-op unless pro mode enabled). */
  proModeHover: (): Promise<void> => KickKey.proModeHover(),

  /** Wheel scroll at the cursor. Positive = up, negative = down. */
  proModeWheel: (deltaY: number): Promise<void> => KickKey.proModeWheel(deltaY),

  /** True when KEYCODE_FORWARD was injected (pro mode). */
  proModeForward: (): Promise<boolean> => KickKey.proModeForward(),

  // ── Panel notification (M4) ─────────────────────────────────────────────

  /** API 33+: opens the system POST_NOTIFICATIONS dialog. */
  requestNotificationPermission: (): Promise<boolean> =>
    KickKey.requestNotificationPermission(),

  /** Shows/hides the persistent "open panel" notification. */
  togglePanelNotification: (on: boolean): Promise<void> =>
    KickKey.togglePanelNotification(on),
```

**Listener helpers** (same file, or a small hook):

```ts
export function onProModeChanged(cb: (d: { available: boolean; enabled: boolean }) => void) {
  return emitter.addListener('onProModeChanged', cb);
}
export function onNotificationPermissionChanged(cb: (d: { granted: boolean }) => void) {
  return emitter.addListener('onNotificationPermissionChanged', cb);
}
```

(`emitter` is the existing `NativeEventEmitter` already used by the keyboard bundle.)

---

### Step 7 — Settings UI

**Edit:** `app/(tabs)/settings.tsx` (+ `store/settingsStore.ts` + `hooks/useSettingsSync.ts`)

**7a.** Add state + persistence. In `store/settingsStore.ts`:

```ts
  // Touchpad / pro mode (M4)
  tapToClick: boolean;
  proModeEnabled: boolean;
  panelNotification: boolean;
  toggleTapToClick: () => void;
  setProModeEnabled: (v: boolean) => void;
  togglePanelNotification: () => void;
```

with defaults `tapToClick: true`, `proModeEnabled: false`, `panelNotification: false` and the matching actions. In `hooks/useSettingsSync.ts`, add `tapToClick`, `proModeEnabled`, `panelNotification` to the debounced `savePreferences` payload so the keyboard bundle and native see them.

**7b.** Rewrite `settings.tsx` with the four cards (keep the existing styling — `ToggleRow`, `styles.card`):

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useKickKeyBridge } from '../../hooks/useKickKeyBridge';
import { useSettingsStore } from '../../store/settingsStore';
import { ToggleRow } from '../../components/ToggleRow';

export default function SettingsScreen() {
  const {
    isAccessibilityEnabled, openAccessibilitySettings,
    isProModeAvailable, setProModeEnabled,
    requestNotificationPermission,
  } = useKickKeyBridge();

  const [a11yEnabled, setA11yEnabled] = useState(false);
  const [proAvailable, setProAvailable] = useState(false);

  // existing store toggles (haptic, sound, autoCorrect, showSuggestions) ...
  const tapToClick = useSettingsStore((s) => s.tapToClick);
  const proModeEnabled = useSettingsStore((s) => s.proModeEnabled);
  const panelNotification = useSettingsStore((s) => s.panelNotification);
  const toggleTapToClick = useSettingsStore((s) => s.toggleTapToClick);
  const togglePanelNotification = useSettingsStore((s) => s.togglePanelNotification);

  const checkStatuses = useCallback(() => {
    isAccessibilityEnabled().then(setA11yEnabled).catch(() => {});
    isProModeAvailable().then(setProAvailable).catch(() => setProAvailable(false));
  }, [isAccessibilityEnabled, isProModeAvailable]);

  useEffect(() => {
    checkStatuses();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkStatuses();
    });
    return () => sub.remove();
  }, [checkStatuses]);

  const handleProModeToggle = (v: boolean) => {
    setProModeEnabled(v).catch(() => {});
    // proModeEnabled persisted via useSettingsSync → savePreferences
  };

  const handlePanelNotificationToggle = (v: boolean) => {
    if (v) requestNotificationPermission().catch(() => {});
    togglePanelNotification();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {/* ── Accessibility ── */}
        <Text style={styles.sectionLabel}>Accessibility</Text>
        <View style={styles.card}>
          <Pressable style={styles.row} onPress={() => openAccessibilitySettings()}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Accessibility service</Text>
              <Text style={styles.rowDesc}>
                {a11yEnabled ? 'Enabled' : 'Disabled — tap to enable'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        {/* ── Pro mode (only shown when INJECT_EVENTS is granted) ── */}
        {proAvailable && (
          <>
            <Text style={styles.sectionLabel}>Pro mode</Text>
            <View style={styles.card}>
              <ToggleRow
                label="Pro mode"
                description="True hover, wheel scroll and Forward (INJECT_EVENTS, ADB)"
                value={proModeEnabled}
                onValueChange={handleProModeToggle}
              />
            </View>
          </>
        )}

        {/* ── Touchpad ── */}
        <Text style={styles.sectionLabel}>Touchpad</Text>
        <View style={styles.card}>
          <ToggleRow
            label="Tap to click"
            description="Quick tap on the touchpad = left click"
            value={tapToClick}
            onValueChange={toggleTapToClick}
          />
        </View>

        {/* ── Notifications ── */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <ToggleRow
            label="Panel notification"
            description="Show a notification that opens the touchpad panel"
            value={panelNotification}
            onValueChange={handlePanelNotificationToggle}
          />
        </View>

        <Text style={styles.footnote}>
          Pro mode requires Android 11 or older and an ADB-granted
          INJECT_EVENTS permission: adb shell pm grant com.kickkey
          android.permission.INJECT_EVENTS
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
```

Add the missing styles (`row`, `rowText`, `rowLabel`, `rowDesc`, `chevron`) to `styles`. Keep the existing feedback/typing cards untouched below.

---

### Step 8 — Keyboard-side wiring

**Edit:** `src/keyboard/hooks/useKeyboardState.ts` + `src/keyboard/qykey/Touchpad.tsx`

**8a.** `useKeyboardState.ts` — listen for pro-mode changes and expose a wheel handler:

```ts
  const [proMode, setProMode] = useState<{ available: boolean; enabled: boolean }>({
    available: false, enabled: false,
  });

  useEffect(() => {
    const sub = emitter.addListener('onProModeChanged', (d: any) => {
      setProMode(d);
    });
    getKickKey()?.isProModeAvailable().then((available: boolean) => {
      setProMode((p) => ({ ...p, available }));
    }).catch(() => {});
    return () => sub.remove();
  }, []);

  /** Two-finger vertical drag on the surface → wheel scroll (pro mode only). */
  const handleWheel = useCallback((deltaY: number) => {
    getKickKey()?.proModeWheel(deltaY);
  }, []);
```

Return `proMode`, `handleWheel` from the hook.

**8b.** `Touchpad.tsx` — new optional props `onWheel?: (deltaY: number) => void` and `proMode?: boolean`:

- **Hover** is automatic: `pointerMove` already calls `ProModeInjector.hover` natively (Step 4e), so no JS change is needed for hover.
- **Wheel gesture**: in `onPanResponderMove`, track a second touch; when two fingers are down, use the vertical delta of the primary touch as a wheel input (throttled to one call per frame, `WHEEL_SCALE ≈ 24` px per notch):

```tsx
      onPanResponderMove: (evt, gestureState) => {
        // ...existing single-finger pointer-move logic (M2/M3)...

        // Two-finger vertical drag = wheel scroll (pro mode only).
        if (proMode?.enabled && evt.nativeEvent.touches.length >= 2) {
          const dy = gestureState.dy - lastTwoFingerDy.current;
          lastTwoFingerDy.current = gestureState.dy;
          if (dy !== 0) onWheelRef.current?.(-dy * WHEEL_SCALE);
        }
      },
```

  Reset `lastTwoFingerDy.current = 0` in `onPanResponderGrant`/`onPanResponderRelease`.
- **Forward button**: no change needed — `handleNavigateHistory('forward')` already routes through native, which now tries `KEYCODE_FORWARD` first (Step 4c). The M3 "not supported" hint simply stops appearing when pro mode handles it.

---

## 4. Build & Install

```bash
cd react-native-kickKey-deepseek

node scripts/build-keyboard-bundle.js
npx expo prebuild --platform android     # runs withImeService + withAccessibilityService
npx expo run:android                     # dev build
```

**Pro mode on a personal Android ≤ 11 device:**

```bash
# 1. install the debug/release APK normally
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# 2. grant the signature permission over ADB (the only way — no UI grant exists)
adb shell pm grant com.kickkey android.permission.INJECT_EVENTS

# 3. verify it stuck
adb shell dumpsys package com.kickkey | grep -i inject
```

Then enable "Pro mode" in Settings → Pro mode. On Android 12+ the grant may succeed but `injectInputEvent` still throws — pro mode simply stays off and the a11y path (M3) handles everything.

> No new npm dependencies. `POST_NOTIFICATIONS` is requested at runtime (Step 4b); `INJECT_EVENTS` is manifest-only.

---

## 5. Manual Test Script (M4 exit criteria)

**Setup:** M1–M3 working. Device A = Android ≤ 11 with `adb pm grant` done; Device B = Android 12+ (or store install) with **no** grant — must behave exactly like M3.

| # | Step | Expected |
|---|---|---|
| 1 | Device A: enable Pro mode in Settings → Pro mode | Toggle sticks across app restarts (pref saved); `onProModeChanged` fires |
| 2 | Device A: open a **browser**, move the cursor over a link | Link highlights / tooltip appears (real `HOVER_MOVE`) |
| 3 | Device A: hover a button, press **L** | Button activates (tap works as in M3) |
| 4 | Device A: point at a list, hold the **scroll-down** caret | List scrolls with **wheel events** (smooth, pixel-level), not swipes |
| 5 | Device A: press **Forward** chevron | Real history-forward navigation (`KEYCODE_FORWARD`); no "not supported" hint |
| 6 | Device A: two-finger drag on the touchpad surface | Wheel scrolls (up/down) in the app under the cursor |
| 7 | Device A: Settings → Notifications → enable **Panel notification** | Android 13+: permission dialog appears; once granted, a persistent "Tap to open the KickKey touchpad panel" notification shows |
| 8 | Device A: tap the notification (no text field focused) | Floating panel opens (broadcast → receiver → `showFloatingPanel`) |
| 9 | Device B (no grant): Settings screen | **Pro mode card is hidden**; Accessibility card shows status; no crash |
| 10 | Device B: full M3 test (§5 of the M3 guide) | Everything behaves exactly as M3 — wheel falls back to node-action/swipe, Forward shows the hint, no hover |
| 11 | Both devices: `adb logcat \| grep -E "KickKeyProMode\|KickKeyA11y"` | No errors; the Android 12+ SecurityException (if any) is logged once and swallowed |
| 12 | Both devices: tap-to-click toggle off/on in Settings | Setting persists; tap-to-click behavior follows (M3 regression) |

**Pass = pro mode (hover / wheel / Forward / notification) works end-to-end on Device A, and Device B is bit-for-bit M3 behavior with the pro-mode UI hidden.**

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Pro mode card doesn't appear in Settings | `INJECT_EVENTS` not granted, or prebuild didn't re-run after the manifest edit | `adb shell pm grant com.kickkey android.permission.INJECT_EVENTS`; `npx expo prebuild --platform android` + reinstall |
| Hover does nothing | Pro mode off, Android 12+, or the app under the cursor doesn't render hover | Verify toggle on + Device A; try a browser (Chrome/Firefox) web page with links |
| Wheel scrolls nothing | `AXIS_VSCROLL` sign inverted on the device, or cursor over a non-scrollable area | Flip the sign in `scrollAt` (`1f` ↔ `-1f`); point over a real list |
| Forward still shows the hint | Pro mode off (falls back to M3), or app doesn't support history-forward | Turn pro mode on; test in a browser with history |
| Notification never appears | `POST_NOTIFICATIONS` denied on API 33+, or `panelNotification` pref off | Re-enable via Settings → Notifications; check `adb logcat` for the channel |
| Tapping the notification does nothing | Receiver not registered in `:ime_process` (prebuild not re-run), or service dead | Verify manifest receiver + `android:process=":ime_process"`; re-prebuild |
| `SecurityException` spam in logcat | Android 12+ calling `injectInputEvent` | Expected — logged once and swallowed; pro mode is off on this device by design |
| Pro mode toggle resets after restart | Pref key mismatch between `useSettingsSync` and native `kickkey_prefs` | Verify both use `proModeEnabled` |

---

## 7. Explicitly Out of Scope for M4 (deferred)

| Milestone | Deferred work |
|---|---|
| M5 | Watchdog for the new surfaces, lazy pre-warm, node-recycle hardening on API < 33, Play Console accessibility declaration + `isAccessibilityTool`, privacy-policy section, device-matrix testing, EN/BN docs pass |

Also intentionally **not** in M4:
- True hover / wheel / Forward on **Android 12+** — platform-blocked; a11y path is the ceiling there.
- `HOME` / `RECENTS` / `Notifications` global buttons (the service APIs exist; UI is a later milestone).
- Double-click / two-finger right-click (optional settings, later).
- Pro mode over root-only `InputManager` tricks beyond the documented ADB grant.

---

## 8. Definition of Done

- [ ] `ProModeInjector.kt`: `isAvailable` / `isEnabled` / `hover` / `wheel` / `forward` / `inject` with try/catch; permission-guarded; copied by the config plugin
- [ ] `KickKeyAccessibilityService.kt`: wheel-first `scrollAt`, `forwardHistory()`, panel notification (channel + show/hide)
- [ ] `KickKeyNotificationReceiver.kt`: `ACTION_OPEN_PANEL` → `showFloatingPanel()` (or cold-start)
- [ ] `KickKeyModule.kt`: `isProModeAvailable`, `setProModeEnabled`, `proModeHover`, `proModeWheel`, `proModeForward`, `requestNotificationPermission`, `togglePanelNotification`; `pointerMove` feeds hover; forward branch re-pointed; `onProModeChanged` / `onNotificationPermissionChanged` events
- [ ] `plugins/withAccessibilityService.js`: `POST_NOTIFICATIONS` + `INJECT_EVENTS` permissions, receiver block, new Kotlin files copied
- [ ] `modules/kickkey-module/index.ts`: typed wrappers + event listeners
- [ ] `store/settingsStore.ts` + `hooks/useSettingsSync.ts`: `tapToClick`, `proModeEnabled`, `panelNotification` persisted
- [ ] `app/(tabs)/settings.tsx`: Accessibility, Pro mode (conditional), Touchpad, Notifications cards
- [ ] `useKeyboardState.ts` + `Touchpad.tsx`: pro-mode state, two-finger wheel, hover wiring
- [ ] §5 test script passes on Device A (pro mode) **and** Device B (pure M3 fallback)
- [ ] Logcat clean of `KickKeyProMode` / `KickKeyA11y` errors during the run

**On completion of all checks → M5 (hardening, Play declaration, compliance + polish) is the remaining milestone; the touchpad feature set is otherwise complete.**
