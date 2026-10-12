package com.qykey

import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Read-only binary Trie for fast prefix search and Levenshtein fuzzy search.
 *
 * Binary format (big-endian):
 *   [4] magic "TRIE"
 *   [4] version = 1
 *   [4] nodeCount
 *   Per node (20 bytes):
 *     [4] firstChildIndex  (-1 = no children)
 *     [4] siblingIndex     (-1 = no sibling)
 *     [4] frequency        (0 = not a word end)
 *     [4] charCodepoint    (Unicode code point)
 *     [4] reserved
 */
class Trie private constructor(private val buf: ByteBuffer) {

    companion object {
        private const val MAGIC = 0x54524945.toInt()  // "TRIE"
        private const val NODE_SIZE = 20
        private const val HEADER_SIZE = 12  // magic(4) + version(4) + count(4)

        /**
         * Load a Trie from an Android asset file using a memory-mapped buffer.
         *
         * Unlike fromStream() which loads the entire file into a byte array,
         * this uses FileChannel.map() to create a MappedByteBuffer — the OS
         * backs the buffer with its page cache and the data is only loaded into
         * physical RAM as it is accessed, up to the OS's eviction policy.
         *
         * Result: ~2-4MB less heap usage in the :ime_process.
         */
        fun fromAsset(context: android.content.Context, assetPath: String): Trie {
            try {
                // Copy asset to a temp file — AssetManager doesn't expose a FileDescriptor
                // directly for memory mapping, so we copy once and memory-map the copy.
                val cacheFile = java.io.File(context.cacheDir, assetPath.replace("/", "_"))
                if (!cacheFile.exists() || cacheFile.length() == 0L) {
                    context.assets.open(assetPath).use { input ->
                        cacheFile.parentFile?.mkdirs()
                        java.io.FileOutputStream(cacheFile).use { output ->
                            input.copyTo(output)
                        }
                    }
                }
                val channel = java.io.RandomAccessFile(cacheFile, "r").channel
                val buf = channel.map(
                    java.nio.channels.FileChannel.MapMode.READ_ONLY,
                    0,
                    channel.size()
                ).order(java.nio.ByteOrder.BIG_ENDIAN)
                channel.close()

                val magic = buf.getInt(0)
                require(magic == MAGIC) { "Invalid Trie file: bad magic 0x${magic.toString(16)}" }
                return Trie(buf)
            } catch (e: Exception) {
                // Fall back to the in-memory fromStream() approach
                android.util.Log.w("Trie", "fromAsset failed, falling back to fromStream: ${e.message}")
                return fromStream(context.assets.open(assetPath))
            }
        }

        fun fromStream(stream: InputStream): Trie {
            val bytes = stream.readBytes()
            val buf = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN)
            val magic = buf.getInt(0)
            require(magic == MAGIC) { "Invalid Trie file: bad magic 0x${magic.toString(16)}" }
            return Trie(buf)
        }
    }

    data class ScoredWord(val word: String, val score: Int)

    private val nodeCount: Int = buf.getInt(8)

    // ── Node field accessors ──────────────────────────────────────────────────

    private fun offset(idx: Int) = HEADER_SIZE + idx * NODE_SIZE

    private fun firstChild(idx: Int): Int  = buf.getInt(offset(idx))
    private fun sibling(idx: Int): Int     = buf.getInt(offset(idx) + 4)
    private fun frequency(idx: Int): Int   = buf.getInt(offset(idx) + 8)
    private fun charCode(idx: Int): Int    = buf.getInt(offset(idx) + 12)
    private fun nodeChar(idx: Int): Char   = charCode(idx).toChar()
    private fun isWordEnd(idx: Int): Boolean = frequency(idx) > 0

    // ── Prefix Search ─────────────────────────────────────────────────────────

    /**
     * Find all words that start with [prefix].
     * Returns up to [maxResults] results ranked by frequency (highest first).
     *
     * Time complexity: O(m + k) where m = prefix length, k = matching subtree size.
     */
    fun search(prefix: String, maxResults: Int = 5): List<ScoredWord> {
        if (prefix.isEmpty()) return emptyList()

        // Navigate to the node that represents the end of [prefix]
        var node = 0  // root node index
        for (ch in prefix) {
            node = findChildWithChar(node, ch) ?: return emptyList()
        }

        // Collect all words in the subtree rooted at this node
        val results = mutableListOf<ScoredWord>()
        collectWords(node, StringBuilder(prefix), results, maxResults)
        return results.sortedByDescending { it.score }
    }

    /**
     * Find the child of [parentIdx] whose char matches [ch].
     * Returns null if no such child exists.
     */
    private fun findChildWithChar(parentIdx: Int, ch: Char): Int? {
        var child = firstChild(parentIdx)
        while (child != -1) {
            if (nodeChar(child) == ch) return child
            child = sibling(child)
        }
        return null
    }

    /**
     * Depth-first traversal from [nodeIdx], collecting words into [results].
     * Stops early once [maxResults] words have been found.
     */
    private fun collectWords(
        nodeIdx: Int,
        current: StringBuilder,
        results: MutableList<ScoredWord>,
        maxResults: Int
    ) {
        if (results.size >= maxResults) return
        if (isWordEnd(nodeIdx)) {
            results.add(ScoredWord(current.toString(), frequency(nodeIdx)))
        }
        var child = firstChild(nodeIdx)
        while (child != -1 && results.size < maxResults) {
            current.append(nodeChar(child))
            collectWords(child, current, results, maxResults)
            current.deleteCharAt(current.length - 1)
            child = sibling(child)
        }
    }

    // ── Fuzzy Search (Levenshtein) ────────────────────────────────────────────

    /**
     * Find words within [maxDistance] edit distance from [word].
     * Uses the standard DP row algorithm traversing the Trie.
     *
     * Only called when prefix search returns fewer than 3 results.
     * [word] must be at least 4 characters long (enforced by SuggestionEngine).
     */
    fun fuzzySearch(word: String, maxDistance: Int = 2, maxResults: Int = 4): List<ScoredWord> {
        val results = mutableListOf<ScoredWord>()
        val initialRow = IntArray(word.length + 1) { it }
        // Start DFS from each child of root
        var child = firstChild(0)
        while (child != -1) {
            fuzzyDfs(child, nodeChar(child).toString(), word, initialRow, maxDistance, results, maxResults)
            child = sibling(child)
        }
        return results.sortedByDescending { it.score }.take(maxResults)
    }

    private fun fuzzyDfs(
        nodeIdx: Int,
        currentWord: String,
        target: String,
        prevRow: IntArray,
        maxDistance: Int,
        results: MutableList<ScoredWord>,
        maxResults: Int
    ) {
        if (results.size >= maxResults) return

        val currentRow = IntArray(target.length + 1)
        currentRow[0] = prevRow[0] + 1

        for (col in 1..target.length) {
            val insertCost = currentRow[col - 1] + 1
            val deleteCost = prevRow[col] + 1
            val replaceCost = if (target[col - 1] == currentWord.last()) prevRow[col - 1] else prevRow[col - 1] + 1
            currentRow[col] = minOf(insertCost, deleteCost, replaceCost)
        }

        // If this word is within distance and is a valid word end, collect it
        if (currentRow[target.length] <= maxDistance && isWordEnd(nodeIdx)) {
            results.add(ScoredWord(currentWord, frequency(nodeIdx)))
        }

        // Only recurse if minimum value in this row <= maxDistance (pruning)
        if (currentRow.min()!! <= maxDistance) {
            var child = firstChild(nodeIdx)
            while (child != -1 && results.size < maxResults) {
                fuzzyDfs(
                    child,
                    currentWord + nodeChar(child),
                    target,
                    currentRow,
                    maxDistance,
                    results,
                    maxResults
                )
                child = sibling(child)
            }
        }
    }
}
