// ============================================================
// Key.tsx -- "Chocolate bar" key, ported from qykey.
//
// Differences from the qykey original:
//   - Vector-icon rendering removed -- icon fonts are unavailable
//     in the IME process, so icons are passed as children.
//   - Optional onRepeatStart/onRepeatEnd for backspace long-press.
//   - Now accepts themeColors for dynamic styling.
// ============================================================

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, Pressable, PanResponder } from 'react-native';
import { createKeyboardStyles } from '../../../assets/styles/dynamicStyles';
import type { KeyboardThemeColors } from '../../hooks/useKeyboardTheme';
import type { AppLanguage } from '../../types/keyboard';

interface KeyProps {
  children?: React.ReactNode;
  style?: any;
  special?: boolean;
  functionKey?: boolean;
  flex?: number;
  isIcon?: boolean;
  hasActiveState?: boolean;
  onPressHandler?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  type?: 'keyboard' | 'mouse';
  variant?: any;
  isStatusActive?: boolean;
  language?: AppLanguage;
  themeColors: KeyboardThemeColors;
  onRepeatStart?: () => void;
  onRepeatEnd?: () => void;
}

const KeyComponent = ({
  children,
  style,
  special = false,
  functionKey = false,
  flex = 0,
  isIcon = false,
  hasActiveState = false,
  onPressHandler,
  onSwipeLeft,
  onSwipeRight,
  type = 'keyboard',
  variant,
  isStatusActive,
  language = 'en-US',
  themeColors,
  onRepeatStart,
  onRepeatEnd,
}: KeyProps) => {
  const styles = useMemo(() => createKeyboardStyles(themeColors), [themeColors]);
  const [isActive, setIsActive] = useState(isStatusActive || false);

  const variantStyles: any = {
    nav: styles.navBtn,
    scroll: styles.scrollBtn,
    mouse: styles.mouseBtn,
  };

  useEffect(() => {
    if (isStatusActive !== undefined) setIsActive(isStatusActive);
  }, [isStatusActive]);

  const isSwipeable = !!(onSwipeLeft || onSwipeRight);

  const onSwipeLeftRef = useRef(onSwipeLeft);
  const onSwipeRightRef = useRef(onSwipeRight);
  const onPressHandlerRef = useRef(onPressHandler);

  useEffect(() => {
    onSwipeLeftRef.current = onSwipeLeft;
    onSwipeRightRef.current = onSwipeRight;
    onPressHandlerRef.current = onPressHandler;
  }, [onSwipeLeft, onSwipeRight, onPressHandler]);

  const swipeViewRef = useRef<View>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        swipeViewRef.current?.setNativeProps({ opacity: 0.5 });
      },
      onPanResponderMove: () => {},
      onPanResponderRelease: (_, g) => {
        swipeViewRef.current?.setNativeProps({ opacity: 1 });
        if (g.dx < -30) {
          onSwipeLeftRef.current?.();
        } else if (g.dx > 30) {
          onSwipeRightRef.current?.();
        } else {
          if (hasActiveState) setIsActive((prev) => !prev);
          onPressHandlerRef.current?.();
        }
      },
      onPanResponderTerminate: () => {
        swipeViewRef.current?.setNativeProps({ opacity: 1 });
      },
    }),
  ).current;

  const baseStyle = [
    styles.key,
    special && styles.specialKey,
    functionKey && styles.functionKey,
    type === 'mouse' && variantStyles[variant],
    type !== 'mouse' && (flex > 0 ? { flex } : language === 'bn-BD' ? { width: 25.65 } : { width: 33.75 }),
    style,
  ];

  const renderContent = (isPressed: boolean) => (
    <>
      {isIcon ? (
        children
      ) : type === 'mouse' ? (
        <Text style={[styles.btnText, variant === 'scroll' && { color: themeColors.keyText, opacity: 0.8 }, isPressed && { opacity: 0.6 }]}>
          {children}
        </Text>
      ) : (
        <Text
          numberOfLines={1}
          style={[
            styles.keyText,
            hasActiveState && isActive && styles.keyActive,
            functionKey && { color: themeColors.keyText },
            isPressed && { color: '#999' },
          ]}
        >
          {children}
        </Text>
      )}
      {hasActiveState && isActive && <View style={[styles.activeIndicator, { borderColor: themeColors.keyText }]} />}
    </>
  );

  if (isSwipeable) {
    return (
      <View ref={swipeViewRef} style={baseStyle} {...panResponder.panHandlers}>
        {renderContent(false)}
      </View>
    );
  }

  return (
    <Pressable
      unstable_pressDelay={0}
      hitSlop={{ top: 3, bottom: 3, left: 1, right: 1 }}
      onPressIn={() => {
        if (hasActiveState) setIsActive((prev) => !prev);
        onPressHandler?.();
        onRepeatStart?.();
      }}
      onPressOut={() => {
        onRepeatEnd?.();
      }}
      style={({ pressed }) => [baseStyle, pressed && styles.keyPressed]}
    >
      {({ pressed }) => renderContent(pressed)}
    </Pressable>
  );
};

export const Key = React.memo(KeyComponent);
