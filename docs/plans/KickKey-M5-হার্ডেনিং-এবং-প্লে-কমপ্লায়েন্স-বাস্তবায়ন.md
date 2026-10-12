# KickKey — M5 বাস্তবায়ন গাইড
## হার্ডেনিং: সারফেস ওয়াচডগ, লেজি প্রি-ওয়ার্ম, Play কমপ্লায়েন্স ও ডিভাইস-ম্যাট্রিক্স টেস্টিং

> **প্ল্যাটফর্ম:** শুধুমাত্র Android · **প্রজেক্ট:** `react-native-kickKey-deepseek` · **মাইলফলক:** M5 · **অবস্থা:** বাস্তবায়নের জন্য প্রস্তুত
> অনুমোদিত পরিকল্পনা অনুসরণ করে: [`KickKey-অ্যাক্সেসিবিলিটি-টাচপ্যাড-পরিকল্পনা.md`](./KickKey-অ্যাক্সেসিবিলিটি-টাচপ্যাড-পরিকল্পনা.md)
> পূর্বশর্ত: M1–M4 সম্পূর্ণ (a11y সার্ভিস + প্যানেল, RN কার্সর, ক্রস-অ্যাপ ইনপুট, প্রো মোড + সেটিংস)। এই ফোল্ডারের M1–M4 গাইড দেখুন।

---

## 1. M5 কী দেবে

| পরিকল্পনা §২৬ থেকে | M5 — হার্ডেনিং |
|---|---|
| পরিধি | নতুন সারফেসের (ওভারলে + কার্সর) জন্য ওয়াচডগ, কীবোর্ড ReactHost-এর লেজি প্রি-ওয়ার্ম, API < 33-এ নোড-রিসাইকেল হার্ডেনিং, Play ঘোষণা + `isAccessibilityTool`, প্রাইভেসি-পলিসি সেকশন, EN/BN ডক পাস, ডিভাইস-ম্যাট্রিক্স টেস্টিং |
| প্রস্থানের মানদণ্ড | **রিলিজ ক্যান্ডিডেট §২১ টেস্ট ম্যাট্রিক্স পাস করে** (Android 10/12/13/14 × জেসচার-নেভ/৩-বাটন × স্টক/OEM) |

**এক বাক্যে:** এই মাইলফলকের পর টাচপ্যাড ফিচার সেট **ফিচার-সম্পূর্ণ ও হার্ডেনড** — ওভারলে ও কার্সর সারফেস IME কীবোর্ডকে আগে থেকে রক্ষা করা একই স্টার্টআপ ওয়াচডগ পায়, হার্মিস রানটাইম ব্যবহারকারী কীবোর্ড না খুললে আর লোড হয় না (লেজি প্রি-ওয়ার্ম), অ্যাক্সেসিবিলিটি সার্ভিস পুরনো Android-এ কোনো `AccessibilityNodeInfo` র‍্যাপার লিক করে না, এবং সবকিছু **Play Store জমার** জন্য গুছিয়ে নেওয়া হয়: `isAccessibilityTool` ঘোষণা, সৎ ইন-অ্যাপ কারণ ডায়ালগ, প্রাইভেসি-পলিসি সেকশন এবং পাস করা ডিভাইস ম্যাট্রিক্স।

M5 ইচ্ছাকৃতভাবে **নতুন ফিচারের** নয় — এটি নির্ভরযোগ্যতা, কমপ্লায়েন্স ও পলিশ স্তর (পরিকল্পনা §২৬: "M5 কমপ্লায়েন্স + পলিশ")। এখানের সবকিছু হয় অদৃশ্য (ওয়াচডগ, রিসাইকেলিং, লেজি ওয়ার্ম), নয়তো স্টোরের প্রয়োজন (ঘোষণা, প্রাইভেসি পলিসি), নয়তো পুরো স্ট্যাক প্রমাণ করে (ডিভাইস ম্যাট্রিক্স)।

### এক নজরে ডেলিভারেবল

| # | ডেলিভারেবল | কেন (পরিকল্পনা রেফ) |
|---|---|---|
| 1 | প্রতি-সারফেস JS রেডিনেস সিগনাল (`surfaceReady`) | ওয়াচডগকে জানতে হবে কোন রুট মাউন্ট করেছে (§১৭) |
| 2 | জেনেরিক `SurfaceWatchdog` + IME রিফ্যাক্টর | ওভারলে/কার্সর IME-র ব্ল্যাক-স্ক্রিন ফেলিওর ক্লাস শেয়ার করে (§১৭) |
| 3 | ওভারলে + কার্সর সারফেসে ওয়াচডগ ওয়্যারিং | কীবোর্ডের মতোই সুরক্ষা |
| 4 | কীবোর্ড ReactHost-এর লেজি প্রি-ওয়ার্ম | a11y সার্ভিসের জন্যই প্রসেস বাঁচতে পারে; হার্মিস ধরে রাখা যাবে না (§১৭, রিস্ক #৯) |
| 5 | API < 33-এ নোড-রিসাইকেল হার্ডেনিং | স্ক্রল ওয়াকে `AccessibilityNodeInfo` র‍্যাপার লিক (M3 নোট) |
| 6 | `android:isAccessibilityTool="true"` + Play Console ঘোষণা | API 31+ a11y অ্যাপের জন্য বাধ্যতামূলক (§২০, §২৩) |
| 7 | ইন-অ্যাপ অ্যাক্সেসিবিলিটি কারণ ডায়ালগ | সৎ ডিসক্লোজার, ঘোষণার সাথে সামঞ্জস্যপূর্ণ (§১৮, §২৩) |
| 8 | প্রাইভেসি-পলিসি সেকশন | a11y + টাচপ্যাডের জন্য প্রয়োজনীয় ডিসক্লোজার (§১৮) |
| 9 | ডিভাইস-ম্যাট্রিক্স টেস্ট রান (§২১) | রিলিজ-ক্যান্ডিডেট প্রমাণ |
| 10 | EN/BN ডক পাস + `todo.md` | মাইলফলক পরিচ্ছন্নতা |

---

## 2. আর্কিটেকচার রিক্যাপ

```
:ime_process
├─ KickKeyApplication
│    └─ onCreate(): আর কোনো অ্যাগ্রেসিভ প্রি-ওয়ার্ম নেই (M5) — keyboardReactHost
│       প্রথম সারফেস তৈরি হওয়ায় লেজিভাবে ইনিশিয়ালাইজ হয় (কীবোর্ড / ওভারলে /
│       পয়েন্টার — সবাই সারফেস আটানোর আগে গেটারটি স্পর্শ করে)
├─ SurfaceWatchdog.kt (নতুন, জেনেরিক)
│    └─ poll(isJsReady, isSurfaceRunning, surfaceView) → সফল | রিমাউন্ট | give-up
│       └─ ব্যবহার করে: IME কীবোর্ড (রিফ্যাক্টরড), FloatingPanelController,
│                       PointerOverlay
├─ KickKeyModule
│    ├─ surfaceJsReady: MutableMap<String, Boolean>   (নতুন)
│    └─ surfaceReady(surface) @ReactMethod            (নতুন — প্রতিটি JS রুট ডাকে)
├─ KickKeyAccessibilityService
│    └─ performScrollOnFocusedNode: API < 33-এ node.recycle() (M5)
├─ FloatingPanelController ── show-তে SurfaceWatchdog("overlay")
└─ PointerOverlay          ── show-তে SurfaceWatchdog("pointer")

keyboard.bundle (JS রুট — প্রতিটি mount useEffect-এ রেডিনেস জানায়)
├─ KeyboardScreen  → keyboardReady()      (বিদ্যমান)
├─ FloatingPanel   → surfaceReady('overlay')   (নতুন)
└─ PointerRoot     → surfaceReady('pointer')   (নতুন)

ম্যানিফেস্ট / কনফিগ (withAccessibilityService.js)
└─ a11y <service>-এ android:isAccessibilityTool="true" (M5)

কম্প্যানিয়ন অ্যাপ
├─ app/(tabs)/settings.tsx → প্রথম "Enable" ট্যাপে AccessibilityRationaleDialog
├─ components/AccessibilityRationaleDialog.tsx (নতুন)
└─ privacy-policy.md → "Accessibility Service & Touchpad" সেকশন (M5)
```

---

## 3. ধাপে ধাপে বাস্তবায়ন

### ধাপ 1 — প্রতি-সারফেস রেডিনেস সিগনাল

**সম্পাদনা:** `native-files/java/com/kickkey/KickKeyModule.kt` + JS রুটগুলো

**1a.** `companion object`-এ `keyboardJsReady`-র পাশে প্রতি-সারফেস ফ্ল্যাগ ম্যাপ:

```kotlin
        // M5: কীবোর্ড হোস্ট শেয়ার করা প্রতিটি React সারফেসের জন্য একটি JS-ready
        // ফ্ল্যাগ ("keyboard" / "overlay" / "pointer")। keyboardJsReady-র মতোই —
        // mount useEffect থেকে সেট হয়, SurfaceWatchdog পড়ে।
        @Volatile
        val surfaceJsReady = java.util.concurrent.ConcurrentHashMap<String, Boolean>()
```

**1b.** `@ReactMethod` যোগ (কীবোর্ডReady-র অনুরূপ, কিন্তু নামসহ):

```kotlin
    /** M5: প্রতিটি JS রুট mount useEffect থেকে ডাকে, একবার React রুট একটি
     *  ফ্রেম কমিট করলে। SurfaceWatchdog এটির মাধ্যমে "রেন্ডারিং ঠিক আছে" বনাম
     *  "সারফেস শুরু হয়েছে কিন্তু JS মাউন্ট হয়নি" আলাদা করে। */
    @ReactMethod
    fun surfaceReady(surface: String, promise: Promise) {
        surfaceJsReady[surface] = true
        // keyboardReady()-র মতোই: @ReactMethod-এর ভিতরে ব্রিজ নিশ্চিতভাবে লাইভ,
        // যা host.currentReactContext null ফিরলে (RN 0.86 headless/IME কুইর্ক)
        // ওয়াচডগ ফলব্যাক হিসেবে ব্যবহার করে।
        keyboardReactContext = reactApplicationContext
        Log.i("KickKeyModule", "JS surface '$surface' mounted and ready")
        promise.resolve(null)
    }
```

(`keyboardReady()` আগের মতোই থাকে; IME কীবোর্ড সেটিই ডাকতে পারে অথবা `surfaceReady("keyboard")`-এ স্যুইচ করতে পারে — দুটোই ওয়াচডগ যা পড়ে তা সেট করে।)

**1c.** JS রুট রেডিনেস জানায় এবং force-rerender শোনে। `src/keyboard/overlay/FloatingPanel.tsx` এবং `src/keyboard/pointer/PointerRoot.tsx`-এ মাউন্টে রেডিনেস সিগনাল এবং রিমাউন্ট লিসেনার যোগ করুন:

```tsx
// FloatingPanel.tsx (এবং একইভাবে PointerRoot.tsx) — কম্পোনেন্টের উপরে
useEffect(() => {
  getKickKey()?.surfaceReady?.('overlay');   // FloatingPanel
  // getKickKey()?.surfaceReady?.('pointer'); // PointerRoot
}, []);

// M5: নির্দিষ্ট সারফেসের জন্য ওয়াচডগের force-rerender ইভেন্ট লিসেন করুন
useEffect(() => {
  const kickkey = getKickKey();
  if (!kickkey) return;
  const emitter = new NativeEventEmitter(kickkey);
  const sub = emitter.addListener('kickkey_forceRerender', (data?: { surface?: string }) => {
    if (!data?.surface || data.surface === 'overlay') { // PointerRoot-এর জন্য 'pointer'
      setMountNonce((n) => n + 1);
    }
  });
  return () => sub.remove();
}, []);
```

**1d.** `modules/kickkey-module/index.ts`-এ ব্রিজ র‍্যাপার:

```ts
  /** M5: শেয়ারড-হোস্ট React সারফেস মাউন্ট হয়েছে জানায় (keyboard/overlay/pointer)। */
  surfaceReady: (surface: 'keyboard' | 'overlay' | 'pointer'): Promise<void> =>
    KickKey.surfaceReady(surface),
```

---

### ধাপ 2 — জেনেরিক `SurfaceWatchdog`

**নতুন ফাইল:** `native-files/java/com/kickkey/SurfaceWatchdog.kt`

IME ওয়াচডগের (`KickKeyInputMethodService.scheduleStartupWatchdog`) পোলিং কাঠামো একটি পুনঃব্যবহারযোগ্য ক্লাসে বের করুন। সফলতার শর্ত IME-র মতোই থাকে (M3 ডক §১৩-এর কঠিন শিক্ষা): **JS রেডি AND সারফেস ভিউয়ের প্রকৃত laid-out সাইজ (>0×>0) AND Fabric কনটেন্ট মাউন্ট করেছে (childCount > 0)** — শুধু `isRunning`/`isAttachedToWindow`-এর উপর ভরসা অদৃশ্য-সারফেস ক্ষেত্রে অবিশ্বস্ত।

```kotlin
package com.kickkey

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * M5 — কীবোর্ড হোস্ট শেয়ার করা প্রতিটি React সারফেসের জন্য জেনেরিক স্টার্টআপ
 * ওয়াচডগ (IME কীবোর্ড, ফ্লোটিং ওভারলে, পয়েন্টার কার্সর)।
 *
 * ফেলিওর ক্লাস: JS রুট মাউন্ট হয় কিন্তু Fabric কখনো কনটেন্ট প্রয়োগ করে না,
 * অথবা সারফেস কখনো শুরু হয় না (অদৃশ্য / কালো সারফেস)। রেডিনেসের জন্য পোল করে;
 * JS মাউন্ট হয়েছে কিন্তু কিছু রেন্ডার হয়নি এমন ক্ষেত্রে kickkey_forceRerender
 * দিয়ে রিমাউন্ট বাধ্য করে; নির্দিষ্ট উইন্ডোর পর [onGiveUp]-এর মাধ্যমে হাল ছেড়ে দেয়
 * যেন কোনো ফেলিওর চিরকালের জন্য নির্ণয়হীন না থাকে।
 *
 * ক্যাডেন্স (IME ওয়াচডগের মতোই): প্রথম চেক ৮ সেকেন্ডে, প্রতি ৩ সেকেন্ডে রিট্রাই,
 * ৩ রিট্রাইয়ের পর give-up (≈১৭ সেকেন্ড মোট, মোট ৪টি অ্যাটেম্পট)।
 */
class SurfaceWatchdog(
    private val surfaceName: String,
    private val isJsReady: () -> Boolean,
    private val isSurfaceRunning: () -> Boolean,
    private val surfaceView: () -> View?,
    private val onGiveUp: (reason: String, detail: String) -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var watchdog: Runnable? = null
    private var attempts = 0

    fun start() {
        cancel()
        attempts = 0
        val r = object : Runnable {
            override fun run() {
                attempts++
                try {
                    val view = surfaceView()
                    val laidOutSize = view != null && view.width > 0 && view.height > 0
                    val hasContent = view != null && view.childCount > 0

                    // ── সফল ──
                    if (isJsReady() && laidOutSize && hasContent) {
                        Log.i(TAG, "Watchdog[$surfaceName]: JS mounted & rendering — OK")
                        return
                    }

                    // ── JS মাউন্ট হয়েছে কিন্তু কিছুই দৃশ্যমান নয় → রিমাউন্ট ──
                    if (isJsReady()) {
                        Log.w(TAG, "Watchdog[$surfaceName]: JS ready but view empty " +
                            "(size=${view?.width}x${view?.height} children=${view?.childCount ?: -1}) " +
                            "— forcing remount (attempt $attempts)")
                        emitForceRerender()
                    } else {
                        Log.w(TAG, "Watchdog[$surfaceName]: surface running but JS not ready yet " +
                            "(attempt $attempts)")
                    }

                    if (attempts >= MAX_ATTEMPTS) {
                        onGiveUp(
                            "Surface '$surfaceName' failed to render",
                            "jsReady=${isJsReady()} running=${isSurfaceRunning()} " +
                                "size=${view?.width}x${view?.height} children=${view?.childCount ?: -1}"
                        )
                        return
                    }
                    watchdog = this
                    mainHandler.postDelayed(this, RETRY_INTERVAL_MS)
                } catch (t: Throwable) {
                    // ক্ষণস্থায়ী এক্সেপশন চুপচাপ ওয়াচডগ মারবে না।
                    Log.w(TAG, "Watchdog[$surfaceName] check failed: ${t.message}", t)
                    if (attempts >= MAX_ATTEMPTS) {
                        onGiveUp(
                            "Surface '$surfaceName' watchdog encountered repeated errors",
                            t.message ?: "Unknown error"
                        )
                        return
                    }
                    watchdog = this
                    mainHandler.postDelayed(this, RETRY_INTERVAL_MS)
                }
            }
        }
        watchdog = r
        mainHandler.postDelayed(r, FIRST_CHECK_DELAY_MS)
    }

    fun cancel() {
        watchdog?.let { mainHandler.removeCallbacks(it) }
        watchdog = null
    }

    private fun emitForceRerender() {
        try {
            val params = Arguments.createMap().apply { putString("surface", surfaceName) }
            KickKeyModule.keyboardReactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("kickkey_forceRerender", params)
        } catch (e: Throwable) {
            Log.w(TAG, "Watchdog[$surfaceName] emitForceRerender failed: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "KickKeySurfaceWatchdog"
        private const val FIRST_CHECK_DELAY_MS = 8000L
        private const val RETRY_INTERVAL_MS = 3000L
        private const val MAX_ATTEMPTS = 4
    }
}
```

> `kickkey_forceRerender` এখন একটি `surface` প্যারাম বহন করে। `KeyboardScreen`-এর বিদ্যমান কীবোর্ড লিসেনার কাজ করতে থাকবে: প্যারাম উপেক্ষা করলেও চলবে (বা সেই অনুযায়ী কাজ করবে) — যে রুটই এটি পায় সেখানে একই রিমাউন্ট লজিক প্রযোজ্য, আর মাউন্ট-পাম্প মেশিনারি (`notifyPumpActive`, `verifyFramePump`) ইতিমধ্যে কীবোর্ড পথে আছে।

**IME ওয়াচডগ রিফ্যাক্টর** (`KickKeyInputMethodService.kt`): `scheduleStartupWatchdog`-এর পোলিং কাঠামো `SurfaceWatchdog` দিয়ে বদলান, কিন্তু **জেনেরিক ক্লাসে না থাকা IME-নির্দিষ্ট শাখাগুলো রাখুন** — হোস্ট-ডেস্ট্রয়েড ডিটেকশন (`LifecycleState.BEFORE_CREATE` → `resetKeyboardHostForRetry()` + এরর), `hostLifecycleHistory` ডায়াগনস্টিকস, এবং `showErrorFallback`:

```kotlin
    private fun scheduleStartupWatchdog(app: KickKeyApplication) {
        surfaceWatchdog = SurfaceWatchdog(
            surfaceName = "keyboard",
            isJsReady = { KickKeyModule.keyboardJsReady },
            isSurfaceRunning = { reactSurface?.isRunning == true },
            surfaceView = { reactSurface?.view },
            onGiveUp = { reason, detail -> showErrorFallback(reason, detail) }
        )
        surfaceWatchdog?.start()
        // IME-নির্দিষ্ট গার্ডগুলো সমান্তরালে চলতে থাকে:
        //  - mount-pump resume / verifyFramePump (বিদ্যমান)
        //  - resume-এর পর হোস্ট ডেস্ট্রয়েড ডিটেকশন → resetKeyboardHostForRetry()
        //    (বিদ্যমান শাখাগুলো — এগুলো ওয়াচডগ যে কলব্যাকে isJsReady() true হলে
        //     ডাকে সেখানে নিয়ে যান, অথবা host.lifecycleState পরীক্ষা করা বিদ্যমান
        //     সমান্তরাল পোল রাখুন। রিফ্যাক্টরে এই লজিক হারাবেন না।)
    }
```

নিরাপদতম রিফ্যাক্টর: বিদ্যমান IME ওয়াচডগ **"keyboard" ইনস্ট্যান্স** হিসেবে রাখুন কিন্তু শেয়ারড পোলিং `SurfaceWatchdog`-এ নামিয়ে/ডেলিগেট করুন এবং হোস্ট-লাইফসাইকেল লজিক একই পোলের ভিতরে অতিরিক্ত চেক হিসেবে রাখুন (ল্যাম্বডা দিয়ে পাস করুন)। §৫ কীবোর্ড-ওপেন কেসগুলো ভালোভাবে টেস্ট করে তারপর এগোন।

---

### ধাপ 3 — ওভারলে + কার্সর সারফেসে ওয়াচডগ ওয়্যারিং

**সম্পাদনা:** `FloatingPanelController.kt` (প্যানেল) এবং `PointerOverlay.kt` (কার্সর) — M1/M2-এর পরে যেখানে থাকবে (পরিকল্পনা এগুলো আলাদা ফাইল হিসেবে তালিকাভুক্ত করেছে; এখনো যদি `KickKeyModule.kt`-এর ভিতরে ইনলাইন থাকে, একই জায়গায় ওয়াচডগ কল দিন)।

**3a.** ফ্লোটিং প্যানেল — ওভারলে সারফেস তৈরি হওয়ার পরপরই ওয়াচডগ শুরু, হাইডে ক্যানসেল:

```kotlin
    // surface.start() / surface.attachView() সফল হওয়ার পরে:
    surfaceWatchdog = SurfaceWatchdog(
        surfaceName = "overlay",
        isJsReady = { KickKeyModule.surfaceJsReady["overlay"] == true },
        isSurfaceRunning = { overlaySurface?.isRunning == true },
        surfaceView = { overlaySurface?.view },
        onGiveUp = { reason, detail ->
            Log.e(TAG, "Overlay failed to render — hiding panel: $reason | $detail")
            hideFloatingPanel()   // মৃত প্যানেল কখনো স্ক্রিনে রাখা যাবে না
        }
    ).also { it.start() }

    fun hideFloatingPanel() {
        surfaceWatchdog?.cancel()
        surfaceWatchdog = null
        // ...বিদ্যমান হাইড লজিক...
    }
```

**3b.** কার্সর সারফেস — `PointerOverlay.show()`-এ একই প্যাটার্ন:

```kotlin
    // show()-এর ভিতরে, পয়েন্টার ReactSurface তৈরি হওয়ার পরে:
    surfaceWatchdog = SurfaceWatchdog(
        surfaceName = "pointer",
        isJsReady = { KickKeyModule.surfaceJsReady["pointer"] == true },
        isSurfaceRunning = { pointerSurface?.isRunning == true },
        surfaceView = { pointerSurface?.view },
        onGiveUp = { reason, detail ->
            Log.e(TAG, "Pointer surface failed to render — hiding cursor: $reason | $detail")
            hide()   // কার্সর একটি সুবিধার ওভারলে; আটকে থাকা উইন্ডোর চেয়ে লুকানো ভালো
        }
    ).also { it.start() }

    fun hide() {
        surfaceWatchdog?.cancel()
        surfaceWatchdog = null
        // ...বিদ্যমান হাইড লজিক...
    }
```

**3c.** সার্ভিস টিয়ারডাউনে প্রতিটি ওয়াচডগ ক্যানসেল (সার্ভিস তিনটি সারফেসেরই মালিক):

```kotlin
    // onUnbind() / onDestroy()-এ, সারফেস টিয়ারডাউনের আগে:
    surfaceWatchdog?.cancel()      // IME
    panelController?.cancelWatchdog()
    PointerOverlay.cancelWatchdog()
```

---

### ধাপ 4 — কীবোর্ড ReactHost-এর লেজি প্রি-ওয়ার্ম

**সম্পাদনা:** `native-files/java/com/kickkey/KickKeyApplication.kt`

**মোটিভেশন (পরিকল্পনা §১৭, রিস্ক #৯):** অ্যাক্সেসিবিলিটি সার্ভিস `:ime_process`-এ থাকে, তাই Android বুটে প্রসেস শুরু করতে পারে (a11y চালু থাকলে) এমনকি ব্যবহারকারী **কীবোর্ড কখনো না খুললেও**। তখন ~911KB বান্ডল + হার্মিস রানটাইম আগে থেকে লোড করলে ৩০–৫০MB বৃথা ধরে থাকে। M5 প্রি-ওয়ার্ম গেট করে যেন হোস্ট **প্রথম সারফেস তৈরিতে** ইনিশিয়ালাইজ হয়, প্রসেস স্টার্টে নয়।

**4a.** `onCreate()` থেকে অ্যাগ্রেসিভ ব্লকটি মুছুন:

```kotlin
        // ── IME প্রসেসে কীবোর্ড ReactHost প্রি-ওয়ার্ম ─────────────────────
        // (এই পুরো ব্লকটি মুছে ফেলুন — M5 এটাকে লেজি করে)
        if (isImeProcess) {
            try {
                keyboardReactHost // লেজি গেটার → initKeyboardRuntime() + host.start()
                Log.i(TAG, "Keyboard ReactHost pre-warmed in IME process")
            } catch (e: Throwable) {
                Log.w(TAG, "Keyboard ReactHost pre-warm failed — will retry on first open", e)
            }
        }
```

`loadReactNative(this)` এবং `ApplicationLifecycleDispatcher.onApplicationCreate(this)` রাখুন — এগুলো সস্তা এবং প্রয়োজনীয়।

**4b.** নিশ্চিত করুন প্রতিটি সারফেস এন্ট্রি পয়েন্ট তার সারফেস তৈরি করার **আগে** লেজি গেটারটি স্পর্শ করে (গেটারটি ইতিমধ্যে synchronized `initKeyboardRuntime()` + `host.start()` করে):

```kotlin
    // KickKeyInputMethodService.onCreateInputView()          — ইতিমধ্যেই করে
    //   val app = application as KickKeyApplication
    //   app.keyboardReactHost    ← প্রথম ওপেনে init + start ট্রিগার করে
    //
    // FloatingPanelController.show() — ওভারলে সারফেস তৈরির আগে যোগ করুন:
    //   val host = (context.applicationContext as KickKeyApplication).keyboardReactHost
    //
    // PointerOverlay.show() — কার্সর সারফেস তৈরির আগে একই লাইন যোগ করুন:
    //   val host = (context.applicationContext as KickKeyApplication).keyboardReactHost
```

**4c.** নথিভুক্ত ট্রেডঅফ (`onCreate`-এ কমেন্ট হিসেবে রাখুন): প্রসেস স্টার্টের পর **প্রথম** কীবোর্ড/প্যানেল/কার্সর ওপেন এখন কোল্ড-স্টার্ট খরচ দেয় (~৩০০ms বান্ডল + হার্মিসের জন্য; IME ওয়াচডগের ৮ সেকেন্ডের উইন্ডো এটি শুষে নেয়)। এরপরের প্রতিটি ওপেন তাৎক্ষণিক কারণ হোস্ট প্রসেসের জীবদ্দশায় টিকে থাকে। এটিই উদ্দিষ্ট ট্রেড: মেমরি (শুধু a11y প্রসেস) বনাম প্রথম-ওপেন লেটেন্সি।

> ঐচ্ছিক টিউনেবল (ডিফল্ট বন্ধ): কোনো ডিভাইসে মেমরির চেয়ে প্রথম-ওপেন লেটেন্সি বেশি গুরুত্বপূর্ণ হলে একটি **ডিফার্ড** প্রি-ওয়ার্ম আবার যোগ করুন — `Handler(Looper.getMainLooper()).postDelayed({ if (isImeProcess) keyboardReactHost }, 5000)` — অতিরিক্তভাবে `ActivityManager.MemoryInfo` (≥4GB RAM) দিয়ে গেট করা। এখানে নথিভুক্ত, যেন কোড-আর্কিওলজি ছাড়াই উল্টানো যায়; M5 ডিফল্ট কঠোর লেজি।

---

### ধাপ 5 — API < 33-এ নোড-রিসাইকেল হার্ডেনিং

**সম্পাদনা:** `native-files/java/com/kickkey/KickKeyAccessibilityService.kt`

`performScrollOnFocusedNode` নোড ট্রি হাঁটে; API < 33-এ প্রতিটি `AccessibilityNodeInfo` স্পষ্টভাবে রিসাইকেল করতে হয় নাহলে র‍্যাপার লিক হয় (33+ `recycle()`-কে নো-অপ করেছে)। M3 ভার্সন বদলান:

```kotlin
    /** ফোকাসড নোড থেকে উপরে উঠে [action] সম্পাদন করে যতক্ষণ না একটি হ্যান্ডেল করে। */
    private fun performScrollOnFocusedNode(action: Int): Boolean {
        val root = rootInActiveWindow ?: return false
        // M5: API 33-এর নিচে স্পষ্টভাবে রিসাইকেল (33+ অটো-রেফকাউন্ট; recycle() নো-অপ)।
        val recycle = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
        var handled = false
        var node: AccessibilityNodeInfo? = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        while (node != null) {
            val current = node
            if (current.performAction(action)) {
                handled = true
                node = null
            } else {
                node = current.parent
            }
            if (recycle) current.recycle()
        }
        if (recycle) root.recycle()
        return handled
    }
```

সার্ভিসে নোড পাওয়ার অন্য যেকোনো জায়গায়ও একই নিয়ম (যেমন ভবিষ্যতের `scrollForwardOnNode` ওয়াক) — গ্রেপ করার জায়গা: `rootInActiveWindow` / `findFocus` / `.parent`।

---

### ধাপ 6 — `isAccessibilityTool` + Play Console ঘোষণা

**6a. ম্যানিফেস্ট অ্যাট্রিবিউট** — `plugins/withAccessibilityService.js`, যে `<service>` ব্লক এটি ইনজেক্ট করে সেখানে যোগ করুন:

```xml
<service
    android:name=".KickKeyAccessibilityService"
    android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
    android:exported="true"
    android:label="@string/a11y_service_name"
    android:process=":ime_process"
    android:isAccessibilityTool="true">   <!-- M5: API 31+ a11y অ্যাপের জন্য বাধ্যতামূলক -->
    ...
</service>
```

`isAccessibilityTool="true"` সৎ ফ্রেমিং (পরিকল্পনা §২৩ সুপারিশ): টাচপ্যাড একটি **সহায়ক ইনপুট এইড** — যারা সরাসরি টাচ করতে পারেন না (মোটর প্রতিবন্ধকতা) তাদের জন্য — স্ক্রিন রিডার নয়, স্ক্র্যাপিং টুল নয়।

**6b. Play Console ঘোষণা** (ম্যানুয়াল, কোডের বাইরে — রিপোতে নথিভুক্ত করুন, যেমন `docs/play-checklist.md`):

1. Play Console → আপনার অ্যাপ → **App content** → **Accessibility**।
2. **Accessibility Service ডিক্লারেশন** সম্পূর্ণ করুন:
   - **উদ্দেশ্য**: সহায়ক ইনপুট এইড — একটি ভার্চুয়াল টাচপ্যাড/মাউস (কার্সর, ক্লিক, স্ক্রল, ব্যাক) যা শুধুমাত্র ব্যবহারকারীর স্পষ্ট জেসচারে ট্রিগার হয়।
   - **ডেটা**: কিছুই সংগ্রহ/সংরক্ষণ/প্রেরণ হয় না; সার্ভিস শুধু window-state/content-changed ইভেন্ট পড়ে (স্ক্রল অ্যাকশন টার্গেট করার জন্য প্রয়োজন) — কখনো কী-লগিং, টাচ-এক্সপ্লোরেশন বা স্ক্রিন-কনটেন্ট ডেটা নয়।
   - **নীতি সম্মতি**: Accessibility API নীতির সাথে সম্মতি নিশ্চিত করুন (প্রতারণামূলক ব্যবহার নেই, ব্যবহারকারী-দৃশ্যমান ডিসক্লোজার, ব্যবহারকারী নিয়ন্ত্রণ)।
3. ইন-অ্যাপ কারণ ডায়ালগ (ধাপ 7) ও প্রাইভেসি পলিসির (ধাপ 8) সাথে **আশয়গতভাবে অভিন্ন** শব্দচয়ন রাখুন — রিভিউয়াররা এগুলো ক্রস-চেক করে।
4. **প্রাইভেসি পলিসি URL** সেট করুন (App content → Privacy policy) — ধাপ 8-এ আপডেট করা হোস্টেড পলিসি।

---

### ধাপ 7 — ইন-অ্যাপ অ্যাক্সেসিবিলিটি কারণ ডায়ালগ

**নতুন ফাইল:** `components/AccessibilityRationaleDialog.tsx` — `Settings.ACTION_ACCESSIBILITY_SETTINGS`-এ ডিপ লিংকের **আগে** একবার দেখানো ডিসক্লোজার (পরিকল্পনা §১৮: "a11y সার্ভিস কী করে ও কেন, তা ব্যাখ্যা করা প্রথম-লঞ্চ ডায়ালগ, Settings-এ ডিপ লিংকের আগে")।

**7a.** `store/settingsStore.ts`-এ একটি পার্সিস্টেড ফ্ল্যাগ:

```ts
  a11yRationaleShown: boolean;          // default false
  setA11yRationaleShown: (v: boolean) => void;
```

**7b.** ডায়ালগ (Modal + দুটি অ্যাকশন):

```tsx
// components/AccessibilityRationaleDialog.tsx
import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

export default function AccessibilityRationaleDialog({
  visible, onAccept, onDecline,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>KickKey accessibility service</Text>
          <Text style={styles.body}>
            KickKey uses the Android accessibility service to power its system-wide
            touchpad: moving the cursor, clicking, scrolling and Back — only when
            you trigger them from the touchpad.
          </Text>
          <Text style={styles.body}>
            It does NOT read your screen content, log your keys, or send any data
            off your device. You can disable it anytime in Android Settings.
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.declineBtn} onPress={onDecline}>
              <Text style={styles.declineText}>Not now</Text>
            </Pressable>
            <Pressable style={styles.acceptBtn} onPress={onAccept}>
              <Text style={styles.acceptText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2E2E38',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
  },
  declineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2A2A35',
  },
  declineText: {
    color: '#AAAAAA',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
```

**7c.** `app/(tabs)/settings.tsx`-এ ওয়্যারিং — Accessibility রো এখন প্রথমে ডায়ালগ দেখায়:

```tsx
  const a11yRationaleShown = useSettingsStore((s) => s.a11yRationaleShown);
  const setA11yRationaleShown = useSettingsStore((s) => s.setA11yRationaleShown);
  const [showRationale, setShowRationale] = useState(false);

  const openA11ySettings = () => {
    if (!a11yRationaleShown) {
      setShowRationale(true);               // একবার ডিসক্লোজ, তারপর ডিপ-লিংক
    } else {
      openAccessibilitySettings();
    }
  };

  // Accessibility কার্ডের রো onPress → openA11ySettings

  <AccessibilityRationaleDialog
    visible={showRationale}
    onAccept={() => {
      setShowRationale(false);
      setA11yRationaleShown(true);
      openAccessibilitySettings();
    }}
    onDecline={() => setShowRationale(false)}
  />
```

---

### ধাপ 8 — প্রাইভেসি-পলিসি সেকশন

**সম্পাদনা:** `privacy-policy.md` (প্রজেক্ট রুট — ইতিমধ্যে কীবোর্ড/IME এবং Android 12+ ক্লিপবোর্ড টোস্ট কভার করে)। অ্যাক্সেসিবিলিটি সার্ভিস ও টাচপ্যাড বর্ণনাকারী একটি সেকশন যোগ করুন:

```markdown
## Accessibility Service & Touchpad

KickKey includes an Android Accessibility Service that powers its system-wide
touchpad (moving a cursor, clicking, scrolling, and the Back button).

- **What it does:** performs touch gestures (tap, long-press, swipe) and the
  Back action **only when you explicitly trigger them** from the KickKey
  touchpad or panel. It never acts on its own.
- **What it reads:** only window-state and window-content-change events, needed
  to target scroll actions. It does **not** capture or log your screen content,
  typed text, or credentials.
- **What it collects:** nothing. No data leaves your device; the service has no
  network access and no analytics.
- **Overlays:** the on-screen cursor is a touch-through overlay and never
  intercepts touches meant for other apps.
- **Optional pro mode:** on personal Android 11 or older devices you may enable
  "pro mode" (true hover, wheel scroll, Forward) by granting the
  `INJECT_EVENTS` permission over ADB. This is never granted by the Play Store
  and is unavailable on store installs.
- **Android 12+ clipboard notice:** as with the keyboard, Android shows a
  system notification whenever the clipboard is read; this is enforced by the
  operating system and cannot be disabled by KickKey.

You can disable the accessibility service at any time in
Settings → Accessibility → Installed services → KickKey.
```

আপডেট করা পলিসি কীবোর্ড পলিসির জন্য ব্যবহৃত একই URL-এ প্রকাশ করুন এবং Play Console-এ সেট করুন (ধাপ 6b.4)।

---

### ধাপ 9 — ডিভাইস-ম্যাট্রিক্স টেস্ট রান (§২১)

নিচের পুরো ম্যাট্রিক্স চালিয়ে ফলাফল রেকর্ড করুন (একটি চেকলিস্ট ফাইল, যেমন `docs/m5-device-matrix.md`)। পরিকল্পনা §১৯/§২১ অনুযায়ী ন্যূনতম কভারেজ:

| অক্ষ | প্রয়োজনীয় কেস |
|---|---|
| Android ভার্সন | **১০ (API ২৯)**, **১২ (API ৩১)**, **১৩ (API ৩৩)**, **১৪ (API ৩৪)** — প্রো মোড শুধু **Android ≤ 11** ডিভাইসে যাচাই (API 26–30) |
| নেভিগেশন | একই OS ভার্সনে জেসচার-নেভ **এবং** ৩-বাটন নেভ |
| লঞ্চার/OEM | একটি **স্টক** ডিভাইস (Pixel) + একটি **OEM** ডিভাইস (Samsung One UI, Xiaomi MIUI) |
| ফর্ম ফ্যাক্টর | ফোন, **ফোল্ডেবল / মাল্টি-উইন্ডো** (ওভারলে + কার্সর উইন্ডো জুড়ে), **ল্যান্ডস্কেপ** |
| বিশেষ অ্যাপ | **ইমার্সিভ** (ভিডিও প্লেয়ার — ওভারলে আচরণ), **ব্যাংকিং/সিকিউর** অ্যাপ (ইনজেক্টেড টাচ উপেক্ষিত হতে পারে — প্রত্যাশিত, নথিভুক্ত) |
| লাইফসাইকেল | a11y সার্ভিস **কিল + রিস্টার্ট** (Settings → force-stop, আবার খুলুন), IME প্রসেস রিস্টার্ট, প্যানেল খোলা অবস্থায় স্ক্রিন **রোটেশন** |
| Android 13+ | সাইডলোডের জন্য **রেস্ট্রিক্টেড সেটিংস** ফ্লো (ইন-অ্যাপ নির্দেশনা + ডিপ লিংক) |
| পারফ | পয়েন্টার 60Hz-এ কোনো ড্রপড ফ্রেম ছাড়া (`systrace` / React DevTools), `:ime_process` RAM **< 50MB**, প্রথম ওয়ার্মের পর কীবোর্ড ওপেন **< 80ms**, সাজেশন **< 100ms** |

ইউনিট টেস্ট (Robolectric, CI-তে চলে): জেসচার-ডেসক্রিপশন বিল্ডার, কার্সর ক্ল্যাম্পিং ম্যাথ, স্ক্রল রিপিট-থ্রটলিং, প্রো-মোড পারমিশন চেক (`ProModeInjector.isAvailable` গ্র্যান্টসহ/ছাড়া), `SurfaceWatchdog` give-up টাইমিং। ঐচ্ছিক ইন্সট্রুমেন্টেশন: এমুলেটরে `dispatchGesture` কলব্যাক যাচাইকারী টেস্ট-অনলি a11y সার্ভিস।

---

### ধাপ 10 — EN/BN ডক পাস + `todo.md`

- M1–M5 বাস্তবায়ন গাইড **প্রকৃত চূড়ান্ত কোড**ের সাথে মিলিয়ে দেখুন; EN ও BN দুই ভার্সনেই যেকোনো ড্রিফট (ফাইল পাথ, মেথড নাম, ইভেন্ট নাম) ঠিক করুন।
- EN/BN প্যারিটি যাচাই: ইংরেজি গাইডের প্রতিটি সেকশন বাংলা গাইডে আছে (এবং উল্টোটাও)।
- `todo.md` ও `ReadMe.md` আপডেট করুন: টাচপ্যাড মাইলফলক M1–M5 ডান মার্ক করুন, Play জমার অবস্থা নোট করুন, M4/M5 গাইডের লিংক দিন।

---

## 4. বিল্ড ও ইনস্টল

```bash
cd react-native-kickKey-deepseek

node scripts/build-keyboard-bundle.js     # keyboard.bundle-এ এখন ৩টি রুট
npx expo prebuild --platform android      # withImeService + withAccessibilityService
npx expo run:android                      # ডেভ / রিলিজ-ক্যান্ডিডেট বিল্ড

# শুধু প্রো-মোড টেস্ট ডিভাইসে (Android ≤ 11):
adb shell pm grant com.kickkey android.permission.INJECT_EVENTS
```

কোনো নতুন npm ডিপেন্ডেন্সি নেই। ওয়াচডগ, রিসাইকেলিং ও লেজি-ওয়ার্ম পরিবর্তন সব ইন-ট্রি।

---

## 5. ম্যানুয়াল টেস্ট স্ক্রিপ্ট (M5 প্রস্থানের মানদণ্ড — §২১ ম্যাট্রিক্স)

**সেটআপ:** M1–M4 মার্জড। ধাপ 9-এর ম্যাট্রিক্সে চালান। পাসের শর্ত পুরো ম্যাট্রিক্স সবুজ; নিচের টেবিলটি প্রতিটি ডিভাইসে পুনরাবৃত্তি করার মূল স্ক্রিপ্ট।

| # | কেস | প্রত্যাশিত |
|---|---|---|
| 1 | ফ্রেশ বুট, a11y চালু, **কীবোর্ড কখনো খুলবেন না** | হার্মিস লোড নেই: `adb logcat \| grep -E "KickKeyApplication|Hermes"`-এ সারফেস তৈরি না হওয়া পর্যন্ত **কোনো** "Initializing keyboard ReactHost" নেই; `:ime_process` RAM ছোট থাকে |
| 2 | টেক্সট ফিল্ডে ট্যাপ করুন (বুটের পর প্রথম সারফেস) | কীবোর্ড আসে (কোল্ড স্টার্ট ~৩০০ms ঠিক আছে); ওয়াচডগ "keyboard JS mounted & rendering — OK" লগ করে |
| 3 | কোনো ফিল্ড ফোকাসড ছাড়া **ফ্লোটিং প্যানেল** খুলুন | প্যানেল রেন্ডার হয়; ওয়াচডগ "overlay … — OK" লগ করে; বন্ধ করলে ওয়াচডগ ক্যানসেল হয় |
| 4 | **কার্সর** চালু করুন (টাচপ্যাড মোড) | পয়েন্টার রেন্ডার হয়; ওয়াচডগ "pointer … — OK" লগ করে; কার্সর 60Hz-এ চলে, কোনো ড্রপড ফ্রেম নেই |
| 5 | ইচ্ছাকৃতভাবে একটি সারফেস ভাঙুন (যেমন সেশনের মাঝে `adb shell am force-stop com.kickkey`, প্যানেল আবার খুলুন) | ওয়াচডগ হয় রিকভার করে (রিমাউন্ট) অথবা লগ করা কারণে give-up করে + মৃত সারফেস লুকায় — কখনো আটকে থাকা অদৃশ্য উইন্ডো নয় |
| 6 | **Android 10** ডিভাইসে Settings/ব্রাউজারে স্ক্রল | স্ক্রলিং কাজ করে; লগক্যাটে কোনো `AccessibilityNodeInfo` লিক ওয়ার্নিং নেই (রিসাইকেল পথ সক্রিয়) |
| 7 | **Android 14**-এ একই স্ক্রল | কাজ করে; `recycle()` চুপচাপ নো-অপ (API 33+) |
| 8 | Settings → Accessibility রো (প্রথমবার) | কারণ ডায়ালগ একবার আসে; "Continue"-এ ডিপ-লিংক; দ্বিতীয় ট্যাপে সোজা Settings |
| 9 | Play-প্রস্তুত APK (`eas build -p android`) | ম্যানিফেস্টে `android:isAccessibilityTool="true"` আছে; `INJECT_EVENTS` আছে কিন্তু **গ্র্যান্টেড নয়**; প্রো-মোড কার্ড লুকানো |
| 10 | প্রাইভেসি পলিসি | হোস্টেড URL আপডেট করা পলিসি দেয়, Accessibility Service & Touchpad সেকশনসহ |
| 11 | সম্পূর্ণ M1–M4 রিগ্রেশন (M1/M2/M3/M4 টেস্ট স্ক্রিপ্ট) | সব সবুজ — হার্ডেনিংয়ে কিছু রিগ্রেস হয়নি |
| 12 | `adb logcat \| grep -E "KickKeySurfaceWatchdog\|KickKeyA11y\|KickKeyApplication"` | পুরো ম্যাট্রিক্স রানে কোনো এরর নেই |

**পাস = সম্পূর্ণ §২১ ম্যাট্রিক্স সবুজ (Android 10/12/13/14 × নেভ স্টাইল × স্টক/OEM), ওয়াচডগ give-up সবসময় লগড + রিকভারড, API < 33-এ কোনো নোড লিক নেই, RAM < 50MB, এবং Play ঘোষণা + পলিসি + কারণ ডায়ালগ সামঞ্জস্যপূর্ণ।**

---

## 6. সমস্যা সমাধান

| উপসর্গ | সম্ভাব্য কারণ | সমাধান |
|---|---|---|
| M5-এর পর প্রথম কীবোর্ড ওপেন ~৩০০ms ধীর | লেজি প্রি-ওয়ার্ম (নকশা অনুযায়ী) | প্রত্যাশিত — পরের ওপেন তাৎক্ষণিক; নির্দিষ্ট ডিভাইসে প্রয়োজন হলে ডিফার্ড ওয়ার্ম (§৪c) চালু করুন |
| কীবোর্ড কখনো না খুলেই `:ime_process` RAM বেশি | পুরনো প্রি-ওয়ার্ম এখনও আছে (prebuild আবার চালানো হয়নি, বা মুছে ফেলা ব্লক APK-তে আছে) | রিবিল্ড + রিইনস্টল; বুটে কোনো "Initializing keyboard ReactHost" লগ নেই তা যাচাই করুন |
| ওভারলে বা কার্সর ফাঁকা/অদৃশ্য সারফেস দেখায় এবং রিকভার করে না | সারফেস শুরু হয়েছে, JS মাউন্ট হয়নি (ব্ল্যাক-সারফেস ক্লাস) | ওয়াচডগ রিমাউন্ট বাধ্য করবে; give-up হলে JS রুটের `kickkey_forceRerender` লিসেনার + এর mount ইফেক্টের `surfaceReady` কল যাচাই করুন |
| প্যানেলের জন্য ওয়াচডগ কখনো "OK" লগ করে না | `surfaceReady('overlay')` ডাকা হয়নি, বা `surfaceView()` ভুল ভিউ দেয় | mount ইফেক্ট ফায়ার হয় কিনা যাচাই; ওয়াচডগ সঠিক সারফেস/ভিউ পড়ছে কিনা যাচাই |
| Android 10-এ স্ক্রল লিক করে (লগক্যাট ওয়ার্নিং) | নোড রিসাইকেল পথ সক্রিয় নয় | `Build.VERSION.SDK_INT < 33` শাখা `recycle()` ডাকে কিনা নিশ্চিত; শেষের `root.recycle()` চেক করুন |
| Play Console ঘোষণা প্রত্যাখ্যান করে | ডায়ালগ / পলিসি / ঘোষণার শব্দচয়ন অমিল | তিনটিকে "সহায়ক ইনপুট এইড, শুধু ব্যবহারকারী-ট্রিগারড জেসচার, কোনো ডেটা নেই"-তে সামঞ্জস্য করুন |
| কারণ ডায়ালগ বারবার আসে | `a11yRationaleShown` পার্সিস্ট হয়নি | `settingsStore` পার্সিস্টেন্স + ডিপ-লিংকের আগে accept হ্যান্ডলার ফ্ল্যাগ সেট করে কিনা চেক করুন |
| সারফেস হাইডের পর ওয়াচডগ give-up স্প্যাম | হাইডে ওয়াচডগ ক্যানসেল হয়নি | `hideFloatingPanel()` / `PointerOverlay.hide()` / IME `onWindowHidden`-এ ক্যানসেল করুন |

---

## 7. M5-এর পরিধির বাইরে (M5-পরবর্তী)

| ক্ষেত্র | স্থগিত |
|---|---|
| **Play জমা** | প্রকৃত স্টোর লিস্টিং অ্যাসেট (স্ক্রিনশট, ফিচার গ্রাফিক, লোকালাইজড বর্ণনা), বিটা/রোলআউট, রিলিজ নোট — এগুলো রিলিজ-ম্যানেজমেন্ট কাজ, কোড নয় |
| **নতুন ফিচার** | ডাবল-ক্লিক / দুই-আঙুল রাইট-ক্লিক, `HOME`/`RECENTS`/`Notifications` গ্লোবাল বাটন, সারফেস থেকে ড্র্যাগ-টু-স্ক্রল, Android 12+ এ আরও প্রো-মোড ক্যাপাবিলিটি (প্ল্যাটফর্ম-ব্লকড) |
| **স্কেল** | EN/BN-এর বাইরে মাল্টি-ল্যাঙ্গুয়েজ কীবোর্ড লেআউট, ক্লাউড সিঙ্ক, অ্যাকাউন্ট — টাচপ্যাড পরিকল্পনায় এসবের কিছুই নেই |

ইচ্ছাকৃতভাবে M5-এ **নয়**: অনুমোদিত জেসচার আচরণ, জেসচার টাইমিং বা a11y ইভেন্ট টাইপের পরিবর্তন (তা Play ঘোষণা অবৈধ করবে)।

---

## 8. ডেফিনিশন অফ ডান

- [ ] `KickKeyModule.kt`: `surfaceJsReady` ম্যাপ + `surfaceReady(surface)`; `kickkey_forceRerender` সারফেস নাম বহন করে; `keyboardReady()` আগের মতো কাজ করে
- [ ] `FloatingPanel.tsx` / `PointerRoot.tsx`: mount ইফেক্টে `surfaceReady('overlay'|'pointer')`; ব্রিজ র‍্যাপার যোগ
- [ ] `SurfaceWatchdog.kt`: জেনেরিক পোল (8s/3s/৩ অ্যাটেম্পট), সফল = JS-ready + laid-out + has-content, JS-ready-কিন্তু-ফাঁকায় রিমাউন্ট, give-up কলব্যাক; ক্যানসেলযোগ্য
- [ ] IME ওয়াচডগ `SurfaceWatchdog`-এ রিফ্যাক্টরড **কিন্তু** হোস্ট-ডেস্ট্রয়েড ডিটেকশন / `resetKeyboardHostForRetry` / `showErrorFallback` হারানো যায়নি
- [ ] `FloatingPanelController` / `PointerOverlay` নিজেদের ওয়াচডগ শুরু + ক্যানসেল করে; সার্ভিস টিয়ারডাউনে সব ক্যানসেল
- [ ] `KickKeyApplication.onCreate()`: অ্যাগ্রেসিভ প্রি-ওয়ার্ম সরানো; IME/প্যানেল/পয়েন্টার সারফেস তৈরির আগে লেজি `keyboardReactHost` স্পর্শ করে
- [ ] `KickKeyAccessibilityService.kt`: `performScrollOnFocusedNode` API < 33-এ নোড + রুট রিসাইকেল করে; অন্য কোনো নোড হ্যান্ডেল লিক নেই
- [ ] `plugins/withAccessibilityService.js`: `android:isAccessibilityTool="true"`
- [ ] Play চেকলিস্ট নথিভুক্ত (`docs/play-checklist.md`): ঘোষণার শব্দচয়ন, পলিসি URL, ডায়ালগ/পলিসি/ঘোষণা জুড়ে সামঞ্জস্য
- [ ] `AccessibilityRationaleDialog.tsx` + `a11yRationaleShown` ফ্ল্যাগ; a11y ডিপ লিংকের আগে একবার দেখানো
- [ ] `privacy-policy.md`: "Accessibility Service & Touchpad" সেকশন হোস্টেড URL-এ প্রকাশিত
- [ ] §৫ টেস্ট স্ক্রিপ্ট + §২১ ডিভাইস ম্যাট্রিক্স Android 10/12/13/14 × জেসচার-নেভ/৩-বাটন × স্টক/OEM-এ সবুজ; RAM < 50MB; 60Hz পয়েন্টার
- [ ] জেসচার বিল্ডার / ক্ল্যাম্পিং / থ্রটল / প্রো-মোড চেক / ওয়াচডগ টাইমিংয়ের Robolectric ইউনিট টেস্ট
- [ ] M1–M5 ডক (EN + BN) চূড়ান্ত কোডের সাথে মিলিয়ে দেখা; `todo.md`/`ReadMe.md` আপডেট

**সব চেক শেষে → M5 টাচপ্যাড ট্র্যাক বন্ধ করে। বাকি কাজ রিলিজ ম্যানেজমেন্ট (স্টোর লিস্টিং + রোলআউট), ফিচার বা হার্ডেনিং কোড নয়।**
