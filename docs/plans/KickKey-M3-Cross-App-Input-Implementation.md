# KickKey — M3 Implementation Guide
## Cross-App Input: Clicks, Scroll, Back via the Accessibility Service

> **Platform:** Android Only · **Project:** `react-native-kickKey-deepseek` · **Milestone:** M3 · **Status:** READY TO IMPLEMENT
> Follows the approved plan: [`KickKey-Accessibility-Touchpad-Plan.md`](./KickKey-Accessibility-Touchpad-Plan.md)
> Prerequisites: M1 (a11y service + panel) + M2 (RN cursor). See the M1/M2 guides in this folder.

---

## 1. What M3 Delivers

| From plan §26 | M3 — Cross-app input |
|---|---|
| Scope | `tapAt` / `longPressAt` / swipe / `GLOBAL_ACTION_BACK` in the a11y service, scroll fallbacks, IME strip mode, touchpad button rewiring |
| Exit criteria | **L/R click, scroll up/down, and Back work in real apps** (launcher, browser, settings) |

**In one sentence:** after this milestone the touchpad buttons stop sending text-field DPAD keys and instead inject **real touch gestures into whatever app is under the cursor** (`dispatchGesture`), send **Back** via the system global action, scroll focused lists, support **L-drag** (a real drag stroke), **tap-to-click**, and shrink the IME keyboard to a thin **strip** in touchpad mode so the pointer has the whole screen.

The plan's gesture table (§10) — Play-safe path:

| Action | Emulation |
|---|---|
| Left click | `dispatchGesture` tap at cursor (down+up, ~60ms) |
| Right click | `dispatchGesture` long-press at cursor (~600ms) |
| Drag | One stroke: down → move → up (start→end path) |
| Scroll | Focused-node `ACTION_SCROLL_*` first; swipe-stroke fallback |
| Back | `performGlobalAction(GLOBAL_ACTION_BACK)` |
| Forward | `ACTION_SCROLL_FORWARD` on focused node only (no API); full support is M4 pro mode |

Fallback rule (plan §15): when the accessibility service is **disabled**, every touchpad action degrades to the **existing text-field behavior** (`InputConnection` DPAD keys) instead of breaking.

---

## 2. Architecture Recap

```
Finger/L/R on Touchpad.tsx (JS)
   │
   ├─ surface drag ────────────► onPointerMove(dx,dy) → KickKey.pointerMove
   │                               └─ PointerOverlay.move (M2) + service.onDragDelta (if L held)
   ├─ L press-in ──────────────► onDragStart → KickKey.dragStart → service.beginDrag()
   ├─ L press-out ─────────────► onDragEnd   → KickKey.dragEnd   → service.endDrag()
   │                               ├─ moved ≥ 24px → one swipe stroke (real drag)
   │                               └─ else       → tapAt(cursor) (left click)
   ├─ R press ────────────────► onMouseClick('right') → KickKey.mouseClick → service.longPressAt(cursor)
   ├─ tap-to-click ────────────► onMouseClick('left') → KickKey.mouseClick → service.tapAt(cursor)
   ├─ scroll carets (repeat) ──► onScrollPage('up'|'down') → KickKey.scrollPage
   │                               └─ service.scrollAt: ① ACTION_SCROLL on focused node
   │                                                   ② throttled swipe stroke at cursor
   └─ Back chevron ────────────► onNavigateHistory('backward') → KickKey.navigateHistory
                                   └─ service.navigateBack() = GLOBAL_ACTION_BACK
      Forward chevron ─────────► onNavigateHistory('forward')
                                   └─ service.scrollForwardOnNode() or false → JS hint

KickKeyAccessibilityService (M1) + M3 additions:
   ├─ dispatchGestureSafe()  — serialized queue, one gesture at a time,
   │                           per-gesture completion callbacks
   ├─ tapAt / longPressAt / scrollAt / navigateBack / drag lifecycle
   ├─ isPointInPanel()       — clicks over the floating panel are ignored
   └─ performScrollOnFocusedNode() — uses rootInActiveWindow (config XML
                                     already has canRetrieveWindowContent)

KickKeyInputMethodService (M3 edit):
   └─ setTouchpadStripMode(on) — IME window height 275dp ⇄ 90dp strip
                                  (updateSoftInputWindowLayout + re-measure)

KickKeyModule (M3 re-point):
   mouseClick / scrollPage / navigateHistory → service first, InputConnection fallback
   NEW: setTouchpadMode, dragStart, dragEnd (navigateHistory now returns Boolean)
```

---

## 3. Step-by-Step Implementation

### Step 1 — Add the gesture API to `KickKeyAccessibilityService.kt`

**Edit:** `native-files/java/com/kickkey/KickKeyAccessibilityService.kt`

**1a.** Add imports (top of file):

```kotlin
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
```

**1b.** Add constants to the existing `companion object` (after `PANEL_HEIGHT_DP`):

```kotlin
        // ── Gesture timing (M3) ──
        private const val TAP_DURATION_MS = 60L            // left-click tap
        private const val LONG_PRESS_DURATION_MS = 600L    // right-click proxy
        private const val SCROLL_SWIPE_DURATION_MS = 300L  // swipe fallback
        private const val SCROLL_SWIPE_DISTANCE_PX = 200   // swipe fallback length
        private const val DRAG_MIN_DISTANCE_PX = 24        // below this = tap, not drag
        private const val SCROLL_THROTTLE_MS = 150L        // repeat-scroll cap
```

**1c.** Append the whole M3 block **inside the class** (after `resumeHostWhenReady`, before the final closing brace):

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

**1d.** Clear the queue on teardown — add one line to the existing `hideFloatingPanel()`:

```kotlin
        gestureQueue.clear()
```

and the same line inside `onUnbind` / `onDestroy` (before `hideFloatingPanel()`), so stale gestures never fire after the service dies:

```kotlin
        gestureQueue.clear()
```

> API note: `dispatchGesture` / `GestureDescription` are API 24+ — inside KickKey's minSdk 24, no guard needed. The public API is **Path-based** (`GestureDescription.StrokeDescription(path, startTime, duration)`); the system synthesizes the DOWN/MOVE/UP events from the path.

---

### Step 2 — IME strip mode in `KickKeyInputMethodService.kt`

**Edit:** `native-files/java/com/kickkey/KickKeyInputMethodService.kt`

**2a.** Add a companion singleton (needed so `KickKeyModule.setTouchpadMode` can reach the IME service from the same process). Add to the existing `companion object`:

```kotlin
        // M3: singleton so KickKeyModule (same :ime_process) can reach the IME.
        @Volatile
        var instance: KickKeyInputMethodService? = null
            private set
```

**2b.** Set it in `onCreate()` (first line of the existing `onCreate`):

```kotlin
        instance = this
```

**2c.** Clear it in `onDestroy()` (before `super.onDestroy()`):

```kotlin
        instance = null
```

**2d.** Add the strip-mode state + methods (place near `keyboardHeightPx`):

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

**2e.** Switch the container's `onMeasure` + layout params to the dynamic height. In the existing `ensureSurfaceCreated()`, replace `keyboardHeightPx` with `currentKeyboardHeightPx` in **three** places:

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
> (The `keyboardHeightPx` property itself stays — it's still the "full" height.)

---

### Step 3 — Re-point `KickKeyModule.kt`

**Edit:** `native-files/java/com/kickkey/KickKeyModule.kt`

Replace the bodies of `mouseClick`, `scrollPage`, `navigateHistory` and extend `pointerMove`; add `setTouchpadMode`, `dragStart`, `dragEnd`. (Old `InputConnection` bodies stay as the **fallback** when the a11y service is off — plan §15.)

**3a.** `mouseClick` — a11y tap/long-press at the cursor, else old behavior:

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

**3b.** `scrollPage` — node action / swipe via the service, else old keys:

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

**3c.** `navigateHistory` — now resolves a **Boolean** (true = handled, false = unsupported → JS hint). Back via global action; Forward via scroll-forward only:

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

**3d.** `pointerMove` — also feed the service's drag accumulator (L-drag):

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

**3e.** New methods (append near the other touchpad methods):

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

### Step 4 — Bridge module wrappers

**Edit:** `modules/kickkey-module/index.ts`

**4a.** Replace the `navigateHistory` wrapper (now returns Boolean):

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

**4b.** Add the new wrappers (after the pointer block):

```ts
  // ── Touchpad: IME strip mode + drag (M3) ────────────────────────────────

  /** Shrinks the IME window to a thin strip while touchpad mode is active. */
  setTouchpadMode: (on: boolean): Promise<void> => KickKey.setTouchpadMode(on),

  /** L button pressed — arm a drag at the cursor. */
  dragStart: (): Promise<void> => KickKey.dragStart(),

  /** L button released — dispatch a drag stroke (or a tap if nothing moved). */
  dragEnd: (): Promise<void> => KickKey.dragEnd(),
```

**4c.** Refresh the `mouseClick` doc comment:

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

### Step 5 — `Touchpad.tsx`: real-input wiring

**Edit:** `src/keyboard/qykey/Touchpad.tsx`

**5a.** Interface — drop the DPAD `onMoveCursor`, add drag + tap-to-click + repeat props:

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

**5b.** Component signature + refs — remove the DPAD accumulators, add tap-to-click + forward-hint state:

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

**5c.** Replace the DPAD accumulation block in `onPanResponderMove` — the whole `accX/accY/STEP_THRESHOLD/onMoveCursor` section is **deleted**; keep only the pointer-move throttle (M2) + track max displacement:

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

**5d.** `onPanResponderGrant` — record the grant time + reset displacement:

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

**5e.** `onPanResponderRelease` — tap-to-click when the setting is on:

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

(same reset lines in `onPanResponderTerminate`, without the click.)

**5f.** Forward chevron with the unsupported hint (replace the existing forward `Key`):

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

**5g.** L button — press-in arms the drag, press-out ends it (via the `Key` component's `onPressHandler` = press-in and `onRepeatEnd` = press-out):

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

**5h.** R button — plain right-click:

```tsx
          <Key
            variant="mouse"
            type="mouse"
            onPressHandler={() => onMouseClickRef.current?.('right')}
          >
            <Text style={styles.btnText}>R</Text>
          </Key>
```

**5i.** Scroll carets — single fire + held-repeat (the `Key` component's `onRepeatStart`/`onRepeatEnd`):

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

**5j.** Add the "Forward not supported" hint element (inside `touchpadContainer`, near the permission banner):

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

### Step 6 — `useKeyboardState.ts`: handlers + strip mode + tap-to-click pref

**Edit:** `src/keyboard/hooks/useKeyboardState.ts`

**6a.** Interface — remove `handleMoveCursor`, add drag/repeat handlers:

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

**6b.** Add state + load the `tapToClick` pref on mount (persisted via the existing `kickkey_prefs`):

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

**6c.** IME strip mode — shrink the keyboard whenever the touchpad tab is active:

```ts
  // ── Touchpad: IME strip mode (M3) ──────────────────────────────────────
  // Native shrinks the IME window to a thin strip so the pointer has the
  // whole screen (no-op when the panel is open / IME hidden).
  useEffect(() => {
    getKickKey()?.setTouchpadMode?.(toggleMode);
  }, [toggleMode]);
```

**6d.** Replace the touchpad handlers (remove `handleMoveCursor`; wire the rest):

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

**6e.** Add the two repeat refs next to the backspace refs:

```ts
  const scrollRepeatDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

and clear them in the existing unmount cleanup effect:

```ts
      if (scrollRepeatDelayRef.current) clearTimeout(scrollRepeatDelayRef.current);
      if (scrollRepeatRef.current) clearInterval(scrollRepeatRef.current);
```

**6f.** Return the new values (update the returned object):

```ts
    handleScrollPage, handleScrollRepeatStart, handleScrollRepeatEnd,
    handleNavigateHistory, handleMouseClick,
    handleDragStart, handleDragEnd, tapToClick,
```

---

### Step 7 — `QykeyKeyboard.tsx`: prop wiring

**Edit:** `src/keyboard/qykey/QykeyKeyboard.tsx`

**7a.** Destructure the new handlers:

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

**7b.** Update the `<Touchpad />` props (remove `onMoveCursor`, add the new ones):

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

## 4. Build & Install

```bash
cd react-native-kickKey-deepseek

node scripts/build-keyboard-bundle.js
npx expo prebuild --platform android
npx expo run:android
```

> No new dependencies. All gesture APIs are Android framework (API 24+); the project's minSdk is 24.

---

## 5. Manual Test Script (M3 exit criteria)

**Setup:** a11y service enabled + button/shortcut assigned (M1); use the **floating panel** (or the IME strip) so the pointer has full-screen coverage.

| # | Step | Expected |
|---|---|---|
| 1 | Open the **launcher**, move the cursor over an app icon, press **L** (no drag) | The app opens (real tap injected) |
| 2 | Over a folder/app icon, press **R** | Long-press menu / uninstall / widget menu appears |
| 3 | In **Settings**, hover over a row, press **L** | Row opens |
| 4 | In a scrollable list (Settings / browser), hold the **scroll-down** caret | List scrolls (focused-node `ACTION_SCROLL` or swipe fallback); ~150ms repeat cap |
| 5 | Same for **scroll-up** | Scrolls back up |
| 6 | Press **Back** chevron | Previous screen (real `GLOBAL_ACTION_BACK`) — works in Settings, browser, launcher |
| 7 | **L-drag**: press and hold **L**, drag on the touchpad surface, release | A real drag stroke: slider knobs, notification shade, or list items move (down→move→up) |
| 8 | **Tap-to-click**: quick tap on the surface (no movement) | Left click at the cursor |
| 9 | **Strip mode**: in the IME keyboard, toggle the slider to touchpad | Keyboard shrinks to a ~90dp strip; pointer can reach the bottom of the screen |
| 10 | Toggle the slider back | Keyboard returns to full height |
| 11 | **Forward** chevron | No crash; subtle "Forward is not supported" hint appears (or scrolls forward if the focused list supports it) |
| 12 | **Fallback**: disable the a11y service, use the touchpad with a focused text field | Old behavior (DPAD caret / PAGE_UP-PAGE_DOWN / context menu) — no crash |
| 13 | `adb logcat | grep -E "KickKeyA11y|KickKeyPointer"` | No errors during the run |

**Pass = L/R/scroll/Back work in launcher, browser and Settings (§M3 exit criteria), plus strip mode, L-drag and tap-to-click.**

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Clicks do nothing in other apps | A11y service not enabled, or `canPerformGestures` missing from the config XML | Enable the service (M1); verify `android:canPerformGestures="true"` in `accessibility_service_config.xml` + prebuild |
| Clicks land on the keyboard instead of the app | IME window covers the target; strip mode not active | Use touchpad mode (strip shrinks the IME) or the floating panel |
| Scroll button scrolls nothing | Focused node has no scroll action and the swipe landed on a non-scrollable area | Point the cursor over the list before scrolling; check logcat for the node-action/swipe path |
| Back closes the panel instead of navigating | Cursor/tap over the panel rect, or panel stole the Back | Back is a global action (not a tap) — it navigates the app; if the panel is focused, tap outside it first |
| Forward never works | No a11y API for Forward (expected) | The hint is correct behavior; pro mode (M4) adds `KEYCODE_FORWARD` on Android ≤ 11 |
| L-drag doesn't drag | `dragEnd` fired without movement (below 24px) → became a tap | Drag further; verify `dragStart`/`dragEnd` reach native (logcat) |
| Gesture queue stalls (clicks stop responding) | A dispatched gesture never completed/cancelled | Rare framework issue; clear the queue by re-opening the panel or toggling the service |
| Strip mode doesn't shrink the keyboard | `setTouchpadMode` never called, or `updateSoftInputWindowLayout` no-oped | Verify the `useEffect([toggleMode])` in `useKeyboardState`; check `KickKeyIME` logcat "Touchpad strip mode" |

---

## 7. Explicitly Out of Scope for M3 (deferred)

| Milestone | Deferred work |
|---|---|
| M4 | Pro mode (`INJECT_EVENTS`: true hover, wheel scroll, Forward), notification entry point, settings UI (tap-to-click toggle etc.) |
| M5 | Watchdog for new surfaces, lazy pre-warm, node-recycle hardening on API < 33, Play declarations, privacy policy |

Also intentionally **not** in M3:
- Double-click / two-finger right-click (optional settings, later milestone).
- `HOME` / `RECENTS` global buttons (the service has the APIs; UI comes later).
- Drag **to** the touchpad from the L key without holding L (L-drag is the agreed interaction).

---

## 8. Definition of Done

- [ ] `KickKeyAccessibilityService.kt`: gesture queue + `tapAt` / `longPressAt` / `scrollAt` / `navigateBack` / `beginDrag`-`onDragDelta`-`endDrag` / `isPointInPanel`; queue cleared in `hideFloatingPanel`/`onUnbind`/`onDestroy`
- [ ] `KickKeyInputMethodService.kt`: companion `instance`, `setTouchpadStripMode`, `currentKeyboardHeightPx` used in the container `onMeasure` + layout params
- [ ] `KickKeyModule.kt`: `mouseClick`/`scrollPage`/`navigateHistory` service-first with `InputConnection` fallback; `navigateHistory` returns Boolean; new `setTouchpadMode`, `dragStart`, `dragEnd`; `pointerMove` feeds `onDragDelta`
- [ ] `modules/kickkey-module/index.ts`: `navigateHistory → Promise<boolean>`, new wrappers
- [ ] `Touchpad.tsx`: DPAD stepping removed, tap-to-click, L = dragStart/dragEnd, R = right-click, scroll repeat props, Forward hint
- [ ] `useKeyboardState.ts`: new handlers + repeat refs + `setTouchpadMode` effect + `tapToClick` pref
- [ ] `QykeyKeyboard.tsx`: Touchpad props updated
- [ ] §5 test script passes (L/R/scroll/Back in real apps, strip mode, L-drag, tap-to-click, fallback)
- [ ] Logcat clean of `KickKeyA11y` errors during the run

**On completion of all checks → M4 (pro mode + settings UI) is additive; M5 is compliance + polish.**
