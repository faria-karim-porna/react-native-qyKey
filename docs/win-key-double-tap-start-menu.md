# Why the ⊞ (Windows) key opens the PC Start menu **on a double press**

**Short answer: Yes — it is true, and it is intentional app design.**

When you use QyKey as the keyboard in a remote-desktop session
(**AnyDesk**, **TeamViewer**, **Microsoft Remote Desktop / "Windows App"**,
**VNC**, **Chrome Remote Desktop**), tapping the ⊞ key **once** does nothing on
the PC. Tapping it a **second time** sends the real Windows key to the remote PC,
and the PC's Start menu opens. The two taps do **not** need to be rapid — there
is no double-tap time window (unlike Shift, which has a 350 ms double-tap
window for Caps Lock); the ⊞ key simply stays *latched* until the second tap.

---

## 1. What actually happens, tap by tap

### First tap of ⊞ — "latch" only, nothing is sent to the PC

`src/hooks/useKeyboardState.ts` → `toggleHeldModifier`:

```ts
const toggleHeldModifier = useCallback((key: ModifierKey) => {
  setHeldModifiers((mods) => {
    if (mods.includes(key)) {
      // Second tap while latched… (see below)
      if (key === 'meta') {
        getQyKey()?.sendSpecialKey('win');
      }
      return mods.filter((m) => m !== key);
    }
    return [...mods, key];      // ← First tap: ⊞ is latched, NO key event is sent
  });
  playKeySound();
}, []);
```

The first tap only adds `'meta'` to the latched-modifier list and lights the ⊞
indicator on the keyboard. **No key event reaches the remote PC** — this is the
same mechanism used for `Ctrl`, `Alt` and `Shift`.

### Second tap of ⊞ — the lone Win key is dispatched

The same function, when ⊞ is already latched, calls
`getQyKey()?.sendSpecialKey('win')` and unlatches.

### Native side — the Win key becomes a real key event

`native/java/com/qykey/QyKeyModule.kt` → `sendSpecialKey`:

```kotlin
"ctrl", "alt", "meta", "win", "⊞" -> {
    // A lone modifier tap sends a quick down/up (like a physical PC
    // keyboard, e.g. Win -> Start menu).
    val keyCode = when (k) {
        "ctrl" -> KeyEvent.KEYCODE_CTRL_LEFT
        "alt"  -> KeyEvent.KEYCODE_ALT_LEFT
        else   -> KeyEvent.KEYCODE_META_LEFT      // ← "win" lands here
    }
    sendKeyEvents(listOf(keyCode))
}
```

`sendKeyEvents` injects an `ACTION_DOWN` + `ACTION_UP` pair of
`KEYCODE_META_LEFT` (Android key code 117 — the Windows key) through the
active `InputConnection`, tagged as a soft-keyboard-generated hardware key
(`FLAG_SOFT_KEYBOARD`, `KeyCharacterMap.VIRTUAL_KEYBOARD`).

### Remote side — why the Start menu opens

The remote-desktop host (AnyDesk / TeamViewer / RDP …) intercepts real key
events coming from the input stream and forwards them to the PC as a physical **Win key press and release**.

Windows has a long-standing rule for the Win key:

> The Start menu opens when the Win key is **released** and **no other key was
> pressed while it was held**.

Because the second tap delivers a clean `Win` down → `Win` up pair with
**nothing in between**, Windows interprets it as "Win pressed and released
alone" and toggles the Start menu. The whole chain is:

```
Tap 1: JS latches 'meta' (UI indicator lights) ──────────── nothing sent
Tap 2: sendSpecialKey('win')
        → KEYCODE_META_LEFT down + up (InputConnection)
        → remote host forwards as physical Win key press
        → Windows: no chord between down and up
        → Start menu opens ✔
```

---

## 2. Why it was built this way (the real reason)

A touchscreen keyboard cannot "hold" a modifier the way a physical hand does.
QyKey therefore uses **PC-style one-shot latching modifiers** (see
`src/hooks/useKeyboardState.ts` — "PC-style modifier latch state", and
`docs/computer-special-keys.md` §2.1 & §3):

| You tap | Result |
| :--- | :--- |
| `⊞` once | ⊞ **latches** (indicator lit). The next key you tap is sent as a Win chord — `⊞ + D` = Show Desktop, `⊞ + R` = Run, `⊞ + E` = Explorer, `⊞ + L` = Lock, … |
| `⊞`, then `D` | PC receives `Win+D` chord (Desktop shown — **not** the Start menu) |
| `⊞` twice | PC receives one **lone** Win keypress → **Start menu opens** |
| `Ctrl` once, `⊞` twice | ⊞ unlatches and fires Start; the Ctrl latch stays for a later combo |

The double-press behavior is the clever bit that **solves two problems at
once**:

1. **It can't be a single tap.** If tapping ⊞ once immediately sent the Win
   key, the Start menu would open and the latch would be useless — you would
   never be able to build `Win+D`, `Win+R`, `Win+E` chords at all.
2. **The "unlatch" tap gives the lone key a purpose.** PC keyboards toggle
   Start by tapping Win twice (pressing Win while Start is open, or tapping it
   again) — here the second tap both "unlatches" the leftover modifier and
   emits the standalone Win keystroke, so neither tap is wasted.

The Shift key follows the same one-shot pattern with a twist: tapping Shift
once latches like the others, but a **double-tap on Shift** (within 350 ms)
toggles Caps Lock instead — because that is what a plain press-release of a
tapping modifier maps to most usefully for typing, whereas a plain
press-release of ⊞ maps to the Start menu.

---

## 3. Practical notes for remote sessions

- **The taps don't need to be fast.** The latch persists indefinitely (until a
  new input field starts, which clears latched modifiers — see the
  `onInputStarted` listener). Tap ⊞, read your screen, then tap ⊞ again: Start
  will still appear.
- **Start menu toggle:** if the Start menu is already open on the PC, the lone
  Win tap closes it — Windows toggles it both ways.
- **Combo, then Start is safe:** latch ⊞, tap `D` (Win+D fires, latch
  auto-clears), then tap ⊞ twice later — Start still works.
- **Why the second tap can't be hijacked by `⊞`-combos:** combos are consumed
  only when a *different* key follows the latch (`handleKeyPress`,
  `handleSpecialKey`, etc.). Tapping ⊞ itself does not match a combo, so it
  falls through to the unlatch path that sends the lone key.

## 4. Code reference map

| Step | File | Location |
| :--- | :--- | :--- |
| Latch / unlatch + lone-`win` dispatch | `src/hooks/useKeyboardState.ts` | `toggleHeldModifier` (≈ line 318) |
| ⊞ key wiring on the keyboard | `src/app/mainKeyboard/keyboard/LetterKeys.tsx` | Row 5, `onModifierToggle?.('meta')` |
| `"win"` → `KEYCODE_META_LEFT` down/up | `native/java/com/qykey/QyKeyModule.kt` | `sendSpecialKey` (≈ line 515) |
| Low-level chord dispatch used by remote hosts | `native/java/com/qykey/QyKeyModule.kt` | `sendKeyCombo` (§3 of `docs/computer-special-keys.md`) |
| Documented behaviour | `docs/computer-special-keys.md` | §2.1 — "Windows / Meta" row |
