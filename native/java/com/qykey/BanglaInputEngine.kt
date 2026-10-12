package com.qykey

import android.util.Log

/**
 * Avro-style phonetic transliteration engine for Bangla.
 *
 * The user types Roman characters and this engine converts them to Bangla
 * Unicode using a longest-match greedy algorithm against a phonetic map.
 *
 * THREAD SAFETY: This class is NOT thread-safe. It must only be called
 * from the main thread (via NativeModules function calls).
 */
class BanglaInputEngine {

    companion object {
        private const val TAG = "BanglaEngine"
        private const val MAX_BUFFER = 5
    }

    private val phoneticMap: Map<String, String> = linkedMapOf(
        // ── Aspirated / compound consonants (4 chars) ──────────────────
        "ttha"  to "ঠ",
        "ddha"  to "ঢ",

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
        "rra"   to "ড়",
        "shha"  to "ষ",
        "rrha"  to "ঢ়",

        // ── Conjuncts (common) ───────────────────────────────────────────
        "kka"   to "ক্ক",
        "tta"   to "ত্ত",

        // ── Vowels — long forms (2 chars) ───────────────────────────────
        "aa"    to "আ",
        "ii"    to "ঈ",
        "uu"    to "ঊ",
        "ee"    to "ঐ",
        "oo"    to "ঔ",
        "ri"    to "ৃ",

        // ── Matra (vowel signs) — uppercase trigger ──────────────────────
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
        "ng"    to "ং",

        // ── Basic vowels (1 char) ────────────────────────────────────────
        "a"     to "অ",
        "i"     to "ই",
        "u"     to "উ",
        "e"     to "এ",
        "o"     to "ও",

        // ── Special characters ───────────────────────────────────────────
        ":"     to "ঃ",
        "^"     to "ঁ",
        "`"     to "্",
        "T"     to "ট",
        "D"     to "ড",
        "N"     to "ণ",
    )

    /** Unmatched Roman characters waiting for more input */
    private val buffer = StringBuilder()

    /**
     * Process a single Roman key press.
     *
     * @param romanKey  The Roman character typed (e.g. "k", "h", "a")
     * @return          The Bangla string to commit, or "" if buffering continues
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
                Log.v(TAG, "Match: '$suffix' -> '$bangla' | remaining buffer: '$buffer'")
                return bangla
            }
        }

        // No match found yet — keep buffering
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
     * @return true if backspace was consumed by buffer (caller should NOT delete),
     *         false if buffer was empty (caller should delete normally)
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

    /** Reset the engine entirely. Called when a new input field receives focus. */
    fun reset() {
        buffer.clear()
        Log.v(TAG, "Engine reset")
    }

    /** Returns the current buffer contents (for debug / testing) */
    fun getBuffer(): String = buffer.toString()
}
