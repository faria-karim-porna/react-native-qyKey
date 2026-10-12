package com.qykey

import android.content.Context
import android.util.Log

/**
 * Lightweight on-device user word frequency model.
 *
 * Stores word -> count in SharedPreferences as a CSV-like string.
 * Words selected by the user are boosted in suggestion ranking.
 *
 * Storage key: "qykey_user_words" in SharedPreferences "qykey_usermodel"
 *
 * Format: "word1:42,word2:18,word3:7,..."
 * Max 500 words stored; least-frequent pruned when limit is reached.
 */
class UserWordModel(private val context: Context) {

    companion object {
        private const val TAG = "UserWordModel"
        private const val PREFS_NAME = "qykey_usermodel"
        private const val KEY_WORDS   = "qykey_user_words"
        private const val MAX_WORDS   = 500
        private const val BOOST_SCORE = 10_000   // added to frequency for user words
    }

    /** In-memory cache; loaded lazily from SharedPreferences */
    private val wordCounts: MutableMap<String, Int> by lazy { loadFromPrefs() }

    /**
     * Record that the user selected or typed [word].
     * Increments its count and persists asynchronously.
     */
    fun recordWord(word: String) {
        if (word.isBlank() || word.length > 50) return
        val clean = word.trim().lowercase()
        wordCounts[clean] = (wordCounts[clean] ?: 0) + 1
        // Prune if over limit
        if (wordCounts.size > MAX_WORDS) {
            val leastFrequent = wordCounts.entries.minByOrNull { it.value }?.key
            leastFrequent?.let { wordCounts.remove(it) }
        }
        saveToPrefsAsync()
        Log.v(TAG, "Recorded '$clean' (count: ${wordCounts[clean]})")
    }

    /**
     * Returns user-known words that start with [prefix], boosted by frequency.
     * Returns empty list if no user words match.
     */
    fun getFrequentWords(prefix: String): List<Trie.ScoredWord> {
        if (prefix.isBlank()) return emptyList()
        val lowerPrefix = prefix.lowercase()
        return wordCounts
            .filter { (word, _) -> word.startsWith(lowerPrefix) }
            .map { (word, count) -> Trie.ScoredWord(word, BOOST_SCORE + count) }
            .sortedByDescending { it.score }
            .take(3)
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    private fun loadFromPrefs(): MutableMap<String, Int> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_WORDS, "") ?: ""
        if (raw.isEmpty()) return mutableMapOf()
        return try {
            raw.split(",").associate { entry ->
                val parts = entry.split(":")
                parts[0] to parts[1].toInt()
            }.toMutableMap()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse user word model: ${e.message}")
            mutableMapOf()
        }
    }

    private fun saveToPrefsAsync() {
        Thread {
            val serialized = wordCounts.entries.joinToString(",") { "${it.key}:${it.value}" }
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_WORDS, serialized)
                .apply()
        }.start()
    }
}
