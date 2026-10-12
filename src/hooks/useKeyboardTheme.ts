// ============================================================
// useKeyboardTheme.ts — reads theme colors + layout prefs from
// SharedPreferences in the IME process (separate from the
// main app's Zustand store).
//
// Theme model:
//   'system' → follow the device's dark/light mode (default).
//              The stored preset colors are IGNORED; the palette
//              is resolved from Appearance at render time, so the
//              keyboard adapts live when the OS theme changes.
//   preset   → use the colors pushed from the Themes tab.
//
// The keyboard's dynamic styles are created by createStyles(colors)
// so the keyboard adapts to light/dark themes instantly.
// keyHeight, keyBorderRadius, fontSize come from the Settings screen
// sliders and are pushed via useSettingsSync.
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { Appearance, NativeModules, NativeEventEmitter } from 'react-native';
import { useSettingsStore, resolveIsDark } from '../store/settingsStore';

export interface KeyboardThemeColors {
  keyboardBg: string;
  keyBg: string;
  keyText: string;
  specialKeyBg: string;
  specialKeyText: string;
  themePrimary: string;
  // Layout (from Settings sliders)
  keyHeight: number;
  keyBorderRadius: number;
  fontSize: number;
  // Bottom navigation-bar inset (dp) the host window reports. 0 = nothing
  // overlaps the keyboard. Used to lift the last key row above the system
  // navigation bar (Android 15+ draws it over the IME; FLAG_LAYOUT_IN_SCREEN
  // panel windows extend behind it on every version).
  navBarBottomInset: number;
}

const LIGHT_COLORS: KeyboardThemeColors = {
  keyboardBg:   '#e0e5ec',
  keyBg:        '#f2f2f2',
  keyText:      '#444444',
  specialKeyBg: '#c8ccd0',
  specialKeyText: '#444444',
  themePrimary: '#8594aa',
  keyHeight: 26,
  keyBorderRadius: 8,
  fontSize: 14,
  navBarBottomInset: 0,
};

// Keep in sync with NORD_PRESET in assets/styles/themePresets.ts.
const DARK_COLORS: KeyboardThemeColors = {
  keyboardBg:   '#2e3440',
  keyBg:        '#3b4252',
  keyText:      '#eceff4',
  specialKeyBg: '#434c5e',
  specialKeyText: '#88c0d0',
  themePrimary: '#81a1c1',
  keyHeight: 26,
  keyBorderRadius: 8,
  fontSize: 14,
  navBarBottomInset: 0,
};

let _QyKey: any = null;
function getQyKey() {
  if (!_QyKey) _QyKey = NativeModules.QyKey;
  return _QyKey;
}

/** Device dark/light at this instant. */
function systemIsDarkNow(): boolean {
  try {
    return Appearance.getColorScheme() === 'dark';
  } catch {
    return false;
  }
}

export function useKeyboardTheme(): KeyboardThemeColors {
  const storeThemeColors = useSettingsStore((s) => s.themeColors);
  const storeTheme = useSettingsStore((s) => s.theme);
  const storeKeyHeight = useSettingsStore((s) => s.keyHeight);
  const storeKeyBorderRadius = useSettingsStore((s) => s.keyBorderRadius);
  const storeFontSize = useSettingsStore((s) => s.fontSize);

  // Re-render when the OS theme flips so 'system' tracks it live.
  const [systemIsDark, setSystemIsDark] = useState(systemIsDarkNow);
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => setSystemIsDark(systemIsDarkNow()));
    return () => sub.remove();
  }, []);

  // The palette the 'system' theme resolves to right now.
  const systemPalette = systemIsDark ? DARK_COLORS : LIGHT_COLORS;

  // Initial state: explicit preset → stored colors; 'system' → resolved palette.
  const [colors, setColors] = useState<KeyboardThemeColors>(() => {
    const isDark = resolveIsDark(storeTheme, systemIsDarkNow());
    const fallback = isDark ? DARK_COLORS : LIGHT_COLORS;
    const useStored = storeTheme !== 'system' && storeThemeColors?.keyboardBg;
    return {
      keyboardBg:     useStored ? storeThemeColors.keyboardBg     : fallback.keyboardBg,
      keyBg:          useStored ? storeThemeColors.keyBg          : fallback.keyBg,
      keyText:        useStored ? storeThemeColors.keyText        : fallback.keyText,
      specialKeyBg:   useStored ? storeThemeColors.specialKeyBg   : fallback.specialKeyBg,
      specialKeyText: useStored ? storeThemeColors.specialKeyText : fallback.specialKeyText,
      themePrimary:   useStored ? storeThemeColors.themePrimary   : fallback.themePrimary,
      keyHeight: storeKeyHeight ?? fallback.keyHeight,
      keyBorderRadius: storeKeyBorderRadius ?? fallback.keyBorderRadius,
      fontSize: storeFontSize ?? fallback.fontSize,
      navBarBottomInset: 0,
    };
  });

  // Sync state whenever Zustand settings store updates (in-app)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const isDark = resolveIsDark(storeTheme, systemIsDark);
    const fallback = isDark ? DARK_COLORS : LIGHT_COLORS;
    const useStored = storeTheme !== 'system' && storeThemeColors?.keyboardBg;
    setColors({
      keyboardBg:     useStored ? storeThemeColors.keyboardBg     : fallback.keyboardBg,
      keyBg:          useStored ? storeThemeColors.keyBg          : fallback.keyBg,
      keyText:        useStored ? storeThemeColors.keyText        : fallback.keyText,
      specialKeyBg:   useStored ? storeThemeColors.specialKeyBg   : fallback.specialKeyBg,
      specialKeyText: useStored ? storeThemeColors.specialKeyText : fallback.specialKeyText,
      themePrimary:   useStored ? storeThemeColors.themePrimary   : fallback.themePrimary,
      keyHeight: storeKeyHeight ?? fallback.keyHeight,
      keyBorderRadius: storeKeyBorderRadius ?? fallback.keyBorderRadius,
      fontSize: storeFontSize ?? fallback.fontSize,
      navBarBottomInset: 0,
    });
  }, [storeTheme, storeThemeColors, storeKeyHeight, storeKeyBorderRadius, storeFontSize, systemIsDark]);

  // Hydrate from native SharedPreferences and listen for live events (e.g. IME process)
  useEffect(() => {
    const applyPrefs = (prefs: any) => {
      if (!prefs || Object.keys(prefs).length === 0) return;
      const theme = prefs.theme || 'system';
      const isDark = resolveIsDark(theme, systemIsDarkNow());
      const defaultColors = isDark ? DARK_COLORS : LIGHT_COLORS;
      const useStored = theme !== 'system';

      const keyHeight = typeof prefs.keyHeight === 'number' ? prefs.keyHeight : defaultColors.keyHeight;
      const keyBorderRadius = typeof prefs.keyBorderRadius === 'number' ? prefs.keyBorderRadius : defaultColors.keyBorderRadius;
      const fontSize = typeof prefs.fontSize === 'number' ? prefs.fontSize : defaultColors.fontSize;
      // Bottom inset from the host window (IME / floating panel). When absent
      // (older native build), keep 0 so the layout is unchanged.
      const navBarBottomInset = typeof prefs.navBarBottomInset === 'number'
        ? Math.max(0, Math.round(prefs.navBarBottomInset))
        : 0;

      const newColors: KeyboardThemeColors = {
        keyboardBg:    useStored ? (prefs.keyboardBg  || defaultColors.keyboardBg) : defaultColors.keyboardBg,
        keyBg:         useStored ? (prefs.themeKeyBg  || defaultColors.keyBg)      : defaultColors.keyBg,
        keyText:       useStored ? (prefs.themeKeyText || defaultColors.keyText)   : defaultColors.keyText,
        specialKeyBg:  useStored ? (prefs.specialKeyBg || defaultColors.specialKeyBg) : defaultColors.specialKeyBg,
        specialKeyText: useStored ? (prefs.specialKeyText || defaultColors.specialKeyText) : defaultColors.specialKeyText,
        themePrimary:  useStored ? (prefs.themePrimary || defaultColors.themePrimary) : defaultColors.themePrimary,
        keyHeight:     keyHeight,
        keyBorderRadius: keyBorderRadius,
        fontSize:      fontSize,
        navBarBottomInset,
      };

      // Keep local Zustand state in sync within this process
      try {
        useSettingsStore.setState((s) => ({
          theme,
          themeColors: {
            ...s.themeColors,
            keyboardBg: newColors.keyboardBg,
            keyBg: newColors.keyBg,
            keyText: newColors.keyText,
            specialKeyBg: newColors.specialKeyBg,
            specialKeyText: newColors.specialKeyText,
            themePrimary: newColors.themePrimary,
          },
          keyHeight: newColors.keyHeight,
          keyBorderRadius: newColors.keyBorderRadius,
          fontSize: newColors.fontSize,
        }));
      } catch (e) {}

      setColors(newColors);
    };

    const fetchNativePrefs = () => {
      getQyKey()
        ?.getPreferences()
        ?.then((prefs: any) => applyPrefs(prefs))
        .catch(() => {});
    };

    fetchNativePrefs();

    if (NativeModules.QyKey) {
      const emitter = new NativeEventEmitter(NativeModules.QyKey);
      const sub = emitter.addListener('qykey_preferencesChanged', (prefMap: any) => {
        if (prefMap) {
          applyPrefs(prefMap);
        } else {
          fetchNativePrefs();
        }
      });
      return () => sub.remove();
    }
  }, []);

  return colors;
}
