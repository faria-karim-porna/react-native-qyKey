# ⊞ (উইন্ডোজ) কী দ্বিতীয়বার চাপলেই PC-র Start মেনু কেন খোলে

**সংক্ষিপ্ত উত্তর: হ্যাঁ — এটা সত্যি, এবং এটা ইচ্ছাকৃত ডিজাইন।**

QyKey কে রিমোট ডেস্কটপে (**AnyDesk**, **TeamViewer**, **Microsoft Remote
Desktop / "Windows App"**, **VNC**, **Chrome Remote Desktop**) কীবোর্ড হিসেবে
ব্যবহার করার সময় ⊞ চাবি **একবার** চাপলে PC-তে কিছুই হয় না। **দ্বিতীয়বার**
চাপলে আসল উইন্ডোজ কী রিমোট PC-তে পাঠানো হয়, ফলে PC-র Start মেনু খুলে যায়।
দুটো চাপ দ্রুত দেওয়ার দরকার **নেই** — Shift-এর মতো 350 ms-এর double-tap
সময়সীমা এখানে নেই; ⊞ চাপা হয় শুধু *latched* (ল্যাচ হয়ে জ্বলে থাকা) অবস্থায়
থাকে, যতক্ষণ না দ্বিতীয়বার চাপা হয়।

---

## ১. ধাপে ধাপে আসলে কী ঘটে

### ⊞-এর প্রথম চাপ — শুধু "ল্যাচ", PC-তে কিছুই পাঠানো হয় না

`src/hooks/useKeyboardState.ts` → `toggleHeldModifier`:

```ts
const toggleHeldModifier = useCallback((key: ModifierKey) => {
  setHeldModifiers((mods) => {
    if (mods.includes(key)) {
      // ল্যাচ করা অবস্থায় দ্বিতীয় চাপ… (নিচে দেখুন)
      if (key === 'meta') {
        getQyKey()?.sendSpecialKey('win');
      }
      return mods.filter((m) => m !== key);
    }
    return [...mods, key];      // ← প্রথম চাপ: ⊞ ল্যাচ হলো, কোনো key event নেই
  });
  playKeySound();
}, []);
```

প্রথম চাপে শুধু `'meta'` ল্যাচ-তালিকায় ঢোকে এবং কীবোর্ডে ⊞ সূচক জ্বলে ওঠে।
**কোনো key event রিমোট PC-তে যায় না** — `Ctrl`, `Alt`, `Shift`-এর ক্ষেত্রেও
ঠিক একই ব্যবস্থা।

### ⊞-এর দ্বিতীয় চাপ — একা (lone) Win কী পাঠানো হয়

একই ফাংশনে, ⊞ আগে থেকে ল্যাচ করা থাকলে `getQyKey()?.sendSpecialKey('win')`
ডাকা হয় এবং ল্যাচ তুলে নেওয়া (unlatch) হয়।

### নেটিভ দিক — Win কী আসল key event হয়ে যায়

`native/java/com/qykey/QyKeyModule.kt` → `sendSpecialKey`:

```kotlin
"ctrl", "alt", "meta", "win", "⊞" -> {
    // একা modifier চাপলে দ্রুত down/up পাঠানো হয় (আসল পিসি কীবোর্ডের
    // মতো, যেমন Win -> Start menu)।
    val keyCode = when (k) {
        "ctrl" -> KeyEvent.KEYCODE_CTRL_LEFT
        "alt"  -> KeyEvent.KEYCODE_ALT_LEFT
        else   -> KeyEvent.KEYCODE_META_LEFT      // ← "win" এখানে পড়ে
    }
    sendKeyEvents(listOf(keyCode))
}
```

`sendKeyEvents` সক্রিয় `InputConnection`-এর মাধ্যমে `KEYCODE_META_LEFT`
(Android key code 117 — উইন্ডোজ কী)-এর `ACTION_DOWN` + `ACTION_UP` জোড়া
ইনজেক্ট করে; ইভেন্ট দুটি সফট-কীবোর্ড থেকে আসা হার্ডওয়্যার-ধাঁচের কী হিসেবে
চিহ্নিত (`FLAG_SOFT_KEYBOARD`, `KeyCharacterMap.VIRTUAL_KEYBOARD`)।

### রিমোট দিক — Start মেনু কেন খোলে

রিমোট ডেস্কটপ হোস্ট (AnyDesk / TeamViewer / RDP …) ইনপুট স্ট্রিমে আসা আসল key
event গুলো ধরে PC-তে **ফিজিক্যাল Win কী-প্রেস ও রিলিজ** হিসেবে ফরওয়ার্ড করে।

উইন্ডোজে Win কী নিয়ে পুরনো একটা নিয়ম আছে:

> Win কী **ছাড়া হলে** (release) এবং চেপে ধরে থাকা অবস্থায় **অন্য কোনো কী
> চাপা না হলে** Start মেনু খোলে।

দ্বিতীয় চাপে মাঝে **কিছুই না দিয়ে** পরিষ্কার `Win` down → `Win` up জোড়া যায়,
তাই উইন্ডোজ এটাকে "Win একা চাপা ও ছাড়া" হিসেবে বিবেচনা করে Start মেনু টগল করে।
পুরো চেইনটা এরকম:

```
চাপ ১: JS 'meta' ল্যাচ করে (সূচক জ্বলে) ─────────── কিছুই যায় না
চাপ ২: sendSpecialKey('win')
        → KEYCODE_META_LEFT down + up (InputConnection)
        → রিমোট হোস্ট ফিজিক্যাল Win কী-প্রেস হিসেবে ফরওয়ার্ড করে
        → উইন্ডোজ: down ও up-এর মাঝে কোনো chord নেই
        → Start মেনু খোলে ✔
```

---

## ২. এটা কেন এভাবে বানানো হয়েছে (আসল কারণ)

টাচস্ক্রিন কীবোর্ডে ফিজিক্যাল কীবোর্ডের মতো modifier "চেপে ধরে রাখা" যায় না।
তাই QyKey-তে **PC-ধাঁচের এক-শট ল্যাচিং modifier** ব্যবহার করা হয়েছে (দেখুন
`src/hooks/useKeyboardState.ts` — "PC-style modifier latch state", এবং
`docs/computer-special-keys.md` §2.1 ও §3):

| আপনি যা চাপেন | ফলাফল |
| :--- | :--- |
| `⊞` একবার | ⊞ **ল্যাচ হয়** (সূচক জ্বলে)। এরপর যে চাবি চাপবেন সেটা Win হিসেবে যাবে — `⊞ + D` = Show Desktop, `⊞ + R` = Run, `⊞ + E` = Explorer, `⊞ + L` = Lock, … |
| `⊞`, তারপর `D` | PC পায় `Win+D` chord (Desktop দেখা যায় — Start মেনু **নয়**) |
| `⊞` দুইবার | PC পায় **একা একটা** Win কী-প্রেস → **Start মেনু খোলে** |
| `Ctrl` একবার, তারপর `⊞` দুইবার | ⊞ আনল্যাচ হয়ে Start চালু করে; Ctrl ল্যাচ পরের combo-র জন্য থেকে যায় |

দ্বিতীয়-চাপ আচরণটাই একসঙ্গে **দুটো সমস্যার সমাধান** করে:

1. **এক চাপে হতেই পারে না।** ⊞ একবার চাপলেই যদি সঙ্গে সঙ্গে Win কী পাঠানো
   হতো, তাহলে Start মেনু খুলে যেত আর ল্যাচটা অকেজো হয়ে যেত — `Win+D`,
   `Win+R`, `Win+E`-এর মতো chord তৈরি করা কোনোভাবেই সম্ভব হতো না।
2. **"আনল্যাচ"-এর চাপটা একা কী-তে কাজে লাগে।** কোনো অন্য চাবি ছাড়া ল্যাচ তুলে
   নিলে বাকি থাকে একটা স্বতন্ত্র (standalone) Win কীস্ট্রোক — তাই সেই বাউন্ড
   কীস্ট্রোকটিই PC-তে পাঠানো হয়, ফলে দুটো চাপের একটিও বৃথা যায় না।

Shift কী-টিও একই এক-শট প্যাটার্ন মানে, তবে একটা মোড় আছে: Shift একবার চাপলে
অন্যগুলোর মতোই ল্যাচ হয়, কিন্তু **Shift-এ ডাবল-ট্যাপ** (350 ms-এর মধ্যে) করলে
তার বদলে Caps Lock টগল হয় — কারণ টাইপিংয়ের ক্ষেত্রে একা চাপিয়ে ছাড়া
modifier-এর সবচেয়ে দরকারি অর্থ Caps Lock, অপরদিকে ⊞-এর একা চাপ-ছাড়ার অর্থ
Start মেনু।

---

## ৩. রিমোট সেশনে কাজে লাগবে এমন নোট

- **দুটো চাপ দ্রুত দিতে হবে না।** নতুন ইনপুট ফিল্ড শুরু না হওয়া পর্যন্ত ল্যাচ
  থেকেই যায় (নতুন ফিল্ডে ল্যাচ মুছে যায় — `onInputStarted` listener দেখুন)।
  ⊞ চেপে স্ক্রিন দেখে পরে আবার ⊞ চাপলেও Start আসবে।
- **Start মেনু টগল:** PC-তে Start মেনু আগে থেকে খোলা থাকলে একা Win চাপে
  সেটা বন্ধ হয় — উইন্ডোজ দুই দিকেই টগল করে।
- **Combo-র পরেও Start নিরাপদ:** ⊞ ল্যাচ করে `D` চাপুন (Win+D যায়, ল্যাচ
  নিজেই মুছে যায়), পরে যেকোনো সময় ⊞ দুইবার চাপুন — Start তবুও কাজ করবে।
- **দ্বিতীয় চাপটা কেন তৃতীয় কী হিসেবে নেওয়া হয় না:** combo তৈরি হয় শুধু
  ল্যাচ-এর **পরে অন্য** কোনো চাবি চাপলে (`handleKeyPress`, `handleSpecialKey`
  ইত্যাদি)। ⊞ নিজেই চাপলে combo-তে মেলে না, তাই ফলটা আনল্যাচ পথে গিয়ে একা
  কী পাঠায়।

## ৪. কোড রেফারেন্স ম্যাপ

| ধাপ | ফাইল | অবস্থান |
| :--- | :--- | :--- |
| ল্যাচ / আনল্যাচ + একা `win` পাঠানো | `src/hooks/useKeyboardState.ts` | `toggleHeldModifier` (≈ লাইন 318) |
| কীবোর্ডে ⊞ চাবির ওয়্যারিং | `src/app/mainKeyboard/keyboard/LetterKeys.tsx` | Row 5, `onModifierToggle?.('meta')` |
| `"win"` → `KEYCODE_META_LEFT` down/up | `native/java/com/qykey/QyKeyModule.kt` | `sendSpecialKey` (≈ লাইন 515) |
| রিমোট হোস্ট যে chord ডিসপ্যাচ ব্যবহার করে | `native/java/com/qykey/QyKeyModule.kt` | `sendKeyCombo` (`docs/computer-special-keys.md` §3) |
| ডকুমেন্ট করা আচরণ | `docs/computer-special-keys.md` | §2.1 — "Windows / Meta" সারি |
