// ============================================================
// SymbolKeys.tsx — ported from qykey (symbol page 1).
// Now accepts themeColors for dynamic styling.
// ============================================================

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { createKeyboardStyles } from '../../../../assets/styles/dynamicStyles';
import { Key } from '../Key';
import { MDIIcon } from './KeyIcons';
import type { KeyboardThemeColors } from '../../../hooks/useKeyboardTheme';
import type { ModifierKey } from '../../../hooks/useKeyboardState';

type SymbolKeysProps = {
  onNext?: () => void;
  onKeyPress?: (key: string) => void;
  onBackspace?: () => void;
  onEnter?: () => void;
  onSpecialKey?: (key: string) => void;
  /** PC-style shift: controlled from useKeyboardState (one-shot + double-tap lock). */
  shiftActive?: boolean;
  onShiftPress?: () => void;
  /** Currently latched modifiers (Ctrl/Alt/Win), for the lit key indicators. */
  heldModifiers?: ModifierKey[];
  onModifierToggle?: (key: ModifierKey) => void;
  themeColors: KeyboardThemeColors;
};

export default function SymbolKeys({
  onNext,
  onKeyPress,
  onBackspace,
  onEnter,
  onSpecialKey,
  shiftActive = false,
  onShiftPress,
  heldModifiers = [],
  onModifierToggle,
  themeColors,
}: SymbolKeysProps) {
  const styles = useMemo(() => createKeyboardStyles(themeColors), [themeColors]);
  const press = (s: string) => () => onKeyPress?.(s);

  const syms1 = ['@', '#'];
  const syms2 = ['%', '!', '$', '^'];
  const syms3 = ['=', '`', '_', '~', '|'];
  const fkeys1 = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'];
  const fkeys2 = ['F8', 'F9', 'F10', 'F11', 'F12'];

  return (
    <View style={styles.container}>
      <View style={styles.line}>
        {syms1.map((s) => (
          <Key key={s} onPressHandler={press(s)} themeColors={themeColors}>{s}</Key>
        ))}
        <Key special onPressHandler={press('(')} themeColors={themeColors}>(</Key>
        <Key special onPressHandler={press(')')} themeColors={themeColors}>)</Key>
        <Key functionKey onPressHandler={press('+')} themeColors={themeColors}>+</Key>
        <Key functionKey onPressHandler={press('-')} themeColors={themeColors}>-</Key>
        <Key functionKey onPressHandler={press('*')} themeColors={themeColors}>*</Key>
        <Key functionKey onPressHandler={press('/')} themeColors={themeColors}>/</Key>
        <Key special onPressHandler={press('{')} themeColors={themeColors}>{'{'}</Key>
        <Key special onPressHandler={press('}')} themeColors={themeColors}>{'}'}</Key>
      </View>

      <View style={styles.line}>
        <Key onPressHandler={press('%')} themeColors={themeColors}>%</Key>
        <Key special onPressHandler={press('[')} themeColors={themeColors}>[</Key>
        <Key special onPressHandler={press(']')} themeColors={themeColors}>]</Key>
        {syms2.slice(1).map((s) => (
          <Key key={s} onPressHandler={press(s)} themeColors={themeColors}>{s}</Key>
        ))}
        <Key special onPressHandler={press('<')} themeColors={themeColors}>{'<'}</Key>
        <Key special onPressHandler={press('>')} themeColors={themeColors}>{'>'}</Key>
        <Key onPressHandler={press('&')} themeColors={themeColors}>&</Key>
      </View>

      <View style={[styles.line, styles.symNextLine]}>
        <View style={styles.symNextLineInner}>
          {syms3.map((s) => (
            <Key key={s} onPressHandler={press(s)} themeColors={themeColors}>{s}</Key>
          ))}
          <Key onPressHandler={press("'")} themeColors={themeColors}>{'-'}</Key>
        </View>
        <Key functionKey style={styles.moreWider} onPressHandler={() => onNext?.()} themeColors={themeColors}>
          Next
        </Key>
      </View>

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
        {fkeys1.map((f) => (
          <Key key={f} functionKey onPressHandler={() => onSpecialKey?.(f)} themeColors={themeColors}>{f}</Key>
        ))}
        <Key special style={styles.wider} isIcon onPressHandler={onBackspace} themeColors={themeColors}>
          <MDIIcon name="backspace-outline" size={16} color={themeColors.keyText} />
        </Key>
      </View>

      <View style={[styles.line, styles.lastLine]}>
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
        <View style={styles.lastLineInner}>
          {fkeys2.map((f) => (
            <Key key={f} functionKey onPressHandler={() => onSpecialKey?.(f)} themeColors={themeColors}>{f}</Key>
          ))}
        </View>
        <Key special style={styles.wider} isIcon onPressHandler={onEnter} themeColors={themeColors}>
          <MDIIcon name="keyboard-return" size={16} color={themeColors.keyText} />
        </Key>
      </View>
    </View>
  );
}
