# Computer Keyboard Special Keys in QyKey

This document provides a comprehensive catalog of all **special keys** present in this keyboard that are traditionally found on a standard physical computer/PC keyboard (101/104-key IBM/Windows layout).

---

## 1. Summary of Special Key Categories

| Category | Keys Included | Key Location in App |
| :--- | :--- | :--- |
| **PC Modifiers** | `Ctrl`, `Alt`, `Win` (⊞), `Shift`, `Caps Lock` | `LetterKeys` (Row 4 & 5), `SymbolKeys`, `SystemKeys` |
| **Navigation & Editing** | `Tab`, `Esc`, `Enter`, `Backspace`, `Insert`, `Delete`, `Home`, `End`, `Page Up`, `Page Down` | `LetterKeys` (Row 5), `SystemKeys` (Rows 1–3) |
| **Function Keys** | `F1`, `F2`, `F3`, `F4`, `F5`, `F6`, `F7`, `F8`, `F9`, `F10`, `F11`, `F12` | `SymbolKeys` (Rows 4 & 5) |
| **System & Terminal Control** | `PrtSc` (Print Screen), `ScrLck` (Scroll Lock), `Pause` / `Break` | `SystemKeys` (Row 1) |
| **Cursor / Directional** | `Left (←)`, `Right (→)`, `Up (↑)`, `Down (↓)` | DPAD Navigation / Touchpad |
| **Media & Hardware** | `Vol Mute`, `Vol Down`, `Vol Up`, `Brightness Up`, `Search`, `Power` | `SystemKeys` (Rows 4 & 5) |

---

## 2. Detailed Key Specifications & Mappings

### 2.1 Modifier Keys (PC-Style Latching)

Modifiers support single-tap latching to build PC keyboard combinations (e.g., `Ctrl+C`, `Alt+Tab`, `Ctrl+Shift+Esc`, `Win+R`).

| Key Name | Label / Icon | UI Location | Android KeyEvent | Android Meta State Mask | PC Keyboard Function |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Control** | `Ctrl` | `LetterKeys` L5, `SymbolKeys` L5, `SystemKeys` L5 | `KEYCODE_CTRL_LEFT` (113) | `META_CTRL_ON \| META_CTRL_LEFT_ON` (0x3000) | Primary shortcut modifier (`Ctrl+C`, `Ctrl+V`, `Ctrl+Z`, `Ctrl+A`). |
| **Alternate** | `Alt` | `LetterKeys` L5 | `KEYCODE_ALT_LEFT` (57) | `META_ALT_ON \| META_ALT_LEFT_ON` (0x12) | Menu navigation, window switching (`Alt+Tab`), closing apps (`Alt+F4`). |
| **Windows / Meta** | `⊞` | `LetterKeys` L5 | `KEYCODE_META_LEFT` (117) | `META_META_ON \| META_META_LEFT_ON` (0x30000) | Tap once to latch for shortcuts (`Win+D`, `Win+E`, `Win+R`, `Win+L`, `Win+PrtSc`, `Win+Pause`); tap again while latched to dispatch lone Win key (opens PC Start Menu). |
| **Shift** | Arrow Up Icon | `LetterKeys` L4, `SymbolKeys` L4, `SystemKeys` L4 | `KEYCODE_SHIFT_LEFT` (59) | `META_SHIFT_ON \| META_SHIFT_LEFT_ON` (0x41) | One-shot capitalization, shifted punctuation, combo modifier (`Shift+Tab`, `Shift+Insert`, `Shift+F10`, text selection `Shift+Arrows`). |
| **Caps Lock** | Arrow Up (Lit / Locked) | `LetterKeys` L4 | `KEYCODE_CAPS_LOCK` (115) | `META_CAPS_LOCK_ON` (0x100000) | Toggled via double-tap on Shift; maintains uppercase typing state and dispatches `KEYCODE_CAPS_LOCK` to keep remote PC in sync. |

---

### 2.2 Navigation & Text Editing Keys

| Key Name | Label / Icon | UI Location | Android KeyEvent | PC Keyboard Function | Remote Desktop / PC Utility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tab** | `Tab` | `LetterKeys` Row 5 | `KEYCODE_TAB` (61) | Indentation, focus cycling between form controls. | Tab navigation, code indenting, `Alt+Tab` application switcher. |
| **Escape** | `Esc` | `LetterKeys` Row 5 | `KEYCODE_ESCAPE` (111) | Cancel operations, close modal dialogs, exit fullscreen. | Stops commands, exits menus, Vim normal mode. |
| **Backspace** | Backspace Icon | `LetterKeys` Row 4, `SymbolKeys` Row 4, `SystemKeys` Row 4 | `KEYCODE_DEL` (67) | Deletes character to the left of the text cursor. | Left delete; `Ctrl+Backspace` deletes previous word. |
| **Enter / Return** | Return Icon | Bottom-Right in all modes | `KEYCODE_ENTER` (66) | Submits inputs, creates new lines. | Executes command in terminal, activates selected button. |
| **Insert** | `Insert` | `SystemKeys` Row 2 | `KEYCODE_INSERT` (124) | Toggles text insertion vs overwrite mode. | Overwrite toggle; `Shift+Insert` (paste) in Linux terminals. |
| **Delete (Forward)** | `Del` | `SystemKeys` Row 3 | `KEYCODE_FORWARD_DEL` (112) | Deletes character to the right of the cursor. | Right delete, file deletion in Windows Explorer, `Ctrl+Alt+Del`. |
| **Home** | `Home` | `SystemKeys` Row 2 | `KEYCODE_MOVE_HOME` (122) | Moves cursor to the beginning of the current line. | `Ctrl+Home` jumps to the top of the document. |
| **End** | `End` | `SystemKeys` Row 3 | `KEYCODE_MOVE_END` (123) | Moves cursor to the end of the current line. | `Ctrl+End` jumps to the end of the document. |
| **Page Up** | `Pg Up` | `SystemKeys` Row 2 | `KEYCODE_PAGE_UP` (92) | Scrolls visible page up by one viewport window. | Fast upward document/browser scrolling. |
| **Page Down** | `Pg Dn` | `SystemKeys` Row 3 | `KEYCODE_PAGE_DOWN` (93) | Scrolls visible page down by one viewport window. | Fast downward document/browser scrolling. |

---

### 2.3 Function Keys (F1 through F12)

All 12 IBM PC standard function keys are fully implemented on the first symbol page (`SymbolKeys.tsx`).

| Key Name | UI Location | Android KeyEvent | Typical Windows / PC Shortcut Behaviors |
| :--- | :--- | :--- | :--- |
| **F1** | `SymbolKeys` Row 4 | `KEYCODE_F1` (131) | Help documentation viewer. |
| **F2** | `SymbolKeys` Row 4 | `KEYCODE_F2` (132) | Rename file/folder; edit active cell in Excel. |
| **F3** | `SymbolKeys` Row 4 | `KEYCODE_F3` (133) | Find next / search in Explorer & browser. |
| **F4** | `SymbolKeys` Row 4 | `KEYCODE_F4` (134) | Address bar dropdown; `Alt+F4` closes active program. |
| **F5** | `SymbolKeys` Row 4 | `KEYCODE_F5` (135) | Refresh page / folder; `Ctrl+F5` cache bypass reload. |
| **F6** | `SymbolKeys` Row 4 | `KEYCODE_F6` (136) | Focus browser address bar / cycle pane elements. |
| **F7** | `SymbolKeys` Row 4 | `KEYCODE_F7` (137) | Spell check in Microsoft Office; caret browsing toggle. |
| **F8** | `SymbolKeys` Row 5 | `KEYCODE_F8` (138) | Windows Safe Mode boot menu; selection expand in Excel. |
| **F9** | `SymbolKeys` Row 5 | `KEYCODE_F9` (139) | Recalculate workbook in Excel; send/receive Outlook. |
| **F10** | `SymbolKeys` Row 5 | `KEYCODE_F10` (140) | Focus window menu bar; `Shift+F10` right-click context menu. |
| **F11** | `SymbolKeys` Row 5 | `KEYCODE_F11` (141) | Toggle fullscreen mode in browsers and media players. |
| **F12** | `SymbolKeys` Row 5 | `KEYCODE_F12` (142) | Save As in Office; open Developer Tools / Inspect Element in browsers. |

---

### 2.4 System & Terminal Control Keys

Located on the first row of `SystemKeys.tsx`.

| Key Name | Label | UI Location | Android KeyEvent | PC Function & Legacy Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Print Screen** | `PrtSc` | `SystemKeys` Row 1 | `KEYCODE_SYSRQ` (120) | Copies entire screen capture to clipboard (`Win+PrtSc` saves screenshot). |
| **Scroll Lock** | `ScrLck` | `SystemKeys` Row 1 | `KEYCODE_SCROLL_LOCK` (116) | Controls scrolling behavior of cursor keys in spreadsheets and console shells. |
| **Pause / Break** | `Pause` | `SystemKeys` Row 1 | `KEYCODE_BREAK` (121) | Halts script/batch execution; `Win+Pause` opens Windows System Properties. |

---

### 2.5 Directional & Cursor Navigation Keys

| Direction | Source | Android KeyEvent | Typical Computer Usage |
| :--- | :--- | :--- | :--- |
| **Left Arrow (←)** | DPAD / Touchpad / Nav Back | `KEYCODE_DPAD_LEFT` (21) | Move caret left, collapse tree nodes, `Ctrl+←` jump word left. |
| **Right Arrow (→)** | DPAD / Touchpad / Nav Fwd | `KEYCODE_DPAD_RIGHT` (22) | Move caret right, expand tree nodes, `Ctrl+→` jump word right. |
| **Up Arrow (↑)** | DPAD / Touchpad Caret | `KEYCODE_DPAD_UP` (19) | Move caret up line, scroll up, terminal history prev command. |
| **Down Arrow (↓)** | DPAD / Touchpad Caret | `KEYCODE_DPAD_DOWN` (20) | Move caret down line, scroll down, terminal history next command. |

---

### 2.6 Hardware & Multimedia Control Keys

Located on Rows 4 & 5 of `SystemKeys.tsx`.

| Key Name | Icon | Android KeyEvent | Local / Remote Effect |
| :--- | :--- | :--- | :--- |
| **Volume Mute** | Speaker Mute | `KEYCODE_VOLUME_MUTE` (164) | Toggles mute state via Android `AudioManager` and forwards keycode. |
| **Volume Down** | Speaker Down | `KEYCODE_VOLUME_DOWN` (25) | Lowers audio volume via `AudioManager` and forwards keycode. |
| **Volume Up** | Speaker Up | `KEYCODE_VOLUME_UP` (24) | Raises audio volume via `AudioManager` and forwards keycode. |
| **Brightness Up**| Sun Icon | `KEYCODE_BRIGHTNESS_UP` (221)| Triggers display brightness adjustment. |
| **Search** | Magnifier Icon | `KEYCODE_SEARCH` (84) | Opens system search / browser search bar. |
| **Power** | Power Icon | `KEYCODE_POWER` (26) | Locks device screen via Accessibility Service or emits power key. |

---

## 3. PC Key Combination Engine (`sendKeyCombo`)

In [`QyKeyModule.kt`](file:///C:/Education/New%20folder%20(6)/react-native-kickKey/react-native-kickKey-deepseek/native/java/com/qykey/QyKeyModule.kt), combos are injected as true low-level Android `KeyEvent`s with a 3-phase hardware key chord dispatch and synchronous modifier masks (`metaState`):

```kotlin
// 1. Press down modifiers (in order) so remote desktop hosts register key chord
for (modCode in modKeyCodes) {
    ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, modCode, 0, runningMeta, deviceId, 0, flags))
}

// 2. Press down and release main key with full cumulative meta
ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0, meta, deviceId, 0, flags))
ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, keyCode, 0, meta, deviceId, 0, flags))

// 3. Release modifiers in reverse order
for (modCode in modKeyCodes.asReversed()) {
    ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, modCode, 0, runningMeta, deviceId, 0, flags))
}
```

This guarantees that remote desktop applications (such as **AnyDesk**, **TeamViewer**, **Microsoft Remote Desktop**, **VNC**, and **Chrome Remote Desktop**) intercept the keys as real physical PC key chords (with `ACTION_DOWN` on modifier keys before the target key and `ACTION_UP` afterward, accompanied by `FLAG_SOFT_KEYBOARD` and `KeyCharacterMap.VIRTUAL_KEYBOARD`) rather than unhandled text insertions or naked meta flags.

In addition, `sendBackspace` includes an automatic fallback for remote desktop applications (which return null/empty for `getTextBeforeCursor`), ensuring low-level `KEYCODE_DEL` events are consistently dispatched to remote computers.
