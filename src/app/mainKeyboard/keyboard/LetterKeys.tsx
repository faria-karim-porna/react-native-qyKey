// ============================================================
// LetterKeys.tsx — ported from qykey.
//   - Key presses commit through the native QyKey module.
//   - Space-bar swipe cycles the language (en-US ⇄ banglish ⇄ bn-BD).
//   - Backspace gained long-press repeat (invisible UI change).
//   - Now accepts themeColors for dynamic styling.
// ============================================================

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { createKeyboardStyles } from '../../../../assets/styles/dynamicStyles';
import { Key } from '../Key';
import { MDIIcon } from './KeyIcons';
import type { AppLanguage } from '../../../types/keyboard';
import type { KeyboardThemeColors } from '../../../hooks/useKeyboardTheme';
import type { ModifierKey } from '../../../hooks/useKeyboardState';

type LetterKeysProps = {
  onKeyPress?: (key: string) => void;
  onBackspace?: () => void;
  onBackspaceRepeatStart?: () => void;
  onBackspaceRepeatEnd?: () => void;
  onSpace?: () => void;
  onEnter?: () => void;
  onSpecialKey?: (key: string) => void;
  /** PC-style shift: controlled from useKeyboardState (one-shot + double-tap lock). */
  shiftActive?: boolean;
  capsLockOn?: boolean;
  onShiftPress?: () => void;
  /** Currently latched modifiers (Ctrl/Alt/Win), for the lit key indicators. */
  heldModifiers?: ModifierKey[];
  onModifierToggle?: (key: ModifierKey) => void;
  language?: AppLanguage;
  onLanguageChange?: (lang: AppLanguage) => void;
  themeColors: KeyboardThemeColors;
};

const LetterKeysComponent = ({
  onKeyPress,
  onBackspace,
  onBackspaceRepeatStart,
  onBackspaceRepeatEnd,
  onSpace,
  onEnter,
  onSpecialKey,
  language = 'en-US',
  onLanguageChange,
  themeColors,
  shiftActive = false,
  capsLockOn = false,
  onShiftPress,
  heldModifiers = [],
  onModifierToggle,
}: LetterKeysProps) => {
  const styles = useMemo(() => createKeyboardStyles(themeColors), [themeColors]);
  // Shift state lives in useKeyboardState (one-shot latch / caps lock) so it
  // also participates in PC-style combos (Ctrl+Shift+…). Rows preview their
  // shifted glyphs while shift is latched OR caps lock is on.
  const isCapsOn = capsLockOn || shiftActive;
  const cycleLeft: Record<AppLanguage, AppLanguage> = {
    'en-US': 'banglish',
    banglish: 'bn-BD',
    'bn-BD': 'en-US',
  };
  const cycleRight: Record<AppLanguage, AppLanguage> = {
    'en-US': 'bn-BD',
    'bn-BD': 'banglish',
    banglish: 'en-US',
  };

  const spaceLabel =
    language === 'en-US' ? 'English' : language === 'banglish' ? 'Bangla' : 'বাংলা';
  return (
    <>
      {/* Alpha-Numeric Rows */}
      {[
        language === 'bn-BD' ? ['১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯', '০'] : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        language === 'bn-BD'
          ? isCapsOn
            ? ['অ', 'আ', 'ই', 'ঈ', 'উ', 'ঊ', 'ঋ', 'এ', 'ঐ', 'ও', 'ঔ', 'হ']
            : ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ']
          : isCapsOn
            ? ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
            : ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        language === 'bn-BD'
          ? isCapsOn
            ? ['া', 'ি', 'ী', 'ু', 'ূ', 'ৃ', 'ে', 'ৈ', 'ো', 'ৌ']
            : ['ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ']
          : isCapsOn
            ? ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L']
            : ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ].map((row, i) => (
        <View key={i} style={styles.line}>
          {row.map((k) => (
            <Key
              key={k}
              onPressHandler={() => onKeyPress?.(k)}
              language={i === 0 ? undefined : language}
              themeColors={themeColors}
            >
              {k}
            </Key>
          ))}
        </View>
      ))}

      {/* Z Row */}
      <View style={styles.line}>
        <Key
          special
          style={styles.wider}
          isIcon
          hasActiveState
          isStatusActive={shiftActive}
          onPressHandler={() => onShiftPress?.()}
          themeColors={themeColors}
        >
          <MDIIcon name="arrow-up-bold-outline" size={shiftActive ? 14 : 16} color={themeColors.keyText} />
        </Key>
        {(language === 'bn-BD'
          ? isCapsOn
            ? ['্', 'ং', 'ঃ', 'ঁ', 'ড়', 'ঢ়', 'য়', 'ৎ', 'র্']
            : ['ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স']
          : isCapsOn
            ? ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
            : ['z', 'x', 'c', 'v', 'b', 'n', 'm']
        ).map((k) => (
          <Key
            key={k}
            onPressHandler={() => onKeyPress?.(k)}
            language={language}
            themeColors={themeColors}
          >
            {k}
          </Key>
        ))}
        <Key
          special
          style={styles.wider}
          isIcon
          onPressHandler={onBackspace}
          onRepeatStart={onBackspaceRepeatStart}
          onRepeatEnd={onBackspaceRepeatEnd}
          themeColors={themeColors}
        >
          <MDIIcon name="backspace-outline" size={16} color={themeColors.keyText} />
        </Key>
      </View>

      {/* Bottom Row */}
      <View style={styles.line}>
        <Key
          special
          style={styles.wider}
          hasActiveState
          isStatusActive={heldModifiers.includes('ctrl')}
          onPressHandler={() => onModifierToggle?.('ctrl')}
          themeColors={themeColors}
        >
          Ctrl
        </Key>
        <Key
          special
          style={styles.wider}
          hasActiveState
          isStatusActive={heldModifiers.includes('meta')}
          onPressHandler={() => onModifierToggle?.('meta')}
          themeColors={themeColors}
        >
          ⊞
        </Key>
        <Key
          special
          style={styles.wider}
          hasActiveState
          isStatusActive={heldModifiers.includes('alt')}
          onPressHandler={() => onModifierToggle?.('alt')}
          themeColors={themeColors}
        >
          Alt
        </Key>

        <Key
          functionKey
          flex={1}
          onPressHandler={onSpace}
          onSwipeLeft={() => onLanguageChange?.(cycleLeft[language ?? 'en-US'])}
          onSwipeRight={() => onLanguageChange?.(cycleRight[language ?? 'en-US'])}
          themeColors={themeColors}
        >
          <Text style={styles.spaceText}>◀ {spaceLabel} ▶</Text>
        </Key>

        <Key
          special
          style={styles.wider}
          onPressHandler={() => onSpecialKey?.('tab')}
          themeColors={themeColors}
        >
          Tab
        </Key>
        <Key
          special
          style={styles.wider}
          onPressHandler={() => onSpecialKey?.('esc')}
          themeColors={themeColors}
        >
          Esc
        </Key>
        <Key
          special
          style={styles.wider}
          isIcon
          onPressHandler={onEnter}
          themeColors={themeColors}
        >
          <MDIIcon name="keyboard-return" size={16} color={themeColors.keyText} />
        </Key>
      </View>
    </>
  );
};

export const LetterKeys = React.memo(LetterKeysComponent);
