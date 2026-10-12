import type { ThemeColors, ThemeName } from '@/store/settingsStore';

export interface ThemePreset {
  name: ThemeName;
  label: string;
  colors: ThemeColors;
}

export const LIGHT_PRESET: ThemePreset = {
  name: 'light',
  label: 'QyKey Light',
  colors: {
    keyboardBg:     '#e0e5ec',
    keyBg:          '#f2f2f2',
    keyText:        '#444444',
    specialKeyBg:   '#c8ccd0',
    specialKeyText: '#444444',
    themePrimary:   '#8594aa',
  },
};

// Must stay identical to DARK_COLORS in src/hooks/useKeyboardTheme.ts —
// it is the palette the keyboard resolves for the 'system' theme on dark devices.
export const NORD_PRESET: ThemePreset = {
  name: 'nord',
  label: 'Nordic Frost',
  colors: {
    keyboardBg:     '#2e3440',
    keyBg:          '#3b4252',
    keyText:        '#eceff4',
    specialKeyBg:   '#434c5e',
    specialKeyText: '#88c0d0',
    themePrimary:   '#81a1c1',
  },
};

export const THEME_PRESETS: ThemePreset[] = [LIGHT_PRESET, NORD_PRESET];
