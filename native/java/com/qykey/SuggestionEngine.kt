package com.qykey

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Suggestion engine for QyKey.
 *
 * Triggered by every character typed or deleted.
 * Emits "onSuggestionsUpdated" to React Native via NativeEventEmitter.
 *
 * LIFECYCLE:
 *   - Created once in QyKeyInputMethodService.onCreate()
 *   - onCharacterTyped() / onBackspace()  called by QyKeyModule
 *   - onWordCommitted() called when user taps a suggestion or commits a word
 *   - reset() called in onStartInputView() when a new text field gains focus
 */
class SuggestionEngine(private val context: Context) {

    companion object {
        private const val TAG = "SuggestionEngine"
        private const val DEBOUNCE_MS = 50L
        private const val MIN_FUZZY_PREFIX_LEN = 4
        private const val MAX_PREFIX_RESULTS = 8
        private const val MAX_FUZZY_RESULTS = 4
        private const val FINAL_SUGGESTION_COUNT = 3
    }

    // Dictionaries loaded lazily — only when first needed (saves startup time)
    private val englishTrie: Trie by lazy {
        loadDictionary("dictionaries/english.bin").also {
            Log.i(TAG, "English Trie loaded")
        }
    }
    private val banglaTrie: Trie by lazy {
        loadDictionary("dictionaries/bangla.bin").also {
            Log.i(TAG, "Bangla Trie loaded")
        }
    }
    private val userModel: UserWordModel by lazy { UserWordModel(context) }

    // Per-language custom dictionaries (loaded from SharedPreferences)
    private var customWordsEn: List<String> = emptyList()
    private var customWordsBn: List<String> = emptyList()
    private var customWordsLoaded = false

    private fun loadCustomWords() {
        val prefs = context.getSharedPreferences("qykey_dictionary", Context.MODE_PRIVATE)
        val rawEn = prefs.getString("custom_words_en", "") ?: ""
        val rawBn = prefs.getString("custom_words_bn", "") ?: ""
        customWordsEn = if (rawEn.isEmpty()) emptyList() else rawEn.split("\n").filter { it.isNotBlank() }
        customWordsBn = if (rawBn.isEmpty()) emptyList() else rawBn.split("\n").filter { it.isNotBlank() }
        customWordsLoaded = true
    }

    private var currentWord: String = ""
    private var currentSuggestions: List<String> = emptyList()
    private var isEnabled: Boolean = true

    // Handler for debouncing suggestion updates on the main thread
    private val handler = Handler(Looper.getMainLooper())
    private val computeRunnable = Runnable { computeAndEmit() }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Called after every character commit (English or Bangla). */
    fun onCharacterTyped() {
        if (!isEnabled) return
        rescheduleCompute()
    }

    /** Called after every backspace. */
    fun onBackspace() {
        if (!isEnabled) return
        rescheduleCompute()
    }

    /**
     * Called when the user commits a word (taps a suggestion, types space, etc.)
     * Records the word in the user model and clears the suggestion bar.
     */
    fun onWordCommitted(word: String) {
        userModel.recordWord(word)
        currentWord = ""
        currentSuggestions = emptyList()
        emitSuggestions()
    }

    /** Returns the top suggestion, or null if none. */
    fun getTopSuggestion(): String? = currentSuggestions.firstOrNull()

    /** Returns the current incomplete word being typed. */
    fun getCurrentWord(): String = currentWord

    /** Clears suggestions and resets state. Call on new text field focus. */
    fun reset() {
        handler.removeCallbacks(computeRunnable)
        currentWord = ""
        currentSuggestions = emptyList()
        emitSuggestions()
    }

    fun setEnabled(enabled: Boolean) {
        isEnabled = enabled
        if (!enabled) reset()
    }

    /** Reload custom dictionary words from SharedPreferences. Call after setCustomDictionary. */
    fun reloadCustomWords() {
        customWordsLoaded = false
        loadCustomWords()
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private fun rescheduleCompute() {
        handler.removeCallbacks(computeRunnable)
        handler.postDelayed(computeRunnable, DEBOUNCE_MS)
    }

    /**
     * Extract the current incomplete word from InputConnection,
     * look it up in the Trie + user model, rank results, and emit.
     *
     * Runs the heavy lookup on a background thread.
     */
    private fun computeAndEmit() {
        val ic = QyKeyModule.activeInputConnection ?: return
        val textBefore = ic.getTextBeforeCursor(100, 0)?.toString() ?: return

        // If the user just typed whitespace, no active word is being typed
        if (textBefore.isEmpty() || textBefore.last().isWhitespace()) {
            currentWord = ""
            currentSuggestions = emptyList()
            emitSuggestions()
            return
        }

        // The "current word" is everything after the last whitespace or punctuation
        currentWord = textBefore.split(Regex("[\\s\\p{Punct}&&[^-]]+")).lastOrNull() ?: ""

        if (currentWord.isEmpty()) {
            currentSuggestions = emptyList()
            emitSuggestions()
            return
        }

        // Heavy work on background thread
        Thread {
            try {
                // Detect language: Bangla chars have code points > 0x0900
                val isBangla = currentWord.any { it.code > 0x0900 }
                val trie = if (isBangla) banglaTrie else englishTrie
                val searchPrefix = if (isBangla) currentWord else currentWord.lowercase()

                val prefixMatches = trie.search(searchPrefix, MAX_PREFIX_RESULTS)
                val fuzzyMatches = if (
                    searchPrefix.length >= MIN_FUZZY_PREFIX_LEN &&
                    prefixMatches.size < FINAL_SUGGESTION_COUNT
                ) {
                    trie.fuzzySearch(searchPrefix, maxDistance = 2, maxResults = MAX_FUZZY_RESULTS)
                } else emptyList()

                val userWords = userModel.getFrequentWords(searchPrefix)

                // Custom dictionary matches (per-language)
                if (!customWordsLoaded) loadCustomWords()
                val customList = if (isBangla) customWordsBn else customWordsEn
                val customMatches = customList
                    .filter { it.lowercase().startsWith(searchPrefix) }
                    .take(MAX_PREFIX_RESULTS)
                    .map { Trie.ScoredWord(it, 8_000) }  // high score, below user model

                val rawCandidates = (customMatches + userWords + prefixMatches + fuzzyMatches)
                    .distinctBy { it.word.lowercase() }
                    .sortedByDescending { it.score }
                    .map { matchCasing(currentWord, it.word) }

                val finalSuggestions = mutableListOf<String>()
                val matchingCandidate = rawCandidates.firstOrNull { it.equals(currentWord, ignoreCase = true) }

                if (matchingCandidate != null) {
                    finalSuggestions.add(matchingCandidate)
                    finalSuggestions.addAll(rawCandidates.filter { !it.equals(matchingCandidate, ignoreCase = true) })
                } else {
                    finalSuggestions.add(currentWord)
                    finalSuggestions.addAll(rawCandidates)
                }

                currentSuggestions = finalSuggestions.take(FINAL_SUGGESTION_COUNT)

                // Post emit back to main thread for ReactContext safety
                handler.post { emitSuggestions() }
            } catch (e: Exception) {
                Log.e(TAG, "Suggestion compute failed: ${e.message}")
            }
        }.start()
    }

    private fun matchCasing(source: String, target: String): String {
        if (source.isEmpty() || target.isEmpty()) return target
        if (source.all { it.isUpperCase() } && source.length > 1) {
            return target.uppercase()
        }
        if (source.first().isUpperCase()) {
            return target.replaceFirstChar { it.uppercase() }
        }
        return target
    }

    private fun emitSuggestions() {
        try {
            val app = context.applicationContext as QyKeyApplication
            // Fallback: use stored ReactContext when host.currentReactContext is null
            var reactContext = app.keyboardReactHost.currentReactContext
            if (reactContext == null) {
                reactContext = QyKeyModule.keyboardReactContext
            }
            if (reactContext == null) return

            val params = Arguments.createMap()
            val arr = Arguments.createArray()
            currentSuggestions.forEach { arr.pushString(it) }
            params.putArray("suggestions", arr)
            params.putString("currentWord", currentWord)

            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onSuggestionsUpdated", params)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to emit suggestions: ${e.message}")
        }
    }

    private fun loadDictionary(assetPath: String): Trie {
        return Trie.fromAsset(context, assetPath)
    }
}
