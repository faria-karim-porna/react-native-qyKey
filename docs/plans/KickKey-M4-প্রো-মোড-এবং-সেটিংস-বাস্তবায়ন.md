# KickKey — M4 বাস্তবায়ন গাইড
## প্রো মোড (`INJECT_EVENTS`), সেটিংস UI, পারমিশন ফ্লো ও প্যানেল নোটিফিকেশন

> **প্ল্যাটফর্ম:** শুধুমাত্র Android · **প্রজেক্ট:** `react-native-kickKey-deepseek` · **মাইলফলক:** M4 · **অবস্থা:** বাস্তবায়নের জন্য প্রস্তুত
> অনুমোদিত পরিকল্পনা অনুসরণ করে: [`KickKey-অ্যাক্সেসিবিলিটি-টাচপ্যাড-পরিকল্পনা.md`](./KickKey-অ্যাক্সেসিবিলিটি-টাচপ্যাড-পরিকল্পনা.md)
> পূর্বশর্ত: M1 (a11y সার্ভিস + প্যানেল) + M2 (RN কার্সর) + M3 (ক্রস-অ্যাপ ক্লিক/স্ক্রল/ব্যাক)। এই ফোল্ডারের M1/M2/M3 গাইড দেখুন।

---

## 1. M4 কী দেবে

| পরিকল্পনা §২৬ থেকে | M4 — প্রো মোড + সেটিংস |
|---|---|
| পরিধি | `INJECT_EVENTS` র‍্যাপার (`ProModeInjector.kt`: hover / হুইল / Forward), সেটিংস UI (ট্যাপ-টু-ক্লিক, প্রো-মোড টগল, a11y স্ট্যাটাস রো), পারমিশন ফ্লো (ADB গ্র্যান্ট, `POST_NOTIFICATIONS`), নোটিফিকেশন এন্ট্রি পয়েন্ট |
| প্রস্থানের মানদণ্ড | **Android ≤ 11 ডিভাইসে প্রো মোড কাজ করে** (প্রকৃত hover, হুইল স্ক্রল, Forward); **অন্য সব জায়গায় মসৃণ ফলব্যাক** (M3 আচরণ, কিছুই ভাঙে না) |

**এক বাক্যে:** এই মাইলফলকের পর টাচপ্যাডে একটি ঐচ্ছিক **প্রো মোড** যোগ হয় — যা ADB (বা root) দিয়ে Android ≤ 11-এ গ্র্যান্ট করা signature অনুমতি `INJECT_EVENTS` দিয়ে আনলক হয় — যা a11y-র আনুমানিক আচরণ বদলে **প্রকৃত মাউস আচরণ** দেয় (hover-এ লিংক হাইলাইট/টুলটিপ, পিক্সেল-পারফেক্ট হুইল স্ক্রল, Forward আসলেই নেভিগেট করে), এবং কম্প্যানিয়ন অ্যাপে অ্যাক্সেসিবিলিটি স্ট্যাটাস, প্রো মোড, ট্যাপ-টু-ক্লিক ও প্যানেল নোটিফিকেশনের জন্য একটি প্রকৃত **সেটিংস সারফেস** পায়।

পরিকল্পনার ক্যাপাবিলিটি টেবিল (§১০, §১৩) — প্রো মোড M3-এর a11y পথের **উপর যোগ হয়**, কখনো প্রতিস্থাপন করে না:

| ফিচার | a11y পথ (ডিফল্ট, M3) | প্রো মোড (Android ≤ 11 + `adb pm grant`) |
|---|---|---|
| পয়েন্টার মুভমেন্ট | RN কার্সর ওভারলে (M2) | একই |
| লেফট / রাইট ক্লিক | `dispatchGesture` ট্যাপ / লং-প্রেস (M3) | একই — `INJECT_EVENTS` লাগে না |
| Back | `GLOBAL_ACTION_BACK` (M3) | একই |
| **Hover** | নেই (শুধু কার্সর) | `HOVER_MOVE` — লিংক হাইলাইট, টুলটিপ, hover স্টেট |
| **স্ক্রল** | ফোকাসড নোডে `ACTION_SCROLL` → সোয়াইপ স্ট্রোক | `MotionEvent.ACTION_SCROLL` হুইল ইভেন্ট (পিক্সেল-পারফেক্ট, মাউস-সদৃশ) |
| **Forward** | ফোকাসড নোডে `ACTION_SCROLL_FORWARD` → "সাপোর্টেড নয়" ইঙ্গিত | `KEYCODE_FORWARD` — প্রকৃত ব্রাউজার/অ্যাক্টিভিটি হিস্ট্রি ফরোয়ার্ড |

**ফলব্যাক নিয়ম (পরিকল্পনা §১৫ + §১৯):** প্রো মোড কেবল তখনই সক্রিয় হয় যখন রানটাইমে দুটি শর্ত সত্য — (১) `INJECT_EVENTS` সত্যিই গ্র্যান্টেড (`checkSelfPermission`), এবং (২) ব্যবহারকারী সেটিংসে এটি চালু করেছেন। অন্য যেকোনো ডিভাইসে (Play Store ইনস্টল, Android 12+, অনুমতি নেই) প্রতিটি প্রো-মোড কল **নো-অপ** এবং টাচপ্যাড M3-পরবর্তী অবস্থার মতোই আচরণ করে। M4-এর কোনো কিছুই a11y পথ ভাঙতে পারে না।

**প্ল্যাটফর্ম সতর্কতা, পরিষ্কারভাবে বলা (পরিকল্পনা §১০, §১৯):** `InputManager.injectInputEvent()` **Android 12+ এ targetSdk 31+ থাকলে ব্লকড** — অনুমতি থাকলেও `SecurityException` ছোড়ে। প্রো মোড বাস্তবিক অর্থে **Android ≤ 11 + ADB গ্র্যান্ট** ফিচার (বা rooted ডিভাইস)। `INJECT_EVENTS` ম্যানিফেস্টে ঘোষিত হয় কিন্তু **Play Store কখনো গ্র্যান্ট করে না**, তাই প্রো মোড Play-তে অদৃশ্য থাকে: স্টোর ইনস্টলে ফিচারটির অস্তিত্বই থাকে না।

---

## 2. আর্কিটেকচার রিক্যাপ

```
                          ┌──────────────────────────────────────────────┐
                          │                 কম্প্যানিয়ন অ্যাপ            │
                          │  app/(tabs)/settings.tsx (M4)               │
                          │    • Accessibility কার্ড (স্ট্যাটাস + ডিপ লিংক) │
                          │    • প্রো মোড কার্ড (গ্র্যান্টেড হলে দেখানো হয়) │
                          │    • Touchpad কার্ড (ট্যাপ-টু-ক্লিক)            │
                          │    • Notifications কার্ড (প্যানেল নোটিফিকেশন)  │
                          └───────────────┬──────────────────────────────┘
                                          │ KickKey.isProModeAvailable() / setProModeEnabled()
                                          │ requestNotificationPermission() / togglePanelNotification()
                                          ▼
                          KickKeyModule (KickKeyModule.kt, M4 সংযোজন)
   ┌──────────────────────────────────────┼───────────────────────────────────────┐
   │                                      │                                       │
   ▼                                      ▼                                       ▼
ProModeInjector.kt (নতুন)        KickKeyAccessibilityService.kt        KickKeyNotificationReceiver.kt (নতুন)
   └─ isAvailable/isEnabled      └─ scrollAt: প্রো মোডে প্রথমে হুইল,      └─ ACTION_OPEN_PANEL ব্রডকাস্ট
   └─ hover(x,y) → HOVER_MOVE       তারপর নোড অ্যাকশন, শেষে                └─ KickKeyAccessibilityService
   └─ wheel(x,y,dy) → ACTION_SCROLL  সোয়াইপ (M3)                            .instance?.showFloatingPanel()
   └─ forward() → KEYCODE_FORWARD  └─ navigateHistory('forward'):
   └─ inject() try/catch → false     প্রো-মোড forward, নাহলে M3
        (Android 12+ SecurityException)

   ইভেন্ট: onProModeChanged, onNotificationPermissionChanged (Kotlin → JS)
   প্রিফ (kickkey_prefs): proModeEnabled, tapToClick (M3), panelNotification
```

একই-প্রসেস নোট: `ProModeInjector` `:ime_process` থেকে (সার্ভিস + কীবোর্ড বান্ডল) এবং মূল প্রসেস থেকে (সেটিংস স্ক্রিন — সেখানে শুধু `isAvailable`/`isEnabled` পড়া হয়, কখনো ইনজেকশন নয়) ডাকা হয়। দুটি প্রসেসেরই একই UID, তাই সেটিংস স্ক্রিন থেকে চাওয়া `POST_NOTIFICATIONS` গ্র্যান্ট `:ime_process`-এর নোটিফিকেশনেও প্রযোজ্য।

---

## 3. ধাপে ধাপে বাস্তবায়ন

### ধাপ 1 — `ProModeInjector.kt` তৈরি

**নতুন ফাইল:** `native-files/java/com/kickkey/ProModeInjector.kt`

`InputManager.injectInputEvent()`-এর একমাত্র র‍্যাপার। সবকিছু রানটাইমে পারমিশন-গার্ডেড; প্রো মোড বন্ধ থাকলে প্রতিটি কল `false`/নো-অপ-এ নেমে যায়, তাই কলারদের M3 ফলব্যাক অটুট থাকে।

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

    /** android.permission.INJECT_EVENTS সত্যিই গ্র্যান্টেড কিনা (adb/root)। */
    fun isAvailable(context: Context): Boolean =
        context.checkSelfPermission(Manifest.permission.INJECT_EVENTS) ==
            PackageManager.PERMISSION_GRANTED

    /** অনুমতিও আছে AND ব্যবহারকারী সেটিংসে প্রো মোড চালু করেছেন কিনা। */
    fun isEnabled(context: Context): Boolean {
        if (!isAvailable(context)) return false
        val prefs = context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
        return prefs.getBoolean("proModeEnabled", false)
    }

    // ── Hover ──────────────────────────────────────────────────────────────
    /** (x, y)-তে প্রকৃত মাউস hover — লিংক হাইলাইট, টুলটিপ, hover স্টেট। */
    fun hover(context: Context, x: Float, y: Float) {
        if (!isEnabled(context)) return
        val now = SystemClock.uptimeMillis()
        val event = MotionEvent.obtain(
            now, now, MotionEvent.ACTION_HOVER_MOVE, x, y, 0
        )
        inject(context, event)
    }

    // ── হুইল ───────────────────────────────────────────────────────────────
    /**
     * মাউস-হুইল স্ক্রল: MotionEvent.ACTION_SCROLL + উল্লম্ব-অক্ষ ডেল্টা।
     * deltaY > 0 = কনটেন্ট উপরে ("উপরেরটা দেখুন"), deltaY < 0 = নিচে।
     * (ডিভাইসভেদে চিহ্ন উল্টাতে হতে পারে; §৫ টেস্ট #৪ দেখুন।)
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
    /** KEYCODE_FORWARD ডাউন/আপ জোড়া ইনজেক্ট হলে true। */
    fun forward(context: Context): Boolean {
        if (!isEnabled(context)) return false
        val down = inject(context, KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_FORWARD))
        val up   = inject(context, KeyEvent(KeyEvent.ACTION_UP,   KeyEvent.KEYCODE_FORWARD))
        return down && up
    }

    // ── মূল ────────────────────────────────────────────────────────────────
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
            // Android 12+ targetSdk 31+ হলে অনুমতি থাকলেও injectInputEvent ব্লকড।
            // একবার লগ করে চুপচাপ চলে যাই — কলার M3 a11y পথেই থাকে।
            // JS ব্রিজে কখনো throw করবেন না।
            Log.w(TAG, "injectInputEvent blocked: ${e.message}")
            false
        } finally {
            event.recycle()
        }
    }
}
```

> API নোট: `checkSelfPermission` API 23+ (minSdk 24 — ঠিক আছে)। `KEYCODE_FORWARD` প্ল্যাটফর্ম কনস্ট্যান্ট (125)। `MotionEvent.setAxisValue(AXIS_VSCROLL, …)` হুইল ইনপুট সিন্থেসাইজ করার আদর্শ উপায়।

---

### ধাপ 2 — `KickKeyAccessibilityService.kt`-এ প্রো মোড রাউটিং

**সম্পাদনা:** `native-files/java/com/kickkey/KickKeyAccessibilityService.kt`

**2a.** স্ক্রল প্রায়োরিটি — প্রো মোডে হুইল **সবার আগে** `scrollAt`-এ (পরিকল্পনা §১২: ① হুইল ② নোড অ্যাকশন ③ সোয়াইপ)। বিদ্যমান `scrollAt`-এর শুরুটা বদলান:

```kotlin
    /** স্ক্রল হ্যান্ডেল হলে true। direction: "up" | "down" */
    fun scrollAt(direction: String, x: Float, y: Float): Boolean {
        // ① প্রো মোড: কার্সরে পিক্সেল-পারফেক্ট হুইল ইভেন্ট (পরিকল্পনা §১২.৩)।
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

        // ② a11y নোড অ্যাকশন, ③ সোয়াইপ ফলব্যাক — M3 থেকে অপরিবর্তিত।
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

**2b.** Forward — M3-এর বেস্ট-এফোর্টের আগে প্রো-মোড `KEYCODE_FORWARD`। `KickKeyModule.kt`-এর `navigateHistory` ফরোয়ার্ড শাখা (ধাপ 4) এটিকে ডাকবে; সার্ভিস মেথড:

```kotlin
    /** Forward: প্রথমে প্রো-মোড KEYCODE_FORWARD, নাহলে M3 নোড-স্ক্রল ফলব্যাক। */
    fun forwardHistory(): Boolean =
        if (ProModeInjector.isEnabled(applicationContext)) {
            ProModeInjector.forward(applicationContext)
        } else {
            performScrollOnFocusedNode(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
        }
```

**2c.** প্যানেল নোটিফিকেশন (M4 এন্ট্রি পয়েন্ট, পরিকল্পনা §৪.২ + §১৪)। একটি নোটিফিকেশন চ্যানেল + "Tap to open the KickKey touchpad panel" নোটিফিকেশন যার কনটেন্ট ইনটেন্ট নতুন রিসিভারে (ধাপ 3) ব্রডকাস্ট করে:

```kotlin
    // ── M4: প্যানেল নোটিফিকেশন এন্ট্রি পয়েন্ট ─────────────────────────────

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

    /** স্থায়ী "open panel" নোটিফিকেশন পোস্ট করে (অনুমতি না থাকলে নো-অপ)। */
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
        // ...বিদ্যমান কনস্ট্যান্ট...
        private const val PANEL_CHANNEL_ID = "kickkey_panel"
        private const val PANEL_NOTIFICATION_ID = 1001
    }
```

---

### ধাপ 3 — `KickKeyNotificationReceiver.kt` তৈরি

**নতুন ফাইল:** `native-files/java/com/kickkey/KickKeyNotificationReceiver.kt`

`:ime_process`-এ একটি ক্ষুদ্র ম্যানিফেস্ট-ঘোষিত রিসিভার — নোটিফিকেশনের কনটেন্ট ইনটেন্ট এখানে আসে এবং ইতিমধ্যে চলমান অ্যাক্সেসিবিলিটি সার্ভিসকে ফ্লোটিং প্যানেল দেখাতে বলে:

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
            // সার্ভিস চলছে না: শুরু করুন; এর onServiceConnected প্যানেল দেখায়
            // (M1 ইতিমধ্যে কোল্ড-স্টার্ট পথ হ্যান্ডেল করে)।
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

### ধাপ 4 — `KickKeyModule.kt` বাড়ানো

**সম্পাদনা:** `native-files/java/com/kickkey/KickKeyModule.kt`

মডিউলটি একটি `ReactContextBaseJavaModule` (বিদ্যমান স্টাইল)।

**4a.** ইমপোর্ট যোগ করুন (ফাইলের উপরে):

```kotlin
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
```

**4b.** `init`-এ একটি পারমিশন-রেজাল্ট লিসেনার নিবন্ধন (মডিউল থেকে রানটাইম পারমিশনের ক্লাসিক RN প্যাটার্ন):

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

**4c.** নতুন `@ReactMethod`s (টাচপ্যাড মেথডগুলোর কাছে যুক্ত করুন):

```kotlin
    // ── প্রো মোড (M4) ──────────────────────────────────────────────────────

    @ReactMethod
    fun isProModeAvailable(promise: Promise) {
        promise.resolve(ProModeInjector.isAvailable(reactApplicationContext))
    }

    /** ইউজার টগল সংরক্ষণ করে; onProModeChanged ইমিট করে (কীবোর্ড + সেটিংস)। */
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

    /** কার্সরের বর্তমান স্ক্রিন পজিশনে hover (পজিশন নেটিভের কাছে)। */
    @ReactMethod
    fun proModeHover(promise: Promise) {
        ProModeInjector.hover(
            reactApplicationContext,
            PointerOverlay.cursorX,
            PointerOverlay.cursorY
        )
        promise.resolve(null)
    }

    /** কার্সরে হুইল স্ক্রল। deltaY > 0 = উপরে, < 0 = নিচে। */
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

    /** KEYCODE_FORWARD ইনজেক্ট হলে true (শুধু প্রো মোড)। */
    @ReactMethod
    fun proModeForward(promise: Promise) {
        promise.resolve(ProModeInjector.forward(reactApplicationContext))
    }

    // ── প্যানেল নোটিফিকেশন (M4) ────────────────────────────────────────────

    /** API 33+: সিস্টেম পারমিশন ডায়ালগ; পুরনোতে সাথে সাথে true। */
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
            promise.resolve(null) // রেজাল্ট onRequestPermissionsResult-এ আসে
        } else {
            promise.resolve(false)
        }
    }

    /** a11y সার্ভিস দিয়ে "open panel" নোটিফিকেশন দেখায়/লুকায়। */
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

**4d.** `navigateHistory('forward')` সার্ভিসের প্রো-মোড-সচেতন মেথডে রি-পয়েন্ট করুন (M3-এর বিদ্যমান ফরোয়ার্ড শাখা বদলান):

```kotlin
            } else {
                // Forward: প্রথমে প্রো-মোড KEYCODE_FORWARD, তারপর M3 বেস্ট-
                // এফোর্ট নোড স্ক্রল; false → JS "not supported" ইঙ্গিত দেখায়।
                promise.resolve(svc?.forwardHistory() ?: false)
            }
```

**4e.** মডিউলের `companion object`-এ কনস্ট্যান্ট:

```kotlin
        private const val REQ_POST_NOTIFICATIONS = 5001
```

**4f.** নিশ্চিত করুন `pointerMove` প্রো মোডে hover ফিড করে — বিদ্যমান `pointerMove`-এ একটি লাইন যোগ করুন (`PointerOverlay.move`-এর পরে):

```kotlin
    @ReactMethod
    fun pointerMove(dx: Double, dy: Double, promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            PointerOverlay.move(dx.toFloat(), dy.toFloat())
            // M4: প্রো মোড চালু থাকলে পয়েন্টারের সাথে প্রকৃত hover চলে।
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

`emitEvent` হেল্পার (না থাকলে যোগ করুন):

```kotlin
    private fun emitEvent(name: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(name, params)
    }
```

---

### ধাপ 5 — `plugins/withAccessibilityService.js`-এ ম্যানিফেস্ট সংযোজন

**সম্পাদনা:** `plugins/withAccessibilityService.js` (M1-এ তৈরি — `withImeService.js` থেকে প্যাটার্ন কপি করুন)। ম্যানিফেস্ট এডিটে যোগ করুন:

```xml
<!-- Permissions -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INJECT_EVENTS" />

<!-- প্যানেল নোটিফিকেশন রিসিভার (a11y সার্ভিসের মতোই :ime_process) -->
<receiver
    android:name=".KickKeyNotificationReceiver"
    android:exported="false"
    android:process=":ime_process">
    <intent-filter>
        <action android:name="com.kickkey.action.OPEN_PANEL" />
    </intent-filter>
</receiver>
```

এছাড়া দুটি নতুন Kotlin ফাইল (`ProModeInjector.kt`, `KickKeyNotificationReceiver.kt`) প্লাগইন যেভাবে অন্য ফাইল কপি করে সেভাবে `android/app/src/main/java/com/kickkey/`-তে কপি করুন।

> `INJECT_EVENTS` একটি **signature/privileged** অনুমতি: ঘোষণা করতে কোনো খরচ নেই, Play Store কখনো গ্র্যান্ট করে না, কোনো রানটাইম ডায়ালগও ট্রিগার হয় না। এটিই প্রো মোডকে Play-তে অদৃশ্য রাখে (পরিকল্পনা §২৩)।

---

### ধাপ 6 — ব্রিজ মডিউল র‍্যাপার

**সম্পাদনা:** `modules/kickkey-module/index.ts`

```ts
  // ── প্রো মোড (M4) ───────────────────────────────────────────────────────

  /** android.permission.INJECT_EVENTS গ্র্যান্টেড কিনা (শুধু adb/root)। */
  isProModeAvailable: (): Promise<boolean> => KickKey.isProModeAvailable(),

  /** প্রো-মোড টগল সংরক্ষণ; নেটিভ onProModeChanged ইমিট করে। */
  setProModeEnabled: (enabled: boolean): Promise<void> =>
    KickKey.setProModeEnabled(enabled),

  /** কার্সরের স্ক্রিন পজিশনে hover (প্রো মোড বন্ধ থাকলে নো-অপ)। */
  proModeHover: (): Promise<void> => KickKey.proModeHover(),

  /** কার্সরে হুইল স্ক্রল। ধনাত্মক = উপরে, ঋণাত্মক = নিচে। */
  proModeWheel: (deltaY: number): Promise<void> => KickKey.proModeWheel(deltaY),

  /** KEYCODE_FORWARD ইনজেক্ট হলে true (প্রো মোড)। */
  proModeForward: (): Promise<boolean> => KickKey.proModeForward(),

  // ── প্যানেল নোটিফিকেশন (M4) ─────────────────────────────────────────────

  /** API 33+: সিস্টেম POST_NOTIFICATIONS ডায়ালগ খোলে। */
  requestNotificationPermission: (): Promise<boolean> =>
    KickKey.requestNotificationPermission(),

  /** স্থায়ী "open panel" নোটিফিকেশন দেখায়/লুকায়। */
  togglePanelNotification: (on: boolean): Promise<void> =>
    KickKey.togglePanelNotification(on),
```

**লিসেনার হেল্পার** (একই ফাইল, বা ছোট হুক):

```ts
export function onProModeChanged(cb: (d: { available: boolean; enabled: boolean }) => void) {
  return emitter.addListener('onProModeChanged', cb);
}
export function onNotificationPermissionChanged(cb: (d: { granted: boolean }) => void) {
  return emitter.addListener('onNotificationPermissionChanged', cb);
}
```

(`emitter` হলো কীবোর্ড বান্ডলে আগে থেকে ব্যবহৃত বিদ্যমান `NativeEventEmitter`।)

---

### ধাপ 7 — সেটিংস UI

**সম্পাদনা:** `app/(tabs)/settings.tsx` (+ `store/settingsStore.ts` + `hooks/useSettingsSync.ts`)

**7a.** স্টেট + পার্সিস্টেন্স যোগ করুন। `store/settingsStore.ts`-এ:

```ts
  // Touchpad / pro mode (M4)
  tapToClick: boolean;
  proModeEnabled: boolean;
  panelNotification: boolean;
  toggleTapToClick: () => void;
  setProModeEnabled: (v: boolean) => void;
  togglePanelNotification: () => void;
```

ডিফল্ট `tapToClick: true`, `proModeEnabled: false`, `panelNotification: false` এবং অনুরূপ অ্যাকশন। `hooks/useSettingsSync.ts`-এ ডিবাউন্সড `savePreferences` পেলোডে `tapToClick`, `proModeEnabled`, `panelNotification` যোগ করুন যেন কীবোর্ড বান্ডল ও নেটিভ তা দেখে।

**7b.** `settings.tsx` চারটি কার্ডে সাজান (বিদ্যমান স্টাইল রাখুন — `ToggleRow`, `styles.card`):

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

  // বিদ্যমান স্টোর টগল (haptic, sound, autoCorrect, showSuggestions) ...
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
    // proModeEnabled useSettingsSync → savePreferences দিয়ে পার্সিস্ট হয়
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

        {/* ── প্রো মোড (শুধু INJECT_EVENTS গ্র্যান্টেড হলে) ── */}
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

`styles`-এ অনুপস্থিত স্টাইল (`row`, `rowText`, `rowLabel`, `rowDesc`, `chevron`) যোগ করুন। নিচের বিদ্যমান Feedback/Typing কার্ডগুলো অপরিবর্তিত রাখুন।

---

### ধাপ 8 — কীবোর্ড-পাশের ওয়্যারিং

**সম্পাদনা:** `src/keyboard/hooks/useKeyboardState.ts` + `src/keyboard/qykey/Touchpad.tsx`

**8a.** `useKeyboardState.ts` — প্রো-মোড পরিবর্তন শুনুন এবং একটি হুইল হ্যান্ডলার দিন:

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

  /** সারফেসে দুই-আঙুল উল্লম্ব ড্র্যাগ → হুইল স্ক্রল (শুধু প্রো মোড)। */
  const handleWheel = useCallback((deltaY: number) => {
    getKickKey()?.proModeWheel(deltaY);
  }, []);
```

হুক থেকে `proMode`, `handleWheel` রিটার্ন করুন।

**8b.** `Touchpad.tsx` — নতুন ঐচ্ছিক প্রপ `onWheel?: (deltaY: number) => void` এবং `proMode?: boolean`:

- **Hover** স্বয়ংক্রিয়: `pointerMove` নেটিভেই `ProModeInjector.hover` ডাকে (ধাপ 4e), তাই hover-এর জন্য JS-এ কোনো পরিবর্তন লাগে না।
- **হুইল জেসচার**: `onPanResponderMove`-এ দ্বিতীয় টাচ ট্র্যাক করুন; দুই আঙুল নামলে প্রাইমারি টাচের উল্লম্ব ডেল্টাকে হুইল ইনপুট হিসেবে ব্যবহার করুন (প্রতি ফ্রেমে এক কল, `WHEEL_SCALE ≈ 24` px প্রতি নচ):

```tsx
      onPanResponderMove: (evt, gestureState) => {
        // ...বিদ্যমান এক-আঙুল পয়েন্টার-মুভ লজিক (M2/M3)...

        // দুই-আঙুল উল্লম্ব ড্র্যাগ = হুইল স্ক্রল (শুধু প্রো মোড)।
        if (proMode?.enabled && evt.nativeEvent.touches.length >= 2) {
          const dy = gestureState.dy - lastTwoFingerDy.current;
          lastTwoFingerDy.current = gestureState.dy;
          if (dy !== 0) onWheelRef.current?.(-dy * WHEEL_SCALE);
        }
      },
```

  `onPanResponderGrant`/`onPanResponderRelease`-এ `lastTwoFingerDy.current = 0` রিসেট করুন।
- **Forward বাটন**: কোনো পরিবর্তন লাগে না — `handleNavigateHistory('forward')` আগের মতোই নেটিভে যায়, যা এখন প্রথমে `KEYCODE_FORWARD` চেষ্টা করে (ধাপ 4c)। প্রো মোড হ্যান্ডেল করলে M3-এর "not supported" ইঙ্গিতটি কেবল দেখা বন্ধ হয়।

---

## 4. বিল্ড ও ইনস্টল

```bash
cd react-native-kickKey-deepseek

node scripts/build-keyboard-bundle.js
npx expo prebuild --platform android     # withImeService + withAccessibilityService চালায়
npx expo run:android                     # ডেভ বিল্ড
```

**ব্যক্তিগত Android ≤ 11 ডিভাইসে প্রো মোড:**

```bash
# 1. APK স্বাভাবিকভাবে ইনস্টল করুন
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# 2. ADB দিয়ে signature অনুমতি গ্র্যান্ট করুন (এটাই একমাত্র উপায় — UI গ্র্যান্ট নেই)
adb shell pm grant com.kickkey android.permission.INJECT_EVENTS

# 3. যাচাই করুন
adb shell dumpsys package com.kickkey | grep -i inject
```

তারপর Settings → Pro mode-এ "Pro mode" চালু করুন। Android 12+ এ গ্র্যান্ট সফল হলেও `injectInputEvent` এখনও throw করবে — প্রো মোড বন্ধই থাকে এবং a11y পথ (M3) সব হ্যান্ডেল করে।

> কোনো নতুন npm ডিপেন্ডেন্সি নেই। `POST_NOTIFICATIONS` রানটাইমে চাওয়া হয় (ধাপ 4b); `INJECT_EVENTS` শুধু ম্যানিফেস্টে।

---

## 5. ম্যানুয়াল টেস্ট স্ক্রিপ্ট (M4 প্রস্থানের মানদণ্ড)

**সেটআপ:** M1–M3 কাজ করছে। ডিভাইস A = Android ≤ 11 যাতে `adb pm grant` করা হয়েছে; ডিভাইস B = Android 12+ (বা স্টোর ইনস্টল) যাতে **কোনো গ্র্যান্ট নেই** — অবশ্যই M3-এর মতোই আচরণ করবে।

| # | ধাপ | প্রত্যাশিত |
|---|---|---|
| 1 | ডিভাইস A: Settings → Pro mode-এ প্রো মোড চালু | টগল অ্যাপ রিস্টার্টেও টিকে থাকে (প্রিফ সেভড); `onProModeChanged` ফায়ার হয় |
| 2 | ডিভাইস A: একটি **ব্রাউজার** খুলুন, লিংকের উপর কার্সর নিন | লিংক হাইলাইট / টুলটিপ দেখা যায় (প্রকৃত `HOVER_MOVE`) |
| 3 | ডিভাইস A: বাটনে hover করে **L** চাপুন | বাটন সক্রিয় হয় (M3-এর মতো ট্যাপ কাজ করে) |
| 4 | ডিভাইস A: লিস্টে পয়েন্ট করে **scroll-down** কেয়ারেট চেপে ধরে রাখুন | লিস্ট **হুইল ইভেন্টে** স্ক্রল করে (মসৃণ, পিক্সেল-লেভেল), সোয়াইপ নয় |
| 5 | ডিভাইস A: **Forward** শেভরন চাপুন | প্রকৃত হিস্ট্রি-ফরোয়ার্ড নেভিগেশন (`KEYCODE_FORWARD`); "not supported" ইঙ্গিত নেই |
| 6 | ডিভাইস A: টাচপ্যাড সারফেসে দুই-আঙুল ড্র্যাগ | কার্সরের নিচের অ্যাপে হুইল স্ক্রল (উপরে/নিচে) |
| 7 | ডিভাইস A: Settings → Notifications → **Panel notification** চালু | Android 13+: পারমিশন ডায়ালগ আসে; গ্র্যান্ট হলে স্থায়ী "Tap to open the KickKey touchpad panel" নোটিফিকেশন দেখায় |
| 8 | ডিভাইস A: নোটিফিকেশনে ট্যাপ করুন (কোনো টেক্সট ফিল্ড ফোকাসড নেই) | ফ্লোটিং প্যানেল খোলে (ব্রডকাস্ট → রিসিভার → `showFloatingPanel`) |
| 9 | ডিভাইস B (কোনো গ্র্যান্ট নেই): সেটিংস স্ক্রিন | **প্রো মোড কার্ড লুকানো**; Accessibility কার্ডে স্ট্যাটাস; কোনো ক্র্যাশ নেই |
| 10 | ডিভাইস B: M3 গাইডের সম্পূর্ণ §৫ টেস্ট | সবকিছু M3-এর মতোই — হুইল নোড-অ্যাকশন/সোয়াইপে ফলব্যাক, Forward ইঙ্গিত দেখায়, hover নেই |
| 11 | দুই ডিভাইস: `adb logcat \| grep -E "KickKeyProMode\|KickKeyA11y"` | কোনো এরর নেই; Android 12+ SecurityException (যদি হয়) একবার লগ হয়ে গিলে যায় |
| 12 | দুই ডিভাইস: সেটিংসে ট্যাপ-টু-ক্লিক বন্ধ/চালু | সেটিং পার্সিস্ট হয়; ট্যাপ-টু-ক্লিক আচরণ অনুসরণ করে (M3 রিগ্রেশন) |

**পাস = ডিভাইস A-তে প্রো মোড (hover / হুইল / Forward / নোটিফিকেশন) এন্ড-টু-এন্ড কাজ করে, এবং ডিভাইস B আচরণে হুবহু M3 (প্রো-মোড UI লুকানো)।**

---

## 6. সমস্যা সমাধান

| উপসর্গ | সম্ভাব্য কারণ | সমাধান |
|---|---|---|
| সেটিংসে প্রো মোড কার্ড দেখা যায় না | `INJECT_EVENTS` গ্র্যান্টেড নয়, বা ম্যানিফেস্ট এডিটের পর prebuild আবার চালানো হয়নি | `adb shell pm grant com.kickkey android.permission.INJECT_EVENTS`; `npx expo prebuild --platform android` + রিইনস্টল |
| Hover কাজ করে না | প্রো মোড বন্ধ, Android 12+, বা কার্সরের নিচের অ্যাপ hover রেন্ডার করে না | টগল চালু + ডিভাইস A যাচাই; লিংক-সহ ওয়েবপেজে ব্রাউজার (Chrome/Firefox) চেষ্টা করুন |
| হুইল স্ক্রল করে না | ডিভাইসে `AXIS_VSCROLL` চিহ্ন উল্টো, বা কার্সর স্ক্রলযোগ্য জায়গায় নেই | `scrollAt`-এ চিহ্ন উল্টান (`1f` ↔ `-1f`); আসল লিস্টে পয়েন্ট করুন |
| Forward এখনও ইঙ্গিত দেখায় | প্রো মোড বন্ধ (M3-তে ফলব্যাক), বা অ্যাপ হিস্ট্রি-ফরোয়ার্ড সাপোর্ট করে না | প্রো মোড চালু করুন; হিস্ট্রি-সহ ব্রাউজারে টেস্ট করুন |
| নোটিফিকেশন আসে না | API 33+ এ `POST_NOTIFICATIONS` অস্বীকৃত, বা `panelNotification` প্রিফ বন্ধ | Settings → Notifications দিয়ে আবার চালু করুন; চ্যানেলের জন্য `adb logcat` দেখুন |
| নোটিফিকেশনে ট্যাপ করলে কিছু হয় না | রিসিভার `:ime_process`-এ নিবন্ধিত নয় (prebuild আবার চালানো হয়নি), বা সার্ভিস মৃত | ম্যানিফেস্ট রিসিভার + `android:process=":ime_process"` যাচাই; রি-প্রিবিল্ড |
| লগক্যাটে `SecurityException` স্প্যাম | Android 12+ এ `injectInputEvent` কল | প্রত্যাশিত — একবার লগ হয়ে গিলে যায়; এই ডিভাইসে প্রো মোড নকশা অনুযায়ী বন্ধ |
| প্রো মোড টগল রিস্টার্টে রিসেট হয় | `useSettingsSync` ও নেটিভ `kickkey_prefs`-এর প্রিফ কী মেলে না | দুটোতেই `proModeEnabled` ব্যবহার হচ্ছে কিনা যাচাই করুন |

---

## 7. M4-এর পরিধির বাইরে (স্থগিত)

| মাইলফলক | স্থগিত কাজ |
|---|---|
| M5 | নতুন সারফেসের জন্য ওয়াচডগ, লেজি প্রি-ওয়ার্ম, API < 33-এ নোড-রিসাইকেল হার্ডেনিং, Play Console অ্যাক্সেসিবিলিটি ডিক্লারেশন + `isAccessibilityTool`, প্রাইভেসি-পলিসি সেকশন, ডিভাইস-ম্যাট্রিক্স টেস্টিং, EN/BN ডক পাস |

ইচ্ছাকৃতভাবে M4-এ **নয়**:
- **Android 12+** এ প্রকৃত hover / হুইল / Forward — প্ল্যাটফর্ম-ব্লকড; সেখানে a11y পথই সর্বোচ্চ।
- `HOME` / `RECENTS` / `Notifications` গ্লোবাল বাটন (সার্ভিস API আছে; UI পরে)।
- ডাবল-ক্লিক / দুই-আঙুল রাইট-ক্লিক (ঐচ্ছিক সেটিং, পরে)।
- নথিভুক্ত ADB গ্র্যান্টের বাইরে রুট-নির্ভর `InputManager` কৌশল।

---

## 8. ডেফিনিশন অফ ডান

- [ ] `ProModeInjector.kt`: `isAvailable` / `isEnabled` / `hover` / `wheel` / `forward` / `inject` try/catch-সহ; পারমিশন-গার্ডেড; কনফিগ প্লাগইন দিয়ে কপি হয়
- [ ] `KickKeyAccessibilityService.kt`: হুইল-ফার্স্ট `scrollAt`, `forwardHistory()`, প্যানেল নোটিফিকেশন (চ্যানেল + শো/হাইড)
- [ ] `KickKeyNotificationReceiver.kt`: `ACTION_OPEN_PANEL` → `showFloatingPanel()` (বা কোল্ড-স্টার্ট)
- [ ] `KickKeyModule.kt`: `isProModeAvailable`, `setProModeEnabled`, `proModeHover`, `proModeWheel`, `proModeForward`, `requestNotificationPermission`, `togglePanelNotification`; `pointerMove` hover ফিড করে; forward শাখা রি-পয়েন্টেড; `onProModeChanged` / `onNotificationPermissionChanged` ইভেন্ট
- [ ] `plugins/withAccessibilityService.js`: `POST_NOTIFICATIONS` + `INJECT_EVENTS` পারমিশন, রিসিভার ব্লক, নতুন Kotlin ফাইল কপি
- [ ] `modules/kickkey-module/index.ts`: টাইপড র‍্যাপার + ইভেন্ট লিসেনার
- [ ] `store/settingsStore.ts` + `hooks/useSettingsSync.ts`: `tapToClick`, `proModeEnabled`, `panelNotification` পার্সিস্টেড
- [ ] `app/(tabs)/settings.tsx`: Accessibility, প্রো মোড (শর্তসাপেক্ষ), Touchpad, Notifications কার্ড
- [ ] `useKeyboardState.ts` + `Touchpad.tsx`: প্রো-মোড স্টেট, দুই-আঙুল হুইল, hover ওয়্যারিং
- [ ] §৫ টেস্ট স্ক্রিপ্ট ডিভাইস A (প্রো মোড) **এবং** ডিভাইস B (বিশুদ্ধ M3 ফলব্যাক) উভয়েই পাস
- [ ] রান চলাকালীন `KickKeyProMode` / `KickKeyA11y` এররমুক্ত লগক্যাট

**সব চেক শেষে → M5 (হার্ডেনিং, Play ডিক্লারেশন, কমপ্লায়েন্স + পলিশ) বাকি মাইলফলক; টাচপ্যাড ফিচার সেট অন্যথায় সম্পূর্ণ।**
