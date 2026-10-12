package com.qykey

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.WindowManager
import android.view.accessibility.AccessibilityManager
import android.view.inputmethod.InputConnection
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap

class QyKeyModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        var activeInputConnection: InputConnection? = null
        var hapticManager: HapticManager? = null
        var banglaEngine: BanglaInputEngine? = null
        var suggestionEngine: SuggestionEngine? = null
        var clipboardHandler: ClipboardHandler? = null

        // Set to true when the keyboard JS calls keyboardReady() after mounting.
        // Used by the IME service's startup watchdog to distinguish "rendering OK"
        // from "surface started but JS never mounted".
        // @Volatile: written on the native-modules thread (ReactMethod) and read
        // on the main thread (IME watchdog) — needs cross-thread visibility.
        @Volatile
        var keyboardJsReady: Boolean = false

        // Captured ReactContext when keyboardReady() is called from JS.
        // In RN 0.86's new architecture, host.currentReactContext can return null
        // even after the host reaches RESUMED state (a known issue in headless/IME
        // contexts). Since keyboardReady() is a @ReactMethod, the ReactContext must
        // exist when it runs — storing it here gives the IME watchdog a reliable
        // fallback to directly resume Fabric's DispatchUIFrameCallback.
        // @Volatile: written on the native-modules thread, read on the main thread.
        @Volatile
        var keyboardReactContext: ReactApplicationContext? = null

        // Set to true when the keyboard JS calls notifyPumpActive() from the mount-
        // pipeline pump (a no-op setInterval that keeps the JS event loop alive so the
        // C++ RuntimeScheduler's updateRendering() drains pending Fabric mount
        // transactions — the fix for the children=0 black keyboard). Surfaced in the
        // watchdog error text (jsPump=active) so a residual failure can distinguish
        // "JS fix not deployed" from "pipeline still blocked downstream".
        // @Volatile: written on the native-modules thread, read on the main thread.
        @Volatile
        var keyboardPumpActive: Boolean = false

        // The most recent onInputStarted parameters. Re-emitted by the IME service after
        // a qykey_forceRerender remount, because a remount re-creates the JS keyboard
        // subtree and its input-type state (number/phone/password/imeAction) is reset —
        // without this a number field would show the default QWERTY layout after a remount.
        // @Volatile: written/read on the main thread (IME service).
        @Volatile
        var lastInputStartedParams: ReadableMap? = null

        const val ACTION_PREFERENCES_CHANGED = "com.qykey.PREFERENCES_CHANGED"

        // Bottom inset (dp) the IME window reports for the system navigation
        // bar / gesture bar. Measured in QyKeyInputMethodService (which owns
        // the IME window) and pushed to the keyboard JS like any other
        // preference so the keyboard's bottom padding can lift the last key
        // row above the bar — on Android 15+ the system draws the nav bar
        // over the IME window (edge-to-edge enforcement), and floating-panel
        // windows using FLAG_LAYOUT_IN_SCREEN extend behind it on every
        // version. 0 = nothing overlaps the keyboard.
        // @Volatile: written on the main thread (IME), read on the RN thread.
        @Volatile
        var imeNavBarInsetDp: Int = 0

        fun emitPreferences(reactContext: ReactApplicationContext?, prefMap: ReadableMap?) {
            if (reactContext == null || prefMap == null) return
            try {
                reactContext
                    .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("qykey_preferencesChanged", prefMap)
            } catch (e: Exception) {
                Log.w("QyKeyModule", "Failed to emit qykey_preferencesChanged: ${e.message}")
            }
        }

        fun emitPreferencesFromBundle(reactContext: ReactApplicationContext?, bundle: android.os.Bundle?) {
            if (reactContext == null || bundle == null) return
            try {
                val map = Arguments.createMap()
                for (key in bundle.keySet()) {
                    when (val v = bundle.get(key)) {
                        is String -> map.putString(key, v)
                        is Boolean -> map.putBoolean(key, v)
                        is Int -> map.putInt(key, v)
                        is Double -> map.putDouble(key, v)
                    }
                }
                reactContext
                    .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("qykey_preferencesChanged", map)
            } catch (e: Exception) {
                Log.w("QyKeyModule", "Failed to emit preferences from bundle: ${e.message}")
            }
        }

        fun emitCurrentPreferences(reactContext: ReactApplicationContext?, context: Context) {
            if (reactContext == null) return
            try {
                val prefs = context.getSharedPreferences("qykey_prefs", Context.MODE_PRIVATE)
                val map = Arguments.createMap().apply {
                    putString("language",        prefs.getString("language",        "en")      ?: "en")
                    putString("theme",           prefs.getString("theme",           "system")  ?: "system")
                    putString("keyboardBg",      prefs.getString("keyboardBg",      "#e0e5ec") ?: "#e0e5ec")
                    putString("themeKeyBg",      prefs.getString("themeKeyBg",      "#f2f2f2") ?: "#f2f2f2")
                    putString("themeKeyText",    prefs.getString("themeKeyText",    "#444444") ?: "#444444")
                    putString("specialKeyBg",    prefs.getString("specialKeyBg",   "#c8ccd0") ?: "#c8ccd0")
                    putString("specialKeyText",  prefs.getString("specialKeyText",  "#444444") ?: "#444444")
                    putString("themePrimary",    prefs.getString("themePrimary",   "#8594aa") ?: "#8594aa")
                    putInt("keyHeight",          prefs.getInt("keyHeight",        26))
                    putInt("keyBorderRadius",     prefs.getInt("keyBorderRadius",   8))
                    putInt("fontSize",          prefs.getInt("fontSize",          14))
                    putInt("keyMargin",          prefs.getInt("keyMargin",          3))
                    putInt("navBarBottomInset",  imeNavBarInsetDp)
                    putBoolean("hapticEnabled",   prefs.getBoolean("hapticEnabled",  true))
                    putBoolean("soundEnabled",    prefs.getBoolean("soundEnabled",   false))
                    putBoolean("autoCorrect",     prefs.getBoolean("autoCorrect",    true))
                    putBoolean("showSuggestions", prefs.getBoolean("showSuggestions",true))
                }
                reactContext
                    .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("qykey_preferencesChanged", map)
            } catch (e: Exception) {
                Log.w("QyKeyModule", "Failed to emit current preferences: ${e.message}")
            }
        }
    }

    override fun getName(): String = "QyKey"

    // Required by NativeEventEmitter in React Native
    @ReactMethod
    fun addListener(eventType: String) {
        Log.d("QyKeyModule", "addListener: $eventType")
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        Log.d("QyKeyModule", "removeListeners: $count")
    }

    @ReactMethod
    fun keyboardReady(promise: Promise) {
        keyboardJsReady = true
        // Capture the ReactContext while it definitely exists (we're inside a
        // @ReactMethod, so the bridge/context is live). The IME watchdog uses this
        // fallback when host.currentReactContext returns null (RN 0.86 headless bug).
        keyboardReactContext = reactApplicationContext
        emitCurrentPreferences(reactApplicationContext, reactApplicationContext)
        Log.i("QyKeyModule", "JS keyboard mounted and ready — React surface is rendering")
        promise.resolve(null)
    }

    @ReactMethod
    fun notifyPumpActive(promise: Promise) {
        keyboardPumpActive = true
        promise.resolve(null)
    }

    /**
     * JS keyboard reports its natural (unclamped) content height in px so the
     * IME window can auto-fit (see QyKeyInputMethodService.keyboardHeightPx).
     * Native re-clamps to sane dp bounds, so a bogus report can't break layout.
     */
    @ReactMethod
    fun reportKeyboardContentHeight(heightPx: Double, promise: Promise) {
        val px = heightPx.toInt()
        if (px > 0) {
            // Route to BOTH hosts: the IME keyboard window and the a11y floating
            // panel can be active independently (the panel works without the IME),
            // and each is responsible for sizing its own window. Reports are
            // idempotent (same natural height from the same bundle UI).
            QyKeyInputMethodService.instance?.onContentHeightReported(px)
            QyKeyAccessibilityService.instance?.onContentHeightReported(px)
        }
        promise.resolve(null)
    }

    private fun getInputConnection(): InputConnection? {
        return activeInputConnection ?: QyKeyInputMethodService.instance?.currentInputConnection
    }

    @ReactMethod
    fun commitKey(code: String, language: String, promise: Promise) {
        val ic = getInputConnection()
        if (ic != null) {
            if (language == "bn" && code.isNotEmpty()) {
                val banglaResult = banglaEngine?.processKey(code) ?: code
                if (banglaResult.isNotEmpty()) {
                    ic.beginBatchEdit()
                    ic.commitText(banglaResult, 1)
                    ic.endBatchEdit()
                    suggestionEngine?.onCharacterTyped()
                }
            } else if (code.isNotEmpty()) {
                ic.beginBatchEdit()
                ic.commitText(code, 1)
                ic.endBatchEdit()
                suggestionEngine?.onCharacterTyped()
            }
            hapticManager?.vibrate()
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun sendBackspace(promise: Promise) {
        val engine = banglaEngine
        val consumedByBuffer = engine?.onBackspace() ?: false
        val deleted: Boolean
        if (consumedByBuffer) {
            // The Bangla phonetic buffer consumed the backspace — something was removed.
            deleted = true
        } else {
            deleted = deleteGraphemeBeforeCursor(getInputConnection())
            suggestionEngine?.onBackspace()
        }
        // Only give tactile feedback when something was actually deleted — holding
        // backspace on an empty field must not keep buzzing pointlessly.
        if (deleted) hapticManager?.vibrate()
        // Resolve with whether anything was deleted so the JS auto-repeat can stop
        // as soon as the field is empty (stops the pointless repeat + vibration).
        promise.resolve(deleted)
    }

    /**
     * Deletes the full grapheme cluster before the cursor, not a single UTF-16
     * code unit. Emoji are surrogate pairs (2 units) or ZWJ sequences (up to
     * ~11 units) — deleting one unit leaves a lone surrogate that the editor
     * shows as a stray "unicode" character and forces a second backspace to
     * finish the job (the reported emoji deletion bug). ICU BreakIterator
     * (API 24+, below RN 0.86's minSdk of 24) treats ZWJ families like
     * 👨‍👩‍👧‍👦 as ONE cluster, so a single backspace removes the whole emoji,
     * matching Ridmik/Gboard behavior.
     *
     * In AnyDesk/TeamViewer/RDP sessions, getTextBeforeCursor is null or empty
     * because the remote desktop has no local text buffer. When that happens,
     * this falls back to sending low-level KEYCODE_DEL down/up events with
     * virtual keyboard flags so the remote PC deletes characters properly.
     *
     * @return true if a grapheme or key event was dispatched.
     */
    private fun deleteGraphemeBeforeCursor(ic: InputConnection?): Boolean {
        if (ic == null) return false
        val before = ic.getTextBeforeCursor(32, 0)
        if (before != null && before.isNotEmpty()) {
            val iterator = android.icu.text.BreakIterator.getCharacterInstance(java.util.Locale.ROOT)
            iterator.setText(before.toString())
            val lastBoundary = iterator.last()
            val clusterStart = iterator.previous()
            if (clusterStart != android.icu.text.BreakIterator.DONE) {
                val toDelete = lastBoundary - clusterStart
                if (toDelete > 0 && ic.deleteSurroundingText(toDelete, 0)) {
                    return true
                }
            }
        }
        // Fallback for remote desktop (AnyDesk, TeamViewer), terminals, and non-text views:
        // When there is no local text buffer or deleteSurroundingText is unhandled,
        // send hardware KEYCODE_DEL down/up events with virtual keyboard flags.
        val now = SystemClock.uptimeMillis()
        val flags = KeyEvent.FLAG_SOFT_KEYBOARD or KeyEvent.FLAG_KEEP_TOUCH_MODE
        val deviceId = android.view.KeyCharacterMap.VIRTUAL_KEYBOARD
        ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DEL, 0, 0, deviceId, 0, flags))
        ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DEL, 0, 0, deviceId, 0, flags))
        return true
    }

    @ReactMethod
    fun commitSpace(promise: Promise) {
        val ic = getInputConnection()
        if (ic != null) {
            val pending = banglaEngine?.flush() ?: ""
            if (pending.isNotEmpty()) {
                ic.beginBatchEdit()
                ic.commitText(pending, 1)
                ic.endBatchEdit()
                suggestionEngine?.onCharacterTyped()
            }

            ic.beginBatchEdit()
            val top = suggestionEngine?.getTopSuggestion()
            if (top != null) {
                val currentWord = suggestionEngine!!.getCurrentWord()
                if (currentWord.isNotEmpty() && currentWord != top) {
                    ic.deleteSurroundingText(currentWord.length, 0)
                    ic.commitText("$top ", 1)
                    suggestionEngine?.onWordCommitted(top)
                } else {
                    ic.commitText(" ", 1)
                }
            } else {
                ic.commitText(" ", 1)
            }
            ic.endBatchEdit()
            hapticManager?.vibrate()
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun commitSuggestion(word: String, promise: Promise) {
        val ic = getInputConnection()
        if (ic != null) {
            val currentWord = suggestionEngine?.getCurrentWord() ?: ""
            ic.beginBatchEdit()
            if (currentWord.isNotEmpty()) {
                ic.deleteSurroundingText(currentWord.length, 0)
            }
            ic.commitText("$word ", 1)
            ic.endBatchEdit()

            suggestionEngine?.onWordCommitted(word)
            hapticManager?.vibrate()
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun commitText(text: String, promise: Promise) {
        val ic = getInputConnection()
        if (ic != null && text.isNotEmpty()) {
            // Flush any pending bangla phonetic buffer first so dictation text
            // never mixes with an uncommitted Roman buffer.
            val pending = banglaEngine?.flush() ?: ""
            ic.beginBatchEdit()
            if (pending.isNotEmpty()) ic.commitText(pending, 1)
            ic.commitText("$text ", 1)
            ic.endBatchEdit()
            suggestionEngine?.onWordCommitted(text)
            hapticManager?.vibrate()
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun flushBanglaBuffer(promise: Promise) {
        val ic = getInputConnection()
        if (ic != null) {
            val pending = banglaEngine?.flush() ?: ""
            if (pending.isNotEmpty()) {
                ic.beginBatchEdit()
                ic.commitText(pending, 1)
                ic.endBatchEdit()
            }
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun setBanglaEnabled(enabled: Boolean, promise: Promise) {
        if (!enabled) banglaEngine?.reset()
        promise.resolve(null)
    }

    @ReactMethod
    fun sendEnter(promise: Promise) {
        val ic = getInputConnection()
        if (ic != null) {
            val pending = banglaEngine?.flush() ?: ""
            if (pending.isNotEmpty()) {
                ic.beginBatchEdit()
                ic.commitText(pending, 1)
                ic.endBatchEdit()
            }
            sendKeyEvents(listOf(KeyEvent.KEYCODE_ENTER))

            suggestionEngine?.onWordCommitted(suggestionEngine?.getCurrentWord() ?: "")
            hapticManager?.vibrate()
        }
        promise.resolve(null)
    }

    /**
     * Sends down+up KeyEvent pairs for each keycode with the given meta state
     * (PC-style: remote-desktop hosts such as AnyDesk forward these to the
     * computer, and focusable apps receive them locally).
     */
    private fun sendKeyEvents(keyCodes: List<Int>, metaState: Int = 0) {
        val ic = getInputConnection() ?: return
        val flags = KeyEvent.FLAG_SOFT_KEYBOARD or KeyEvent.FLAG_KEEP_TOUCH_MODE
        val deviceId = android.view.KeyCharacterMap.VIRTUAL_KEYBOARD
        for (keyCode in keyCodes) {
            val now = SystemClock.uptimeMillis()
            ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0, metaState, deviceId, 0, flags))
            ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, keyCode, 0, metaState, deviceId, 0, flags))
        }
    }

    /** Maps a single character to its Android keycode (null when unmappable). */
    private fun keyCodeForCharacter(c: Char): Int? = when (c) {
        in 'a'..'z' -> KeyEvent.KEYCODE_A + (c - 'a')
        in 'A'..'Z' -> KeyEvent.KEYCODE_A + (c - 'A')
        in '0'..'9' -> KeyEvent.KEYCODE_0 + (c - '0')
        ' ' -> KeyEvent.KEYCODE_SPACE
        '\n' -> KeyEvent.KEYCODE_ENTER
        '\t' -> KeyEvent.KEYCODE_TAB
        '-' -> KeyEvent.KEYCODE_MINUS
        '=' -> KeyEvent.KEYCODE_EQUALS
        '+' -> KeyEvent.KEYCODE_PLUS
        '*' -> KeyEvent.KEYCODE_STAR
        '#' -> KeyEvent.KEYCODE_POUND
        '@' -> KeyEvent.KEYCODE_AT
        '[' -> KeyEvent.KEYCODE_LEFT_BRACKET
        ']' -> KeyEvent.KEYCODE_RIGHT_BRACKET
        '\\' -> KeyEvent.KEYCODE_BACKSLASH
        ';' -> KeyEvent.KEYCODE_SEMICOLON
        '\'' -> KeyEvent.KEYCODE_APOSTROPHE
        '/' -> KeyEvent.KEYCODE_SLASH
        '.' -> KeyEvent.KEYCODE_PERIOD
        ',' -> KeyEvent.KEYCODE_COMMA
        '`' -> KeyEvent.KEYCODE_GRAVE
        else -> null
    }

    /** Maps a named key ("tab", "f5", "pagedown"…) to its Android keycode. */
    private fun namedKeyCode(name: String): Int? = when {
        name == "tab" -> KeyEvent.KEYCODE_TAB
        name == "esc" || name == "escape" -> KeyEvent.KEYCODE_ESCAPE
        name == "enter" || name == "return" -> KeyEvent.KEYCODE_ENTER
        name == "space" -> KeyEvent.KEYCODE_SPACE
        name == "left" -> KeyEvent.KEYCODE_DPAD_LEFT
        name == "right" -> KeyEvent.KEYCODE_DPAD_RIGHT
        name == "up" -> KeyEvent.KEYCODE_DPAD_UP
        name == "down" -> KeyEvent.KEYCODE_DPAD_DOWN
        name == "del" || name == "delete" || name == "forward_del" -> KeyEvent.KEYCODE_FORWARD_DEL
        name == "backspace" || name == "bksp" -> KeyEvent.KEYCODE_DEL
        name == "home" -> KeyEvent.KEYCODE_MOVE_HOME
        name == "end" -> KeyEvent.KEYCODE_MOVE_END
        name == "pageup" -> KeyEvent.KEYCODE_PAGE_UP
        name == "pagedown" || name == "pgdn" -> KeyEvent.KEYCODE_PAGE_DOWN
        name == "insert" -> KeyEvent.KEYCODE_INSERT
        name == "printscreen" || name == "sysrq" || name == "prtsc" -> KeyEvent.KEYCODE_SYSRQ
        name == "scrolllock" || name == "scrlck" -> KeyEvent.KEYCODE_SCROLL_LOCK
        name == "pause" || name == "break" -> KeyEvent.KEYCODE_BREAK
        name == "caps_lock" || name == "capslock" -> KeyEvent.KEYCODE_CAPS_LOCK
        name == "search" -> KeyEvent.KEYCODE_SEARCH
        name == "brightness_up" -> KeyEvent.KEYCODE_BRIGHTNESS_UP
        name == "brightness_down" -> KeyEvent.KEYCODE_BRIGHTNESS_DOWN
        name.startsWith("f") -> name.substring(1).toIntOrNull()
            ?.takeIf { it in 1..12 }
            ?.let { KeyEvent.KEYCODE_F1 + it - 1 }   // KEYCODE_F1..F12 are consecutive
        else -> null
    }

    @ReactMethod
    fun sendSpecialKey(key: String, promise: Promise) {
        val ic = getInputConnection()
        if (ic != null) {
            when (val k = key.lowercase()) {
                "select_all", "ctrl_a" -> ic.performContextMenuAction(android.R.id.selectAll)
                "copy", "ctrl_c" -> ic.performContextMenuAction(android.R.id.copy)
                "paste", "ctrl_v" -> ic.performContextMenuAction(android.R.id.paste)
                "cut", "ctrl_x" -> ic.performContextMenuAction(android.R.id.cut)
                "volume_up" -> {
                    // Local effect via AudioManager (injected VOLUME keycodes are
                    // filtered by the system), plus the raw keycode so remote
                    // desktops forward the PC volume change.
                    val am = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                    am?.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI)
                    sendKeyEvents(listOf(KeyEvent.KEYCODE_VOLUME_UP))
                }
                "volume_down" -> {
                    val am = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                    am?.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI)
                    sendKeyEvents(listOf(KeyEvent.KEYCODE_VOLUME_DOWN))
                }
                "volume_mute" -> {
                    val am = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                    am?.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_TOGGLE_MUTE, AudioManager.FLAG_SHOW_UI)
                    sendKeyEvents(listOf(KeyEvent.KEYCODE_VOLUME_MUTE))
                }
                "settings" -> {
                    // Smart action: open Android Settings.
                    try {
                        reactApplicationContext.startActivity(
                            Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        )
                    } catch (e: Exception) {
                        Log.w("QyKeyModule", "open settings failed: ${e.message}")
                    }
                }
                "power" -> {
                    // Smart action: lock the screen via the accessibility service
                    // (API 28+); fall back to the raw POWER keycode (remote hosts).
                    val svc = QyKeyAccessibilityService.instance
                    if (svc != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        svc.performGlobalAction(AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN)
                    } else {
                        sendKeyEvents(listOf(KeyEvent.KEYCODE_POWER))
                    }
                }
                "ctrl", "alt", "meta", "win", "⊞" -> {
                    // A lone modifier tap sends a quick down/up (like a physical PC keyboard, e.g. Win -> Start menu).
                    // Real combos go through sendKeyCombo (JS modifier latch).
                    val keyCode = when (k) {
                        "ctrl" -> KeyEvent.KEYCODE_CTRL_LEFT
                        "alt" -> KeyEvent.KEYCODE_ALT_LEFT
                        else -> KeyEvent.KEYCODE_META_LEFT
                    }
                    sendKeyEvents(listOf(keyCode))
                }
                "caps_lock", "capslock" -> {
                    sendKeyEvents(listOf(KeyEvent.KEYCODE_CAPS_LOCK))
                }
                else -> {
                    // F1-F12, PrtSc, ScrLck, Pause, Insert, Del, Home, End,
                    // PgUp/PgDn, Tab, Esc, search, brightness… → real keycodes.
                    val keyCode = namedKeyCode(k)
                    if (keyCode != null) {
                        sendKeyEvents(listOf(keyCode))
                    } else {
                        ic.commitText(key, 1)
                    }
                }
            }
            hapticManager?.vibrate()
        }
        promise.resolve(null)
    }

    /**
     * Sends a PC-style key combo with modifier keycodes and meta state held down:
     * Ctrl+C, Alt+Tab, Ctrl+Shift+S, Win+D, Win+R, Ctrl+Alt+Del, …
     *
     * Injects hardware-style modifier ACTION_DOWN before the key, and modifier
     * ACTION_UP after the key, while synchronously maintaining the meta bitmask.
     * This guarantees that remote-desktop hosts (AnyDesk, TeamViewer, RDP, VNC)
     * register real physical PC key chords and translate them to the remote OS.
     *
     * modifiers: comma-separated subset of "ctrl", "shift", "alt", "meta", "win"
     * key:       a single character (letter/digit/symbol) or a named key
     *            ("tab", "esc", "left", "f5", …).
     */
    @ReactMethod
    fun sendKeyCombo(modifiers: String, key: String, promise: Promise) {
        val ic = getInputConnection()
        if (ic == null) {
            promise.resolve(null)
            return
        }
        var meta = 0
        val modKeyCodes = mutableListOf<Int>()
        modifiers.lowercase().split(",").map { it.trim() }.filter { it.isNotEmpty() }.forEach { m ->
            when (m) {
                "ctrl" -> {
                    meta = meta or (KeyEvent.META_CTRL_ON or KeyEvent.META_CTRL_LEFT_ON)
                    modKeyCodes.add(KeyEvent.KEYCODE_CTRL_LEFT)
                }
                "shift" -> {
                    meta = meta or (KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON)
                    modKeyCodes.add(KeyEvent.KEYCODE_SHIFT_LEFT)
                }
                "alt" -> {
                    meta = meta or (KeyEvent.META_ALT_ON or KeyEvent.META_ALT_LEFT_ON)
                    modKeyCodes.add(KeyEvent.KEYCODE_ALT_LEFT)
                }
                "meta", "win" -> {
                    meta = meta or (KeyEvent.META_META_ON or KeyEvent.META_META_LEFT_ON)
                    modKeyCodes.add(KeyEvent.KEYCODE_META_LEFT)
                }
            }
        }
        val keyCode: Int? = if (key.length == 1) keyCodeForCharacter(key[0]) else namedKeyCode(key.lowercase())
        if (keyCode != null) {
            val now = SystemClock.uptimeMillis()
            val flags = KeyEvent.FLAG_SOFT_KEYBOARD or KeyEvent.FLAG_KEEP_TOUCH_MODE
            val deviceId = android.view.KeyCharacterMap.VIRTUAL_KEYBOARD

            // 1. Press down modifiers (in order) so remote desktop hosts register key chord
            var runningMeta = 0
            for (modCode in modKeyCodes) {
                runningMeta = runningMeta or when (modCode) {
                    KeyEvent.KEYCODE_CTRL_LEFT -> KeyEvent.META_CTRL_ON or KeyEvent.META_CTRL_LEFT_ON
                    KeyEvent.KEYCODE_SHIFT_LEFT -> KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON
                    KeyEvent.KEYCODE_ALT_LEFT -> KeyEvent.META_ALT_ON or KeyEvent.META_ALT_LEFT_ON
                    KeyEvent.KEYCODE_META_LEFT -> KeyEvent.META_META_ON or KeyEvent.META_META_LEFT_ON
                    else -> 0
                }
                ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, modCode, 0, runningMeta, deviceId, 0, flags))
            }

            // 2. Press down and release main key with full cumulative meta
            ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0, meta, deviceId, 0, flags))
            ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, keyCode, 0, meta, deviceId, 0, flags))

            // 3. Release modifiers in reverse order
            for (modCode in modKeyCodes.asReversed()) {
                ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, modCode, 0, runningMeta, deviceId, 0, flags))
                runningMeta = runningMeta and when (modCode) {
                    KeyEvent.KEYCODE_CTRL_LEFT -> (KeyEvent.META_CTRL_ON or KeyEvent.META_CTRL_LEFT_ON).inv()
                    KeyEvent.KEYCODE_SHIFT_LEFT -> (KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON).inv()
                    KeyEvent.KEYCODE_ALT_LEFT -> (KeyEvent.META_ALT_ON or KeyEvent.META_ALT_LEFT_ON).inv()
                    KeyEvent.KEYCODE_META_LEFT -> (KeyEvent.META_META_ON or KeyEvent.META_META_LEFT_ON).inv()
                    else -> 0.inv()
                }
            }
        } else {
            // Unmappable key (e.g. Bangla glyph): commit raw text, no modifiers.
            ic.commitText(key, 1)
        }
        hapticManager?.vibrate()
        promise.resolve(null)
    }

    // ── Touchpad: cursor movement ─────────────────────────────────────────────
    //
    // Called repeatedly while the user drags on the touchpad surface.
    // direction: "left" | "right" | "up" | "down"
    // Each call sends one DPAD key event so JS controls the repeat rate.

    @ReactMethod
    fun moveCursor(direction: String, promise: Promise) {
        val ic = getInputConnection()
        if (ic != null) {
            val keyCode = when (direction) {
                "left"  -> KeyEvent.KEYCODE_DPAD_LEFT
                "right" -> KeyEvent.KEYCODE_DPAD_RIGHT
                "up"    -> KeyEvent.KEYCODE_DPAD_UP
                "down"  -> KeyEvent.KEYCODE_DPAD_DOWN
                else    -> { promise.resolve(null); return }
            }
            sendKeyEvents(listOf(keyCode))
            hapticManager?.vibrate()
        }
        promise.resolve(null)
    }

    // ── Touchpad: scroll ──────────────────────────────────────────────────────
    //
    // direction: "up" | "down"
    // M3: service-first (node scroll / swipe), InputConnection fallback.

    @ReactMethod
    fun scrollPage(direction: String, promise: Promise) {
        val svc = QyKeyAccessibilityService.instance
        Handler(Looper.getMainLooper()).post {
            if (svc != null) {
                svc.scrollAt(direction, PointerOverlay.cursorX, PointerOverlay.cursorY)
            } else {
                val ic = getInputConnection()
                if (ic != null) {
                    val keyCode = if (direction == "up") KeyEvent.KEYCODE_PAGE_UP
                                  else                   KeyEvent.KEYCODE_PAGE_DOWN
                    sendKeyEvents(listOf(keyCode))
                    hapticManager?.vibrate()
                }
            }
            promise.resolve(null)
        }
    }

    // ── Touchpad: nav backward / forward ─────────────────────────────────────
    //
    // direction: "backward" | "forward"
    // M3: service-first (GLOBAL_ACTION_BACK / scroll-forward), DPAD fallback.
    // Now resolves Boolean: true = handled, false = unsupported.

    @ReactMethod
    fun navigateHistory(direction: String, promise: Promise) {
        val svc = QyKeyAccessibilityService.instance
        Handler(Looper.getMainLooper()).post {
            if (direction == "backward") {
                val handled = if (svc != null) {
                    svc.navigateBack()
                } else {
                    // Fallback: ALT + DPAD_LEFT (word-left / history-back).
                    val ic = getInputConnection()
                    if (ic != null) {
                        val metaState = KeyEvent.META_ALT_ON or KeyEvent.META_ALT_LEFT_ON
                        sendKeyEvents(listOf(KeyEvent.KEYCODE_DPAD_LEFT), metaState)
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

    // ── Touchpad: mouse L / R buttons ─────────────────────────────────────────
    //
    // button: "left" | "right"
    // M3: service-first (tapAt / longPressAt at cursor), InputConnection fallback.

    @ReactMethod
    fun mouseClick(button: String, promise: Promise) {
        val svc = QyKeyAccessibilityService.instance
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
                val ic = getInputConnection()
                if (ic != null) {
                    val keyCode = if (button == "left") KeyEvent.KEYCODE_DPAD_CENTER else KeyEvent.KEYCODE_MENU
                    sendKeyEvents(listOf(keyCode))
                    hapticManager?.vibrate()
                }
            }
            promise.resolve(null)
        }
    }

    // ── Touchpad: on-screen mouse pointer overlay (M2 — RN cursor) ──────────
    //
    // The cursor is now a React Native surface ("QyKeyPointer") managed by
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
            QyKeyAccessibilityService.instance?.onDragDelta(dx.toFloat(), dy.toFloat())
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

    /**
     * Nudge from JS: re-measure the keyboard container and re-snap the red
     * overlay's bottom edge to the keyboard's real top. The measured Y of the
     * keyboard container (see PointerOverlay.getMeasuredKeyboardTopY) is the
     * single source of truth — [yPx] is intentionally unused, kept only for
     * API compatibility with the existing JS bridge.
     */
    @ReactMethod
    fun pointerSetOverlayTopY(yPx: Double, promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            PointerOverlay.updateOverlayBounds()
            promise.resolve(null)
        }
    }

    // ── Touchpad: IME strip mode + drag (M3) ───────────────────────────────

    /** Shrinks the IME window to a thin strip while the touchpad tab is active. */
    @ReactMethod
    fun setTouchpadMode(on: Boolean, promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            QyKeyInputMethodService.instance?.setTouchpadStripMode(on)
            promise.resolve(null)
        }
    }

    /** L button pressed — arm a drag at the cursor's current position. */
    @ReactMethod
    fun dragStart(promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            QyKeyAccessibilityService.instance?.beginDrag()
            promise.resolve(null)
        }
    }

    /** L button released — dispatch a drag stroke, or a tap if nothing moved. */
    @ReactMethod
    fun dragEnd(promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            QyKeyAccessibilityService.instance?.endDrag()
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun isOverlayGranted(promise: Promise) {
        val context = reactApplicationContext
        promise.resolve(Settings.canDrawOverlays(context))
    }

    @ReactMethod
    fun openOverlaySettings(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.w("QyKeyModule", "openOverlaySettings failed: ${e.message}")
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun getClipboardHistory(promise: Promise) {
        val history = clipboardHandler?.getHistory() ?: emptyList()
        val array = Arguments.createArray()
        history.forEach { array.pushString(it) }
        promise.resolve(array)
    }

    @ReactMethod
    fun clearClipboardHistory(promise: Promise) {
        clipboardHandler?.clearHistory()
        promise.resolve(null)
    }

    @ReactMethod
    fun removeClipboardItem(text: String, promise: Promise) {
        clipboardHandler?.removeItem(text)
        promise.resolve(null)
    }

    @ReactMethod
    fun getRecentEmojis(promise: Promise) {
        val list = clipboardHandler?.getRecentEmojis() ?: emptyList()
        val array = Arguments.createArray()
        list.forEach { array.pushString(it) }
        promise.resolve(array)
    }

    @ReactMethod
    fun recordEmojiUsed(emoji: String, promise: Promise) {
        clipboardHandler?.recordEmojiUsed(emoji)
        promise.resolve(null)
    }

    @ReactMethod
    fun playKeySound(promise: Promise) {
        val context = reactApplicationContext
        val soundEnabled = context
            .getSharedPreferences("qykey_prefs", Context.MODE_PRIVATE)
            .getBoolean("soundEnabled", false)
        if (soundEnabled) {
            try {
                val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                am.playSoundEffect(AudioManager.FX_KEYPRESS_STANDARD, -1f)
            } catch (e: Exception) {
                Log.w("QyKeyModule", "Sound effect failed: ${e.message}")
            }
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun setDictionaryWords(words: ReadableArray, promise: Promise) {
        val context = reactApplicationContext
        val list = mutableListOf<String>()
        for (i in 0 until words.size()) {
            words.getString(i)?.let { list.add(it) }
        }
        val serialized = list.joinToString("\n")
        context.getSharedPreferences("qykey_dictionary", Context.MODE_PRIVATE)
            .edit()
            .putString("custom_words", serialized)
            .apply()
        promise.resolve(null)
    }

    @ReactMethod
    fun getDictionaryWords(promise: Promise) {
        val context = reactApplicationContext
        val raw = context.getSharedPreferences("qykey_dictionary", Context.MODE_PRIVATE)
            .getString("custom_words", "") ?: ""
        val array = Arguments.createArray()
        if (raw.isNotEmpty()) {
            raw.split("\n").forEach { array.pushString(it) }
        }
        promise.resolve(array)
    }

    @ReactMethod
    fun removeDictionaryWord(word: String, promise: Promise) {
        val context = reactApplicationContext
        val prefs = context.getSharedPreferences("qykey_dictionary", Context.MODE_PRIVATE)
        val raw = prefs.getString("custom_words", "") ?: ""
        val updated = raw.split("\n").filter { it != word && it.isNotBlank() }
        prefs.edit().putString("custom_words", updated.joinToString("\n")).apply()
        promise.resolve(null)
    }

    /**
     * Replaces the entire per-language custom dictionary ("en" / "bn"). The
     * SuggestionEngine caches the words in memory, so it reloads right away when
     * it lives in this process (it is null in the companion app process).
     */
    @ReactMethod
    fun setCustomDictionary(enWords: ReadableArray?, bnWords: ReadableArray?, promise: Promise) {
        reactApplicationContext
            .getSharedPreferences("qykey_dictionary", Context.MODE_PRIVATE)
            .edit()
            .putString("custom_words_en", readableArrayToList(enWords).joinToString("\n"))
            .putString("custom_words_bn", readableArrayToList(bnWords).joinToString("\n"))
            .apply()
        suggestionEngine?.reloadCustomWords()
        promise.resolve(null)
    }

    /** Returns the custom dictionary words stored for [lang] ("en" or "bn"). */
    @ReactMethod
    fun getCustomDictionary(lang: String, promise: Promise) {
        val key = if (lang == "bn") "custom_words_bn" else "custom_words_en"
        val raw = reactApplicationContext
            .getSharedPreferences("qykey_dictionary", Context.MODE_PRIVATE)
            .getString(key, "") ?: ""
        val array = Arguments.createArray()
        if (raw.isNotEmpty()) {
            raw.split("\n").forEach { array.pushString(it) }
        }
        promise.resolve(array)
    }

    private fun readableArrayToList(array: ReadableArray?): List<String> {
        if (array == null) return emptyList()
        val list = mutableListOf<String>()
        for (i in 0 until array.size()) {
            array.getString(i)?.let { list.add(it) }
        }
        return list
    }

    @ReactMethod
    fun getPreferences(promise: Promise) {
        val context = reactApplicationContext
        val prefs = context.getSharedPreferences("qykey_prefs", Context.MODE_PRIVATE)
        val map = Arguments.createMap().apply {
            putString("language",        prefs.getString("language",        "en")      ?: "en")
            putString("theme",           prefs.getString("theme",           "system")  ?: "system")
            putString("keyboardBg",      prefs.getString("keyboardBg",      "#e0e5ec") ?: "#e0e5ec")
            putString("themeKeyBg",      prefs.getString("themeKeyBg",      "#f2f2f2") ?: "#f2f2f2")
            putString("themeKeyText",    prefs.getString("themeKeyText",    "#444444") ?: "#444444")
            putString("specialKeyBg",    prefs.getString("specialKeyBg",   "#c8ccd0") ?: "#c8ccd0")
            putString("specialKeyText",  prefs.getString("specialKeyText",  "#444444") ?: "#444444")
            putString("themePrimary",    prefs.getString("themePrimary",   "#8594aa") ?: "#8594aa")
            putInt("keyHeight",          prefs.getInt("keyHeight",        26))
            putInt("keyBorderRadius",     prefs.getInt("keyBorderRadius",   8))
            putInt("fontSize",          prefs.getInt("fontSize",          14))
            putInt("keyMargin",          prefs.getInt("keyMargin",          3))
            putInt("navBarBottomInset",  imeNavBarInsetDp)
            putBoolean("hapticEnabled",   prefs.getBoolean("hapticEnabled",  true))
            putBoolean("soundEnabled",    prefs.getBoolean("soundEnabled",   false))
            putBoolean("autoCorrect",     prefs.getBoolean("autoCorrect",    true))
            putBoolean("showSuggestions", prefs.getBoolean("showSuggestions",true))
            putString("cursorType",      prefs.getString("cursorType",      "cursor-pointer-classic") ?: "cursor-pointer-classic")
            putString("cursorColor",     prefs.getString("cursorColor",     "#8594aa")               ?: "#8594aa")
            putInt("cursorSize",         prefs.getInt("cursorSize",        24))
        }
        promise.resolve(map)
    }

    @ReactMethod
    fun savePreferences(prefMap: ReadableMap, promise: Promise) {
        val context = reactApplicationContext
        val editor = context
            .getSharedPreferences("qykey_prefs", Context.MODE_PRIVATE)
            .edit()

        val bundle = android.os.Bundle()
        val entryIterator = prefMap.entryIterator
        while (entryIterator.hasNext()) {
            val entry = entryIterator.next()
            val key = entry.key
            when (val value = entry.value) {
                is String  -> {
                    editor.putString(key, value)
                    bundle.putString(key, value)
                }
                is Boolean -> {
                    editor.putBoolean(key, value)
                    bundle.putBoolean(key, value)
                }
                is Double  -> {
                    editor.putInt(key, value.toInt())
                    bundle.putInt(key, value.toInt())
                }
                is Int     -> {
                    editor.putInt(key, value)
                    bundle.putInt(key, value)
                }
            }
        }
        editor.commit()

        // 1. Emit locally to ReactContext in current process
        emitPreferences(reactApplicationContext, prefMap)

        // 2. Broadcast across processes to :ime_process
        try {
            val intent = Intent(ACTION_PREFERENCES_CHANGED).apply {
                setPackage(context.packageName)
                putExtras(bundle)
            }
            context.sendBroadcast(intent)
        } catch (e: Exception) {
            Log.w("QyKeyModule", "Failed to broadcast preference change: ${e.message}")
        }

        // 3. Live-update the touchpad cursor overlay in THIS process (the module
        //    also runs in the :ime_process when the keyboard JS calls this).
        Handler(Looper.getMainLooper()).post {
            try {
                PointerOverlay.refreshCursor()
            } catch (e: Exception) {
                Log.w("QyKeyModule", "refreshCursor failed: ${e.message}")
            }
        }

        promise.resolve(null)
    }

    @ReactMethod
    fun isDefaultKeyboard(promise: Promise) {
        val context = reactApplicationContext
        val current = android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.DEFAULT_INPUT_METHOD
        )
        promise.resolve(current?.contains(context.packageName) ?: false)
    }

    @ReactMethod
    fun isKeyboardEnabled(promise: Promise) {
        val context = reactApplicationContext
        val enabled = android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ENABLED_INPUT_METHODS
        ) ?: ""
        promise.resolve(enabled.contains(context.packageName))
    }

    @ReactMethod
    fun openKeyboardSettings(promise: Promise) {
        val context = reactApplicationContext
        val intent = android.content.Intent(
            android.provider.Settings.ACTION_INPUT_METHOD_SETTINGS
        ).apply { flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK }
        context.startActivity(intent)
        promise.resolve(null)
    }

    @ReactMethod
    fun showInputMethodPicker(promise: Promise) {
        // Show the system "Choose input method" picker so the user can select
        // QyKey as the current (default) keyboard. This is the standard
        // "set as default" flow (used by Gboard) and works on every Android
        // version/device, unlike Settings.ACTION_INPUT_METHOD_SETTINGS which
        // on Android 12+ only opens the "Available on-screen keyboards" list.
        val context = reactApplicationContext
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE)
                as android.view.inputmethod.InputMethodManager
        imm.showInputMethodPicker()
        promise.resolve(null)
    }

    // ── Accessibility service (M1) ──────────────────────────────────────────

    /**
     * Resolves true when QyKeyAccessibilityService is enabled in the system
     * accessibility settings. Works from any process (reads AccessibilityManager +
     * Settings.Secure fallback; the a11y service singleton itself only exists in :ime_process).
     */
    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        val context = reactApplicationContext
        val am = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
        val enabledViaManager = am
            ?.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            ?.any { info ->
                val sInfo = info.resolveInfo?.serviceInfo
                (sInfo?.packageName == context.packageName &&
                    (sInfo.name == "com.qykey.QyKeyAccessibilityService" ||
                     sInfo.name?.endsWith("QyKeyAccessibilityService") == true)) ||
                info.id?.contains("QyKeyAccessibilityService") == true
            }
            ?: false

        // Fallback via Settings.Secure (mirrors isKeyboardEnabled check)
        val enabledViaSecure = if (!enabledViaManager) {
            val raw = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            raw.contains("QyKeyAccessibilityService")
        } else false

        promise.resolve(enabledViaManager || enabledViaSecure)
    }

    /** Deep-links to the system accessibility settings so the user can enable QyKey. */
    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            Log.w("QyKeyModule", "openAccessibilitySettings failed: ${e.message}")
        }
        promise.resolve(null)
    }

    /**
     * Shows the floating QyKey panel. Only meaningful in :ime_process (where the
     * a11y service singleton lives); resolves without error elsewhere.
     */
    @ReactMethod
    fun showFloatingPanel(promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            QyKeyAccessibilityService.instance?.showFloatingPanel()
        }
        promise.resolve(null)
    }

    /** Hides the floating QyKey panel (used by the panel's own close button). */
    @ReactMethod
    fun hideFloatingPanel(promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            QyKeyAccessibilityService.instance?.hideFloatingPanel()
        }
        promise.resolve(null)
    }
}
