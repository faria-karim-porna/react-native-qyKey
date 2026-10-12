# KickKey — M2 বাস্তবায়ন গাইড
## RN কার্সর সারফেস + ফুল-স্ক্রিন পয়েন্টার মুভমেন্ট

> **প্ল্যাটফর্ম:** শুধুমাত্র Android · **প্রজেক্ট:** `react-native-kickKey-deepseek` · **মাইলফলক:** M2 · **অবস্থা:** বাস্তবায়নের জন্য প্রস্তুত
> অনুমোদিত পরিকল্পনা অনুসরণ করে: [`KickKey-অ্যাক্সেসিবিলিটি-টাচপ্যাড-পরিকল্পনা.md`](./KickKey-অ্যাক্সেসিবিলিটি-টাচপ্যাড-পরিকল্পনা.md)
> পূর্বশর্ত: M1 (দেখুন [`KickKey-M1-অ্যাক্সেসিবিলিটি-সার্ভিস-বাস্তবায়ন.md`](./KickKey-M1-অ্যাক্সেসিবিলিটি-সার্ভিস-বাস্তবায়ন.md))

---

## 1. M2 কী দেবে

| পরিকল্পনা §২৬ থেকে | M2 — RN কার্সর + মুভমেন্ট |
|---|---|
| পরিধি | `KickKeyPointer` React surface, এর ওভারলে উইন্ডো, প্রতি-ফ্রেম `pointerMove`, ফুল-স্ক্রিন ক্ল্যাম্পিং, পুরনো `ImageView` বিটম্যাপ পয়েন্টার সরানো |
| প্রস্থানের মানদণ্ড | কার্সর **React Native-এ রেন্ডার হয়** এবং **পুরো স্ক্রিনে** 60Hz-এ চলে |

**এক বাক্যে:** এই মাইলফলকের পর ডেস্কটপ-স্টাইলের পয়েন্টারটি একটি ছোট React Native তীর, যা নিজের ওভারলে উইন্ডোতে রেন্ডার হয়; টাচপ্যাডে ড্র্যাগ করলে এটি **সম্পূর্ণ স্ক্রিনে** মসৃণভাবে চলে (আর "কীবোর্ডের উপরে ক্ল্যাম্পড" নেই, আর নেটিভ `ImageView` বিটম্যাপ নেই)। অন্য অ্যাপে ক্লিক/স্ক্রল/ব্যাক — **M3**-এর কাজ।

M2 যা **না** করবে (ইচ্ছাকৃতভাবে): `dispatchGesture` ক্লিক, `GLOBAL_ACTION_BACK`, স্ক্রল, IME স্ট্রিপ মোড, ট্যাপ-টু-ক্লিক, বা L/R/স্ক্রল/ব্যাক বাটন রিওয়্যারিং — সবই M3+। `Touchpad.tsx`-এর বিদ্যমান DPAD টেক্সট-কেয়ারেট স্টেপিংও থাকে (টেক্সট ফিল্ড ফোকাসড থাকলে এখনো কাজে লাগে)।

---

## 2. আর্কিটেকচার রিক্যাপ (কী যোগ/পরিবর্তন হবে)

```
:ime_process
├─ PointerOverlay (NEW — Kotlin object)
│    ├─ show()   → প্রাপ্যতা অনুযায়ী উইন্ডো টাইপ বেছে নেয়:
│    │             TYPE_ACCESSIBILITY_OVERLAY (a11y সার্ভিস সক্রিয়)
│    │             TYPE_APPLICATION_OVERLAY / TYPE_PHONE (ওভারলে পারমিশন)
│    │             null → JS-এ পারমিশন ব্যানার দেখায়
│    ├─         → কীবোর্ড ReactHost থেকে ReactSurface "KickKeyPointer"
│    │             লেজিলি তৈরি করে (প্রসেস জীবিত থাকা পর্যন্ত থাকে)
│    ├─         → 32dp NOT_TOUCHABLE উইন্ডোতে surface ভিউ যোগ করে
│    ├─ move(dx,dy) → cursorX/Y += ডেল্টা, পুরো স্ক্রিনে ক্ল্যাম্পড,
│    │                WindowManager.updateViewLayout()
│    └─ hide()  → উইন্ডো সরায় (surface জীবিত থাকে)
├─ KickKeyModule (পরিবর্তিত)
│    └─ pointerShow / pointerMove / pointerHide এখন ImageView বিটম্যাপের
│       বদলে PointerOverlay-তে ডেলিগেট করে
└─ keyboard.bundle (একই Hermes বান্ডেল, তৃতীয় রুট)
     ├─ "KickKeyKeyboard" (বর্তমান — IME surface)
     ├─ "KickKeyOverlay"  (M1 — ফ্লোটিং প্যানেল)
     └─ "KickKeyPointer"  (NEW — PointerRoot.tsx, স্থির SVG তীর)
```

**মূল সিদ্ধান্ত (পরিকল্পনা থেকে, ইতিমধ্যে অনুমোদিত):**
- কার্সর একটি **React Native** কম্পোনেন্ট (`PointerRoot.tsx`) — `ImageView` বিটম্যাপ ও `createPointerBitmap()` সরানো হয়।
- **নেটিভ অবস্থানের মালিক** (`PointerOverlay`-এ `cursorX`/`cursorY`); RN তীর মুভের সময় কখনো রি-রেন্ডার হয় না — মুভমেন্ট শুধু `updateViewLayout()` (পরিকল্পনা §৬.৪)।
- উইন্ডো টাইপ অগ্রাধিকার: **প্রথমে a11y ওভারলে** (`SYSTEM_ALERT_WINDOW` লাগে না), **অ্যাপ-ওভারলে ফলব্যাক** শুধু IME-কেসে, নাহলে `show()` `false` দেয় → `Touchpad.tsx`-এর বিদ্যমান পারমিশন ব্যানার দেখায় (পরিকল্পনা §৬.২)।
- ক্ল্যাম্পিং এখন **পুরো স্ক্রিন** (`0..screenW`, `0..screenH`) — আর "কীবোর্ডের উপরে" নয় (পরিকল্পনা §২.২)।
- JS API (`pointerShow/pointerMove/pointerHide`, আপেক্ষিক `(dx, dy)` ডেল্টা) **অপরিবর্তিত** — `Touchpad.tsx` ও `modules/kickkey-module/index.ts`-এর সিগনেচার একই থাকে; শুধু JS-এ প্রতি-ফ্রেম থ্রটল যোগ হয় (পরিকল্পনা §১৭)।

---

## 3. ধাপে ধাপে বাস্তবায়ন

### ধাপ ১ — RN কার্সর কম্পোনেন্ট তৈরি করুন

**নতুন ফাইল:** `src/keyboard/pointer/PointerRoot.tsx`

`react-native-svg` (ইতিমধ্যে ডিপেন্ডেন্সি) দিয়ে আঁকা একটি স্থির তীর; পাথটি `icons.tsx`-এ ব্যবহৃত FA5 `mouse-pointer` গ্লিফের মতোই। `pointerEvents="none"` + উইন্ডোর `FLAG_NOT_TOUCHABLE` নিশ্চিত করে টাচ নিচের অ্যাপেই যায়।

```tsx
// ============================================================
// PointerRoot.tsx — the "KickKeyPointer" React surface.
//
// A small static mouse arrow rendered in its own overlay window.
// It NEVER re-renders while moving: native (PointerOverlay) owns
// the position and only calls WindowManager.updateViewLayout().
//
// preserveAspectRatio="xMinYMin meet" pins the arrow's tip to the
// window's top-left corner — that corner is the cursor hotspot
// (where M3 will dispatch clicks).
// ============================================================

import React, { useEffect } from 'react';
import { View, StyleSheet, NativeModules } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// FontAwesome 5 solid "mouse-pointer" (viewBox 0 0 320 512)
const ARROW_D =
  'M302.189 329.126H196.105l55.831 135.993c3.889 9.428-.555 19.999-9.444 23.999l-49.165 21.427c-9.165 4-19.443-.571-23.332-9.714l-53.053-129.136-86.664 89.138C18.729 472.71 0 463.554 0 447.977V18.299C0 1.899 19.921-6.096 30.277 5.443l284.412 292.542c11.472 11.179 3.007 31.141-12.5 31.141z';

export default function PointerRoot() {
  // Same readiness signal the IME and floating-panel roots send: lets native
  // resume the keyboard ReactHost so Fabric applies this surface's mount
  // items (see PointerOverlay.resumeHostWhenReady).
  useEffect(() => {
    try {
      const p = NativeModules.KickKey?.keyboardReady?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
      console.warn('[KickKey] PointerRoot keyboardReady failed:', e);
    }
  }, []);

  return (
    <View style={styles.root} pointerEvents="none">
      <Svg
        width={32}
        height={32}
        viewBox="0 0 320 512"
        preserveAspectRatio="xMinYMin meet"
      >
        {/* drop shadow (offset slightly, drawn first) */}
        <Path d={ARROW_D} fill="rgba(0,0,0,0.35)" transform="translate(12,14)" />
        {/* white body + thin dark outline */}
        <Path d={ARROW_D} fill="#ffffff" stroke="#1a1a2e" strokeWidth={14} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent', // nothing but the arrow
  },
});
```

---

### ধাপ ২ — কীবোর্ড বান্ডেলে পয়েন্টার রুট নিবন্ধন করুন

**সম্পাদনা:** `keyboard.index.js`

**২ক.** ইমপোর্ট যোগ করুন (অন্য ইমপোর্টের পাশে):

```js
import PointerRoot from './src/keyboard/pointer/PointerRoot';
```

**২খ.** ফাইলের নিচে তৃতীয় রুট নিবন্ধন করুন:

```js
/**
 * Register the cursor component for the system-wide pointer.
 * The name 'KickKeyPointer' MUST match the second argument of
 * host.createSurface() in PointerOverlay.kt
 */
AppRegistry.registerComponent('KickKeyPointer', () => PointerRoot);
```

> একই `keyboard.bundle` — বিল্ড-স্ক্রিপ্ট পরিবর্তনের দরকার নেই। মডিউল-স্কোপ মাউন্ট পাম্প এই surface-এর ইভেন্ট লুপও জীবিত রাখে।

---

### ধাপ ৩ — নেটিভ কার্সর ম্যানেজার তৈরি করুন

**নতুন ফাইল:** `native-files/java/com/kickkey/PointerOverlay.kt`

একটি Kotlin `object` (সিংগলটন) যা কার্সর উইন্ডো + অবস্থানের মালিক। **সব মেথড মূল থ্রেডে কল করতে হবে** — `KickKeyModule` পোস্ট করে (ধাপ ৪), পুরনো পয়েন্টার কোডের থ্রেডিং-এর মতোই।

```kotlin
package com.kickkey

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.accessibility.AccessibilityManager
import android.widget.FrameLayout
import com.facebook.react.ReactHost
import com.facebook.react.common.LifecycleState
import com.facebook.react.interfaces.fabric.ReactSurface

/**
 * M2 — the system-wide on-screen mouse cursor.
 *
 * The cursor is a small React Native surface ("KickKeyPointer", from the
 * keyboard ReactHost / keyboard.bundle) placed in its own overlay window.
 * Native owns the position (cursorX/cursorY); the RN arrow never re-renders
 * while moving — movement is pure WindowManager.updateViewLayout().
 *
 * Window type priority (plan §6):
 *   1. TYPE_ACCESSIBILITY_OVERLAY — KickKeyAccessibilityService enabled
 *      (no SYSTEM_ALERT_WINDOW needed).
 *   2. TYPE_APPLICATION_OVERLAY (or TYPE_PHONE on API 24-25) — IME-only
 *      fallback, requires "Display over other apps".
 *   3. Neither → show() returns false; JS shows the permission banner.
 *
 * Threading: all methods are MAIN-THREAD ONLY. KickKeyModule posts to the
 * main looper before calling (same pattern as the removed ImageView code).
 *
 * The surface is created lazily on first show and kept alive for the process
 * lifetime (a tiny static arrow — no per-move re-renders).
 */
object PointerOverlay {

    private const val TAG = "KickKeyPointer"
    private const val CURSOR_SIZE_DP = 32

    private val mainHandler = Handler(Looper.getMainLooper())

    private var appContext: Context? = null
    private var cursorSurface: ReactSurface? = null
    private var cursorView: View? = null
    private var visible = false

    // Single source of truth for the cursor position (screen coordinates of
    // the window's top-left corner). Read by M3's click/scroll methods.
    var cursorX = 0f
        private set
    var cursorY = 0f
        private set

    private val cursorSizePx: Int
        get() = (CURSOR_SIZE_DP * (appContext?.resources?.displayMetrics?.density ?: 1f)).toInt()

    private fun screenWidthPx(): Int = appContext?.resources?.displayMetrics?.widthPixels ?: 0
    private fun screenHeightPx(): Int = appContext?.resources?.displayMetrics?.heightPixels ?: 0

    private fun isAccessibilityServiceEnabled(context: Context): Boolean {
        // Direct singleton check (same :ime_process)
        if (KickKeyAccessibilityService.instance != null) return true

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

        if (enabledViaManager) return true

        val raw = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: ""
        return raw.contains("KickKeyAccessibilityService")
    }

    /** Returns the window type to use, or null when no overlay channel exists. */
    private fun resolveWindowType(context: Context): Int? {
        if (isAccessibilityServiceEnabled(context)) {
            return WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
        }
        return when {
            Settings.canDrawOverlays(context) -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_PHONE
                }
            }
            else -> null
        }
    }

    /**
     * Shows the cursor. Returns false when no overlay channel is available
     * (JS then shows the permission banner). Main thread only.
     */
    fun show(context: Context): Boolean {
        if (visible) return true
        appContext = context.applicationContext
        val type = resolveWindowType(context) ?: return false

        if (cursorSurface == null) {
            if (!createSurface(context)) return false
        }
        visible = true
        attachWindow(type, 0)
        return true
    }

    /**
     * Moves the cursor by a RELATIVE (dx, dy) delta, clamped to the whole
     * screen (0..screenW, 0..screenH — no "above the keyboard" limit).
     * Main thread only. Called at most once per frame from JS.
     */
    fun move(dx: Float, dy: Float) {
        val view = cursorView ?: return
        try {
            val wm = appContext?.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return
            val size = cursorSizePx
            cursorX = (cursorX + dx).coerceIn(0f, (screenWidthPx() - size).coerceAtLeast(0).toFloat())
            cursorY = (cursorY + dy).coerceIn(0f, (screenHeightPx() - size).coerceAtLeast(0).toFloat())
            val params = view.layoutParams as WindowManager.LayoutParams
            params.x = cursorX.toInt()
            params.y = cursorY.toInt()
            wm.updateViewLayout(view, params)
        } catch (e: Exception) {
            Log.w(TAG, "move failed: ${e.message}")
        }
    }

    /** Hides the cursor (window removed; the surface stays alive). Main thread only. */
    fun hide() {
        if (!visible && cursorView == null) return
        visible = false
        try {
            cursorView?.let { container ->
                (container as? FrameLayout)?.removeAllViews()
                (appContext?.getSystemService(Context.WINDOW_SERVICE) as? WindowManager)?.removeView(container)
            }
        } catch (e: Exception) {
            Log.w(TAG, "hide failed: ${e.message}")
        }
        cursorView = null
        Log.i(TAG, "Cursor hidden")
    }

    fun isVisible(): Boolean = visible

    // ── Internals ──────────────────────────────────────────────────────────

    private fun createSurface(context: Context): Boolean {
        return try {
            val app = context.applicationContext as KickKeyApplication
            val host = app.keyboardReactHost
            val surface = host.createSurface(app, "KickKeyPointer", null)
            surface.start()
            cursorSurface = surface
            // Fabric needs the host RESUMED to apply mount items (same mechanism
            // as the IME watchdog). PointerRoot signals readiness via keyboardReady().
            resumeHostWhenReady(host, 0)
            Log.i(TAG, "Cursor ReactSurface created and started")
            true
        } catch (e: Throwable) {
            Log.e(TAG, "createSurface failed", e)
            false
        }
    }

    /**
     * Attaches the surface view to the overlay window. The surface view can be
     * null briefly right after start(); retry for ~1s. Aborts if hide() ran.
     */
    private fun attachWindow(type: Int, attempt: Int) {
        if (!visible) return
        val surface = cursorSurface ?: return
        val surfaceView = surface.view
        if (surfaceView == null) {
            if (attempt < 10) {
                mainHandler.postDelayed({ attachWindow(type, attempt + 1) }, 100)
            } else {
                Log.e(TAG, "Cursor surface view never appeared — resetting for next show")
                visible = false
            }
            return
        }
        try {
            val wm = appContext?.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return
            val size = cursorSizePx

            // Detach from previous parent if already attached to avoid IllegalStateException
            (surfaceView.parent as? ViewGroup)?.removeView(surfaceView)

            val container = FrameLayout(appContext).apply {
                layoutParams = FrameLayout.LayoutParams(size, size)
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
            }
            container.addView(
                surfaceView,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            )

            val params = WindowManager.LayoutParams(
                size,
                size,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                // Center on screen on first show; preserve position between subsequent drags
                if (cursorX == 0f && cursorY == 0f) {
                    cursorX = (screenWidthPx() - size) / 2f
                    cursorY = (screenHeightPx() - size) / 2f
                }
                x = cursorX.toInt()
                y = cursorY.toInt()
            }

            wm.addView(container, params)
            cursorView = container
            Log.i(TAG, "Cursor window attached (type=$type, $size x $size px at $cursorX,$cursorY)")
        } catch (e: Throwable) {
            Log.e(TAG, "attachWindow failed", e)
            visible = false
            cursorView = null
        }
    }

    /**
     * Polls (50ms × up to 600 ≈ 30s) for the keyboard JS mount signal, then
     * resumes the keyboard ReactHost so Fabric's DispatchUIFrameCallback applies
     * this surface's mount items. Idempotent if the host is already RESUMED.
     */
    private fun resumeHostWhenReady(host: ReactHost, attempt: Int) {
        if (!visible) return
        if (attempt >= 600) {
            Log.w(TAG, "Cursor: JS never signalled readiness — cursor may stay blank (see Troubleshooting §6)")
            return
        }
        mainHandler.postDelayed({
            if (!visible) return@postDelayed
            if (host.lifecycleState == LifecycleState.RESUMED) return@postDelayed
            if (KickKeyModule.keyboardJsReady) {
                try {
                    host.onHostResume(null)
                    Log.i(TAG, "Cursor: host resumed (lifecycle=${host.lifecycleState})")
                } catch (e: Exception) {
                    Log.w(TAG, "Cursor: host resume failed: ${e.message}")
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

### ধাপ ৪ — `KickKeyModule`-কে `PointerOverlay`-তে পুনঃনির্দেশ করুন (বিটম্যাপ পয়েন্টার সরান)

**সম্পাদনা:** `native-files/java/com/kickkey/KickKeyModule.kt`

**৪ক.** পুরো পুরনো পয়েন্টার ব্লকটি প্রতিস্থাপন করুন — কমেন্ট লাইন `// ── Touchpad: on-screen mouse pointer overlay ─...` ( `mouseClick`-এর পরে) থেকে `pointerHide`-এর শেষ পর্যন্ত ( `@ReactMethod fun openOverlaySettings`-এর ঠিক আগে) — এর সাথে:

```kotlin
    // ── Touchpad: on-screen mouse pointer overlay (M2 — RN cursor) ──────────
    //
    // The cursor is now a React Native surface ("KickKeyPointer") managed by
    // the PointerOverlay singleton in its own overlay window (a11y overlay
    // first, app-overlay fallback). Native owns the position; the RN arrow
    // never re-renders while moving.
    //
    // All PointerOverlay calls run on the main thread (same pattern as before).

    @ReactMethod
    fun pointerShow(promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            val ok = PointerOverlay.show(reactApplicationContext)
            promise.resolve(ok)
        }
    }

    @ReactMethod
    fun pointerMove(dx: Double, dy: Double, promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            PointerOverlay.move(dx.toFloat(), dy.toFloat())
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun pointerHide(promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            PointerOverlay.hide()
            promise.resolve(null)
        }
    }
```

**৪খ.** ঐচ্ছিক ক্লিনআপ — সরানো ব্লকটি ছিল এই ইমপোর্টগুলোর একমাত্র ব্যবহারকারী; Kotlin অব্যবহৃত ইমপোর্টকে ওয়ার্নিং ধরে (রেখে দিলেও নিরাপদ), তবে ফাইল পরিষ্কার রাখতে সরিয়ে দিন:

```kotlin
// remove if no longer referenced anywhere in the file:
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.os.Build
import android.view.Gravity
```

(প্রতিটি চেক করুন — `Build`/`Gravity` ফাইলের অন্য কোডেও লাগতে পারে। `openOverlaySettings` অপরিবর্তিত থাকবে — `Touchpad.tsx`-এর পারমিশন ব্যানার ফলব্যাক ফ্লোতে এটি ব্যবহার করে।)

---

### ধাপ ৫ — `pointerMove` প্রতি ফ্রেমে এক কল থ্রটল করুন (JS)

**সম্পাদনা:** `src/keyboard/qykey/Touchpad.tsx` — পরিকল্পনার 60Hz প্রয়োজনীয়তা (§১৭): প্রতি-টাচ-ইভেন্টের বদলে ডেল্টা জমা করে প্রতিটি অ্যানিমেশন ফ্রেমে একবার ফ্লাশ করুন।

**৫ক.** বিদ্যমান অ্যাকুমুলেটরগুলোর পাশে দুটি ref যোগ করুন:

```tsx
  const accX = useRef(0);
  const accY = useRef(0);
  const lastDx = useRef(0);
  const lastDy = useRef(0);
  // ── Per-frame pointer-move throttle (plan §17) ──
  const pendingDelta = useRef({ x: 0, y: 0 });
  const rafPending = useRef(false);
```

**৫খ.** ফ্লাশ কলব্যাক যোগ করুন (`showPointerAndCheck`-এর পরে):

```tsx
  // Flushes accumulated deltas to native at most once per animation frame.
  const flushPointerMove = useCallback(() => {
    rafPending.current = false;
    const { x, y } = pendingDelta.current;
    pendingDelta.current = { x: 0, y: 0 };
    if (x !== 0 || y !== 0) {
      onPointerMoveRef.current?.(x, y);
    }
  }, []);
```

**৫গ.** `onPanResponderMove`-এ সরাসরি পয়েন্টার কলটি প্রতিস্থাপন করুন:

```tsx
        // Move the on-screen desktop pointer (relative, trackpad-style)
        onPointerMoveRef.current?.(deltaX, deltaY);
```

বatched সংস্করণ দিয়ে:

```tsx
        // Move the on-screen desktop pointer (relative, trackpad-style),
        // batched and flushed once per animation frame (60Hz cap).
        pendingDelta.current.x += deltaX;
        pendingDelta.current.y += deltaY;
        if (!rafPending.current) {
          rafPending.current = true;
          requestAnimationFrame(flushPointerMove);
        }
```

**৫ঘ.** তিনটি রিসেট পয়েন্টে (`onPanResponderGrant`, `onPanResponderRelease`, `onPanResponderTerminate`) থ্রটল স্টেট রিসেট করুন — যেখানেই `accX.current = 0;` আছে সেখানে এই দুটি লাইন যোগ করুন:

```tsx
        pendingDelta.current = { x: 0, y: 0 };
        rafPending.current = false;
```

> DPAD টেক্সট-কেয়ারেট স্টেপিং (`STEP_THRESHOLD` → `onMoveCursor`) ইচ্ছাকৃতভাবে **M2-এ অপরিবর্তিত** — ফোকাসড ফিল্ডে টেক্সট কেয়ারেট সরায়। M3-এ একে প্রকৃত ক্রস-অ্যাপ ইনপুট দিয়ে প্রতিস্থাপন হবে।

---

### ধাপ ৬ — ব্রিজ মডিউলের ডক কমেন্ট আপডেট করুন (ঐচ্ছিক)

**সম্পাদনা:** `modules/kickkey-module/index.ts` — মেথডের **নাম ও সিগনেচার অপরিবর্তিত**, তাই M2-এর কাজ করার জন্য কিছু লাগবে না। ঐচ্ছিকভাবে পুরনো কমেন্ট হালনাগাদ করুন:

```ts
  /** Shows the RN cursor over the whole screen. Resolves true when visible; false
   *  when neither the accessibility service nor "Display over other apps" is available. */
  pointerShow: (): Promise<boolean> => KickKey.pointerShow(),
```

(`pointerHide` / `pointerMove`-এর কমেন্ট থাকতে পারে — আচরণ একই।)

---

## 4. বিল্ড ও ইনস্টল

```bash
cd react-native-kickKey-deepseek

# 1. কীবোর্ড বান্ডেল পুনর্নির্মাণ (এবার তিনটি রুট)
node scripts/build-keyboard-bundle.js

# 2. android প্রজেক্ট পুনর্নির্মাণ (নতুন Kotlin ফাইল withImeService দিয়ে কপি হয়)
npx expo prebuild --platform android

# 3. নতুন ফাইল এসেছে কি না যাচাই
ls android/app/src/main/java/com/kickkey/PointerOverlay.kt

# 4. বিল্ড ও ইনস্টল
npx expo run:android
```

---

## 5. ম্যানুয়াল টেস্ট স্ক্রিপ্ট (M2 প্রস্থানের মানদণ্ড)

**সেটআপ:** M1 সম্পন্ন থাকতে হবে (a11y সার্ভিস সক্রিয়, বাটন/শর্টকাট বরাদ্দ) **অথবা** Settings-এ KickKey-কে "Display over other apps" দিন।

| # | ধাপ | প্রত্যাশিত |
|---|---|---|
| 1 | যেকোনো অ্যাপ খুলুন, টেক্সট ফিল্ড ফোকাস করুন → KickKey কীবোর্ড খোলে | — |
| 2 | **স্লাইডার** টগল করুন (উপরে-বাম) → টাচপ্যাড মোড | **RN তীর কার্সর** স্ক্রিনের **কেন্দ্রে** দেখা যায় (পুরনো বিটম্যাপ নয়) |
| 3 | টাচপ্যাড সারফেসে ড্র্যাগ করুন | কার্সর আঙুলের আপেক্ষিক মুভমেন্ট অনুসরণ করে, মসৃণ (~60Hz, ঝাঁকুনি নেই) |
| 4 | চার কোণে ড্র্যাগ করুন | কার্সর **পুরো স্ক্রিনে** পৌঁছায় — উপরে, নিচে (কীবোর্ড এলাকার উপর দিয়ে), বাম, ডান — এবং কিনারায় থামে (ফুল-স্ক্রিন ক্ল্যাম্প) |
| 5 | কীবোর্ডের নিচে অন্য অ্যাপে (যেমন ব্রাউজার লিস্ট) ড্র্যাগ করুন | কার্সর অ্যাপ কন্টেন্টের উপর ভাসে — আর "কীবোর্ডের উপরের জায়গায়" সীমাবদ্ধ নেই |
| 6 | স্লাইডার কীবোর্ডে ফেরান / কীবোর্ড বন্ধ করুন | কার্সর চলে যায় |
| 7 | (A11y পথ) accessibility বাটনে ফ্লোটিং প্যানেল খুলুন (M1), স্লাইডারে টাচপ্যাড — **কোনো ইনপুট ফিল্ড ফোকাস নেই** | কার্সর দেখা যায় এবং একইভাবে পুরো স্ক্রিনে চলে |
| 8 | পারমিশন চেক: a11y সার্ভিস ও ওভারলে পারমিশন — কোনোটি না থাকলে | `pointerShow` false দেয় → টাচপ্যাডে বিদ্যমান ব্যানার "Mouse pointer hidden — enable Display over other apps" দেখায় |
| 9 | রিগ্রেশন: কীবোর্ড মোড (স্লাইডার বন্ধ) | টাইপিং, ব্যাকস্পেস, কেয়ারেট তীর — সব অপরিবর্তিত |

**পারফ চেক (ঐচ্ছিক):** ড্র্যাগের সময় `adb logcat | grep -E "KickKeyPointer|KickKeyModule"` — `pointerMove` কোনো এক্সেপশন ছাড়া চলে; কোনো ড্রপড-ফ্রেম ওয়ার্নিং নেই। (গভীর `systrace` প্রোফাইলিং M5-এ।)

**পরিচ্ছন্নতা চেক:** `grep -n "createPointerBitmap" native-files/java/com/kickkey/KickKeyModule.kt` → **কোনো ম্যাচ নেই** (বিটম্যাপ পয়েন্টার সম্পূর্ণ সরানো)।

**পাস = কার্সর RN-এ রেন্ডার হয়, মসৃণভাবে চার কিনারায় পৌঁছায়, টগল-অফে চলে যায়, IME ও a11y ফ্লোটিং প্যানেল — দুই পথেই কাজ করে।**

---

## 6. সমস্যা সমাধান (Troubleshooting)

| লক্ষণ | সম্ভাব্য কারণ | সমাধান |
|---|---|---|
| কার্সর উইন্ডো (32dp) দেখা যায় কিন্তু **ফাঁকা/স্বচ্ছ** | পুরনো বান্ডেল — `KickKeyPointer` রুট নেই, বা হোস্ট রিজিউম হয়নি | `adb logcat \| grep -E "KickKeyPointer"`-তে "host resumed" / "never signalled readiness" দেখুন। বান্ডেল পুনর্নির্মাণ (`node scripts/build-keyboard-bundle.js`) + পুনরায় ইনস্টল |
| logcat-এ "Component KickKeyPointer not registered" | ধাপ ২-এর আগে বান্ডেল তৈরি হয়েছিল | বান্ডেল পুনর্নির্মাণ + পুনরায় ইনস্টল |
| `pointerShow` সবসময় false দেয় | a11y সার্ভিস সক্রিয় নয়, ওভারলে পারমিশনও নেই | সার্ভিস চালু করুন (M1) বা "Display over other apps" দিন |
| কার্সর এখনো কীবোর্ডের উপরে ক্ল্যাম্পড | পুরনো APK / পুরনো কোড চলছে | পুনর্নির্মাণ + পুনরায় ইনস্টল; `PointerOverlay.kt` আছে কি না যাচাই (ধাপ ৪ §৩) |
| কার্সর আঙুলের পেছনে পড়ে | প্রতি ফ্রেমে একাধিক `pointerMove`, বা ভারী JS ফ্রেম | ধাপ ৫-এর থ্রটল বসানো আছে কি না যাচাই; ড্রপড-ফ্রেমের জন্য logcat দেখুন |
| কার্সর ফ্লোটিং প্যানেলের **নিচে** দেখা যায় | একই অ্যাপের দুটি a11y ওভারলে উইন্ডো; পরে যোগ করা উপরে থাকে | স্বাভাবিক ফ্লো (প্যানেল খুলুন → টাচপ্যাড) কার্সরকে প্যানেলের পরে যোগ করে → কার্সর উপরে। নিচে গেলে স্লাইডার অফ/অন করুন |
| অ্যাপ/IME প্রসেস কিল হলে কার্সর উধাও | প্রসেস ডেথে surface মারা যায় | স্বাভাবিক Android আচরণ — পরের `pointerShow`-এ কার্সর আবার আসে |
| ধীর ডিভাইসে প্রথম শো ~1s লাগে | Surface ভিউ লেজিলি তৈরি + হোস্ট রিজিউম | প্রত্যাশিত; `attachWindow` রিট্রাই লুপ (১s পর্যন্ত) সামলায়। পরের শো তাৎক্ষণিক (surface জীবিত থাকে) |

---

## 7. M2-এর পরিধির বাইরে (স্থগিত)

| মাইলফলক | স্থগিত কাজ |
|---|---|
| M3 | `dispatchGesture` ক্লিক (`cursorX/cursorY`-তে `tapAt`/`longPressAt`), সোয়াইপ স্ক্রল, `GLOBAL_ACTION_BACK`, IME স্ট্রিপ মোড, টাচপ্যাড L/R/স্ক্রল/ব্যাক বাটন রিওয়্যারিং, DPAD কেয়ারেট স্টেপিং প্রতিস্থাপন |
| M4 | Pro mode (`INJECT_EVENTS` hover/হুইল/Forward) |
| M5 | নতুন surface-এর ওয়াচডগ, লেজি প্রি-ওয়ার্ম, ব্যাটারি-অপ্টিমাইজড কার্সর surface টিয়ারডাউন, Play ঘোষণা |

ইচ্ছাকৃতভাবে M2-এ **না** থাকা বিষয়:
- ট্যাপ-টু-ক্লিক (M3, বাটন রিওয়্যারিংসহ)।
- টাচপ্যাড মোডে IME স্ট্রিপের উপরে কার্সর (স্ট্রিপ মোড নিজেই M3-এর)।
- অন্য অ্যাপে ক্লিক/hover (M3)।

---

## 8. সমাপ্তির মানদণ্ড (Definition of Done)

- [ ] `src/keyboard/pointer/PointerRoot.tsx` আছে (স্থির SVG তীর, `pointerEvents="none"`)
- [ ] `keyboard.index.js`-এ `KickKeyPointer` নিবন্ধিত
- [ ] `native-files/java/com/kickkey/PointerOverlay.kt` আছে (show/move/hide, ফুল-স্ক্রিন ক্ল্যাম্প, উইন্ডো-টাইপ অগ্রাধিকার)
- [ ] `KickKeyModule.kt`: পুরনো `ImageView` পয়েন্টার ব্লক (ফিল্ড + `createPointerBitmap` + ৩টি মেথড) `PointerOverlay` ডেলিগেশন দিয়ে প্রতিস্থাপিত; `grep createPointerBitmap` → কোনো ম্যাচ নেই
- [ ] `Touchpad.tsx`: `pointerMove` প্রতি ফ্রেমে একবার ফ্লাশ (`requestAnimationFrame` গেট)
- [ ] বান্ডেল পুনর্নির্মিত, অ্যাপ পুনরায় ইনস্টল করা, prebuild-এর পর `PointerOverlay.kt` `android/`-তে আছে
- [ ] §৫ টেস্ট স্ক্রিপ্ট পাস (RN কার্সর, পুরো-স্ক্রিন মুভমেন্ট, টগল-অফে লুকানো, IME + a11y প্যানেল পথ)
- [ ] টেস্ট চলাকালীন logcat-এ `KickKeyPointer` এরর নেই

**সব চেক শেষে → M3-তে যান (accessibility সার্ভিস দিয়ে ক্রস-অ্যাপ ক্লিক / স্ক্রল / ব্যাক)।**
