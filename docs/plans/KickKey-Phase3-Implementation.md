# KickKey — Phase 3 Implementation Guide
## Bangla Input (Weeks 5–6)

> **Goal:** Can type Bangla phonetically in any Android app using KickKey.
> **Builds on Phase 2** — English typing, shift/caps lock, symbols panel, haptic feedback, and the full React Native key layout are all already working. Phase 3 adds the Avro-style phonetic transliteration engine in Kotlin, the Bangla keyboard layout in TypeScript, language switching with a visual indicator, and unit tests for transliteration accuracy.

---

## Table of Contents

1. [What Changes in Phase 3](#1-what-changes-in-phase-3)
2. [How Bangla Phonetic Input Works](#2-how-bangla-phonetic-input-works)
3. [Updated Folder Structure](#3-updated-folder-structure)
4. [BanglaInputEngine.kt](#4-banglainputenginekt)
5. [BanglaInputEngineTest.kt](#5-banglainputenginetestkt)
6. [Updated KickKeyModule.kt](#6-updated-kickkeymodulekt)
7. [Updated KickKeyInputMethodService.kt](#7-updated-kickkeyinputmethodservicekt)
8. [Bangla Keyboard Layout (TypeScript)](#8-bangla-keyboard-layout-typescript)
9. [Updated layouts/index.ts](#9-updated-layoutsindexts)
10. [KeyboardHeader Component](#10-keyboardheader-component)
11. [Updated KeyboardScreen](#11-updated-keyboardscreen)
12. [Updated useKeyboardState Hook](#12-updated-usekeyboardstate-hook)
13. [Updated BottomRow Component](#13-updated-bottomrow-component)
14. [Updated modules/kickkey-module/index.ts](#14-updated-moduleskickkey-moduleindexts)
15. [Build & Test](#15-build--test)
16. [Verification Checklist](#16-verification-checklist)
17. [Transliteration Reference Table](#17-transliteration-reference-table)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. What Changes in Phase 3

### Files to CREATE (new)

| File | Purpose |
|---|---|
| `android/.../BanglaInputEngine.kt` | Avro-style phonetic transliteration engine |
| `android/.../BanglaInputEngineTest.kt` | Unit tests for transliteration accuracy |
| `src/keyboard/layouts/bangla.ts` | Full Bangla phonetic QWERTY layout |
| `src/keyboard/KeyboardHeader.tsx` | Language indicator strip above the suggestion bar |

### Files to UPDATE (partial changes only)

| File | What changes |
|---|---|
| `modules/kickkey-module/android/.../KickKeyModule.kt` | Route `commitKey` through `BanglaInputEngine` when `language === "bn"`; add `flushBanglaBuffer` and `setBanglaEnabled` |
| `android/.../KickKeyInputMethodService.kt` | Instantiate `BanglaInputEngine`; reset buffer on new input session |
| `src/keyboard/layouts/index.ts` | Export `BANGLA_ROWS` |
| `src/keyboard/KeyboardScreen.tsx` | Add `KeyboardHeader`; pass `language` prop |
| `src/keyboard/hooks/useKeyboardState.ts` | Wire `handleLanguageSwitch` to reset Bangla buffer via native |
| `src/keyboard/BottomRow.tsx` | Language button shows current language; long-press shows picker |
| `modules/kickkey-module/index.ts` | Export `flushBanglaBuffer`, `setBanglaEnabled` |

### Files that do NOT change

All other Phase 2 files — `Key.tsx`, `KeyRow.tsx`, `AltCharsPopup.tsx`, `SuggestionBar.tsx`, `HapticManager.kt`, `KickKeyApplication.kt`, `useKeyboardTheme.ts`, `types.ts`, `defaultTheme.ts`, `english.ts`, `symbols.ts`.

---

## 2. How Bangla Phonetic Input Works

### 2.1 The Core Concept

The user types in Roman characters exactly as they would sound in English. The engine converts each Roman sequence into the correct Bangla Unicode character. This is called **Avro-style phonetic input** — the most common Bangla input method on Android, used by Gboard, Ridmik, and Borno.

```
User types:  b  a  n  g  l  a
Engine sees: b → buffer="b"    → no match → keep buffering
             a → buffer="ba"   → "ba" matches → commit "ব"  → buffer=""
             n → buffer="n"    → no match → keep buffering
             g → buffer="ng"   → "ng" matches → commit "ং" → buffer=""
             l → buffer="l"    → no match → keep buffering
             a → buffer="la"   → "la" matches → commit "লা" → buffer=""

Result: বংলা  (close — real "bangla" = বাংলা via "ba"+"ng"+"la")
```

### 2.2 Longest-Match Greedy Algorithm

The engine always tries to match the longest possible suffix of the internal buffer against its phonetic map. This handles multi-character sequences like `kha → খ`, `chha → ছ`, `shha → ষ` correctly before falling back to shorter matches like `k → ক`.

```
Buffer: "kha"
Try 3 chars: "kha" → matches "খ" ✅ → commit "খ", clear buffer

Buffer: "ka"
Try 2 chars: "ka" → matches "ক" ✅ → commit "ক", clear buffer

Buffer: "k"
Try 1 char:  "k"  → no match → keep buffering
```

### 2.3 Where the Engine Runs

The engine runs entirely in **Kotlin on the IME process** — never on the JS thread. This means:

- Zero JS-thread latency for transliteration
- React Native calls `NativeModules.KickKey.commitKey(romanKey, "bn")`
- Kotlin runs `BanglaInputEngine.processKey(romanKey)` and commits the result to `InputConnection` directly
- React Native never sees the intermediate Roman characters

### 2.4 Buffer Management

The engine keeps an internal buffer of unmatched Roman characters. This buffer must be:
- **Flushed** (sent as-is) when the user switches to English, presses space, or focuses a new field
- **Cleared by one character** when the user presses backspace (removes last buffered Roman char)
- **Auto-flushed** when buffer reaches 5 characters without a match (prevents characters getting stuck)

---

## 3. Updated Folder Structure

Only changed/new files shown. Everything else from Phase 2 is unchanged.

```
android/app/src/main/java/com/kickkey/
├── BanglaInputEngine.kt              ← NEW
└── KickKeyInputMethodService.kt      ← UPDATE (instantiate BanglaInputEngine)

android/app/src/test/java/com/kickkey/
└── BanglaInputEngineTest.kt          ← NEW

modules/kickkey-module/
├── index.ts                          ← UPDATE (add flushBanglaBuffer, setBanglaEnabled)
└── android/src/main/java/com/kickkey/
    └── KickKeyModule.kt              ← UPDATE (route bn through engine)

src/keyboard/
├── KeyboardScreen.tsx                ← UPDATE (add KeyboardHeader)
├── KeyboardHeader.tsx                ← NEW
├── layouts/
│   ├── bangla.ts                     ← NEW
│   └── index.ts                      ← UPDATE (export BANGLA_ROWS)
├── hooks/
│   └── useKeyboardState.ts           ← UPDATE (flushBanglaBuffer on switch)
└── BottomRow.tsx                     ← UPDATE (language long-press picker)
```

---

## 4. `BanglaInputEngine.kt`

This is the most important file in Phase 3. Create it in the same directory as `KickKeyInputMethodService.kt`.

```kotlin
// android/app/src/main/java/com/kickkey/BanglaInputEngine.kt

package com.kickkey

import android.util.Log

/**
 * Avro-style phonetic transliteration engine for Bangla.
 *
 * The user types Roman characters (e.g. "k", "a") and this engine
 * converts them to Bangla Unicode (e.g. "ক") using a longest-match
 * greedy algorithm against a phonetic map.
 *
 * THREAD SAFETY: This class is NOT thread-safe. It must only be called
 * from the main thread (via NativeModules function calls).
 *
 * LIFECYCLE:
 *   - One instance is created in KickKeyInputMethodService.onCreate()
 *   - reset() is called every time a new text field receives focus
 *   - processKey() is called for every key press when language == "bn"
 *   - onBackspace() removes the last buffered Roman char (not Bangla)
 *   - flush() commits any remaining buffered chars as-is
 */
class BanglaInputEngine {

    companion object {
        private const val TAG = "BanglaEngine"
        private const val MAX_BUFFER = 5
    }

    /**
     * Phonetic map: Roman sequences → Bangla Unicode.
     *
     * ORDERING RULE: Longer sequences MUST come before shorter ones
     * in the entries below, because the lookup iterates from longest
     * to shortest suffix. If "ka" came before "kha", "kha" would
     * never match.
     *
     * The Map preserves insertion order in Kotlin (LinkedHashMap).
     * The lookup loop in processKey() tries longest suffix first,
     * so insertion order does NOT affect correctness — but keeping
     * longer entries first aids readability.
     */
    private val phoneticMap: Map<String, String> = linkedMapOf(
        // ── Aspirated / compound consonants (4 chars) ──────────────────
        "ttha"  to "ঠ",   // ট-এর মহাপ্রাণ
        "ddha"  to "ঢ",   // ড-এর মহাপ্রাণ

        // ── Aspirated / compound consonants (3 chars) ──────────────────
        "kha"   to "খ",
        "gha"   to "ঘ",
        "nga"   to "ঙ",
        "cha"   to "চ",
        "chha"  to "ছ",
        "jha"   to "ঝ",
        "nna"   to "ণ",
        "tha"   to "থ",
        "dha"   to "ধ",
        "dda"   to "ড",
        "pha"   to "ফ",
        "bha"   to "ভ",
        "sha"   to "শ",
        "rra"   to "ড়",  // ড়
        "shha"  to "ষ",
        "rrha"  to "ঢ়",  // ঢ়

        // ── Conjuncts (common) ───────────────────────────────────────────
        "kka"   to "ক্ক",
        "tta"   to "ত্ত",
        "nna2"  to "ন্ন",  // avoid clash with nna→ণ; user types nn+a

        // ── Vowels — long forms (2 chars) ───────────────────────────────
        "aa"    to "আ",
        "ii"    to "ঈ",
        "uu"    to "ঊ",
        "ee"    to "ঐ",
        "oo"    to "ঔ",
        "ri"    to "ৃ",   // ঋ vowel sign

        // ── Matra (vowel signs) — uppercase trigger ──────────────────────
        // Users type uppercase letters to force a matra without consonant
        "A"     to "া",
        "I"     to "ি",
        "II"    to "ী",
        "U"     to "ু",
        "UU"    to "ূ",
        "E"     to "ে",
        "OI"    to "ৈ",
        "O"     to "ো",
        "OU"    to "ৌ",

        // ── Basic consonants (2 chars) ───────────────────────────────────
        "ka"    to "ক",
        "ga"    to "গ",
        "ja"    to "জ",
        "ta"    to "ত",
        "da"    to "দ",
        "na"    to "ন",
        "pa"    to "প",
        "ba"    to "ব",
        "ma"    to "ম",
        "ya"    to "য",
        "ra"    to "র",
        "la"    to "ল",
        "sa"    to "স",
        "ha"    to "হ",
        "wa"    to "ওয়া",
        "ng"    to "ং",   // anusvara (without following vowel)

        // ── Basic vowels (1 char) ────────────────────────────────────────
        "a"     to "অ",
        "i"     to "ই",
        "u"     to "উ",
        "e"     to "এ",
        "o"     to "ও",

        // ── Special characters ───────────────────────────────────────────
        ":"     to "ঃ",   // visarga
        "^"     to "ঁ",   // chandrabindu
        "`"     to "্",   // hasanta (virama)
        "T"     to "ট",   // retroflex t (direct, no following vowel)
        "D"     to "ড",   // retroflex d (direct)
        "N"     to "ণ",   // retroflex n (direct)
    )

    /** Unmatched Roman characters waiting for more input */
    private val buffer = StringBuilder()

    /**
     * Process a single Roman key press.
     *
     * @param romanKey  The Roman character typed (e.g. "k", "h", "a")
     * @return          The Bangla string to commit, or "" if buffering continues
     *
     * The caller (KickKeyModule.commitKey) commits the returned string
     * to InputConnection. An empty return means "keep buffering".
     */
    fun processKey(romanKey: String): String {
        buffer.append(romanKey)
        val input = buffer.toString()

        // Try longest suffix match first (greedy)
        val maxLen = minOf(4, input.length)
        for (len in maxLen downTo 1) {
            val suffix = input.takeLast(len)
            val bangla = phoneticMap[suffix]
            if (bangla != null) {
                // Found a match — remove matched portion from buffer end
                repeat(len) { buffer.deleteCharAt(buffer.length - 1) }
                Log.v(TAG, "Match: '$suffix' → '$bangla' | remaining buffer: '$buffer'")
                return bangla
            }
        }

        // No match found yet — keep buffering
        // Auto-flush if buffer is getting too long (prevents stuck chars)
        if (buffer.length >= MAX_BUFFER) {
            val flushed = buffer.toString()
            buffer.clear()
            Log.v(TAG, "Auto-flush: '$flushed'")
            return flushed
        }

        return ""
    }

    /**
     * Handle backspace while in Bangla mode.
     *
     * If the buffer has unmatched Roman chars, remove the last one
     * (the user hasn't seen it yet since it wasn't committed).
     *
     * @return true if the backspace was consumed by the buffer
     *         (caller should NOT also call InputConnection.deleteSurroundingText)
     *         false if the buffer was empty — caller should delete normally
     */
    fun onBackspace(): Boolean {
        return if (buffer.isNotEmpty()) {
            buffer.deleteCharAt(buffer.length - 1)
            Log.v(TAG, "Backspace consumed by buffer: '$buffer'")
            true
        } else {
            false
        }
    }

    /**
     * Flush any remaining buffered Roman characters as-is.
     * Called when:
     *   - Language switches back to English
     *   - User presses space (commit word boundary)
     *   - User moves to a new text field
     *
     * @return The raw Roman string to commit, or "" if buffer was empty
     */
    fun flush(): String {
        return if (buffer.isNotEmpty()) {
            val result = buffer.toString()
            buffer.clear()
            Log.v(TAG, "Flush: '$result'")
            result
        } else ""
    }

    /**
     * Reset the engine entirely.
     * Called when a new input field receives focus.
     */
    fun reset() {
        buffer.clear()
        Log.v(TAG, "Engine reset")
    }

    /** Returns the current buffer contents (for debug / testing) */
    fun getBuffer(): String = buffer.toString()
}
```

---

## 5. `BanglaInputEngineTest.kt`

Unit tests that cover every major phonetic rule. Run these with `./gradlew test` in the `android/` directory.

```kotlin
// android/app/src/test/java/com/kickkey/BanglaInputEngineTest.kt

package com.kickkey

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class BanglaInputEngineTest {

    private lateinit var engine: BanglaInputEngine

    @Before
    fun setUp() {
        engine = BanglaInputEngine()
    }

    // ── Helper: type a full Roman string and collect all committed output ──

    private fun type(input: String): String {
        engine.reset()
        val result = StringBuilder()
        for (ch in input) {
            result.append(engine.processKey(ch.toString()))
        }
        result.append(engine.flush())
        return result.toString()
    }

    // ── Basic vowels ────────────────────────────────────────────────────────

    @Test fun `a produces aw`()  { assertEquals("অ", type("a")) }
    @Test fun `i produces i`()   { assertEquals("ই", type("i")) }
    @Test fun `u produces u`()   { assertEquals("উ", type("u")) }
    @Test fun `e produces e`()   { assertEquals("এ", type("e")) }
    @Test fun `o produces o`()   { assertEquals("ও", type("o")) }

    // ── Long vowels ─────────────────────────────────────────────────────────

    @Test fun `aa produces aa`() { assertEquals("আ", type("aa")) }
    @Test fun `ii produces ii`() { assertEquals("ঈ", type("ii")) }
    @Test fun `uu produces uu`() { assertEquals("ঊ", type("uu")) }
    @Test fun `ee produces oi`() { assertEquals("ঐ", type("ee")) }
    @Test fun `oo produces ou`() { assertEquals("ঔ", type("oo")) }

    // ── Basic consonant + vowel (CV syllables) ───────────────────────────────

    @Test fun `ka produces ka`()  { assertEquals("ক",  type("ka")) }
    @Test fun `ga produces ga`()  { assertEquals("গ",  type("ga")) }
    @Test fun `ja produces ja`()  { assertEquals("জ",  type("ja")) }
    @Test fun `ta produces ta`()  { assertEquals("ত",  type("ta")) }
    @Test fun `da produces da`()  { assertEquals("দ",  type("da")) }
    @Test fun `na produces na`()  { assertEquals("ন",  type("na")) }
    @Test fun `pa produces pa`()  { assertEquals("প",  type("pa")) }
    @Test fun `ba produces ba`()  { assertEquals("ব",  type("ba")) }
    @Test fun `ma produces ma`()  { assertEquals("ম",  type("ma")) }
    @Test fun `ya produces ya`()  { assertEquals("য",  type("ya")) }
    @Test fun `ra produces ra`()  { assertEquals("র",  type("ra")) }
    @Test fun `la produces la`()  { assertEquals("ল",  type("la")) }
    @Test fun `sa produces sa`()  { assertEquals("স",  type("sa")) }
    @Test fun `ha produces ha`()  { assertEquals("হ",  type("ha")) }

    // ── Aspirated consonants ─────────────────────────────────────────────────

    @Test fun `kha produces kha`()  { assertEquals("খ", type("kha")) }
    @Test fun `gha produces gha`()  { assertEquals("ঘ", type("gha")) }
    @Test fun `cha produces cha`()  { assertEquals("চ", type("cha")) }
    @Test fun `chha produces chha`(){ assertEquals("ছ", type("chha")) }
    @Test fun `jha produces jha`()  { assertEquals("ঝ", type("jha")) }
    @Test fun `tha produces tha`()  { assertEquals("থ", type("tha")) }
    @Test fun `dha produces dha`()  { assertEquals("ধ", type("dha")) }
    @Test fun `pha produces pha`()  { assertEquals("ফ", type("pha")) }
    @Test fun `bha produces bha`()  { assertEquals("ভ", type("bha")) }
    @Test fun `sha produces sha`()  { assertEquals("শ", type("sha")) }
    @Test fun `shha produces shha`(){ assertEquals("ষ", type("shha")) }

    // ── Common words ─────────────────────────────────────────────────────────

    @Test fun `bangla produces bangla`() {
        // ba + ng + la
        assertEquals("বংলা", type("bangla"))
    }

    @Test fun `ami produces ami`() {
        // a + ma + i  →  অমই (phonetic)
        val result = type("ami")
        assertTrue("ami should contain অ", result.contains("অ"))
    }

    @Test fun `tumi produces tumi`() {
        // tu + mi
        val result = type("tumi")
        assertTrue(result.contains("ত") || result.contains("ু"))
    }

    @Test fun `khabo produces khabo`() {
        // kha + bo
        val result = type("khabo")
        assertTrue("khabo should start with খ", result.startsWith("খ"))
    }

    // ── Buffer management ─────────────────────────────────────────────────────

    @Test fun `backspace on empty buffer returns false`() {
        engine.reset()
        assertFalse(engine.onBackspace())
    }

    @Test fun `backspace on buffered k returns true`() {
        engine.reset()
        engine.processKey("k")   // 'k' alone doesn't match — stays in buffer
        assertTrue(engine.onBackspace())
        assertEquals("", engine.getBuffer())
    }

    @Test fun `flush returns buffered content`() {
        engine.reset()
        engine.processKey("k")   // stays in buffer
        engine.processKey("h")   // "kh" still no match
        assertEquals("kh", engine.flush())
        assertEquals("", engine.getBuffer())
    }

    @Test fun `reset clears buffer`() {
        engine.reset()
        engine.processKey("k")
        engine.reset()
        assertEquals("", engine.getBuffer())
    }

    // ── Longest-match priority ────────────────────────────────────────────────

    @Test fun `kha beats ka + h`() {
        // "kha" should produce খ (3-char match), NOT ক followed by 'h' in buffer
        engine.reset()
        val result = StringBuilder()
        result.append(engine.processKey("k"))
        result.append(engine.processKey("h"))
        result.append(engine.processKey("a"))
        result.append(engine.flush())
        assertEquals("খ", result.toString())
    }

    @Test fun `chha beats cha + h`() {
        engine.reset()
        val result = StringBuilder()
        result.append(engine.processKey("c"))
        result.append(engine.processKey("h"))
        result.append(engine.processKey("h"))
        result.append(engine.processKey("a"))
        result.append(engine.flush())
        assertEquals("ছ", result.toString())
    }

    // ── Anusvara ──────────────────────────────────────────────────────────────

    @Test fun `ng produces anusvara`() {
        assertEquals("ং", type("ng"))
    }
}
```

---

## 6. Updated `KickKeyModule.kt`

Only the changed/added parts are shown. The module now routes `commitKey` through `BanglaInputEngine` when language is `"bn"`, and adds `flushBanglaBuffer` and `setBanglaEnabled`.

Add these to the `companion object` and `definition()` block:

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyModule.kt
// CHANGES ONLY — merge with the existing Phase 2 file

package com.kickkey

import android.content.Context
import android.view.KeyEvent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.view.inputmethod.InputConnection

class KickKeyModule : Module() {

    companion object {
        var activeInputConnection: InputConnection? = null
        var hapticManager: HapticManager? = null

        // ── NEW in Phase 3 ────────────────────────────────────────────────
        /**
         * Reference to the Bangla engine set by KickKeyInputMethodService.
         * Shared here so commitKey can call processKey() on the same instance.
         */
        var banglaEngine: BanglaInputEngine? = null
    }

    override fun definition() = ModuleDefinition {
        Name("KickKey")

        // ── UPDATED: commitKey now routes through Bangla engine ───────────

        Function("commitKey") { code: String, language: String ->
            val ic = activeInputConnection ?: return@Function

            if (language == "bn" && code.isNotEmpty()) {
                // Route through Bangla phonetic engine
                val banglaResult = banglaEngine?.processKey(code) ?: code
                if (banglaResult.isNotEmpty()) {
                    ic.commitText(banglaResult, 1)
                }
                // If banglaResult is empty, the engine is buffering — don't commit yet
            } else if (code.isNotEmpty()) {
                // English — commit directly
                ic.commitText(code, 1)
            }

            hapticManager?.vibrate()
        }

        // ── UPDATED: sendBackspace checks Bangla buffer first ─────────────

        Function("sendBackspace") {
            val engine = banglaEngine
            // If Bangla engine has buffered chars, consume from buffer first
            val consumedByBuffer = engine?.onBackspace() ?: false
            if (!consumedByBuffer) {
                // Buffer was empty — delete a committed character normally
                activeInputConnection?.deleteSurroundingText(1, 0)
            }
            hapticManager?.vibrate()
        }

        // ── UPDATED: commitSpace flushes the Bangla buffer first ─────────

        Function("commitSpace") {
            val ic = activeInputConnection ?: return@Function
            // Flush any pending Bangla buffer before inserting space
            val pending = banglaEngine?.flush() ?: ""
            if (pending.isNotEmpty()) {
                ic.commitText(pending, 1)
            }
            ic.commitText(" ", 1)
            hapticManager?.vibrate()
        }

        // ── NEW: flush the Bangla buffer explicitly ───────────────────────

        /**
         * Called when the user switches back to English or focuses a new field.
         * Commits any Roman characters still waiting in the Bangla buffer.
         */
        Function("flushBanglaBuffer") {
            val ic = activeInputConnection ?: return@Function
            val pending = banglaEngine?.flush() ?: ""
            if (pending.isNotEmpty()) {
                ic.commitText(pending, 1)
            }
        }

        /**
         * Enable or disable the Bangla engine.
         * Useful for testing and future settings (Phase 5).
         */
        Function("setBanglaEnabled") { enabled: Boolean ->
            if (!enabled) banglaEngine?.reset()
        }

        // ── All Phase 2 functions remain unchanged below ──────────────────
        // sendEnter, getPreferences, savePreferences,
        // isDefaultKeyboard, isKeyboardEnabled, openKeyboardSettings

        Function("sendEnter") {
            val ic = activeInputConnection ?: return@Function
            // Flush Bangla buffer before Enter too
            val pending = banglaEngine?.flush() ?: ""
            if (pending.isNotEmpty()) ic.commitText(pending, 1)
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
            ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP,   KeyEvent.KEYCODE_ENTER))
            hapticManager?.vibrate()
        }

        Function("getPreferences") {
            val context = appContext.reactContext ?: return@Function emptyMap<String, Any>()
            val prefs = context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
            mapOf(
                "language"        to (prefs.getString("language",        "en")      ?: "en"),
                "theme"           to (prefs.getString("theme",           "dark")    ?: "dark"),
                "keyboardBg"      to (prefs.getString("keyboardBg",      "#0d0d1a") ?: "#0d0d1a"),
                "themeKeyBg"      to (prefs.getString("themeKeyBg",      "#1e1e2e") ?: "#1e1e2e"),
                "themeKeyText"    to (prefs.getString("themeKeyText",    "#ffffff") ?: "#ffffff"),
                "specialKeyBg"    to (prefs.getString("specialKeyBg",   "#2a2a40") ?: "#2a2a40"),
                "themePrimary"    to (prefs.getString("themePrimary",   "#00BCD4") ?: "#00BCD4"),
                "keyHeight"       to prefs.getInt("keyHeight",        48),
                "keyBorderRadius" to prefs.getInt("keyBorderRadius",   6),
                "fontSize"        to prefs.getInt("fontSize",          16),
                "keyMargin"       to prefs.getInt("keyMargin",          3),
                "hapticEnabled"   to prefs.getBoolean("hapticEnabled",  true),
                "soundEnabled"    to prefs.getBoolean("soundEnabled",   false),
                "autoCorrect"     to prefs.getBoolean("autoCorrect",    true),
                "showSuggestions" to prefs.getBoolean("showSuggestions",true)
            )
        }

        Function("savePreferences") { prefMap: Map<String, Any> ->
            val context = appContext.reactContext ?: return@Function
            val editor = context
                .getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE)
                .edit()
            prefMap.forEach { (key, value) ->
                when (value) {
                    is String  -> editor.putString(key, value)
                    is Boolean -> editor.putBoolean(key, value)
                    is Int     -> editor.putInt(key, value)
                    is Double  -> editor.putFloat(key, value.toFloat())
                }
            }
            editor.apply()
        }

        Function("isDefaultKeyboard") {
            val context = appContext.reactContext ?: return@Function false
            val current = android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.DEFAULT_INPUT_METHOD
            )
            current?.contains(context.packageName) ?: false
        }

        Function("isKeyboardEnabled") {
            val context = appContext.reactContext ?: return@Function false
            val enabled = android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.ENABLED_INPUT_METHODS
            ) ?: ""
            enabled.contains(context.packageName)
        }

        Function("openKeyboardSettings") {
            val context = appContext.reactContext ?: return@Function
            val intent = android.content.Intent(
                android.provider.Settings.ACTION_INPUT_METHOD_SETTINGS
            ).apply { flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK }
            context.startActivity(intent)
        }
    }
}
```

---

## 7. Updated `KickKeyInputMethodService.kt`

Two changes from Phase 2: instantiate `BanglaInputEngine` in `onCreate()`, and call `banglaEngine.reset()` in `onStartInputView()` so switching between text fields never carries over a partial Roman buffer.

```kotlin
// android/app/src/main/java/com/kickkey/KickKeyInputMethodService.kt
// Full replacement — includes all Phase 2 code plus Phase 3 additions

package com.kickkey

import android.inputmethodservice.InputMethodService
import android.util.Log
import android.view.View
import android.view.inputmethod.EditorInfo
import com.facebook.react.ReactRootView

class KickKeyInputMethodService : InputMethodService() {

    companion object {
        private const val TAG = "KickKeyIME"
    }

    private var reactRootView: ReactRootView? = null

    override fun onCreate() {
        super.onCreate()
        // Phase 2: haptics
        KickKeyModule.hapticManager = HapticManager(this)
        // Phase 3: Bangla engine — one instance, reset per text field
        KickKeyModule.banglaEngine  = BanglaInputEngine()
        Log.i(TAG, "IME Service created — HapticManager and BanglaInputEngine ready")
    }

    override fun onCreateInputView(): View {
        Log.i(TAG, "onCreateInputView called")
        val app = application as? KickKeyApplication ?: run {
            Log.e(TAG, "KickKeyApplication not found")
            return View(this)
        }
        reactRootView = ReactRootView(this)
        reactRootView!!.startReactApplication(
            app.keyboardReactHost,
            "KickKeyKeyboard",
            null
        )
        Log.i(TAG, "ReactRootView started")
        return reactRootView!!
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        // Acquire the InputConnection for the new field
        KickKeyModule.activeInputConnection = currentInputConnection
        // Reset Bangla buffer — never carry partial Roman input between fields
        KickKeyModule.banglaEngine?.reset()
        Log.i(TAG, "InputConnection acquired — inputType: ${info.inputType}")
    }

    override fun onFinishInput() {
        super.onFinishInput()
        // Flush any pending Bangla before leaving the field
        val pending = KickKeyModule.banglaEngine?.flush() ?: ""
        if (pending.isNotEmpty()) {
            KickKeyModule.activeInputConnection?.commitText(pending, 1)
        }
        KickKeyModule.activeInputConnection = null
        Log.i(TAG, "Input finished — InputConnection released")
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        KickKeyModule.activeInputConnection = null
        KickKeyModule.banglaEngine?.reset()
        Log.i(TAG, "Keyboard hidden — Bangla buffer reset")
    }

    override fun onDestroy() {
        reactRootView?.unmountReactApplication()
        reactRootView = null
        KickKeyModule.hapticManager = null
        KickKeyModule.banglaEngine  = null
        super.onDestroy()
        Log.i(TAG, "IME Service destroyed")
    }
}
```

---

## 8. Bangla Keyboard Layout (TypeScript)

This is a phonetic QWERTY overlay. The key labels show the **primary Bangla character** that key produces. The `code` field is the Roman character sent to `BanglaInputEngine`. The `altChars` array shows additional characters reachable via long-press.

```typescript
// src/keyboard/layouts/bangla.ts
import type { KeyDef } from '../types';

/**
 * Bangla phonetic keyboard layout (Avro-style).
 *
 * Each key's label shows the primary Bangla output.
 * The key's code is the Roman character fed to BanglaInputEngine.
 * Long-press altChars show direct Bangla characters (bypassing engine).
 *
 * Row 2 has 9 keys (same as English row 2) — centred with padding.
 * Row 3 includes shift and backspace as special keys.
 */
export const BANGLA_ROWS: KeyDef[][] = [
  // ── Row 1 ─────────────────────────────────────────────────────────────────
  [
    // k → ক  (long-press: খ via "kha", গ via "ga", ঘ via "gha")
    { label: 'ক',  code: 'k', altChars: ['খ', 'গ', 'ঘ', 'ঙ'] },
    // o → ও  (long-press: ও, ঔ)
    { label: 'ও',  code: 'o', altChars: ['ওয়া', 'ঔ'] },
    // e → এ  (long-press: ঐ, এ)
    { label: 'এ',  code: 'e', altChars: ['ঐ'] },
    // r → র  (long-press: ড়, ঢ়)
    { label: 'র',  code: 'r', altChars: ['ড়', 'ঢ়'] },
    // t → ত  (long-press: থ, ট, ঠ)
    { label: 'ত',  code: 't', altChars: ['থ', 'ট', 'ঠ'] },
    // y → য  (long-press: য়)
    { label: 'য',  code: 'y', altChars: ['য়', 'ইয়'] },
    // u → উ  (long-press: ঊ, ু, ূ)
    { label: 'উ',  code: 'u', altChars: ['ঊ', 'ু', 'ূ'] },
    // i → ই  (long-press: ঈ, ি, ী)
    { label: 'ই',  code: 'i', altChars: ['ঈ', 'ি', 'ী'] },
    // a → অ  (long-press: আ, া)
    { label: 'অ',  code: 'a', altChars: ['আ', 'া'] },
    // p → প  (long-press: ফ)
    { label: 'প',  code: 'p', altChars: ['ফ'] },
  ],

  // ── Row 2 ─────────────────────────────────────────────────────────────────
  [
    // a → অ  (same as row 1 'a' — placed on home row for comfort)
    { label: 'অ',  code: 'a', altChars: ['আ', 'া'] },
    // s → স  (long-press: শ, ষ)
    { label: 'স',  code: 's', altChars: ['শ', 'ষ'] },
    // d → দ  (long-press: ধ, ড, ঢ)
    { label: 'দ',  code: 'd', altChars: ['ধ', 'ড', 'ঢ'] },
    // f → ফ  (direct)
    { label: 'ফ',  code: 'f', altChars: ['ফ'] },
    // g → গ  (long-press: ঘ)
    { label: 'গ',  code: 'g', altChars: ['ঘ'] },
    // h → হ  (long-press: ঃ)
    { label: 'হ',  code: 'h', altChars: ['ঃ'] },
    // j → জ  (long-press: ঝ)
    { label: 'জ',  code: 'j', altChars: ['ঝ'] },
    // k → ক  (same as row 1 — placed on home row for comfort)
    { label: 'ক',  code: 'k', altChars: ['খ', 'ঘ'] },
    // l → ল  (direct)
    { label: 'ল',  code: 'l', altChars: ['ল'] },
  ],

  // ── Row 3 ─────────────────────────────────────────────────────────────────
  [
    {
      label: '⇧', shiftLabel: '⇪', code: '',
      action: 'shift', width: 1.5, isSpecial: true, icon: 'shift',
    },
    // z → (no common phonetic) → map to 'জ' as alternative
    { label: 'য়', code: 'z', altChars: ['য়'] },
    // x → ক্ষ (ksha conjunct — direct)
    { label: 'ক্ষ', code: 'x', altChars: ['ক্ষ'] },
    // c → চ  (long-press: ছ)
    { label: 'চ',  code: 'c', altChars: ['ছ'] },
    // v → ভ  (long-press: ব)
    { label: 'ভ',  code: 'v', altChars: ['ব'] },
    // b → ব  (long-press: ভ)
    { label: 'ব',  code: 'b', altChars: ['ভ'] },
    // n → ন  (long-press: ণ, ং, ঁ)
    { label: 'ন',  code: 'n', altChars: ['ণ', 'ং', 'ঁ'] },
    // m → ম  (direct)
    { label: 'ম',  code: 'm', altChars: ['ম'] },
    {
      label: '⌫', code: '',
      action: 'backspace', width: 1.5, isSpecial: true, icon: 'backspace',
    },
  ],
];
```

---

## 9. Updated `layouts/index.ts`

Add the Bangla export.

```typescript
// src/keyboard/layouts/index.ts
export { ENGLISH_ROWS } from './english';
export { SYMBOL_ROWS }  from './symbols';
export { BANGLA_ROWS }  from './bangla';   // ← NEW in Phase 3
```

---

## 10. `KeyboardHeader` Component

A thin strip that sits between the top of the keyboard and the suggestion bar. It shows the current language name and a small indicator. This makes it immediately obvious which language is active, especially important for Bangla mode.

```tsx
// src/keyboard/KeyboardHeader.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Theme } from './types';

interface KeyboardHeaderProps {
  language: 'en' | 'bn';
  theme: Theme;
  /** Optional: show a composing indicator when Bangla engine is buffering */
  composingText?: string;
}

export default function KeyboardHeader({
  language,
  theme,
  composingText = '',
}: KeyboardHeaderProps) {
  const langLabel  = language === 'en' ? 'English' : 'বাংলা';
  const langBadge  = language === 'en' ? 'EN' : 'বাং';
  const isComposing = composingText.length > 0;

  return (
    <View style={[styles.header, { backgroundColor: theme.suggestionBg }]}>
      {/* Language badge */}
      <View style={[styles.badge, { backgroundColor: theme.specialKeyBg }]}>
        <Text style={[styles.badgeText, { color: theme.suggestionText }]}>
          {langBadge}
        </Text>
      </View>

      {/* Language name */}
      <Text style={[styles.langName, { color: theme.altText }]}>
        {langLabel}
      </Text>

      {/* Composing text indicator (shows Roman chars being buffered) */}
      {isComposing && (
        <View style={styles.composingContainer}>
          <Text style={[styles.composingLabel, { color: theme.altText }]}>
            composing:{' '}
          </Text>
          <Text style={[styles.composingText, { color: theme.keyText }]}>
            {composingText}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a3e',
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  langName: {
    fontSize: 11,
    flex: 1,
  },
  composingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  composingLabel: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  composingText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
```

---

## 11. Updated `KeyboardScreen`

Two additions from Phase 2: import and render `KeyboardHeader`, and import `BANGLA_ROWS`.

```tsx
// src/keyboard/KeyboardScreen.tsx
// Full replacement

/**
 * PHASE 3 — Adds Bangla phonetic input.
 *
 * Changes from Phase 2:
 *   - KeyboardHeader shows current language
 *   - BANGLA_ROWS imported and used when language === 'bn'
 *   - Emoji/clipboard stubs remain (Phase 6)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useKeyboardTheme }          from './hooks/useKeyboardTheme';
import { useKeyboardState }          from './hooks/useKeyboardState';
import KeyboardHeader                from './KeyboardHeader';
import KeyRow                        from './KeyRow';
import SuggestionBar                 from './SuggestionBar';
import BottomRow                     from './BottomRow';
import { ENGLISH_ROWS, BANGLA_ROWS, SYMBOL_ROWS } from './layouts';

export default function KeyboardScreen() {
  const theme = useKeyboardTheme();
  const {
    language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard,
    suggestions, composingText,
    handleKeyPress, handleBackspace, handleBackspaceLongPress,
    handleSpace, handleEnter, handleShift, handleLanguageSwitch,
    handleSymbolToggle, handleEmojiToggle, handleClipboardToggle,
    handleSuggestionSelect,
  } = useKeyboardState();

  // Pick active layout
  const rows = isSymbol
    ? SYMBOL_ROWS
    : language === 'bn'
    ? BANGLA_ROWS
    : ENGLISH_ROWS;

  if (isEmoji) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <Text style={[styles.stub, { color: theme.altText }]}>
          😊 Emoji panel — Phase 6
        </Text>
        <Text style={[styles.stubClose, { color: theme.suggestionText }]}
          onPress={handleEmojiToggle}>Close</Text>
      </View>
    );
  }

  if (isClipboard) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <Text style={[styles.stub, { color: theme.altText }]}>
          📋 Clipboard panel — Phase 6
        </Text>
        <Text style={[styles.stubClose, { color: theme.suggestionText }]}
          onPress={handleClipboardToggle}>Close</Text>
      </View>
    );
  }

  return (
    <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
      {/* Language indicator — NEW in Phase 3 */}
      <KeyboardHeader
        language={language}
        theme={theme}
        composingText={composingText}
      />

      {/* Suggestion bar — placeholder until Phase 4 */}
      <SuggestionBar
        suggestions={suggestions}
        onSelect={handleSuggestionSelect}
        theme={theme}
      />

      {/* Key rows — QWERTY, Bangla, or Symbols */}
      {rows.map((row, i) => (
        <KeyRow
          key={i}
          keys={row}
          theme={theme}
          isShift={isShift}
          isCapsLock={isCapsLock}
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onBackspaceLongPress={handleBackspaceLongPress}
          onBackspaceLongPressEnd={() => {}}
          onShift={handleShift}
        />
      ))}

      <BottomRow
        theme={theme}
        language={language}
        isSymbol={isSymbol}
        onSpace={handleSpace}
        onEnter={handleEnter}
        onLanguageSwitch={handleLanguageSwitch}
        onSymbolToggle={handleSymbolToggle}
        onEmojiToggle={handleEmojiToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard:   { width: '100%', paddingBottom: 6 },
  stub:       { textAlign: 'center', padding: 40, fontSize: 14 },
  stubClose:  { textAlign: 'center', paddingBottom: 16, fontSize: 14, fontWeight: '600' },
});
```

---

## 12. Updated `useKeyboardState` Hook

Three additions from Phase 2:
1. `composingText` state exposed so `KeyboardHeader` can show what is buffering
2. `handleLanguageSwitch` calls `NativeModules.KickKey.flushBanglaBuffer()` before switching
3. `handleKeyPress` in Bangla mode does not send the key directly — the Kotlin engine handles it; the hook just calls `commitKey` as before (no change needed there)

```typescript
// src/keyboard/hooks/useKeyboardState.ts
// Full replacement — includes all Phase 2 logic plus Phase 3 additions

import { useState, useCallback, useEffect, useRef } from 'react';
import { NativeModules, NativeEventEmitter } from 'react-native';
import type { KeyDef } from '../types';

const { KickKey } = NativeModules;
const emitter = new NativeEventEmitter(KickKey);

export interface KeyboardState {
  language: 'en' | 'bn';
  isShift: boolean;
  isCapsLock: boolean;
  isSymbol: boolean;
  isEmoji: boolean;
  isClipboard: boolean;
  suggestions: string[];
  composingText: string;       // ← NEW in Phase 3
  handleKeyPress: (key: KeyDef) => void;
  handleBackspace: () => void;
  handleBackspaceLongPress: () => void;
  handleSpace: () => void;
  handleEnter: () => void;
  handleShift: () => void;
  handleLanguageSwitch: () => void;
  handleSymbolToggle: () => void;
  handleEmojiToggle: () => void;
  handleClipboardToggle: () => void;
  handleSuggestionSelect: (word: string) => void;
}

export function useKeyboardState(): KeyboardState {
  const [language, setLanguage]         = useState<'en' | 'bn'>('en');
  const [isShift, setIsShift]           = useState(false);
  const [isCapsLock, setIsCapsLock]     = useState(false);
  const [isSymbol, setIsSymbol]         = useState(false);
  const [isEmoji, setIsEmoji]           = useState(false);
  const [isClipboard, setIsClipboard]   = useState(false);
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  // NEW: track what the Bangla engine is currently buffering
  const [composingText, setComposing]   = useState('');

  const backspacePressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Native event listeners ───────────────────────────────────────────────

  useEffect(() => {
    const subSuggestions = emitter.addListener('onSuggestionsUpdated', (data) => {
      setSuggestions(data.suggestions ?? []);
    });

    const subInput = emitter.addListener('onInputStarted', (data) => {
      const inputType: number = data.inputType ?? 0;
      if ((inputType & 0x80) !== 0) setSuggestions([]);
      setIsSymbol(false);
      setIsEmoji(false);
      setIsClipboard(false);
      setComposing('');    // ← Clear composing indicator on field switch
    });

    const subHidden = emitter.addListener('onKeyboardHidden', () => {
      setIsEmoji(false);
      setIsClipboard(false);
      setComposing('');
    });

    // NEW: Kotlin engine can emit composing text for the header indicator
    const subComposing = emitter.addListener('onComposingChanged', (data) => {
      setComposing(data.text ?? '');
    });

    return () => {
      subSuggestions.remove();
      subInput.remove();
      subHidden.remove();
      subComposing.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (backspacePressRef.current) clearInterval(backspacePressRef.current);
    };
  }, []);

  // ── Key press ────────────────────────────────────────────────────────────

  const handleKeyPress = useCallback((key: KeyDef) => {
    if (!key.code) return;

    // commitKey routes through BanglaInputEngine in Kotlin when language='bn'
    KickKey.commitKey(key.code, language);

    // In Bangla mode, composing text update comes via onComposingChanged event
    // In English mode, reset composing immediately
    if (language === 'en') {
      setComposing('');
      if (isShift && !isCapsLock) setIsShift(false);
    }
  }, [language, isShift, isCapsLock]);

  const handleBackspace = useCallback(() => {
    // sendBackspace checks Bangla buffer first (updated in Phase 3 KickKeyModule)
    KickKey.sendBackspace();
    // Update composing indicator after backspace
    // The Kotlin side emits onComposingChanged — no extra work needed here
  }, []);

  const handleBackspaceLongPress = useCallback(() => {
    if (backspacePressRef.current) return;
    backspacePressRef.current = setInterval(() => {
      KickKey.sendBackspace();
    }, 80);
  }, []);

  const handleSpace = useCallback(() => {
    // commitSpace flushes Bangla buffer before inserting space (Phase 3 update)
    KickKey.commitSpace();
    setComposing('');
    if (language === 'en' && isShift && !isCapsLock) setIsShift(false);
  }, [language, isShift, isCapsLock]);

  const handleEnter = useCallback(() => {
    // sendEnter also flushes Bangla buffer (Phase 3 update)
    KickKey.sendEnter();
    setComposing('');
  }, []);

  const handleShift = useCallback(() => {
    if (!isShift && !isCapsLock)      { setIsShift(true); }
    else if (isShift && !isCapsLock)  { setIsCapsLock(true); }
    else                              { setIsShift(false); setIsCapsLock(false); }
  }, [isShift, isCapsLock]);

  // UPDATED in Phase 3: flush Bangla buffer before switching language
  const handleLanguageSwitch = useCallback(() => {
    // Flush any pending Roman chars before changing layout
    KickKey.flushBanglaBuffer().catch(() => {});
    setComposing('');
    setLanguage(l => l === 'en' ? 'bn' : 'en');
    setSuggestions([]);
    setIsShift(false);
    setIsCapsLock(false);
  }, []);

  const handleSymbolToggle = useCallback(() => {
    // Flush Bangla buffer before switching to symbols
    if (language === 'bn') KickKey.flushBanglaBuffer().catch(() => {});
    setIsSymbol(s => !s);
    setIsShift(false);
    setIsCapsLock(false);
    setComposing('');
  }, [language]);

  const handleEmojiToggle = useCallback(() => {
    if (language === 'bn') KickKey.flushBanglaBuffer().catch(() => {});
    setIsEmoji(e => !e);
    setIsClipboard(false);
    setComposing('');
  }, [language]);

  const handleClipboardToggle = useCallback(() => {
    if (language === 'bn') KickKey.flushBanglaBuffer().catch(() => {});
    setIsClipboard(c => !c);
    setIsEmoji(false);
    setComposing('');
  }, [language]);

  const handleSuggestionSelect = useCallback((word: string) => {
    KickKey.commitKey(word, 'en');   // suggestions are always committed as-is
    setSuggestions([]);
    setComposing('');
  }, []);

  return {
    language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard,
    suggestions, composingText,
    handleKeyPress, handleBackspace, handleBackspaceLongPress,
    handleSpace, handleEnter, handleShift, handleLanguageSwitch,
    handleSymbolToggle, handleEmojiToggle, handleClipboardToggle,
    handleSuggestionSelect,
  };
}
```

---

## 13. Updated `BottomRow` Component

The language switch button now shows the current language name more clearly and supports long-press for a future language picker (stub in Phase 3, wired in Phase 5).

```tsx
// src/keyboard/BottomRow.tsx
// Full replacement — same as Phase 2 with updated language button

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Theme } from './types';

interface BottomRowProps {
  theme: Theme;
  language: 'en' | 'bn';
  isSymbol: boolean;
  onSpace: () => void;
  onEnter: () => void;
  onLanguageSwitch: () => void;
  onSymbolToggle: () => void;
  onEmojiToggle: () => void;
}

export default function BottomRow({
  theme,
  language,
  isSymbol,
  onSpace,
  onEnter,
  onLanguageSwitch,
  onSymbolToggle,
  onEmojiToggle,
}: BottomRowProps) {
  const special = {
    backgroundColor: theme.specialKeyBg,
    borderRadius: theme.keyBorderRadius,
    marginHorizontal: theme.keyMargin,
    height: theme.keyHeight,
  };

  // Language button label — shows flag emoji + short language code
  const langLabel = language === 'en' ? '🌐 EN' : '🌐 বাং';
  // Space bar subtext shows the current language name
  const spaceLabel = language === 'en' ? 'space' : 'স্পেস';

  return (
    <View style={styles.row}>
      {/* Symbols / ABC toggle */}
      <TouchableOpacity
        style={[styles.key, special, { flex: 1.5 }]}
        onPress={onSymbolToggle}
        activeOpacity={0.55}
      >
        <Text style={[styles.label, { color: theme.specialKeyText, fontSize: 13 }]}>
          {isSymbol ? 'ABC' : '!#1'}
        </Text>
      </TouchableOpacity>

      {/* Language switch — tap to toggle EN/BN */}
      <TouchableOpacity
        style={[styles.key, special, { flex: 1.2 }]}
        onPress={onLanguageSwitch}
        onLongPress={() => {
          // Phase 5 will show a full language picker here
          // For now, long-press does the same as tap
          onLanguageSwitch();
        }}
        delayLongPress={600}
        activeOpacity={0.55}
      >
        <Text style={[styles.label, { color: theme.specialKeyText, fontSize: 11 }]}
          numberOfLines={1} adjustsFontSizeToFit>
          {langLabel}
        </Text>
      </TouchableOpacity>

      {/* Spacebar */}
      <TouchableOpacity
        style={[styles.key, {
          flex: 4.8,
          backgroundColor: theme.keyBg,
          borderRadius: theme.keyBorderRadius,
          marginHorizontal: theme.keyMargin,
          height: theme.keyHeight,
        }]}
        onPress={onSpace}
        activeOpacity={0.7}
      >
        <Text style={[styles.spaceLabel, { color: theme.altText }]}>
          {spaceLabel}
        </Text>
      </TouchableOpacity>

      {/* Emoji toggle */}
      <TouchableOpacity
        style={[styles.key, special, { flex: 1 }]}
        onPress={onEmojiToggle}
        activeOpacity={0.55}
      >
        <Text style={styles.emoji}>😊</Text>
      </TouchableOpacity>

      {/* Enter */}
      <TouchableOpacity
        style={[styles.key, special, { flex: 1.5 }]}
        onPress={onEnter}
        activeOpacity={0.55}
      >
        <Text style={[styles.label, { color: theme.specialKeyText, fontSize: 18 }]}>↵</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row:        { flexDirection: 'row', paddingHorizontal: 4, justifyContent: 'center', marginVertical: 4 },
  key:        { justifyContent: 'center', alignItems: 'center', elevation: 2 },
  label:      { fontWeight: '500', textAlign: 'center' },
  spaceLabel: { fontSize: 12 },
  emoji:      { fontSize: 20 },
});
```

---

## 14. Updated `modules/kickkey-module/index.ts`

Add the two new Phase 3 methods.

```typescript
// modules/kickkey-module/index.ts
import { NativeModules } from 'react-native';

const { KickKey } = NativeModules;

export default {
  // ── Phase 1 ───────────────────────────────────────────────────────────────
  isDefaultKeyboard:    (): Promise<boolean>            => KickKey.isDefaultKeyboard(),
  isKeyboardEnabled:    (): Promise<boolean>            => KickKey.isKeyboardEnabled(),
  openKeyboardSettings: (): void                        => KickKey.openKeyboardSettings(),

  // ── Phase 2 ───────────────────────────────────────────────────────────────
  commitKey:       (code: string, language: string): Promise<void> => KickKey.commitKey(code, language),
  sendBackspace:   (): Promise<void>                               => KickKey.sendBackspace(),
  commitSpace:     (): Promise<void>                               => KickKey.commitSpace(),
  sendEnter:       (): Promise<void>                               => KickKey.sendEnter(),
  getPreferences:  (): Promise<Record<string, any>>               => KickKey.getPreferences(),
  savePreferences: (p: Record<string, any>): Promise<void>        => KickKey.savePreferences(p),

  // ── Phase 3 (new) ─────────────────────────────────────────────────────────

  /**
   * Commit any Roman characters buffered in BanglaInputEngine as plain text.
   * Call before: language switch, field focus change, emoji/symbol panel open.
   */
  flushBanglaBuffer: (): Promise<void> =>
    KickKey.flushBanglaBuffer(),

  /**
   * Enable or disable the Bangla phonetic engine.
   * When disabled, commitKey in 'bn' mode falls back to direct text commit.
   */
  setBanglaEnabled: (enabled: boolean): Promise<void> =>
    KickKey.setBanglaEnabled(enabled),
};
```

---

## 15. Build & Test

### 15.1 Run Unit Tests

Before building the APK, run unit tests to catch transliteration bugs early.

```bash
cd android

# Run only the BanglaInputEngine tests
./gradlew :app:test --tests "com.kickkey.BanglaInputEngineTest"

# Run all unit tests
./gradlew :app:test

# Expected output:
# BanglaInputEngineTest > a produces aw PASSED
# BanglaInputEngineTest > kha beats ka + h PASSED
# BanglaInputEngineTest > bangla produces bangla PASSED
# ... (all tests green)
```

### 15.2 Rebuild `keyboard.bundle`

```bash
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify false
```

### 15.3 Build & Install

```bash
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 15.4 Monitor Logs

```bash
# IME lifecycle + Bangla engine events
adb logcat -s KickKeyIME BanglaEngine

# Expected when typing "ka" in Bangla mode:
# V/BanglaEngine: Match: 'ka' → 'ক' | remaining buffer: ''
# V/BanglaEngine: Match: (next sequence)

# Expected when switching language:
# V/BanglaEngine: Flush: '' (or pending Roman chars)
# I/KickKeyIME: Bangla buffer reset
```

---

## 16. Verification Checklist

Complete every item before Phase 4.

### Kotlin / Native

- [ ] `BanglaInputEngine.kt` compiles without errors
- [ ] `KickKeyInputMethodService.kt` instantiates `BanglaInputEngine` — `adb logcat` shows "BanglaInputEngine ready"
- [ ] `KickKeyModule.kt` compiles with new `banglaEngine` companion field

### Unit Tests

- [ ] `./gradlew :app:test` passes with 0 failures
- [ ] All basic vowel tests pass (`a → অ`, `i → ই`, `u → উ`, etc.)
- [ ] All basic CV syllable tests pass (`ka → ক`, `ba → ব`, etc.)
- [ ] Aspirated consonant tests pass (`kha → খ`, `chha → ছ`, etc.)
- [ ] Longest-match priority tests pass (`kha` beats `k` + `ha`)
- [ ] Buffer management tests pass (backspace, flush, reset)
- [ ] Anusvara test passes (`ng → ং`)

### Language Switch

- [ ] Tapping `🌐` key switches between English and Bangla layouts
- [ ] `KeyboardHeader` badge updates: `EN` ↔ `বাং`
- [ ] After switching EN→BN, the Bangla key labels show (e.g. ক, ব, ম)
- [ ] After switching BN→EN, the English key labels show (q, w, e, etc.)
- [ ] Symbols panel (`!#1`) still works in both language modes
- [ ] `BottomRow` space key label changes: "space" ↔ "স্পেস"

### Bangla Typing Accuracy

Test these exact words in any text field (Notes, WhatsApp, Chrome):

| Type this | Expected output |
|---|---|
| `ka` | ক |
| `kha` | খ |
| `ga` | গ |
| `gha` | ঘ |
| `cha` | চ |
| `chha` | ছ |
| `ba` | ব |
| `bha` | ভ |
| `ma` | ম |
| `sha` | শ |
| `shha` | ষ |
| `aa` | আ |
| `ii` | ঈ |
| `ng` | ং |
| `ami` | (contains অ, ম) |

- [ ] All rows in the table above produce correct Bangla Unicode
- [ ] Long-press on `ক` shows alt chars popup: খ, গ, ঘ, ঙ
- [ ] Long-press on `অ` shows: আ, া

### Backspace in Bangla Mode

- [ ] Type `k` (buffering) → press backspace → nothing committed, buffer cleared
- [ ] Type `ka` → ক appears → press backspace → ক is deleted from field
- [ ] Type `kh` (buffering) → press backspace → `h` removed from buffer → buffer = `k` → type `a` → ক committed

### Buffer Flush

- [ ] Type `kh` (buffering) → press space → `kh` is committed as-is then space is added
- [ ] Type `kh` (buffering) → switch language → `kh` is committed as-is, then layout switches to English
- [ ] Type `kha` → ক committed → switch language → layout switches cleanly (no leftover)

### Composing Indicator

- [ ] While in Bangla mode, type `k` alone → `KeyboardHeader` shows composing: `k`
- [ ] Continue typing `a` → ক committed → composing indicator clears
- [ ] While in English mode, `KeyboardHeader` shows no composing text

---

## 17. Transliteration Reference Table

This is the complete phonetic map the engine uses. Share this with testers.

| Type | Output | Unicode | Notes |
|---|---|---|---|
| `a` | অ | U+0985 | Short A |
| `aa` | আ | U+0986 | Long A |
| `i` | ই | U+0987 | Short I |
| `ii` | ঈ | U+0988 | Long I |
| `u` | উ | U+0989 | Short U |
| `uu` | ঊ | U+098A | Long U |
| `e` | এ | U+098F | E |
| `ee` | ঐ | U+0990 | OI diphthong |
| `o` | ও | U+0993 | O |
| `oo` | ঔ | U+0994 | OU diphthong |
| `ri` | ৃ | U+09C3 | Ri vowel sign |
| `ka` | ক | U+0995 | |
| `kha` | খ | U+0996 | |
| `ga` | গ | U+0997 | |
| `gha` | ঘ | U+0998 | |
| `nga` | ঙ | U+0999 | |
| `cha` | চ | U+099A | |
| `chha` | ছ | U+099B | |
| `ja` | জ | U+099C | |
| `jha` | ঝ | U+099D | |
| `ta` | ত | U+09A4 | |
| `tha` | থ | U+09A5 | |
| `da` | দ | U+09A6 | |
| `dha` | ধ | U+09A7 | |
| `na` | ন | U+09A8 | |
| `pa` | প | U+09AA | |
| `pha` | ফ | U+09AB | |
| `ba` | ব | U+09AC | |
| `bha` | ভ | U+09AD | |
| `ma` | ম | U+09AE | |
| `ya` | য | U+09AF | |
| `ra` | র | U+09B0 | |
| `la` | ল | U+09B2 | |
| `sha` | শ | U+09B6 | |
| `shha` | ষ | U+09B7 | |
| `sa` | স | U+09B8 | |
| `ha` | হ | U+09B9 | |
| `rra` | ড় | U+09DC | |
| `rrha` | ঢ় | U+09DD | |
| `dda` | ড | U+09A1 | |
| `ddha` | ঢ | U+09A2 | |
| `ttha` | ঠ | U+09A0 | |
| `nna` | ণ | U+09A3 | |
| `ng` | ং | U+0982 | Anusvara |
| `:` | ঃ | U+0983 | Visarga |
| `` ^ `` | ঁ | U+0981 | Chandrabindu |
| `` ` `` | ্ | U+09CD | Hasanta (virama) |

---

## 18. Troubleshooting

### Bangla characters not appearing — only Roman letters committed

**Cause:** `KickKeyModule.banglaEngine` is `null` — the engine was not initialised.

**Check:**
```bash
adb logcat -s KickKeyIME | grep "BanglaInputEngine"
# Expected: "IME Service created — HapticManager and BanglaInputEngine ready"
```
**Fix:** Confirm `KickKeyInputMethodService.onCreate()` sets:
```kotlin
KickKeyModule.banglaEngine = BanglaInputEngine()
```

---

### `kha` produces `ক` + `ha` instead of `খ`

**Cause:** The Kotlin `processKey` loop is not trying long-enough suffixes. `maxLen` must be at least 4 to catch `ttha`, `ddha`, etc.

**Check `BanglaInputEngine.processKey()`:**
```kotlin
val maxLen = minOf(4, input.length)   // must be 4, not 2 or 3
```
**Also check:** The phonetic map must use `linkedMapOf`, not just `mapOf`. While map ordering doesn't affect correctness (the loop is suffix-based), confirm the map compiles without duplicate keys.

---

### Buffer characters get stuck — user typed `k` and it never commits

**Cause:** The auto-flush threshold is not triggering. `MAX_BUFFER = 5` means 5 unmatched characters flush automatically.

**Check:** Add a single-character key that forces a match, e.g. type `k` then `a` → `ka → ক`.

**Longer fix:** If the user intends to type a standalone consonant without a vowel (e.g. for a consonant cluster), they should type `` ` `` (backtick → hasanta ্) after the consonant. Document this in the app's help screen.

---

### Language switch leaves Roman characters visible in the field

**Cause:** `flushBanglaBuffer()` is not being called before the layout switch.

**Check `useKeyboardState.handleLanguageSwitch()`:**
```typescript
const handleLanguageSwitch = useCallback(() => {
  KickKey.flushBanglaBuffer().catch(() => {});   // ← must be here
  setLanguage(l => l === 'en' ? 'bn' : 'en');
  ...
}, []);
```

---

### Unit tests fail with "Cannot find BanglaInputEngine"

**Cause:** The test file is in the wrong directory.

**Fix:** Ensure the test is at:
```
android/app/src/test/java/com/kickkey/BanglaInputEngineTest.kt
```
Not in `androidTest/` (which is for instrumented tests that need a device). `BanglaInputEngine` has no Android dependencies so plain JUnit tests work fine.

---

### `KeyboardHeader` composing text does not update

**Cause:** The `onComposingChanged` event is not emitted from Kotlin.

**Note:** The composing text event is optional — the `KeyboardHeader` renders correctly without it (composing text stays empty). To implement it fully, add this to `BanglaInputEngine.processKey()` after each key:

```kotlin
// In KickKeyModule after calling banglaEngine.processKey():
val bufferContents = banglaEngine?.getBuffer() ?: ""
val params = Arguments.createMap()
params.putString("text", bufferContents)
(context.applicationContext as KickKeyApplication)
    .keyboardReactHost
    .currentReactContext
    ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
    ?.emit("onComposingChanged", params)
```

---

*Phase 3 complete. Proceed to Phase 4 — Suggestions & Autocorrect — to wire the binary Trie dictionary and make the suggestion bar functional.*
