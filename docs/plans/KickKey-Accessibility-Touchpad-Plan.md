# KickKey — Accessibility Menu & System-Wide Touchpad
## Feasibility Analysis & Implementation Plan

> **Platform:** Android Only · **Stack:** React Native + Expo + Kotlin · **Languages:** English & Bangla · **Project:** `react-native-kickKey-deepseek` · **Status:** PLAN — awaiting approval

---

## Table of Contents

1. [Executive Summary & Feasibility Verdict](#1-executive-summary--feasibility-verdict)
2. [Current State Analysis](#2-current-state-analysis)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Accessibility Menu Integration](#4-accessibility-menu-integration)
5. [Touchpad Architecture](#5-touchpad-architecture)
6. [Pointer / Cursor Implementation](#6-pointer--cursor-implementation)
7. [Kotlin Native Implementation](#7-kotlin-native-implementation)
8. [React Native Implementation](#8-react-native-implementation)
9. [React Native ↔ Kotlin Communication](#9-react-native--kotlin-communication)
10. [Mouse-Like Input Simulation](#10-mouse-like-input-simulation)
11. [Click Handling](#11-click-handling)
12. [Scrolling](#12-scrolling)
13. [Back / Forward Actions](#13-back--forward-actions)
14. [Permissions](#14-permissions)
15. [Accessibility Service Design](#15-accessibility-service-design)
16. [State Management](#16-state-management)
17. [Performance Considerations](#17-performance-considerations)
18. [Security & Privacy](#18-security--privacy)
19. [Android Compatibility](#19-android-compatibility)
20. [Expo / Custom Development Build Requirements](#20-expo--custom-development-build-requirements)
21. [Testing Strategy](#21-testing-strategy)
22. [Build & Deployment](#22-build--deployment)
23. [Google Play Store Considerations](#23-google-play-store-considerations)
24. [Potential Limitations & Risks](#24-potential-limitations--risks)
25. [Recommended Folder Structure](#25-recommended-folder-structure)
26. [Development Milestones](#26-development-milestones)
27. [Decisions Required Before Implementation](#27-decisions-required-before-implementation)

---

## 1. Executive Summary & Feasibility Verdict

**Short answer: Yes — every requirement is achievable, with two important platform caveats that shape the whole design.**

KickKey is already a hybrid app: a React Native keyboard UI running inside a Kotlin `InputMethodService` in a dedicated `:ime_process`, communicating through the `KickKeyModule` native bridge. Both new features build directly on that foundation:

| Requirement | Verdict | Mechanism |
|---|---|---|
| Keyboard in the **Accessibility Menu** | ⚠️ Partially — see note | The system Accessibility Menu cannot be extended by third-party apps. The supported equivalent is the **Accessibility button / shortcut** assigned to KickKey's own accessibility service. |
| Open keyboard **without an input field** | ✅ | An enabled `AccessibilityService` can show a floating overlay window (`TYPE_ACCESSIBILITY_OVERLAY`) hosting the RN keyboard — no focused field required. |
| System-wide pointer / cursor | ✅ (custom-drawn) | A small RN "cursor surface" in a transparent overlay window, positioned via `WindowManager.updateViewLayout()`. |
| Pointer across **other apps** | ✅ | The overlay window has no bounds; the cursor can be placed anywhere on the screen. |
| Clicking other apps | ✅ | `AccessibilityService.dispatchGesture()` injects real touch gestures system-wide (API 24+). |
| Scrolling other apps | ✅ (swipe-based) | `dispatchGesture()` vertical swipes, or `ACTION_SCROLL_FORWARD/BACKWARD` on the focused node. |
| **Back** button | ✅ | `performGlobalAction(GLOBAL_ACTION_BACK)`. |
| **Forward** button | ⚠️ Limited | No `GLOBAL_ACTION_FORWARD` exists and a11y cannot inject keys. Works only via the ADB "pro mode" (`INJECT_EVENTS`) or by tapping in-app toolbar buttons. |
| True mouse **hover** (link highlights, etc.) | ⚠️ Not via public APIs | Requires `INJECT_EVENTS` (signature permission, blocked on Android 12+, grantable via ADB on Android ≤ 11 / root). See §10 "Pro mode". |
| Mouse-wheel scroll | ⚠️ Not via public APIs | Same `INJECT_EVENTS` limitation; swipe-based scroll is the Play-safe path. |
| React Native UI for touchpad + cursor | ✅ | Touchpad UI already exists (`Touchpad.tsx`); the cursor will become a new RN surface. |
| Kotlin for the system-level work | ✅ | New `KickKeyAccessibilityService` + gesture injection in Kotlin. |
| Expo Custom Modules sufficient | ✅ | Config-plugin + copied Kotlin files pattern (already used for the IME) extends cleanly. |

### 1.1 Answers to the ten feasibility questions

1. **Can a keyboard be added to the Android Accessibility Menu?** — The **system** Accessibility Menu (Settings → Accessibility → Accessibility Menu) shows only system actions (Back, Home, Recents, Screenshot…) and accessibility-feature shortcuts. **Third-party apps cannot add entries to it.** Some OEM menus (e.g. Samsung's "Assistant menu") allow custom app shortcuts, but stock Android does not. The correct, fully supported integration is: KickKey registers an `AccessibilityService`; the user assigns it to the **Accessibility button** (on-screen or nav-bar) or the **Accessibility shortcut** (Volume+Power / three-finger gesture); tapping it fires `onAccessibilityButtonClicked()` and opens KickKey's panel — one tap, no input field. **Verdict: possible via the accessibility button/shortcut route (user-approved); not possible as a literal entry inside the system menu.**

2. **Can the keyboard open without an input field?** — Yes. An `InputMethodService` can only show when a field is focused, but an **accessibility-service overlay window does not need one**. The floating keyboard/touchpad panel is a `TYPE_ACCESSIBILITY_OVERLAY` window hosting the same RN keyboard bundle.

3. **Can an app create and control a system-wide pointer?** — Yes, with the caveat that it is **our own drawn pointer**, not the OS cursor. The OS cursor is only rendered for physical input devices; there is no public API to create a system cursor or inject `HOVER_MOVE` events. Our RN cursor is an overlay window positioned anywhere on screen.

4. **Can an Accessibility Service emulate mouse-like actions?** — Yes, for **touch-equivalent** actions: taps (left click), long-presses (right-click approximation), swipes (scrolling, dragging). `dispatchGesture()` injects into whatever window is under the coordinates, so it works across all apps. It cannot produce hover or wheel events.

5. **Can the pointer move across other applications?** — Yes. The overlay window is positioned in screen coordinates (`WindowManager.LayoutParams.x/y`) with `gravity = TOP|START`; there is no restriction to "our app". Clicks/swipes dispatched at the cursor's position affect the app underneath.

6. **What permissions are required?** — `BIND_ACCESSIBILITY_SERVICE` (service declaration), `SYSTEM_ALERT_WINDOW` (fallback path only), `VIBRATE` (existing). `INJECT_EVENTS` (signature permission) only for the optional ADB pro mode. On Android 13+ `POST_NOTIFICATIONS` if we add a notification entry point.

7. **Is an Accessibility Service required, or another API?** — Required. There is **no alternative public API** for system-wide input injection or global actions. `InputManager.injectInputEvent()` needs `INJECT_EVENTS` (signature/privileged; blocked on Android 12+ for targetSdk 31+). The Accessibility Service is the only Play-store-legal injection channel.

8. **Are Expo Custom Modules sufficient?** — Yes. The existing architecture (config plugin `withImeService.js` copying Kotlin + manifest edits + `KickKeyModule` bridge) extends to an accessibility service: a new plugin declares the service + config XML; new Kotlin classes are copied the same way; new `@ReactMethod`s expose the APIs to JS.

9. **Version-specific limitations** — See §19. Key ones: `dispatchGesture` needs API 24+ (KickKey's RN 0.86 minSdk is 24 — fine); `injectInputEvent` blocked for targetSdk 31+ (Android 12+); Android 13 "Restricted settings" adds friction for sideloaded a11y services; Android 14+ requires declaring a11y usage rationale in the Play Console.

10. **Security / privacy / Play policy** — Accessibility is a sensitive permission. Play requires a policy declaration, `android:isAccessibilityTool` decision, and a clear user-facing rationale. No data leaves the device; the service only performs gestures the user explicitly triggers. See §18 and §23.

---

## 2. Current State Analysis

### 2.1 What already exists (verified in `react-native-kickKey-deepseek`)

- **Two processes**: the main app process (Expo Router UI) and `:ime_process` (declared on `KickKeyInputMethodService` in `withImeService.js`).
- **Keyboard ReactHost**: `KickKeyApplication.initKeyboardRuntime()` builds a second `ReactHost` loading `assets://keyboard.bundle` (Hermes), pre-warmed in the IME process. `KickKeyInputMethodService` creates a `ReactSurface` named `KickKeyKeyboard` (from `keyboard.index.js`) inside a `FrameLayout`.
- **Touchpad toggle** (already implemented in JS):
  - `useKeyboardState.ts` holds `toggleMode` (default `false`).
  - `QykeyKeyboard.tsx` renders `KeyboardSlider`; when `toggleMode === true` the main key area is replaced by `<Touchpad />` (inside `styles.touchpadArea`).
  - `Touchpad.tsx` provides the drag surface, local visual cursor dot, **L / R** buttons, **scroll up/down** carets, **back/forward** chevrons, and a permission banner.
- **Native touchpad backend** (current, `KickKeyModule.kt`): DPAD `moveCursor`, `PAGE_UP/PAGE_DOWN` `scrollPage`, `ALT+DPAD` `navigateHistory`, `DPAD_CENTER/KEYCODE_MENU` `mouseClick` — all via `InputConnection`, i.e. they only affect the **focused text field**, not other apps.
- **Native pointer** (current): a 28dp `ImageView` bitmap arrow in a `TYPE_APPLICATION_OVERLAY` window (`pointerShow/pointerMove/pointerHide`), requires `SYSTEM_ALERT_WINDOW`, clamped above the keyboard, **not clickable** (its taps are not dispatched anywhere — there is no system-wide click).

### 2.2 What must change

| Piece | Current | Target |
|---|---|---|
| Cursor | Native `ImageView` bitmap | **RN component** in its own overlay "cursor surface" |
| Pointer position | Clamped to app area above keyboard | **Anywhere on screen** |
| Click / scroll / back / forward | `InputConnection` key events (text field only) | **`dispatchGesture` + `GLOBAL_ACTION_BACK` via Accessibility Service** (all apps) |
| Entry without input field | Not possible | **A11y button/shortcut + in-app button → floating keyboard overlay** |
| Optional "pro mode" | — | `INJECT_EVENTS` via ADB for true hover / wheel / Forward (Android ≤ 11) |

---

## 3. Proposed Architecture

```
┌──────────────────────────────  :ime_process  ──────────────────────────────┐
│                                                                            │
│  KickKeyApplication (keyboard ReactHost, pre-warmed)                       │
│   ├─ ReactSurface "KickKeyKeyboard"  ← IME input view (existing)          │
│   ├─ ReactSurface "KickKeyPointer"   ← NEW: RN cursor overlay window       │
│   └─ ReactSurface "KickKeyOverlay"   ← NEW: floating keyboard/touchpad     │
│                                        panel (opened from a11y shortcut)   │
│                                                                            │
│  KickKeyInputMethodService (IME, existing)                                │
│  KickKeyAccessibilityService (NEW, same process — no IPC needed)          │
│   ├─ dispatchGesture()        → taps / long-press / swipes (any app)       │
│   ├─ performGlobalAction()    → BACK (HOME, RECENTS, ...)                  │
│   ├─ TYPE_ACCESSIBILITY_OVERLAY windows → cursor + floating panel          │
│   └─ onAccessibilityButtonClicked() → open floating panel                 │
│                                                                            │
│  KickKeyModule (bridge, existing) — re-pointed touchpad methods to the     │
│   accessibility service singleton:                                         │
│   pointerShow/Move/Hide, clickAtCursor, scrollAtCursor, navBack/Forward,   │
│   isA11yEnabled, openA11ySettings, pro-mode INJECT_EVENTS wrapper          │
└────────────────────────────────────────────────────────────────────────────┘
```

**Why the Accessibility Service lives in `:ime_process` (recommended):**
- The keyboard ReactHost is already pre-warmed there; the floating panel, the cursor surface and the IME all render from the **same** JS bundle and host.
- The touchpad JS → `KickKeyModule` → service calls are **same-process** (no AIDL, no serialization, no latency).

**Alternative (documented, not recommended):** service in the main process + a bound-service/AIDL bridge from `:ime_process`. More moving parts, adds IPC latency to every pointer move, and splits the React surfaces across processes. We fall back to this only if device testing shows OEMs mishandling an a11y service in a secondary process (a known-rare edge; see §24).

### 3.1 Data flow — touchpad drag → pointer on screen

```
Finger drag on RN Touchpad surface (Touchpad.tsx PanResponder)
   → onPointerMove(dx, dy)                    [per frame, throttled]
   → KickKeyModule.pointerMove(dx, dy)        [JS → Kotlin, one call/frame]
   → Kotlin: cursorX += dx; cursorY += dy     [clamped to screen]
   → WindowManager.updateViewLayout(cursor window)
   → (optional pro mode) inject HOVER_MOVE MotionEvent
```

### 3.2 Data flow — click / scroll / back

```
L button (or tap-to-click) in Touchpad.tsx
   → onMouseClick('left') → KickKeyModule.mouseClick('left')
   → KickKeyAccessibilityService.dispatchGesture(
        tap at (cursorX, cursorY), duration ~60ms)
   → the app under the cursor receives a real touch
```

```
Scroll Up/Down button (held → repeat)
   → onScrollPage('up') → KickKeyModule.scrollPage('up')
   → performAction(ACTION_SCROLL_BACKWARD) on focused node,
     fallback: dispatchGesture vertical swipe at cursor position
```

```
Back chevron → onNavigateHistory('backward')
   → KickKeyModule.navigateBack() → performGlobalAction(GLOBAL_ACTION_BACK)
Forward chevron → a11y path: no-op w/ hint; pro mode: KEYCODE_FORWARD injection
```

---

## 4. Accessibility Menu Integration

### 4.1 What "Accessibility Menu" means on Android (verified)

The system **Accessibility Menu** is a Google-owned overlay (Settings → Accessibility → Accessibility Menu) whose contents are fixed: system actions (Back, Home, Recents, Notifications, Quick Settings, Screenshot, Volume…) plus shortcuts the user assigns to accessibility *features*. **There is no API for a third-party app to inject an entry into this menu.**

### 4.2 KickKey's supported equivalent (approved by user)

1. **Accessibility button** — the service declares `flagRequestAccessibilityButton`; the user enables the on-screen/nav-bar accessibility button, or assigns KickKey to the **shortcut** (Volume+Power hold, or three-finger gesture). When triggered, `onAccessibilityButtonClicked()` opens the floating KickKey panel.
2. **In-app entry** — a "Enable KickKey accessibility" button in the settings screen (`Settings.ACTION_ACCESSIBILITY_SETTINGS` deep link) plus, once enabled, an optional notification action "Open KickKey panel".
3. **On open** — the service shows a `TYPE_ACCESSIBILITY_OVERLAY` window hosting ReactSurface `KickKeyOverlay` (the same `QykeyKeyboard` bundle, keyboard mode by default, touchpad mode via the existing slider). No input field is focused or required.

### 4.3 What the user sees

```
Settings → Accessibility → (Accessibility button | Shortcut) → KickKey
   → tap the button/shortcut anywhere, any time
   → floating KickKey panel appears (keyboard ⇄ touchpad slider included)
   → use the touchpad: cursor moves over the whole screen, L/R click,
     scroll, back — all affecting the app underneath
   → tap outside / hide button → panel closes
```

---

## 5. Touchpad Architecture

- **Location:** the existing `Touchpad.tsx` stays the single touchpad UI, rendered either (a) inside the IME keyboard when `toggleMode` is on, or (b) inside the floating panel when opened from the a11y button.
- **Behavior upgrade:** the DPAD-caret stepping (`STEP_THRESHOLD` accumulation → `onMoveCursor`) is **replaced** by continuous pointer movement: every PanResponder move emits a relative `(dx, dy)` delta; Kotlin updates the cursor window position. "Tap to click" (a quick lift without movement) becomes an optional setting.
- **Screen coverage problem:** when the panel is the IME keyboard, its window covers the bottom ~275dp — taps dispatched there would land on the keyboard itself, not the app. Two mitigations, both implemented:
  - The **floating panel** (a11y entry) is draggable and closable, so the user positions it out of the way.
  - When the panel is the IME keyboard in touchpad mode, we **shrink the IME window to a thin touchpad strip** (~90dp) via `updateSoftInputWindowLayout` / re-measured container, freeing the rest of the screen. The existing `KEYBOARD_HEIGHT_DP` constant is replaced by a dynamic value in touchpad mode.
- **Drag (mouse-drag) support:** pressing **L** and dragging converts the drag into a single `dispatchGesture` stroke (down → move → up), enabling slider dragging and content scrolling by drag, like a physical mouse.

---

## 6. Pointer / Cursor Implementation

**Requirement: cursor UI in React Native.** The current `ImageView` bitmap is replaced by a dedicated RN surface:

1. **`keyboard.index.js`** registers a second component:
   ```js
   AppRegistry.registerComponent('KickKeyPointer', () => KickKeyPointerRoot);
   ```
   `KickKeyPointerRoot` renders a small, static, `pointerEvents="none"` arrow (drawn with `react-native-svg`, already a dependency) with a drop shadow, sized ~28–36dp.
2. **Kotlin** creates a second `ReactSurface` from the keyboard `ReactHost` (`host.createSurface(this, "KickKeyPointer", null)`) and adds its view to a `WindowManager` window:
   - `TYPE_ACCESSIBILITY_OVERLAY` (no `SYSTEM_ALERT_WINDOW` needed, a11y service enabled) — primary.
   - Fallback: `TYPE_APPLICATION_OVERLAY` (requires `SYSTEM_ALERT_WINDOW`) for the IME-only case where the service is not enabled.
   - Flags: `FLAG_NOT_FOCUSABLE | FLAG_NOT_TOUCHABLE | FLAG_LAYOUT_NO_LIMITS`, `PixelFormat.TRANSLUCENT`, `gravity = TOP|START`, no bounds → **can be positioned anywhere on screen**.
3. **Movement:** `pointerMove(dx, dy)` (called at most once per frame from JS) updates `cursorX/cursorY` (clamped to `0..screenW`, `0..screenH` — the whole screen, including over the keyboard area only when the panel is the floating/draggable one) and calls `updateViewLayout()`. The RN arrow itself never re-renders while moving — position lives in native layout params.
4. **Cursor state ownership:** native keeps the single source of truth (`cursorX`, `cursorY`). Click/scroll/back methods read it — the touchpad surface and cursor surface never need to sync.

---

## 7. Kotlin Native Implementation

New files (all in `native-files/java/com/kickkey/`, copied by the config plugin like the existing ones):

### `KickKeyAccessibilityService.kt`
- Extends `AccessibilityService`; declared with `BIND_ACCESSIBILITY_SERVICE` + `res/xml/accessibility_service_config.xml`.
- **Singleton** (`companion object { @Volatile var instance }`) so `KickKeyModule` can reach it without IPC.
- Core methods:
  ```kotlin
  fun tapAt(x: Float, y: Float)                 // dispatchGesture down+up, ~60ms
  fun longPressAt(x: Float, y: Float)           // ~600ms stroke (right-click proxy)
  fun swipe(fromX, fromY, toX, toY, dur)        // scroll / drag
  fun dragStroke(start, end, dur)               // L-drag
  fun navigateBack()  = performGlobalAction(GLOBAL_ACTION_BACK)
  fun navigateHome()  = performGlobalAction(GLOBAL_ACTION_HOME)
  fun scrollNode(direction: Int)                // ACTION_SCROLL_* on focused node
  fun showFloatingPanel() / hideFloatingPanel() // overlay window w/ RN surface
  fun showCursor() / moveCursorWindow(dx, dy) / hideCursor()
  fun isEnabled() / onAccessibilityButtonClicked() / onServiceConnected()
  ```
- Gesture helper builds `GestureDescription` from `MotionEvent.obtain(...)` strokes (all injected events are real, framework-sourced `MotionEvent`s).

### `KickKeyInputMethodService.kt` (modify)
- Touchpad-mode shrink: dynamic window height when `toggleMode` is active (JS notifies native via a new `@ReactMethod setTouchpadMode(on)`).
- Keep all existing IME logic untouched otherwise.

### `KickKeyModule.kt` (re-point the touchpad API)
- `pointerShow / pointerMove / pointerHide` → route to the service singleton (cursor overlay window) instead of the `ImageView`.
- `mouseClick(button)` → `tapAt(cursorX, cursorY)` / `longPressAt(...)`.
- `scrollPage(direction)` → `scrollNode(...)` + swipe fallback.
- `navigateHistory(direction)` → Back via global action; Forward via pro mode / no-op.
- New: `setTouchpadMode(on: Boolean)`, `isAccessibilityEnabled(promise)`, `openAccessibilitySettings(promise)`, `proModeInject(event: ...)` (ADB path).

### Pro-mode wrapper (optional, ADB)
- `InputManager.injectInputEvent()` for `HOVER_MOVE`, `ACTION_SCROLL` (wheel), and `KEYCODE_FORWARD`; guarded by a runtime check that `INJECT_EVENTS` is actually granted (`checkSelfPermission`), with graceful fallback to the a11y path otherwise.

---

## 8. React Native Implementation

- **`keyboard.index.js`** — register `KickKeyPointer` (and the floating panel reuses `KickKeyKeyboard` with different initial props, e.g. `{ surface: 'overlay' }`).
- **New `src/keyboard/pointer/PointerRoot.tsx`** — the cursor component: `react-native-svg` arrow, `pointerEvents="none"`, fully transparent background. Static; no per-move re-render.
- **New `src/keyboard/overlay/FloatingPanel.tsx`** — wrapper used by the overlay surface: a rounded, dark card with a drag handle, a close button, and the existing `QykeyKeyboard` (keyboard ⇄ touchpad slider works unchanged). Positioned by native window params; drag handle updates them via `pointerMove`-style native calls.
- **`Touchpad.tsx`** — replace DPAD-step logic with continuous deltas; add "tap to click" (if enabled); keep L/R/scroll/back/forward wiring (they now map to the new native methods).
- **`useKeyboardState.ts`** — swap handlers to the new API; add `setTouchpadMode`, `isAccessibilityEnabled`, pro-mode toggle plumbing.
- **Settings screen (`app/(tabs)/settings.tsx`)** — "Enable accessibility" row (deep link), status row (enabled/not), pro-mode toggle (hidden unless permission detected).
- **`modules/kickkey-module/index.ts`** — typed wrappers for all new methods.

---

## 9. React Native ↔ Kotlin Communication

Reuse the existing bridge pattern — **no new IPC in the recommended design** (same process).

| Direction | Mechanism | Examples |
|---|---|---|
| JS → Kotlin | `@ReactMethod` promise calls on `KickKey` | `pointerMove`, `mouseClick`, `scrollPage`, `navigateBack`, `setTouchpadMode`, `isAccessibilityEnabled` |
| Kotlin → JS | `DeviceEventManagerModule.RCTDeviceEventEmitter.emit(...)` | `onAccessibilityStateChanged`, `onPanelHidden`, `onProModeChanged` |
| Frame-rate path | Single `pointerMove(dx, dy)` per frame (throttled in JS via `requestAnimationFrame`) | drag updates |
| Overlay surfaces | Same `ReactHost` — surfaces `KickKeyKeyboard` / `KickKeyPointer` / `KickKeyOverlay` share the bundle and the `KickKeyModule` instance | no cross-surface messaging needed (native owns cursor position) |

If the fallback architecture (a11y service in main process) is ever needed, the bridge becomes a bound service: `:ime_process` binds `KickKeyTouchpadBridgeService` (AIDL or Messenger) and forwards the same one-way calls; the bridge forwards to the service singleton. This is intentionally *not* the default.

---

## 10. Mouse-Like Input Simulation

### Play-safe path (default) — Accessibility Service
| Action | Emulation |
|---|---|
| Pointer movement | Our RN cursor overlay moved via `updateViewLayout` |
| Left click | `dispatchGesture` tap (down+up at cursor) |
| Right click | `dispatchGesture` long-press (~600ms) — triggers context menus in most apps |
| Drag | One stroke: down → move → up |
| Scroll | Vertical swipe strokes (repeat while held) and/or `ACTION_SCROLL_*` on the focused node |
| Back | `GLOBAL_ACTION_BACK` |
| Home / Recents / Notifications | `GLOBAL_ACTION_*` (available) |
| Forward | Not available (no API) — see below |

### Pro mode (optional, ADB / personal devices) — `INJECT_EVENTS`
- `adb shell pm grant com.kickkey android.permission.INJECT_EVENTS`
- Enables true **hover** (`HOVER_MOVE` — link highlights, tooltips), **wheel scroll** (`ACTION_SCROLL`), and **Forward** (`KEYCODE_FORWARD`).
- ⚠️ **Android 12+ blocks `injectInputEvent` for apps targeting API 31+** (SecurityException even with the permission). Realistically this path works on **Android ≤ 11** with an adb grant, or on rooted devices. Never on the Play Store.

---

## 11. Click Handling

- **Left click** (`L` button or tap-to-click): `tapAt(cursorX, cursorY)` — a real tap injected into the app under the cursor. This is how every Play-Store mouse/touchpad app works.
- **Right click** (`R` button): long-press stroke at the cursor. Android has no native right-click; long-press is the accepted equivalent (opens context menus in launchers, browsers, text selection, etc.). Configurable duration.
- **Double click** (optional): two quick taps (toggleable for select-word behavior in some apps).
- **Click vs. panel overlap**: clicks never dispatch at coordinates covered by the floating panel itself; Kotlin excludes the panel window's rect from dispatch targets (clicks there just hide the panel / are ignored).
- All gesture injections run on the service's main handler with a completion callback; rapid repeated clicks are queued (max ~10/s) to stay within gesture dispatch limits.

---

## 12. Scrolling

- **Buttons**: scroll up/down carets repeat while held (JS auto-repeat, like the existing backspace repeat).
- **Scroll targets** (priority order):
  1. Focused node: `AccessibilityNodeInfo.performAction(ACTION_SCROLL_BACKWARD/FORWARD)`.
  2. Fallback: `dispatchGesture` vertical swipe (e.g. from cursor+200px to cursor−200px, ~300ms), which scrolls whatever app is under the cursor.
  3. Pro mode: `MotionEvent.ACTION_SCROLL` wheel events for pixel-perfect mouse-like scrolling.
- **Drag-to-scroll**: with L held, dragging produces continuous scroll strokes (like dragging a scrollbar).

---

## 13. Back / Forward Actions

| | Back | Forward |
|---|---|---|
| a11y path | ✅ `performGlobalAction(GLOBAL_ACTION_BACK)` | ❌ No global action, no key injection via a11y |
| Pro mode (ADB ≤ Android 11) | ✅ (same) | ✅ `KEYCODE_FORWARD` |
| Fallback for Forward | — | Tap-based: on the **floating panel**, Forward first tries `ACTION_SCROLL_FORWARD` on the focused node, then does nothing with a subtle "not supported on this Android version" hint |

The existing chevron buttons stay; their native mapping changes from `ALT+DPAD` (text-caret hack) to the above. Note: `ALT+DPAD_LEFT/RIGHT` caret movement remains available as a *text-navigation* mode when a field is focused (kept as an option).

---

## 14. Permissions

| Permission | Level | Needed for |
|---|---|---|
| `android.permission.BIND_ACCESSIBILITY_SERVICE` | normal (service attr) | Declaring the a11y service |
| `SYSTEM_ALERT_WINDOW` | special (runtime) | Fallback cursor/panel overlays when a11y not enabled |
| `android.permission.VIBRATE` | normal | existing (already declared) |
| `android.permission.POST_NOTIFICATIONS` | runtime (API 33+) | optional notification entry point |
| `android.permission.INJECT_EVENTS` | signature/privileged | pro mode only; declared in manifest, never granted at install; via `adb pm grant` or root |
| `android.permission.FOREGROUND_SERVICE*` | — | not needed (a11y services are system-bound) |

Runtime permission flows: a11y is enabled by the user in Settings (we deep-link there); `SYSTEM_ALERT_WINDOW` via the existing overlay-settings flow; `POST_NOTIFICATIONS` via standard runtime request.

---

## 15. Accessibility Service Design

`res/xml/accessibility_service_config.xml` (copied by the config plugin):

```xml
<accessibility-service
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="true"
    android:accessibilityFlags="flagRequestAccessibilityButton|flagDefault"
    android:settingsActivity="com.kickkey.MainActivity" />
```

Manifest entry (added by a new `withAccessibilityService.js` plugin, mirroring `withImeService.js`):

```xml
<service
    android:name=".KickKeyAccessibilityService"
    android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
    android:exported="true"
    android:label="@string/a11y_service_name"
    android:process=":ime_process">   <!-- same process as IME + keyboard host -->
    <intent-filter>
        <action android:name="android.accessibilityservice.AccessibilityService" />
    </intent-filter>
    <meta-data
        android:name="android.accessibilityservice"
        android:resource="@xml/accessibility_service_config" />
</service>
```

Design rules:
- **No data collection.** The service only reacts to *explicit user actions* (button taps on the touchpad) and performs the corresponding gesture. It does not log, transmit, or persist anything.
- `onAccessibilityButtonClicked()` → show floating panel; `onServiceConnected()` → publish singleton + notify JS (`onAccessibilityStateChanged`).
- Keep the service's `onAccessibilityEvent` minimal (only what's needed for `scrollNode` focus tracking) to minimize battery/perf cost.
- If the service is disabled mid-session, all touchpad features degrade gracefully to the current text-field behavior + a banner pointing to Settings.

---

## 16. State Management

- **Native (single source of truth):** `cursorX/cursorY`, panel visibility, touchpad mode, pro-mode availability — plain fields on the service/module singletons (no IPC).
- **JS (existing zustand/hooks):** `toggleMode` already lives in `useKeyboardState`; add `isAccessibilityEnabled`, `touchpadMode` (strip vs full), `tapToClick`, `proMode` — persisted via the existing `savePreferences` mechanism.
- **Cursor surface** holds no state — it renders a static arrow; native owns position.
- **Events:** `onAccessibilityStateChanged`, `onProModeChanged` pushed from Kotlin; the touchpad surface reads them to update banners/buttons.

---

## 17. Performance Considerations

- **Pointer moves:** throttled to one `pointerMove` per frame in JS (`requestAnimationFrame` gate in `Touchpad.tsx`); native updates only `LayoutParams.x/y` + `updateViewLayout` (no bitmap recreation, no re-render). Target: 60Hz with <1ms native cost.
- **Cursor surface:** static content, no re-render on move — the JS bundle for the cursor root is tiny; it shares the already-loaded keyboard Hermes bundle.
- **Gesture queue:** clicks/swipes serialized through a small queue with per-gesture completion callbacks; repeat-scroll throttled (~150ms between swipes).
- **Memory:** the a11y service living in `:ime_process` means the process may start even when the user never opens the keyboard. Gate the ReactHost pre-warm so the 911KB bundle + Hermes runtime load **lazily** on first surface creation instead of eagerly at process start (small change to `KickKeyApplication.onCreate`).
- **Watchdog reuse:** the existing IME startup watchdog / mount-pump machinery applies unchanged to the new overlay and cursor surfaces (same black-screen failure class).

---

## 18. Security & Privacy

- Accessibility is the most sensitive Android permission. We use it **only** for user-triggered gestures; no screen-content scraping, no key logging, no credential access.
- The service's `accessibilityEventTypes` are limited to window-state/content-changed (needed only for focused-node scrolling); we do not request touch-exploration, filter-key-events, or `canRead*` beyond the minimum.
- Overlays never capture input meant for other apps (`FLAG_NOT_TOUCHABLE` on the cursor; the panel only intercepts its own surface).
- No network access from the service; all logic local. Privacy policy (§ existing `privacy-policy.md`) must add a section describing the accessibility service and the touchpad.
- On-device disclosure: first-launch dialog explaining what the a11y service does and why, before deep-linking to Settings.

---

## 19. Android Compatibility

| Android | API | Status |
|---|---|---|
| 7.0 | 24 | `dispatchGesture` available (min supported by RN 0.86). `TYPE_ACCESSIBILITY_OVERLAY` OK (22+). |
| 8–11 | 26–30 | ✅ Full a11y path + ADB pro mode (`INJECT_EVENTS` works with adb grant). |
| 12 | 31 | ⚠️ `injectInputEvent` blocked for targetSdk 31+ → pro mode dead on this path; a11y path unaffected. |
| 13 | 33 | "Restricted settings": sideloaded installs need extra steps to enable a11y (documented in-app). `POST_NOTIFICATIONS` runtime. |
| 14+ | 34–36 | No blocking changes for this design; Play declaration + `isAccessibilityTool` mandatory. |
| OEMs | — | Samsung "Assistant menu" may additionally allow a direct menu entry; treat as bonus, not a dependency. |

Testing matrix: at minimum Android 10, 12, 13, 14; gesture-nav vs 3-button nav; one device with a stock launcher and one OEM (Samsung/Xiaomi).

---

## 20. Expo / Custom Development Build Requirements

- **Expo Go cannot run this** (already true for the IME) — a **custom development build / prebuild** is required, as today.
- **Config plugin** (new `plugins/withAccessibilityService.js`), following the `withImeService.js` pattern:
  - copy new Kotlin files → `android/app/src/main/java/com/kickkey/`;
  - copy `accessibility_service_config.xml` → `res/xml/`;
  - add the `<service>` block + `POST_NOTIFICATIONS` permission to the manifest;
  - set `android:isAccessibilityTool` (decision in §23).
- **Bundle build:** `scripts/build-keyboard-bundle.js` already emits `keyboard.bundle` from `keyboard.index.js`; registering `KickKeyPointer` adds a second root to the same bundle — no build-script change needed.
- No new npm dependencies required (`react-native-svg` already present). If we add tap-to-click etc., everything is in-tree.

---

## 21. Testing Strategy

1. **Manual device test script** (the core): enable service → assign a11y button/shortcut → open floating panel with no field focused → cursor moves across the whole screen in another app → L/R click works in launcher, browser, settings → scroll up/down scrolls lists → Back navigates → panel closes without killing the app.
2. **IME touchpad regression:** existing toggle flow; caret DPAD mode still works when a field is focused; pointer now appears over the whole screen.
3. **Edge cases:** screen rotation, foldables/multi-window, gesture-nav vs 3-button, immersive apps (video), apps that block overlays (banking apps may ignore injected touches — expected, documented), service kill/restart, Android 13 restricted settings flow.
4. **Unit (Robolectric):** gesture-description builders, clamping math, repeat-throttling, pro-mode permission checks.
5. **Instrumentation (optional):** a test-only a11y service that verifies `dispatchGesture` callbacks on an emulator.
6. **Perf check:** 60Hz pointer move with no dropped frames (profile with `systrace` / React DevTools).

---

## 22. Build & Deployment

Same pipeline as today, unchanged steps:
1. `node scripts/build-keyboard-bundle.js` (keyboard.bundle now contains keyboard + pointer + overlay roots).
2. `npx expo prebuild --platform android` (runs `withImeService` + new `withAccessibilityService`).
3. `npx expo run:android` for dev; `eas build -p android` for release (existing `eas.json`).
4. Pro mode on personal devices: install APK, then `adb shell pm grant com.kickkey android.permission.INJECT_EVENTS`.
5. Version bumps + changelog in the existing docs (`todo.md`, phase docs).

---

## 23. Google Play Store Considerations

- **Accessibility declaration:** any app targeting API 31+ that includes an `AccessibilityService` must complete the **Play Console "Accessibility Service" declaration** and set `android:isAccessibilityTool` on the service.
  - Recommendation: set `isAccessibilityTool="true"` and describe the touchpad as an **assistive input aid** (motor-impaired users who cannot use direct touch), which is the honest framing for a virtual mouse/touchpad.
  - The Play Console declaration must state the core functionality and confirm no data misuse. Keep the in-app rationale dialog (§18) consistent with the declaration.
- **Overlay permission:** `SYSTEM_ALERT_WINDOW` is acceptable for legitimate floating-UI purposes (Play policy allows when the overlay is core to the app and disclosed); our primary path (a11y overlay) doesn't even need it.
- **Risk:** reviewers may scrutinize "gesture injection" apps. Mitigations: no data collection, minimal event types, clear user-visible purpose, no bypassing of system protections, compliance with the keyboard/IME data-handling requirements already in place.
- Pro mode (`INJECT_EVENTS`) must be **undetectable-in-Play**: the permission is declared but never granted by the store; the feature only activates when the permission is actually present (root/adb installs).

---

## 24. Potential Limitations & Risks

| # | Limitation / Risk | Mitigation |
|---|---|---|
| 1 | No true hover (link highlights) via public APIs | Documented; cursor + tap-dispatch is the Play-standard behavior; pro mode offers hover on Android ≤ 11 |
| 2 | No Forward key via a11y | Pro mode; scroll-forward fallback; honest UI hint |
| 3 | No mouse-wheel events via a11y | Swipe-based scroll; pro-mode wheel |
| 4 | Clicks land on the panel if it covers the target | Panel draggable/closable; IME shrinks to strip in touchpad mode; clicks over panel rect ignored |
| 5 | a11y service in a non-default process (OEM edge) | Device testing; fallback architecture (main process + AIDL) documented and ready |
| 6 | Android 13 restricted settings friction for sideloads | In-app instructions + deep link |
| 7 | Play review risk on accessibility declaration | Honest `isAccessibilityTool`, no data collection, rationale dialog |
| 8 | Banking/secure apps may reject injected touches | Expected; documented behavior, not a bug |
| 9 | Memory: process alive with a11y service but no keyboard | Lazy pre-warm of the keyboard host (§17) |
| 10 | `dispatchGesture` while IME is focused goes to the IME window | Strip mode + panel repositioning (§5) |

---

## 25. Recommended Folder Structure

```
react-native-kickKey-deepseek/
├─ native-files/
│  ├─ java/com/kickkey/
│  │  ├─ KickKeyAccessibilityService.kt        NEW
│  │  ├─ TouchpadGestureController.kt          NEW (gesture builders + queue)
│  │  ├─ PointerOverlay.kt                     NEW (cursor window mgmt)
│  │  ├─ FloatingPanelController.kt            NEW (panel window + surface)
│  │  ├─ ProModeInjector.kt                    NEW (INJECT_EVENTS wrapper)
│  │  └─ KickKeyModule.kt / KickKeyInputMethodService.kt   (modified)
│  └─ res/xml/
│     ├─ method.xml                            (existing)
│     └─ accessibility_service_config.xml      NEW
├─ plugins/
│  ├─ withImeService.js                        (existing)
│  └─ withAccessibilityService.js              NEW
├─ keyboard.index.js                           (register KickKeyPointer + overlay props)
├─ src/keyboard/
│  ├─ pointer/PointerRoot.tsx                  NEW (RN cursor arrow)
│  ├─ overlay/FloatingPanel.tsx                NEW (draggable panel wrapper)
│  ├─ qykey/Touchpad.tsx                       (modified: continuous deltas)
│  ├─ qykey/QykeyKeyboard.tsx                  (minor: touchpad strip hint)
│  └─ hooks/useKeyboardState.ts                (modified)
├─ app/(tabs)/settings.tsx                     (a11y enable + pro mode rows)
└─ modules/kickkey-module/index.ts             (typed wrappers)
```

---

## 26. Development Milestones

| Milestone | Scope | Exit criteria |
|---|---|---|
| **M1 — A11y service + panel** | Service, config XML, plugin, floating panel opens from a11y button/shortcut with no field focused | Panel opens/closes; slider works inside panel; no input field required |
| **M2 — RN cursor + movement** | `KickKeyPointer` surface, overlay window, per-frame `pointerMove`, full-screen clamping; remove bitmap ImageView | Cursor renders in RN, moves across whole screen at 60Hz |
| **M3 — Cross-app input** | `tapAt`/`longPressAt`/swipe/`GLOBAL_ACTION_BACK`, scroll fallbacks, IME strip mode, button wiring | L/R/scroll/back work in real apps (launcher, browser, settings) |
| **M4 — Pro mode + settings** | `INJECT_EVENTS` wrapper (hover/wheel/Forward), settings UI, permission flows, notifications | Pro mode on Android ≤ 11 device; graceful fallback elsewhere |
| **M5 — Hardening** | Watchdog for new surfaces, lazy pre-warm, Play declaration, privacy-policy section, EN/BN docs, device matrix testing | Release candidate passes §21 matrix |

**Total estimated effort:** M1–M3 are the core (roughly 60% of the work); M4 is additive; M5 is compliance + polish.

---

## 27. Decisions Required Before Implementation

1. **Process placement** — approved recommendation: a11y service inside `:ime_process` (no IPC). Fallback (main process + AIDL) only if device testing fails. *(Default: proceed with recommended.)*
2. **`isAccessibilityTool`** — set `true` and frame the touchpad as an assistive input aid in the Play declaration. *(Default: true.)*
3. **Tap-to-click** — include as an opt-in setting? *(Default: on, toggleable.)*
4. **Right-click emulation** — long-press (~600ms). Confirm acceptable vs. alternative (two-finger tap on the touchpad). *(Default: long-press + optional two-finger.)*
5. **IME strip mode** — when the IME keyboard's touchpad tab is active, shrink the keyboard to a thin strip. Confirm acceptable. *(Default: yes.)*

> **Status: awaiting approval.** No code has been changed (working tree clean). On approval, implementation starts with M1.
