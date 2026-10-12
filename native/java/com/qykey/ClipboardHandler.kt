package com.qykey

import android.content.ClipboardManager
import android.content.Context
import android.util.Log

/**
 * Manages clipboard read access and a locally persisted history.
 *
 * Android only grants IMEs clipboard read access during onStartInputView()
 * (Android 10+). This class is therefore designed to be called from that
 * lifecycle point — see QyKeyInputMethodService.onStartInputView().
 *
 * History format: items separated by a Unit Separator character (\u001F)
 * to safely allow newlines and tabs within the clipboard text itself.
 */
class ClipboardHandler(private val context: Context) {

    companion object {
        private const val TAG = "ClipboardHandler"
        private const val PREFS_NAME = "qykey_clipboard"
        private const val KEY_HISTORY = "history"
        private const val MAX_HISTORY = 20
        private const val MAX_ITEM_LENGTH = 5000
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
            Log.v(TAG, "captureCurrentClipboard skipped: ${e.message}")
        }
    }

    /**
     * Returns the combined clipboard history, most recent first.
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
        current.remove(text)
        current.add(0, text)
        val trimmed = current.take(MAX_HISTORY)
        persistHistory(trimmed)
    }

    /** Removes every item from history. */
    fun clearHistory() {
        persistHistory(emptyList())
    }

    /** Removes a single item from history. */
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

    // ── Recent emoji tracking ────────────────────────────────────────────────

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
