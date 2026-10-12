// ============================================================
// config.ts — circuit configuration (ported from qykey/helper/data.ts).
// Now accepts themeColors for dark mode support.
// ============================================================

import type { KeyboardThemeColors } from '../../hooks/useKeyboardTheme';

function isDarkTheme(colors?: KeyboardThemeColors): boolean {
  if (!colors) return false;
  const bg = colors.keyboardBg || colors.keyBg;
  if (!bg) return false;
  let hex = bg.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  return false;
}

export const config = (themeColors?: KeyboardThemeColors) => {
  const isDark = isDarkTheme(themeColors);
  return {
    cellSize: 10,
    maxWireLength: 40,
    wireColor: themeColors?.themePrimary || '#8594aa',
    bgColor: isDark ? '#242933' : '#ffffff',
    glowBgColor: isDark ? '#3b4252' : '#d9e0ef',
    glowLength: 10,
    glowSpeed: 50,
    straightBias: 2,
  };
};

export const directions = () => [
  [0, 1], // down
  [1, 1], // down-right
  [1, 0], // right
  [1, -1], // up-right
  [0, -1], // up
  [-1, -1], // up-left
  [-1, 0], // left
  [-1, 1], // down-left
];
