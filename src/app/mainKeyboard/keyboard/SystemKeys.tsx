// ============================================================
// SystemKeys.tsx — ported from qykey (system keys page).
// Now accepts themeColors for dynamic styling.
// ============================================================

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { createKeyboardStyles } from '../../../../assets/styles/dynamicStyles';
import { Key } from '../Key';
import { FA5Icon, MDIIcon } from './KeyIcons';
import type { KeyboardThemeColors } from '../../../hooks/useKeyboardTheme';
import type { ModifierKey } from '../../../hooks/useKeyboardState';

type SystemKeysProps = {
  onPrev?: () => void;
  onBackspace?: () => void;
  onEnter?: () => void;
  /** Named key actions: PC keycodes (prtsc, insert, pageup…) or smart actions
   *  (power → lock screen, settings → Android settings, volume/brightness/search). */
  onSpecialKey?: (key: string) => void;
  /** PC-style shift: controlled from useKeyboardState (one-shot + double-tap lock). */
  shiftActive?: boolean;
  onShiftPress?: () => void;
  /** Currently latched modifiers (Ctrl/Alt/Win), for the lit key indicators. */
  heldModifiers?: ModifierKey[];
  onModifierToggle?: (key: ModifierKey) => void;
  themeColors: KeyboardThemeColors;
};

export default function SystemKeys({
  onPrev,
  onBackspace,
  onEnter,
  onSpecialKey,
  shiftActive = false,
  onShiftPress,
  heldModifiers = [],
  onModifierToggle,
  themeColors,
}: SystemKeysProps) {
  const styles = useMemo(() => createKeyboardStyles(themeColors), [themeColors]);

  return (
    <View style={styles.container}>
      <View style={[styles.line, styles.largeKeyLine]}>
        <Key style={styles.extraWider} onPressHandler={() => onSpecialKey?.('prtsc')} themeColors={themeColors}>PrtSc</Key>
        <Key style={styles.extraWider} onPressHandler={() => onSpecialKey?.('scrolllock')} themeColors={themeColors}>ScrLck</Key>
        <Key style={styles.extraWider} onPressHandler={() => onSpecialKey?.('pause')} themeColors={themeColors}>Pause</Key>
      </View>

      <View style={[styles.line, styles.largeKeyLine]}>
        <Key style={styles.extraWider} onPressHandler={() => onSpecialKey?.('insert')} themeColors={themeColors}>Insert</Key>
        <Key style={styles.extraWider} onPressHandler={() => onSpecialKey?.('home')} themeColors={themeColors}>Home</Key>
        <Key style={styles.extraWider} onPressHandler={() => onSpecialKey?.('pageup')} themeColors={themeColors}>Pg Up</Key>
      </View>

      <View style={[styles.line, styles.largeKeyLine]}>
        <Key style={styles.extraWider} onPressHandler={() => onSpecialKey?.('del')} themeColors={themeColors}>Del</Key>
        <Key style={styles.extraWider} onPressHandler={() => onSpecialKey?.('end')} themeColors={themeColors}>End</Key>
        <Key style={styles.extraWider} onPressHandler={() => onSpecialKey?.('pagedown')} themeColors={themeColors}>Pg Dn</Key>
        <Key functionKey style={styles.pageBtn} onPressHandler={() => onPrev?.()} themeColors={themeColors}>
          Prev
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
        <View style={styles.utilityLineInner}>
          <Key functionKey isIcon onPressHandler={() => onSpecialKey?.('brightness_up')} themeColors={themeColors}>
            <FA5Icon name="sun" size={14} color={themeColors.keyText} />
          </Key>
          <Key functionKey isIcon onPressHandler={() => onSpecialKey?.('search')} themeColors={themeColors}>
            <FA5Icon name="search" size={14} color={themeColors.keyText} />
          </Key>
          <Key functionKey isIcon onPressHandler={() => onSpecialKey?.('settings')} themeColors={themeColors}>
            <FA5Icon name="cog" size={14} color={themeColors.keyText} />
          </Key>
          <Key functionKey isIcon onPressHandler={() => onSpecialKey?.('power')} themeColors={themeColors}>
            <FA5Icon name="power-off" size={14} color={themeColors.keyText} />
          </Key>
        </View>
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
          <Key functionKey isIcon onPressHandler={() => onSpecialKey?.('volume_mute')} themeColors={themeColors}>
            <FA5Icon name="volume-mute" size={14} color={themeColors.keyText} />
          </Key>
          <Key functionKey isIcon onPressHandler={() => onSpecialKey?.('volume_down')} themeColors={themeColors}>
            <FA5Icon name="volume-down" size={14} color={themeColors.keyText} />
          </Key>
          <Key functionKey isIcon onPressHandler={() => onSpecialKey?.('volume_up')} themeColors={themeColors}>
            <FA5Icon name="volume-up" size={14} color={themeColors.keyText} />
          </Key>
        </View>
        <Key special style={styles.wider} isIcon onPressHandler={onEnter} themeColors={themeColors}>
          <MDIIcon name="keyboard-return" size={16} color={themeColors.keyText} />
        </Key>
      </View>
    </View>
  );
}
