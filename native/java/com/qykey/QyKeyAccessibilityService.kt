package com.qykey

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.content.Intent
import android.graphics.Path
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import kotlin.math.ceil
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.FrameLayout
import com.facebook.react.ReactHost
import com.facebook.react.common.LifecycleState
import com.facebook.react.interfaces.TaskInterface
import com.facebook.react.interfaces.fabric.ReactSurface

/**
 * QyKey's accessibility service (M1).
 *
 * Entry points:
 *  - The user assigns QyKey to the Accessibility button / shortcut
 *    (flagRequestAccessibilityButton in accessibility_service_config.xml).
 *    Tapping it fires [onAccessibilityButtonClicked] and toggles the
 *    floating panel — no input field is required.
 *  - The touchpad JS can also open/close the panel via QyKeyModule
 *    (same :ime_process, so the singleton is reachable without IPC).
 *
 * The floating panel is a TYPE_ACCESSIBILITY_OVERLAY window hosting the
 * "QyKeyOverlay" React surface from the pre-warmed keyboard ReactHost
 * (same Hermes bundle as the IME keyboard).
 *
 * Security/design rules (plan §18): the service performs NO data
 * collection. It only reacts to explicit user actions and renders the
 * panel. It does not read window content, filter key events, or request
 * touch exploration. onAccessibilityEvent stays a required no-op.
 */
class QyKeyAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "QyKeyA11y"

        // Same keyboard height constant as the IME (KEYBOARD_HEIGHT_DP in QyKeyInputMethodService).
        private const val KEYBOARD_HEIGHT_DP = 250
        // Mirrors ROW_GAP_V_DP / KEYBOARD_CONTENT_EXTRA_DP in QyKeyInputMethodService:
        // the JS keyboard needs 6 rows × (keyHeight + 15dp gap) + 18dp padding.
        private const val ROW_GAP_V_DP = 15
        private const val KEYBOARD_CONTENT_EXTRA_DP = 18
        // Hard cap on the navigation-bar inset applied to the panel window —
        // a misreported value can never blow up the panel.
        private const val MAX_NAV_INSET_DP = 64
        // Mirrors the IME's auto-fit clamps (REPORTED_HEIGHT_MIN_DP/MAX_DP).
        private const val REPORTED_HEIGHT_MIN_DP = 250
        private const val REPORTED_HEIGHT_MAX_DP = 420

        // ── Gesture timing (M3) ──
        private const val TAP_DURATION_MS = 40L            // left-click tap (crisp 40ms down/up)
        private const val LONG_PRESS_DURATION_MS = 600L    // right-click proxy
        private const val SCROLL_SWIPE_DURATION_MS = 300L  // swipe fallback
        private const val SCROLL_SWIPE_DISTANCE_PX = 200   // swipe fallback length
        private const val DRAG_MIN_DISTANCE_PX = 24        // below this = tap, not drag
        private const val SCROLL_THROTTLE_MS = 150L        // repeat-scroll cap

        // Singleton so QyKeyModule (same :ime_process) reaches the service
        // without any IPC. @Volatile: written on the system binder thread
        // (onServiceConnected), read on the main thread.
        @Volatile
        var instance: QyKeyAccessibilityService? = null
            private set
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    private var panelSurface: ReactSurface? = null
    // Last natural JS content height (px) reported from the keyboard bundle,
    // mirrored from the IME report so a fresh panel opens at the right size.
    @Volatile
    private var reportedContentHeightPx: Int? = null
    internal var panelContainer: FrameLayout? = null
    private var panelSurfaceTask: TaskInterface<Void>? = null
    private var isPanelShowing = false

    /** Height in px for new panel windows.
     *
     * Mirrors the IME's auto-fit: uses the live IME container height when the
     * keyboard is showing (it may have auto-fit to a taller emoji mode),
     * otherwise the reported JS content height, else the 6-row formula.
     */
    private val keyboardHeightPx: Int
        get() {
            QyKeyInputMethodService.instance?.keyboardContainer?.let { container ->
                if (container.height > 0) return container.height
            }
            val prefs = getSharedPreferences("qykey_prefs", Context.MODE_PRIVATE)
            val keyHeight = prefs.getInt("keyHeight", 26)
            // FLAG_LAYOUT_IN_SCREEN lays this window out across the FULL screen
            // including behind the navigation bar, so the last key row hides
            // under it on every Android version. The window height and the JS
            // bottom padding both need the nav-bar inset (mirrors the IME).
            val navInsetDp = QyKeyModule.imeNavBarInsetDp.coerceIn(0, MAX_NAV_INSET_DP)
            val formulaDp = if (keyHeight > 0) {
                maxOf(KEYBOARD_HEIGHT_DP, 6 * (keyHeight + ROW_GAP_V_DP) + KEYBOARD_CONTENT_EXTRA_DP) + navInsetDp
            } else {
                KEYBOARD_HEIGHT_DP + navInsetDp
            }
            val reportedDp = reportedContentHeightPx
                ?.takeIf { it > 0 }
                ?.let { ceil(it / resources.displayMetrics.density).toInt() }
                ?.takeIf { it in REPORTED_HEIGHT_MIN_DP..REPORTED_HEIGHT_MAX_DP }
            // NOTE: the JS-reported height already includes the nav-bar inset
            // (it is measured from the keyboard's own content padding), while
            // formulaDp gets the inset added here — both paths count it once.
            val dp = maxOf(KEYBOARD_HEIGHT_DP, maxOf(formulaDp, reportedDp ?: formulaDp))
            return (dp * resources.displayMetrics.density).toInt()
        }

    /**
     * Bottom navigation-bar inset in dp measured from the system window
     * metrics. The panel window spans the full screen, so the system-wide
     * inset (not the panel window's own insets) is what it must clear.
     */
    private fun systemNavBarInsetDp(): Int {
        return try {
            val density = resources.displayMetrics.density
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                val wm = getSystemService(Context.WINDOW_SERVICE) as? WindowManager
                val insets = wm?.currentWindowMetrics?.windowInsets
                    ?.getInsetsIgnoringVisibility(android.view.WindowInsets.Type.navigationBars())
                if (insets != null && insets.bottom > 0) {
                    return ceil(insets.bottom / density).toInt().coerceIn(0, MAX_NAV_INSET_DP)
                }
            }
            val resId = resources.getIdentifier("navigation_bar_height", "dimen", "android")
            if (resId > 0) {
                ceil(resources.getDimensionPixelSize(resId) / density).toInt().coerceIn(0, MAX_NAV_INSET_DP)
            } else {
                0
            }
        } catch (e: Exception) {
            Log.w(TAG, "systemNavBarInsetDp failed: ${e.message}")
            0
        }
    }

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
        gestureQueue.clear()
        hideFloatingPanel()
        instance = null
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        gestureQueue.clear()
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

    /**
     * Live panel resize to the keyboard's auto-fit height (no-op if unchanged).
     * Thread-safe: stores the report immediately, hops to main for view work.
     * Uses WindowManager.updateViewLayout — for a window root, mutating
     * layoutParams alone doesn't reliably update the window's actual size.
     */
    fun onContentHeightReported(heightPx: Int) {
        reportedContentHeightPx = heightPx
        if (!isPanelShowing) return
        mainHandler.post {
            val container = panelContainer ?: return@post
            val target = keyboardHeightPx
            if (container.layoutParams?.height != target) {
                container.layoutParams = container.layoutParams?.apply { height = target }
                try {
                    (getSystemService(Context.WINDOW_SERVICE) as WindowManager)
                        .updateViewLayout(container, container.layoutParams)
                } catch (e: Exception) {
                    Log.w(TAG, "panel resize failed: ${e.message}")
                }
                container.requestLayout()
                Log.i(TAG, "Panel height -> ${target}px (${ceil(target / resources.displayMetrics.density).toInt()}dp)")
            }
        }
    }

    // ── Floating panel ─────────────────────────────────────────────────────

    fun isPanelVisible(): Boolean = isPanelShowing

    fun showFloatingPanel() {
        if (isPanelShowing) return
        val app = application as? QyKeyApplication ?: run {
            Log.e(TAG, "QyKeyApplication not found — cannot create panel")
            return
        }

        try {
            val host = app.keyboardReactHost

            // The panel window spans the full screen (FLAG_LAYOUT_IN_SCREEN),
            // so it ALWAYS extends behind the navigation bar — measure the
            // system inset directly. The IME's stored measurement may be 0
            // because its own window sits above the bar.
            val measuredInsetDp = systemNavBarInsetDp()
            if (measuredInsetDp != QyKeyModule.imeNavBarInsetDp) {
                QyKeyModule.imeNavBarInsetDp = measuredInsetDp
                Log.i(TAG, "Panel: nav bar inset -> ${measuredInsetDp}dp")
                // Push the new inset to the keyboard JS (base paddingBottom).
                try {
                    val ctx = (host.currentReactContext
                            as? com.facebook.react.bridge.ReactApplicationContext)
                        ?: QyKeyModule.keyboardReactContext
                    if (ctx != null) QyKeyModule.emitCurrentPreferences(ctx, this)
                } catch (e: Exception) {
                    Log.w(TAG, "Panel nav-inset emit failed: ${e.message}")
                }
            }

            // Second surface from the SAME host + bundle as the IME keyboard.
            // The name must match the AppRegistry registration in keyboard.index.js.
            val surface = host.createSurface(this, "QyKeyOverlay", null)
            panelSurfaceTask = surface.start()
            panelSurface = surface

            val container = FrameLayout(this).apply {
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    keyboardHeightPx
                )
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
                WindowManager.LayoutParams.MATCH_PARENT,
                keyboardHeightPx,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or      // never steal keyboard focus
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or // touches outside pass through
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            ).apply {
                // Position: bottom of the screen, full width (exact same position as IME keyboard)
                gravity = Gravity.BOTTOM
                x = 0
                y = 0
            }

            wm.addView(container, params)
            panelContainer = container
            isPanelShowing = true

            // Fabric needs the host RESUMED to apply mount items (the exact same
            // mechanism the IME watchdog uses). Poll until the JS signals
            // readiness (keyboardReady), then resume — idempotent if already up.
            resumeHostWhenReady(host, 0)
            Log.i(TAG, "Floating panel shown (MATCH_PARENT x ${keyboardHeightPx}px at bottom)")
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
        gestureQueue.clear()
        PointerOverlay.hide()
        Log.i(TAG, "Floating panel hidden")
    }

    /**
     * Polls (50ms × up to 600 ≈ 30s) for the keyboard JS mount signal, then
     * resumes the keyboard ReactHost so Fabric's DispatchUIFrameCallback starts
     * applying mount items to the panel surface. Mirrors the IME's
     * scheduleJsReadyResume() in QyKeyInputMethodService, simplified for M1.
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
            if (QyKeyModule.keyboardJsReady) {
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

    // ════════════════════════════════════════════════════════════════════════
    // M3 — Cross-app input injection (main-thread only; QyKeyModule posts)
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

    /** Double click: two quick taps at (x, y). */
    fun doubleTapAt(x: Float, y: Float) {
        if (isPointInPanel(x, y)) return
        val path = Path().apply {
            moveTo(x, y)
            lineTo(x, y + 1f)
        }
        val stroke1 = GestureDescription.StrokeDescription(path, 0, 45L)
        val stroke2 = GestureDescription.StrokeDescription(path, 95L, 45L)
        val gesture = GestureDescription.Builder()
            .addStroke(stroke1)
            .addStroke(stroke2)
            .build()
        dispatchGestureSafe(gesture)
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

    /** Fed from QyKeyModule.pointerMove while the L button is held. */
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
                Log.d(TAG, "Gesture completed")
                gestureInFlight = false
                pumpGestureQueue()
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                Log.w(TAG, "Gesture cancelled")
                gestureInFlight = false
                pumpGestureQueue()
            }
        }
        val dispatched = dispatchGesture(next, callback, mainHandler)
        if (!dispatched) {
            Log.w(TAG, "dispatchGesture returned false — resetting gestureInFlight")
            gestureInFlight = false
            pumpGestureQueue()
        }
    }

    /** Tap / long-press: a single-point stroke of [durationMs]. */
    private fun buildTapGesture(x: Float, y: Float, durationMs: Long): GestureDescription {
        val path = Path().apply {
            moveTo(x, y)
            lineTo(x + 1f, y + 1f)
        }
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
        if (!isPanelShowing) return false
        val container = panelContainer ?: return false
        // Measure the panel's REAL on-screen top edge. The old arithmetic guess
        // (screenHeight - height) assumed the panel is flush with the screen
        // bottom; when its actual position differs (window insets, taller
        // layout), taps just above the keyboard were wrongly treated as
        // "inside the panel" and silently dropped.
        if (container.isAttachedToWindow && container.height > 0) {
            val loc = IntArray(2)
            container.getLocationOnScreen(loc)
            return y >= loc[1]
        }
        // Fallback only when the container can't be measured.
        val screenHeight = resources.displayMetrics.heightPixels.toFloat()
        val h = keyboardHeightPx.toFloat()
        return y >= (screenHeight - h)
    }
}
