# KickKey — M2 Implementation Guide
## RN Cursor Surface + Full-Screen Pointer Movement

> **Platform:** Android Only · **Project:** `react-native-kickKey-deepseek` · **Milestone:** M2 · **Status:** READY TO IMPLEMENT
> Follows the approved plan: [`KickKey-Accessibility-Touchpad-Plan.md`](./KickKey-Accessibility-Touchpad-Plan.md)
> Prerequisite: M1 (see [`KickKey-M1-Accessibility-Service-Implementation.md`](./KickKey-M1-Accessibility-Service-Implementation.md))

---

## 1. What M2 Delivers

| From plan §26 | M2 — RN cursor + movement |
|---|---|
| Scope | `KickKeyPointer` React surface, its overlay window, per-frame `pointerMove`, full-screen clamping, remove the old `ImageView` bitmap pointer |
| Exit criteria | Cursor **renders in React Native** and moves across the **whole screen** at 60Hz |

**In one sentence:** after this milestone the desktop-style pointer is a small React Native arrow rendered in its own overlay window; dragging on the touchpad moves it smoothly over the **entire screen** (no more "clamped above the keyboard", no more native `ImageView` bitmap). Clicks/scroll/back that act on other apps are **M3**.

What M2 does **not** do (deliberately): `dispatchGesture` clicks, `GLOBAL_ACTION_BACK`, scroll, IME strip mode, tap-to-click, or rewiring the L/R/scroll/back buttons — all M3+. The existing DPAD text-caret stepping in `Touchpad.tsx` also stays (still useful when a text field is focused).

---

## 2. Architecture Recap (what gets added / changed)

```
:ime_process
├─ PointerOverlay (NEW — Kotlin object)
│    ├─ show()   → picks window type by availability:
│    │             TYPE_ACCESSIBILITY_OVERLAY (a11y service enabled)
│    │             TYPE_APPLICATION_OVERLAY / TYPE_PHONE (overlay perm)
│    │             null → JS shows the permission banner
│    ├─         → lazily creates ReactSurface "KickKeyPointer" from the
│    │             keyboard ReactHost (kept alive for the process)
│    ├─         → adds the surface view to a 32dp NOT_TOUCHABLE window
│    ├─ move(dx,dy) → cursorX/Y += delta, clamped to the FULL screen,
│    │                WindowManager.updateViewLayout()
│    └─ hide()  → removes the window (surface stays alive)
├─ KickKeyModule (modified)
│    └─ pointerShow / pointerMove / pointerHide now delegate to
│       PointerOverlay instead of the ImageView bitmap
└─ keyboard.bundle (same Hermes bundle, third root)
     ├─ "KickKeyKeyboard" (existing — IME surface)
     ├─ "KickKeyOverlay"  (M1 — floating panel)
     └─ "KickKeyPointer"  (NEW — PointerRoot.tsx, static SVG arrow)
```

**Key decisions (from the plan, already approved):**
- The cursor is a **React Native** component (`PointerRoot.tsx`) — the `ImageView` bitmap + `createPointerBitmap()` are removed.
- **Native owns the position** (`cursorX`/`cursorY` on `PointerOverlay`); the RN arrow never re-renders while moving — movement is pure `updateViewLayout()` (plan §6.4).
- Window type priority: **a11y overlay first** (no `SYSTEM_ALERT_WINDOW` needed), **app overlay fallback** for the IME-only case, otherwise `show()` returns `false` → the existing permission banner in `Touchpad.tsx` appears (plan §6.2).
- Clamping is now the **whole screen** (`0..screenW`, `0..screenH`), not "above the keyboard" (plan §2.2).
- JS API (`pointerShow/pointerMove/pointerHide`, relative `(dx, dy)` deltas) is **unchanged** — `Touchpad.tsx` and `modules/kickkey-module/index.ts` keep their signatures; only a per-frame throttle is added in JS (plan §17).

---

## 3. Step-by-Step Implementation

### Step 1 — Create the RN cursor component

**New file:** `src/keyboard/pointer/PointerRoot.tsx`

A static arrow drawn with `react-native-svg` (already a dependency; the path is the same FA5 `mouse-pointer` glyph already used by `icons.tsx`). `pointerEvents="none"` + the window's `FLAG_NOT_TOUCHABLE` guarantee touches pass through to the app underneath.

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

### Step 2 — Register the pointer root in the keyboard bundle

**Edit:** `keyboard.index.js`

**2a.** Add the import (next to the other imports):

```js
import PointerRoot from './src/keyboard/pointer/PointerRoot';
```

**2b.** Register the third root at the bottom of the file:

```js
/**
 * Register the cursor component for the system-wide pointer.
 * The name 'KickKeyPointer' MUST match the second argument of
 * host.createSurface() in PointerOverlay.kt
 */
AppRegistry.registerComponent('KickKeyPointer', () => PointerRoot);
```

> Same `keyboard.bundle` — no build-script change. The module-scope mount pump keeps this surface's event loop alive too.

---

### Step 3 — Create the native cursor manager

**New file:** `native-files/java/com/kickkey/PointerOverlay.kt`

A Kotlin `object` (singleton) that owns the cursor window + position. **All methods must be called on the main thread** — `KickKeyModule` posts to it (Step 4), matching the old pointer code's threading.

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

### Step 4 — Re-point `KickKeyModule` to `PointerOverlay` (remove the bitmap pointer)

**Edit:** `native-files/java/com/kickkey/KickKeyModule.kt`

**4a.** Replace the whole old pointer block — from the comment line `// ── Touchpad: on-screen mouse pointer overlay ─...` (right after `mouseClick`) through the end of `pointerHide` (just before `@ReactMethod fun openOverlaySettings`) — with:

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

**4b.** Optional cleanup — the removed block was the only user of these imports; Kotlin treats unused imports as warnings (safe to leave), but removing them keeps the file clean:

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

(Check each one — `Build`/`Gravity` may still be used by other code in the file. `openOverlaySettings` stays untouched — the permission banner in `Touchpad.tsx` still uses it for the fallback flow.)

---

### Step 5 — Throttle `pointerMove` to one call per frame (JS)

**Edit:** `src/keyboard/qykey/Touchpad.tsx` — the plan's 60Hz requirement (§17): batch the per-move deltas and flush once per animation frame instead of once per touch event.

**5a.** Add two refs next to the existing accumulators:

```tsx
  const accX = useRef(0);
  const accY = useRef(0);
  const lastDx = useRef(0);
  const lastDy = useRef(0);
  // ── Per-frame pointer-move throttle (plan §17) ──
  const pendingDelta = useRef({ x: 0, y: 0 });
  const rafPending = useRef(false);
```

**5b.** Add a flush callback (after `showPointerAndCheck`):

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

**5c.** In `onPanResponderMove`, replace the direct pointer call:

```tsx
        // Move the on-screen desktop pointer (relative, trackpad-style)
        onPointerMoveRef.current?.(deltaX, deltaY);
```

with the batched version:

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

**5d.** Reset the throttle state in the three reset points (`onPanResponderGrant`, `onPanResponderRelease`, `onPanResponderTerminate`) — add these two lines wherever `accX.current = 0;` appears:

```tsx
        pendingDelta.current = { x: 0, y: 0 };
        rafPending.current = false;
```

> The DPAD text-caret stepping (`STEP_THRESHOLD` → `onMoveCursor`) is deliberately **unchanged** in M2 — it still moves the text caret in focused fields. M3 replaces it with real cross-app input.

---

### Step 6 — Update the bridge module doc comments (optional)

**Edit:** `modules/kickkey-module/index.ts` — the method **names and signatures are unchanged**, so nothing is required for M2 to work. Optionally refresh the stale comments:

```ts
  /** Shows the RN cursor over the whole screen. Resolves true when visible; false
   *  when neither the accessibility service nor "Display over other apps" is available. */
  pointerShow: (): Promise<boolean> => KickKey.pointerShow(),
```

(`pointerHide` / `pointerMove` comments can stay — their behavior is the same.)

---

## 4. Build & Install

```bash
cd react-native-kickKey-deepseek

# 1. Rebuild the keyboard bundle (now contains THREE roots)
node scripts/build-keyboard-bundle.js

# 2. Regenerate the android project (copies the new Kotlin file via withImeService)
npx expo prebuild --platform android

# 3. Verify the new file landed
ls android/app/src/main/java/com/kickkey/PointerOverlay.kt

# 4. Build & install
npx expo run:android
```

---

## 5. Manual Test Script (M2 exit criteria)

**Setup:** M1 must be done (a11y service enabled, button/shortcut assigned) **or** grant "Display over other apps" to KickKey in Settings.

| # | Step | Expected |
|---|---|---|
| 1 | Open any app, focus a text field → KickKey keyboard opens | — |
| 2 | Toggle the **slider** (top-left) → touchpad mode | **RN arrow cursor** appears at the screen **center** (not the old bitmap) |
| 3 | Drag on the touchpad surface | Cursor follows the finger's relative movement, smooth (~60Hz, no stutter) |
| 4 | Drag toward all four edges | Cursor reaches the **whole screen** — top, bottom (over the keyboard area), left, right — and stops at the edges (full-screen clamp) |
| 5 | Drag in another app **under** the keyboard (e.g., a browser list) | Cursor floats over the app content — it is NOT limited to above-the-keyboard space anymore |
| 6 | Toggle the slider back to keyboard / close the keyboard | Cursor disappears |
| 7 | (A11y path) Open the floating panel via the accessibility button (M1), toggle the slider to touchpad — **no input field focused** | Cursor appears and moves over the whole screen the same way |
| 8 | Permission check: with neither a11y service nor overlay permission available | `pointerShow` resolves false → the existing banner "Mouse pointer hidden — enable Display over other apps" shows on the touchpad |
| 9 | Regression: keyboard mode (slider off) | Typing, backspace, caret arrows all unchanged |

**Perf check (optional):** `adb logcat | grep -E "KickKeyPointer|KickKeyModule"` during a drag — `pointerMove` runs without exceptions; no dropped-frame warnings. (Deep profiling with `systrace` comes in M5.)

**Cleanliness check:** `grep -n "createPointerBitmap" native-files/java/com/kickkey/KickKeyModule.kt` → **no matches** (bitmap pointer fully removed).

**Pass = cursor renders in RN, reaches all four screen edges smoothly, disappears on toggle-off, works in both the IME and the a11y floating panel.**

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Cursor window appears (32dp) but is **blank/transparent** | Stale bundle without the `KickKeyPointer` root, or host never resumed | Check `adb logcat \| grep -E "KickKeyPointer"` for "host resumed" / "never signalled readiness". Rebuild the bundle (`node scripts/build-keyboard-bundle.js`) + reinstall |
| "Component KickKeyPointer not registered" in logcat | Bundle built before Step 2 | Rebuild bundle + reinstall |
| `pointerShow` always resolves false | Neither a11y service enabled nor overlay permission granted | Enable the service (M1) or grant "Display over other apps" |
| Cursor still clamped above the keyboard | Old APK / old code still running | Rebuild + reinstall; verify `PointerOverlay.kt` present (Step 4 §3) |
| Cursor lags behind the finger | More than one `pointerMove` per frame, or heavy JS frame | Verify Step 5 throttle is in place; check `logcat` for dropped frames |
| Cursor appears **under** the floating panel | Two a11y overlay windows of the same app; later-added is on top | Normal flow (open panel → toggle touchpad) adds the cursor after the panel → cursor on top. If it ever renders under, toggle the slider off/on. |
| Cursor vanishes when the app/IME process is killed | Process death kills the surface | Normal Android behavior — the cursor reappears on next `pointerShow` |
| First show takes ~1s to appear on a slow device | Surface view created lazily + host resume | Expected; the `attachWindow` retry loop (up to 1s) covers it. Subsequent shows are instant (surface kept alive) |

---

## 7. Explicitly Out of Scope for M2 (deferred)

| Milestone | Deferred work |
|---|---|
| M3 | `dispatchGesture` clicks (`tapAt`/`longPressAt` at `cursorX/cursorY`), swipe scroll, `GLOBAL_ACTION_BACK`, IME strip mode, rewiring the touchpad L/R/scroll/back buttons, replacing the DPAD caret stepping |
| M4 | Pro mode (`INJECT_EVENTS` hover/wheel/Forward) |
| M5 | Watchdog for the new surfaces, lazy pre-warm, battery-optimized cursor surface teardown, Play declarations |

Also intentionally **not** in M2:
- Tap-to-click (M3, with the button rewiring).
- Cursor above the IME strip in touchpad mode (strip mode itself is M3).
- Clicking/hovering other apps (M3).

---

## 8. Definition of Done

- [ ] `src/keyboard/pointer/PointerRoot.tsx` exists (static SVG arrow, `pointerEvents="none"`)
- [ ] `keyboard.index.js` registers `KickKeyPointer`
- [ ] `native-files/java/com/kickkey/PointerOverlay.kt` exists (show/move/hide, full-screen clamp, window-type priority)
- [ ] `KickKeyModule.kt`: old `ImageView` pointer block (fields + `createPointerBitmap` + 3 methods) replaced by `PointerOverlay` delegation; `grep createPointerBitmap` → no matches
- [ ] `Touchpad.tsx`: `pointerMove` flushed once per frame (`requestAnimationFrame` gate)
- [ ] Bundle rebuilt, app reinstalled, `PointerOverlay.kt` present in `android/` after prebuild
- [ ] §5 test script passes (RN cursor, whole-screen movement, hide on toggle-off, IME + a11y panel paths)
- [ ] Logcat clean of `KickKeyPointer` errors during the test run

**On completion of all checks → proceed to M3 (cross-app clicks / scroll / back via the accessibility service).**
