# KickKey — M5 Implementation Guide
## Hardening: Surface Watchdogs, Lazy Pre-Warm, Play Compliance & Device-Matrix Testing

> **Platform:** Android Only · **Project:** `react-native-kickKey-deepseek` · **Milestone:** M5 · **Status:** READY TO IMPLEMENT
> Follows the approved plan: [`KickKey-Accessibility-Touchpad-Plan.md`](./KickKey-Accessibility-Touchpad-Plan.md)
> Prerequisites: M1–M4 complete (a11y service + panel, RN cursor, cross-app input, pro mode + settings). See the M1–M4 guides in this folder.

---

## 1. What M5 Delivers

| From plan §26 | M5 — Hardening |
|---|---|
| Scope | Watchdog for the new surfaces (overlay + cursor), lazy pre-warm of the keyboard ReactHost, node-recycle hardening on API < 33, Play declaration + `isAccessibilityTool`, privacy-policy section, EN/BN docs pass, device-matrix testing |
| Exit criteria | **Release candidate passes the §21 test matrix** (Android 10/12/13/14 × gesture-nav/3-button × stock/OEM) |

**In one sentence:** after this milestone the touchpad feature set is **feature-complete and hardened** — the overlay and cursor surfaces get the same startup watchdog that already protects the IME keyboard, the Hermes runtime stops being loaded when the user never opens the keyboard (lazy pre-warm), the accessibility service leaks no `AccessibilityNodeInfo` wrappers on old Android, and everything is wrapped up for a **Play Store submission**: `isAccessibilityTool` declaration, an honest in-app rationale dialog, a privacy-policy section, and a passing device matrix.

M5 is deliberately **not** about new features — it is the reliability, compliance and polish layer (plan §26: "M5 is compliance + polish"). Everything here is either invisible (watchdogs, recycling, lazy warm), or required by the store (declarations, privacy policy), or proves the whole stack (device matrix).

### Deliverables at a glance

| # | Deliverable | Why (plan ref) |
|---|---|---|
| 1 | Per-surface JS readiness signals (`surfaceReady`) | The watchdog needs to know which root mounted (§17) |
| 2 | Generic `SurfaceWatchdog` + IME refactor | Overlay/cursor share the IME's black-screen failure class (§17) |
| 3 | Watchdog wired to overlay + cursor surfaces | Same protection as the keyboard |
| 4 | Lazy pre-warm of the keyboard ReactHost | Process may live for the a11y service alone; don't hold Hermes (§17, risk #9) |
| 5 | Node-recycle hardening on API < 33 | `AccessibilityNodeInfo` wrapper leak in scroll walks (M3 note) |
| 6 | `android:isAccessibilityTool="true"` + Play Console declaration | Mandatory for any API 31+ a11y app (§20, §23) |
| 7 | In-app accessibility rationale dialog | Honest disclosure, consistent with the declaration (§18, §23) |
| 8 | Privacy-policy section | Required disclosure for a11y + touchpad (§18) |
| 9 | Device-matrix test run (§21) | Release-candidate proof |
| 10 | EN/BN docs pass + `todo.md` | Milestone hygiene |

---

## 2. Architecture Recap

```
:ime_process
├─ KickKeyApplication
│    └─ onCreate(): NO eager pre-warm anymore (M5) — keyboardReactHost
│       initializes lazily on the FIRST surface creation (keyboard /
│       overlay / pointer all touch the getter before attaching a surface)
├─ SurfaceWatchdog.kt (NEW, generic)
│    └─ poll(isJsReady, isSurfaceRunning, surfaceView) → success | remount | give-up
│       └─ reused by: IME keyboard (refactored), FloatingPanelController,
│                     PointerOverlay
├─ KickKeyModule
│    ├─ surfaceJsReady: MutableMap<String, Boolean>   (NEW)
│    └─ surfaceReady(surface) @ReactMethod            (NEW — called by each JS root)
├─ KickKeyAccessibilityService
│    └─ performScrollOnFocusedNode: node.recycle() on API < 33 (M5)
├─ FloatingPanelController ── SurfaceWatchdog("overlay") on show
└─ PointerOverlay          ── SurfaceWatchdog("pointer") on show

keyboard.bundle (JS roots — each signals readiness in a mount useEffect)
├─ KeyboardScreen  → keyboardReady()      (existing)
├─ FloatingPanel   → surfaceReady('overlay')   (NEW)
└─ PointerRoot     → surfaceReady('pointer')   (NEW)

Manifest / config (withAccessibilityService.js)
└─ android:isAccessibilityTool="true" on the a11y <service> (M5)

Companion app
├─ app/(tabs)/settings.tsx → AccessibilityRationaleDialog on first "Enable" tap
├─ components/AccessibilityRationaleDialog.tsx (NEW)
└─ privacy-policy.md → "Accessibility Service & Touchpad" section (M5)
```

---

## 3. Step-by-Step Implementation

### Step 1 — Per-surface readiness signals

**Edit:** `native-files/java/com/kickkey/KickKeyModule.kt` + the JS roots

**1a.** Add the per-surface flag map next to `keyboardJsReady` in the `companion object`:

```kotlin
        // M5: one JS-ready flag per React surface that shares the keyboard
        // host ("keyboard" / "overlay" / "pointer"). Same semantics as
        // keyboardJsReady — set from a mount useEffect, read by SurfaceWatchdog.
        @Volatile
        val surfaceJsReady = java.util.concurrent.ConcurrentHashMap<String, Boolean>()
```

**1b.** Add the `@ReactMethod` (mirror of `keyboardReady`, but named):

```kotlin
    /** M5: each JS root calls this from a mount useEffect once its React root
     *  has committed a frame. The SurfaceWatchdog uses it to distinguish
     *  "rendering OK" from "surface started but JS never mounted". */
    @ReactMethod
    fun surfaceReady(surface: String, promise: Promise) {
        surfaceJsReady[surface] = true
        // Same capture as keyboardReady(): inside a @ReactMethod the bridge is
        // guaranteed live, which the watchdog uses when host.currentReactContext
        // returns null (RN 0.86 headless/IME quirk).
        keyboardReactContext = reactApplicationContext
        Log.i("KickKeyModule", "JS surface '$surface' mounted and ready")
        promise.resolve(null)
    }
```

(`keyboardReady()` stays as-is for backwards compatibility; the IME keyboard may either keep calling it or switch to `surfaceReady("keyboard")` — both set what the watchdog reads.)

**1c.** JS roots signal readiness and listen for force-rerender. In `src/keyboard/overlay/FloatingPanel.tsx` and `src/keyboard/pointer/PointerRoot.tsx`, add the readiness signal on mount and the remount listener:

```tsx
// FloatingPanel.tsx (and similarly PointerRoot.tsx) — top of the component
useEffect(() => {
  getKickKey()?.surfaceReady?.('overlay');   // FloatingPanel
  // getKickKey()?.surfaceReady?.('pointer'); // PointerRoot
}, []);

// M5: Listen for watchdog force-rerender targeting this surface (or all surfaces)
useEffect(() => {
  const kickkey = getKickKey();
  if (!kickkey) return;
  const emitter = new NativeEventEmitter(kickkey);
  const sub = emitter.addListener('kickkey_forceRerender', (data?: { surface?: string }) => {
    if (!data?.surface || data.surface === 'overlay') { // 'pointer' for PointerRoot
      setMountNonce((n) => n + 1);
    }
  });
  return () => sub.remove();
}, []);
```

**1d.** Bridge wrapper in `modules/kickkey-module/index.ts`:

```ts
  /** M5: signal that a shared-host React surface mounted (keyboard/overlay/pointer). */
  surfaceReady: (surface: 'keyboard' | 'overlay' | 'pointer'): Promise<void> =>
    KickKey.surfaceReady(surface),
```

---

### Step 2 — Generic `SurfaceWatchdog`

**New file:** `native-files/java/com/kickkey/SurfaceWatchdog.kt`

Extract the polling skeleton of the IME watchdog (`KickKeyInputMethodService.scheduleStartupWatchdog`) into a reusable class. The success conditions stay identical to the IME's (learned the hard way, §13 of the M3 doc): **JS ready AND the surface view has a real laid-out size (>0×>0) AND Fabric mounted content (childCount > 0)** — `isRunning`/`isAttachedToWindow` alone are unreliable for detecting the invisible-surface case.

```kotlin
package com.kickkey

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * M5 — generic startup watchdog for every React surface sharing the keyboard
 * host (IME keyboard, floating overlay, pointer cursor).
 *
 * Failure class: the JS root mounts but Fabric never applies content, or the
 * surface never starts (invisible / black surface). Polls for readiness and,
 * when JS mounted but nothing rendered, forces a remount via
 * kickkey_forceRerender; gives up via [onGiveUp] after a fixed window so a
 * failure is never left undiagnosable.
 *
 * Cadence (same as the IME watchdog): first check at 8s, retry every 3s,
 * give up after 3 retries (≈17s total, 4 attempts total).
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

                    // ── SUCCESS ──
                    if (isJsReady() && laidOutSize && hasContent) {
                        Log.i(TAG, "Watchdog[$surfaceName]: JS mounted & rendering — OK")
                        return
                    }

                    // ── JS mounted but nothing visible → force a remount ──
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
                    // A transient exception must not silently kill the watchdog.
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

> `kickkey_forceRerender` now carries a `surface` param. The existing keyboard listener in `KeyboardScreen` must keep working: it should ignore (or act on) the param — the same remount logic applies to whichever root receives it, and the mount-pump machinery (`notifyPumpActive`, `verifyFramePump`) already lives in the keyboard path.

**Refactor the IME watchdog to use it** (`KickKeyInputMethodService.kt`): replace the polling skeleton of `scheduleStartupWatchdog` with a `SurfaceWatchdog` instance, but **keep the IME-specific branches** the generic class does not cover — host-destroyed detection (`LifecycleState.BEFORE_CREATE` → `resetKeyboardHostForRetry()` + error), the `hostLifecycleHistory` diagnostics, and `showErrorFallback`:

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
        // IME-specific guards keep running in parallel:
        //  - mount-pump resume / verifyFramePump (existing)
        //  - host destroyed-after-resume detection → resetKeyboardHostForRetry()
        //    (existing branches — move them into a callback the watchdog invokes
        //     when isJsReady() is true, or keep the existing parallel poll that
        //     inspects host.lifecycleState. Do NOT lose this logic in the refactor.)
    }
```

The safest refactor: keep the existing IME watchdog **as the "keyboard" instance** but rename/delegate the shared polling into `SurfaceWatchdog`, and leave the host-lifecycle logic as an extra check run inside the same poll (pass it via a lambda). Test thoroughly with the §5 keyboard-open cases before moving on.

---

### Step 3 — Wire the watchdog to the overlay + cursor surfaces

**Edit:** `FloatingPanelController.kt` (panel) and `PointerOverlay.kt` (cursor) — wherever those live after M1/M2 (the plan lists them as their own files; if they are still inline in `KickKeyModule.kt`, place the watchdog calls at the same spots).

**3a.** Floating panel — start the watchdog right after the overlay surface is created, cancel on hide:

```kotlin
    // after surface.start() / surface.attachView() succeeds:
    surfaceWatchdog = SurfaceWatchdog(
        surfaceName = "overlay",
        isJsReady = { KickKeyModule.surfaceJsReady["overlay"] == true },
        isSurfaceRunning = { overlaySurface?.isRunning == true },
        surfaceView = { overlaySurface?.view },
        onGiveUp = { reason, detail ->
            Log.e(TAG, "Overlay failed to render — hiding panel: $reason | $detail")
            hideFloatingPanel()   // never leave a dead panel on screen
        }
    ).also { it.start() }

    fun hideFloatingPanel() {
        surfaceWatchdog?.cancel()
        surfaceWatchdog = null
        // ...existing hide logic...
    }
```

**3b.** Cursor surface — same pattern in `PointerOverlay.show()`:

```kotlin
    // inside show(), after the pointer ReactSurface is created:
    surfaceWatchdog = SurfaceWatchdog(
        surfaceName = "pointer",
        isJsReady = { KickKeyModule.surfaceJsReady["pointer"] == true },
        isSurfaceRunning = { pointerSurface?.isRunning == true },
        surfaceView = { pointerSurface?.view },
        onGiveUp = { reason, detail ->
            Log.e(TAG, "Pointer surface failed to render — hiding cursor: $reason | $detail")
            hide()   // the cursor is a convenience overlay; hide beats a stuck window
        }
    ).also { it.start() }

    fun hide() {
        surfaceWatchdog?.cancel()
        surfaceWatchdog = null
        // ...existing hide logic...
    }
```

**3c.** On service teardown, cancel every watchdog (the service owns all three surfaces):

```kotlin
    // in onUnbind() / onDestroy(), before tearing down surfaces:
    surfaceWatchdog?.cancel()      // IME
    panelController?.cancelWatchdog()
    PointerOverlay.cancelWatchdog()
```

---

### Step 4 — Lazy pre-warm of the keyboard ReactHost

**Edit:** `native-files/java/com/kickkey/KickKeyApplication.kt`

**Motivation (plan §17, risk #9):** the accessibility service lives in `:ime_process`, so Android may start the process at boot (a11y enabled) even when the user **never opens the keyboard**. Eagerly loading the ~911KB bundle + Hermes runtime then holds 30–50MB for nothing. M5 gates the pre-warm so the host initializes on **first surface creation** instead of process start.

**4a.** Remove the eager block from `onCreate()` — delete:

```kotlin
        // ── Pre-warm the keyboard ReactHost in the IME process ────────────────
        // (delete this whole block — M5 makes it lazy)
        if (isImeProcess) {
            try {
                keyboardReactHost // lazy getter → initKeyboardRuntime() + host.start()
                Log.i(TAG, "Keyboard ReactHost pre-warmed in IME process")
            } catch (e: Throwable) {
                Log.w(TAG, "Keyboard ReactHost pre-warm failed — will retry on first open", e)
            }
        }
```

Keep `loadReactNative(this)` and `ApplicationLifecycleDispatcher.onApplicationCreate(this)` — those are cheap and required.

**4b.** Make sure every surface entry point touches the lazy getter **before** creating its surface (the getter already does synchronized `initKeyboardRuntime()` + `host.start()`):

```kotlin
    // KickKeyInputMethodService.onCreateInputView()          — already does
    //   val app = application as KickKeyApplication
    //   app.keyboardReactHost    ← triggers init + start on first open
    //
    // FloatingPanelController.show() — ADD before creating the overlay surface:
    //   val host = (context.applicationContext as KickKeyApplication).keyboardReactHost
    //
    // PointerOverlay.show() — ADD the same line before creating the cursor surface:
    //   val host = (context.applicationContext as KickKeyApplication).keyboardReactHost
```

**4c.** Documented tradeoff (keep as a comment in `onCreate`): the **first** keyboard/panel/cursor open after a process start now pays the cold-start cost (~300ms for the bundle + Hermes; the IME watchdog's 8s window absorbs it). Every subsequent open is instant because the host persists for the process lifetime. This is the intended trade: memory (a11y-only process) over first-open latency.

> Optional tunable (off by default): if first-open latency matters more than memory on a given device, re-add a **deferred** pre-warm — `Handler(Looper.getMainLooper()).postDelayed({ if (isImeProcess) keyboardReactHost }, 5000)` — gated additionally on `ActivityManager.MemoryInfo` (≥4GB RAM). Documented here so it can be flipped without code archaeology; the M5 default is strict lazy.

---

### Step 5 — Node-recycle hardening on API < 33

**Edit:** `native-files/java/com/kickkey/KickKeyAccessibilityService.kt`

`performScrollOnFocusedNode` walks the node tree; on API < 33 every `AccessibilityNodeInfo` must be explicitly recycled or the wrappers leak (33+ made `recycle()` a no-op). Replace the M3 version:

```kotlin
    /** Walks up from the focused node performing [action] until one handles it. */
    private fun performScrollOnFocusedNode(action: Int): Boolean {
        val root = rootInActiveWindow ?: return false
        // M5: recycle explicitly below API 33 (33+ auto-refcounts; recycle() is a no-op).
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

Apply the same rule anywhere else the service obtains nodes (e.g., a future `scrollForwardOnNode` walk) — one place to grep: `rootInActiveWindow` / `findFocus` / `.parent`.

---

### Step 6 — `isAccessibilityTool` + Play Console declaration

**6a. Manifest attribute** — `plugins/withAccessibilityService.js`, add to the `<service>` block it injects:

```xml
<service
    android:name=".KickKeyAccessibilityService"
    android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
    android:exported="true"
    android:label="@string/a11y_service_name"
    android:process=":ime_process"
    android:isAccessibilityTool="true">   <!-- M5: mandatory for API 31+ a11y apps -->
    ...
</service>
```

`isAccessibilityTool="true"` is the honest framing (plan §23 recommendation): the touchpad is an **assistive input aid** for users who cannot use direct touch (motor impairment) — not a screen reader, not a scraping tool.

**6b. Play Console declaration** (manual, outside code — document in the repo, e.g. `docs/play-checklist.md`):

1. Play Console → your app → **App content** → **Accessibility**.
2. Complete the **Accessibility Service declaration**:
   - **Purpose**: assistive input aid — a virtual touchpad/mouse (cursor, click, scroll, back) triggered exclusively by explicit user gestures.
   - **Data**: none collected, stored or transmitted; the service reads only window-state/content-changed events (needed to target scroll actions) and never key-logging, touch-exploration or screen-content data.
   - **Policy consent**: confirm you comply with the Accessibility API policy (no deceptive use, user-visible disclosure, user control).
3. Keep the wording **identical in spirit** to the in-app rationale dialog (Step 7) and the privacy policy (Step 8) — reviewers cross-check these.
4. Set the **privacy policy URL** (App content → Privacy policy) to the hosted policy updated in Step 8.

---

### Step 7 — In-app accessibility rationale dialog

**New file:** `components/AccessibilityRationaleDialog.tsx` — a one-time disclosure shown **before** the deep link to `Settings.ACTION_ACCESSIBILITY_SETTINGS` (plan §18: "first-launch dialog explaining what the a11y service does and why, before deep-linking to Settings").

**7a.** Add a persisted flag to `store/settingsStore.ts`:

```ts
  a11yRationaleShown: boolean;          // default false
  setA11yRationaleShown: (v: boolean) => void;
```

**7b.** The dialog (Modal + two actions):

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

**7c.** Wire into `app/(tabs)/settings.tsx` — the Accessibility row now shows the dialog first:

```tsx
  const a11yRationaleShown = useSettingsStore((s) => s.a11yRationaleShown);
  const setA11yRationaleShown = useSettingsStore((s) => s.setA11yRationaleShown);
  const [showRationale, setShowRationale] = useState(false);

  const openA11ySettings = () => {
    if (!a11yRationaleShown) {
      setShowRationale(true);               // disclose once, then deep-link
    } else {
      openAccessibilitySettings();
    }
  };

  // inside the Accessibility card row onPress → openA11ySettings

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

### Step 8 — Privacy-policy section

**Edit:** `privacy-policy.md` (project root — already covers the keyboard/IME and the Android 12+ clipboard toast). Add a section describing the accessibility service and touchpad:

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

Publish the updated policy at the same URL already used for the keyboard policy and set it in the Play Console (Step 6b.4).

---

### Step 9 — Device-matrix test run (§21)

Run the full matrix below and record results (a checklist file, e.g. `docs/m5-device-matrix.md`). Minimum coverage per plan §19/§21:

| Axis | Required cases |
|---|---|
| Android versions | **10 (API 29)**, **12 (API 31)**, **13 (API 33)**, **14 (API 34)** — pro mode only verified on an **Android ≤ 11** device (API 26–30) |
| Navigation | gesture-nav **and** 3-button nav on the same OS version |
| Launcher/OEM | one **stock** device (Pixel) + one **OEM** device (Samsung One UI, Xiaomi MIUI) |
| Form factors | phone, **foldable / multi-window** (overlay + cursor across windows), **landscape** |
| Special apps | **immersive** (video player — overlay behavior), **banking/secure** app (injected touches may be ignored — expected, documented) |
| Lifecycle | a11y service **kill + restart** (Settings → force-stop, reopen), IME process restart, screen **rotation** with the panel open |
| Android 13+ | **restricted settings** flow for sideloads (in-app instructions + deep link) |
| Perf | pointer at 60Hz with no dropped frames (`systrace` / React DevTools), `:ime_process` RAM **< 50MB**, keyboard open **< 80ms** after first warm, suggestions **< 100ms** |

Unit tests (Robolectric, run in CI): gesture-description builders, cursor clamping math, scroll repeat-throttling, pro-mode permission checks (`ProModeInjector.isAvailable` with/without grant), `SurfaceWatchdog` give-up timing. Optional instrumentation: a test-only a11y service verifying `dispatchGesture` callbacks on an emulator.

---

### Step 10 — EN/BN docs pass + `todo.md`

- Review the M1–M5 implementation guides against the **actual final code**; fix any drift (file paths, method names, event names) in both the English and Bangla versions.
- Verify EN/BN parity: every section in the English guide exists in the Bangla guide (and vice versa).
- Update `todo.md` and `ReadMe.md`: mark the touchpad milestones M1–M5 done, note the Play submission status, and link the M4/M5 guides.

---

## 4. Build & Install

```bash
cd react-native-kickKey-deepseek

node scripts/build-keyboard-bundle.js     # keyboard.bundle now has 3 roots
npx expo prebuild --platform android      # withImeService + withAccessibilityService
npx expo run:android                      # dev / release-candidate build

# pro-mode test device only (Android ≤ 11):
adb shell pm grant com.kickkey android.permission.INJECT_EVENTS
```

No new npm dependencies. The watchdog, recycling and lazy-warm changes are all in-tree.

---

## 5. Manual Test Script (M5 exit criteria — §21 matrix)

**Setup:** M1–M4 merged. Run on the matrix from Step 9. The pass condition is the whole matrix green; the table below is the core script each device repeats.

| # | Case | Expected |
|---|---|---|
| 1 | Fresh boot, a11y enabled, **never open the keyboard** | No Hermes load: `adb logcat \| grep -E "KickKeyApplication|Hermes"` shows **no** "Initializing keyboard ReactHost" until a surface is created; `:ime_process` RAM stays small |
| 2 | Tap a text field (first surface after boot) | Keyboard appears (cold start ~300ms OK); watchdog logs "keyboard JS mounted & rendering — OK" within the window |
| 3 | Open the **floating panel** with no field focused | Panel renders; watchdog logs "overlay … — OK"; close → watchdog cancelled |
| 4 | Enable the **cursor** (touchpad mode) | Pointer renders; watchdog logs "pointer … — OK"; cursor moves at 60Hz, no dropped frames |
| 5 | Deliberately break a surface (e.g., `adb shell am force-stop com.kickkey` mid-session, reopen panel) | Watchdog either recovers (remount) or gives up with a logged reason + hides the dead surface — never a stuck invisible window |
| 6 | Scroll in Settings/browser on an **Android 10** device | Scrolling works; logcat shows no `AccessibilityNodeInfo` leak warnings (recycle path active) |
| 7 | Same scroll on **Android 14** | Works; `recycle()` no-ops silently (API 33+) |
| 8 | Settings → Accessibility row (first time) | Rationale dialog appears once; "Continue" deep-links; second tap goes straight to Settings |
| 9 | Play-prepped APK (`eas build -p android`) | Manifest contains `android:isAccessibilityTool="true"`; `INJECT_EVENTS` present but **not** granted; pro-mode card hidden |
| 10 | Privacy policy | Hosted URL returns the updated policy incl. the Accessibility Service & Touchpad section |
| 11 | Full M1–M4 regression (M1/M2/M3/M4 test scripts) | All green — nothing regressed by the hardening |
| 12 | `adb logcat \| grep -E "KickKeySurfaceWatchdog\|KickKeyA11y\|KickKeyApplication"` | No errors across the whole matrix run |

**Pass = the full §21 matrix is green (Android 10/12/13/14 × nav styles × stock/OEM), watchdog give-ups are always logged + recovered, no node leaks on API < 33, RAM < 50MB, and the Play declaration + policy + rationale dialog are consistent.**

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| First keyboard open is ~300ms slower after M5 | Lazy pre-warm (by design) | Expected — subsequent opens are instant; optionally enable the deferred warm (§4c) if a specific device needs it |
| `:ime_process` RAM is high even though the keyboard was never opened | Old pre-warm still present (prebuild not re-run, or the deleted block is still in the APK) | Rebuild + reinstall; verify no "Initializing keyboard ReactHost" log at boot |
| Overlay or cursor shows a blank/invisible surface and never recovers | Surface started, JS never mounted (black-surface class) | Watchdog should force a remount; if it gives up, check `kickkey_forceRerender` listener in the JS root + `surfaceReady` call in its mount effect |
| Watchdog never logs "OK" for the panel | `surfaceReady('overlay')` not called, or `surfaceView()` returns the wrong view | Verify the mount effect fires; verify the watchdog reads the right surface/view |
| Scroll leaks on Android 10 (logcat warnings) | Node recycle path not active | Confirm `Build.VERSION.SDK_INT < 33` branch calls `recycle()`; check the final `root.recycle()` |
| Play Console rejects the declaration | Wording mismatch between dialog / policy / declaration | Align all three on "assistive input aid, user-triggered gestures only, no data" |
| Rationale dialog keeps reappearing | `a11yRationaleShown` not persisted | Check `settingsStore` persistence + the accept handler sets it before deep-linking |
| Watchdog give-ups spam after a surface hide | Watchdog not cancelled on hide | Cancel in `hideFloatingPanel()` / `PointerOverlay.hide()` / IME `onWindowHidden` |

---

## 7. Explicitly Out of Scope for M5 (post-M5)

| Area | Deferred |
|---|---|
| **Play submission** | Actual store listing assets (screenshots, feature graphic, localized descriptions), beta/rollout, release notes — these are release-management tasks, not code |
| **New features** | Double-click / two-finger right-click, `HOME`/`RECENTS`/`Notifications` global buttons, drag-to-scroll from the surface, more pro-mode capabilities on Android 12+ (platform-blocked) |
| **Scale** | Multi-language keyboard layouts beyond EN/BN, cloud sync, accounts — nothing in the touchpad plan |

Also deliberately **not** in M5: changes to the approved gesture behavior, gesture timing, or the a11y event types (that would invalidate the Play declaration).

---

## 8. Definition of Done

- [ ] `KickKeyModule.kt`: `surfaceJsReady` map + `surfaceReady(surface)`; `kickkey_forceRerender` carries the surface name; `keyboardReady()` still works
- [ ] `FloatingPanel.tsx` / `PointerRoot.tsx`: `surfaceReady('overlay'|'pointer')` in a mount effect; bridge wrapper added
- [ ] `SurfaceWatchdog.kt`: generic poll (8s/3s/3 attempts), success = JS-ready + laid-out + has-content, remount on JS-ready-but-empty, give-up callback; cancel-able
- [ ] IME watchdog refactored onto `SurfaceWatchdog` **without losing** host-destroyed detection / `resetKeyboardHostForRetry` / `showErrorFallback`
- [ ] `FloatingPanelController` / `PointerOverlay` start + cancel their watchdogs; service teardown cancels all
- [ ] `KickKeyApplication.onCreate()`: eager pre-warm removed; IME/panel/pointer touch the lazy `keyboardReactHost` before creating surfaces
- [ ] `KickKeyAccessibilityService.kt`: `performScrollOnFocusedNode` recycles nodes + root on API < 33; no other node handles leak
- [ ] `plugins/withAccessibilityService.js`: `android:isAccessibilityTool="true"`
- [ ] Play checklist documented (`docs/play-checklist.md`): declaration wording, policy URL, consistency across dialog/policy/declaration
- [ ] `AccessibilityRationaleDialog.tsx` + `a11yRationaleShown` flag; shown once before the a11y deep link
- [ ] `privacy-policy.md`: "Accessibility Service & Touchpad" section published at the hosted URL
- [ ] §5 test script + §21 device matrix green on Android 10/12/13/14 × gesture-nav/3-button × stock/OEM; RAM < 50MB; 60Hz pointer
- [ ] Robolectric unit tests for gesture builders / clamping / throttle / pro-mode checks / watchdog timing
- [ ] M1–M5 docs (EN + BN) reviewed against final code; `todo.md`/`ReadMe.md` updated

**On completion of all checks → M5 closes the touchpad track. Remaining work is release management (store listing + rollout), not feature or hardening code.**
