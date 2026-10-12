import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useQyKeyBridge } from './useQyKeyBridge';

/**
 * Call this once near the root of the app (in app/_layout.tsx).
 * Subscribes to every setting the keyboard cares about and pushes
 * changes to SharedPreferences whenever they change.
 *
 * Debounced by 300ms to avoid hammering SharedPreferences when the
 * user is dragging a slider (e.g. font size).
 */
export function useSettingsSync() {
  const { savePreferences } = useQyKeyBridge();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const language        = useSettingsStore((s) => s.language);
  const theme            = useSettingsStore((s) => s.theme);
  const themeColors      = useSettingsStore((s) => s.themeColors);
  const keyHeight         = useSettingsStore((s) => s.keyHeight);
  const keyBorderRadius   = useSettingsStore((s) => s.keyBorderRadius);
  const fontSize           = useSettingsStore((s) => s.fontSize);
  const keyMargin          = useSettingsStore((s) => s.keyMargin);
  const hapticEnabled      = useSettingsStore((s) => s.hapticEnabled);
  const soundEnabled       = useSettingsStore((s) => s.soundEnabled);
  const autoCorrect        = useSettingsStore((s) => s.autoCorrect);
  const showSuggestions    = useSettingsStore((s) => s.showSuggestions);
  const cursorType         = useSettingsStore((s) => s.cursorType);
  const cursorColor        = useSettingsStore((s) => s.cursorColor);
  const cursorSize         = useSettingsStore((s) => s.cursorSize);

  const prevThemeRef = useRef(theme);
  const prevThemeColorsRef = useRef(themeColors);
  const prevLanguageRef = useRef(language);

  useEffect(() => {
    const isImmediateChange =
      prevThemeRef.current !== theme ||
      prevThemeColorsRef.current !== themeColors ||
      prevLanguageRef.current !== language;

    prevThemeRef.current = theme;
    prevThemeColorsRef.current = themeColors;
    prevLanguageRef.current = language;

    const sync = () => {
      savePreferences({
        language,
        theme,
        keyboardBg:      themeColors.keyboardBg,
        themeKeyBg:      themeColors.keyBg,
        themeKeyText:    themeColors.keyText,
        specialKeyBg:    themeColors.specialKeyBg,
        specialKeyText:  themeColors.specialKeyText,
        themePrimary:    themeColors.themePrimary,
        keyHeight,
        keyBorderRadius,
        fontSize,
        keyMargin,
        hapticEnabled,
        soundEnabled,
        autoCorrect,
        showSuggestions,
        cursorType,
        cursorColor,
        cursorSize,
      }).catch(() => {
        // Silently ignore
      });
    };

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (isImmediateChange) {
      sync();
    } else {
      debounceRef.current = setTimeout(sync, 250);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    language, theme, themeColors,
    keyHeight, keyBorderRadius, fontSize, keyMargin,
    hapticEnabled, soundEnabled, autoCorrect, showSuggestions,
    cursorType, cursorColor, cursorSize,
  ]);
}
