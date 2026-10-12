// ============================================================
// ModeToggleBar.tsx — ported from qykey (keyboard ⇄ touchpad).
// Now accepts themeColors for dynamic styling.
// ============================================================

import React, { useRef, useMemo } from 'react';
import { View, Pressable, Animated, Easing } from 'react-native';
import { createKeyboardStyles } from '../../../../assets/styles/dynamicStyles';
import { FA5Icon } from './KeyIcons';
import type { KeyboardThemeColors } from '../../../hooks/useKeyboardTheme';

type ModeToggleBarProps = {
  toggleMode?: boolean;
  onToggleMode?: () => void;
  themeColors: KeyboardThemeColors;
};

const ModeToggleBarComponent = (props: ModeToggleBarProps) => {
  const { toggleMode, onToggleMode, themeColors } = props;
  const styles = useMemo(() => createKeyboardStyles(themeColors), [themeColors]);
  const knobAnim = useRef(new Animated.Value(0)).current;

  const handleToggle = () => {
    const toValue = toggleMode ? 0 : 1;
    onToggleMode?.();
    Animated.timing(knobAnim, {
      toValue,
      duration: 350,
      useNativeDriver: false,
      easing: Easing.out(Easing.back(1.2)),
    }).start();
  };

  // The track (styles.slider) is split into two equal halves, one glyph each
  // (styles.iconSlot), with a knob that slides between them. Deriving the knob
  // travel from those same numbers makes it rest exactly under the active
  // glyph; the previous hard-coded travel (0 → 40) left the wider keyboard
  // glyph sitting a few px right of the knob's centre.
  const halfTrackWidth = (styles.slider.width as number) / 2;
  const knobInset = (halfTrackWidth - (styles.knob.width as number)) / 2;

  const knobTranslate = knobAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [knobInset, halfTrackWidth + knobInset],
  });

  return (
    <Pressable style={styles.toggleContainer} onPress={handleToggle}>
      <View style={styles.slider}>
        <Animated.View style={[styles.knob, { left: knobTranslate }]} />
        <View style={styles.iconLayer}>
          <View style={styles.iconSlot}>
            <FA5Icon name="keyboard" size={14} color={!toggleMode ? themeColors.keyText : themeColors.specialKeyText} />
          </View>
          <View style={styles.iconSlot}>
            <FA5Icon name="mouse-pointer" size={14} color={toggleMode ? themeColors.keyText : themeColors.specialKeyText} />
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export const ModeToggleBar = React.memo(ModeToggleBarComponent);
