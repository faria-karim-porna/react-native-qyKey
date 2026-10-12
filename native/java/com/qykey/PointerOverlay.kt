package com.qykey

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Picture
import android.graphics.PixelFormat
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.graphics.drawable.PictureDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityManager
import com.caverock.androidsvg.SVG

/**
 * M2 — the system-wide on-screen mouse cursor and touch-through touchpad overlay.
 *
 * Cursor is drawn by a pure-native [CursorView] (Canvas-based) rendered as a modern
 * macOS / Windows 11 style sleek pointer with soft drop shadow and crisp outline.
 * Screen overlay is drawn by a pure-native [TouchpadOverlayView] (Canvas-based)
 * covering the entire screen except the keyboard area with 50% opacity red.
 * Movement is pure WindowManager.updateViewLayout() — no re-renders.
 *
 * Window type priority:
 *   1. TYPE_ACCESSIBILITY_OVERLAY — QyKeyAccessibilityService enabled (no
 *      SYSTEM_ALERT_WINDOW permission needed).
 *   2. TYPE_APPLICATION_OVERLAY (API 26+) or TYPE_PHONE — "Display over other
 *      apps" granted.
 *   3. Neither → show() returns false; JS shows the permission banner.
 *
 * All public methods are MAIN-THREAD ONLY. QyKeyModule posts to the main
 * looper before calling.
 */
object PointerOverlay {

    private const val TAG = "QyKeyPointer"

    /** Fallback cursor arrow size in dp when no cursorSize preference exists. */
    private const val CURSOR_SIZE_DP = 28
    /** Keyboard height in dp to calculate the overlay area excluding keyboard. */
    private const val KEYBOARD_HEIGHT_DP = 250

    private val mainHandler = Handler(Looper.getMainLooper())

    private var appContext: Context? = null
    private var cursorView: View? = null
    private var screenOverlayView: View? = null
    private var visible = false
    private var currentWindowType: Int? = null

    /** Screen coordinates of the cursor's hotspot (top-left of the window). */
    var cursorX = 0f
        private set
    var cursorY = 0f
        private set

    private val cursorSizePx: Int
        get() {
            val ctx = appContext ?: return (CURSOR_SIZE_DP * 3f).toInt()
            val prefs = ctx.getSharedPreferences("qykey_prefs", Context.MODE_PRIVATE)
            val sizeDp = prefs.getInt("cursorSize", CURSOR_SIZE_DP)
            return (sizeDp * ctx.resources.displayMetrics.density).toInt().coerceAtLeast(1)
        }

    /** Sanitized cursor asset name from prefs, mapped to assets/svg/<name>.svg. */
    private val cursorType: String
        get() {
            val ctx = appContext ?: return "cursor-pointer-classic"
            val prefs = ctx.getSharedPreferences("qykey_prefs", Context.MODE_PRIVATE)
            val raw = prefs.getString("cursorType", null) ?: return "cursor-pointer-classic"
            // Allow only [a-z0-9-] to keep the asset lookup safe.
            return raw.lowercase().replace(Regex("[^a-z0-9-]"), "").ifEmpty { "cursor-pointer-classic" }
        }

    /** Cursor tint color from prefs; null = use the asset's own colors. */
    private val cursorColor: Int?
        get() {
            val ctx = appContext ?: return null
            val prefs = ctx.getSharedPreferences("qykey_prefs", Context.MODE_PRIVATE)
            val hex = prefs.getString("cursorColor", null) ?: return null
            return try {
                Color.parseColor(hex)
            } catch (e: IllegalArgumentException) {
                null
            }
        }

    private val keyboardHeightPx: Int
        get() = (KEYBOARD_HEIGHT_DP * (appContext?.resources?.displayMetrics?.density ?: 3f)).toInt()

    private fun getWindowManager(type: Int? = currentWindowType): WindowManager? {
        if (type == WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY) {
            QyKeyAccessibilityService.instance?.let { a11y ->
                return a11y.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
            }
        }
        val ctx = appContext ?: return null
        return ctx.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
    }

    private fun getOverlayContext(type: Int): Context? {
        if (type == WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY) {
            val a11y = QyKeyAccessibilityService.instance
            if (a11y != null) return a11y
        }
        return appContext
    }

    /**
     * Retrieves the height (in pixels) of the system navigation bar / accessibility menu.
     */
    fun getNavBarHeight(): Int {
        val ctx = appContext ?: return 0
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
            val insets = wm?.currentWindowMetrics?.windowInsets?.getInsetsIgnoringVisibility(
                android.view.WindowInsets.Type.navigationBars()
            )
            if (insets != null && insets.bottom > 0) {
                return insets.bottom
            }
        }
        val resourceId = ctx.resources.getIdentifier("navigation_bar_height", "dimen", "android")
        if (resourceId > 0) {
            return ctx.resources.getDimensionPixelSize(resourceId)
        }
        return 0
    }

    /**
     * Retrieves the height (in pixels) of the system status bar (battery/network/notifications area).
     */
    fun getStatusBarHeight(): Int {
        val ctx = appContext ?: return 0
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
            val insets = wm?.currentWindowMetrics?.windowInsets?.getInsetsIgnoringVisibility(
                android.view.WindowInsets.Type.statusBars()
            )
            if (insets != null && insets.top > 0) {
                return insets.top
            }
        }
        val resourceId = ctx.resources.getIdentifier("status_bar_height", "dimen", "android")
        if (resourceId > 0) {
            return ctx.resources.getDimensionPixelSize(resourceId)
        }
        return 0
    }

    /**
     * Retrieves the current height (in pixels) of the active keyboard or floating panel.
     */
    fun getKeyboardHeight(): Int {
        QyKeyInputMethodService.instance?.let { ime ->
            val container = ime.keyboardContainer
            if (container != null && container.height > 0) {
                return container.height
            }
            if (ime.currentKeyboardHeightPx > 0) {
                return ime.currentKeyboardHeightPx
            }
        }
        QyKeyAccessibilityService.instance?.panelContainer?.let { container ->
            if (container.height > 0) return container.height
        }
        return keyboardHeightPx
    }

    /**
     * Y (in pixels) where the red overlay starts — the very top of the screen.
     * The overlay intentionally covers the status bar area as well.
     */
    fun getOverlayTopY(): Int = 0

    /**
     * Measured screen Y of the keyboard container's TOP edge, in raw window
     * coordinates. Returns null when the container isn't attached/measured yet.
     *
     * Raw `locationOnScreen` can briefly report 0 while a view is still being
     * laid out, so the value is only trusted once it is non-zero.
     */
    private fun getMeasuredKeyboardTopY(): Int? {
        val imeContainer = QyKeyInputMethodService.instance?.keyboardContainer
        if (imeContainer != null && imeContainer.isAttachedToWindow && imeContainer.width > 0) {
            val loc = IntArray(2)
            imeContainer.getLocationOnScreen(loc)
            if (loc[1] > 0) return loc[1]
        }
        val panelContainer = QyKeyAccessibilityService.instance?.panelContainer
        if (panelContainer != null && panelContainer.isAttachedToWindow && panelContainer.width > 0) {
            val loc = IntArray(2)
            panelContainer.getLocationOnScreen(loc)
            if (loc[1] > 0) return loc[1]
        }
        return null
    }

    /**
     * Calculates the height of the red overlay: from the top of the screen
     * (y=0) down to the measured TOP edge of the keyboard container, so the
     * overlay ends exactly where the keyboard begins and never overlaps it.
     *
     * Falls back to the geometric estimate (screenH - navH - kbH) only when no
     * container is available to measure (e.g. keyboard not yet laid out).
     */
    fun getKeyboardTopY(): Int {
        getMeasuredKeyboardTopY()?.let { return it.coerceAtLeast(0) }

        val screenH = screenHeightPx()
        val navH = getNavBarHeight()
        val kbH = getKeyboardHeight()

        val calculated = screenH - navH - kbH
        return calculated.coerceAtLeast(0)
    }

    private fun screenWidthPx(): Int {
        val ctx = appContext ?: return 1080
        val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            wm?.currentWindowMetrics?.bounds?.width()
                ?: ctx.resources.displayMetrics.widthPixels
        } else {
            val dm = android.util.DisplayMetrics()
            @Suppress("DEPRECATION")
            wm?.defaultDisplay?.getRealMetrics(dm)
            if (dm.widthPixels > 0) dm.widthPixels else ctx.resources.displayMetrics.widthPixels
        }
    }

    private fun screenHeightPx(): Int {
        val ctx = appContext ?: return 1920
        val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            wm?.currentWindowMetrics?.bounds?.height()
                ?: ctx.resources.displayMetrics.heightPixels
        } else {
            val dm = android.util.DisplayMetrics()
            @Suppress("DEPRECATION")
            wm?.defaultDisplay?.getRealMetrics(dm)
            if (dm.heightPixels > 0) dm.heightPixels else ctx.resources.displayMetrics.heightPixels
        }
    }

    // ── Window type resolution ─────────────────────────────────────────────

    private fun resolveWindowType(ctx: Context): Int? {
        if (QyKeyAccessibilityService.instance != null)
            return WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
        return when {
            Settings.canDrawOverlays(ctx) -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
            else -> null
        }
    }

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Shows the cursor overlay and touch-through red screen overlay. Returns false when no overlay channel is
     * available (JS then shows the permission banner). Main thread only.
     */
    fun show(context: Context): Boolean {
        appContext = context.applicationContext
        val type = resolveWindowType(context) ?: return false
        if (visible && cursorView != null && screenOverlayView != null) return true
        attachWindow(type)
        return true
    }

    /**
     * Moves the cursor by a relative (dx, dy) delta, clamped to the screen and above keyboard.
     * Main thread only.
     */
    fun move(dx: Float, dy: Float) {
        val view = cursorView ?: return
        val wm = getWindowManager() ?: return
        try {
            val size = cursorSizePx
            val overlayH = getKeyboardTopY()
            val maxCursorY = if (overlayH > size) (overlayH - size).toFloat() else (screenHeightPx() - size).coerceAtLeast(0).toFloat()
            cursorX = (cursorX + dx).coerceIn(0f, (screenWidthPx() - size).coerceAtLeast(0).toFloat())
            cursorY = (cursorY + dy).coerceIn(0f, maxCursorY)
            val params = view.layoutParams as WindowManager.LayoutParams
            params.x = cursorX.toInt()
            params.y = cursorY.toInt()
            wm.updateViewLayout(view, params)
        } catch (e: Exception) {
            Log.w(TAG, "move failed: ${e.message}")
        }
    }

    /** Hides the cursor window and screen overlay. Main thread only. */
    fun hide() {
        if (!visible && cursorView == null && screenOverlayView == null) return
        visible = false
        val wm = getWindowManager()
        try {
            screenOverlayView?.let { v -> wm?.removeView(v) }
        } catch (e: Exception) {
            Log.w(TAG, "hide screenOverlayView failed: ${e.message}")
        }
        screenOverlayView = null
        try {
            cursorView?.let { v -> wm?.removeView(v) }
        } catch (e: Exception) {
            Log.w(TAG, "hide cursorView failed: ${e.message}")
        }
        cursorView = null
        currentWindowType = null
        Log.i(TAG, "Cursor and overlay hidden")
    }

    fun isVisible(): Boolean = visible

    /**
     * Re-reads cursor prefs and re-attaches the cursor window so a preference
     * change (type/color/size) is reflected immediately. Main thread only.
     * Safe to call when the overlay is not visible (no-op).
     */
    fun refreshCursor() {
        if (!visible || cursorView == null) return
        val type = resolveWindowType(appContext ?: return) ?: return
        val wm = getWindowManager(type) ?: return
        val savedX = cursorX
        val savedY = cursorY
        try {
            cursorView?.let { wm.removeView(it) }
        } catch (e: Exception) {
            Log.w(TAG, "refreshCursor removeView failed: ${e.message}")
        }
        cursorView = null
        attachCursorOnly(type, wm, savedX, savedY)
    }

    /**
     * Attaches only the cursor window (not the red overlay), preserving the
     * given position. Used by [refreshCursor] for live preference updates.
     */
    private fun attachCursorOnly(type: Int, wm: WindowManager, x: Float, y: Float) {
        val targetContext = getOverlayContext(type) ?: return
        try {
            val size = cursorSizePx
            val view = CursorView(targetContext)
            val params = WindowManager.LayoutParams(
                size, size,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                this.x = x.toInt()
                this.y = y.toInt()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                }
            }
            wm.addView(view, params)
            cursorView = view
            cursorX = x
            cursorY = y
            Log.i(TAG, "Cursor refreshed (${cursorType}, size=${size}px, color=${cursorColor})")
        } catch (e: Throwable) {
            Log.e(TAG, "attachCursorOnly failed", e)
            cursorView = null
        }
    }

    /**
     * Re-measures the keyboard top and updates the overlay height.
     */
    fun updateOverlayBounds() {
        if (!visible) return
        val redOverlay = screenOverlayView ?: return
        val wm = getWindowManager() ?: return
        val overlayH = getKeyboardTopY()
        if (overlayH <= 0) return
        val overlayTopY = getOverlayTopY()
        try {
            val params = redOverlay.layoutParams as? WindowManager.LayoutParams ?: return
            if (params.height != overlayH || params.y != overlayTopY) {
                params.height = overlayH
                params.y = overlayTopY
                wm.updateViewLayout(redOverlay, params)
                Log.i(TAG, "Updated overlay bounds: y=${overlayTopY}px, height=${overlayH}px")
            }
        } catch (e: Exception) {
            Log.w(TAG, "updateOverlayBounds failed: ${e.message}")
        }
    }

    // ── Internals ─────────────────────────────────────────────────────────

    private fun attachWindow(type: Int) {
        val targetContext = getOverlayContext(type) ?: return
        val wm = getWindowManager(type) ?: return
        try {
            currentWindowType = type
            val size = cursorSizePx
            val screenW = screenWidthPx()
            val overlayH = getKeyboardTopY()

            // Centre on first show; preserve position on subsequent shows.
            if (cursorX == 0f && cursorY == 0f) {
                cursorX = (screenW - size) / 2f
                cursorY = if (overlayH > size) (overlayH - size) / 2f else 0f
            } else {
                val maxCursorY = if (overlayH > size) (overlayH - size).toFloat() else 0f
                cursorY = cursorY.coerceIn(0f, maxCursorY)
            }

            // Clean up existing views if any
            try {
                screenOverlayView?.let { v -> wm.removeView(v) }
            } catch (e: Exception) {}
            screenOverlayView = null

            try {
                cursorView?.let { v -> wm.removeView(v) }
            } catch (e: Exception) {}
            cursorView = null

            // 1. Red translucent touch-through screen overlay (covers screen from the very top of the device down to the keyboard)
            val overlayTopY = getOverlayTopY()
            val redOverlay = TouchpadOverlayView(targetContext)
            val overlayParams = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                if (overlayH > 0) overlayH else WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                x = 0
                y = overlayTopY  // 0 = very top of the device
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                }
            }
            wm.addView(redOverlay, overlayParams)
            screenOverlayView = redOverlay

            // 2. Cursor View — renders the user's chosen SVG cursor asset
            //    (assets/svg/<cursorType>.svg) tinted with cursorColor at cursorSize.
            val view = CursorView(targetContext)
            val params = WindowManager.LayoutParams(
                size, size,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                x = cursorX.toInt()
                y = cursorY.toInt()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                }
            }

            wm.addView(view, params)
            cursorView = view
            visible = true
            Log.i(TAG, "Cursor & screen overlay attached (type=$type, overlayTopY=${overlayTopY}px, overlayH=${overlayH}px, cursor=${size}px at $cursorX,$cursorY)")

            // Follow-up checks to make sure height is accurately snapped to keyboard as IME finishes animating
            val delays = longArrayOf(50L, 150L, 300L, 500L, 800L)
            for (d in delays) {
                mainHandler.postDelayed({ updateOverlayBounds() }, d)
            }
        } catch (e: Throwable) {
            Log.e(TAG, "attachWindow failed", e)
            visible = false
            cursorView = null
            screenOverlayView = null
            currentWindowType = null
        }
    }

    // ── Native touch-through red overlay drawing ───────────────────────────

    private class TouchpadOverlayView(ctx: Context) : View(ctx) {
        private val paint = Paint().apply {
            color = Color.argb(128, 255, 0, 0) // 50% opacity red (#80FF0000)
            style = Paint.Style.FILL
        }

        init {
            setWillNotDraw(false)
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        }
    }

    // ── Native cursor drawing (SVG asset from assets/svg) ─────────────────

    /**
     * Draws the user-selected cursor SVG (cursorType pref) scaled to the
     * cursorSize pref and tinted with the cursorColor pref (when set).
     *
     * The SVG is parsed with androidsvg and rasterized once into a Picture →
     * PictureDrawable at the exact window size, so onDraw is a single
     * drawable.draw() — cheap enough for 60fps WindowManager moves.
     *
     * The arrow tip stays at the View's top-left corner (0,0) — the hotspot
     * used by the click/scroll methods via [cursorX]/[cursorY]. Assets whose
     * tip is not at the top-left are drawn as-is (the picker preview matches
     * the on-screen result, which is the behavior users expect).
     */
    private class CursorView(ctx: Context) : View(ctx) {

        private var drawable: PictureDrawable? = null
        private var fallbackPath: Path? = null

        private val fallbackFill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            style = Paint.Style.FILL
        }
        private val fallbackStroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(235, 18, 18, 30)
            style = Paint.Style.STROKE
            strokeWidth = 2.4f
            strokeJoin = Paint.Join.ROUND
            strokeCap = Paint.Cap.ROUND
        }

        init {
            setWillNotDraw(false)
        }
        // (single set of fallback fields; see below)

        private fun buildDrawable(w: Int, h: Int) {
            val type = cursorType
            val tint = cursorColor

            // 1. Load + parse the SVG from assets.
            val svg: SVG? = try {
                context.assets.open("svg/$type.svg").use { SVG.getFromInputStream(it) }
            } catch (e: Exception) {
                Log.w(TAG, "cursor svg '$type' not found (${e.message}); using fallback arrow")
                null
            }

            if (svg == null) {
                drawable = null
                fallbackPath = buildFallbackArrow(w.toFloat(), h.toFloat())
                return
            }
            fallbackPath = null

            // 2. Rasterize into a Picture at the final size, preserving the
            //    asset's aspect ratio inside the square window.
            val docW = svg.documentWidth
            val docH = svg.documentHeight
            var dstW = w.toFloat()
            var dstH = h.toFloat()
            if (docW > 0f && docH > 0f) {
                val scale = minOf(w / docW, h / docH)
                dstW = docW * scale
                dstH = docH * scale
            }
            svg.setDocumentWidth(dstW)
            svg.setDocumentHeight(dstH)

            try {
                if (tint != null) {
                    // Tint: render the SVG, then blend the user color over it
                    // with SRC_IN (keeps the alpha shape, replaces the color) —
                    // the same approach react-native-svg's `color` prop uses.
                    val tintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                        color = tint
                        xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
                    }
                    val bitmap = Bitmap.createBitmap(dstW.toInt().coerceAtLeast(1), dstH.toInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)
                    svg.renderToCanvas(canvas)
                    canvas.drawRect(0f, 0f, dstW, dstH, tintPaint)

                    drawable = PictureDrawable(Picture().apply {
                        beginRecording(bitmap.width, bitmap.height).drawBitmap(bitmap, 0f, 0f, null)
                        endRecording()
                    })
                    bitmap.recycle()
                } else {
                    drawable = PictureDrawable(
                        svg.renderToPicture(dstW.toInt().coerceAtLeast(1), dstH.toInt().coerceAtLeast(1))
                    )
                }
            } catch (e: Exception) {
                Log.w(TAG, "cursor svg '$type' render failed: ${e.message}")
                drawable = null
                fallbackPath = buildFallbackArrow(w.toFloat(), h.toFloat())
            }
        }

        /** Minimal arrow used when the SVG asset is missing/corrupt. */
        private fun buildFallbackArrow(w: Float, h: Float): Path {
            val pts = arrayOf(
                floatArrayOf(0f, 0f),
                floatArrayOf(0f, 21f),
                floatArrayOf(5.5f, 16.5f),
                floatArrayOf(10.5f, 26.5f),
                floatArrayOf(14.2f, 24.6f),
                floatArrayOf(9.2f, 14.8f),
                floatArrayOf(17.8f, 14.8f),
                floatArrayOf(0f, 0f)
            )
            val scaleX = w / 24f
            val scaleY = h / 30f
            val p = Path()
            p.moveTo(pts[0][0] * scaleX, pts[0][1] * scaleY)
            for (i in 1 until pts.size) {
                p.lineTo(pts[i][0] * scaleX, pts[i][1] * scaleY)
            }
            p.close()
            return p
        }

        override fun onSizeChanged(w: Int, h: Int, oldW: Int, oldH: Int) {
            super.onSizeChanged(w, h, oldW, oldH)
            buildDrawable(w, h)
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val d = drawable
            if (d != null) {
                d.setBounds(0, 0, d.intrinsicWidth, d.intrinsicHeight)
                d.draw(canvas)
            } else {
                fallbackPath?.let {
                    canvas.drawPath(it, fallbackFill)
                    canvas.drawPath(it, fallbackStroke)
                }
            }
        }
    }
}
