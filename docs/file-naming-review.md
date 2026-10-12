# File Naming Review — Suggested Renames

A pass over every source file in the repo, checking two things:

1. **Convention violations** — files that don't follow the naming pattern the rest of the app uses.
2. **Confusing wording** — names a fresh developer would misread or have to reverse-engineer.

Each suggestion lists the exact import sites that must be updated, so renames can be done safely.

---

## Conventions already used in this repo

(These are the baseline the suggestions are measured against.)

| Kind | Convention | Examples |
|---|---|---|
| React components | `PascalCase.tsx` | `Key.tsx`, `ThemeCard.tsx`, `ToggleRow.tsx`, `EmojiBoard.tsx`, `MicrophoneIcon.tsx` |
| Hooks | `useXxx.ts` (camelCase) | `useSetupStatus.ts`, `useAppColors.ts`, `useKickKeyBridge.ts` |
| Utilities / data / constants | camelCase | `translations.ts`, `soundManager.ts`, `emojiData.ts` |
| Expo Router routes | lowercase, framework-managed | `index.tsx`, `step1-enable.tsx`, `_layout.tsx` |
| Fixed contract names | must not change | `keyboard.index.js` (referenced by Gradle, build script, and 2 config plugins), `_layout.tsx` |

---

## 1. Recommended renames — convention violations

### `src/constants/Themes.ts` → **`src/constants/themePresets.ts`**

- It is a constants file (exports `LIGHT_PRESET`, `NORD_PRESET`, `THEME_PRESETS`), but it is the only PascalCase constants file in the repo. Its sibling `translations.ts` is camelCase — the two sit in the same folder with different conventions.
- "Themes" also over-promises: the file only contains *presets*. The actual theme logic lives in `settingsStore.ts` / `useKeyboardTheme.ts`.
- **Update imports in:** `src/app/mainApp/(tabs)/themes.tsx`, `src/app/mainApp/ThemeCard.tsx` (both use `@/constants/Themes`).

### `src/app/mainKeyboard/keyboard/icons.tsx` → **`src/app/mainKeyboard/keyboard/KeyIcons.tsx`**

- Exports React components (`FA5Icon`, `MDIIcon`) but is named in lowercase plural — every other component file in the repo is PascalCase (see `MicrophoneIcon.tsx`, `OnboardingIcons.tsx`).
- "icons" is also very generic; these are specifically the SVG key glyphs drawn because icon fonts can't load in the IME process.
- **Update imports in:** `QykeyKeyboard.tsx` is unaffected; `Touchpad.tsx` (`../keyboard/icons`), `SymbolKeys.tsx`, `SymbolKeysMore.tsx`, `EmojiBoard.tsx`, `MainKeys.tsx`, `KeyboardSlider.tsx`.

### `ReadMe.md` → **`README.md`**

- Standard casing GitHub and every tooling template expect. Trivial fix, no imports.

---

## 2. Recommended renames — confusing wording for a fresher

### `src/app/mainKeyboard/keyboard/QykeyKeyboard.tsx` → **`KickKeyKeyboard.tsx`**

- "Qykey" is the name of the *reference project this code was ported from*. A new developer has no way to know that; the name looks like a typo of the app's own name (KickKey).
- The component is registered natively as `KickKeyKeyboard` in `keyboard.index.js` (`AppRegistry.registerComponent('KickKeyKeyboard', ...)`), so this rename aligns the file name with the contract native code already uses.
- Part of the rename: `QykeyKeyboardState` in `src/hooks/useKeyboardState.ts` → `KeyboardState`.
- **Update imports in:** `KeyboardScreen.tsx`, `FloatingPanel.tsx`, `Key.tsx` (type `AppLanguage`), `MainKeys.tsx` (type), `KeyboardTopKeys.tsx` (type), `src/hooks/useKeyboardState.ts` (type).
- Comments (not code) also mention the old name in `native/java/com/kickkey/KickKeyModule.kt` and `modules/kickkey-module/index.ts`.
- The "ported from qykey" history stays valuable — keep it in the header comment, not the file name.

### `src/app/mainKeyboard/keyboard/SymbolKeysMore.tsx` → **`SystemKeys.tsx`**

- Three-way mismatch today: the **file** is `SymbolKeysMore`, the **component** inside is `SystemKeysMore`, and the import in `QykeyKeyboard.tsx` is `import SystemKeysMore from './SymbolKeysMore'`. Nothing matches, and "Symbol…More" suggests "more symbols" when the page actually shows *system keys* (Esc, F-keys, arrows…).
- Renaming file + component + props type (`SystemKeysMoreProps` → `SystemKeysProps`) to the same name makes the symbol page (`SymbolKeys.tsx`) and system page visually and conceptually distinct.
- **Update imports in:** `QykeyKeyboard.tsx` (one import + JSX usage).

### `src/app/mainKeyboard/keyboard/KeyboardSlider.tsx` → **`ModeToggleBar.tsx`**

- Misleading: it is **not** a value slider (no SeekBar/number). It is the small bar that toggles the keyboard between **keyboard mode ⇄ touchpad mode**. A fresher will look for slider logic that isn't there.
- Its prop `sliderHandler` should follow: → `onToggleMode` (the `toggleMode` prop can stay).
- **Update imports/props in:** `QykeyKeyboard.tsx`.

### `src/app/mainKeyboard/keyboard/KeyboardTopKeys.tsx` → **`TopStrip.tsx`**

- "TopKeys" says *where* but not *what*. This component is the strip above the main keys: native **suggestions**, the **emoji toggle**, **SYM**, and the **mic key**.
- `TopStrip` keeps the position hint and drops the ambiguity. (`SuggestionStrip.tsx` also works but under-describes the emoji/SYM/mic keys.)
- **Update imports in:** `QykeyKeyboard.tsx`.

---

## 3. Dead / clutter files — delete or consolidate

| File | Problem | Action |
|---|---|---|
| `src/app/mainKeyboard/keyboard/styles.ts` | **Dead code.** Zero imports anywhere; its own sibling `dynamicStyles.ts` header says "Replaces the static styles.ts". A fresher editing the keyboard will inevitably edit the wrong one. | Delete (keep `dynamicStyles.ts`). |
| `todo.md` (root) | Near-duplicate of `docs/todo.md` with a newer APK link and status line. Two todo files that drift apart is worse than either name. | Merge root copy into `docs/todo.md` (root is newer), delete root copy. |
| `bash.exe.stackdump` (root) | Windows shell crash dump, accidentally committed. | Delete; add `*.stackdump` to `.gitignore`. |
| `eas_full_log.jsonl` (root) | Committed EAS build log at repo root. | Move out of the repo or gitignore (`*.jsonl` / `eas_full_log.jsonl`). |

---

## 4. Optional — wording that could be clearer

Lower priority; fine to keep if the team prefers stability.

| Current | Suggested | Why |
|---|---|---|
| `knowledge.md` (root) | `docs/architecture.md` | "knowledge" doesn't say what's inside; it is the architecture/onboarding doc. Also consolidates markdown into `docs/`. |
| `FOLDER_STRUCTURE.md` (root) | `docs/folder-structure.md` | Same consolidation argument. |
| `MainKeys.tsx` | `LetterKeys.tsx` | "Main" is vague about content (letter rows + space/backspace row), but the name is at least not *wrong*. |
| `PointerRoot.tsx` | `PointerOverlayRoot.tsx` | "Root" can be misread as an Expo Router root. **Caveat:** the name mirrors native `PointerOverlay.kt`, so renaming only the JS file breaks that symmetry — probably keep. |
| `KeyboardTabBar.tsx` | `AppTabBar.tsx` | Read in isolation, "Keyboard Tab Bar" sounds like a tab bar *with keyboard shortcuts*; it is really the companion app's custom tab bar. |

**Note on `PointerRoot.tsx` wording for freshers (no rename needed):** "Pointer" here means the system-wide *mouse cursor overlay*, and "Root" means *root component of a separately-registered React surface* (`KickKeyPointer` in `keyboard.index.js`) — not a router root.

---

## 5. Type-export placement (style note)

`AppLanguage` is exported from `QykeyKeyboard.tsx` and re-imported as a type by `Key.tsx`, `MainKeys.tsx`, `KeyboardTopKeys.tsx`, and `src/hooks/useKeyboardState.ts`. Types living inside a big component file make the dependency graph look circular-ish. Consider moving `AppLanguage` into a small `types.ts` (e.g. `src/app/mainKeyboard/keyboard/types.ts`) — this pairs well with the `KickKeyKeyboard.tsx` rename above.

---

## 6. Reviewed and considered fine

For completeness — these were checked and intentionally **not** flagged:

- **Hooks** (`src/hooks/*`) — all follow `useXxx` correctly. `useAppColors` (main app palette) vs `useKeyboardTheme` (IME-process palette) are two similarly named but deliberately separate hooks because they run in different processes; worth a comment, not a rename.
- **Routes** — `(tabs)/index.tsx`, `step1-enable.tsx` … `step4-done.tsx`: Expo Router filename-as-route convention; the `stepN-<action>` names are self-documenting.
- `KeyboardScreen.tsx`, `ErrorBoundary.tsx`, `FloatingPanel.tsx`, `Touchpad.tsx`, `Key.tsx`, `MicrophoneIcon.tsx` — clear and conventional.
- `src/app/circuit/*` (`Cell.ts`, `Wire.ts`, `config.ts`, `PathWithAnimation.tsx`) — folder-scoped names are fine.
- `soundManager.ts`, `settingsStore.ts`, `emojiData.ts`, `speechRecognition.ts`, `dynamicStyles.ts` — camelCase utilities, correctly named.
- `plugins/with*.js` — follows Expo config-plugin naming convention.
- `keyboard.index.js` at root — unusual but a **documented build contract** (Gradle + 2 plugins + build script reference it); `FOLDER_STRUCTURE.md` §5 already records why it stays.

---

## 7. Applying the renames safely

1. Do source renames one at a time, updating the import sites listed above (keyboard-bundle files use **relative imports only** — plain Metro, no `@/` alias).
2. Run `npx tsc --noEmit` after each rename.
3. Rename inside the keyboard bundle ⇒ rebuild it: `npm run build:keyboard` (Metro resolves paths at bundle time, so a stale `keyboard.bundle` would keep the old structure alive).
4. Update the prose docs that describe the layout: `FOLDER_STRUCTURE.md`, `knowledge.md`, and the header comments that mention old file names.
