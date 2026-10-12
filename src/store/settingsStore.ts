import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeName = 'system' | 'dark' | 'light' | 'nord' | 'cyberpunk' | 'midnight' | 'sunset' | 'custom' | string;

/**
 * Theme stored as 'system' follows the device's dark/light mode. Everything
 * that renders colors resolves it through resolveIsDark() — the keyboard
 * bundle's useKeyboardTheme and the app's useAppColors share this helper so
 * both processes always agree on the resolved palette.
 */
export function resolveIsDark(theme: ThemeName, systemIsDark: boolean): boolean {
  if (theme === 'system') return systemIsDark;
  if (theme === 'nord') return true;
  return theme === 'dark';
}
/**
 * Every selectable cursor. Kept as a runtime array (not only a type) so a value
 * restored from AsyncStorage can be validated — names were renamed from short
 * ones ('classic', 'bubble', …) to asset names, so old persisted states would
 * otherwise reference a cursor that no longer exists.
 */
export const CURSOR_TYPES = [
  // Pointers
  'cursor-alt-thick-pointer',
  'cursor-pointer-classic',
  'cursor-pointer-nested',
  'cursor-pointer-small',
  'cursor-pointer-standard',
  'cursor-simple-triangle',
  'pointer-cursor-detailed',
  'pointer-cursor-settings',
  'pointer-hand-cursor',
  // Hands
  'hand-click-cursor',
  'hand-grab-closed',
  'hand-grab-cursor',
  'hand-open-fingers',
  'hand-open-palm',
  'hand-pointing-index',
  // Click Effects
  'cursor-click-burst-fill',
  'cursor-click-crosshair',
  'cursor-click-lines',
  'cursor-click-sparkle-crosshair',
  'cursor-click-sparkle-dots',
  'cursor-click-target-corners',
  // Text & Edit
  'cursor-edit-pencil',
  'edit-pen-cursor-filled',
  'edit-pen-cursor-outline',
  'pencil-edit-cursor',
  'text-cursor-i-beam-round',
  'text-cursor-i-beam-serif',
  // Movement
  'cursor-move-diagonal-down',
  'drag-drop-arrows',
  'move-arrows-4way',
  'move-arrows-cross',
  'move-arrows-cross-circle',
  'move-arrows-horizontal',
  'move-arrows-large',
  // Scroll
  'cursor-arrow-scroll-wheel',
  'cursor-arrow-scroll-wheel-gray',
  'scroll-arrows-4way',
  'scroll-arrows-down',
  'scroll-arrows-horizontal',
  'scroll-arrows-vertical',
  'scroll-arrows-vertical-outline',
  // Special
  'cursor-diagonal-line',
  'cursor-gps-location',
  'cursor-pixel-block',
  'cursor-plus-add',
  'cursor-plus-cross',
  'cursor-rays-light',
  'keyboard-arrows-icon',
  'magic-wand-sparkle',
] as const;

export type CursorType = (typeof CURSOR_TYPES)[number];

/**
 * Colour of a freshly installed cursor (the app accent, and the same value
 * QyKeyModule.kt falls back to when the pref is unset). Exported so the
 * settings palette can include it: a default that is not one of the palette
 * swatches would leave a new install with no colour shown as selected.
 */
export const DEFAULT_CURSOR_COLOR = '#8594aa';

export interface ThemeColors {
  keyboardBg: string;
  keyBg: string;
  keyText: string;
  specialKeyBg: string;
  specialKeyText: string;
  themePrimary: string;
}

interface SettingsState {
  // Onboarding
  hasCompletedOnboarding: boolean;
  setOnboardingComplete: (done: boolean) => void;

  // Language
  language: 'en' | 'bn';
  setLanguage: (lang: 'en' | 'bn') => void;

  // Theme
  theme: ThemeName;
  themeColors: ThemeColors;
  setTheme: (theme: ThemeName) => void;
  setThemeColors: (colors: Partial<ThemeColors>) => void;

  // Layout
  keyHeight: number;
  keyBorderRadius: number;
  fontSize: number;
  keyMargin: number;
  setKeyHeight: (v: number) => void;
  setKeyBorderRadius: (v: number) => void;
  setFontSize: (v: number) => void;

  // Cursor
  cursorType: CursorType;
  cursorColor: string;
  cursorSize: number;
  setCursorType: (type: CursorType) => void;
  setCursorColor: (color: string) => void;
  setCursorSize: (size: number) => void;

  // Feedback
  hapticEnabled: boolean;
  soundEnabled: boolean;
  toggleHaptic: () => void;
  toggleSound: () => void;

  // Input behavior
  autoCorrect: boolean;
  showSuggestions: boolean;
  toggleAutoCorrect: () => void;
  toggleShowSuggestions: () => void;

  // Custom dictionary (per-language)
  customWordsEn: string[];
  customWordsBn: string[];
  addCustomWord: (word: string, lang: 'en' | 'bn') => void;
  removeCustomWord: (word: string, lang: 'en' | 'bn') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      setOnboardingComplete: (done) => set({ hasCompletedOnboarding: done }),

      language: 'en',
      setLanguage: (language) => set({ language }),

      theme: 'system',
      themeColors: {
        keyboardBg:     '#e0e5ec',
        keyBg:          '#f2f2f2',
        keyText:        '#444444',
        specialKeyBg:   '#c8ccd0',
        specialKeyText: '#444444',
        themePrimary:   '#8594aa',
      },
      setTheme: (theme) => set({ theme }),
      setThemeColors: (colors) =>
        set((s) => ({ themeColors: { ...s.themeColors, ...colors } })),

      keyHeight: 26,
      keyBorderRadius: 8,
      fontSize: 14,
      keyMargin: 3,
      setKeyHeight: (keyHeight) => set({ keyHeight }),
      setKeyBorderRadius: (keyBorderRadius) => set({ keyBorderRadius }),
      setFontSize: (fontSize) => set({ fontSize }),

      cursorType: 'cursor-pointer-classic',
      cursorColor: DEFAULT_CURSOR_COLOR,
      cursorSize: 24,
      setCursorType: (cursorType) => set({ cursorType }),
      setCursorColor: (cursorColor) => set({ cursorColor }),
      setCursorSize: (cursorSize) => set({ cursorSize }),

      hapticEnabled: true,
      soundEnabled: false,
      toggleHaptic: () => set((s) => ({ hapticEnabled: !s.hapticEnabled })),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      autoCorrect: true,
      showSuggestions: true,
      toggleAutoCorrect: () => set((s) => ({ autoCorrect: !s.autoCorrect })),
      toggleShowSuggestions: () => set((s) => ({ showSuggestions: !s.showSuggestions })),

      customWordsEn: [],
      customWordsBn: [],
      addCustomWord: (word, lang) =>
        set((s) => {
          const key = lang === 'bn' ? 'customWordsBn' : 'customWordsEn';
          const list = Array.isArray(s[key]) ? s[key] : [];
          return { [key]: [...new Set([...list, word.trim().toLowerCase()])] };
        }),
      removeCustomWord: (word, lang) =>
        set((s) => {
          const key = lang === 'bn' ? 'customWordsBn' : 'customWordsEn';
          const list = Array.isArray(s[key]) ? s[key] : [];
          return { [key]: list.filter((w) => w !== word) };
        }),
    }),
    {
      name: 'qykey-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 6,
      migrate: (persisted) => {
        const state = persisted as Record<string, any> | undefined;
        if (!state) return persisted;
        // v0 → v1: 'amoled' preset removed
        if (state.theme === 'amoled') {
          state.theme = 'dark' as ThemeName;
        }
        // v2 → v3: cursor names changed to match their SVG assets, so any value
        // that is no longer known (e.g. the old 'classic') falls back to default.
        if (
          typeof state.cursorType !== 'string' ||
          !(CURSOR_TYPES as readonly string[]).includes(state.cursorType)
        ) {
          state.cursorType = 'cursor-pointer-classic' as CursorType;
        }
        // v1 → v2: split flat customWords into per-language arrays
        if (Array.isArray(state.customWords)) {
          const en: string[] = [];
          const bn: string[] = [];
          for (const w of state.customWords) {
            if (typeof w === 'string' && /\p{Script=Bengali}/u.test(w)) {
              bn.push(w);
            } else {
              en.push(w);
            }
          }
          state.customWordsEn = en;
          state.customWordsBn = bn;
          delete state.customWords;
        }
        // v3 → v4: reset theme and language to intended defaults.
        // On Android, AsyncStorage data survives a reinstall, so old persisted
        // values (e.g. 'nord' theme, 'bn' language) override the code defaults.
        // This one-time migration corrects that; subsequent user changes persist
        // normally.
        state.theme = 'system';
        state.language = 'en';

        // v5 → v6: reset keyHeight, keyBorderRadius, and fontSize to initial selected values.
        state.keyHeight = 26;
        state.keyBorderRadius = 8;
        state.fontSize = 14;
        return state;
      },
    }
  )
);
