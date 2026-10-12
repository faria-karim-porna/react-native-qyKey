# QyKey — Recommended Folder Structure

An analysis of the current layout, what's messy about it, and a concrete target
structure with a step-by-step migration plan.

---

## 1. Current state (what's messy)

```
.
├── app/                  # Companion app screens (Expo Router)
├── components/           # 6 shared UI components (flat)
├── constants/            # Themes + translations
├── hooks/                # 5 app-side hooks
├── store/                # 1 Zustand store
├── src/                  # Contains ONLY src/keyboard/ ← inconsistent!
│   └── keyboard/
├── modules/qykey-module/
├── native-files/         # Kotlin IME sources copied by config plugins
├── plugins/              # Expo config plugins
├── scripts/              # Build + dictionary tooling
├── assets/
├── keyboard.index.js     # Keyboard bundle entry (root)
└── <8 markdown files>    # AGENTS, CLAUDE, FAQ, ISSUE-*, ReadMe, knowledge, privacy-policy, todo
```

### Problems

| # | Issue | Detail |
|---|-------|--------|
| 1 | **Half the app code is outside `src/`** | `app/`, `components/`, `constants/`, `hooks/`, `store/` sit at the root while `src/` holds only the keyboard. Two "roots" for source code — nobody can tell at a glance what is app code vs. config. |
| 2 | **Root directory clutter** | 8 markdown files + `keyboard.index.js` + 6 config files + 10 source dirs at the root. |
| 3 | **Junk is committed to git** | `bash.exe.stackdump`, `eas_full_log.jsonl`, `scripts/__pycache__/*.pyc` are tracked (166 tracked files). |
| 4 | **`native-files/` is a vague name** | It holds Kotlin sources, res XML, and proguard rules that config plugins copy into `android/` — the name doesn't say that, and it collides conceptually with the Kotlin inside `modules/qykey-module/android/`. |
| 5 | **Duplicate native code** | `QyKeyModule.kt` and `QyKeyPackage.kt` exist in **both** `native-files/java/com/qykey/` and `modules/qykey-module/android/src/main/java/com/qykey/`. `withImeService.js` copies only from `native-files/`, so the `modules/` copies look like dead duplicates. Keep one source of truth. |
| 6 | **Deep relative imports everywhere** | `../../store/settingsStore`, `../../components/ToggleRow`, `../../assets/svg/...` — every file move breaks dozens of imports. |
| 7 | **Duplicated hermesc logic (bonus)** | `resolveHermesc()` is implemented twice: `scripts/build-keyboard-bundle.js` (which already exports it) and `plugins/withKeyboardBundle.js` (which re-implements it). |

---

## 2. Target structure

```
qykey/
├── app.json                  # Expo config (stays — referenced by CLI/EAS)
├── eas.json
├── package.json
├── tsconfig.json             # + path aliases (see §4)
├── babel.config.js
├── metro.config.js
├── keyboard.index.js         # Keyboard bundle entry — STAYS at root (see §5)
│
├── README.md                 # Root-level docs that tools/humans expect here
├── LICENSE
├── AGENTS.md                 # Agent instructions (root convention)
├── CLAUDE.md
├── docs/architecture.md      # Freebuff project-knowledge doc (moved to docs/)
│
├── assets/                   # STAYS — referenced by app.json + config plugins
│   ├── dictionaries/         #   .txt sources + compiled .bin tries
│   ├── fonts/
│   ├── svg/
│   └── *.png                 # icons / splash
│
├── docs/                     # ✨ NEW — everything non-essential moves here
│   ├── FAQ.md
│   ├── issue-keyboard-keys-not-showing.md
│   ├── privacy-policy.md
│   └── todo.md
│
├── modules/                  # STAYS at root (Expo local-module convention)
│   └── qykey-module/
│       ├── index.ts          # TS bridge (only copy of the Kotlin — see §3.5)
│       └── android/…         # ← DELETE duplicated QyKeyModule/Package here
│
├── native/                   # ✨ RENAMED from native-files/ (Kotlin + res for plugins to copy)
│   ├── java/com/qykey/*.kt
│   ├── res/xml/*.xml
│   └── proguard-rules.pro
│
├── plugins/                  # STAYS — referenced by app.json as ./plugins/*
│   ├── withImeService.js
│   ├── withKeyboardBundle.js
│   └── withAccessibilityService.js
│
├── scripts/                  # STAYS
│   ├── build-keyboard-bundle.js
│   ├── compile_dictionaries.py
│   └── expand_dictionary.py
│
└── src/                      # ✨ ALL app source code lives here now
    ├── app/                  # moved from app/ — Expo Router reads src/app natively
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── (tabs)/
    │   │   ├── _layout.tsx
    │   │   ├── index.tsx     # Home
    │   │   ├── settings.tsx
    │   │   ├── themes.tsx
    │   │   ├── language.tsx
    │   │   └── dictionary.tsx
    │   └── onboarding/
    │       ├── _layout.tsx
    │       └── step1…step4.tsx
    │
    ├── components/           # moved from components/
    ├── constants/            # moved from constants/
    ├── hooks/                # moved from hooks/
    ├── store/                # moved from store/
    │
    └── keyboard/             # unchanged (already well organized)
        ├── KeyboardScreen.tsx
        ├── ErrorBoundary.tsx
        ├── hooks/            # useKeyboardState, useKeyboardTheme
        ├── data/             # soundManager
        ├── keyboard/         # keyboard UI (Keyboard.tsx orchestrator + key components)
        ├── touchpad/         # Touchpad (mouse-mode surface) + PointerRoot
        ├── FloatingPanel.tsx # FloatingPanel (accessibility surface)
        ├── Key.tsx           # "Chocolate bar" key component
        └── ../circuit/       # Animated circuit board behind the keys
```

### Why `src/app` works

Expo Router officially supports `src/app`: when both exist, `src/app` takes
precedence (https://docs.expo.dev/router/reference/src-directory/). No config
change is needed — just move the folder and **delete the old root `app/`**
(so the two never silently diverge).

---

## 3. Key changes, with the exact references to update

### 3.1 Consolidate app code under `src/`
Move `app/ → src/app`, `components/ → src/components`, `constants/ → src/constants`,
`hooks/ → src/hooks`, `store/ → src/store`.

### 3.2 Add import aliases (stops the `../../` pain)
Expo SDK 57's Metro resolves `tsconfig.json` paths out of the box
(https://docs.expo.dev/guides/typescript/). In `tsconfig.json`:

```jsonc
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@assets/*": ["./assets/*"]
    }
  }
}
```

Then `app/(tabs)/settings.tsx`'s `require('../../assets/svg/cursor-x.svg')`
becomes `require('@assets/svg/cursor-x.svg')`, and
`'../../store/settingsStore'` becomes `'@/store/settingsStore'`.

> ⚠️ The keyboard bundle isolation rule still applies: code in `src/app/mainKeyboard/`
> must import **only** from `src/app/mainKeyboard/`, `src/hooks/`, `src/store/`,
> `src/data/` (plus `react-native`/npm deps).
> An easy convention: keyboard files use relative imports only, so any `@/`
> import appearing under `src/app/mainKeyboard/` is a red flag.

### 3.3 Move non-essential docs to `docs/`
`FAQ.md`, `ISSUE-keyboard-keys-not-showing.md`, `todo.md`, `privacy-policy.md`
→ `docs/`. Keep `README.md`, `LICENSE`, `AGENTS.md`, `CLAUDE.md`
at the root (tooling expects them there).

### 3.4 Rename `native-files/` → `native/`
Two references to update:
- `plugins/withImeService.js` — `path.join(projectRoot, 'native-files')`
- `plugins/withAccessibilityService.js` — `path.join(projectRoot, 'native-files', 'res', 'xml', …)`
- plus the path mentions in `docs/architecture.md` / `README.md`.

### 3.5 Delete the duplicate Kotlin files
`QyKeyModule.kt` / `QyKeyPackage.kt` exist in both `native-files/java/com/qykey/`
and `modules/qykey-module/android/src/main/java/com/qykey/`. The config plugin
copies from `native-files/` only, so the `modules/qykey-module/android/` copies
appear to be dead. Verify, then keep **one** location as the single source of truth
and delete the other.

### 3.6 Git hygiene
Add to `.gitignore`:

```gitignore
# python
__pycache__/
*.pyc

# editor / os junk
*.stackdump

# local build logs
eas_full_log.jsonl
eas_*.log
```

And untrack the committed junk:

```sh
git rm --cached bash.exe.stackdump eas_full_log.jsonl scripts/__pycache__/compile_dictionaries.cpython-311.pyc
```

### 3.7 De-duplicate `resolveHermesc()` (optional)
`plugins/withKeyboardBundle.js` can `require('../scripts/build-keyboard-bundle.js')`
and use its exported `resolveHermesc()` instead of its own copy.

---

## 4. What deliberately stays at the root

| Path | Why it stays |
|------|--------------|
| `app.json`, `eas.json`, `package.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js` | Expo/EAS/CLI look for them here. |
| `keyboard.index.js` | Entry contract for the keyboard bundle — referenced by `scripts/build-keyboard-bundle.js`, `plugins/withKeyboardBundle.js` (twice) **and** the Gradle task injected into `android/app/build.gradle`. Moving it means touching 3+ files; not worth it. |
| `assets/` | `app.json` icon paths + `withImeService.js`/`withKeyboardBundle.js`/Python scripts reference these exact subpaths. |
| `modules/` | Expo local-module convention. |
| `plugins/` | `app.json` lists them as `./plugins/…`. |
| `scripts/` | `package.json` script + injected Gradle task reference them. |
| `README.md`, `LICENSE`, `AGENTS.md`, `CLAUDE.md` | Root conventions for GitHub and coding agents. (`docs/architecture.md` also lives in `docs/`.) |
| `android/` | Generated by prebuild, already gitignored. Never commit it. |

---

## 5. Migration checklist

Run from the project root (each `git mv` preserves history):

```sh
# 1. App code → src/
mkdir src
git mv app src/app
git mv components src/components
git mv constants src/constants
git mv hooks src/hooks
git mv store src/store

# 2. Docs
mkdir docs
git mv FAQ.md docs/FAQ.md
git mv ISSUE-keyboard-keys-not-showing.md docs/issue-keyboard-keys-not-showing.md
git mv todo.md docs/todo.md   # (already applied — root todo.md merged & removed)
git mv privacy-policy.md docs/privacy-policy.md

# 3. Native sources rename
git mv native-files native

# 4. Update the 2 config-plugin path constants (§3.4)
# 5. Add tsconfig paths (§3.2) and codemod imports ../../x → @/x
# 6. Delete duplicate QyKeyModule/QyKeyPackage (§3.5)
# 7. Update .gitignore + untrack junk (§3.6)
# 8. Update the structure section in docs/architecture.md
```

Then verify:

```sh
npx tsc --noEmit            # 0 errors (strict mode)
npm run build:keyboard      # keyboard bundle still compiles to Hermes bytecode
npx expo prebuild --clean   # plugins still find native/ + assets/
npm run android             # companion app + keyboard boot on device
```

---

## 6. Net result

- **One rule**: "app code lives in `src/`, everything the Expo toolchain references by path stays at the root."
- Root goes from ~20 entries to ~15, all self-explanatory.
- Imports become grep-able (`@/store/…` vs `../../store/…`).
- Docs are out of the way, native sources have a name that describes them, and the git history stops carrying stack dumps and build logs.
