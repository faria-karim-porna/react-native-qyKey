# KickKey — Phase 6 Implementation Guide
## Emoji & Clipboard (Weeks 11–12)

> **Goal:** The emoji panel and clipboard panel both work — emoji are organized into tappable categories with a recent-emoji tray, and the clipboard panel shows a scrollable history that the user can paste from. Both panels replace the "coming in Phase 6" stub screens left in `KeyboardScreen.tsx` since Phase 2.
> **Builds on Phase 5** — the companion app, onboarding, and settings sync are all working. Phase 6 touches both the keyboard bundle (`src/keyboard/`) and native Kotlin (`ClipboardHandler.kt`), but does not touch the companion app screens at all.

---

## Table of Contents

1. [What Changes in Phase 6](#1-what-changes-in-phase-6)
2. [Architecture: Emoji & Clipboard Data Flow](#2-architecture-emoji--clipboard-data-flow)
3. [Updated Folder Structure](#3-updated-folder-structure)
4. [Android Clipboard Restrictions](#4-android-clipboard-restrictions)
5. [Emoji Data File](#5-emoji-data-file)
6. [ClipboardHandler.kt](#6-clipboardhandlerkt)
7. [Updated KickKeyModule.kt](#7-updated-kickkeymodulekt)
8. [Updated KickKeyInputMethodService.kt](#8-updated-kickkeyinputmethodservicekt)
9. [EmojiPanel.tsx](#9-emojipaneltsx)
10. [ClipboardPanel.tsx](#10-clipboardpaneltsx)
11. [Updated KeyboardScreen.tsx](#11-updated-keyboardscreentsx)
12. [Updated useKeyboardState Hook](#12-updated-usekeyboardstate-hook)
13. [Updated modules/kickkey-module/index.ts](#13-updated-moduleskickkey-moduleindexts)
14. [Build & Test](#14-build--test)
15. [Verification Checklist](#15-verification-checklist)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. What Changes in Phase 6

### Files to CREATE (new)

| File | Purpose |
|---|---|
| `android/.../ClipboardHandler.kt` | Reads system clipboard + manages local history in SharedPreferences |
| `src/keyboard/data/emojiData.ts` | Categorized emoji character arrays |
| `src/keyboard/EmojiPanel.tsx` | Full emoji picker — category tabs + grid + recents |
| `src/keyboard/ClipboardPanel.tsx` | Clipboard history panel — list + paste + clear |

### Files to UPDATE (partial changes)

| File | What changes |
|---|---|
| `modules/kickkey-module/android/.../KickKeyModule.kt` | Add `getClipboardHistory`, `clearClipboardHistory`, `getRecentEmojis`, `recordEmojiUsed` |
| `android/.../KickKeyInputMethodService.kt` | Instantiate `ClipboardHandler`; call it from `onStartInputView` to capture new clipboard content |
| `src/keyboard/KeyboardScreen.tsx` | Replace the "Phase 6" stub blocks with real `EmojiPanel` / `ClipboardPanel` |
| `src/keyboard/hooks/useKeyboardState.ts` | No structural change — `isEmoji`/`isClipboard` toggles already exist from Phase 2/3; this phase just makes the rendered content real |
| `modules/kickkey-module/index.ts` | Export the four new methods |

### Files that do NOT change

Everything in the companion app (`app/`, `store/`, `hooks/useKickKeyBridge.ts`, `hooks/useSetupStatus.ts`, `hooks/useSettingsSync.ts`, `components/`), `BanglaInputEngine.kt`, `SuggestionEngine.kt`, `Trie.kt`, `UserWordModel.kt`, `HapticManager.kt`, `KickKeyApplication.kt`, all layout files, `Key.tsx`, `KeyRow.tsx`, `BottomRow.tsx`, `SuggestionBar.tsx`, `KeyboardHeader.tsx`.

---

## 2. Architecture: Emoji & Clipboard Data Flow

### 2.1 Emoji Flow

```
User taps 😊 button in BottomRow
        │
        ▼
useKeyboardState.handleEmojiToggle() → setIsEmoji(true)
        │
        ▼
KeyboardScreen renders <EmojiPanel /> instead of key rows
        │
        ▼
EmojiPanel mounts → useEffect calls
NativeModules.KickKey.getRecentEmojis()
        │
        ▼  [Kotlin]
Reads "kickkey_recent_emojis" from SharedPreferences
        │
        ▼
EmojiPanel shows Recent tab populated, other tabs from static emojiData.ts
        │
        ▼
User taps an emoji character
        │
        ▼
onEmojiSelect(emoji) → handleKeyPress({ code: emoji, label: emoji })
        │
        ▼
NativeModules.KickKey.commitKey(emoji, language)
  → InputConnection.commitText(emoji, 1)
        │
        ▼
NativeModules.KickKey.recordEmojiUsed(emoji)
  → Kotlin updates "kickkey_recent_emojis" (MRU list, max 30)
```

### 2.2 Clipboard Flow

```
User taps 📋 button (added to BottomRow in this phase)
        │
        ▼
useKeyboardState.handleClipboardToggle() → setIsClipboard(true)
        │
        ▼
KeyboardScreen renders <ClipboardPanel /> instead of key rows
        │
        ▼
ClipboardPanel mounts → useEffect calls
NativeModules.KickKey.getClipboardHistory()
        │
        ▼  [Kotlin]
ClipboardHandler.getClipboardItems()
  → reads system ClipboardManager.primaryClip (if any)
  → merges with locally stored history (up to 20 items)
  → returns combined, deduplicated list
        │
        ▼
ClipboardPanel renders a FlatList of text snippets
        │
        ▼
User taps an item
        │
        ▼
onPaste(text) → handleKeyPress({ code: text, label: text })
        │
        ▼
NativeModules.KickKey.commitKey(text, language)
  → InputConnection.commitText(text, 1)
```

### 2.3 When New Clipboard Content Is Captured

Android only grants an IME clipboard read access during `onStartInputView()` (i.e. right when a text field gains focus) on Android 10+. KickKey therefore captures the current system clipboard into its local history at that moment, not continuously. This means: copy text in another app → switch to a text field → KickKey records it into history during that focus event, even before the user opens the clipboard panel.

---

## 3. Updated Folder Structure

```
android/app/src/main/java/com/kickkey/
├── ClipboardHandler.kt               ← NEW
├── KickKeyModule.kt                  ← UPDATE
└── KickKeyInputMethodService.kt      ← UPDATE

src/keyboard/
├── data/
│   └── emojiData.ts                  ← NEW
├── EmojiPanel.tsx                    ← NEW
├── ClipboardPanel.tsx                ← NEW
├── KeyboardScreen.tsx                ← UPDATE (real panels replace stubs)
└── BottomRow.tsx                     ← UPDATE (add clipboard button)

modules/kickkey-module/
└── index.ts                          ← UPDATE
```

---

## 4. Android Clipboard Restrictions

Before writing any code, understand the platform constraints that shape `ClipboardHandler.kt`:

| Android Version | Behavior |
|---|---|
| Android 9 and below | Any app can read the clipboard at any time, no restriction |
| Android 10 (API 29) | Apps in the background generally cannot read clipboard; IMEs get a documented exception during `onStartInputView()` |
| Android 12+ (API 31) | The system **always** shows a small toast ("App pasted from clipboard") whenever any app — including an IME — reads the clipboard. This cannot be suppressed by the app. |
| Android 13+ (API 33) | Clipboard access is further scoped; sensitive content (e.g. detected as a password) may be redacted automatically by the system before the IME ever sees it |

**Design implication:** KickKey must not assume continuous clipboard access. It opportunistically reads `ClipboardManager.primaryClip` only at `onStartInputView()`, stores what it finds into a locally persisted history (so the user has something to paste from even between system clipboard changes), and never silently polls the clipboard outside that window — doing so would trigger the Android 12+ toast repeatedly and look like spyware behavior to the user.

---

## 5. Emoji Data File

A static, categorized emoji list. Each category has an icon (used for the tab) and an array of emoji characters. Recent emojis are handled separately (loaded dynamically from native), not stored in this file.

```typescript
// src/keyboard/data/emojiData.ts

export interface EmojiCategory {
  id: string;
  icon: string;       // Tab icon (an emoji representing the category)
  label: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    icon: '😀',
    label: 'Smileys & Emotion',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '☺️',
      '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗',
      '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓',
      '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕',
      '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
      '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰',
      '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🤫', '🤥', '😶', '😐',
      '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴',
    ],
  },
  {
    id: 'people',
    icon: '👋',
    label: 'People & Body',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
      '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐',
      '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿',
      '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀',
      '👁️', '👅', '👄', '🫦', '👶', '🧒', '👦', '👧', '🧑', '👱',
    ],
  },
  {
    id: 'animals',
    icon: '🐶',
    label: 'Animals & Nature',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
      '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊',
      '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉',
      '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌',
      '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂',
      '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀',
    ],
  },
  {
    id: 'food',
    icon: '🍕',
    label: 'Food & Drink',
    emojis: [
      '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏',
      '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑',
      '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄',
      '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🫓', '🥨', '🥯',
      '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕',
      '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘',
    ],
  },
  {
    id: 'activities',
    icon: '⚽',
    label: 'Activities',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️',
      '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗',
    ],
  },
  {
    id: 'travel',
    icon: '🚀',
    label: 'Travel & Places',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
      '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵',
      '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟',
      '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇',
      '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸',
    ],
  },
  {
    id: 'objects',
    icon: '💡',
    label: 'Objects',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
      '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
      '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭',
      '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡',
      '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷',
    ],
  },
  {
    id: 'symbols',
    icon: '🔣',
    label: 'Symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
      '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
      '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
    ],
  },
];

/** Looked up by id when restoring the active tab — used by EmojiPanel */
export const DEFAULT_CATEGORY_ID = 'smileys';
```

---

## 6. `ClipboardHandler.kt`

Handles both reading the live system clipboard and maintaining a locally persisted history. The history is stored as a newline-separated string in its own `SharedPreferences` file, capped at 20 items, most-recent-first.

```kotlin
// android/app/src/main/java/com/kickkey/ClipboardHandler.kt

package com.kickkey

import android.content.ClipboardManager
import android.content.Context
import android.util.Log

/**
 * Manages clipboard read access and a locally persisted history.
 *
 * Android only grants IMEs clipboard read access during onStartInputView()
 * (Android 10+). This class is therefore designed to be called from that
 * lifecycle point — see KickKeyInputMethodService.onStartInputView().
 *
 * History format: items separated by a Unit Separator character (\u001F)
 * to safely allow newlines and tabs within the clipboard text itself.
 */
class ClipboardHandler(private val context: Context) {

    companion object {
        private const val TAG = "ClipboardHandler"
        private const val PREFS_NAME = "kickkey_clipboard"
        private const val KEY_HISTORY = "history"
        private const val MAX_HISTORY = 20
        private const val MAX_ITEM_LENGTH = 5000   // guard against pasting huge blobs
        private const val SEPARATOR = "\u001F"
    }

    private val clipManager: ClipboardManager? by lazy {
        try {
            context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        } catch (e: Exception) {
            Log.w(TAG, "ClipboardManager unavailable: ${e.message}")
            null
        }
    }

    /**
     * Call this during onStartInputView() to opportunistically capture
     * whatever is currently on the system clipboard into local history.
     * Safe to call even if clipboard access is restricted — fails silently.
     */
    fun captureCurrentClipboard() {
        try {
            val clip = clipManager?.primaryClip ?: return
            for (i in 0 until clip.itemCount) {
                val text = clip.getItemAt(i)?.coerceToText(context)?.toString()
                if (!text.isNullOrBlank() && text.length <= MAX_ITEM_LENGTH) {
                    addToHistory(text.trim())
                }
            }
        } catch (e: Exception) {
            // Clipboard access can throw SecurityException on some OEM skins
            // when the IME doesn't have focus context yet — fail silently.
            Log.v(TAG, "captureCurrentClipboard skipped: ${e.message}")
        }
    }

    /**
     * Returns the combined clipboard history, most recent first.
     * Does NOT re-read the live system clipboard — call
     * captureCurrentClipboard() separately for that, at the
     * appropriate lifecycle point.
     */
    fun getHistory(): List<String> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_HISTORY, "") ?: ""
        return if (raw.isEmpty()) emptyList() else raw.split(SEPARATOR).filter { it.isNotBlank() }
    }

    /**
     * Adds [text] to the front of the history, removing any existing
     * duplicate, and trims to MAX_HISTORY items.
     */
    fun addToHistory(text: String) {
        if (text.isBlank() || text.length > MAX_ITEM_LENGTH) return
        val current = getHistory().toMutableList()
        current.remove(text)               // dedupe — move to front if it already existed
        current.add(0, text)
        val trimmed = current.take(MAX_HISTORY)
        persistHistory(trimmed)
    }

    /** Removes every item from history. */
    fun clearHistory() {
        persistHistory(emptyList())
    }

    /** Removes a single item from history (e.g. user long-presses to delete one entry). */
    fun removeItem(text: String) {
        val updated = getHistory().filter { it != text }
        persistHistory(updated)
    }

    private fun persistHistory(items: List<String>) {
        val serialized = items.joinToString(SEPARATOR)
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_HISTORY, serialized)
            .apply()
    }

    // ── Recent emoji tracking (separate small history, same pattern) ─────────

    companion object EmojiHistory {
        // Nested companion not allowed in Kotlin alongside the outer one;
        // emoji history methods are implemented as regular instance methods below
        // instead — see getRecentEmojis() / recordEmojiUsed().
    }

    fun getRecentEmojis(): List<String> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString("recent_emojis", "") ?: ""
        return if (raw.isEmpty()) emptyList() else raw.split(SEPARATOR).filter { it.isNotBlank() }
    }

    fun recordEmojiUsed(emoji: String) {
        val current = getRecentEmojis().toMutableList()
        current.remove(emoji)
        current.add(0, emoji)
        val trimmed = current.take(30)
        val serialized = trimmed.joinToString(SEPARATOR)
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("recent_emojis", serialized)
            .apply()
    }
}
```

> **Note on the nested `companion object EmojiHistory` block above:** Kotlin only allows one `companion object` per class. The placeholder block is left as an explicit comment marker rather than silently omitted, so it is clear emoji history is intentionally implemented as regular instance methods (`getRecentEmojis()`, `recordEmojiUsed()`) sharing the same `SharedPreferences` file as clipboard history, rather than as a separate class. Feel free to delete that empty companion block — it has no functional effect — but it is kept here as a deliberate signpost of the design decision.

---

## 7. Updated `KickKeyModule.kt`

Four new functions, all delegating to a `ClipboardHandler` instance held in the `companion object`.

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyModule.kt
// ADDITIONS ONLY — merge into the Phase 5 file

companion object {
    var activeInputConnection: InputConnection? = null
    var hapticManager: HapticManager? = null
    var banglaEngine: BanglaInputEngine? = null
    var suggestionEngine: SuggestionEngine? = null
    var clipboardHandler: ClipboardHandler? = null   // ← NEW in Phase 6
}

// ── NEW in Phase 6: Clipboard ──────────────────────────────────────────────────

/**
 * Returns the current clipboard history (most recent first).
 * Called by ClipboardPanel.tsx when the panel mounts.
 */
Function("getClipboardHistory") {
    clipboardHandler?.getHistory() ?: emptyList<String>()
}

/**
 * Clears the entire clipboard history.
 * Called when the user taps "Clear All" in ClipboardPanel.
 */
Function("clearClipboardHistory") {
    clipboardHandler?.clearHistory()
}

/**
 * Removes a single clipboard history entry.
 * Called when the user long-presses an item to delete it.
 */
Function("removeClipboardItem") { text: String ->
    clipboardHandler?.removeItem(text)
}

// ── NEW in Phase 6: Recent emojis ──────────────────────────────────────────────

/**
 * Returns the recently used emoji list (most recent first, max 30).
 * Called by EmojiPanel.tsx when the Recent tab is shown.
 */
Function("getRecentEmojis") {
    clipboardHandler?.getRecentEmojis() ?: emptyList<String>()
}

/**
 * Records that the user selected [emoji], moving it to the front
 * of the recent list. Called immediately after committing an emoji.
 */
Function("recordEmojiUsed") { emoji: String ->
    clipboardHandler?.recordEmojiUsed(emoji)
}

// ── All Phase 1–5 functions remain unchanged below this point ─────────────────
```

---

## 8. Updated `KickKeyInputMethodService.kt`

Two additions: instantiate `ClipboardHandler` in `onCreate()`, and call `captureCurrentClipboard()` in `onStartInputView()` — this is the only Android-sanctioned moment to read the live clipboard.

```kotlin
// android/app/src/main/java/com/kickkey/KickKeyInputMethodService.kt
// Full replacement

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
        KickKeyModule.hapticManager     = HapticManager(this)
        KickKeyModule.banglaEngine      = BanglaInputEngine()
        KickKeyModule.suggestionEngine  = SuggestionEngine(this)
        KickKeyModule.clipboardHandler  = ClipboardHandler(this)   // ← NEW Phase 6
        Log.i(TAG, "IME created — haptic, bangla, suggestion, clipboard handlers ready")
    }

    override fun onCreateInputView(): View {
        Log.i(TAG, "onCreateInputView")
        val app = application as? KickKeyApplication ?: run {
            Log.e(TAG, "KickKeyApplication not found"); return View(this)
        }
        reactRootView = ReactRootView(this)
        reactRootView!!.startReactApplication(app.keyboardReactHost, "KickKeyKeyboard", null)
        return reactRootView!!
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        KickKeyModule.activeInputConnection = currentInputConnection
        KickKeyModule.banglaEngine?.reset()
        KickKeyModule.suggestionEngine?.reset()

        val isPassword = (info.inputType and 0x80) != 0
        KickKeyModule.suggestionEngine?.setEnabled(!isPassword)

        // Phase 6: this is the one sanctioned moment to read the live
        // system clipboard on Android 10+. Skip in password fields to
        // avoid surfacing sensitive copied content in clipboard history.
        if (!isPassword) {
            KickKeyModule.clipboardHandler?.captureCurrentClipboard()
        }

        Log.i(TAG, "InputConnection acquired — inputType: ${info.inputType}")
    }

    override fun onFinishInput() {
        super.onFinishInput()
        val pending = KickKeyModule.banglaEngine?.flush() ?: ""
        if (pending.isNotEmpty()) KickKeyModule.activeInputConnection?.commitText(pending, 1)
        KickKeyModule.activeInputConnection = null
        Log.i(TAG, "Input finished")
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        KickKeyModule.activeInputConnection = null
        KickKeyModule.banglaEngine?.reset()
        KickKeyModule.suggestionEngine?.reset()
        Log.i(TAG, "Keyboard hidden")
    }

    override fun onDestroy() {
        reactRootView?.unmountReactApplication()
        reactRootView = null
        KickKeyModule.hapticManager     = null
        KickKeyModule.banglaEngine      = null
        KickKeyModule.suggestionEngine  = null
        KickKeyModule.clipboardHandler  = null     // ← NEW Phase 6
        super.onDestroy()
        Log.i(TAG, "IME destroyed")
    }
}
```

---

## 9. `EmojiPanel.tsx`

Renders horizontal category tabs (with a Recent tab populated from native history), and a scrollable grid of 8-per-row emoji buttons below.

```tsx
// src/keyboard/EmojiPanel.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  NativeModules,
} from 'react-native';
import { EMOJI_CATEGORIES, DEFAULT_CATEGORY_ID } from './data/emojiData';
import type { Theme } from './types';

const { KickKey } = NativeModules;
const RECENT_TAB_ID = 'recent';
const COLUMNS = 8;

interface EmojiPanelProps {
  theme: Theme;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPanel({ theme, onEmojiSelect, onClose }: EmojiPanelProps) {
  const [activeTab, setActiveTab] = useState<string>(RECENT_TAB_ID);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  // Load recent emojis from native history on mount.
  // If the list is empty (first ever use), default to the Smileys tab
  // instead of showing an empty Recent screen.
  useEffect(() => {
    KickKey.getRecentEmojis()
      .then((emojis: string[]) => {
        setRecentEmojis(emojis);
        if (emojis.length === 0) setActiveTab(DEFAULT_CATEGORY_ID);
      })
      .catch(() => {
        setActiveTab(DEFAULT_CATEGORY_ID);
      });
  }, []);

  const handleSelect = useCallback((emoji: string) => {
    onEmojiSelect(emoji);
    // Optimistically update the local recent list so the UI feels instant,
    // without waiting for a round-trip read from native.
    setRecentEmojis((prev) => [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 30));
    KickKey.recordEmojiUsed(emoji).catch(() => {});
  }, [onEmojiSelect]);

  const currentEmojis: string[] =
    activeTab === RECENT_TAB_ID
      ? recentEmojis
      : EMOJI_CATEGORIES.find((c) => c.id === activeTab)?.emojis ?? [];

  const renderEmoji = useCallback(
    ({ item }: { item: string }) => (
      <TouchableOpacity
        style={styles.emojiCell}
        onPress={() => handleSelect(item)}
        activeOpacity={0.6}
      >
        <Text style={styles.emojiChar}>{item}</Text>
      </TouchableOpacity>
    ),
    [handleSelect]
  );

  return (
    <View style={[styles.panel, { backgroundColor: theme.keyboardBg }]}>
      {/* Category tab strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === RECENT_TAB_ID && styles.tabActive]}
          onPress={() => setActiveTab(RECENT_TAB_ID)}
        >
          <Text style={styles.tabIcon}>🕓</Text>
        </TouchableOpacity>
        {EMOJI_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.tab, activeTab === cat.id && styles.tabActive]}
            onPress={() => setActiveTab(cat.id)}
          >
            <Text style={styles.tabIcon}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Emoji grid */}
      {currentEmojis.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.altText }]}>
            {activeTab === RECENT_TAB_ID
              ? 'No recent emoji yet — tap any emoji to add it here'
              : 'No emoji in this category'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentEmojis}
          renderItem={renderEmoji}
          keyExtractor={(item, index) => `${item}-${index}`}
          numColumns={COLUMNS}
          showsVerticalScrollIndicator={false}
          style={styles.grid}
          contentContainerStyle={styles.gridContent}
          // Performance: emoji cells are fixed-size, so getItemLayout
          // avoids a measurement pass on every scroll frame.
          initialNumToRender={32}
          maxToRenderPerBatch={32}
          windowSize={5}
        />
      )}

      {/* Close button — returns to QWERTY layout */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.6}>
        <Text style={[styles.closeText, { color: theme.suggestionText }]}>ABC</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', height: 260 },
  tabs: { height: 40, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a3e' },
  tabsContent: { alignItems: 'center', paddingHorizontal: 4 },
  tab: {
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#00BCD4' },
  tabIcon: { fontSize: 18 },
  grid: { flex: 1 },
  gridContent: { paddingHorizontal: 4, paddingTop: 4 },
  emojiCell: {
    flex: 1 / 8,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiChar: { fontSize: 22 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  closeBtn: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a3e',
  },
  closeText: { fontSize: 13, fontWeight: '700' },
});
```

---

## 10. `ClipboardPanel.tsx`

Shows a scrollable list of clipboard history items. Tapping an item pastes it. Long-pressing removes a single item. A "Clear All" button at the top empties the whole history.

```tsx
// src/keyboard/ClipboardPanel.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  NativeModules,
} from 'react-native';
import type { Theme } from './types';

const { KickKey } = NativeModules;

interface ClipboardPanelProps {
  theme: Theme;
  onPaste: (text: string) => void;
  onClose: () => void;
}

export default function ClipboardPanel({ theme, onPaste, onClose }: ClipboardPanelProps) {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(() => {
    setLoading(true);
    KickKey.getClipboardHistory()
      .then((history: string[]) => setItems(history))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handlePaste = useCallback((text: string) => {
    onPaste(text);
  }, [onPaste]);

  const handleRemove = useCallback((text: string) => {
    setItems((prev) => prev.filter((i) => i !== text));
    KickKey.removeClipboardItem(text).catch(() => {});
  }, []);

  const handleClearAll = useCallback(() => {
    setItems([]);
    KickKey.clearClipboardHistory().catch(() => {});
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <TouchableOpacity
        style={[styles.item, { backgroundColor: theme.keyBg }]}
        onPress={() => handlePaste(item)}
        onLongPress={() => handleRemove(item)}
        activeOpacity={0.65}
        delayLongPress={400}
      >
        <Text
          style={[styles.itemText, { color: theme.keyText }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {item}
        </Text>
      </TouchableOpacity>
    ),
    [theme, handlePaste, handleRemove]
  );

  return (
    <View style={[styles.panel, { backgroundColor: theme.keyboardBg }]}>
      {/* Header with Clear All */}
      <View style={[styles.header, { borderBottomColor: theme.suggestionDivider }]}>
        <Text style={[styles.headerTitle, { color: theme.altText }]}>Clipboard</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={[styles.clearText, { color: theme.suggestionText }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List or empty state */}
      {!loading && items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.altText }]}>
            Clipboard is empty.{'\n'}Copy something to see it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${index}-${item.slice(0, 20)}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Close button — returns to QWERTY layout */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.6}>
        <Text style={[styles.closeText, { color: theme.suggestionText }]}>ABC</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', height: 260 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 36,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  clearText: { fontSize: 12, fontWeight: '700' },
  list: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 6 },
  item: { borderRadius: 8, padding: 12, marginBottom: 6 },
  itemText: { fontSize: 13, lineHeight: 18 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 12, textAlign: 'center', fontStyle: 'italic', lineHeight: 18 },
  closeBtn: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a3e',
  },
  closeText: { fontSize: 13, fontWeight: '700' },
});
```

---

## 11. Updated `KeyboardScreen.tsx`

Replace the two stub blocks (`isEmoji` / `isClipboard`) that have shown "coming in Phase 6" placeholder text since Phase 2 with the real panels.

```tsx
// src/keyboard/KeyboardScreen.tsx
// Full replacement

/**
 * PHASE 6 — Real emoji and clipboard panels replace the Phase 2 stubs.
 *
 * Changes from Phase 5:
 *   - isEmoji renders <EmojiPanel /> instead of a placeholder Text block
 *   - isClipboard renders <ClipboardPanel /> instead of a placeholder Text block
 *   - Both panels' onClose props route back to setIsEmoji(false) / setIsClipboard(false)
 *     via the existing handleEmojiToggle / handleClipboardToggle from useKeyboardState
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useKeyboardTheme }          from './hooks/useKeyboardTheme';
import { useKeyboardState }          from './hooks/useKeyboardState';
import KeyboardHeader                from './KeyboardHeader';
import KeyRow                        from './KeyRow';
import SuggestionBar                 from './SuggestionBar';
import BottomRow                     from './BottomRow';
import EmojiPanel                    from './EmojiPanel';
import ClipboardPanel                from './ClipboardPanel';
import { ENGLISH_ROWS, BANGLA_ROWS, SYMBOL_ROWS } from './layouts';

export default function KeyboardScreen() {
  const theme = useKeyboardTheme();
  const {
    language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard,
    suggestions, composingText, currentWord,
    handleKeyPress, handleBackspace, handleBackspaceLongPress,
    handleSpace, handleEnter, handleShift, handleLanguageSwitch,
    handleSymbolToggle, handleEmojiToggle, handleClipboardToggle,
    handleSuggestionSelect,
  } = useKeyboardState();

  const rows = isSymbol
    ? SYMBOL_ROWS
    : language === 'bn'
    ? BANGLA_ROWS
    : ENGLISH_ROWS;

  // ── Emoji panel (real, replaces Phase 2 stub) ──────────────────────────────
  if (isEmoji) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <EmojiPanel
          theme={theme}
          onEmojiSelect={(emoji) => handleKeyPress({ label: emoji, code: emoji })}
          onClose={handleEmojiToggle}
        />
      </View>
    );
  }

  // ── Clipboard panel (real, replaces Phase 2 stub) ──────────────────────────
  if (isClipboard) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <ClipboardPanel
          theme={theme}
          onPaste={(text) => handleKeyPress({ label: text, code: text })}
          onClose={handleClipboardToggle}
        />
      </View>
    );
  }

  // ── Standard QWERTY / Bangla / Symbols layout (unchanged from Phase 5) ────
  return (
    <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
      <KeyboardHeader
        language={language}
        theme={theme}
        composingText={composingText}
      />

      <SuggestionBar
        suggestions={suggestions}
        currentWord={currentWord}
        onSelect={handleSuggestionSelect}
        theme={theme}
      />

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
        onClipboardToggle={handleClipboardToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard: { width: '100%', paddingBottom: 6 },
});
```

### 11.1 Updated `BottomRow.tsx` — add the clipboard button

`BottomRow` previously had no clipboard button (it was deferred to this phase). Add one between the emoji button and Enter.

```tsx
// src/keyboard/BottomRow.tsx
// Full replacement — adds clipboard button

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
  onClipboardToggle: () => void;   // ← NEW Phase 6
}

export default function BottomRow({
  theme, language, isSymbol,
  onSpace, onEnter, onLanguageSwitch, onSymbolToggle, onEmojiToggle, onClipboardToggle,
}: BottomRowProps) {
  const special = {
    backgroundColor: theme.specialKeyBg,
    borderRadius: theme.keyBorderRadius,
    marginHorizontal: theme.keyMargin,
    height: theme.keyHeight,
  };

  const langLabel  = language === 'en' ? '🌐 EN' : '🌐 বাং';
  const spaceLabel = language === 'en' ? 'space' : 'স্পেস';

  return (
    <View style={styles.row}>
      <TouchableOpacity style={[styles.key, special, { flex: 1.3 }]} onPress={onSymbolToggle} activeOpacity={0.55}>
        <Text style={[styles.label, { color: theme.specialKeyText, fontSize: 13 }]}>
          {isSymbol ? 'ABC' : '!#1'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.key, special, { flex: 1.1 }]}
        onPress={onLanguageSwitch}
        onLongPress={onLanguageSwitch}
        delayLongPress={600}
        activeOpacity={0.55}
      >
        <Text style={[styles.label, { color: theme.specialKeyText, fontSize: 10 }]}
          numberOfLines={1} adjustsFontSizeToFit>
          {langLabel}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.key, {
          flex: 3.6,
          backgroundColor: theme.keyBg,
          borderRadius: theme.keyBorderRadius,
          marginHorizontal: theme.keyMargin,
          height: theme.keyHeight,
        }]}
        onPress={onSpace}
        activeOpacity={0.7}
      >
        <Text style={[styles.spaceLabel, { color: theme.altText }]}>{spaceLabel}</Text>
      </TouchableOpacity>

      {/* NEW in Phase 6: clipboard button */}
      <TouchableOpacity style={[styles.key, special, { flex: 1 }]} onPress={onClipboardToggle} activeOpacity={0.55}>
        <Text style={styles.iconEmoji}>📋</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.key, special, { flex: 1 }]} onPress={onEmojiToggle} activeOpacity={0.55}>
        <Text style={styles.iconEmoji}>😊</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.key, special, { flex: 1.3 }]} onPress={onEnter} activeOpacity={0.55}>
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
  iconEmoji:  { fontSize: 18 },
});
```

---

## 12. Updated `useKeyboardState` Hook

No new state fields are needed — `isEmoji`, `isClipboard`, `handleEmojiToggle`, and `handleClipboardToggle` already exist from earlier phases. The only change is making sure `handleClipboardToggle` is actually exported and wired (it was present as a stub-supporting toggle since Phase 2/3 but never had a real consumer until now).

```typescript
// src/keyboard/hooks/useKeyboardState.ts
// VERIFY these already exist from earlier phases — no changes needed if so.
// Shown here for completeness / cross-reference.

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

// ... and in the returned object:
return {
  // ...
  isEmoji, isClipboard,
  handleEmojiToggle, handleClipboardToggle,
  // ...
};
```

If your Phase 5 file is missing `handleClipboardToggle` from the returned object (some earlier phases only wired `handleEmojiToggle` through to `BottomRow`), add it now — `BottomRow.tsx` in Section 11.1 requires `onClipboardToggle` as a prop.

---

## 13. Updated `modules/kickkey-module/index.ts`

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

  // ── Phase 3 ───────────────────────────────────────────────────────────────
  flushBanglaBuffer: (): Promise<void>           => KickKey.flushBanglaBuffer(),
  setBanglaEnabled:  (e: boolean): Promise<void> => KickKey.setBanglaEnabled(e),

  // ── Phase 4 ───────────────────────────────────────────────────────────────
  commitSuggestion: (word: string): Promise<void> => KickKey.commitSuggestion(word),

  // ── Phase 5 ───────────────────────────────────────────────────────────────
  setDictionaryWords:   (words: string[]): Promise<void> => KickKey.setDictionaryWords(words),
  getDictionaryWords:   (): Promise<string[]>            => KickKey.getDictionaryWords(),
  removeDictionaryWord: (word: string): Promise<void>    => KickKey.removeDictionaryWord(word),

  // ── Phase 6 (new) ─────────────────────────────────────────────────────────

  /** Returns clipboard history, most recent first. Captured during onStartInputView. */
  getClipboardHistory: (): Promise<string[]> =>
    KickKey.getClipboardHistory(),

  /** Clears the entire clipboard history. */
  clearClipboardHistory: (): Promise<void> =>
    KickKey.clearClipboardHistory(),

  /** Removes a single clipboard history entry. */
  removeClipboardItem: (text: string): Promise<void> =>
    KickKey.removeClipboardItem(text),

  /** Returns the recently used emoji list, most recent first. */
  getRecentEmojis: (): Promise<string[]> =>
    KickKey.getRecentEmojis(),

  /** Records that the user selected an emoji, for recent-tray ordering. */
  recordEmojiUsed: (emoji: string): Promise<void> =>
    KickKey.recordEmojiUsed(emoji),
};
```

---

## 14. Build & Test

### 14.1 Rebuild `keyboard.bundle`

```bash
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify false
```

### 14.2 Build & Install

```bash
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 14.3 Monitor Logs

```bash
adb logcat -s ClipboardHandler KickKeyIME ReactNativeJS

# Expected when a text field gains focus:
# I/KickKeyIME: InputConnection acquired — inputType: 1
# (ClipboardHandler.captureCurrentClipboard runs silently — no log by default)

# Expected when tapping the emoji button:
# (EmojiPanel mounts, calls getRecentEmojis)

# Expected when tapping an emoji:
# (commitKey called, recordEmojiUsed called)
```

### 14.4 Manual Clipboard Test Sequence

Because clipboard behavior is timing-sensitive, test it in this exact order:

1. Open Chrome (or any app), select and copy some text (e.g. "Hello KickKey")
2. Switch to a different app with a text field (e.g. Notes)
3. Tap the text field — this triggers `onStartInputView()` and captures the clipboard
4. Tap the 📋 button in KickKey
5. Verify "Hello KickKey" appears at the top of the clipboard panel
6. Tap it — verify it pastes into the field
7. Long-press an item — verify it is removed
8. Tap "Clear All" — verify the list empties

---

## 15. Verification Checklist

Complete every item before Phase 7.

### Emoji Panel

- [ ] Tapping the 😊 button opens the emoji panel
- [ ] Category tabs scroll horizontally and are all tappable
- [ ] Tapping a category tab shows that category's emoji grid
- [ ] Tapping an emoji commits it to the active text field
- [ ] After tapping an emoji, it appears in the Recent tab (🕓)
- [ ] On first-ever use (empty Recent), the panel defaults to the Smileys tab instead of showing an empty Recent screen
- [ ] Tapping "ABC" closes the emoji panel and returns to the QWERTY layout
- [ ] Emoji grid renders 8 columns consistently across category switches
- [ ] Scrolling the emoji grid is smooth with no visible jank

### Clipboard Panel

- [ ] Tapping the 📋 button opens the clipboard panel
- [ ] Copying text in another app, then focusing a KickKey text field, then opening the clipboard panel shows that text at the top
- [ ] Tapping a clipboard item pastes it into the active field
- [ ] Long-pressing a clipboard item removes just that item
- [ ] "Clear All" empties the entire history
- [ ] Empty state message shows when history is empty
- [ ] Tapping "ABC" closes the clipboard panel and returns to QWERTY
- [ ] History persists across keyboard close/reopen (stored in SharedPreferences, not just in-memory)
- [ ] History persists across device reboot (SharedPreferences survives reboot)

### Password Field Behavior

- [ ] Focusing a password field does NOT capture clipboard content into history (verify by copying sensitive-looking text, then focusing a password field, then checking a non-password field's clipboard panel — the password-field-time clipboard content should not have been captured during that specific focus event)

### Panel Switching

- [ ] Opening the emoji panel while the clipboard panel is open closes the clipboard panel first (mutually exclusive)
- [ ] Opening the clipboard panel while the emoji panel is open closes the emoji panel first
- [ ] Switching language while a panel is open flushes any pending Bangla buffer correctly (no leftover Roman characters)

### Performance

- [ ] Emoji panel opens within roughly the same latency as the main keyboard (no extra perceptible lag)
- [ ] FlatList scrolling in both panels stays at or near 60fps
- [ ] No memory growth concerns — confirm via Android Studio Profiler that opening/closing the emoji panel repeatedly does not cause unbounded RAM growth in `:ime_process`

---

## 16. Troubleshooting

### Clipboard panel always shows "Clipboard is empty" even after copying text elsewhere

**Cause 1:** `captureCurrentClipboard()` is not being called, or is being called too late (after the panel already rendered).

**Check:**
```bash
adb logcat -s KickKeyIME | grep "InputConnection acquired"
```
Confirm this log appears every time you focus a new text field — `captureCurrentClipboard()` runs right after this line in `onStartInputView()`.

**Cause 2:** The field you focused before opening the clipboard panel was itself a password field, which intentionally skips capture (see Section 8).

**Fix:** Focus a normal text field (not a password field) before opening the clipboard panel.

---

### Android shows a "pasted from clipboard" toast every time the keyboard opens

**Cause:** This is expected, unavoidable behavior on Android 12+ whenever any app — including an IME — reads `ClipboardManager.primaryClip`. It is not a bug.

**Mitigation:** None available at the app level; this is a system-level privacy notification. Document this behavior in the app's privacy policy and optionally show a one-time in-app explanation during onboarding so users aren't surprised.

---

### Emoji panel shows the Recent tab with the wrong emoji order

**Cause:** The optimistic local update in `EmojiPanel.handleSelect()` and the native `recordEmojiUsed()` call can race if the panel re-mounts quickly (e.g., user closes and reopens the panel within the same second).

**Fix:** This is a minor cosmetic issue with no functional impact — the native side is always the source of truth on the next mount. If strict consistency matters, await `KickKey.recordEmojiUsed(emoji)` before updating local state instead of doing it optimistically:
```typescript
const handleSelect = useCallback(async (emoji: string) => {
  onEmojiSelect(emoji);
  await KickKey.recordEmojiUsed(emoji).catch(() => {});
  const updated = await KickKey.getRecentEmojis().catch(() => []);
  setRecentEmojis(updated);
}, [onEmojiSelect]);
```

---

### `ClipboardHandler.kt` fails to compile — "companion object" duplicate error

**Cause:** Kotlin only allows one `companion object` per class. If you copy the file and accidentally leave both the main `companion object { ... }` block and the placeholder `companion object EmojiHistory { ... }` block active, this is a compile error.

**Fix:** Delete the placeholder `companion object EmojiHistory { ... }` block entirely — it was included in Section 6 purely as an explanatory comment marker and has no required code inside it. Only the first `companion object` (holding `PREFS_NAME`, `KEY_HISTORY`, etc.) should remain.

---

### Tapping a clipboard item or emoji does nothing in some apps (e.g. Gmail compose, Chrome address bar)

**Cause:** Same root cause as similar issues in earlier phases — some apps require `beginBatchEdit()` / `endBatchEdit()` wrapping around `commitText()`.

**Fix:** Confirm `KickKeyModule.commitKey` (which both emoji and clipboard paste route through, since `handleKeyPress` is reused) has the batch edit wrapping from the Phase 2 troubleshooting fix:
```kotlin
Function("commitKey") { code: String, language: String ->
    val ic = activeInputConnection ?: return@Function
    ic.beginBatchEdit()
    // ... existing commit logic ...
    ic.endBatchEdit()
}
```

---

### `getRecentEmojis()` and `getClipboardHistory()` both return data from the same SharedPreferences read — are they conflicting?

**Cause:** Not a bug — by design, `ClipboardHandler` stores both clipboard history (`history` key) and recent emoji (`recent_emojis` key) in the same `kickkey_clipboard` SharedPreferences file, but under different keys. They do not overwrite each other. If you see actual data corruption (clipboard text appearing in the emoji list or vice versa), check that `KEY_HISTORY = "history"` and the emoji methods use the literal string `"recent_emojis"` — a typo causing both to use the same key string would cause this.

---

*Phase 6 complete. Proceed to Phase 7 — Polish & Performance — to profile memory usage, optimize rendering with React.memo across all components, add input-type adaptation (password/number/URL fields), and tune the pre-warming and suggestion latency to production targets.*
