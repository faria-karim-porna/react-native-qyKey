# QyKey Keyboard — Phase 4 (Suggestions & Autocorrect)

React Native + Expo SDK 57 Android custom keyboard app.

**Phase 1:** Expo project, dual ReactHost, IME service in `:ime_process`, placeholder keyboard.

**Phase 2:** Real QWERTY keys, shift/caps state machine, symbols panel, alt chars popup, haptic feedback, backspace long-press repeat.

**Phase 3:** Avro-style phonetic Bangla input engine with longest-match greedy algorithm & buffer management, KeyboardHeader, Bangla QWERTY overlay layout.

**Phase 4 (new):** Binary Trie (prefix + Levenshtein fuzzy search) with Python compiler script (~17KB english, ~13KB bangla .bin files). `SuggestionEngine` orchestrates Trie + user model with 50ms debounce on background thread — emits `onSuggestionsUpdated` events to RN. `commitSpace` auto-corrects top suggestion; tappable chips via `commitSuggestion` with UserWordModel frequency boosting. Password field suppression. `sendEnter` clears suggestions. Thread-safe emission on main thread. TypeScript 0 errors. keyboard.bundle ~911 KB.

**Phase 5 (Companion App):** Expo Router navigation (app/) replacing App.tsx. 3-step onboarding wizard (enable → set default → done) with auto-advance polling. 5-tab layout: Home (live setup status + try-it text field), Settings (haptic/sound/autocorrect toggles), Themes (Dark/Light/AMOLED presets + key height/radius/font sliders), Language (English/Bangla selector), Dictionary (custom word list editor). Zustand store with AsyncStorage persistence. useSettingsSync writes Zustand → SharedPreferences with 300ms debounce. QyKeyModule.kt gains setDictionaryWords/getDictionaryWords/removeDictionaryWord. TypeScript 0 errors.

**Phase 6 (Emoji & Clipboard):** EmojiPanel with 8 category tabs + recent-emoji tray (MRU 30, persisted via SharedPreferences). ClipboardPanel with tap-to-paste, long-press-to-remove, and Clear All. ClipboardHandler.kt captures system clipboard during onStartInputView() (the sole Android-sanctioned moment on 10+). Password fields skip clipboard capture. BottomRow gains 📋 clipboard button. 5 new native functions (getClipboardHistory, clearClipboardHistory, removeClipboardItem, getRecentEmojis, recordEmojiUsed). TypeScript 0 errors.

**Phase 7 (Polish & Performance):** Animated scale press (0.88×, 80ms) on all keys. React.memo comparators fixed with callback deps in Key/KeyRow/SuggestionBar. Input-type adaptation — password fields hide suggestions, number fields show 3×4 number pad, phone fields show dial pad. Dynamic Enter key label (🔍search, ➤send, ✓done, →next). Sound feedback via AudioManager.playSoundEffect(). Memory-mapped Trie loading via MappedByteBuffer (~2–4MB heap savings). Enhanced onInputStarted event with full EditorInfo. TypeScript 0 errors.

**Phase 8 (Testing & Release):** Unit test suite for all Kotlin engines — TrieTest (9 tests, prefix search with in-memory binary builder), UserWordModelTest (10 tests with MockK), ClipboardHandlerTest (15 tests with MockK), BanglaInputEngineTest extended (15+ edge-case tests). build.gradle updated with JUnit 5, MockK, JaCoCo coverage. Privacy policy (privacy-policy.md) drafted for Play Store compliance. TypeScript 0 errors.

**Build:** `python3 scripts/compile_dictionaries.py && eas build --platform android --profile development`
