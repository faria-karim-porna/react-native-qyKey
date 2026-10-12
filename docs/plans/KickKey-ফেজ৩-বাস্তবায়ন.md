# KickKey — ফেজ ৩ বাস্তবায়ন গাইড
## বাংলা ইনপুট (সপ্তাহ ৫–৬)

> **লক্ষ্য:** KickKey ব্যবহার করে যেকোনো Android অ্যাপে ফোনেটিকভাবে বাংলা টাইপ করা যাবে।
> **ফেজ ২-এর উপর নির্মিত** — ইংরেজি টাইপিং, Shift/Caps Lock, সিম্বল প্যানেল, হ্যাপটিক ফিডব্যাক, এবং সম্পূর্ণ React Native কী লেআউট ইতিমধ্যে কাজ করছে। ফেজ ৩ Kotlin-এ অ্যাভ্রো-স্টাইল ফোনেটিক ট্রান্সলিটারেশন ইঞ্জিন, TypeScript-এ বাংলা কীবোর্ড লেআউট, ভিজ্যুয়াল নির্দেশক সহ ভাষা সুইচিং, এবং ট্রান্সলিটারেশন নির্ভুলতার জন্য ইউনিট টেস্ট যোগ করে।

---

## বিষয়সূচি

1. [ফেজ ৩-এ কী পরিবর্তন হয়](#1-ফেজ-৩-তে-কী-পরিবর্তন-হয়)
2. [বাংলা ফোনেটিক ইনপুট কীভাবে কাজ করে](#2-বাংলা-ফোনেটিক-ইনপুট-কীভাবে-কাজ-করে)
3. [আপডেটেড ফোল্ডার স্ট্রাকচার](#3-আপডেটেড-ফোল্ডার-স্ট্রাকচার)
4. [BanglaInputEngine.kt](#4-banglainputenginekt)
5. [BanglaInputEngineTest.kt](#5-banglainputenginetestkt)
6. [আপডেটেড KickKeyModule.kt](#6-আপডেটেড-kickkeymodulekt)
7. [আপডেটেড KickKeyInputMethodService.kt](#7-আপডেটেড-kickkeyinputmethodservicekt)
8. [বাংলা কীবোর্ড লেআউট (TypeScript)](#8-বাংলা-কীবোর্ড-লেআউট-typescript)
9. [আপডেটেড layouts/index.ts](#9-আপডেটেড-layoutsindexts)
10. [KeyboardHeader কম্পোনেন্ট](#10-keyboardheader-কম্পোনেন্ট)
11. [আপডেটেড KeyboardScreen](#11-আপডেটেড-keyboardscreen)
12. [আপডেটেড useKeyboardState হুক](#12-আপডেটেড-usekeyboardstate-হুক)
13. [আপডেটেড BottomRow কম্পোনেন্ট](#13-আপডেটেড-bottomrow-কম্পোনেন্ট)
14. [আপডেটেড modules/kickkey-module/index.ts](#14-আপডেটেড-moduleskickkey-moduleindexts)
15. [বিল্ড ও পরীক্ষা](#15-বিল্ড-ও-পরীক্ষা)
16. [যাচাই চেকলিস্ট](#16-যাচাই-চেকলিস্ট)
17. [ট্রান্সলিটারেশন রেফারেন্স টেবিল](#17-ট্রান্সলিটারেশন-রেফারেন্স-টেবিল)
18. [সমস্যা সমাধান](#18-সমস্যা-সমাধান)

---

## 1. ফেজ ৩-তে কী পরিবর্তন হয়

### তৈরি করতে হবে (নতুন ফাইল)

| ফাইল | উদ্দেশ্য |
|---|---|
| `android/.../BanglaInputEngine.kt` | অ্যাভ্রো-স্টাইল ফোনেটিক ট্রান্সলিটারেশন ইঞ্জিন |
| `android/.../BanglaInputEngineTest.kt` | ট্রান্সলিটারেশন নির্ভুলতার জন্য ইউনিট টেস্ট |
| `src/keyboard/layouts/bangla.ts` | সম্পূর্ণ বাংলা ফোনেটিক QWERTY লেআউট |
| `src/keyboard/KeyboardHeader.tsx` | সাজেশন বারের উপরে ভাষা নির্দেশক স্ট্রিপ |

### আপডেট করতে হবে (আংশিক পরিবর্তন)

| ফাইল | কী পরিবর্তন হয় |
|---|---|
| `modules/kickkey-module/android/.../KickKeyModule.kt` | `language === "bn"` হলে `commitKey` বাংলা ইঞ্জিনে রুট করুন; `flushBanglaBuffer` ও `setBanglaEnabled` যোগ করুন |
| `android/.../KickKeyInputMethodService.kt` | `BanglaInputEngine` ইনস্ট্যান্টিয়েট করুন; নতুন ইনপুট সেশনে বাফার রিসেট করুন |
| `src/keyboard/layouts/index.ts` | `BANGLA_ROWS` এক্সপোর্ট করুন |
| `src/keyboard/KeyboardScreen.tsx` | `KeyboardHeader` যোগ করুন; `language` প্রপ পাস করুন |
| `src/keyboard/hooks/useKeyboardState.ts` | ভাষা সুইচের আগে বাফার ফ্লাশ করতে `handleLanguageSwitch` আপডেট করুন |
| `src/keyboard/BottomRow.tsx` | ভাষা বাটনে বর্তমান ভাষা দেখান |
| `modules/kickkey-module/index.ts` | `flushBanglaBuffer`, `setBanglaEnabled` এক্সপোর্ট করুন |

### পরিবর্তন হবে না

ফেজ ২-এর সমস্ত অন্যান্য ফাইল — `Key.tsx`, `KeyRow.tsx`, `AltCharsPopup.tsx`, `SuggestionBar.tsx`, `HapticManager.kt`, `KickKeyApplication.kt`, `useKeyboardTheme.ts`, `types.ts`, `defaultTheme.ts`, `english.ts`, `symbols.ts`।

---

## 2. বাংলা ফোনেটিক ইনপুট কীভাবে কাজ করে

### ২.১ মূল ধারণা

ব্যবহারকারী ইংরেজিতে যেভাবে শোনায় ঠিক সেভাবে রোমান অক্ষরে টাইপ করেন। ইঞ্জিন প্রতিটি রোমান সিকোয়েন্সকে সঠিক বাংলা Unicode অক্ষরে রূপান্তরিত করে। এটিকে **অ্যাভ্রো-স্টাইল ফোনেটিক ইনপুট** বলা হয় — Android-এ সবচেয়ে প্রচলিত বাংলা ইনপুট পদ্ধতি, Gboard, Ridmik, এবং Borno ব্যবহার করে।

```
ব্যবহারকারী টাইপ করে:  b  a  n  g  l  a
ইঞ্জিন দেখে:  b → বাফার="b"    → কোনো মিল নেই → বাফারিং চলুক
               a → বাফার="ba"   → "ba" মেলে → "ব" কমিট → বাফার=""
               n → বাফার="n"    → কোনো মিল নেই → বাফারিং চলুক
               g → বাফার="ng"   → "ng" মেলে → "ং" কমিট → বাফার=""
               l → বাফার="l"    → কোনো মিল নেই → বাফারিং চলুক
               a → বাফার="la"   → "la" মেলে → "লা" কমিট → বাফার=""

ফলাফল: বংলা
```

### ২.২ দীর্ঘতম-মিল গ্রিডি অ্যালগরিদম

ইঞ্জিন সবসময় ফোনেটিক ম্যাপের বিপরীতে অভ্যন্তরীণ বাফারের দীর্ঘতম সম্ভাব্য প্রত্যয় মেলানোর চেষ্টা করে। এটি `kha → খ`, `chha → ছ`, `shha → ষ`-এর মতো বহু-অক্ষর সিকোয়েন্সগুলো `k → ক`-এর মতো ছোট মিলের আগে সঠিকভাবে পরিচালনা করে।

```
বাফার: "kha"
৩ অক্ষর চেষ্টা করুন: "kha" → "খ" মেলে ✅ → "খ" কমিট করুন, বাফার পরিষ্কার করুন

বাফার: "ka"
২ অক্ষর চেষ্টা করুন: "ka" → "ক" মেলে ✅ → "ক" কমিট করুন

বাফার: "k"
১ অক্ষর চেষ্টা করুন: "k" → কোনো মিল নেই → বাফারিং চলুক
```

### ২.৩ ইঞ্জিন কোথায় চলে

ইঞ্জিন সম্পূর্ণরূপে **IME প্রসেসে Kotlin-এ** চলে — JS থ্রেডে কখনো নয়। এর মানে:

- ট্রান্সলিটারেশনের জন্য শূন্য JS-থ্রেড লেটেন্সি
- React Native `NativeModules.KickKey.commitKey(romanKey, "bn")` কল করে
- Kotlin `BanglaInputEngine.processKey(romanKey)` চালায় এবং ফলাফল সরাসরি `InputConnection`-এ কমিট করে
- React Native কখনো মধ্যবর্তী রোমান অক্ষর দেখে না

### ২.৪ বাফার ম্যানেজমেন্ট

ইঞ্জিন অমেলাকৃত রোমান অক্ষরের একটি অভ্যন্তরীণ বাফার রাখে। এই বাফার অবশ্যই:
- **ফ্লাশ** করতে হবে (যেভাবে আছে পাঠান) যখন ব্যবহারকারী ইংরেজিতে সুইচ করেন, স্পেস প্রেস করেন, বা নতুন ফিল্ডে ফোকাস করেন
- **এক অক্ষর কমাতে হবে** ব্যাকস্পেস প্রেস করলে (শেষ বাফারড রোমান অক্ষর সরায়)
- **স্বয়ংক্রিয়ভাবে ফ্লাশ** করতে হবে যখন বাফার মিল ছাড়া ৫ অক্ষরে পৌঁছায়

---

## 3. আপডেটেড ফোল্ডার স্ট্রাকচার

শুধুমাত্র পরিবর্তিত/নতুন ফাইল দেখানো হয়েছে।

```
android/app/src/main/java/com/kickkey/
├── BanglaInputEngine.kt              ← নতুন
└── KickKeyInputMethodService.kt      ← আপডেট (BanglaInputEngine ইনস্ট্যান্টিয়েট)

android/app/src/test/java/com/kickkey/
└── BanglaInputEngineTest.kt          ← নতুন

modules/kickkey-module/
├── index.ts                          ← আপডেট (flushBanglaBuffer, setBanglaEnabled যোগ)
└── android/src/main/java/com/kickkey/
    └── KickKeyModule.kt              ← আপডেট (bn বাংলা ইঞ্জিনে রুট)

src/keyboard/
├── KeyboardScreen.tsx                ← আপডেট (KeyboardHeader যোগ)
├── KeyboardHeader.tsx                ← নতুন
├── layouts/
│   ├── bangla.ts                     ← নতুন
│   └── index.ts                      ← আপডেট (BANGLA_ROWS এক্সপোর্ট)
├── hooks/
│   └── useKeyboardState.ts           ← আপডেট (সুইচে flushBanglaBuffer)
└── BottomRow.tsx                     ← আপডেট (ভাষা বাটন আপডেট)
```

---

## 4. `BanglaInputEngine.kt`

ফেজ ৩-এর সবচেয়ে গুরুত্বপূর্ণ ফাইল। `KickKeyInputMethodService.kt`-এর একই ডিরেক্টরিতে তৈরি করুন।

```kotlin
// android/app/src/main/java/com/kickkey/BanglaInputEngine.kt

package com.kickkey

import android.util.Log

/**
 * বাংলার জন্য অ্যাভ্রো-স্টাইল ফোনেটিক ট্রান্সলিটারেশন ইঞ্জিন।
 *
 * ব্যবহারকারী রোমান অক্ষর (যেমন "k", "a") টাইপ করেন এবং এই ইঞ্জিন
 * দীর্ঘতম-মিল গ্রিডি অ্যালগরিদম ব্যবহার করে সেগুলো বাংলা Unicode-এ
 * (যেমন "ক") রূপান্তরিত করে।
 *
 * থ্রেড সেফটি: এই ক্লাস থ্রেড-সেফ নয়। শুধুমাত্র মেইন থ্রেড থেকে কল করতে হবে।
 *
 * লাইফসাইকেল:
 *   - KickKeyInputMethodService.onCreate()-এ একটি ইনস্ট্যান্স তৈরি হয়
 *   - প্রতিটি নতুন টেক্সট ফিল্ড ফোকাস পেলে reset() কল হয়
 *   - language == "bn" হলে প্রতিটি কী প্রেসে processKey() কল হয়
 *   - onBackspace() শেষ বাফারড রোমান অক্ষর সরায়
 *   - flush() বাকি বাফারড অক্ষরগুলো যেভাবে আছে কমিট করে
 */
class BanglaInputEngine {

    companion object {
        private const val TAG = "BanglaEngine"
        private const val MAX_BUFFER = 5
    }

    /**
     * ফোনেটিক ম্যাপ: রোমান সিকোয়েন্স → বাংলা Unicode।
     *
     * নিয়ম: দীর্ঘতর সিকোয়েন্স অবশ্যই ছোটটির আগে থাকতে হবে।
     */
    private val phoneticMap: Map<String, String> = linkedMapOf(
        // ── মহাপ্রাণ / যৌগ ব্যঞ্জনবর্ণ (৪ অক্ষর) ──────────────────────────
        "ttha"  to "ঠ",
        "ddha"  to "ঢ",

        // ── মহাপ্রাণ / যৌগ ব্যঞ্জনবর্ণ (৩ অক্ষর) ──────────────────────────
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

        // ── সাধারণ যুক্তবর্ণ ────────────────────────────────────────────────
        "kka"   to "ক্ক",
        "tta"   to "ত্ত",

        // ── স্বরবর্ণ — দীর্ঘ রূপ (২ অক্ষর) ──────────────────────────────────
        "aa"    to "আ",
        "ii"    to "ঈ",
        "uu"    to "ঊ",
        "ee"    to "ঐ",
        "oo"    to "ঔ",
        "ri"    to "ৃ",

        // ── মাত্রা (স্বর চিহ্ন) — বড় হাতের ট্রিগার ──────────────────────────
        "A"     to "া",
        "I"     to "ি",
        "II"    to "ী",
        "U"     to "ু",
        "UU"    to "ূ",
        "E"     to "ে",
        "OI"    to "ৈ",
        "O"     to "ো",
        "OU"    to "ৌ",

        // ── মূল ব্যঞ্জনবর্ণ (২ অক্ষর) ───────────────────────────────────────
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
        "ng"    to "ং",

        // ── মূল স্বরবর্ণ (১ অক্ষর) ──────────────────────────────────────────
        "a"     to "অ",
        "i"     to "ই",
        "u"     to "উ",
        "e"     to "এ",
        "o"     to "ও",

        // ── বিশেষ চিহ্ন ──────────────────────────────────────────────────────
        ":"     to "ঃ",
        "^"     to "ঁ",
        "`"     to "্",
        "T"     to "ট",
        "D"     to "ড",
        "N"     to "ণ",
    )

    /** মেলাকৃত না হওয়া রোমান অক্ষর আরও ইনপুটের অপেক্ষায় */
    private val buffer = StringBuilder()

    /**
     * একটি রোমান কী প্রেস প্রক্রিয়া করুন।
     *
     * @param romanKey  টাইপ করা রোমান অক্ষর (যেমন "k", "h", "a")
     * @return          কমিট করার বাংলা স্ট্রিং, অথবা "" যদি বাফারিং চলছে
     */
    fun processKey(romanKey: String): String {
        buffer.append(romanKey)
        val input = buffer.toString()

        // দীর্ঘতম প্রত্যয় মিল প্রথমে চেষ্টা করুন (গ্রিডি)
        val maxLen = minOf(4, input.length)
        for (len in maxLen downTo 1) {
            val suffix = input.takeLast(len)
            val bangla = phoneticMap[suffix]
            if (bangla != null) {
                // মিল পাওয়া গেছে — বাফার শেষ থেকে মেলানো অংশ সরান
                repeat(len) { buffer.deleteCharAt(buffer.length - 1) }
                Log.v(TAG, "মিল: '$suffix' → '$bangla' | বাকি বাফার: '$buffer'")
                return bangla
            }
        }

        // এখনো কোনো মিল নেই — বাফারিং চলুক
        // বাফার খুব বড় হলে স্বয়ংক্রিয়ভাবে ফ্লাশ করুন
        if (buffer.length >= MAX_BUFFER) {
            val flushed = buffer.toString()
            buffer.clear()
            Log.v(TAG, "স্বয়ংক্রিয় ফ্লাশ: '$flushed'")
            return flushed
        }

        return ""
    }

    /**
     * বাংলা মোডে ব্যাকস্পেস পরিচালনা করুন।
     *
     * @return true যদি ব্যাকস্পেস বাফার দ্বারা ব্যবহৃত হয়
     *         (কলার InputConnection.deleteSurroundingText কল করবে না)
     *         false যদি বাফার খালি ছিল — কলার স্বাভাবিকভাবে মুছবে
     */
    fun onBackspace(): Boolean {
        return if (buffer.isNotEmpty()) {
            buffer.deleteCharAt(buffer.length - 1)
            Log.v(TAG, "ব্যাকস্পেস বাফার দ্বারা ব্যবহৃত: '$buffer'")
            true
        } else {
            false
        }
    }

    /**
     * বাকি বাফারড রোমান অক্ষরগুলো যেভাবে আছে ফ্লাশ করুন।
     * কল করুন যখন: ভাষা সুইচ, স্পেস প্রেস, বা নতুন টেক্সট ফিল্ড
     *
     * @return কমিট করার রোমান স্ট্রিং, অথবা "" যদি বাফার খালি ছিল
     */
    fun flush(): String {
        return if (buffer.isNotEmpty()) {
            val result = buffer.toString()
            buffer.clear()
            Log.v(TAG, "ফ্লাশ: '$result'")
            result
        } else ""
    }

    /**
     * ইঞ্জিন সম্পূর্ণ রিসেট করুন।
     * নতুন ইনপুট ফিল্ড ফোকাস পেলে কল হয়।
     */
    fun reset() {
        buffer.clear()
        Log.v(TAG, "ইঞ্জিন রিসেট")
    }

    /** ডিবাগ / টেস্টিংয়ের জন্য বর্তমান বাফার কন্টেন্ট ফেরত দেয় */
    fun getBuffer(): String = buffer.toString()
}
```

---

## 5. `BanglaInputEngineTest.kt`

প্রতিটি প্রধান ফোনেটিক নিয়ম কভার করে ইউনিট টেস্ট। `android/` ডিরেক্টরিতে `./gradlew test` দিয়ে চালান।

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

    // ── সহায়ক: একটি সম্পূর্ণ রোমান স্ট্রিং টাইপ করুন এবং সমস্ত কমিটেড আউটপুট সংগ্রহ করুন ──

    private fun type(input: String): String {
        engine.reset()
        val result = StringBuilder()
        for (ch in input) {
            result.append(engine.processKey(ch.toString()))
        }
        result.append(engine.flush())
        return result.toString()
    }

    // ── মূল স্বরবর্ণ ────────────────────────────────────────────────────────

    @Test fun `a অ তৈরি করে`()  { assertEquals("অ", type("a")) }
    @Test fun `i ই তৈরি করে`()  { assertEquals("ই", type("i")) }
    @Test fun `u উ তৈরি করে`()  { assertEquals("উ", type("u")) }
    @Test fun `e এ তৈরি করে`()  { assertEquals("এ", type("e")) }
    @Test fun `o ও তৈরি করে`()  { assertEquals("ও", type("o")) }

    // ── দীর্ঘ স্বরবর্ণ ─────────────────────────────────────────────────────

    @Test fun `aa আ তৈরি করে`() { assertEquals("আ", type("aa")) }
    @Test fun `ii ঈ তৈরি করে`() { assertEquals("ঈ", type("ii")) }
    @Test fun `uu ঊ তৈরি করে`() { assertEquals("ঊ", type("uu")) }
    @Test fun `ee ঐ তৈরি করে`() { assertEquals("ঐ", type("ee")) }
    @Test fun `oo ঔ তৈরি করে`() { assertEquals("ঔ", type("oo")) }

    // ── মূল ব্যঞ্জনবর্ণ + স্বর (CV পর্ব) ──────────────────────────────────────

    @Test fun `ka ক তৈরি করে`()  { assertEquals("ক",  type("ka")) }
    @Test fun `ga গ তৈরি করে`()  { assertEquals("গ",  type("ga")) }
    @Test fun `ja জ তৈরি করে`()  { assertEquals("জ",  type("ja")) }
    @Test fun `ta ত তৈরি করে`()  { assertEquals("ত",  type("ta")) }
    @Test fun `da দ তৈরি করে`()  { assertEquals("দ",  type("da")) }
    @Test fun `na ন তৈরি করে`()  { assertEquals("ন",  type("na")) }
    @Test fun `pa প তৈরি করে`()  { assertEquals("প",  type("pa")) }
    @Test fun `ba ব তৈরি করে`()  { assertEquals("ব",  type("ba")) }
    @Test fun `ma ম তৈরি করে`()  { assertEquals("ম",  type("ma")) }
    @Test fun `ya য তৈরি করে`()  { assertEquals("য",  type("ya")) }
    @Test fun `ra র তৈরি করে`()  { assertEquals("র",  type("ra")) }
    @Test fun `la ল তৈরি করে`()  { assertEquals("ল",  type("la")) }
    @Test fun `sa স তৈরি করে`()  { assertEquals("স",  type("sa")) }
    @Test fun `ha হ তৈরি করে`()  { assertEquals("হ",  type("ha")) }

    // ── মহাপ্রাণ ব্যঞ্জনবর্ণ ─────────────────────────────────────────────────

    @Test fun `kha খ তৈরি করে`()  { assertEquals("খ", type("kha")) }
    @Test fun `gha ঘ তৈরি করে`()  { assertEquals("ঘ", type("gha")) }
    @Test fun `cha চ তৈরি করে`()  { assertEquals("চ", type("cha")) }
    @Test fun `chha ছ তৈরি করে`() { assertEquals("ছ", type("chha")) }
    @Test fun `jha ঝ তৈরি করে`()  { assertEquals("ঝ", type("jha")) }
    @Test fun `tha থ তৈরি করে`()  { assertEquals("থ", type("tha")) }
    @Test fun `dha ধ তৈরি করে`()  { assertEquals("ধ", type("dha")) }
    @Test fun `pha ফ তৈরি করে`()  { assertEquals("ফ", type("pha")) }
    @Test fun `bha ভ তৈরি করে`()  { assertEquals("ভ", type("bha")) }
    @Test fun `sha শ তৈরি করে`()  { assertEquals("শ", type("sha")) }
    @Test fun `shha ষ তৈরি করে`() { assertEquals("ষ", type("shha")) }

    // ── সাধারণ শব্দ ─────────────────────────────────────────────────────────

    @Test fun `bangla বাংলা তৈরি করে`() {
        val result = type("bangla")
        assertTrue("bangla-তে ব থাকা উচিত", result.contains("ব"))
    }

    @Test fun `ami তে অ থাকে`() {
        val result = type("ami")
        assertTrue("ami-তে অ থাকা উচিত", result.contains("অ"))
    }

    @Test fun `khabo খ দিয়ে শুরু হয়`() {
        val result = type("khabo")
        assertTrue("khabo খ দিয়ে শুরু হওয়া উচিত", result.startsWith("খ"))
    }

    // ── বাফার ম্যানেজমেন্ট ─────────────────────────────────────────────────

    @Test fun `খালি বাফারে ব্যাকস্পেস false ফেরত দেয়`() {
        engine.reset()
        assertFalse(engine.onBackspace())
    }

    @Test fun `বাফারড k-তে ব্যাকস্পেস true ফেরত দেয়`() {
        engine.reset()
        engine.processKey("k")   // 'k' একা মেলে না — বাফারে থাকে
        assertTrue(engine.onBackspace())
        assertEquals("", engine.getBuffer())
    }

    @Test fun `flush বাফারড কন্টেন্ট ফেরত দেয়`() {
        engine.reset()
        engine.processKey("k")
        engine.processKey("h")   // "kh" এখনো মেলে না
        assertEquals("kh", engine.flush())
        assertEquals("", engine.getBuffer())
    }

    @Test fun `reset বাফার পরিষ্কার করে`() {
        engine.reset()
        engine.processKey("k")
        engine.reset()
        assertEquals("", engine.getBuffer())
    }

    // ── দীর্ঘতম-মিল অগ্রাধিকার ──────────────────────────────────────────────

    @Test fun `kha ক+ha-এর আগে মেলে`() {
        // "kha" খ তৈরি করবে (৩-অক্ষর মিল), ক তারপর বাফারে 'h' নয়
        engine.reset()
        val result = StringBuilder()
        result.append(engine.processKey("k"))
        result.append(engine.processKey("h"))
        result.append(engine.processKey("a"))
        result.append(engine.flush())
        assertEquals("খ", result.toString())
    }

    @Test fun `chha cha+h-এর আগে মেলে`() {
        engine.reset()
        val result = StringBuilder()
        result.append(engine.processKey("c"))
        result.append(engine.processKey("h"))
        result.append(engine.processKey("h"))
        result.append(engine.processKey("a"))
        result.append(engine.flush())
        assertEquals("ছ", result.toString())
    }

    // ── অনুস্বার ────────────────────────────────────────────────────────────

    @Test fun `ng অনুস্বার তৈরি করে`() {
        assertEquals("ং", type("ng"))
    }
}
```

---

## 6. আপডেটেড `KickKeyModule.kt`

শুধুমাত্র পরিবর্তিত/যোগ করা অংশ দেখানো হয়েছে। `companion object` এবং `definition()` ব্লকে এই পরিবর্তনগুলো একত্রিত করুন:

```kotlin
// modules/kickkey-module/android/src/main/java/com/kickkey/KickKeyModule.kt
// শুধুমাত্র পরিবর্তন — বিদ্যমান ফেজ ২ ফাইলের সাথে একত্রিত করুন

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

        // ── ফেজ ৩-এ নতুন ─────────────────────────────────────────────────────
        /**
         * KickKeyInputMethodService দ্বারা সেট করা Bangla ইঞ্জিন রেফারেন্স।
         * commitKey একই ইনস্ট্যান্সে processKey() কল করতে পারে।
         */
        var banglaEngine: BanglaInputEngine? = null
    }

    override fun definition() = ModuleDefinition {
        Name("KickKey")

        // ── আপডেটেড: commitKey এখন বাংলা ইঞ্জিনে রুট করে ───────────────────

        Function("commitKey") { code: String, language: String ->
            val ic = activeInputConnection ?: return@Function

            if (language == "bn" && code.isNotEmpty()) {
                // বাংলা ফোনেটিক ইঞ্জিনে রুট করুন
                val banglaResult = banglaEngine?.processKey(code) ?: code
                if (banglaResult.isNotEmpty()) {
                    ic.commitText(banglaResult, 1)
                }
                // banglaResult খালি হলে ইঞ্জিন বাফারিং করছে — এখনো কমিট করবেন না
            } else if (code.isNotEmpty()) {
                // ইংরেজি — সরাসরি কমিট করুন
                ic.commitText(code, 1)
            }

            hapticManager?.vibrate()
        }

        // ── আপডেটেড: sendBackspace প্রথমে বাংলা বাফার পরীক্ষা করে ───────────

        Function("sendBackspace") {
            val engine = banglaEngine
            val consumedByBuffer = engine?.onBackspace() ?: false
            if (!consumedByBuffer) {
                activeInputConnection?.deleteSurroundingText(1, 0)
            }
            hapticManager?.vibrate()
        }

        // ── আপডেটেড: commitSpace প্রথমে বাংলা বাফার ফ্লাশ করে ──────────────

        Function("commitSpace") {
            val ic = activeInputConnection ?: return@Function
            val pending = banglaEngine?.flush() ?: ""
            if (pending.isNotEmpty()) {
                ic.commitText(pending, 1)
            }
            ic.commitText(" ", 1)
            hapticManager?.vibrate()
        }

        // ── নতুন: বাংলা বাফার স্পষ্টভাবে ফ্লাশ করুন ──────────────────────────

        /**
         * ব্যবহারকারী ইংরেজিতে সুইচ করলে বা নতুন ফিল্ডে ফোকাস করলে কল হয়।
         * বাংলা বাফারে অপেক্ষমাণ রোমান অক্ষরগুলো কমিট করে।
         */
        Function("flushBanglaBuffer") {
            val ic = activeInputConnection ?: return@Function
            val pending = banglaEngine?.flush() ?: ""
            if (pending.isNotEmpty()) {
                ic.commitText(pending, 1)
            }
        }

        /**
         * বাংলা ইঞ্জিন সক্রিয় বা নিষ্ক্রিয় করুন।
         */
        Function("setBanglaEnabled") { enabled: Boolean ->
            if (!enabled) banglaEngine?.reset()
        }

        // ── নিচে সমস্ত ফেজ ২ ফাংশন অপরিবর্তিত ─────────────────────────────

        Function("sendEnter") {
            val ic = activeInputConnection ?: return@Function
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
            val editor = context.getSharedPreferences("kickkey_prefs", Context.MODE_PRIVATE).edit()
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
                context.contentResolver, android.provider.Settings.Secure.DEFAULT_INPUT_METHOD)
            current?.contains(context.packageName) ?: false
        }

        Function("isKeyboardEnabled") {
            val context = appContext.reactContext ?: return@Function false
            val enabled = android.provider.Settings.Secure.getString(
                context.contentResolver, android.provider.Settings.Secure.ENABLED_INPUT_METHODS) ?: ""
            enabled.contains(context.packageName)
        }

        Function("openKeyboardSettings") {
            val context = appContext.reactContext ?: return@Function
            val intent = android.content.Intent(android.provider.Settings.ACTION_INPUT_METHOD_SETTINGS)
                .apply { flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK }
            context.startActivity(intent)
        }
    }
}
```

---

## 7. আপডেটেড `KickKeyInputMethodService.kt`

ফেজ ২ থেকে দুটি পরিবর্তন: `onCreate()`-এ `BanglaInputEngine` ইনস্ট্যান্টিয়েট করুন, এবং `onStartInputView()`-এ `banglaEngine.reset()` কল করুন।

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
        KickKeyModule.hapticManager = HapticManager(this)
        // ফেজ ৩: বাংলা ইঞ্জিন — একটি ইনস্ট্যান্স, প্রতিটি টেক্সট ফিল্ডে রিসেট
        KickKeyModule.banglaEngine  = BanglaInputEngine()
        Log.i(TAG, "IME সার্ভিস তৈরি — HapticManager ও BanglaInputEngine প্রস্তুত")
    }

    override fun onCreateInputView(): View {
        Log.i(TAG, "onCreateInputView কল হয়েছে")
        val app = application as? KickKeyApplication ?: run {
            Log.e(TAG, "KickKeyApplication পাওয়া যায়নি")
            return View(this)
        }
        reactRootView = ReactRootView(this)
        reactRootView!!.startReactApplication(app.keyboardReactHost, "KickKeyKeyboard", null)
        Log.i(TAG, "ReactRootView শুরু হয়েছে")
        return reactRootView!!
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        KickKeyModule.activeInputConnection = currentInputConnection
        // বাংলা বাফার রিসেট — ফিল্ডের মধ্যে কখনো আংশিক রোমান ইনপুট বহন করবে না
        KickKeyModule.banglaEngine?.reset()
        Log.i(TAG, "InputConnection অর্জিত — inputType: ${info.inputType}")
    }

    override fun onFinishInput() {
        super.onFinishInput()
        // ফিল্ড ছাড়ার আগে যেকোনো অপেক্ষমাণ বাংলা ফ্লাশ করুন
        val pending = KickKeyModule.banglaEngine?.flush() ?: ""
        if (pending.isNotEmpty()) {
            KickKeyModule.activeInputConnection?.commitText(pending, 1)
        }
        KickKeyModule.activeInputConnection = null
        Log.i(TAG, "ইনপুট শেষ — InputConnection মুক্ত করা হয়েছে")
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        KickKeyModule.activeInputConnection = null
        KickKeyModule.banglaEngine?.reset()
        Log.i(TAG, "কীবোর্ড লুকানো — বাংলা বাফার রিসেট")
    }

    override fun onDestroy() {
        reactRootView?.unmountReactApplication()
        reactRootView = null
        KickKeyModule.hapticManager = null
        KickKeyModule.banglaEngine  = null
        super.onDestroy()
        Log.i(TAG, "IME সার্ভিস ধ্বংস হয়েছে")
    }
}
```

---

## 8. বাংলা কীবোর্ড লেআউট (TypeScript)

এটি একটি ফোনেটিক QWERTY ওভারলে। কী লেবেল **প্রাথমিক বাংলা অক্ষর** দেখায়। `code` ফিল্ড হলো `BanglaInputEngine`-এ পাঠানো রোমান অক্ষর।

```typescript
// src/keyboard/layouts/bangla.ts
import type { KeyDef } from '../types';

export const BANGLA_ROWS: KeyDef[][] = [
  // ── সারি ১ ───────────────────────────────────────────────────────────────
  [
    { label: 'ক',   code: 'k', altChars: ['খ', 'গ', 'ঘ', 'ঙ'] },
    { label: 'ও',   code: 'o', altChars: ['ওয়া', 'ঔ'] },
    { label: 'এ',   code: 'e', altChars: ['ঐ'] },
    { label: 'র',   code: 'r', altChars: ['ড়', 'ঢ়'] },
    { label: 'ত',   code: 't', altChars: ['থ', 'ট', 'ঠ'] },
    { label: 'য',   code: 'y', altChars: ['য়', 'ইয়'] },
    { label: 'উ',   code: 'u', altChars: ['ঊ', 'ু', 'ূ'] },
    { label: 'ই',   code: 'i', altChars: ['ঈ', 'ি', 'ী'] },
    { label: 'অ',   code: 'a', altChars: ['আ', 'া'] },
    { label: 'প',   code: 'p', altChars: ['ফ'] },
  ],

  // ── সারি ২ ───────────────────────────────────────────────────────────────
  [
    { label: 'অ',  code: 'a', altChars: ['আ', 'া'] },
    { label: 'স',  code: 's', altChars: ['শ', 'ষ'] },
    { label: 'দ',  code: 'd', altChars: ['ধ', 'ড', 'ঢ'] },
    { label: 'ফ',  code: 'f', altChars: ['ফ'] },
    { label: 'গ',  code: 'g', altChars: ['ঘ'] },
    { label: 'হ',  code: 'h', altChars: ['ঃ'] },
    { label: 'জ',  code: 'j', altChars: ['ঝ'] },
    { label: 'ক',  code: 'k', altChars: ['খ', 'ঘ'] },
    { label: 'ল',  code: 'l', altChars: ['ল'] },
  ],

  // ── সারি ৩ ───────────────────────────────────────────────────────────────
  [
    {
      label: '⇧', shiftLabel: '⇪', code: '',
      action: 'shift', width: 1.5, isSpecial: true, icon: 'shift',
    },
    { label: 'য়',  code: 'z', altChars: ['য়'] },
    { label: 'ক্ষ', code: 'x', altChars: ['ক্ষ'] },
    { label: 'চ',  code: 'c', altChars: ['ছ'] },
    { label: 'ভ',  code: 'v', altChars: ['ব'] },
    { label: 'ব',  code: 'b', altChars: ['ভ'] },
    { label: 'ন',  code: 'n', altChars: ['ণ', 'ং', 'ঁ'] },
    { label: 'ম',  code: 'm', altChars: ['ম'] },
    {
      label: '⌫', code: '',
      action: 'backspace', width: 1.5, isSpecial: true, icon: 'backspace',
    },
  ],
];
```

---

## 9. আপডেটেড `layouts/index.ts`

বাংলা এক্সপোর্ট যোগ করুন।

```typescript
// src/keyboard/layouts/index.ts
export { ENGLISH_ROWS } from './english';
export { SYMBOL_ROWS }  from './symbols';
export { BANGLA_ROWS }  from './bangla';   // ← ফেজ ৩-এ নতুন
```

---

## 10. `KeyboardHeader` কম্পোনেন্ট

একটি পাতলা স্ট্রিপ যা কীবোর্ডের শীর্ষে এবং সাজেশন বারের মধ্যে বসে। এটি বর্তমান ভাষার নাম এবং একটি ছোট নির্দেশক দেখায়।

```tsx
// src/keyboard/KeyboardHeader.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Theme } from './types';

interface KeyboardHeaderProps {
  language: 'en' | 'bn';
  theme: Theme;
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
      {/* ভাষা ব্যাজ */}
      <View style={[styles.badge, { backgroundColor: theme.specialKeyBg }]}>
        <Text style={[styles.badgeText, { color: theme.suggestionText }]}>
          {langBadge}
        </Text>
      </View>

      {/* ভাষার নাম */}
      <Text style={[styles.langName, { color: theme.altText }]}>
        {langLabel}
      </Text>

      {/* কম্পোজিং টেক্সট নির্দেশক (বাফারড রোমান অক্ষর দেখায়) */}
      {isComposing && (
        <View style={styles.composingContainer}>
          <Text style={[styles.composingLabel, { color: theme.altText }]}>
            টাইপিং:{' '}
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

## 11. আপডেটেড `KeyboardScreen`

```tsx
// src/keyboard/KeyboardScreen.tsx
// সম্পূর্ণ প্রতিস্থাপন

/**
 * ফেজ ৩ — বাংলা ফোনেটিক ইনপুট যোগ হয়।
 *
 * ফেজ ২ থেকে পরিবর্তন:
 *   - KeyboardHeader বর্তমান ভাষা দেখায়
 *   - language === 'bn' হলে BANGLA_ROWS ব্যবহার করা হয়
 *   - ইমোজি/ক্লিপবোর্ড স্টাব থাকে (ফেজ ৬)
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

  const rows = isSymbol
    ? SYMBOL_ROWS
    : language === 'bn'
    ? BANGLA_ROWS
    : ENGLISH_ROWS;

  if (isEmoji) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <Text style={[styles.stub, { color: theme.altText }]}>😊 ইমোজি প্যানেল — ফেজ ৬</Text>
        <Text style={[styles.stubClose, { color: theme.suggestionText }]} onPress={handleEmojiToggle}>বন্ধ করুন</Text>
      </View>
    );
  }

  if (isClipboard) {
    return (
      <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
        <Text style={[styles.stub, { color: theme.altText }]}>📋 ক্লিপবোর্ড প্যানেল — ফেজ ৬</Text>
        <Text style={[styles.stubClose, { color: theme.suggestionText }]} onPress={handleClipboardToggle}>বন্ধ করুন</Text>
      </View>
    );
  }

  return (
    <View style={[styles.keyboard, { backgroundColor: theme.keyboardBg }]}>
      {/* ভাষা নির্দেশক — ফেজ ৩-এ নতুন */}
      <KeyboardHeader
        language={language}
        theme={theme}
        composingText={composingText}
      />

      {/* সাজেশন বার — ফেজ ৪ পর্যন্ত প্লেসহোল্ডার */}
      <SuggestionBar
        suggestions={suggestions}
        onSelect={handleSuggestionSelect}
        theme={theme}
      />

      {/* কী সারি — QWERTY, বাংলা, বা সিম্বল */}
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
  keyboard:  { width: '100%', paddingBottom: 6 },
  stub:      { textAlign: 'center', padding: 40, fontSize: 14 },
  stubClose: { textAlign: 'center', paddingBottom: 16, fontSize: 14, fontWeight: '600' },
});
```

---

## 12. আপডেটেড `useKeyboardState` হুক

তিনটি সংযোজন: `composingText` স্টেট, ভাষা সুইচের আগে `flushBanglaBuffer`, এবং `onComposingChanged` ইভেন্ট লিসেনার।

```typescript
// src/keyboard/hooks/useKeyboardState.ts
// সম্পূর্ণ প্রতিস্থাপন

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
  composingText: string;       // ← ফেজ ৩-এ নতুন
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
  const [composingText, setComposing]   = useState('');   // ← ফেজ ৩-এ নতুন

  const backspacePressRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setComposing('');    // ← ফিল্ড সুইচে কম্পোজিং নির্দেশক পরিষ্কার করুন
    });

    const subHidden = emitter.addListener('onKeyboardHidden', () => {
      setIsEmoji(false);
      setIsClipboard(false);
      setComposing('');
    });

    // নতুন: Kotlin ইঞ্জিন হেডার নির্দেশকের জন্য কম্পোজিং টেক্সট এমিট করতে পারে
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

  const handleKeyPress = useCallback((key: KeyDef) => {
    if (!key.code) return;
    KickKey.commitKey(key.code, language);
    if (language === 'en') {
      setComposing('');
      if (isShift && !isCapsLock) setIsShift(false);
    }
  }, [language, isShift, isCapsLock]);

  const handleBackspace = useCallback(() => {
    KickKey.sendBackspace();
  }, []);

  const handleBackspaceLongPress = useCallback(() => {
    if (backspacePressRef.current) return;
    backspacePressRef.current = setInterval(() => {
      KickKey.sendBackspace();
    }, 80);
  }, []);

  const handleSpace = useCallback(() => {
    KickKey.commitSpace();
    setComposing('');
    if (language === 'en' && isShift && !isCapsLock) setIsShift(false);
  }, [language, isShift, isCapsLock]);

  const handleEnter = useCallback(() => {
    KickKey.sendEnter();
    setComposing('');
  }, []);

  const handleShift = useCallback(() => {
    if (!isShift && !isCapsLock)     { setIsShift(true); }
    else if (isShift && !isCapsLock) { setIsCapsLock(true); }
    else                             { setIsShift(false); setIsCapsLock(false); }
  }, [isShift, isCapsLock]);

  // ফেজ ৩-এ আপডেট: ভাষা সুইচের আগে বাংলা বাফার ফ্লাশ করুন
  const handleLanguageSwitch = useCallback(() => {
    KickKey.flushBanglaBuffer().catch(() => {});
    setComposing('');
    setLanguage(l => l === 'en' ? 'bn' : 'en');
    setSuggestions([]);
    setIsShift(false);
    setIsCapsLock(false);
  }, []);

  const handleSymbolToggle = useCallback(() => {
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
    KickKey.commitKey(word, 'en');
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

## 13. আপডেটেড `BottomRow` কম্পোনেন্ট

```tsx
// src/keyboard/BottomRow.tsx
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
  theme, language, isSymbol,
  onSpace, onEnter, onLanguageSwitch, onSymbolToggle, onEmojiToggle,
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
      <TouchableOpacity style={[styles.key, special, { flex: 1.5 }]} onPress={onSymbolToggle} activeOpacity={0.55}>
        <Text style={[styles.label, { color: theme.specialKeyText, fontSize: 13 }]}>
          {isSymbol ? 'ABC' : '!#1'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.key, special, { flex: 1.2 }]}
        onPress={onLanguageSwitch}
        onLongPress={onLanguageSwitch}
        delayLongPress={600}
        activeOpacity={0.55}
      >
        <Text style={[styles.label, { color: theme.specialKeyText, fontSize: 11 }]}
          numberOfLines={1} adjustsFontSizeToFit>
          {langLabel}
        </Text>
      </TouchableOpacity>

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
        <Text style={[styles.spaceLabel, { color: theme.altText }]}>{spaceLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.key, special, { flex: 1 }]} onPress={onEmojiToggle} activeOpacity={0.55}>
        <Text style={styles.emoji}>😊</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.key, special, { flex: 1.5 }]} onPress={onEnter} activeOpacity={0.55}>
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

## 14. আপডেটেড `modules/kickkey-module/index.ts`

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

  // ── ফেজ ৩ (নতুন) ──────────────────────────────────────────────────────────

  /**
   * BanglaInputEngine-এ বাফারড রোমান অক্ষরগুলো সাধারণ টেক্সট হিসেবে কমিট করুন।
   * ভাষা সুইচ, ফিল্ড ফোকাস পরিবর্তন, ইমোজি/সিম্বল প্যানেল খোলার আগে কল করুন।
   */
  flushBanglaBuffer: (): Promise<void> =>
    KickKey.flushBanglaBuffer(),

  /**
   * বাংলা ফোনেটিক ইঞ্জিন সক্রিয় বা নিষ্ক্রিয় করুন।
   */
  setBanglaEnabled: (enabled: boolean): Promise<void> =>
    KickKey.setBanglaEnabled(enabled),
};
```

---

## 15. বিল্ড ও পরীক্ষা

### ১৫.১ ইউনিট টেস্ট চালান

APK বিল্ড করার আগে ইউনিট টেস্ট চালান।

```bash
cd android

# শুধুমাত্র BanglaInputEngine টেস্ট চালান
./gradlew :app:test --tests "com.kickkey.BanglaInputEngineTest"

# সমস্ত ইউনিট টেস্ট চালান
./gradlew :app:test

# প্রত্যাশিত আউটপুট:
# BanglaInputEngineTest > a অ তৈরি করে PASSED
# BanglaInputEngineTest > kha খ তৈরি করে PASSED
# BanglaInputEngineTest > kha ক+ha-এর আগে মেলে PASSED
# ... (সমস্ত টেস্ট সবুজ)
```

### ১৫.২ `keyboard.bundle` পুনরায় বিল্ড করুন

```bash
npx react-native bundle \
  --entry-file keyboard.index.js \
  --bundle-output android/app/src/main/assets/keyboard.bundle \
  --platform android \
  --minify false
```

### ১৫.৩ বিল্ড ও ইনস্টল করুন

```bash
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### ১৫.৪ লগ মনিটর করুন

```bash
adb logcat -s KickKeyIME BanglaEngine

# বাংলা মোডে "ka" টাইপ করলে প্রত্যাশিত আউটপুট:
# V/BanglaEngine: মিল: 'ka' → 'ক' | বাকি বাফার: ''

# ভাষা সুইচ করলে:
# V/BanglaEngine: ফ্লাশ: '' (বা অপেক্ষমাণ রোমান অক্ষর)
# I/KickKeyIME: কীবোর্ড লুকানো — বাংলা বাফার রিসেট
```

---

## 16. যাচাই চেকলিস্ট

ফেজ ৪-এ যাওয়ার আগে প্রতিটি আইটেম সম্পন্ন করুন।

### Kotlin / নেটিভ
- [ ] `BanglaInputEngine.kt` ত্রুটি ছাড়া কম্পাইল হয়
- [ ] `KickKeyInputMethodService.kt` `BanglaInputEngine` ইনস্ট্যান্টিয়েট করে — logcat "BanglaInputEngine প্রস্তুত" দেখায়
- [ ] `KickKeyModule.kt` নতুন `banglaEngine` companion ফিল্ড সহ কম্পাইল হয়

### ইউনিট টেস্ট
- [ ] `./gradlew :app:test` ০টি ব্যর্থতায় পাস করে
- [ ] সমস্ত মূল স্বরবর্ণ টেস্ট পাস (`a → অ`, `i → ই`, ইত্যাদি)
- [ ] সমস্ত CV পর্ব টেস্ট পাস (`ka → ক`, `ba → ব`, ইত্যাদি)
- [ ] মহাপ্রাণ ব্যঞ্জনবর্ণ টেস্ট পাস (`kha → খ`, `chha → ছ`, ইত্যাদি)
- [ ] দীর্ঘতম-মিল অগ্রাধিকার টেস্ট পাস
- [ ] বাফার ম্যানেজমেন্ট টেস্ট পাস
- [ ] অনুস্বার টেস্ট পাস (`ng → ং`)

### ভাষা সুইচ
- [ ] `🌐` কী ট্যাপ করলে ইংরেজি ও বাংলা লেআউটের মধ্যে সুইচ হয়
- [ ] `KeyboardHeader` ব্যাজ আপডেট হয়: `EN` ↔ `বাং`
- [ ] EN→BN সুইচের পরে বাংলা কী লেবেল দেখায় (যেমন ক, ব, ম)
- [ ] BN→EN সুইচের পরে ইংরেজি কী লেবেল দেখায় (q, w, e, ইত্যাদি)
- [ ] `BottomRow` স্পেস কী লেবেল পরিবর্তিত হয়: "space" ↔ "স্পেস"

### বাংলা টাইপিং নির্ভুলতা

| এটি টাইপ করুন | প্রত্যাশিত আউটপুট |
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

- [ ] উপরের টেবিলের সমস্ত এন্ট্রি সঠিক বাংলা Unicode তৈরি করে

### বাংলা মোডে ব্যাকস্পেস
- [ ] `k` টাইপ করুন (বাফারিং) → ব্যাকস্পেস → কিছু কমিট হয় না, বাফার পরিষ্কার হয়
- [ ] `ka` টাইপ করুন → ক দেখায় → ব্যাকস্পেস → ফিল্ড থেকে ক মুছে যায়
- [ ] `kh` টাইপ করুন (বাফারিং) → ব্যাকস্পেস → `h` বাফার থেকে সরে → `a` টাইপ করুন → ক কমিট হয়

### বাফার ফ্লাশ
- [ ] `kh` টাইপ করুন (বাফারিং) → স্পেস প্রেস → `kh` যেভাবে আছে কমিট হয় তারপর স্পেস যোগ হয়
- [ ] `kh` টাইপ করুন → ভাষা সুইচ → `kh` যেভাবে আছে কমিট হয়, তারপর লেআউট ইংরেজিতে সুইচ হয়

---

## 17. ট্রান্সলিটারেশন রেফারেন্স টেবিল

ইঞ্জিন যে সম্পূর্ণ ফোনেটিক ম্যাপ ব্যবহার করে। পরীক্ষকদের সাথে শেয়ার করুন।

| টাইপ করুন | আউটপুট | Unicode | মন্তব্য |
|---|---|---|---|
| `a` | অ | U+0985 | হ্রস্ব অ |
| `aa` | আ | U+0986 | দীর্ঘ আ |
| `i` | ই | U+0987 | হ্রস্ব ই |
| `ii` | ঈ | U+0988 | দীর্ঘ ঈ |
| `u` | উ | U+0989 | হ্রস্ব উ |
| `uu` | ঊ | U+098A | দীর্ঘ ঊ |
| `e` | এ | U+098F | |
| `ee` | ঐ | U+0990 | ঐ দ্বিস্বর |
| `o` | ও | U+0993 | |
| `oo` | ঔ | U+0994 | ঔ দ্বিস্বর |
| `ri` | ৃ | U+09C3 | ঋ স্বর চিহ্ন |
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
| `ng` | ং | U+0982 | অনুস্বার |
| `:` | ঃ | U+0983 | বিসর্গ |
| `^` | ঁ | U+0981 | চন্দ্রবিন্দু |
| `` ` `` | ্ | U+09CD | হসন্ত (বিরাম) |

---

## 18. সমস্যা সমাধান

### বাংলা অক্ষর দেখা যাচ্ছে না — শুধু রোমান অক্ষর কমিট হচ্ছে

**কারণ:** `KickKeyModule.banglaEngine` null — ইঞ্জিন ইনিশিয়ালাইজ হয়নি।

**পরীক্ষা:**
```bash
adb logcat -s KickKeyIME | grep "BanglaInputEngine"
# প্রত্যাশিত: "IME সার্ভিস তৈরি — HapticManager ও BanglaInputEngine প্রস্তুত"
```
**সমাধান:** নিশ্চিত করুন `KickKeyInputMethodService.onCreate()` সেট করে:
```kotlin
KickKeyModule.banglaEngine = BanglaInputEngine()
```

---

### `kha` খ-এর পরিবর্তে `ক` + `ha` তৈরি করে

**কারণ:** `processKey` লুপ যথেষ্ট দীর্ঘ প্রত্যয় চেষ্টা করছে না।

**পরীক্ষা করুন `BanglaInputEngine.processKey()`:**
```kotlin
val maxLen = minOf(4, input.length)   // অবশ্যই 4 হতে হবে, 2 বা 3 নয়
```

---

### বাফার অক্ষর আটকে যায় — ব্যবহারকারী `k` টাইপ করে কিন্তু এটি কখনো কমিট হয় না

**কারণ:** স্বয়ংক্রিয়-ফ্লাশ থ্রেশহোল্ড ট্রিগার হচ্ছে না। `MAX_BUFFER = 5` মানে ৫টি মেলাকৃত না হওয়া অক্ষর স্বয়ংক্রিয়ভাবে ফ্লাশ হয়।

**সমাধান:** একটি একক-অক্ষর কী টাইপ করুন যা একটি মিল জোর করে, যেমন `k` তারপর `a` → `ka → ক`।

---

### ভাষা সুইচ ফিল্ডে দৃশ্যমান রোমান অক্ষর রেখে যায়

**কারণ:** লেআউট সুইচের আগে `flushBanglaBuffer()` কল হচ্ছে না।

**পরীক্ষা করুন `useKeyboardState.handleLanguageSwitch()`:**
```typescript
const handleLanguageSwitch = useCallback(() => {
  KickKey.flushBanglaBuffer().catch(() => {});   // ← অবশ্যই এখানে থাকতে হবে
  setLanguage(l => l === 'en' ? 'bn' : 'en');
  ...
}, []);
```

---

### ইউনিট টেস্ট "BanglaInputEngine খুঁজে পাওয়া যায়নি" সহ ব্যর্থ হয়

**কারণ:** টেস্ট ফাইল ভুল ডিরেক্টরিতে।

**সমাধান:** নিশ্চিত করুন টেস্ট এখানে আছে:
```
android/app/src/test/java/com/kickkey/BanglaInputEngineTest.kt
```
`androidTest/`-এ নয় (যা ডিভাইস প্রয়োজন এমন ইন্সট্রুমেন্টেড টেস্টের জন্য)।

---

### `KeyboardHeader` কম্পোজিং টেক্সট আপডেট হয় না

**কারণ:** Kotlin থেকে `onComposingChanged` ইভেন্ট এমিট হচ্ছে না।

**নোট:** কম্পোজিং টেক্সট ইভেন্ট ঐচ্ছিক — `KeyboardHeader` এটি ছাড়াও সঠিকভাবে রেন্ডার হয়। সম্পূর্ণ বাস্তবায়নের জন্য `KickKeyModule`-এ এটি যোগ করুন:

```kotlin
// commitKey-তে banglaEngine.processKey() কল করার পরে:
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

*ফেজ ৩ সম্পন্ন। বাইনারি Trie ডিকশনারি ওয়্যার করতে এবং সাজেশন বার কার্যকরী করতে ফেজ ৪ — সাজেশন ও অটোকারেক্ট — এ এগিয়ে যান।*
