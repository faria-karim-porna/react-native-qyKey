# KickKey — ফেজ ৮ বাস্তবায়ন গাইড
## টেস্টিং ও রিলিজ (সপ্তাহ ১৫–১৬)

> **লক্ষ্য:** KickKey Google Play Store-এ লাইভ। সমস্ত Kotlin ইঞ্জিনের ইউনিট টেস্ট কভারেজ ৮০%-এর বেশি, অ্যাপ তিনটি OEM পরিবার (Samsung/Xiaomi/Pixel) এবং তিনটি Android ভার্সনে (10/12/14) পূর্ণ ম্যানুয়াল টেস্ট ম্যাট্রিক্স পাস করে, একটি গোপনীয়তা নীতি প্রকাশিত, Play Store লিস্টিং স্ক্রিনশট ও বিবরণ সহ সম্পূর্ণ, এবং প্রোডাকশন AAB পর্যালোচনার জন্য জমা দেওয়া হয়েছে।
> **ফেজ ৭-এর উপর নির্মিত** — অ্যাপ ফিচার-সম্পূর্ণ এবং পারফরম্যান্স-টিউনড। ফেজ ৮ কোনো নতুন ফিচার যোগ করে না; এটি বিদ্যমান যা আছে তা যাচাই করে, Google Play-এর কীবোর্ড অ্যাপের জন্য বাধ্যতামূলক সম্মতি প্রয়োজনীয়তায় মোড়ায়, এবং শিপ করে।

---

## বিষয়সূচি

1. [ফেজ ৮-এ কী হয়](#1-ফেজ-৮-এ-কী-হয়)
2. [ইউনিট টেস্টিং — Kotlin ইঞ্জিন](#2-ইউনিট-টেস্টিং--kotlin-ইঞ্জিন)
3. [ইউনিট টেস্ট: BanglaInputEngine — সম্পূর্ণ সুইট](#3-ইউনিট-টেস্ট-banglainputengine--সম্পূর্ণ-সুইট)
4. [ইউনিট টেস্ট: Trie — সম্পূর্ণ সুইট](#4-ইউনিট-টেস্ট-trie--সম্পূর্ণ-সুইট)
5. [ইউনিট টেস্ট: UserWordModel — সম্পূর্ণ সুইট](#5-ইউনিট-টেস্ট-userwordmodel--সম্পূর্ণ-সুইট)
6. [ইউনিট টেস্ট: ClipboardHandler — সম্পূর্ণ সুইট](#6-ইউনিট-টেস্ট-clipboardhandler--সম্পূর্ণ-সুইট)
7. [JaCoCo দিয়ে কভারেজ পরিমাপ](#7-jacoco-দিয়ে-কভারেজ-পরিমাপ)
8. [ম্যানুয়াল টেস্ট ম্যাট্রিক্স](#8-ম্যানুয়াল-টেস্ট-ম্যাট্রিক্স)
9. [ডিভাইস টেস্টিং: Samsung (One UI)](#9-ডিভাইস-টেস্টিং-samsung-one-ui)
10. [ডিভাইস টেস্টিং: Xiaomi (MIUI / HyperOS)](#10-ডিভাইস-টেস্টিং-xiaomi-miui--hyperos)
11. [ডিভাইস টেস্টিং: Pixel (স্টক Android)](#11-ডিভাইস-টেস্টিং-pixel-স্টক-android)
12. [IME প্রসেস কিল ও রিকভারি টেস্ট](#12-ime-প্রসেস-কিল-ও-রিকভারি-টেস্ট)
13. [গোপনীয়তা নীতি](#13-গোপনীয়তা-নীতি)
14. [Play Store লিস্টিং](#14-play-store-লিস্টিং)
15. [প্রোডাকশন EAS বিল্ড](#15-প্রোডাকশন-eas-বিল্ড)
16. [Play Store জমা](#16-play-store-জমা)
17. [লঞ্চ-পরবর্তী মনিটরিং](#17-লঞ্চ-পরবর্তী-মনিটরিং)
18. [রিলিজ চেকলিস্ট](#18-রিলিজ-চেকলিস্ট)
19. [সমস্যা সমাধান](#19-সমস্যা-সমাধান)

---

## 1. ফেজ ৮-এ কী হয়

### তৈরি করতে হবে

| ফাইল | উদ্দেশ্য |
|---|---|
| `android/app/src/test/java/com/kickkey/TrieTest.kt` | Trie প্রিফিক্স এবং ফাজি সার্চের ইউনিট টেস্ট |
| `android/app/src/test/java/com/kickkey/UserWordModelTest.kt` | UserWordModel ফ্রিকোয়েন্সি ট্র্যাকিংয়ের ইউনিট টেস্ট |
| `android/app/src/test/java/com/kickkey/ClipboardHandlerTest.kt` | ClipboardHandler হিস্ট্রি ম্যানেজমেন্টের ইউনিট টেস্ট |
| `android/app/build.gradle` সংযোজন | JaCoCo কোড কভারেজ প্লাগইন কনফিগ |
| `privacy-policy.md` | সাধারণ-টেক্সট গোপনীয়তা নীতি (GitHub Pages বা অনুরূপে হোস্টেড) |
| `store/screenshots/` | Play Store স্ক্রিনশট (ফোন + ৭" ট্যাবলেট সাইজ) |

> `BanglaInputEngineTest.kt` ফেজ ৩-এ ইতিমধ্যে তৈরি হয়েছে। এই ফেজ এর কভারেজ প্রসারিত করে এবং বাকি ইঞ্জিন টেস্ট যোগ করে।

### আপডেট করতে হবে

| ফাইল | কী পরিবর্তন হয় |
|---|---|
| `android/app/src/test/java/com/kickkey/BanglaInputEngineTest.kt` | ৮০%-এর বেশি কভারেজের জন্য এজ-কেস টেস্ট যোগ |
| `android/app/build.gradle` | JaCoCo প্লাগইন, টেস্ট অপশন, কভারেজ টাস্ক যোগ |
| `eas.json` | `production` প্রোফাইল যাচাই করুন (ফেজ ১-এ ইতিমধ্যে আছে) |
| `app.json` | প্রোডাকশন ভার্সন কোড এবং নাম সেট করুন |

### পরিবর্তন হবে না

সমস্ত সোর্স কোড ফাইল — `KickKeyModule.kt`, `KickKeyInputMethodService.kt`, `SuggestionEngine.kt`, `BanglaInputEngine.kt`, `Trie.kt`, `UserWordModel.kt`, `ClipboardHandler.kt`, `HapticManager.kt`, `KickKeyApplication.kt`, `src/keyboard/`-এর সবকিছু, `app/`, `store/`, `hooks/`, `components/`-এর সবকিছু। ফেজ ৮ সমস্ত প্রোডাকশন কোডের জন্য রিড-অনলি।

---

## 2. ইউনিট টেস্টিং — Kotlin ইঞ্জিন

### ২.১ টেস্ট ডিরেক্টরি স্ট্রাকচার

```
android/app/src/test/java/com/kickkey/
├── BanglaInputEngineTest.kt     ← ফেজ ৩ — এখানে প্রসারিত করুন
├── TrieTest.kt                  ← ফেজ ৮-এ নতুন
├── UserWordModelTest.kt         ← ফেজ ৮-এ নতুন
└── ClipboardHandlerTest.kt      ← ফেজ ৮-এ নতুন
```

### ২.২ টেস্ট ডিপেন্ডেন্সি

`android/app/build.gradle`-এ এগুলো নিশ্চিত করুন:

```groovy
dependencies {
    // Kotlin ইউনিট টেস্টের জন্য JUnit 5
    testImplementation("org.junit.jupiter:junit-jupiter-api:5.10.0")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.10.0")

    // Android Context মক করার জন্য MockK
    testImplementation("io.mockk:mockk:1.13.8")

    // Kotlin coroutines টেস্ট সাপোর্ট
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
```

সমস্ত ইউনিট টেস্ট চালান:

```bash
cd android
./gradlew :app:test
```

একটি একক টেস্ট ক্লাস চালান:

```bash
./gradlew :app:test --tests "com.kickkey.TrieTest"
```

---

## 3. ইউনিট টেস্ট: `BanglaInputEngineTest` — প্রসারিত সুইট

ফেজ ৩ টেস্ট ফাইলটি অতিরিক্ত এজ-কেস টেস্ট দিয়ে প্রসারিত করুন।

```kotlin
// android/app/src/test/java/com/kickkey/BanglaInputEngineTest.kt
// বিদ্যমান ফেজ ৩ ফাইলে এই টেস্টগুলো যোগ করুন

// ── MAX_BUFFER-এ স্বয়ংক্রিয়-ফ্লাশ ──────────────────────────────────────────────

@Test fun `৫ অক্ষরে বাফার স্বয়ংক্রিয়-ফ্লাশ হয় মিল ছাড়া`() {
    engine.reset()
    val result = StringBuilder()
    "zzzzz".forEach { result.append(engine.processKey(it.toString())) }
    result.append(engine.flush())
    // সমস্ত ৫ অক্ষর রোমান টেক্সট হিসেবে ফ্লাশ হওয়া উচিত
    assertEquals(5, result.toString().length)
}

// ── বড় হাতের দ্বারা চালু মাত্রা (ভাওয়েল সাইন) ───────────────────────────────────

@Test fun `বড় হাতের A আ-মাত্রা তৈরি করে`() { assertEquals("া", type("A")) }
@Test fun `বড় হাতের I ি-মাত্রা তৈরি করে`() { assertEquals("ি", type("I")) }
@Test fun `বড় হাতের U ু-মাত্রা তৈরি করে`() { assertEquals("ু", type("U")) }
@Test fun `বড় হাতের E ে-মাত্রা তৈরি করে`() { assertEquals("ে", type("E")) }

// ── হসন্ত / বিরাম ─────────────────────────────────────────────────────────────────

@Test fun `ব্যাকটিক হসন্ত তৈরি করে`() {
    engine.reset()
    val result = engine.processKey("`")
    assertEquals("্", result)
}

// ── চন্দ্রবিন্দু ───────────────────────────────────────────────────────────────────

@Test fun `ক্যারেট চন্দ্রবিন্দু তৈরি করে`() {
    engine.reset()
    val result = engine.processKey("^")
    assertEquals("ঁ", result)
}

// ── বিসর্গ ─────────────────────────────────────────────────────────────────────────

@Test fun `কোলন বিসর্গ তৈরি করে`() {
    engine.reset()
    val result = engine.processKey(":")
    assertEquals("ঃ", result)
}

// ── মূর্ধন্য ব্যঞ্জনবর্ণ (সরাসরি) ────────────────────────────────────────────────────

@Test fun `বড় হাতের T ট তৈরি করে`() {
    engine.reset()
    val result = engine.processKey("T")
    assertEquals("ট", result)
}

@Test fun `বড় হাতের D ড তৈরি করে`() {
    engine.reset()
    val result = engine.processKey("D")
    assertEquals("ড", result)
}

@Test fun `বড় হাতের N ণ তৈরি করে`() {
    engine.reset()
    val result = engine.processKey("N")
    assertEquals("ণ", result)
}

// ── যুক্তবর্ণ: kka ──────────────────────────────────────────────────────────────

@Test fun `kka ক্ক যুক্তবর্ণ তৈরি করে`() {
    assertEquals("ক্ক", type("kka"))
}

// ── দুই-অক্ষর বাফারে ডাবল ব্যাকস্পেস ────────────────────────────────────────────

@Test fun `দুই ব্যাকস্পেস দুই-অক্ষর বাফার পরিষ্কার করে`() {
    engine.reset()
    engine.processKey("k")
    engine.processKey("h")    // বাফার = "kh"
    assertTrue(engine.onBackspace())   // 'h' সরায় → বাফার = "k"
    assertEquals("k", engine.getBuffer())
    assertTrue(engine.onBackspace())   // 'k' সরায় → বাফার = ""
    assertEquals("", engine.getBuffer())
}

// ── শব্দের পরে ফ্লাশ ──────────────────────────────────────────────────────────────

@Test fun `আংশিক শব্দের পরে ফ্লাশ অপেক্ষমাণ অক্ষর ফেরত দেয়`() {
    engine.reset()
    engine.processKey("k")
    engine.processKey("h")
    val pending = engine.flush()
    assertEquals("kh", pending)
    assertEquals("", engine.getBuffer())
}

// ── খালি ফ্লাশ খালি স্ট্রিং ফেরত দেয় ─────────────────────────────────────────────

@Test fun `খালি বাফারে ফ্লাশ খালি স্ট্রিং ফেরত দেয়`() {
    engine.reset()
    assertEquals("", engine.flush())
}

// ── রিসেট অপেক্ষমাণ পরিষ্কার করে ──────────────────────────────────────────────────

@Test fun `আংশিক শব্দের পরে রিসেট বাফার পরিষ্কার করে`() {
    engine.reset()
    engine.processKey("b")
    engine.processKey("h")
    engine.reset()
    assertEquals("", engine.getBuffer())
    // রিসেটের পরে, 'a' টাইপ করা স্বাভাবিকভাবে কাজ করা উচিত
    val result = engine.processKey("a")
    assertEquals("অ", result)
}
```

---

## 4. ইউনিট টেস্ট: `TrieTest` — সম্পূর্ণ সুইট

```kotlin
// android/app/src/test/java/com/kickkey/TrieTest.kt

package com.kickkey

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.io.ByteArrayInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

class TrieTest {

    companion object {
        private const val MAGIC = 0x54524945
        private const val NODE_SIZE = 20
        private const val HEADER_SIZE = 12
    }

    /**
     * শব্দ -> ফ্রিকোয়েন্সির ম্যাপ থেকে একটি ন্যূনতম বাইনারি Trie তৈরি করুন।
     * এটি বিল্ড টাইমে compile_dictionaries.py যা তৈরি করে তা নকল করে,
     * তাই টেস্টগুলো .bin ফাইল ছাড়া স্বয়ংসম্পূর্ণ।
     */
    private fun buildTrie(words: Map<String, Int>): Trie {
        data class TrieNode(val ch: Char, var freq: Int = 0, val children: MutableList<Int> = mutableListOf())
        val nodes = mutableListOf(TrieNode('\u0000'))  // রুট ইনডেক্স 0-এ

        for ((word, freq) in words) {
            var idx = 0
            for (ch in word) {
                val existing = nodes[idx].children.firstOrNull { nodes[it].ch == ch }
                if (existing != null) {
                    idx = existing
                } else {
                    val newIdx = nodes.size
                    nodes.add(TrieNode(ch))
                    nodes[idx].children.add(newIdx)
                    idx = newIdx
                }
            }
            nodes[idx].freq = freq
        }

        val buf = ByteBuffer.allocate(HEADER_SIZE + nodes.size * NODE_SIZE).order(ByteOrder.BIG_ENDIAN)
        buf.putInt(MAGIC)
        buf.putInt(1)
        buf.putInt(nodes.size)

        for (node in nodes) {
            val firstChild = if (node.children.isEmpty()) -1 else node.children[0]
            buf.putInt(firstChild)
            buf.putInt(-1)           // ভাই — পরীক্ষার উদ্দেশ্যে প্লেসহোল্ডার
            buf.putInt(node.freq)
            buf.putInt(node.ch.code)
            buf.putInt(0)
        }

        return Trie.fromStream(ByteArrayInputStream(buf.array()))
    }

    private lateinit var trie: Trie

    @BeforeEach
    fun setUp() {
        trie = buildTrie(mapOf(
            "hello"   to 10000,
            "help"    to 8000,
            "held"    to 6000,
            "helm"    to 5000,
            "he"      to 4000,
            "hey"     to 3000,
            "world"   to 9000,
            "word"    to 7000,
            "work"    to 6500,
            "cat"     to 5500,
            "bat"     to 4500,
        ))
    }

    // ── প্রিফিক্স সার্চ ──────────────────────────────────────────────────────────

    @Test fun `'hel' সার্চ hello help held ফেরত দেয়`() {
        val results = trie.search("hel", 5)
        val words = results.map { it.word }
        assertTrue("hello" in words, "'hello' ফলাফলে প্রত্যাশিত")
        assertTrue("help"  in words, "'help' ফলাফলে প্রত্যাশিত")
    }

    @Test fun `সার্চ ফ্রিকোয়েন্সি দ্বারা সাজানো ফলাফল ফেরত দেয়`() {
        val results = trie.search("hel", 3)
        // hello(10000) > help(8000) > held(6000)
        assertEquals("hello", results[0].word)
        assertEquals("help",  results[1].word)
    }

    @Test fun `অস্তিত্বহীন প্রিফিক্সের সার্চ খালি ফেরত দেয়`() {
        val results = trie.search("xyz", 5)
        assertTrue(results.isEmpty())
    }

    @Test fun `খালি প্রিফিক্সের সার্চ খালি ফেরত দেয়`() {
        val results = trie.search("", 5)
        assertTrue(results.isEmpty())
    }

    @Test fun `সার্চ maxResults সীমা মেনে চলে`() {
        val results = trie.search("he", 2)
        assertTrue(results.size <= 2)
    }

    @Test fun `সঠিক মিল ফলাফলে অন্তর্ভুক্ত`() {
        val results = trie.search("hello", 5)
        val words = results.map { it.word }
        assertTrue("hello" in words)
    }

    // ── অবৈধ ফাইল ──────────────────────────────────────────────────────────────

    @Test fun `fromStream ভুল magic-এ ছুঁড়ে দেয়`() {
        val badData = ByteArray(HEADER_SIZE + NODE_SIZE) { 0x00 }
        assertThrows(IllegalArgumentException::class.java) {
            Trie.fromStream(ByteArrayInputStream(badData))
        }
    }
}
```

---

## 5. ইউনিট টেস্ট: `UserWordModelTest` — সম্পূর্ণ সুইট

```kotlin
// android/app/src/test/java/com/kickkey/UserWordModelTest.kt

package com.kickkey

import android.content.Context
import android.content.SharedPreferences
import io.mockk.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class UserWordModelTest {

    private lateinit var model: UserWordModel
    private lateinit var mockContext: Context
    private lateinit var mockPrefs: SharedPreferences
    private lateinit var mockEditor: SharedPreferences.Editor
    private val prefStorage = mutableMapOf<String, String?>()

    @BeforeEach
    fun setUp() {
        mockContext = mockk(relaxed = true)
        mockPrefs   = mockk(relaxed = true)
        mockEditor  = mockk(relaxed = true)

        every { mockContext.getSharedPreferences(any(), any()) } returns mockPrefs
        every { mockPrefs.getString(any(), any()) } answers {
            prefStorage[firstArg()] ?: secondArg()
        }
        every { mockPrefs.edit() } returns mockEditor
        every { mockEditor.putString(any(), any()) } answers {
            prefStorage[firstArg()] = secondArg()
            mockEditor
        }
        every { mockEditor.apply() } just Runs

        model = UserWordModel(mockContext)
    }

    @Test fun `recordWord নতুন শব্দের সংখ্যা বাড়ায়`() {
        model.recordWord("hello")
        val results = model.getFrequentWords("hel")
        assertTrue(results.any { it.word == "hello" })
    }

    @Test fun `recordWord বিদ্যমান শব্দের সংখ্যা বাড়ায়`() {
        model.recordWord("hello")
        model.recordWord("hello")
        val results = model.getFrequentWords("hel")
        val score = results.first { it.word == "hello" }.score
        // স্কোর = BOOST_SCORE (10000) + সংখ্যা (2)
        assertEquals(10002, score)
    }

    @Test fun `getFrequentWords মিল না থাকলে খালি ফেরত দেয়`() {
        model.recordWord("hello")
        val results = model.getFrequentWords("xyz")
        assertTrue(results.isEmpty())
    }

    @Test fun `getFrequentWords প্রিফিক্স সঠিকভাবে মেলায়`() {
        model.recordWord("hello")
        model.recordWord("help")
        model.recordWord("world")
        val results = model.getFrequentWords("hel")
        val words = results.map { it.word }
        assertTrue("hello" in words)
        assertTrue("help"  in words)
        assertFalse("world" in words)
    }

    @Test fun `getFrequentWords সর্বোচ্চ ৩টি ফলাফল ফেরত দেয়`() {
        model.recordWord("hello")
        model.recordWord("help")
        model.recordWord("held")
        model.recordWord("helm")
        val results = model.getFrequentWords("hel")
        assertTrue(results.size <= 3)
    }

    @Test fun `ফাঁকা শব্দ উপেক্ষা করা হয়`() {
        model.recordWord("   ")
        val results = model.getFrequentWords(" ")
        assertTrue(results.isEmpty())
    }

    @Test fun `৫০ অক্ষরের বেশি শব্দ উপেক্ষা করা হয়`() {
        val longWord = "a".repeat(51)
        model.recordWord(longWord)
        val results = model.getFrequentWords("a")
        assertFalse(results.any { it.word == longWord })
    }

    @Test fun `বুস্ট স্কোর ১০০০০ প্লাস সংখ্যা`() {
        model.recordWord("test")
        model.recordWord("test")
        model.recordWord("test")
        val results = model.getFrequentWords("te")
        val score = results.first { it.word == "test" }.score
        assertEquals(10003, score)
    }

    @Test fun `ফলাফল স্কোর অনুযায়ী অবরোহ ক্রমে সাজানো`() {
        repeat(5) { model.recordWord("hello") }
        repeat(2) { model.recordWord("help") }
        val results = model.getFrequentWords("hel")
        assertTrue(results[0].score >= results.last().score)
    }
}
```

---

## 6. ইউনিট টেস্ট: `ClipboardHandlerTest` — সম্পূর্ণ সুইট

```kotlin
// android/app/src/test/java/com/kickkey/ClipboardHandlerTest.kt

package com.kickkey

import android.content.Context
import android.content.SharedPreferences
import io.mockk.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class ClipboardHandlerTest {

    private lateinit var handler: ClipboardHandler
    private lateinit var mockContext: Context
    private lateinit var mockPrefs: SharedPreferences
    private lateinit var mockEditor: SharedPreferences.Editor
    private val prefStorage = mutableMapOf<String, String?>()

    @BeforeEach
    fun setUp() {
        mockContext = mockk(relaxed = true)
        mockPrefs   = mockk(relaxed = true)
        mockEditor  = mockk(relaxed = true)

        every { mockContext.getSharedPreferences(any(), any()) } returns mockPrefs
        every { mockPrefs.getString(any(), any()) } answers {
            prefStorage[firstArg()] ?: secondArg()
        }
        every { mockPrefs.edit() } returns mockEditor
        every { mockEditor.putString(any(), any()) } answers {
            prefStorage[firstArg()] = secondArg()
            mockEditor
        }
        every { mockEditor.apply() } just Runs
        every { mockContext.getSystemService(Context.CLIPBOARD_SERVICE) } returns null

        handler = ClipboardHandler(mockContext)
    }

    @Test fun `getHistory প্রথমে খালি তালিকা ফেরত দেয়`() {
        assertTrue(handler.getHistory().isEmpty())
    }

    @Test fun `addToHistory একটি আইটেম যোগ করে`() {
        handler.addToHistory("হ্যালো ওয়ার্ল্ড")
        assertEquals(listOf("হ্যালো ওয়ার্ল্ড"), handler.getHistory())
    }

    @Test fun `addToHistory সর্বশেষ প্রথমে যোগ করে`() {
        handler.addToHistory("প্রথম")
        handler.addToHistory("দ্বিতীয়")
        val history = handler.getHistory()
        assertEquals("দ্বিতীয়", history[0])
        assertEquals("প্রথম",   history[1])
    }

    @Test fun `addToHistory ডুপ্লিকেট সরায় এবং সামনে নিয়ে যায়`() {
        handler.addToHistory("প্রথম")
        handler.addToHistory("দ্বিতীয়")
        handler.addToHistory("প্রথম")   // 'প্রথম' সামনে নিয়ে যান
        val history = handler.getHistory()
        assertEquals("প্রথম",   history[0])
        assertEquals("দ্বিতীয়", history[1])
        assertEquals(2, history.size)
    }

    @Test fun `clearHistory সমস্ত আইটেম সরায়`() {
        handler.addToHistory("আইটেম১")
        handler.addToHistory("আইটেম২")
        handler.clearHistory()
        assertTrue(handler.getHistory().isEmpty())
    }

    @Test fun `removeItem শুধুমাত্র নির্দিষ্ট আইটেম সরায়`() {
        handler.addToHistory("রাখুন")
        handler.addToHistory("সরান")
        handler.removeItem("সরান")
        val history = handler.getHistory()
        assertTrue("রাখুন" in history)
        assertFalse("সরান" in history)
    }

    @Test fun `হিস্ট্রি ২০ আইটেমে সীমাবদ্ধ`() {
        repeat(25) { handler.addToHistory("আইটেম$it") }
        assertTrue(handler.getHistory().size <= 20)
    }

    @Test fun `ফাঁকা আইটেম উপেক্ষা করা হয়`() {
        handler.addToHistory("   ")
        assertTrue(handler.getHistory().isEmpty())
    }

    @Test fun `৫০০০ অক্ষরের বেশি আইটেম উপেক্ষা করা হয়`() {
        handler.addToHistory("a".repeat(5001))
        assertTrue(handler.getHistory().isEmpty())
    }

    // ── সাম্প্রতিক ইমোজি টেস্ট ─────────────────────────────────────────────────────

    @Test fun `getRecentEmojis প্রথমে খালি ফেরত দেয়`() {
        assertTrue(handler.getRecentEmojis().isEmpty())
    }

    @Test fun `recordEmojiUsed ইমোজি যোগ করে`() {
        handler.recordEmojiUsed("😀")
        assertTrue("😀" in handler.getRecentEmojis())
    }

    @Test fun `recordEmojiUsed পুনরাবৃত্তিতে সামনে নিয়ে যায়`() {
        handler.recordEmojiUsed("😀")
        handler.recordEmojiUsed("😂")
        handler.recordEmojiUsed("😀")   // 😀 সামনে নিয়ে যান
        assertEquals("😀", handler.getRecentEmojis()[0])
    }

    @Test fun `সাম্প্রতিক ইমোজি তালিকা ৩০-এ সীমাবদ্ধ`() {
        repeat(35) { handler.recordEmojiUsed("emoji$it") }
        assertTrue(handler.getRecentEmojis().size <= 30)
    }

    @Test fun `ক্লিপবোর্ড এবং ইমোজি পৃথক কী-তে সংরক্ষিত`() {
        handler.addToHistory("ক্লিপবোর্ড টেক্সট")
        handler.recordEmojiUsed("😀")
        assertTrue("ক্লিপবোর্ড টেক্সট" in handler.getHistory())
        assertTrue("😀" in handler.getRecentEmojis())
    }
}
```

---

## 7. JaCoCo দিয়ে কভারেজ পরিমাপ

### ৭.১ `android/app/build.gradle`-এ JaCoCo কনফিগার করুন

```groovy
// android/app/build.gradle — android { } ব্লকের ভেতরে যোগ করুন

android {
    buildTypes {
        debug {
            testCoverageEnabled true   // JaCoCo-র জন্য প্রয়োজনীয়
        }
    }
}

// android { } ব্লকের পরে যোগ করুন:
apply plugin: 'jacoco'

jacoco {
    toolVersion = "0.8.11"
}

task jacocoTestReport(type: JacocoReport, dependsOn: ['testDebugUnitTest']) {
    reports {
        xml.required  = true
        html.required = true
    }

    def fileFilter = [
        '**/R.class', '**/R$*.class', '**/BuildConfig.*', '**/Manifest*.*',
        '**/*Test*.*', 'android/**/*.*',
        '**/expo/**', '**/com/facebook/**',
    ]

    def debugTree = fileTree(
        dir: "${buildDir}/intermediates/javac/debug/classes",
        excludes: fileFilter
    )
    def kotlinDebugTree = fileTree(
        dir: "${buildDir}/tmp/kotlin-classes/debug",
        excludes: fileFilter
    )

    sourceDirectories.setFrom(files(["src/main/java"]))
    classDirectories.setFrom(files([debugTree, kotlinDebugTree]))
    executionData.setFrom(fileTree(
        dir: "${buildDir}",
        includes: ["jacoco/testDebugUnitTest.exec"]
    ))
}
```

### ৭.২ কভারেজ রিপোর্ট চালান এবং দেখুন

```bash
cd android

# টেস্ট চালান এবং কভারেজ তৈরি করুন
./gradlew jacocoTestReport

# ব্রাউজারে HTML রিপোর্ট খুলুন
open app/build/reports/jacoco/jacocoTestReport/html/index.html
# Linux-এ:
xdg-open app/build/reports/jacoco/jacocoTestReport/html/index.html
```

### ৭.৩ ক্লাস অনুযায়ী কভারেজ লক্ষ্যমাত্রা

| ক্লাস | লাইন কভারেজ লক্ষ্যমাত্রা | নোট |
|---|---|---|
| `BanglaInputEngine` | > ৯০% | সমালোচনামূলক পথ — প্রতিটি ফোনেটিক নিয়ম পরীক্ষা করতে হবে |
| `Trie` | > ৮০% | `fromAsset()` ইউনিট টেস্টে অপরীক্ষণীয় (Context প্রয়োজন); `fromStream()` + সার্চ মেথড কভার্ড |
| `UserWordModel` | > ৮৫% | পার্সিস্টেন্স লেয়ার মক করা; সমস্ত পাবলিক API কভার্ড |
| `ClipboardHandler` | > ৮০% | `captureCurrentClipboard()` এড়িয়ে যাওয়া (প্রকৃত ClipboardManager প্রয়োজন); হিস্ট্রি মেথড পূর্ণভাবে কভার্ড |
| `SuggestionEngine` | > ৬০% | ব্যাকগ্রাউন্ড থ্রেড এবং এমিট পথ ইউনিট পরীক্ষা করা কঠিন; ম্যানুয়াল টেস্টিং দ্বারা ইন্টিগ্রেশন-পরীক্ষা |
| `HapticManager` | ছাড় | শুধুমাত্র-প্ল্যাটফর্ম (Vibrator) — কোনো ইউনিট-পরীক্ষণযোগ্য লজিক নেই |
| `KickKeyModule` | ছাড় | ব্রিজ ওয়্যারিং — ইন্টিগ্রেশন টেস্টিং দ্বারা পরোক্ষভাবে পরীক্ষিত |

---

## 8. ম্যানুয়াল টেস্ট ম্যাট্রিক্স

এই ম্যাট্রিক্স সেকশন ৯–১১-এর তিনটি ডিভাইস পরিবারে রিলিজের আগে সম্পন্ন করতে হবে।

| # | টেস্ট কেস | পাস / ফেল |
|---|---|---|
| T01 | অ্যাপ ত্রুটি ছাড়া ইনস্টল হয় | |
| T02 | কম্প্যানিয়ন অ্যাপ নতুন ইনস্টলে অনবোর্ডিংয়ে খোলে | |
| T03 | Android Settings-এ কীবোর্ড সক্রিয় করুন → অ্যাপ স্বয়ংক্রিয়ভাবে এগিয়ে যায় | |
| T04 | ডিফল্ট হিসেবে সেট করুন → অ্যাপ সাফল্য স্ক্রিনে এগিয়ে যায় | |
| T05 | যেকোনো টেক্সট ফিল্ড ট্যাপ করলে KickKey খোলে | |
| T06 | সমস্ত ২৬টি ইংরেজি ছোট হাতের অক্ষর সঠিকভাবে টাইপ হয় | |
| T07 | সমস্ত ২৬টি ইংরেজি বড় হাতের অক্ষর সঠিকভাবে টাইপ হয় (Shift) | |
| T08 | Caps Lock ডাবল Shift-এ সক্রিয় থাকে; তিন Shift-এ বন্ধ হয় | |
| T09 | ব্যাকস্পেস প্রতি ট্যাপে একটি অক্ষর মুছে | |
| T10 | দীর্ঘ-প্রেস ব্যাকস্পেস বারবার মুছে; ছাড়লে থামে | |
| T11 | স্পেস একটি শব্দ কমিট করে; বানান ভুলের জন্য অটোকারেক্ট চালু হয় | |
| T12 | Enter সঠিক অ্যাকশন চালু করে (ফিল্ড অনুযায়ী search/send/done/next) | |
| T13 | সিম্বল প্যানেল খোলে; সংখ্যা ও সিম্বল সঠিকভাবে টাইপ হয় | |
| T14 | ভাষা সুইচ EN ↔ বাংলা টগল করে | |
| T15 | বাংলা ফোনেটিক: "ka" → ক, "kha" → খ, "bangla" → বংলা | |
| T16 | বাংলা ব্যাকস্পেস: আংশিক ফোনেটিক বাফার প্রথমে সরে | |
| T17 | "hel" টাইপ করার ১০০ms-এর মধ্যে সাজেশন দেখা যায় | |
| T18 | একটি সাজেশন চিপ ট্যাপ করলে বর্তমান শব্দ প্রতিস্থাপিত হয় | |
| T19 | স্পেস "helo" → "hello " অটো-কারেক্ট করে | |
| T20 | ইমোজি প্যানেল খোলে; ইমোজি ট্যাপ করলে কমিট হয় | |
| T21 | ট্যাপের পরে Recent ইমোজি ট্যাব সর্বশেষ-ব্যবহৃত ইমোজি দেখায় | |
| T22 | ক্লিপবোর্ড প্যানেল খোলে; শেষ কপি করা টেক্সট শীর্ষে দেখায় | |
| T23 | ক্লিপবোর্ড আইটেম ট্যাপ করলে পেস্ট হয় | |
| T24 | ক্লিপবোর্ড আইটেম দীর্ঘ-প্রেস করলে সরে | |
| T25 | ক্লিপবোর্ড প্যানেলে "Clear All" হিস্ট্রি খালি করে | |
| T26 | পাসওয়ার্ড ফিল্ড: সাজেশন বার লুকানো | |
| T27 | নম্বর ফিল্ড: নম্বর-প্যাড লেআউট দেখা যায় | |
| T28 | ফোন ফিল্ড: ডায়াল-প্যাড লেআউট দেখা যায় | |
| T29 | কী প্রেস অ্যানিমেশন প্রতিটি ট্যাপে চলে | |
| T30 | "Key Sounds" চালু থাকলে ট্যাপে সাউন্ড; বন্ধ থাকলে নীরব | |
| T31 | থিম পিকার: AMOLED নির্বাচন পরবর্তী খোলায় কীবোর্ড রঙ পরিবর্তন করে | |
| T32 | Key Height স্লাইডার: সমন্বয় পরবর্তী খোলায় কী উচ্চতা পরিবর্তন করে | |
| T33 | সেটিংসে হ্যাপটিক বন্ধ → কীবোর্ডে কোনো ভাইব্রেশন নেই | |
| T34 | কাস্টম শব্দ যোগ → সাজেশনে দেখা যায় | |
| T35 | কম্প্যানিয়ন অ্যাপ ফোর্স-কিল ও পুনরায় খোলার পরে সেটিংস থেকে যায় | |
| T36 | IME প্রসেস কিল ও রিকভারি (সেকশন ১২ দেখুন) | |
| T37 | Android Settings → কীবোর্ড নিষ্ক্রিয় → কম্প্যানিয়ন অ্যাপ অনবোর্ডিংয়ে রুট হয় | |
| T38 | WhatsApp-এ টাইপ করা — টেক্সট সঠিকভাবে দেখা যায় | |
| T39 | Chrome URL বারে টাইপ করা — টেক্সট সঠিকভাবে দেখা যায় | |
| T40 | Gmail compose-এ টাইপ করা — টেক্সট সঠিকভাবে দেখা যায় | |

---

## 9. ডিভাইস টেস্টিং: Samsung (One UI)

Samsung-এর One UI Android কীবোর্ড সাবসিস্টেমে উল্লেখযোগ্য পরিবর্তন যোগ করে।

### পরিচিত Samsung সমস্যা

| সমস্যা | মূল কারণ | সমাধান |
|---|---|---|
| কীবোর্ড দেখা যায় কিন্তু খুব ছোট / ক্লিপড | Samsung-এর `InputMethodService` কীবোর্ড উচ্চতা গণনা আলাদাভাবে ওভাররাইড করে | `<activity>`-তে `android:windowSoftInputMode="adjustResize"` যোগ করুন বা `onCreateInputView`-এ ন্যূনতম উচ্চতা বাড়ান |
| ভাষা সুইচ বাটন Samsung-এর নিজস্ব ভাষা পপআপ ট্রিগার করে | One UI কিছু সিস্টেম ভার্সনে `🌐` গ্লোব ট্যাপ ইন্টারসেপ্ট করে | ভাষা সুইচ ট্রিগার ট্যাপের পরিবর্তে দীর্ঘ-প্রেসে পরিবর্তন করুন |
| `captureCurrentClipboard()` সবসময় `SecurityException` ছুঁড়ে দেয় | Samsung Android 12+-এ ক্লিপবোর্ড অ্যাক্সেস আরও আক্রমণাত্মকভাবে সীমাবদ্ধ করে | `ClipboardHandler.captureCurrentClipboard()`-এর `try-catch` ইতিমধ্যে এটি নীরবে পরিচালনা করে |

### Samsung-নির্দিষ্ট টেস্ট

```bash
# Samsung ডিভাইসে টেস্ট — টেস্টের সময় logcat ক্যাপচার করুন
adb logcat -s KickKeyIME KickKeyModule ReactNativeJS ClipboardHandler > samsung_log.txt &

# ম্যানুয়াল টেস্টিংয়ের পরে, ক্যাপচার থামান:
kill %1

# Samsung-নির্দিষ্ট ত্রুটির জন্য পরীক্ষা করুন:
grep -i "samsung\|one ui\|InputMethodManagerService" samsung_log.txt
```

---

## 10. ডিভাইস টেস্টিং: Xiaomi (MIUI / HyperOS)

Xiaomi-এর MIUI (এবং এর উত্তরসূরি HyperOS) আক্রমণাত্মক ব্যাটারি অপ্টিমাইজেশন প্রয়োগ করে যা `:ime_process` কিল করতে পারে।

### পরিচিত Xiaomi সমস্যা

| সমস্যা | মূল কারণ | সমাধান |
|---|---|---|
| নিষ্ক্রিয়তার কয়েক মিনিট পরে কীবোর্ড বন্ধ হয় | MIUI ব্যাটারি অপ্টিমাইজার `:ime_process` কিল করে | ব্যবহারকারীকে KickKey "No restrictions" ব্যাটারি তালিকায় যোগ করতে গাইড করুন: MIUI Settings → Battery → App battery saver |
| MIUI Android 12+-এ ক্লিপবোর্ড হিস্ট্রি সবসময় খালি | MIUI AOSP-এর বাইরে ক্লিপবোর্ড অ্যাক্সেস আরও সীমাবদ্ধ করে | logcat দিয়ে নিশ্চিত করুন; যদি নিশ্চিত হয়, একটি একবারের ইন-অ্যাপ নোটিশ দেখান |
| প্রথম কীবোর্ড খুলতে > ২ সেকেন্ড | MIUI ব্যাকগ্রাউন্ড সার্ভিস প্রি-কিল করে — প্রি-ওয়ার্ম থ্রেড নাও চলতে পারে | প্রথম খোলায় প্রত্যাশিত। FAQ-এ ডকুমেন্ট করুন। |

### MIUI-নির্দিষ্ট সেটআপ (টেস্টের আগে)

```
Settings → Apps → Manage apps → KickKey
  → Battery saver → No restrictions

Settings → Apps → Manage apps → KickKey
  → Other permissions → Start in background → Allow
```

---

## 11. ডিভাইস টেস্টিং: Pixel (স্টক Android)

Pixel ডিভাইস স্টক AOSP Android চালায় এবং রেফারেন্স বাস্তবায়ন। শুধুমাত্র Pixel-এ দেখা দেওয়া ব্যর্থতাগুলো (Samsung/Xiaomi-তে নয়) সম্ভবত সত্যিকারের Android বাগ বা KickKey বাগ।

### Pixel-নির্দিষ্ট চেক

- **Android 12+:** "KickKey pasted from clipboard" টোস্ট দেখা যাচ্ছে যাচাই করুন। এটি প্রত্যাশিত এবং এড়ানো অসম্ভব।
- **Android 14:** `getPreferences()` এখনো সঠিকভাবে পড়ে কিনা যাচাই করুন। Android 14 SharedPreferences ক্রস-প্রসেস অ্যাক্সেস আরও কঠোর করেছে।
- **Pixel ফিচার ফ্ল্যাগ:** লাইভ ক্যাপশনিং, Now Playing-এর মতো Pixel-একচেটিয়া ফিচার অডিও ফোকাস সাময়িকভাবে নিতে পারে। কী-ক্লিক সাউন্ড এই ইন্টারঅ্যাকশনের পরে সঠিকভাবে বাজে কিনা যাচাই করুন।

### Android ভার্সন ম্যাট্রিক্স

প্রতিটি Android ভার্সনে এই পরিস্থিতিগুলো পরীক্ষা করুন:

| পরিস্থিতি | Android 10 | Android 12 | Android 14 |
|---|---|---|---|
| ক্লিপবোর্ড ক্যাপচার নীরবে কাজ করে | ✓ প্রত্যাশিত | টোস্ট দেখায় — প্রত্যাশিত | টোস্ট দেখায় — প্রত্যাশিত |
| SharedPreferences ক্রস-প্রসেস রিড | কাজ করতে হবে | কাজ করতে হবে | কাজ করতে হবে (MODE_PRIVATE) |
| সাজেশন ইঞ্জিন পারফরম্যান্স | < ১০০ms হতে হবে | < ১০০ms হতে হবে | < ১০০ms হতে হবে |
| IME প্রসেস কিল ও রিকভারি | সেকশন ১২ দেখুন | সেকশন ১২ দেখুন | সেকশন ১২ দেখুন |

---

## 12. IME প্রসেস কিল ও রিকভারি টেস্ট

`:ime_process` মেমরি প্রেশার বা ব্যবহারকারীর দ্বারা কিল হতে পারে। কীবোর্ড সুন্দরভাবে রিকভার করতে হবে।

### টেস্ট পদ্ধতি

```bash
# ১. যেকোনো টেক্সট ফিল্ড খুলুন — KickKey কীবোর্ড দেখা যায়
# ২. IME প্রসেসের প্রসেস ID নোট করুন:
adb shell ps | grep "com.kickkey:ime"
# উদাহরণ আউটপুট: u0_a123  12345  ... com.kickkey:ime_process

# ৩. IME প্রসেস কিল করুন:
adb shell kill 12345
# অথবা প্যাকেজ নাম ব্যবহার করে:
adb shell am kill com.kickkey

# ৪. টেক্সট ফিল্ড আবার ট্যাপ করুন
# প্রত্যাশিত:
#   - সংক্ষিপ্ত বিলম্ব (~২০০-৫০০ms) যখন ReactHost পুনরায় শুরু হয়
#   - কীবোর্ড দেখা যায় এবং পূর্ণরূপে কার্যকরী
#   - কোনো ANR নেই, কোনো ক্র্যাশ ডায়ালগ নেই

# ৫. পরিষ্কার রিকভারির জন্য logcat পরীক্ষা করুন:
adb logcat -s KickKeyIME KickKeyApplication | grep -E "created|pre-warm|started"
# প্রত্যাশিত:
# I/KickKeyApplication: Keyboard ReactHost pre-warm complete
# I/KickKeyIME: IME Service created
# I/KickKeyIME: onCreateInputView called
# I/KickKeyIME: ReactRootView started
```

### কিলের পরে প্রত্যাশিত আচরণ

| স্টেট | প্রত্যাশিত |
|---|---|
| ইংরেজি টাইপিং | পুনরায় খোলার পরে কাজ করে |
| বাংলা টাইপিং | পুনরায় খোলার পরে কাজ করে (BanglaInputEngine onCreate-এ পুনরায় ইনিশিয়ালাইজড) |
| সাজেশন | পুনরায় খোলার পরে কাজ করে |
| ক্লিপবোর্ড হিস্ট্রি | থেকে যায় (SharedPreferences-এ সংরক্ষিত, প্রসেস কিলে হারায় না) |
| সাম্প্রতিক ইমোজি | থেকে যায় (SharedPreferences-এ সংরক্ষিত) |
| সেটিংস/থিম | থেকে যায় (SharedPreferences-এ সংরক্ষিত) |

---

## 13. গোপনীয়তা নীতি

Google Play **যেকোনো কীবোর্ড অ্যাপের জন্য** গোপনীয়তা নীতি URL বাধ্যতামূলক করে কারণ অ্যাপটি ব্যবহারকারীর টাইপ করা সমস্ত টেক্সট পড়তে পারে।

### ১৩.১ নীতি হোস্ট করুন

একটি স্থিতিশীল পাবলিক URL-এ নীতি হোস্ট করুন:

- **GitHub Pages:** আপনার রেপোতে `docs/privacy-policy.html` তৈরি করুন এবং GitHub Pages সক্রিয় করুন। URL: `https://yourusername.github.io/kickkey/privacy-policy.html`
- **Netlify / Vercel ফ্রি টায়ার:** একটি একক HTML পেজ ডিপ্লয় করুন।

URL অবশ্যই Play Store-এ অ্যাপ থাকাকালীন লাইভ থাকতে হবে।

### ১৩.২ গোপনীয়তা নীতির বিষয়বস্তু

```markdown
# KickKey গোপনীয়তা নীতি

সর্বশেষ আপডেট: [তারিখ]

## KickKey কী সংগ্রহ করে

KickKey Android-এর জন্য একটি কীবোর্ড অ্যাপ। কীবোর্ড হিসেবে কাজ করতে,
এটি আপনার টাইপ করা টেক্সট প্রক্রিয়া করে। এখানে ঠিক কী সংরক্ষিত এবং কোথায়:

### শুধুমাত্র আপনার ডিভাইসে

- **টাইপিং হিস্ট্রি (ব্যবহারকারী শব্দ মডেল):** আপনি সাজেশন থেকে ঘন ঘন
  যে শব্দগুলো বেছে নেন সেগুলো ভবিষ্যৎ সাজেশন র‍্যাঙ্কিং উন্নত করতে আপনার
  ডিভাইসে স্থানীয়ভাবে সংরক্ষিত হয়। এই ডেটা কখনো আপনার ডিভাইস ছেড়ে যায় না।

- **কাস্টম ডিকশনারি:** আপনি কম্প্যানিয়ন অ্যাপের মাধ্যমে যে শব্দগুলো যোগ
  করেন সেগুলো আপনার ডিভাইসে স্থানীয়ভাবে সংরক্ষিত। এই ডেটা কখনো আপনার
  ডিভাইস ছেড়ে যায় না।

- **ক্লিপবোর্ড হিস্ট্রি:** আপনি কপি করা টেক্সট ক্লিপবোর্ড প্যানেলের সাথে
  ব্যবহারের জন্য আপনার ডিভাইসে অস্থায়ীভাবে সংরক্ষিত হয়। এই ডেটা কখনো আপনার
  ডিভাইস ছেড়ে যায় না। Android 12+ প্রতিটি ক্লিপবোর্ড কন্টেন্ট অ্যাক্সেসে
  একটি সিস্টেম বিজ্ঞপ্তি দেখাবে — এটি একটি বাধ্যতামূলক Android গোপনীয়তা
  ফিচার।

- **সাম্প্রতিক ইমোজি:** আপনার সর্বশেষ ব্যবহৃত ইমোজি আপনার ডিভাইসে স্থানীয়ভাবে
  সংরক্ষিত।

- **সেটিংস ও প্রেফারেন্স:** আপনার বেছে নেওয়া থিম, ভাষা, এবং অন্যান্য সেটিংস
  আপনার ডিভাইসে স্থানীয়ভাবে সংরক্ষিত।

### KickKey যা সংগ্রহ করে না

- KickKey কোনো টাইপ করা টেক্সট, ক্লিপবোর্ড কন্টেন্ট, বা অন্য কোনো ব্যবহারকারী
  ডেটা কোনো সার্ভারে প্রেরণ করে না।
- KickKey-এর কোনো অ্যাকাউন্ট প্রয়োজন নেই।
- KickKey-এ কোনো বিজ্ঞাপন SDK নেই।
- KickKey-এ কোনো অ্যানালিটিক্স SDK নেই যা ডিভাইস বাইরে ডেটা পাঠায়।

## ডেটা ধারণ

উপরে বর্ণিত সমস্ত ডেটা আপনার ডিভাইসে Android-এর SharedPreferences-এ সংরক্ষিত।
আপনি যেকোনো সময় Android Settings → Apps → KickKey → Storage → Clear Data-এ যেয়ে
সমস্ত KickKey ডেটা মুছতে পারেন।

## যোগাযোগ

এই গোপনীয়তা নীতি সম্পর্কে প্রশ্ন থাকলে যোগাযোগ করুন: [আপনার ইমেইল]
```

---

## 14. Play Store লিস্টিং

### ১৪.১ প্রয়োজনীয় সম্পদ

| সম্পদ | আকার | নোট |
|---|---|---|
| অ্যাপ আইকন | ৫১২×৫১২ PNG | `app.json` → `icon`-এ ইতিমধ্যে সেট |
| ফিচার গ্রাফিক | ১০২৪×৫০০ PNG | Play Store লিস্টিংয়ের শীর্ষে ব্যানার |
| ফোন স্ক্রিনশট | ন্যূনতম ২, সর্বোচ্চ ৮ | ১৬:৯ বা ৯:১৬, সবচেয়ে ছোট পাশে ন্যূনতম ৩২০dp |
| সংক্ষিপ্ত বিবরণ | সর্বোচ্চ ৮০ অক্ষর | সার্চ ফলাফলে দেখা যায় |
| সম্পূর্ণ বিবরণ | সর্বোচ্চ ৪০০০ অক্ষর | অ্যাপ পেজে দেখা যায় |

### ১৪.২ স্ক্রিনশট পরামর্শ

এই ৫টি স্ক্রিন ক্যাপচার করুন:

১. **অনবোর্ডিং** — পরিষ্কার ডার্ক UI সহ Step 1 স্ক্রিন
২. **ইংরেজি কীবোর্ড** — সম্পূর্ণ QWERTY দৃশ্যমান সাজেশন চিপস সহ
৩. **বাংলা কীবোর্ড** — হেডারে 🌐 বাং নির্দেশক সহ বাংলা লেআউট দৃশ্যমান
৪. **থিম পিকার** — কম্প্যানিয়ন অ্যাপে তিনটি থিম প্রিভিউ কার্ড
৫. **ইমোজি প্যানেল** — কীবোর্ডে ইমোজি গ্রিড খোলা

```bash
# adb দিয়ে স্ক্রিনশট নিন (একটি টেক্সট ফিল্ড ফোকাসড থাকতে হবে)
adb exec-out screencap -p > screenshot_english.png
```

### ১৪.৩ সংক্ষিপ্ত বিবরণ (৮০ অক্ষর সর্বোচ্চ)

```
ইংরেজি ও বাংলা ফোনেটিক ইনপুট সহ দ্রুত, সুন্দর কাস্টম কীবোর্ড
```

### ১৪.৪ সম্পূর্ণ বিবরণ

```
KickKey হলো Android-এর জন্য একটি সম্পূর্ণ কাস্টমাইজযোগ্য কীবোর্ড, যেখানে
বিল্ট-ইন বাংলা ফোনেটিক ইনপুট, স্মার্ট শব্দ সাজেশন, ইমোজি, এবং ক্লিপবোর্ড হিস্ট্রি রয়েছে।

🌐 দুটি ভাষা
এক ট্যাপে ইংরেজি এবং ফোনেটিক বাংলার মধ্যে সুইচ করুন। রোমান অক্ষরে টাইপ
করুন এবং KickKey স্বয়ংক্রিয়ভাবে সেগুলো বাংলায় রূপান্তরিত করে — "ka" হয়
ক, "kha" হয় খ, "bangla" হয় বংলা। অ্যাভ্রো-সামঞ্জস্যপূর্ণ ফোনেটিক সিস্টেম।

💡 স্মার্ট সাজেশন
টাইপ করার সাথে সাথে KickKey ৫০,০০০+ শব্দের ডিকশনারি থেকে সবচেয়ে সম্ভাব্য
শব্দ সাজেস্ট করে। স্পেস প্রেস করলে টাইপো অটো-কারেক্ট করে। আপনার পছন্দ থেকে
শিখে সময়ের সাথে প্রিয় শব্দগুলো উপরে র‍্যাঙ্ক করে।

🎨 সম্পূর্ণ কাস্টমাইজযোগ্য
• ৩টি বিল্ট-ইন থিম: ডার্ক, লাইট, AMOLED ব্ল্যাক
• সামঞ্জস্যযোগ্য কী উচ্চতা, কোণার ব্যাসার্ধ, এবং ফন্ট সাইজ
• হ্যাপটিক ফিডব্যাক এবং ঐচ্ছিক কী সাউন্ড
• সেটিংস কম্প্যানিয়ন অ্যাপ থেকে কীবোর্ডে তাৎক্ষণিকভাবে সিঙ্ক হয়

😊 ইমোজি ও ক্লিপবোর্ড
ক্যাটাগরি ট্যাব এবং সাম্প্রতিক ইমোজি ট্রে সহ সম্পূর্ণ ইমোজি পিকার।
ক্লিপবোর্ড প্যানেল সম্প্রতি কপি করা টেক্সট দেখায় যাতে এক ট্যাপে পেস্ট করা যায়।

🔒 ডিজাইনে ব্যক্তিগত
সবকিছু আপনার ডিভাইসে থাকে। কোনো অ্যাকাউন্ট প্রয়োজন নেই। কোনো সার্ভারে
ডেটা পাঠানো হয় না। কোনো বিজ্ঞাপন নেই।

প্রয়োজনীয়তা
• Android 8.0 বা তার বেশি
• ৩০MB স্টোরেজ
```

---

## 15. প্রোডাকশন EAS বিল্ড

### ১৫.১ `eas.json` যাচাই করুন

নিশ্চিত করুন প্রোডাকশন প্রোফাইল একটি AAB তৈরি করে (APK নয়) — Google Play নতুন অ্যাপের জন্য AAB প্রয়োজন:

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "aab"
      },
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### ১৫.২ `app.json`-এ ভার্সন সেট করুন

```json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "versionCode": 1
    }
  }
}
```

> `versionCode` অবশ্যই একটি পূর্ণসংখ্যা হতে হবে যা প্রতিটি Play Store আপডেটে বাড়তে হবে।

### ১৫.৩ একটি Keystore সেট আপ করুন

```bash
# EAS স্বয়ংক্রিয়ভাবে আপনার জন্য একটি keystore তৈরি ও পরিচালনা করবে।
# নিজের keystore আনতে চাইলে:
eas credentials --platform android
```

> **গুরুত্বপূর্ণ:** keystore কখনো হারাবেন না। হারালে Play Store-এ অ্যাপ আপডেট করতে পারবেন না। EAS ডিফল্টে Expo-র সার্ভারে keystore সংরক্ষণ করে। আলাদাভাবে ব্যাক আপ করুন:
```bash
eas credentials --platform android   # EAS থেকে ডাউনলোড করুন
# ডাউনলোড করা .jks ফাইল নিরাপদে সংরক্ষণ করুন (পাসওয়ার্ড ম্যানেজার, এনক্রিপ্টেড ব্যাকআপ)
```

### ১৫.৪ প্রোডাকশন বিল্ড চালান

```bash
# সাইন করা প্রোডাকশন AAB বিল্ড করুন
eas build --platform android --profile production

# প্রত্যাশিত আউটপুট:
# Build started...
# Build ID: abc123
# View build status: https://expo.dev/...
# Build successful! AAB available at: https://expo.dev/...
```

বিল্ড সময়: ১৫–৩০ মিনিট (প্রোডাকশন মিনিফিকেশন, proguard, এবং সাইনিংয়ের কারণে)।

### ১৫.৫ AAB ডাউনলোড ও যাচাই করুন

```bash
# EAS ড্যাশবোর্ড লিঙ্ক থেকে AAB ডাউনলোড করুন
# এটি একটি বৈধ AAB (APK নয়) কিনা যাচাই করুন — ~১৫-৩০MB হওয়া উচিত
file kickkey.aab
# প্রত্যাশিত: kickkey.aab: Zip archive data...
```

---

## 16. Play Store জমা

### ১৬.১ Play Console-এ অ্যাপ তৈরি করুন

১. https://play.google.com/console-এ যান
২. **Create app** ক্লিক করুন
৩. সেট করুন: App name = "KickKey", Default language = "English (United States)", App type = "App", Free বা Paid
৪. Developer distribution agreement স্বীকার করুন

### ১৬.২ প্রয়োজনীয় Play Console সেকশন সম্পন্ন করুন

বাম সাইডবারে নেভিগেট করুন এবং প্রতিটি লাল নির্দেশক সহ সেকশন সম্পন্ন করুন:

**App content (AAB আপলোডের আগে সম্পন্ন করতে হবে):**
- Data safety ফর্ম → পূরণ করুন: "Does your app collect or share any of the required user data types?" → Yes (কীবোর্ড অ্যাপ অবশ্যই প্রকাশ করতে হবে)
- Privacy policy → সেকশন ১৩ থেকে আপনার হোস্টেড URL পেস্ট করুন
- App category → Tools
- Tags → Keyboard, Language, Bangla

**Main store listing:**
- Title, short description, full description (সেকশন ১৪)
- Feature graphic (১০২৪×৫০০)
- Screenshots (ন্যূনতম ২ ফোন স্ক্রিনশট)

**Production release:**
- সেকশন ১৫ থেকে সাইন করা AAB আপলোড করুন
- রিলিজ নোট লিখুন (নতুন কী আছে)

### ১৬.৩ Data Safety ফর্ম

কীবোর্ড অ্যাপের জন্য এই ফর্ম বিশেষভাবে গুরুত্বপূর্ণ:

| প্রশ্ন | উত্তর | নোট |
|---|---|---|
| Does your app collect or share any required user data types? | **Yes** | কীবোর্ড অ্যাপ অবশ্যই প্রকাশ করতে হবে |
| Does your app collect user input (text typed)? | **Yes** | শুধুমাত্র স্থানীয় সাজেশন/অটোকারেক্টের জন্য |
| Is the data sent off the device? | **No** | শুধুমাত্র স্থানীয়ভাবে সংরক্ষিত |
| Can users request deletion? | **Yes** | Settings → Clear Data |

### ১৬.৪ পর্যালোচনার জন্য জমা দিন

সমস্ত প্রয়োজনীয় সেকশন সম্পন্ন করার পরে:
১. Production release-এ **Send for review** ক্লিক করুন
২. Google সাধারণত নতুন কীবোর্ড অ্যাপ ৩–৭ কার্যদিবসের মধ্যে পর্যালোচনা করে
৩. পর্যালোচনা সম্পন্ন হলে ইমেইল পাবেন

---

## 17. লঞ্চ-পরবর্তী মনিটরিং

### ১৭.১ Play Console মনিটরিং

লঞ্চের পরে সাপ্তাহিক এই ড্যাশবোর্ডগুলো চেক করুন:

- **Android Vitals → Crash rate:** লক্ষ্যমাত্রা < দৈনিক সক্রিয় ব্যবহারকারীর ১%
- **Android Vitals → ANR rate:** লক্ষ্যমাত্রা < ০.৪৭% (Google-এর "খারাপ আচরণ" থ্রেশহোল্ড)
- **Reviews:** ৪৮ ঘণ্টার মধ্যে ১-তারা রিভিউর জবাব দিন
- **Rating:** Play Store ডিমোশন এড়াতে > ৪.০ তারা বজায় রাখুন

### ১৭.২ ভার্সন আপডেট প্রক্রিয়া

প্রতিটি পরবর্তী আপডেটের জন্য:

```bash
# ১. app.json-এ versionCode বাড়ান
# ২. ফিজিক্যাল ডিভাইসে পরীক্ষা করুন (সমালোচনামূলক পথের জন্য ম্যানুয়াল ম্যাট্রিক্স চালান)
# ৩. প্রোডাকশন AAB বিল্ড করুন
eas build --platform android --profile production

# ৪. নতুন AAB Play Console → Production → Create new release-এ আপলোড করুন
# ৫. What's new টেক্সট লিখুন
# ৬. পর্যালোচনার জন্য জমা দিন (আপডেট সাধারণত ১–৩ দিনে পর্যালোচনা হয়)
```

---

## 18. রিলিজ চেকলিস্ট

### ইউনিট টেস্ট

- [ ] `./gradlew :app:test` ০টি ব্যর্থতায় পাস করে
- [ ] `./gradlew jacocoTestReport` একটি রিপোর্ট তৈরি করে
- [ ] `BanglaInputEngine` লাইন কভারেজ > ৯০%
- [ ] `Trie` লাইন কভারেজ > ৮০%
- [ ] `UserWordModel` লাইন কভারেজ > ৮৫%
- [ ] `ClipboardHandler` লাইন কভারেজ > ৮০%

### ম্যানুয়াল টেস্টিং

- [ ] সেকশন ৮-এর সমস্ত ৪০টি টেস্ট কেস PASS হিসেবে চেক করা হয়েছে
- [ ] কোনো টেস্ট কেস FAIL হিসেবে চিহ্নিত নেই

### ডিভাইস টেস্টিং

- [ ] Samsung ডিভাইসে সমস্ত ৪০টি টেস্ট কেস পাস (One UI)
- [ ] Xiaomi ডিভাইসে সমস্ত ৪০টি টেস্ট কেস পাস (MIUI / HyperOS)
- [ ] Pixel ডিভাইসে সমস্ত ৪০টি টেস্ট কেস পাস (Stock Android)
- [ ] তিনটি ডিভাইসেই IME প্রসেস কিল ও রিকভারি টেস্ট পাস
- [ ] Android 10 (API 29)-এ পরীক্ষিত
- [ ] Android 12 (API 31)-এ পরীক্ষিত
- [ ] Android 14 (API 34)-এ পরীক্ষিত

### গোপনীয়তা ও সম্মতি

- [ ] গোপনীয়তা নীতি একটি স্থিতিশীল পাবলিক URL-এ প্রকাশিত
- [ ] গোপনীয়তা নীতি URL ব্রাউজার থেকে অ্যাক্সেসযোগ্য (৪০৪ নয়)
- [ ] গোপনীয়তা নীতি স্পষ্টভাবে বলে কোনো ডেটা ডিভাইসের বাইরে প্রেরণ হয় না
- [ ] গোপনীয়তা নীতি Android 12+-এ ক্লিপবোর্ড টোস্ট আচরণ ব্যাখ্যা করে

### Play Store লিস্টিং

- [ ] অ্যাপ আইকন ৫১২×৫১২ PNG আপলোড করা হয়েছে
- [ ] ফিচার গ্রাফিক ১০২৪×৫০০ PNG আপলোড করা হয়েছে
- [ ] ন্যূনতম ২টি ফোন স্ক্রিনশট আপলোড করা হয়েছে
- [ ] সংক্ষিপ্ত বিবরণ ≤ ৮০ অক্ষর
- [ ] সম্পূর্ণ বিবরণ সম্পূর্ণ
- [ ] Data safety ফর্ম সম্পন্ন — "কোনো ডেটা ডিভাইস বাইরে প্রেরণ হয় না"
- [ ] Play Console-এ গোপনীয়তা নীতি URL প্রবেশ করা হয়েছে
- [ ] অ্যাপ ক্যাটাগরি "Tools"-এ সেট

### প্রোডাকশন বিল্ড

- [ ] `app.json` `versionCode` = ১ এবং `version` = "1.0.0"
- [ ] `eas build --profile production` ত্রুটি ছাড়া সম্পন্ন হয়েছে
- [ ] AAB ডাউনলোড ও যাচাই করা হয়েছে
- [ ] AAB Play Console Production release-এ আপলোড করা হয়েছে
- [ ] রিলিজ নোট লেখা হয়েছে

### জমা

- [ ] সমস্ত Play Console লাল নির্দেশক সমাধান হয়েছে
- [ ] Production release-এ "Send for review" বাটন ক্লিক করা হয়েছে
- [ ] Google Play থেকে নিশ্চিতকরণ ইমেইল পাওয়া গেছে

---

## 19. সমস্যা সমাধান

### `./gradlew :app:test` "class not found" সহ ব্যর্থ হয়

**কারণ:** JUnit 5 কনফিগার করা নেই, বা ডিফল্টে JUnit 4 ব্যবহার হচ্ছে।

**সমাধান:**
```groovy
// android/app/build.gradle-এ:
tasks.withType<Test> {
    useJUnitPlatform()   // ← JUnit 5-এর জন্য অবশ্যই থাকতে হবে
}
```
`junit-jupiter-engine` `testRuntimeOnly`-তে আছে নিশ্চিত করুন।

---

### JaCoCo রিপোর্ট ০% কভারেজ দেখায় যদিও টেস্ট চলে

**কারণ:** `jacocoTestReport` টাস্কের `classDirectories` পাথ Kotlin ক্লাস কম্পাইলের স্থানের সাথে মেলে না।

**সমাধান:** প্রকৃত কম্পাইল আউটপুট পাথ পরীক্ষা করুন:
```bash
find android/app/build -name "*.class" | head -5
```
বাস্তব পাথের সাথে মেলাতে JaCoCo কনফিগে `kotlinDebugTree` আপডেট করুন।

---

### Play Console AAB প্রত্যাখ্যান করে — "আর সমর্থিত নয় এমন API স্তর"

**কারণ:** `targetSdkVersion` Google-এর বর্তমান ন্যূনতমের নিচে।

**সমাধান:** `build.gradle`-এ `targetSdkVersion 34` এবং `app.json`-এ `"targetSdkVersion": 34` নিশ্চিত করুন।

---

### Play Console data safety পর্যালোচনা "কোনো ডেটা প্রেরণ হয় না" এর প্রমাণ চায়

**কারণ:** Google কীবোর্ড অ্যাপ আরও সতর্কতার সাথে অডিট করে।

**সমাধান:**
১. একটি স্ক্রিন ক্যাপচার রেকর্ড করুন: এয়ারপ্লেন মোড সক্রিয় → KickKey খুলুন → টেক্সট টাইপ করুন → দেখান যে সাজেশন কাজ করে (স্থানীয় Trie থেকে) → নেটওয়ার্ক মনিটর দেখান (কোনো রিকোয়েস্ট নেই)
২. Play Console "appeal" বা "provide evidence" প্রবাহের মাধ্যমে ভিডিও জমা দিন

---

### Samsung: Galaxy S-সিরিজে কীবোর্ড উচ্চতা খুব ছোট

**কারণ:** Samsung-এর `InputMethodService` সাবক্লাস ডিফল্ট কীবোর্ড ভিউ সাইজিং ওভাররাইড করে।

**সমাধান:** `KeyboardScreen.tsx`-এ `Dimensions.get('screen').height * 0.35`-এর উপর ভিত্তি করে একটি স্পষ্ট `minHeight` যোগ করুন:
```tsx
<View style={[styles.keyboard, {
  backgroundColor: theme.keyboardBg,
  minHeight: Dimensions.get('screen').height * 0.35,
}]}>
```

---

### EAS প্রোডাকশন বিল্ড "Gradle task :app:bundleRelease failed" সহ ব্যর্থ হয়

**কারণ ১:** ProGuard / R8 React Native বা Expo ব্রিজ ক্লাস সরিয়ে দিচ্ছে।

**সমাধান:** `android/app/proguard-rules.pro`-তে proguard নিয়ম যোগ করুন:
```proguard
-keep class com.facebook.react.** { *; }
-keep class expo.modules.** { *; }
-keep class com.kickkey.** { *; }
```

**কারণ ২:** `keyboard.bundle` assets থেকে নেই।

**সমাধান:**
```bash
# EAS চালানোর আগে keyboard bundle ম্যানুয়ালি বিল্ড করুন:
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android --minify true
```

---

*ফেজ ৮ সম্পন্ন। KickKey Google Play Store-এ লাইভ। 🎉*

*ভবিষ্যৎ রক্ষণাবেক্ষণের জন্য: `versionCode` বাড়ান, সমালোচনামূলক পথে ম্যানুয়াল টেস্ট ম্যাট্রিক্স চালান, একটি প্রোডাকশন AAB বিল্ড করুন, এবং Play Console-এ একটি নতুন রিলিজ হিসেবে আপলোড করুন। Google সাধারণত আপডেট ১–৩ কার্যদিবসের মধ্যে প্রক্রিয়া করে।*
