# KickKey — M3 বাস্তবায়ন গাইড
## ক্রস-অ্যাপ ইনপুট: Accessibility সার্ভিস দিয়ে ক্লিক, স্ক্রল, ব্যাক

> **প্ল্যাটফর্ম:** শুধুমাত্র Android · **প্রজেক্ট:** `react-native-kickKey-deepseek` · **মাইলফলক:** M3 · **অবস্থা:** বাস্তবায়নের জন্য প্রস্তুত
> অনুমোদিত পরিকল্পনা অনুসরণ করে: [`KickKey-অ্যাক্সেসিবিলিটি-টাচপ্যাড-পরিকল্পনা.md`](./KickKey-অ্যাক্সেসিবিলিটি-টাচপ্যাড-পরিকল্পনা.md)
> পূর্বশর্ত: M1 (a11y সার্ভিস + প্যানেল) + M2 (RN কার্সর)। এই ফোল্ডারের M1/M2 গাইড দেখুন।

---

## 1. M3 কী দেবে

| পরিকল্পনা §২৬ থেকে | M3 — ক্রস-অ্যাপ ইনপুট |
|---|---|
| পরিধি | a11y সার্ভিসে `tapAt` / `longPressAt` / সোয়াইপ / `GLOBAL_ACTION_BACK`, স্ক্রল ফলব্যাক, IME স্ট্রিপ মোড, টাচপ্যাড বাটন রিওয়্যারিং |
| প্রস্থানের মানদণ্ড | **L/R ক্লিক, স্ক্রল আপ/ডাউন ও Back — বাস্তব অ্যাপে কাজ করে** (লঞ্চার, ব্রাউজার, সেটিংস) |

**এক বাক্যে:** এই মাইলফলকের পর টাচপ্যাড বাটনগুলো আর টেক্সট-ফিল্ড DPAD কী পাঠায় না — বদলে **কার্সরের নিচের অ্যাপে প্রকৃত টাচ জেসচার ইনজেক্ট করে** (`dispatchGesture`), **Back** পাঠায় সিস্টেম গ্লোবাল অ্যাকশনে, ফোকাসড লিস্ট স্ক্রল করে, **L-ড্র্যাগ** (প্রকৃত ড্র্যাগ স্ট্রোক), **ট্যাপ-টু-ক্লিক** সাপোর্ট করে, এবং টাচপ্যাড মোডে IME কীবোর্ডকে পাতলা **স্ট্রিপে** সঙ্কুচিত করে যেন পয়েন্টারের পুরো স্ক্রিন থাকে।

পরিকল্পনার জেসচার টেবিল (§১০) — Play-নিরাপদ পথ:

| অ্যাকশন | সিমুলেশন |
|---|---|
| লেফট ক্লিক | কার্সরে `dispatchGesture` ট্যাপ (ডাউন+আপ, ~60ms) |
| রাইট ক্লিক | কার্সরে `dispatchGesture` লং-প্রেস (~600ms) |
| ড্র্যাগ | এক স্ট্রোক: ডাউন → মুভ → আপ (শুরু→শেষ পাথ) |
| স্ক্রল | প্রথমে ফোকাসড নোডে `ACTION_SCROLL_*`; তারপর সোয়াইপ-স্ট্রোক ফলব্যাক |
| Back | `performGlobalAction(GLOBAL_ACTION_BACK)` |
| Forward | শুধু ফোকাসড নোডে `ACTION_SCROLL_FORWARD` (কোনো API নেই); পূর্ণ সমর্থন M4 pro mode |

ফলব্যাক নিয়ম (পরিকল্পনা §১৫): accessibility সার্ভিস **নিষ্ক্রিয়** থাকলে প্রতিটি টাচপ্যাড অ্যাকশন **বিদ্যমান টেক্সট-ফিল্ড আচরণে** (`InputConnection` DPAD কী) নেমে আসে — ক্র্যাশ নয়।

---

## 2. আর্কিটেকচার রিক্যাপ

```
Touchpad.tsx-এ আঙুল/L/R (JS)
   │
   ├─ surface ড্র্যাগ ───────────► onPointerMove(dx,dy) → KickKey.pointerMove
   │                               └─ PointerOverlay.move (M2) + service.onDragDelta (L চেপে থাকলে)
   ├─ L প্রেস-ইন ────────────────► onDragStart → KickKey.dragStart → service.beginDrag()
   ├─ L প্রেস-আউট ───────────────► onDragEnd   → KickKey.dragEnd   → service.endDrag()
   │                               ├─ মুভ ≥ 24px → একটি সোয়াইপ স্ট্রোক (প্রকৃত ড্র্যাগ)
   │                               └─ নাহলে     → tapAt(cursor) (লেফট ক্লিক)
   ├─ R প্রেস ───────────────────► onMouseClick('right') → KickKey.mouseClick → service.longPressAt(cursor)
   ├─ ট্যাপ-টু-ক্লিক ─────────────► onMouseClick('left') → KickKey.mouseClick → service.tapAt(cursor)
   ├─ স্ক্রল কেয়ারেট (রিপিট) ────► onScrollPage('up'|'down') → KickKey.scrollPage
   │                               └─ service.scrollAt: ① ফোকাসড নোডে ACTION_SCROLL
   │                                                   ② থ্রটলড সোয়াইপ স্ট্রোক কার্সরে
   └─ ব্যাক শেভরন ───────────────► onNavigateHistory('backward') → KickKey.navigateHistory
                                   └─ service.navigateBack() = GLOBAL_ACTION_BACK
      ফরোয়ার্ড শেভরন ───────────► onNavigateHistory('forward')
                                   └─ service.scrollForwardOnNode() অথবা false → JS ইঙ্গিত

KickKeyAccessibilityService (M1) + M3 সংযোজন:
   ├─ dispatchGestureSafe()  — সিরিয়ালাইজড কিউ, একবারে একটি জেসচার,
   │                           প্রতি-জেসচার কমপ্লিশন কলব্যাক
   ├─ tapAt / longPressAt / scrollAt / navigateBack / ড্র্যাগ লাইফসাইকেল
   ├─ isPointInPanel()       — ফ্লোটিং প্যানেলের উপর ক্লিক উপেক্ষা
   └─ performScrollOnFocusedNode() — rootInActiveWindow ব্যবহার (কনফিগ XML-এ
                                     canRetrieveWindowContent ইতিমধ্যে আছে)

KickKeyInputMethodService (M3 সম্পাদনা):
   └─ setTouchpadStripMode(on) — IME উইন্ডো উচ্চতা 275dp ⇄ 90dp স্ট্রিপ
                                  (updateSoftInputWindowLayout + রি-মেজার)

KickKeyModule (M3 পুনঃনির্দেশ):
   mouseClick / scrollPage / navigateHistory → আগে সার্ভিস, তারপর InputConnection ফলব্যাক
   NEW: setTouchpadMode, dragStart, dragEnd (navigateHistory এখন Boolean দেয়)
```

---

## 3. ধাপে ধাপে বাস্তবায়ন

### ধাপ ১ — `KickKeyAccessibilityService.kt`-এ জেসচার API যোগ করুন

**সম্পাদনা:** `native-files/java/com/kickkey/KickKeyAccessibilityService.kt`

**১ক.** ইমপোর্ট যোগ করুন (ফাইলের উপরে):

```kotlin
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
```

**১খ.** বিদ্যমান `companion object`-এ কনস্ট্যান্ট যোগ করুন (`PANEL_HEIGHT_DP`-এর পরে):

```kotlin
        // ── Gesture timing (M3) ──
        private const val TAP_DURATION_MS = 60L            // left-click tap
        private const val LONG_PRESS_DURATION_MS = 600L    // right-click proxy
        private const val SCROLL_SWIPE_DURATION_MS = 300L  // swipe fallback
        private const val SCROLL_SWIPE_DISTANCE_PX = 200   // swipe fallback length
        private const val DRAG_MIN_DISTANCE_PX = 24        // below this = tap, not drag
        private const val SCROLL_THROTTLE_MS = 150L        // repeat-scroll cap
```

**১গ.** পুরো M3 ব্লকটি **ক্লাসের ভেতরে** যোগ করুন (`resumeHostWhenReady`-এর পরে, শেষ ক্লোজিং ব্রেসের আগে):

```kotlin
    // ════════════════════════════════════════════════════════════════════════
    // M3 — Cross-app input injection (main-thread only; KickKeyModule posts)
    // ════════════════════════════════════════════════════════════════════════

    // Serialized gesture queue: dispatchGesture only accepts one gesture at a
    // time, so taps/swipes queue up and fire with completion callbacks (plan §17).
    private val gestureQueue = ArrayDeque<GestureDescription>()
    private var gestureInFlight = false
    private var lastScrollDispatchMs = 0L

    // L-button drag state
    private var isDragging = false
    private var dragStartX = 0f
    private var dragStartY = 0f
    private var dragEndX = 0f
    private var dragEndY = 0f
    private var dragMoved = false

    // ── Clicks ──────────────────────────────────────────────────────────────

    /** Left click: a real tap at (x, y). Clicks over the panel itself are ignored. */
    fun tapAt(x: Float, y: Float) {
        if (isPointInPanel(x, y)) {
            Log.i(TAG, "tap ignored — target inside floating panel")
            return
        }
        dispatchGestureSafe(buildTapGesture(x, y, TAP_DURATION_MS))
    }

    /** Right click: a long-press at (x, y) — Android's context-menu equivalent. */
    fun longPressAt(x: Float, y: Float) {
        if (isPointInPanel(x, y)) return
        dispatchGestureSafe(buildTapGesture(x, y, LONG_PRESS_DURATION_MS))
    }

    // ── Drag (L held + moving the touchpad) ────────────────────────────────
    // One continuous stroke from the press point to the release point — the
    // closest a11y equivalent to a physical mouse drag (plan §5).

    fun beginDrag() {
        dragStartX = PointerOverlay.cursorX
        dragStartY = PointerOverlay.cursorY
        dragEndX = dragStartX
        dragEndY = dragStartY
        dragMoved = false
        isDragging = true
    }

    /** Fed from KickKeyModule.pointerMove while the L button is held. */
    fun onDragDelta(dx: Float, dy: Float) {
        if (!isDragging) return
        dragEndX = PointerOverlay.cursorX
        dragEndY = PointerOverlay.cursorY
        val moved = kotlin.math.hypot(
            (dragEndX - dragStartX).toDouble(),
            (dragEndY - dragStartY).toDouble()
        )
        if (moved >= DRAG_MIN_DISTANCE_PX) dragMoved = true
    }

    fun endDrag() {
        if (!isDragging) return
        isDragging = false
        if (dragMoved) {
            dispatchGestureSafe(buildSwipeGesture(
                dragStartX, dragStartY, dragEndX, dragEndY, 200L
            ))
        } else {
            // Pressed L without moving → plain left click.
            tapAt(dragEndX, dragEndY)
        }
    }

    // ── Scrolling ───────────────────────────────────────────────────────────
    // Priority (plan §12): ① ACTION_SCROLL on the focused node, ② throttled
    // swipe stroke at the cursor. (Pro-mode wheel events are M4.)

    /** Returns true when the scroll was handled. direction: "up" | "down" */
    fun scrollAt(direction: String, x: Float, y: Float): Boolean {
        val nodeAction = if (direction == "up") {
            AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
        } else {
            AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
        }
        if (performScrollOnFocusedNode(nodeAction)) return true

        // Swipe fallback — throttled so held-button repeats don't pile up.
        val now = SystemClock.uptimeMillis()
        if (now - lastScrollDispatchMs < SCROLL_THROTTLE_MS) return true
        lastScrollDispatchMs = now

        val maxY = resources.displayMetrics.heightPixels.toFloat()
        // "up" = see content above = finger swipes DOWN (y increases downward)
        val fromY = (if (direction == "up") y - SCROLL_SWIPE_DISTANCE_PX
                     else y + SCROLL_SWIPE_DISTANCE_PX).coerceIn(0f, maxY)
        val toY = (if (direction == "up") y + SCROLL_SWIPE_DISTANCE_PX
                   else y - SCROLL_SWIPE_DISTANCE_PX).coerceIn(0f, maxY)
        dispatchGestureSafe(buildSwipeGesture(x, fromY, x, toY, SCROLL_SWIPE_DURATION_MS))
        return true
    }

    /** Forward chevron: no global action exists; best effort = scroll-forward on the focused node. */
    fun scrollForwardOnNode(): Boolean =
        performScrollOnFocusedNode(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)

    /** Walks up from the focused node performing [action] until one handles it. */
    private fun performScrollOnFocusedNode(action: Int): Boolean {
        val root = rootInActiveWindow ?: return false
        var node: AccessibilityNodeInfo? = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        var handled = false
        while (node != null) {
            if (node.performAction(action)) {
                handled = true
                break
            }
            val parent = node.parent ?: break
            node = parent
        }
        // Note: node.recycle() omitted for brevity; add per-node recycling in M5
        // hardening if you target API < 33 (33+ made recycle() a no-op).
        return handled
    }

    // ── Back / Home ─────────────────────────────────────────────────────────

    fun navigateBack(): Boolean = performGlobalAction(GLOBAL_ACTION_BACK)

    // ── Gesture queue + builders ────────────────────────────────────────────

    private fun dispatchGestureSafe(gesture: GestureDescription) {
        gestureQueue.addLast(gesture)
        pumpGestureQueue()
    }

    private fun pumpGestureQueue() {
        if (gestureInFlight) return
        val next = gestureQueue.removeFirstOrNull() ?: return
        gestureInFlight = true
        val callback = object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                gestureInFlight = false
                pumpGestureQueue()
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                gestureInFlight = false
                pumpGestureQueue()
            }
        }
        dispatchGesture(next, callback, mainHandler)
    }

    /** Tap / long-press: a single-point stroke of [durationMs]. */
    private fun buildTapGesture(x: Float, y: Float, durationMs: Long): GestureDescription {
        val path = Path().apply { moveTo(x, y) }
        return GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, durationMs))
            .build()
    }

    /** Swipe / drag: a straight line from (fromX, fromY) to (toX, toY). */
    private fun buildSwipeGesture(
        fromX: Float, fromY: Float, toX: Float, toY: Float, durationMs: Long
    ): GestureDescription {
        val path = Path().apply {
            moveTo(fromX, fromY)
            lineTo(toX, toY)
        }
        return GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, durationMs))
            .build()
    }

    /** True when (x, y) falls inside the floating panel window — taps there are ignored. */
    private fun isPointInPanel(x: Float, y: Float): Boolean {
        val container = panelContainer ?: return false
        val lp = container.layoutParams as? WindowManager.LayoutParams ?: return false
        val w = if (container.width > 0) container.width else panelWidthPx
        val h = if (container.height > 0) container.height else panelHeightPx
        return x >= lp.x && x <= lp.x + w && y >= lp.y && y <= lp.y + h
    }
```

**১ঘ.** টিয়ারডাউনে কিউ পরিষ্কার করুন — বিদ্যমান `hideFloatingPanel()`-এ এক লাইন যোগ করুন:

```kotlin
        gestureQueue.clear()
```

এবং `onUnbind` / `onDestroy`-এর ভেতরেও একই লাইন (`hideFloatingPanel()`-এর আগে), যেন সার্ভিস মারা যাওয়ার পর পুরনো জেসচার না চলে:

```kotlin
        gestureQueue.clear()
```

> API নোট: `dispatchGesture` / `GestureDescription` API 24+ — KickKey-এর minSdk 24-এর ভেতরে, কোনো গার্ড লাগে না। পাবলিক API **Path-ভিত্তিক** (`GestureDescription.StrokeDescription(path, startTime, duration)`); সিস্টেম পাথ থেকে DOWN/MOVE/UP ইভেন্ট তৈরি করে।

---

### ধাপ ২ — `KickKeyInputMethodService.kt`-এ IME স্ট্রিপ মোড

**সম্পাদনা:** `native-files/java/com/kickkey/KickKeyInputMethodService.kt`

**২ক.** কমপ্যানিয়ন সিংগলটন যোগ করুন (`KickKeyModule.setTouchpadMode` যেন একই প্রসেসে IME-তে পৌঁছাতে পারে)। বিদ্যমান `companion object`-এ:

```kotlin
        // M3: singleton so KickKeyModule (same :ime_process) can reach the IME.
        @Volatile
        var instance: KickKeyInputMethodService? = null
            private set
```

**২খ.** বিদ্যমান `onCreate()`-এ সেট করুন (প্রথম লাইনে):

```kotlin
        instance = this
```

**২গ.** `onDestroy()`-এ পরিষ্কার করুন (`super.onDestroy()`-এর আগে):

```kotlin
        instance = null
```

**২ঘ.** স্ট্রিপ-মোড স্টেট + মেথড যোগ করুন (`keyboardHeightPx`-এর কাছে):

```kotlin
    // ── M3: touchpad strip mode ─────────────────────────────────────────────
    // When the keyboard's touchpad tab is active, shrink the IME window to a
    // thin strip so the pointer has the whole screen to move over (plan §5).
    private var touchpadStripMode = false

    private val stripHeightPx: Int
        get() = (90 * resources.displayMetrics.density).toInt()

    private val currentKeyboardHeightPx: Int
        get() = if (touchpadStripMode) stripHeightPx else keyboardHeightPx

    /** Main-thread only. Called from KickKeyModule.setTouchpadMode. */
    fun setTouchpadStripMode(on: Boolean) {
        if (touchpadStripMode == on) return
        touchpadStripMode = on
        val container = keyboardContainer
        if (container != null) {
            container.layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                currentKeyboardHeightPx
            )
            container.minimumHeight = currentKeyboardHeightPx
            container.requestLayout()
        }
        window?.window?.setLayout(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT
        )
        Log.i(TAG, "Touchpad strip mode: $on (height=${currentKeyboardHeightPx}px)")
    }
```

**২ঙ.** কন্টেইনারের `onMeasure` + লেআউট প্যারামিটার ডাইনামিক উচ্চতায় বদলান। বিদ্যমান `ensureSurfaceCreated()`-এ `keyboardHeightPx` → `currentKeyboardHeightPx` **তিনটি** জায়গায়:

```kotlin
                    // inside the FrameLayout onMeasure:
                    val height = minOf(
                        currentKeyboardHeightPx,
                        (resources.displayMetrics.heightPixels * 0.9f).toInt().coerceAtLeast(1)
                    )
```
```kotlin
                }.apply {
                    layoutParams = FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        currentKeyboardHeightPx
                    )
                    minimumHeight = currentKeyboardHeightPx
```
> (`keyboardHeightPx` প্রপার্টি থেকে যায় — এটি এখনো "ফুল" উচ্চতা।)

---

### ধাপ ৩ — `KickKeyModule.kt` পুনঃনির্দেশ করুন

**সম্পাদনা:** `native-files/java/com/kickkey/KickKeyModule.kt`

`mouseClick`, `scrollPage`, `navigateHistory`-এর বডি প্রতিস্থাপন করুন এবং `pointerMove` বাড়ান; `setTouchpadMode`, `dragStart`, `dragEnd` যোগ করুন। (পুরনো `InputConnection` বডি **ফলব্যাক** হিসেবে থাকে — a11y সার্ভিস বন্ধ থাকলে — পরিকল্পনা §১৫।)

**৩ক.** `mouseClick` — কার্সরে a11y ট্যাপ/লং-প্রেস, নাহলে পুরনো আচরণ:

```kotlin
    @ReactMethod
    fun mouseClick(button: String, promise: Promise) {
        val svc = KickKeyAccessibilityService.instance
        Handler(Looper.getMainLooper()).post {
            if (svc != null) {
                // Cross-app path: inject a real tap / long-press under the cursor.
                if (button == "left") {
                    svc.tapAt(PointerOverlay.cursorX, PointerOverlay.cursorY)
                } else {
                    svc.longPressAt(PointerOverlay.cursorX, PointerOverlay.cursorY)
                }
                hapticManager?.vibrate()
            } else {
                // Fallback: a11y disabled → previous text-field behavior.
                val ic = activeInputConnection
                if (ic != null) {
                    if (button == "left") {
                        ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_CENTER))
                        ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP,   KeyEvent.KEYCODE_DPAD_CENTER))
                    } else {
                        ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MENU))
                        ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP,   KeyEvent.KEYCODE_MENU))
                    }
                    hapticManager?.vibrate()
                }
            }
            promise.resolve(null)
        }
    }
```

**৩খ.** `scrollPage` — সার্ভিস দিয়ে নোড অ্যাকশন/সোয়াইপ, নাহলে পুরনো কী:

```kotlin
    @ReactMethod
    fun scrollPage(direction: String, promise: Promise) {
        val svc = KickKeyAccessibilityService.instance
        Handler(Looper.getMainLooper()).post {
            if (svc != null) {
                svc.scrollAt(direction, PointerOverlay.cursorX, PointerOverlay.cursorY)
            } else {
                val ic = activeInputConnection
                if (ic != null) {
                    val keyCode = if (direction == "up") KeyEvent.KEYCODE_PAGE_UP
                                  else                   KeyEvent.KEYCODE_PAGE_DOWN
                    ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
                    ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP,   keyCode))
                    hapticManager?.vibrate()
                }
            }
            promise.resolve(null)
        }
    }
```

**৩গ.** `navigateHistory` — এখন **Boolean** রেজলভ করে (true = হ্যান্ডলড, false = অসমর্থিত → JS ইঙ্গিত)। Back গ্লোবাল অ্যাকশনে; Forward শুধু স্ক্রল-ফরোয়ার্ডে:

```kotlin
    @ReactMethod
    fun navigateHistory(direction: String, promise: Promise) {
        val svc = KickKeyAccessibilityService.instance
        Handler(Looper.getMainLooper()).post {
            if (direction == "backward") {
                val handled = if (svc != null) {
                    svc.navigateBack()
                } else {
                    // Fallback: ALT + DPAD_LEFT (word-left / history-back).
                    val ic = activeInputConnection
                    if (ic != null) {
                        val metaState = KeyEvent.META_ALT_ON
                        ic.sendKeyEvent(KeyEvent(0L, 0L, KeyEvent.ACTION_DOWN,
                            KeyEvent.KEYCODE_DPAD_LEFT, 0, metaState))
                        ic.sendKeyEvent(KeyEvent(0L, 0L, KeyEvent.ACTION_UP,
                            KeyEvent.KEYCODE_DPAD_LEFT, 0, metaState))
                        hapticManager?.vibrate()
                    }
                    true
                }
                promise.resolve(handled)
            } else {
                // Forward: no GLOBAL_ACTION_FORWARD and a11y cannot inject keys.
                // Best effort = scroll-forward on the focused node; JS shows a
                // subtle hint when this resolves false. (Pro mode = M4.)
                promise.resolve(svc?.scrollForwardOnNode() ?: false)
            }
        }
    }
```

**৩ঘ.** `pointerMove` — সার্ভিসের ড্র্যাগ অ্যাকুমুলেটরেও দিন (L-ড্র্যাগ):

```kotlin
    @ReactMethod
    fun pointerMove(dx: Double, dy: Double, promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            PointerOverlay.move(dx.toFloat(), dy.toFloat())
            KickKeyAccessibilityService.instance?.onDragDelta(dx.toFloat(), dy.toFloat())
            promise.resolve(null)
        }
    }
```

**৩ঙ.** নতুন মেথড (অন্য টাচপ্যাড মেথডের কাছে যোগ করুন):

```kotlin
    // ── Touchpad: IME strip mode + drag (M3) ───────────────────────────────

    /** Shrinks the IME window to a thin strip while the touchpad tab is active. */
    @ReactMethod
    fun setTouchpadMode(on: Boolean, promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            KickKeyInputMethodService.instance?.setTouchpadStripMode(on)
            promise.resolve(null)
        }
    }

    /** L button pressed — arm a drag at the cursor's current position. */
    @ReactMethod
    fun dragStart(promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            KickKeyAccessibilityService.instance?.beginDrag()
            promise.resolve(null)
        }
    }

    /** L button released — dispatch a drag stroke, or a tap if nothing moved. */
    @ReactMethod
    fun dragEnd(promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            KickKeyAccessibilityService.instance?.endDrag()
            promise.resolve(null)
        }
    }
```

---

### ধাপ ৪ — ব্রিজ মডিউল র‍্যাপার

**সম্পাদনা:** `modules/kickkey-module/index.ts`

**৪ক.** `navigateHistory` র‍্যাপার প্রতিস্থাপন করুন (এখন Boolean দেয়):

```ts
  /**
   * Back/Forward navigation.
   * - "backward" → system Back (GLOBAL_ACTION_BACK). Resolves true.
   * - "forward"  → best-effort scroll-forward on the focused node; resolves
   *   false when unsupported (no a11y API for Forward — pro mode in M4).
   */
  navigateHistory: (direction: 'backward' | 'forward'): Promise<boolean> =>
    KickKey.navigateHistory(direction),
```

**৪খ.** নতুন র‍্যাপার যোগ করুন (পয়েন্টার ব্লকের পরে):

```ts
  // ── Touchpad: IME strip mode + drag (M3) ────────────────────────────────

  /** Shrinks the IME window to a thin strip while touchpad mode is active. */
  setTouchpadMode: (on: boolean): Promise<void> => KickKey.setTouchpadMode(on),

  /** L button pressed — arm a drag at the cursor. */
  dragStart: (): Promise<void> => KickKey.dragStart(),

  /** L button released — dispatch a drag stroke (or a tap if nothing moved). */
  dragEnd: (): Promise<void> => KickKey.dragEnd(),
```

**৪গ.** `mouseClick` ডক কমেন্ট হালনাগাদ করুন:

```ts
  /**
   * Mouse button click at the current cursor position.
   * "left"  → real tap (dispatchGesture) via the accessibility service;
   *           text-field DPAD fallback when the service is off.
   * "right" → long-press at the cursor (context-menu equivalent).
   */
  mouseClick: (button: 'left' | 'right'): Promise<void> =>
    KickKey.mouseClick(button),
```

---

### ধাপ ৫ — `Touchpad.tsx`: প্রকৃত-ইনপুট ওয়্যারিং

**সম্পাদনা:** `src/keyboard/qykey/Touchpad.tsx`

**৫ক.** ইন্টারফেস — DPAD `onMoveCursor` বাদ দিন, ড্র্যাগ + ট্যাপ-টু-ক্লিক + রিপিট প্রপস যোগ করুন:

```tsx
export interface TouchpadProps {
  onScrollPage?: (direction: 'up' | 'down') => void;
  /** Start/stop held-button scroll repeat (carets). */
  onScrollRepeatStart?: (direction: 'up' | 'down') => void;
  onScrollRepeatEnd?: () => void;
  /** Resolves false when Forward is unsupported (JS shows a hint). */
  onNavigateHistory?: (direction: 'backward' | 'forward') => Promise<boolean> | boolean;
  onMouseClick?: (button: 'left' | 'right') => void;
  /** L button press-in / press-out (native decides tap vs drag). */
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Quick lift on the surface = left click (default on). */
  tapToClick?: boolean;
  onPointerShow?: () => Promise<boolean> | boolean;
  onPointerHide?: () => void;
  onPointerMove?: (dx: number, dy: number) => void;
  onRequestPointerPermission?: () => void;
}
```

**৫খ.** কম্পোনেন্ট সিগনেচার + refs — DPAD অ্যাকুমুলেটর বাদ, ট্যাপ-টু-ক্লিক + ফরোয়ার্ড-ইঙ্গিত স্টেট যোগ:

```tsx
export default function Touchpad({
  onScrollPage,
  onScrollRepeatStart,
  onScrollRepeatEnd,
  onNavigateHistory,
  onMouseClick,
  onDragStart,
  onDragEnd,
  tapToClick = true,
  onPointerShow,
  onPointerHide,
  onPointerMove,
  onRequestPointerPermission,
}: TouchpadProps) {
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [forwardHint, setForwardHint] = useState(false);

  const onScrollPageRef = useRef(onScrollPage);
  const onNavigateHistoryRef = useRef(onNavigateHistory);
  const onMouseClickRef = useRef(onMouseClick);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const onPointerMoveRef = useRef(onPointerMove);
  const onPointerShowRef = useRef(onPointerShow);
  const onPointerHideRef = useRef(onPointerHide);
  const onRequestPointerPermissionRef = useRef(onRequestPointerPermission);
  const tapToClickRef = useRef(tapToClick);

  useEffect(() => {
    onScrollPageRef.current = onScrollPage;
    onNavigateHistoryRef.current = onNavigateHistory;
    onMouseClickRef.current = onMouseClick;
    onDragStartRef.current = onDragStart;
    onDragEndRef.current = onDragEnd;
    onPointerMoveRef.current = onPointerMove;
    onPointerShowRef.current = onPointerShow;
    onPointerHideRef.current = onPointerHide;
    onRequestPointerPermissionRef.current = onRequestPointerPermission;
    tapToClickRef.current = tapToClick;
  }, [onScrollPage, onScrollRepeatStart, onScrollRepeatEnd, onNavigateHistory,
      onMouseClick, onDragStart, onDragEnd, tapToClick,
      onPointerMove, onPointerShow, onPointerHide, onRequestPointerPermission]);

  // ── Tap-to-click detection ──
  const grantTimeRef = useRef(0);
  const maxDisplacementRef = useRef(0);
  const TAP_TO_CLICK_MAX_MS = 300;
  const TAP_TO_CLICK_MAX_PX = 14;
```

**৫গ.** `onPanResponderMove`-এ DPAD অ্যাকুমুলেশন ব্লক প্রতিস্থাপন করুন — পুরো `accX/accY/STEP_THRESHOLD/onMoveCursor` সেকশন **মুছে দিন**; শুধু pointer-move থ্রটল (M2) + সর্বোচ্চ ডিসপ্লেসমেন্ট ট্র্যাক রাখুন:

```tsx
      onPanResponderMove: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCursor({ x: locationX, y: locationY });

        const deltaX = gestureState.dx - lastDx.current;
        const deltaY = gestureState.dy - lastDy.current;
        lastDx.current = gestureState.dx;
        lastDy.current = gestureState.dy;

        // Track peak displacement for tap-to-click detection.
        maxDisplacementRef.current = Math.max(
          maxDisplacementRef.current,
          Math.hypot(gestureState.dx, gestureState.dy),
        );

        // Move the on-screen desktop pointer (relative, trackpad-style),
        // batched and flushed once per animation frame (60Hz cap).
        pendingDelta.current.x += deltaX;
        pendingDelta.current.y += deltaY;
        if (!rafPending.current) {
          rafPending.current = true;
          requestAnimationFrame(flushPointerMove);
        }
      },
```

**৫ঘ.** `onPanResponderGrant` — গ্রান্ট সময় + ডিসপ্লেসমেন্ট রিসেট:

```tsx
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCursor({ x: locationX, y: locationY });
        grantTimeRef.current = Date.now();
        maxDisplacementRef.current = 0;
        pendingDelta.current = { x: 0, y: 0 };
        rafPending.current = false;
        lastDx.current = 0;
        lastDy.current = 0;
      },
```

**৫ঙ.** `onPanResponderRelease` — সেটিং চালু থাকলে ট্যাপ-টু-ক্লিক:

```tsx
      onPanResponderRelease: () => {
        setCursor(null);
        pendingDelta.current = { x: 0, y: 0 };
        rafPending.current = false;
        lastDx.current = 0;
        lastDy.current = 0;
        // Tap-to-click: quick lift, almost no movement → left click.
        const quick =
          Date.now() - grantTimeRef.current < TAP_TO_CLICK_MAX_MS &&
          maxDisplacementRef.current < TAP_TO_CLICK_MAX_PX;
        if (quick && tapToClickRef.current) {
          onMouseClickRef.current?.('left');
        }
      },
```

( `onPanResponderTerminate`-এ একই রিসেট লাইন, ক্লিক ছাড়া।)

**৫চ.** ফরোয়ার্ড শেভরন অসমর্থিত-ইঙ্গিতসহ (বিদ্যমান ফরোয়ার্ড `Key` প্রতিস্থাপন):

```tsx
          <Key
            variant="nav"
            isIcon
            type="mouse"
            onPressHandler={() => {
              const result = onNavigateHistoryRef.current?.('forward');
              Promise.resolve(result).then((handled) => {
                if (handled === false) {
                  setForwardHint(true);
                  setTimeout(() => setForwardHint(false), 1500);
                }
              });
            }}
          >
            <FA5Icon name="chevron-right" size={12} color="#888" />
          </Key>
```

**৫ছ.** L বাটন — প্রেস-ইন ড্র্যাগ আর্ম করে, প্রেস-আউট শেষ করে (`Key` কম্পোনেন্টের `onPressHandler` = প্রেস-ইন ও `onRepeatEnd` = প্রেস-আউট ব্যবহার করে):

```tsx
          <Key
            variant="mouse"
            type="mouse"
            onPressHandler={() => onDragStartRef.current?.()}
            onRepeatEnd={() => onDragEndRef.current?.()}
          >
            <Text style={styles.btnText}>L</Text>
          </Key>
```

**৫জ.** R বাটন — সরল রাইট-ক্লিক:

```tsx
          <Key
            variant="mouse"
            type="mouse"
            onPressHandler={() => onMouseClickRef.current?.('right')}
          >
            <Text style={styles.btnText}>R</Text>
          </Key>
```

**৫ঝ.** স্ক্রল কেয়ারেট — একক ফায়ার + ধরে-রাখলে রিপিট (`Key`-এর `onRepeatStart`/`onRepeatEnd`):

```tsx
          <Key
            variant="scroll"
            isIcon
            type="mouse"
            onPressHandler={() => onScrollPageRef.current?.('up')}
            onRepeatStart={() => onScrollRepeatStart?.('up')}
            onRepeatEnd={() => onScrollRepeatEnd?.()}
          >
            <FA5Icon name="caret-up" size={14} color="#f2f2f2" />
          </Key>
          <Key
            variant="scroll"
            isIcon
            type="mouse"
            onPressHandler={() => onScrollPageRef.current?.('down')}
            onRepeatStart={() => onScrollRepeatStart?.('down')}
            onRepeatEnd={() => onScrollRepeatEnd?.()}
          >
            <FA5Icon name="caret-down" size={14} color="#f2f2f2" />
          </Key>
```

**৫ঞ.** "Forward not supported" ইঙ্গিত এলিমেন্ট যোগ করুন (`touchpadContainer`-এর ভেতরে, পারমিশন ব্যানারের কাছে):

```tsx
      {forwardHint && (
        <View
          style={{
            position: 'absolute',
            bottom: 78,
            alignSelf: 'center',
            zIndex: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>
            Forward is not supported on this Android version
          </Text>
        </View>
      )}
```

---

### ধাপ ৬ — `useKeyboardState.ts`: হ্যান্ডলার + স্ট্রিপ মোড + ট্যাপ-টু-ক্লিক প্রিফ

**সম্পাদনা:** `src/keyboard/hooks/useKeyboardState.ts`

**৬ক.** ইন্টারফেস — `handleMoveCursor` বাদ, ড্র্যাগ/রিপিট হ্যান্ডলার যোগ:

```ts
  // ── Touchpad ──────────────────────────────────────────────────────────────
  handleScrollPage: (direction: 'up' | 'down') => void;
  handleScrollRepeatStart: (direction: 'up' | 'down') => void;
  handleScrollRepeatEnd: () => void;
  handleNavigateHistory: (direction: 'backward' | 'forward') => Promise<boolean>;
  handleMouseClick: (button: 'left' | 'right') => void;
  handleDragStart: () => void;
  handleDragEnd: () => void;
```

**৬খ.** স্টেট + মাউন্টে `tapToClick` প্রিফ লোড (বিদ্যমান `kickkey_prefs` দিয়ে সংরক্ষিত):

```ts
  const [tapToClick, setTapToClick] = useState(true);

  useEffect(() => {
    getKickKey()
      ?.getPreferences()
      ?.then((prefs: any) => {
        if (prefs && typeof prefs.tapToClick === 'boolean') {
          setTapToClick(prefs.tapToClick);
        }
      })
      .catch(() => {});
  }, []);
```

**৬গ.** IME স্ট্রিপ মোড — টাচপ্যাড ট্যাব সক্রিয় হলে কীবোর্ড সঙ্কুচিত করুন:

```ts
  // ── Touchpad: IME strip mode (M3) ──────────────────────────────────────
  // Native shrinks the IME window to a thin strip so the pointer has the
  // whole screen (no-op when the panel is open / IME hidden).
  useEffect(() => {
    getKickKey()?.setTouchpadMode?.(toggleMode);
  }, [toggleMode]);
```

**৬ঘ.** টাচপ্যাড হ্যান্ডলার প্রতিস্থাপন (`handleMoveCursor` বাদ; বাকি ওয়্যার করুন):

```ts
  /** Scroll the focused view / app one step up or down. */
  const handleScrollPage = useCallback((direction: 'up' | 'down') => {
    getKickKey()?.scrollPage(direction);
  }, []);

  /** Held scroll caret → auto-repeat (mirrors backspace repeat: 350ms delay, 150ms tick). */
  const handleScrollRepeatStart = useCallback((direction: 'up' | 'down') => {
    if (scrollRepeatRef.current || scrollRepeatDelayRef.current) return;
    scrollRepeatDelayRef.current = setTimeout(() => {
      scrollRepeatDelayRef.current = null;
      scrollRepeatRef.current = setInterval(() => {
        getKickKey()?.scrollPage(direction);
      }, 150);
    }, 350);
  }, []);

  const handleScrollRepeatEnd = useCallback(() => {
    if (scrollRepeatDelayRef.current) {
      clearTimeout(scrollRepeatDelayRef.current);
      scrollRepeatDelayRef.current = null;
    }
    if (scrollRepeatRef.current) {
      clearInterval(scrollRepeatRef.current);
      scrollRepeatRef.current = null;
    }
  }, []);

  /** Back/Forward. Resolves false when Forward is unsupported. */
  const handleNavigateHistory = useCallback((direction: 'backward' | 'forward') => {
    const res = getKickKey()?.navigateHistory(direction);
    return res && typeof res.then === 'function' ? res : Promise.resolve(true);
  }, []);

  /** Mouse L/R button action (native: tap / long-press under the cursor). */
  const handleMouseClick = useCallback((button: 'left' | 'right') => {
    getKickKey()?.mouseClick(button);
  }, []);

  /** L button press-in — arm a native drag at the cursor. */
  const handleDragStart = useCallback(() => {
    getKickKey()?.dragStart();
  }, []);

  /** L button press-out — dispatch the drag stroke (or a tap). */
  const handleDragEnd = useCallback(() => {
    getKickKey()?.dragEnd();
  }, []);
```

**৬ঙ.** ব্যাকস্পেস refs-এর পাশে দুটি রিপিট ref যোগ করুন:

```ts
  const scrollRepeatDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

এবং বিদ্যমান আনমাউন্ট ক্লিনআপ ইফেক্টে পরিষ্কার করুন:

```ts
      if (scrollRepeatDelayRef.current) clearTimeout(scrollRepeatDelayRef.current);
      if (scrollRepeatRef.current) clearInterval(scrollRepeatRef.current);
```

**৬চ.** নতুন মান রিটার্ন করুন (রিটার্নড অবজেক্ট আপডেট):

```ts
    handleScrollPage, handleScrollRepeatStart, handleScrollRepeatEnd,
    handleNavigateHistory, handleMouseClick,
    handleDragStart, handleDragEnd, tapToClick,
```

---

### ধাপ ৭ — `QykeyKeyboard.tsx`: প্রপ ওয়্যারিং

**সম্পাদনা:** `src/keyboard/qykey/QykeyKeyboard.tsx`

**৭ক.** নতুন হ্যান্ডলার ডিস্ট্রাকচার:

```ts
    handleScrollPage,
    handleScrollRepeatStart,
    handleScrollRepeatEnd,
    handleNavigateHistory,
    handleMouseClick,
    handleDragStart,
    handleDragEnd,
    tapToClick,
    handlePointerShow,
    handlePointerHide,
    handlePointerMove,
    handleRequestPointerPermission,
```

**৭খ.** `<Touchpad />` প্রপস আপডেট (`onMoveCursor` বাদ, নতুনগুলো যোগ):

```tsx
              <Touchpad
                onScrollPage={handleScrollPage}
                onScrollRepeatStart={handleScrollRepeatStart}
                onScrollRepeatEnd={handleScrollRepeatEnd}
                onNavigateHistory={handleNavigateHistory}
                onMouseClick={handleMouseClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                tapToClick={tapToClick}
                onPointerShow={handlePointerShow}
                onPointerHide={handlePointerHide}
                onPointerMove={handlePointerMove}
                onRequestPointerPermission={handleRequestPointerPermission}
              />
```

---

## 4. বিল্ড ও ইনস্টল

```bash
cd react-native-kickKey-deepseek

node scripts/build-keyboard-bundle.js
npx expo prebuild --platform android
npx expo run:android
```

> নতুন ডিপেন্ডেন্সি লাগবে না। সব জেসচার API Android ফ্রেমওয়ার্কের (API 24+); প্রজেক্টের minSdk 24।

---

## 5. ম্যানুয়াল টেস্ট স্ক্রিপ্ট (M3 প্রস্থানের মানদণ্ড)

**সেটআপ:** a11y সার্ভিস সক্রিয় + বাটন/শর্টকাট বরাদ্দ (M1); **ফ্লোটিং প্যানেল** (বা IME স্ট্রিপ) ব্যবহার করুন যেন পয়েন্টারের পুরো-স্ক্রিন কভারেজ থাকে।

| # | ধাপ | প্রত্যাশিত |
|---|---|---|
| 1 | **লঞ্চার** খুলুন, অ্যাপ আইকনের উপর কার্সর নিয়ে **L** চাপুন (ড্র্যাগ ছাড়া) | অ্যাপ খোলে (প্রকৃত ট্যাপ ইনজেক্টেড) |
| 2 | ফোল্ডার/অ্যাপ আইকনের উপর **R** চাপুন | লং-প্রেস মেনু / আনইনস্টল / উইজেট মেনু আসে |
| 3 | **Settings**-এ, রো-র উপর hover করে **L** চাপুন | রো খোলে |
| 4 | স্ক্রলযোগ্য লিস্টে (Settings/ব্রাউজার) **স্ক্রল-ডাউন** কেয়ারেট ধরে রাখুন | লিস্ট স্ক্রল হয় (ফোকাসড নোড `ACTION_SCROLL` বা সোয়াইপ ফলব্যাক); ~150ms রিপিট ক্যাপ |
| 5 | **স্ক্রল-আপ**-এও একই | উপরে ফিরে স্ক্রল হয় |
| 6 | **Back** শেভরন চাপুন | আগের স্ক্রিন (প্রকৃত `GLOBAL_ACTION_BACK`) — Settings, ব্রাউজার, লঞ্চারে কাজ করে |
| 7 | **L-ড্র্যাগ**: **L** চেপে ধরে টাচপ্যাড surface-এ ড্র্যাগ করুন, ছাড়ুন | প্রকৃত ড্র্যাগ স্ট্রোক: স্লাইডার নব, নোটিফিকেশন শেড, বা লিস্ট আইটেম নড়ে (ডাউন→মুভ→আপ) |
| 8 | **ট্যাপ-টু-ক্লিক**: surface-এ দ্রুত ট্যাপ (নড়াচড়া ছাড়া) | কার্সরে লেফট ক্লিক |
| 9 | **স্ট্রিপ মোড**: IME কীবোর্ডে স্লাইডার টাচপ্যাডে টগল করুন | কীবোর্ড ~90dp স্ট্রিপে সঙ্কুচিত হয়; পয়েন্টার স্ক্রিনের নিচে পৌঁছাতে পারে |
| 10 | স্লাইডার ফেরান | কীবোর্ড ফুল উচ্চতায় ফেরে |
| 11 | **Forward** শেভরন | ক্র্যাশ নেই; হালকা "Forward is not supported" ইঙ্গিত আসে (অথবা ফোকাসড লিস্ট সাপোর্ট করলে স্ক্রল-ফরোয়ার্ড হয়) |
| 12 | **ফলব্যাক**: a11y সার্ভিস নিষ্ক্রিয় করে ফোকাসড টেক্সট ফিল্ডে টাচপ্যাড ব্যবহার করুন | পুরনো আচরণ (DPAD কেয়ারেট / PAGE_UP-PAGE_DOWN / কনটেক্সট মেনু) — ক্র্যাশ নেই |
| 13 | `adb logcat | grep -E "KickKeyA11y|KickKeyPointer"` | চলাকালীন কোনো এরর নেই |

**পাস = L/R/স্ক্রল/Back লঞ্চার, ব্রাউজার ও Settings-এ কাজ করে (§M3 প্রস্থানের মানদণ্ড), সাথে স্ট্রিপ মোড, L-ড্র্যাগ ও ট্যাপ-টু-ক্লিক।**

---

## 6. সমস্যা সমাধান (Troubleshooting)

| লক্ষণ | সম্ভাব্য কারণ | সমাধান |
|---|---|---|
| অন্য অ্যাপে ক্লিক কাজ করে না | a11y সার্ভিস সক্রিয় নয়, বা কনফিগ XML-এ `canPerformGestures` নেই | সার্ভিস চালু করুন (M1); `accessibility_service_config.xml`-এ `android:canPerformGestures="true"` + prebuild যাচাই করুন |
| ক্লিক কীবোর্ডেই পড়ে, অ্যাপে নয় | IME উইন্ডো টার্গেট ঢেকে রাখে; স্ট্রিপ মোড সক্রিয় নয় | টাচপ্যাড মোড ব্যবহার করুন (স্ট্রিপ IME সঙ্কুচিত করে) বা ফ্লোটিং প্যানেল |
| স্ক্রল বাটনে কিছু স্ক্রল হয় না | ফোকাসড নোডে স্ক্রল অ্যাকশন নেই এবং সোয়াইপ অ-স্ক্রলযোগ্য জায়গায় পড়েছে | স্ক্রলের আগে কার্সর লিস্টের উপর রাখুন; logcat-এ নোড-অ্যাকশন/সোয়াইপ পথ দেখুন |
| Back প্যানেল বন্ধ করে, নেভিগেট করে না | কার্সর/ট্যাপ প্যানেল rect-এ, বা প্যানেল ফোকাস নিয়েছে | Back গ্লোবাল অ্যাকশন (ট্যাপ নয়) — অ্যাপ নেভিগেট করে; প্যানেল ফোকাসড হলে আগে বাইরে ট্যাপ করুন |
| Forward কখনো কাজ করে না | Forward-এর কোনো a11y API নেই (প্রত্যাশিত) | ইঙ্গিতই সঠিক আচরণ; pro mode (M4) Android ≤ 11-এ `KEYCODE_FORWARD` যোগ করবে |
| L-ড্র্যাগ ড্র্যাগ করে না | `dragEnd` নড়াচড়া ছাড়া ফায়ার হয়েছে (24px-এর নিচে) → ট্যাপ হয়েছে | আরও ড্র্যাগ করুন; `dragStart`/`dragEnd` নেটিভে পৌঁছাচ্ছে কি না যাচাই (logcat) |
| জেসচার কিউ আটকে যায় (ক্লিক সাড়া দেয় না) | ডিসপ্যাচড জেসচার কখনো কমপ্লিট/ক্যানসেল হয়নি | বিরল ফ্রেমওয়ার্ক সমস্যা; প্যানেল পুনরায় খুলে বা সার্ভিস টগল করে কিউ পরিষ্কার করুন |
| স্ট্রিপ মোডে কীবোর্ড সঙ্কুচিত হয় না | `setTouchpadMode` কখনো কল হয়নি, বা `updateSoftInputWindowLayout` নো-অপ করেছে | `useKeyboardState`-এর `useEffect([toggleMode])` যাচাই করুন; `KickKeyIME` logcat-এ "Touchpad strip mode" দেখুন |

---

## 7. M3-এর পরিধির বাইরে (স্থগিত)

| মাইলফলক | স্থগিত কাজ |
|---|---|
| M4 | Pro mode (`INJECT_EVENTS`: প্রকৃত hover, হুইল স্ক্রল, Forward), নোটিফিকেশন এন্ট্রি পয়েন্ট, সেটিংস UI (ট্যাপ-টু-ক্লিক টগল ইত্যাদি) |
| M5 | নতুন surface-এর ওয়াচডগ, লেজি প্রি-ওয়ার্ম, API < 33-এ node-recycle হার্ডেনিং, Play ঘোষণা, প্রাইভেসি পলিসি |

ইচ্ছাকৃতভাবে M3-এ **না** থাকা বিষয়:
- ডাবল-ক্লিক / দুই-আঙুলের রাইট-ক্লিক (ঐচ্ছিক সেটিং, পরে)।
- `HOME` / `RECENTS` গ্লোবাল বাটন (সার্ভিসে API আছে; UI পরে)।
- L চেপে না রেখে টাচপ্যাডে টেনে ড্র্যাগ (L-ড্র্যাগই নির্ধারিত ইন্টারঅ্যাকশন)।

---

## 8. সমাপ্তির মানদণ্ড (Definition of Done)

- [ ] `KickKeyAccessibilityService.kt`: জেসচার কিউ + `tapAt` / `longPressAt` / `scrollAt` / `navigateBack` / `beginDrag`-`onDragDelta`-`endDrag` / `isPointInPanel`; `hideFloatingPanel`/`onUnbind`/`onDestroy`-এ কিউ পরিষ্কার
- [ ] `KickKeyInputMethodService.kt`: কমপ্যানিয়ন `instance`, `setTouchpadStripMode`, কন্টেইনার `onMeasure` + লেআউট প্যারামিটারে `currentKeyboardHeightPx`
- [ ] `KickKeyModule.kt`: `mouseClick`/`scrollPage`/`navigateHistory` সার্ভিস-প্রথম + `InputConnection` ফলব্যাক; `navigateHistory` Boolean দেয়; নতুন `setTouchpadMode`, `dragStart`, `dragEnd`; `pointerMove`-এ `onDragDelta` ফিড
- [ ] `modules/kickkey-module/index.ts`: `navigateHistory → Promise<boolean>`, নতুন র‍্যাপার
- [ ] `Touchpad.tsx`: DPAD স্টেপিং বাদ, ট্যাপ-টু-ক্লিক, L = dragStart/dragEnd, R = রাইট-ক্লিক, স্ক্রল রিপিট প্রপস, Forward ইঙ্গিত
- [ ] `useKeyboardState.ts`: নতুন হ্যান্ডলার + রিপিট refs + `setTouchpadMode` ইফেক্ট + `tapToClick` প্রিফ
- [ ] `QykeyKeyboard.tsx`: Touchpad প্রপস আপডেট
- [ ] §৫ টেস্ট স্ক্রিপ্ট পাস (বাস্তব অ্যাপে L/R/স্ক্রল/Back, স্ট্রিপ মোড, L-ড্র্যাগ, ট্যাপ-টু-ক্লিক, ফলব্যাক)
- [ ] চলাকালীন logcat-এ `KickKeyA11y` এরর নেই

**সব চেক শেষে → M4 (pro mode + সেটিংস UI) সংযোজনীয়; M5 কমপ্লায়েন্স + পলিশ।**
