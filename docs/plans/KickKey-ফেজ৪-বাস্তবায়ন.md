# KickKey — ফেজ ৪ বাস্তবায়ন গাইড
## সাজেশন ও অটোকারেক্ট (সপ্তাহ ৭–৮)

> **লক্ষ্য:** ইংরেজি ও বাংলায় স্মার্ট শব্দ সাজেশন কাজ করবে — সাজেশন বার চিপস ট্যাপযোগ্য হবে, স্পেস শীর্ষ সাজেশন অটো-কারেক্ট করবে, এবং ইঞ্জিন ব্যবহারকারীর পছন্দ থেকে শিখবে।
> **ফেজ ৩-এর উপর নির্মিত** — সম্পূর্ণ ইংরেজি/বাংলা কীবোর্ড, ফোনেটিক ইঞ্জিন, এবং ভাষা সুইচ ইতিমধ্যে কাজ করছে। ফেজ ৪ বাইনারি Trie ডিকশনারি, `SuggestionEngine.kt`, `Trie.kt`, `UserWordModel.kt`, একটি ডিকশনারি কম্পাইলার স্ক্রিপ্ট যোগ করে এবং `SuggestionBar` কে লাইভ ডেটায় ওয়্যার করে।

---

## বিষয়সূচি

1. [ফেজ ৪-এ কী পরিবর্তন হয়](#1-ফেজ-৪-তে-কী-পরিবর্তন-হয়)
2. [আর্কিটেকচার: সাজেশন কীভাবে প্রবাহিত হয়](#2-আর্কিটেকচার-সাজেশন-কীভাবে-প্রবাহিত-হয়)
3. [আপডেটেড ফোল্ডার স্ট্রাকচার](#3-আপডেটেড-ফোল্ডার-স্ট্রাকচার)
4. [ডিকশনারি কম্পাইলার স্ক্রিপ্ট](#4-ডিকশনারি-কম্পাইলার-স্ক্রিপ্ট)
5. [Trie.kt](#5-trierkt)
6. [UserWordModel.kt](#6-userwordmodelkt)
7. [SuggestionEngine.kt](#7-suggestionenginekt)
8. [আপডেটেড KickKeyModule.kt](#8-আপডেটেড-kickkeymodulekt)
9. [আপডেটেড KickKeyInputMethodService.kt](#9-আপডেটেড-kickkeyinputmethodservicekt)
10. [আপডেটেড SuggestionBar.tsx](#10-আপডেটেড-suggestionbartsx)
11. [আপডেটেড useKeyboardState হুক](#11-আপডেটেড-usekeyboardstate-হুক)
12. [আপডেটেড modules/kickkey-module/index.ts](#12-আপডেটেড-moduleskickkey-moduleindexts)
13. [শব্দ তালিকা ফাইল](#13-শব্দ-তালিকা-ফাইল)
14. [বিল্ড ও পরীক্ষা](#14-বিল্ড-ও-পরীক্ষা)
15. [যাচাই চেকলিস্ট](#15-যাচাই-চেকলিস্ট)
16. [সমস্যা সমাধান](#16-সমস্যা-সমাধান)

---

## 1. ফেজ ৪-তে কী পরিবর্তন হয়

### তৈরি করতে হবে (নতুন ফাইল)

| ফাইল | উদ্দেশ্য |
|---|---|
| `scripts/compile_dictionaries.py` | বিল্ড-টাইম স্ক্রিপ্ট: `.txt` শব্দ তালিকা → বাইনারি Trie `.bin` |
| `android/.../Trie.kt` | O(m) প্রিফিক্স লুকআপের জন্য বাইনারি Trie ডেটা স্ট্রাকচার |
| `android/.../UserWordModel.kt` | ট্যাপ করা সাজেশন থেকে শেখে; প্রতি-শব্দ ফ্রিকোয়েন্সি সংরক্ষণ করে |
| `android/.../SuggestionEngine.kt` | Trie + ফাজি + ইউজার মডেল অর্কেস্ট্রেট করে; RN-এ ইভেন্ট এমিট করে |
| `assets/dictionaries/english.txt` | ~৭০k ইংরেজি শব্দ ফ্রিকোয়েন্সি স্কোর সহ |
| `assets/dictionaries/bangla.txt` | ~৩০k বাংলা শব্দ ফ্রিকোয়েন্সি স্কোর সহ |
| `assets/dictionaries/english.bin` | কম্পাইলড বাইনারি Trie (স্ক্রিপ্ট দ্বারা তৈরি) |
| `assets/dictionaries/bangla.bin` | কম্পাইলড বাইনারি Trie (স্ক্রিপ্ট দ্বারা তৈরি) |

### আপডেট করতে হবে (আংশিক পরিবর্তন)

| ফাইল | কী পরিবর্তন হয় |
|---|---|
| `modules/kickkey-module/android/.../KickKeyModule.kt` | `commitSuggestion` যোগ; `commitKey` ও `sendBackspace` সাজেশন ইঞ্জিনে হুক; `commitSpace` শীর্ষ সাজেশন ব্যবহার করে |
| `android/.../KickKeyInputMethodService.kt` | `SuggestionEngine` ইনস্ট্যান্টিয়েট; `onStartInputView` ও `onWindowHidden`-এ যোগ |
| `src/keyboard/SuggestionBar.tsx` | প্লেসহোল্ডার সরান; প্রকৃত ট্যাপযোগ্য সাজেশন চিপস রেন্ডার করুন |
| `src/keyboard/hooks/useKeyboardState.ts` | `handleSuggestionSelect` `KickKey.commitSuggestion`-এ ওয়্যার করুন |
| `modules/kickkey-module/index.ts` | `commitSuggestion` এক্সপোর্ট করুন |

### পরিবর্তন হবে না

সমস্ত ফেজ ৩ ফাইল — `BanglaInputEngine.kt`, `Key.tsx`, `KeyRow.tsx`, `KeyboardScreen.tsx`, `KeyboardHeader.tsx`, `BottomRow.tsx`, সমস্ত লেআউট ফাইল, `HapticManager.kt`, `KickKeyApplication.kt`, `useKeyboardTheme.ts`।

---

## 2. আর্কিটেকচার: সাজেশন কীভাবে প্রবাহিত হয়

```
ব্যবহারকারী 'h' → 'e' → 'l' টাইপ করে
        │
        ▼
NativeModules.KickKey.commitKey('l', 'en')
        │
        ▼  [Kotlin মেইন থ্রেড]
KickKeyModule.commitKey()
  → InputConnection-এ 'l' কমিট করে
  → SuggestionEngine.onCharacterTyped() কল করে
        │
        ▼  [৫০ms ডিবাউন্স]
SuggestionEngine.computeAndEmit()  [ব্যাকগ্রাউন্ড থ্রেড]
  → InputConnection.getTextBeforeCursor(100) → "hel"
  → currentWord = "hel"
  → englishTrie.search("hel", 8) → ["hello","help","held","helm",...]
  → userModel.getFrequentWords("hel") → []  (এখনো ইতিহাস নেই)
  → মার্জ + র‍্যাঙ্ক + ৩টি নিন → ["hello","help","held"]
  → "onSuggestionsUpdated" { suggestions: ["hello","help","held"], currentWord: "hel" } এমিট
        │
        ▼  [React Native JS থ্রেড]
useKeyboardState → setSuggestions(["hello","help","held"])
        │
        ▼
SuggestionBar.tsx তিনটি ট্যাপযোগ্য চিপ সহ পুনরায় রেন্ডার
        │
        ▼
ব্যবহারকারী "hello" ট্যাপ করে
        │
        ▼
NativeModules.KickKey.commitSuggestion("hello")
        │
        ▼  [Kotlin]
  → InputConnection.deleteSurroundingText(3, 0)  ("hel" মুছুন)
  → InputConnection.commitText("hello ", 1)       (শব্দ + স্পেস কমিট)
  → SuggestionEngine.onWordCommitted("hello")     (ইউজার মডেলে রেকর্ড)
  → "onSuggestionsUpdated" { suggestions: [], currentWord: "" } এমিট
        │
        ▼
SuggestionBar পরিষ্কার হয়
```

---

## 3. আপডেটেড ফোল্ডার স্ট্রাকচার

```
scripts/
└── compile_dictionaries.py       ← নতুন

assets/dictionaries/
├── english.txt                   ← নতুন (শব্দ তালিকা উৎস)
├── bangla.txt                    ← নতুন (শব্দ তালিকা উৎস)
├── english.bin                   ← নতুন (স্ক্রিপ্ট দ্বারা তৈরি)
└── bangla.bin                    ← নতুন (স্ক্রিপ্ট দ্বারা তৈরি)

android/app/src/main/java/com/kickkey/
├── Trie.kt                       ← নতুন
├── UserWordModel.kt              ← নতুন
├── SuggestionEngine.kt           ← নতুন
├── KickKeyModule.kt              ← আপডেট
└── KickKeyInputMethodService.kt  ← আপডেট

src/keyboard/
├── SuggestionBar.tsx             ← আপডেট (প্রকৃত চিপস)
└── hooks/
    └── useKeyboardState.ts       ← আপডেট (commitSuggestion)

modules/kickkey-module/
└── index.ts                      ← আপডেট (commitSuggestion)
```

---

## 4. ডিকশনারি কম্পাইলার স্ক্রিপ্ট

এই Python স্ক্রিপ্ট বিল্ড সময়ে (`eas build`-এর আগে) চলে এবং সাধারণ টেক্সট শব্দ তালিকাকে একটি কম্প্যাক্ট বাইনারি Trie ফরম্যাটে রূপান্তরিত করে।

### ৪.১ বাইনারি ফরম্যাট স্পেসিফিকেশন

```
ফাইল লেআউট:
  [4 বাইট]  ম্যাজিক নম্বর: 0x54524945 ("TRIE")
  [4 বাইট]  ভার্সন: 1
  [4 বাইট]  নোড সংখ্যা N
  প্রতিটি নোডের জন্য (20 বাইট):
    [4 বাইট]  children_offset  — প্রথম চাইল্ডের ইনডেক্স (-1 যদি পাতা)
    [4 বাইট]  sibling_offset   — পরবর্তী ভাইয়ের ইনডেক্স (-1 যদি না থাকে)
    [4 বাইট]  frequency        — শব্দ শেষ না হলে 0, শেষ হলে >0
    [4 বাইট]  char_utf8        — এই নোডের অক্ষরের UTF-8 কোড পয়েন্ট
    [4 বাইট]  reserved         — প্যাডিং
```

### ৪.২ `scripts/compile_dictionaries.py`

```python
#!/usr/bin/env python3
"""
compile_dictionaries.py
KickKey শব্দ তালিকা (.txt) ফাইলগুলো বাইনারি Trie (.bin) ফাইলে কম্পাইল করে।

ব্যবহার:
    python3 scripts/compile_dictionaries.py

ইনপুট:  assets/dictionaries/english.txt
        assets/dictionaries/bangla.txt

আউটপুট: assets/dictionaries/english.bin
        assets/dictionaries/bangla.bin

শব্দ তালিকা ফরম্যাট (প্রতি লাইনে একটি শব্দ):
    word<TAB>frequency
    hello<TAB>98234
    world<TAB>72100
    ...
'#' দিয়ে শুরু লাইন মন্তব্য এবং উপেক্ষা করা হয়।
"""

import struct
import os
import sys
from dataclasses import dataclass, field
from typing import Optional, Dict, List

MAGIC = b'TRIE'
VERSION = 1
NODE_SIZE = 20   # প্রতিটি নোডের বাইনারি ফাইলে বাইট

@dataclass
class TrieNode:
    char: str = ''
    frequency: int = 0
    children: Dict[str, 'TrieNode'] = field(default_factory=dict)


def build_trie(words: List[tuple]) -> TrieNode:
    """(word, frequency) টাপলের তালিকা থেকে ইন-মেমরি Trie তৈরি করুন।"""
    root = TrieNode(char='')
    for word, freq in words:
        node = root
        for ch in word:
            if ch not in node.children:
                node.children[ch] = TrieNode(char=ch)
            node = node.children[ch]
        node.frequency = max(node.frequency, freq)
    return root


def flatten_trie(root: TrieNode) -> List[TrieNode]:
    """BFS ট্র্যাভার্সাল — সমস্ত নোড ব্রেডথ-ফার্স্ট অর্ডারে ফেরত দেয়।"""
    result = []
    queue = [root]
    while queue:
        node = queue.pop(0)
        result.append(node)
        for child in node.children.values():
            queue.append(child)
    return result


def write_binary_trie(nodes: List[TrieNode], output_path: str):
    """নোডগুলো বাইনারি ফাইলে লিখুন।"""
    index_map = {id(n): i for i, n in enumerate(nodes)}

    with open(output_path, 'wb') as f:
        # হেডার
        f.write(MAGIC)
        f.write(struct.pack('>I', VERSION))
        f.write(struct.pack('>I', len(nodes)))

        for node in nodes:
            children_list = list(node.children.values())

            first_child = index_map[id(children_list[0])] if children_list else -1
            for i, child in enumerate(children_list):
                sibling = index_map[id(children_list[i + 1])] if i + 1 < len(children_list) else -1
                child._sibling_index = sibling
            if not hasattr(node, '_sibling_index'):
                node._sibling_index = -1

            char_codepoint = ord(node.char) if node.char else 0
            f.write(struct.pack('>i', first_child))
            f.write(struct.pack('>i', node._sibling_index))
            f.write(struct.pack('>I', node.frequency))
            f.write(struct.pack('>I', char_codepoint))
            f.write(struct.pack('>I', 0))  # reserved

    print(f"  লেখা হয়েছে {len(nodes)} নোড → {output_path}")


def load_word_list(path: str) -> List[tuple]:
    """ট্যাব-বিচ্ছিন্ন ফাইল থেকে শব্দ তালিকা লোড করুন।"""
    words = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            word = parts[0].strip().lower()
            freq = int(parts[1]) if len(parts) > 1 else 1
            if word:
                words.append((word, freq))
    return words


def compile_dictionary(input_path: str, output_path: str):
    print(f"{input_path} কম্পাইল হচ্ছে ...")
    words = load_word_list(input_path)
    print(f"  {len(words)} শব্দ লোড হয়েছে")
    root = build_trie(words)
    nodes = flatten_trie(root)
    print(f"  Trie-এ {len(nodes)} নোড আছে")
    write_binary_trie(nodes, output_path)


def main():
    base = os.path.join(os.path.dirname(__file__), '..', 'assets', 'dictionaries')
    pairs = [
        ('english.txt', 'english.bin'),
        ('bangla.txt',  'bangla.bin'),
    ]
    for src, dst in pairs:
        inp = os.path.join(base, src)
        out = os.path.join(base, dst)
        if not os.path.exists(inp):
            print(f"সতর্কতা: {inp} পাওয়া যায়নি — এড়িয়ে যাওয়া হচ্ছে")
            continue
        compile_dictionary(inp, out)
    print("সম্পন্ন।")


if __name__ == '__main__':
    main()
```

চালান:
```bash
python3 scripts/compile_dictionaries.py
```

---

## 5. `Trie.kt`

রানটাইম Trie রিডার। কম্পাইলার স্ক্রিপ্টের তৈরি বাইনারি ফাইল পড়ে।

```kotlin
// android/app/src/main/java/com/kickkey/Trie.kt

package com.kickkey

import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * দ্রুত প্রিফিক্স সার্চ এবং Levenshtein ফাজি সার্চের জন্য রিড-অনলি বাইনারি Trie।
 *
 * বাইনারি ফরম্যাট (big-endian):
 *   [4] magic "TRIE"
 *   [4] version = 1
 *   [4] nodeCount
 *   প্রতিটি নোডের জন্য (20 বাইট):
 *     [4] firstChildIndex  (-1 = কোনো চাইল্ড নেই)
 *     [4] siblingIndex     (-1 = কোনো ভাই নেই)
 *     [4] frequency        (0 = শব্দ শেষ নয়)
 *     [4] charCodepoint    (Unicode কোড পয়েন্ট)
 *     [4] reserved
 */
class Trie private constructor(private val buf: ByteBuffer) {

    companion object {
        private const val MAGIC = 0x54524945.toInt()  // "TRIE"
        private const val NODE_SIZE = 20
        private const val HEADER_SIZE = 12

        fun fromStream(stream: InputStream): Trie {
            val bytes = stream.readBytes()
            val buf = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN)
            val magic = buf.getInt(0)
            require(magic == MAGIC) { "অবৈধ Trie ফাইল: ভুল magic 0x${magic.toString(16)}" }
            return Trie(buf)
        }
    }

    data class ScoredWord(val word: String, val score: Int)

    private val nodeCount: Int = buf.getInt(8)

    private fun offset(idx: Int) = HEADER_SIZE + idx * NODE_SIZE
    private fun firstChild(idx: Int): Int  = buf.getInt(offset(idx))
    private fun sibling(idx: Int): Int     = buf.getInt(offset(idx) + 4)
    private fun frequency(idx: Int): Int   = buf.getInt(offset(idx) + 8)
    private fun charCode(idx: Int): Int    = buf.getInt(offset(idx) + 12)
    private fun nodeChar(idx: Int): Char   = charCode(idx).toChar()
    private fun isWordEnd(idx: Int): Boolean = frequency(idx) > 0

    // ── প্রিফিক্স সার্চ ──────────────────────────────────────────────────────

    /**
     * [prefix] দিয়ে শুরু হওয়া সমস্ত শব্দ খুঁজুন।
     * ফ্রিকোয়েন্সি দ্বারা র‍্যাঙ্ক করে [maxResults] পর্যন্ত ফলাফল ফেরত দেয়।
     */
    fun search(prefix: String, maxResults: Int = 5): List<ScoredWord> {
        if (prefix.isEmpty()) return emptyList()
        var node = 0
        for (ch in prefix) {
            node = findChildWithChar(node, ch) ?: return emptyList()
        }
        val results = mutableListOf<ScoredWord>()
        collectWords(node, StringBuilder(prefix), results, maxResults)
        return results.sortedByDescending { it.score }
    }

    private fun findChildWithChar(parentIdx: Int, ch: Char): Int? {
        var child = firstChild(parentIdx)
        while (child != -1) {
            if (nodeChar(child) == ch) return child
            child = sibling(child)
        }
        return null
    }

    private fun collectWords(
        nodeIdx: Int, current: StringBuilder,
        results: MutableList<ScoredWord>, maxResults: Int
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

    // ── ফাজি সার্চ (Levenshtein) ─────────────────────────────────────────────

    /**
     * [word] থেকে [maxDistance] এডিট দূরত্বের মধ্যে শব্দ খুঁজুন।
     * Trie ট্র্যাভার্স করে স্ট্যান্ডার্ড DP রো অ্যালগরিদম ব্যবহার করে।
     */
    fun fuzzySearch(word: String, maxDistance: Int = 2, maxResults: Int = 4): List<ScoredWord> {
        val results = mutableListOf<ScoredWord>()
        val initialRow = IntArray(word.length + 1) { it }
        var child = firstChild(0)
        while (child != -1) {
            fuzzyDfs(child, nodeChar(child).toString(), word, initialRow, maxDistance, results, maxResults)
            child = sibling(child)
        }
        return results.sortedByDescending { it.score }.take(maxResults)
    }

    private fun fuzzyDfs(
        nodeIdx: Int, currentWord: String, target: String,
        prevRow: IntArray, maxDistance: Int,
        results: MutableList<ScoredWord>, maxResults: Int
    ) {
        if (results.size >= maxResults) return
        val ch = currentWord.last()
        val currentRow = IntArray(target.length + 1)
        currentRow[0] = prevRow[0] + 1
        for (col in 1..target.length) {
            val insertCost  = currentRow[col - 1] + 1
            val deleteCost  = prevRow[col] + 1
            val replaceCost = if (target[col - 1] == ch) prevRow[col - 1] else prevRow[col - 1] + 1
            currentRow[col] = minOf(insertCost, deleteCost, replaceCost)
        }
        if (currentRow[target.length] <= maxDistance && isWordEnd(nodeIdx)) {
            results.add(ScoredWord(currentWord, frequency(nodeIdx)))
        }
        if (currentRow.min()!! <= maxDistance) {
            var child = firstChild(nodeIdx)
            while (child != -1 && results.size < maxResults) {
                fuzzyDfs(child, currentWord + nodeChar(child), target, currentRow, maxDistance, results, maxResults)
                child = sibling(child)
            }
        }
    }
}
```

---

## 6. `UserWordModel.kt`

ব্যবহারকারী প্রতিটি শব্দ কতবার নির্বাচন করেছেন তা ট্র্যাক করে। ঘন ঘন বেছে নেওয়া শব্দগুলো সাজেশন র‍্যাঙ্কিংয়ের শীর্ষে আসে।

```kotlin
// android/app/src/main/java/com/kickkey/UserWordModel.kt

package com.kickkey

import android.content.Context
import android.util.Log

/**
 * লাইটওয়েট অন-ডিভাইস ব্যবহারকারী শব্দ ফ্রিকোয়েন্সি মডেল।
 *
 * SharedPreferences-এ word → count সংরক্ষণ করে।
 * ব্যবহারকারীর নির্বাচিত শব্দগুলো সাজেশন র‍্যাঙ্কিংয়ে বুস্ট পায়।
 * সর্বোচ্চ 500 শব্দ সংরক্ষিত; সীমায় পৌঁছালে সবচেয়ে কম ঘন শব্দ ছাঁটাই।
 */
class UserWordModel(private val context: Context) {

    companion object {
        private const val TAG = "UserWordModel"
        private const val PREFS_NAME = "kickkey_usermodel"
        private const val KEY_WORDS   = "kickkey_user_words"
        private const val MAX_WORDS   = 500
        private const val BOOST_SCORE = 10_000   // ইউজার শব্দে ফ্রিকোয়েন্সিতে যোগ হয়
    }

    /** ইন-মেমরি ক্যাশ; SharedPreferences থেকে আলস্যে লোড হয় */
    private val wordCounts: MutableMap<String, Int> by lazy { loadFromPrefs() }

    /**
     * রেকর্ড করুন যে ব্যবহারকারী [word] নির্বাচন বা টাইপ করেছেন।
     * সংখ্যা বাড়ায় এবং অ্যাসিঙ্ক্রোনাসলি পার্সিস্ট করে।
     */
    fun recordWord(word: String) {
        if (word.isBlank() || word.length > 50) return
        val clean = word.trim().lowercase()
        wordCounts[clean] = (wordCounts[clean] ?: 0) + 1
        if (wordCounts.size > MAX_WORDS) {
            val leastFrequent = wordCounts.entries.minByOrNull { it.value }?.key
            leastFrequent?.let { wordCounts.remove(it) }
        }
        saveToPrefsAsync()
        Log.v(TAG, "রেকর্ড করা হয়েছে '$clean' (সংখ্যা: ${wordCounts[clean]})")
    }

    /**
     * [prefix] দিয়ে শুরু হওয়া ব্যবহারকারী-জানা শব্দ ফেরত দেয়, ফ্রিকোয়েন্সি দ্বারা বুস্টেড।
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
            Log.w(TAG, "ইউজার শব্দ মডেল পার্স ব্যর্থ: ${e.message}")
            mutableMapOf()
        }
    }

    private fun saveToPrefsAsync() {
        Thread {
            val serialized = wordCounts.entries.joinToString(",") { "${it.key}:${it.value}" }
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putString(KEY_WORDS, serialized).apply()
        }.start()
    }
}
```

---

## 7. `SuggestionEngine.kt`

ইঞ্জিন ডিকশনারি লুকআপ, ফাজি ম্যাচিং, এবং ইউজার মডেল অর্কেস্ট্রেট করে। ৫০ms ডিবাউন্সিং ব্যবহার করে এবং ব্যাকগ্রাউন্ড থ্রেডে ভারী কাজ চালায়।

```kotlin
// android/app/src/main/java/com/kickkey/SuggestionEngine.kt

package com.kickkey

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.DeviceEventManagerModule

/**
 * KickKey-এর সাজেশন ইঞ্জিন।
 *
 * প্রতিটি অক্ষর টাইপ বা মুছলে ট্রিগার হয়।
 * NativeEventEmitter দ্বারা React Native-এ "onSuggestionsUpdated" এমিট করে।
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

    // ডিকশনারি আলস্যে লোড হয় — শুধুমাত্র প্রথম প্রয়োজনে
    private val englishTrie: Trie by lazy {
        loadDictionary("dictionaries/english.bin").also {
            Log.i(TAG, "ইংরেজি Trie লোড হয়েছে")
        }
    }
    private val banglaTrie: Trie by lazy {
        loadDictionary("dictionaries/bangla.bin").also {
            Log.i(TAG, "বাংলা Trie লোড হয়েছে")
        }
    }
    private val userModel: UserWordModel by lazy { UserWordModel(context) }

    private var currentWord: String = ""
    private var currentSuggestions: List<String> = emptyList()
    private var isEnabled: Boolean = true

    private val handler = Handler(Looper.getMainLooper())
    private val computeRunnable = Runnable { computeAndEmit() }

    // ── পাবলিক API ────────────────────────────────────────────────────────────

    /** প্রতিটি অক্ষর কমিটের পরে কল হয়। */
    fun onCharacterTyped() {
        if (!isEnabled) return
        rescheduleCompute()
    }

    /** প্রতিটি ব্যাকস্পেসের পরে কল হয়। */
    fun onBackspace() {
        if (!isEnabled) return
        rescheduleCompute()
    }

    /** ব্যবহারকারী একটি শব্দ কমিট করলে কল হয়। */
    fun onWordCommitted(word: String) {
        userModel.recordWord(word)
        currentWord = ""
        currentSuggestions = emptyList()
        emitSuggestions()
    }

    fun getTopSuggestion(): String? = currentSuggestions.firstOrNull()
    fun getCurrentWord(): String = currentWord

    /** সাজেশন পরিষ্কার করে রিসেট করে। নতুন টেক্সট ফিল্ড ফোকাসে কল করুন। */
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

    // ── প্রাইভেট সহায়ক ───────────────────────────────────────────────────────

    private fun rescheduleCompute() {
        handler.removeCallbacks(computeRunnable)
        handler.postDelayed(computeRunnable, DEBOUNCE_MS)
    }

    private fun computeAndEmit() {
        val ic = KickKeyModule.activeInputConnection ?: return
        val textBefore = ic.getTextBeforeCursor(100, 0)?.toString() ?: return
        currentWord = textBefore.trimEnd().split(Regex("\\s+")).lastOrNull() ?: ""

        if (currentWord.isEmpty()) {
            currentSuggestions = emptyList()
            emitSuggestions()
            return
        }

        Thread {
            try {
                // ভাষা সনাক্ত করুন: বাংলা অক্ষরের কোড পয়েন্ট > 0x0900
                val isBangla = currentWord.any { it.code > 0x0900 }
                val trie = if (isBangla) banglaTrie else englishTrie

                val prefixMatches = trie.search(currentWord, MAX_PREFIX_RESULTS)
                val fuzzyMatches = if (
                    currentWord.length >= MIN_FUZZY_PREFIX_LEN &&
                    prefixMatches.size < FINAL_SUGGESTION_COUNT
                ) {
                    trie.fuzzySearch(currentWord, maxDistance = 2, maxResults = MAX_FUZZY_RESULTS)
                } else emptyList()

                val userWords = userModel.getFrequentWords(currentWord)

                currentSuggestions = (userWords + prefixMatches + fuzzyMatches)
                    .distinctBy { it.word }
                    .sortedByDescending { it.score }
                    .take(FINAL_SUGGESTION_COUNT)
                    .map { it.word }

                emitSuggestions()
            } catch (e: Exception) {
                Log.e(TAG, "সাজেশন কম্পিউট ব্যর্থ: ${e.message}")
            }
        }.start()
    }

    private fun emitSuggestions() {
        try {
            val app = context.applicationContext as KickKeyApplication
            val reactContext = app.keyboardReactHost.currentReactContext ?: return

            val params = Arguments.createMap()
            val arr = Arguments.createArray()
            currentSuggestions.forEach { arr.pushString(it) }
            params.putArray("suggestions", arr)
            params.putString("currentWord", currentWord)

            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onSuggestionsUpdated", params)
        } catch (e: Exception) {
            Log.w(TAG, "সাজেশন এমিট ব্যর্থ: ${e.message}")
        }
    }

    private fun loadDictionary(assetPath: String): Trie {
        return context.assets.open(assetPath).use { Trie.fromStream(it) }
    }
}
```

---

## 8. আপডেটেড `KickKeyModule.kt`

ফেজ ৩ থেকে চারটি পরিবর্তন। শুধুমাত্র পরিবর্তিত/যোগ করা অংশ দেখানো হয়েছে:

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyModule.kt
// শুধুমাত্র পরিবর্তন — ফেজ ৩ ফাইলে একত্রিত করুন

companion object {
    var activeInputConnection: InputConnection? = null
    var hapticManager: HapticManager? = null
    var banglaEngine: BanglaInputEngine? = null
    var suggestionEngine: SuggestionEngine? = null   // ← ফেজ ৪-এ নতুন
}

// ── আপডেটেড: commitKey এখন সাজেশন ইঞ্জিনে নোটিফাই করে ──────────────────────

Function("commitKey") { code: String, language: String ->
    val ic = activeInputConnection ?: return@Function

    if (language == "bn" && code.isNotEmpty()) {
        val banglaResult = banglaEngine?.processKey(code) ?: code
        if (banglaResult.isNotEmpty()) {
            ic.commitText(banglaResult, 1)
            suggestionEngine?.onCharacterTyped()   // ← নতুন
        }
    } else if (code.isNotEmpty()) {
        ic.commitText(code, 1)
        suggestionEngine?.onCharacterTyped()       // ← নতুন
    }
    hapticManager?.vibrate()
}

// ── আপডেটেড: sendBackspace সাজেশন ইঞ্জিনে নোটিফাই করে ──────────────────────

Function("sendBackspace") {
    val consumedByBuffer = banglaEngine?.onBackspace() ?: false
    if (!consumedByBuffer) {
        activeInputConnection?.deleteSurroundingText(1, 0)
        suggestionEngine?.onBackspace()    // ← নতুন
    }
    hapticManager?.vibrate()
}

// ── আপডেটেড: commitSpace শীর্ষ সাজেশন দিয়ে অটো-কারেক্ট করে ───────────────────

Function("commitSpace") {
    val ic = activeInputConnection ?: return@Function

    // প্রথমে বাংলা বাফার ফ্লাশ করুন (ফেজ ৩)
    val banglaFlush = banglaEngine?.flush() ?: ""
    if (banglaFlush.isNotEmpty()) {
        ic.commitText(banglaFlush, 1)
        suggestionEngine?.onCharacterTyped()
    }

    // ফেজ ৪: শীর্ষ সাজেশন দিয়ে অটো-কারেক্ট করুন
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
    hapticManager?.vibrate()
}

// ── নতুন: commitSuggestion — ব্যবহারকারী একটি চিপ ট্যাপ করেছে ─────────────────

Function("commitSuggestion") { word: String ->
    val ic = activeInputConnection ?: return@Function
    val currentWord = suggestionEngine?.getCurrentWord() ?: ""

    // আংশিকভাবে টাইপ করা শব্দ মুছুন
    if (currentWord.isNotEmpty()) {
        ic.deleteSurroundingText(currentWord.length, 0)
    }
    // বেছে নেওয়া সাজেশন + ট্রেইলিং স্পেস কমিট করুন
    ic.commitText("$word ", 1)

    // ইউজার মডেলে রেকর্ড করুন; সাজেশন পরিষ্কার করুন
    suggestionEngine?.onWordCommitted(word)
    hapticManager?.vibrate()
}

// ── ফেজ ৩ ফাংশনগুলো নিচে অপরিবর্তিত ─────────────────────────────────────────
// flushBanglaBuffer, setBanglaEnabled, sendEnter, getPreferences,
// savePreferences, isDefaultKeyboard, isKeyboardEnabled, openKeyboardSettings
```

---

## 9. আপডেটেড `KickKeyInputMethodService.kt`

```kotlin
// android/app/src/main/java/com/kickkey/KickKeyInputMethodService.kt
// সম্পূর্ণ প্রতিস্থাপন

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
        KickKeyModule.hapticManager    = HapticManager(this)
        KickKeyModule.banglaEngine     = BanglaInputEngine()
        KickKeyModule.suggestionEngine = SuggestionEngine(this)   // ← ফেজ ৪-এ নতুন
        Log.i(TAG, "IME তৈরি — হ্যাপটিক, বাংলা, সাজেশন ইঞ্জিন প্রস্তুত")
    }

    override fun onCreateInputView(): View {
        Log.i(TAG, "onCreateInputView")
        val app = application as? KickKeyApplication ?: run {
            Log.e(TAG, "KickKeyApplication পাওয়া যায়নি"); return View(this)
        }
        reactRootView = ReactRootView(this)
        reactRootView!!.startReactApplication(app.keyboardReactHost, "KickKeyKeyboard", null)
        return reactRootView!!
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        KickKeyModule.activeInputConnection = currentInputConnection
        KickKeyModule.banglaEngine?.reset()
        KickKeyModule.suggestionEngine?.reset()    // ← ফেজ ৪-এ নতুন

        // পাসওয়ার্ড ফিল্ডে সাজেশন নিষ্ক্রিয় করুন
        val isPassword = (info.inputType and 0x80) != 0
        KickKeyModule.suggestionEngine?.setEnabled(!isPassword)

        Log.i(TAG, "InputConnection অর্জিত — inputType: ${info.inputType}")
    }

    override fun onFinishInput() {
        super.onFinishInput()
        val pending = KickKeyModule.banglaEngine?.flush() ?: ""
        if (pending.isNotEmpty()) KickKeyModule.activeInputConnection?.commitText(pending, 1)
        KickKeyModule.activeInputConnection = null
        Log.i(TAG, "ইনপুট শেষ হয়েছে")
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        KickKeyModule.activeInputConnection = null
        KickKeyModule.banglaEngine?.reset()
        KickKeyModule.suggestionEngine?.reset()    // ← ফেজ ৪-এ নতুন
        Log.i(TAG, "কীবোর্ড লুকানো হয়েছে")
    }

    override fun onDestroy() {
        reactRootView?.unmountReactApplication()
        reactRootView = null
        KickKeyModule.hapticManager    = null
        KickKeyModule.banglaEngine     = null
        KickKeyModule.suggestionEngine = null      // ← ফেজ ৪-এ নতুন
        super.onDestroy()
        Log.i(TAG, "IME ধ্বংস হয়েছে")
    }
}
```

---

## 10. আপডেটেড `SuggestionBar.tsx`

ফেজ ২/৩ প্লেসহোল্ডার সম্পূর্ণরূপে প্রতিস্থাপন করুন। ৩টি পর্যন্ত শব্দ চিপস দেখায়, প্রতিটি কমিটের জন্য ট্যাপযোগ্য।

```tsx
// src/keyboard/SuggestionBar.tsx
// সম্পূর্ণ প্রতিস্থাপন

import React, { useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import type { Theme } from './types';

interface SuggestionBarProps {
  suggestions: string[];
  currentWord: string;          // বর্তমানে টাইপ করা আংশিক শব্দ
  onSelect: (word: string) => void;
  theme: Theme;
}

function SuggestionBar({ suggestions, currentWord, onSelect, theme }: SuggestionBarProps) {
  const handleSelect = useCallback(
    (word: string) => () => onSelect(word),
    [onSelect]
  );

  if (suggestions.length === 0) {
    // কোনো সাজেশন না থাকলে বর্তমান শব্দ ক্ষীণভাবে প্রতিধ্বনি দেখান
    return (
      <View style={[styles.bar, { backgroundColor: theme.suggestionBg }]}>
        {currentWord.length > 0 && (
          <View style={styles.content}>
            <Text style={[styles.echoText, { color: theme.altText }]} numberOfLines={1}>
              {currentWord}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.bar, { backgroundColor: theme.suggestionBg }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="always"
      >
        {suggestions.map((word, idx) => {
          // প্রথম সাজেশন হলো অটো-কারেক্ট ক্যান্ডিডেট
          const isAutoCorrect = idx === 0;
          return (
            <React.Fragment key={word + idx}>
              {idx > 0 && (
                <View style={[styles.divider, { backgroundColor: theme.suggestionDivider }]} />
              )}
              <TouchableOpacity
                style={[styles.chip, isAutoCorrect && styles.chipHighlighted]}
                onPress={handleSelect(word)}
                activeOpacity={0.65}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isAutoCorrect ? theme.suggestionText : theme.keyText,
                      fontWeight: isAutoCorrect ? '600' : '400',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {word}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default React.memo(SuggestionBar, (prev, next) =>
  JSON.stringify(prev.suggestions) === JSON.stringify(next.suggestions) &&
  prev.currentWord === next.currentWord &&
  prev.theme === next.theme
);

const styles = StyleSheet.create({
  bar: {
    height: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a2a',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  scroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    minHeight: 40,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipHighlighted: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#00BCD4',
  },
  chipText: { fontSize: 14 },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    alignSelf: 'center',
  },
  echoText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
```

---

## 11. আপডেটেড `useKeyboardState` হুক

ফেজ ৩ থেকে দুটি পরিবর্তন:

```typescript
// src/keyboard/hooks/useKeyboardState.ts
// শুধুমাত্র পরিবর্তন — ফেজ ৩ ফাইলে আপডেট করুন

// স্টেট ডিক্লারেশনে যোগ করুন:
const [currentWord, setCurrentWord] = useState('');   // ← ফেজ ৪-এ নতুন

// onSuggestionsUpdated লিসেনার আপডেট করুন:
const subSuggestions = emitter.addListener('onSuggestionsUpdated', (data) => {
  setSuggestions(data.suggestions ?? []);
  setCurrentWord(data.currentWord ?? '');   // ← ফেজ ৪-এ নতুন
});

// handleSuggestionSelect আপডেট করুন:
const handleSuggestionSelect = useCallback((word: string) => {
  KickKey.commitSuggestion(word);   // ← commitKey থেকে পরিবর্তিত
  setSuggestions([]);
  setCurrentWord('');
  setComposing('');
}, []);

// ফেরত দেওয়া স্টেট অবজেক্টে currentWord যোগ করুন:
return {
  language, isShift, isCapsLock, isSymbol, isEmoji, isClipboard,
  suggestions, composingText,
  currentWord,               // ← ফেজ ৪-এ নতুন
  // ... বাকি সব হ্যান্ডলার অপরিবর্তিত
};
```

`KeyboardState` ইন্টারফেস আপডেট করুন:

```typescript
export interface KeyboardState {
  // ... সমস্ত ফেজ ৩ ফিল্ড ...
  currentWord: string;   // ← ফেজ ৪-এ নতুন
}
```

`KeyboardScreen.tsx`-এ `SuggestionBar`-এ `currentWord` পাস করুন:

```tsx
// src/keyboard/KeyboardScreen.tsx — শুধুমাত্র SuggestionBar ব্যবহার আপডেট করুন
<SuggestionBar
  suggestions={suggestions}
  currentWord={currentWord}          // ← এই প্রপ যোগ করুন
  onSelect={handleSuggestionSelect}
  theme={theme}
/>
```

---

## 12. আপডেটেড `modules/kickkey-module/index.ts`

```typescript
// modules/kickkey-module/index.ts
import { NativeModules } from 'react-native';
const { KickKey } = NativeModules;

export default {
  // ── ফেজ ১ ─────────────────────────────────────────────────────────────────
  isDefaultKeyboard:    (): Promise<boolean>            => KickKey.isDefaultKeyboard(),
  isKeyboardEnabled:    (): Promise<boolean>            => KickKey.isKeyboardEnabled(),
  openKeyboardSettings: (): void                        => KickKey.openKeyboardSettings(),

  // ── ফেজ ২ ─────────────────────────────────────────────────────────────────
  commitKey:       (code: string, language: string): Promise<void> => KickKey.commitKey(code, language),
  sendBackspace:   (): Promise<void>                               => KickKey.sendBackspace(),
  commitSpace:     (): Promise<void>                               => KickKey.commitSpace(),
  sendEnter:       (): Promise<void>                               => KickKey.sendEnter(),
  getPreferences:  (): Promise<Record<string, any>>               => KickKey.getPreferences(),
  savePreferences: (p: Record<string, any>): Promise<void>        => KickKey.savePreferences(p),

  // ── ফেজ ৩ ─────────────────────────────────────────────────────────────────
  flushBanglaBuffer: (): Promise<void>           => KickKey.flushBanglaBuffer(),
  setBanglaEnabled:  (e: boolean): Promise<void> => KickKey.setBanglaEnabled(e),

  // ── ফেজ ৪ (নতুন) ──────────────────────────────────────────────────────────

  /**
   * বর্তমান আংশিক শব্দকে [word] + স্পেস দিয়ে প্রতিস্থাপন করে।
   * ভবিষ্যতে ফ্রিকোয়েন্সি বুস্টিংয়ের জন্য UserWordModel-এ পছন্দ রেকর্ড করে।
   * ব্যবহারকারী SuggestionBar-এ একটি সাজেশন চিপ ট্যাপ করলে কল হয়।
   */
  commitSuggestion: (word: string): Promise<void> =>
    KickKey.commitSuggestion(word),
};
```

---

## 13. শব্দ তালিকা ফাইল

### ১৩.১ ফরম্যাট

উভয় শব্দ তালিকা ফাইল একই ট্যাব-বিচ্ছিন্ন ফরম্যাট ব্যবহার করে:

```
# KickKey ইংরেজি ডিকশনারি
# ফরম্যাট: word<TAB>frequency
the	23135851162
be	13650487260
hello	98234
world	72100
keyboard	41200
```

### ১৩.২ সিড ইংরেজি শব্দ তালিকা

`assets/dictionaries/english.txt` তৈরি করুন:

```
# সাধারণ শব্দ (উচ্চ ফ্রিকোয়েন্সি)
the	23000000000
be	13000000000
to	13000000000
of	12000000000
and	10000000000
a	10000000000
in	9000000000
that	8000000000
have	7000000000
it	6000000000
hello	98234
world	72100
keyboard	41200
phone	88000
thank	72000
thanks	68000
please	65000
sorry	55000
okay	52000
good	88000
great	79000
love	77000
time	76000
know	75000
think	71000
come	70000
want	68000
look	65000
make	62000
see	61000
```

### ১৩.৩ সিড বাংলা শব্দ তালিকা

`assets/dictionaries/bangla.txt` তৈরি করুন:

```
# KickKey বাংলা ডিকশনারি
আমি	5000000
তুমি	4800000
সে	4600000
আমরা	4400000
তারা	4200000
আমার	4000000
তোমার	3800000
তার	3600000
এটা	3400000
সেটা	3200000
হয়	3000000
করে	2800000
যায়	2600000
আসে	2400000
দেখি	2200000
বলি	2000000
খাই	1800000
পড়ি	1600000
লিখি	1400000
শুনি	1200000
বাংলাদেশ	980000
ঢাকা	920000
বাংলা	890000
ভালো	850000
খারাপ	820000
সুন্দর	780000
বড়	750000
ছোট	720000
নতুন	690000
পুরনো	660000
আজ	950000
কাল	900000
আগামীকাল	850000
এখন	800000
তখন	750000
সময়	700000
দিন	680000
রাত	660000
সকাল	640000
বিকেল	620000
```

---

## 14. বিল্ড ও পরীক্ষা

### ১৪.১ ডিকশনারি কম্পাইল করুন

```bash
# প্রজেক্ট রুট থেকে
python3 scripts/compile_dictionaries.py

# প্রত্যাশিত আউটপুট:
# assets/dictionaries/english.txt কম্পাইল হচ্ছে ...
#   50000 শব্দ লোড হয়েছে
#   Trie-এ 312847 নোড আছে
#   লেখা হয়েছে 312847 নোড → assets/dictionaries/english.bin
# ...
# সম্পন্ন।
```

### ১৪.২ `.bin` ফাইল Android Assets-এ কপি করুন

```bash
mkdir -p android/app/src/main/assets/dictionaries
cp assets/dictionaries/english.bin android/app/src/main/assets/dictionaries/
cp assets/dictionaries/bangla.bin  android/app/src/main/assets/dictionaries/
```

অথবা `withKeyboardBundle` config plugin-এ স্বয়ংক্রিয় করুন:

```javascript
// plugins/withKeyboardBundle.js-এ যোগ করুন, keyboard.bundle বিল্ডের পরে:
const dicSrc = path.join(projectRoot, 'assets', 'dictionaries');
const dicDst = path.join(assetsDir, 'dictionaries');
if (!fs.existsSync(dicDst)) fs.mkdirSync(dicDst, { recursive: true });
['english.bin', 'bangla.bin'].forEach(f => {
  const src = path.join(dicSrc, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dicDst, f));
});
```

### ১৪.৩ keyboard.bundle পুনরায় বিল্ড করুন

```bash
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify false
```

### ১৪.৪ বিল্ড ও ইনস্টল করুন

```bash
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### ১৪.৫ লগ মনিটর করুন

```bash
adb logcat -s SuggestionEngine KickKeyIME Trie UserWordModel

# "hel" টাইপ করার পরে প্রত্যাশিত:
# I/SuggestionEngine: ইংরেজি Trie লোড হয়েছে
# (React Native সাজেশন বার আপডেট হয়)

# "hello" ট্যাপ করার পরে প্রত্যাশিত:
# V/UserWordModel: রেকর্ড করা হয়েছে 'hello' (সংখ্যা: 1)
# (সাজেশন বার পরিষ্কার হয়)
```

---

## 15. যাচাই চেকলিস্ট

ফেজ ৫-এ যাওয়ার আগে প্রতিটি আইটেম সম্পন্ন করুন।

### বিল্ড ও অবকাঠামো

- [ ] `python3 scripts/compile_dictionaries.py` ত্রুটি ছাড়া চলে
- [ ] `assets/dictionaries/english.bin` বিদ্যমান এবং > 0 বাইট
- [ ] `assets/dictionaries/bangla.bin` বিদ্যমান এবং > 0 বাইট
- [ ] `.bin` ফাইল `android/app/src/main/assets/dictionaries/`-এ কপি করা হয়েছে
- [ ] `SuggestionEngine.kt`, `Trie.kt`, `UserWordModel.kt` ত্রুটি ছাড়া কম্পাইল হয়
- [ ] APK বিল্ড এবং ইনস্টল সফল

### সাজেশন প্রদর্শন

- [ ] `hel` টাইপ করলে "hello", "help" সহ সাজেশন দেখায়
- [ ] টাইপিং থামার ১০০ms মধ্যে সাজেশন বার আপডেট হয়
- [ ] তিনটি চিপস ডিভাইডার সহ সঠিকভাবে রেন্ডার হয়
- [ ] প্রথম চিপে সূক্ষ্ম আন্ডারলাইন (অটোকারেক্ট নির্দেশক)
- [ ] কোনো সাজেশন না থাকলে বর্তমান শব্দ প্রতিধ্বনি দেখায়

### অটোকারেক্ট (স্পেস কী)

- [ ] `helo` টাইপ → স্পেস প্রেস → "hello " কমিট হয় (অটোকারেক্টেড)
- [ ] `wrold` টাইপ → স্পেস প্রেস → "world " কমিট হয় (ফাজি ম্যাচ)
- [ ] `abc` টাইপ (কোনো মিল নেই) → স্পেস প্রেস → "abc " যেভাবে আছে কমিট হয়

### সাজেশন ট্যাপ

- [ ] `hel` টাইপ → "hello" ট্যাপ → ফিল্ডে "hel" প্রতিস্থাপিত হয় "hello "
- [ ] WhatsApp, Chrome, Gmail-এ সাজেশন ট্যাপ সঠিকভাবে কাজ করে
- [ ] সাজেশন ট্যাপের পরে বার পরিষ্কার হয়
- [ ] "hello" দুবার ট্যাপ করার পরে পরবর্তীবার "hel" টাইপ করলে "hello" প্রথমে আসে

### বাংলা সাজেশন

- [ ] বাংলা মোডে `আমি` টাইপ করলে বাংলা শব্দ সাজেশন দেখায়
- [ ] বাংলা সাজেশনে সঠিক Unicode অক্ষর থাকে
- [ ] বাংলা সাজেশন ট্যাপ করলে বর্তমান বাংলা শব্দ প্রতিস্থাপিত হয়

### পাসওয়ার্ড ফিল্ড

- [ ] পাসওয়ার্ড ফিল্ড ট্যাপ করলে সাজেশন বার খালি/নিষ্ক্রিয়
- [ ] পাসওয়ার্ড ফিল্ডে টাইপিংয়ের সময় কোনো সাজেশন দেখায় না

### পারফরম্যান্স

- [ ] টাইপিং থামার পরে সাজেশন লেটেন্সি: < ১০০ms
- [ ] দ্রুত টাইপিংয়ের সময় কোনো ANR নেই
- [ ] ১০০+ শব্দ নির্বাচনের পরে IME প্রসেস RAM অনিয়ন্ত্রিতভাবে বৃদ্ধি পায় না

---

## 16. সমস্যা সমাধান

### সাজেশন কখনো দেখায় না — বার খালি থাকে

**পরীক্ষা ১:** `.bin` ফাইল সঠিক জায়গায় আছে?
```bash
ls android/app/src/main/assets/dictionaries/
# english.bin এবং bangla.bin উভয়ই থাকতে হবে
```

**পরীক্ষা ২:** `SuggestionEngine` ইনিশিয়ালাইজড?
```bash
adb logcat -s KickKeyIME | grep "suggestion"
# প্রত্যাশিত: "IME তৈরি — হ্যাপটিক, বাংলা, সাজেশন ইঞ্জিন প্রস্তুত"
```

---

### `Trie.fromStream` "অবৈধ Trie ফাইল" ত্রুটি দেয়

**কারণ:** `.bin` ফাইল নষ্ট বা কম্পাইলার দ্বারা তৈরি হয়নি।

**সমাধান:**
```bash
python3 scripts/compile_dictionaries.py
cp assets/dictionaries/english.bin android/app/src/main/assets/dictionaries/
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

### স্পেসে অটোকারেক্ট কাজ করে না

**কারণ:** `commitSpace` ফেজ ৪ পরিবর্তন সঠিকভাবে একত্রিত হয়নি।

**পরীক্ষা করুন `KickKeyModule.kt`:**
```kotlin
Function("commitSpace") {
    ...
    val top = suggestionEngine?.getTopSuggestion()
    if (top != null) { ... }   // ← এই ব্লক থাকতে হবে
}
```

---

### সাজেশন চিপ ট্যাপ করলে কিছু হয় না

**কারণ ১:** `commitSuggestion` `KickKeyModule.kt`-এ যোগ হয়নি।

**পরীক্ষা করুন:**
```bash
grep "commitSuggestion" modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyModule.kt
```

**কারণ ২:** `useKeyboardState.ts`-এ `handleSuggestionSelect` এখনো `commitKey` কল করছে।

**পরীক্ষা করুন:**
```typescript
const handleSuggestionSelect = useCallback((word: string) => {
  KickKey.commitSuggestion(word);   // ← commitSuggestion হতে হবে, commitKey নয়
```

---

### Python কম্পাইলার স্ক্রিপ্ট `UnicodeDecodeError` দেয়

**কারণ:** শব্দ তালিকা ফাইল UTF-8-এ সংরক্ষিত নয়।

**সমাধান:**
```bash
iconv -f latin1 -t utf-8 assets/dictionaries/english.txt > /tmp/english_utf8.txt
mv /tmp/english_utf8.txt assets/dictionaries/english.txt
```

---

### বাংলা সাজেশন ইংরেজি সাজেশনের মতো কাজ করে না

**কারণ:** ইঞ্জিন টেক্সটকে বাংলা হিসেবে সনাক্ত করছে না।

**পরীক্ষা করুন `SuggestionEngine.kt`:**
```kotlin
val isBangla = currentWord.any { it.code > 0x0900 }
```
বাংলা Unicode ব্লক U+0980 থেকে শুরু। যদি বাংলা অক্ষরের কোড পয়েন্ট ≤ 0x0900 হয় তাহলে সনাক্ত হবে না। `currentWord.map { it.code.toString(16) }` লগ করুন পরীক্ষা করতে।

---

*ফেজ ৪ সম্পন্ন। সেটিংস, অনবোর্ডিং উইজার্ড, থিম পিকার তৈরি করতে এবং SharedPreferences দ্বারা IME-এ সিঙ্ক করতে ফেজ ৫ — কম্প্যানিয়ন অ্যাপ — এ এগিয়ে যান।*
