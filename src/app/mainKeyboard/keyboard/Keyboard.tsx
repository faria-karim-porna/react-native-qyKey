// ============================================================
// Keyboard.tsx — ported from qykey/components/Keyboard/Keyboard.tsx.
//
// Structure is identical to qykey (slider + top keys, arrows row,
// main keys / symbol pages / emoji board, touchpad mode). The
// difference: every key press goes through the NATIVE QyKey
// module (InputConnection) instead of qykey's local input state.
//
// Language modes:
//   en-US     → English QWERTY, committed directly
//   bn-BD     → Bangla glyph layout, committed directly
//   banglish  → English keys, native Avro-style phonetic engine
//               converts them to Bangla (commitKey(code, 'bn'))
// ============================================================

import React, { useCallback, useMemo } from 'react';
import { NativeModules, View } from 'react-native';
import { useKeyboardTheme } from '../../../hooks/useKeyboardTheme';
import { createKeyboardStyles } from '../../../../assets/styles/dynamicStyles';
import Touchpad from '../touchpad/Touchpad';
import SymbolKeys from './SymbolKeys';
import SystemKeys from './SystemKeys';
import { FeatheredArrowKey } from './FeatheredArrowKey';
import { ModeToggleBar } from './ModeToggleBar';
import { LetterKeys } from './LetterKeys';
import { Key } from '../Key';
import { TopStrip } from './TopStrip';
import { EmojiBoard } from './EmojiBoard';
import { Circuit } from '../../circuit/Circuit';
import { useKeyboardState } from '../../../hooks/useKeyboardState';
import type { KeyboardThemeColors } from '../../../hooks/useKeyboardTheme';

// Natural (unclamped) content height of the keyboard for the current mode, in
// px. The IME window is sized by NATIVE code, so it cannot know how tall the
// JS content wants to be — we measure it and report up (QyKeyModule →
// QyKeyInputMethodService.onContentHeightReported). Native re-clamps to sane
// bounds and keeps a formula fallback, so a bogus report cannot break layout.
const qykeyNative = NativeModules.QyKey as {
  reportKeyboardContentHeight?: (heightPx: number) => void;
} | undefined;

export default function Keyboard() {
  const themeColors = useKeyboardTheme();
  const styles = useMemo(() => createKeyboardStyles(themeColors), [themeColors]);

  const {
    language,
    toggleMode,
    symbolModeStatus,
    isEmojiMode,
    suggestions,
    setToggleMode,
    handleKeyPress,
    handleBackspace,
    handleBackspaceRepeatStart,
    handleBackspaceRepeatEnd,
    handleSpace,
    handleEnter,
    handleSpecialKey,
    handleMoveCursor,
    handleLanguageChange,
    handleSymbolToggle,
    handleSymbolNext,
    handleSymbolPrev,
    handleEmojiToggle,
    handleEmojiSelect,
    handleSuggestionSelect,
    handleTranscriptComplete,
    handleScrollPage,
    handleScrollRepeatStart,
    handleScrollRepeatEnd,
    handleNavigateHistory,
    handleMouseClick,
    handleDragStart,
    handleDragEnd,
    tapToClick,
    handlePointerShow,
    handlePointerHide,
    handlePointerMove,
    handleRequestPointerPermission,
    heldModifiers, toggleHeldModifier, handleShiftPress,
    shiftActive, capsLockOn,
  } = useKeyboardState();

  const symHandler = () => handleSymbolToggle();
  const onToggleMode = () => setToggleMode(!toggleMode);

  // ── Auto-fit reporting ───────────────────────────────────────────────
  // The window height is controlled by NATIVE code, so it can't know how tall
  // the JS content wants to be. `styles.base` (the content wrapper) is laid
  // out by Yoga at its NATURAL height — it overflows the fixed window instead
  // of being clamped — so its onLayout gives us the true content height for
  // the current mode (letters/symbols ~264dp, emoji ~300dp, touchpad, etc.).
  // We report that up; native re-clamps to sane bounds and keeps a formula
  // fallback, so a bogus report cannot break layout.
  const lastReportedHeight = React.useRef<number | null>(null);

  const handleLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    const height = Math.ceil(e.nativeEvent.layout.height);
    if (height <= 0 || lastReportedHeight.current === height) return;
    lastReportedHeight.current = height;
    try {
      qykeyNative?.reportKeyboardContentHeight?.(height);
    } catch (err) {
      // Companion preview / non-IME contexts have no QyKey module — silent no-op.
    }
  }, []);

  const emojiModeHandler = () => handleEmojiToggle();

  return (
    <View style={styles.keyboardContainer}>
      {/* Circuit board behind the translucent keyboard shell. */}
      <Circuit animated={!isEmojiMode} themeColors={themeColors} />

      <View style={styles.base} onLayout={handleLayout}>
        {/* Top Row */}
        <View style={[styles.line, { justifyContent: 'flex-start' }]}>
          <ModeToggleBar toggleMode={toggleMode} onToggleMode={onToggleMode} themeColors={themeColors} />
          {!toggleMode ? (
            <TopStrip
              symHandler={symHandler}
              emojiModeHandler={emojiModeHandler}
              language={language}
              suggestions={suggestions}
              onSuggestionPress={handleSuggestionSelect}
              onTranscriptComplete={handleTranscriptComplete}
              themeColors={themeColors}
            />
          ) : null}
        </View>

        <View style={styles.mainKeysContainer}>
          {!toggleMode ? (
            <>
              {isEmojiMode ? (
                <EmojiBoard
                  onEmojiSelect={handleEmojiSelect}
                  onBackspace={handleBackspace}
                  onRepeatStart={handleBackspaceRepeatStart}
                  onRepeatEnd={handleBackspaceRepeatEnd}
                  themeColors={themeColors}
                />
              ) : (
                <View style={styles.line}>
                  {['\"', ':', ','].map((k) => (
                    <Key key={k} onPressHandler={() => handleKeyPress(k)} themeColors={themeColors}>
                      {k}
                    </Key>
                  ))}
                  <Key functionKey isIcon onPressHandler={() => handleMoveCursor('left')} themeColors={themeColors}>
                    <FeatheredArrowKey direction="left" color={themeColors.keyText} />
                  </Key>
                  <Key functionKey isIcon onPressHandler={() => handleMoveCursor('up')} themeColors={themeColors}>
                    <FeatheredArrowKey direction="up" color={themeColors.keyText} />
                  </Key>
                  <Key functionKey isIcon onPressHandler={() => handleMoveCursor('down')} themeColors={themeColors}>
                    <FeatheredArrowKey direction="down" color={themeColors.keyText} />
                  </Key>
                  <Key functionKey isIcon onPressHandler={() => handleMoveCursor('right')} themeColors={themeColors}>
                    <FeatheredArrowKey direction="right" color={themeColors.keyText} />
                  </Key>
                  {['.', ';', '?'].map((k) => (
                    <Key key={k} onPressHandler={() => handleKeyPress(k)} themeColors={themeColors}>
                      {k}
                    </Key>
                  ))}
                </View>
              )}

              {!isEmojiMode ? (
                symbolModeStatus === 0 ? (
                  <LetterKeys
                    onKeyPress={handleKeyPress}
                    onBackspace={handleBackspace}
                    onBackspaceRepeatStart={handleBackspaceRepeatStart}
                    onBackspaceRepeatEnd={handleBackspaceRepeatEnd}
                    onSpace={handleSpace}
                    onEnter={handleEnter}
                    onSpecialKey={handleSpecialKey}
                    shiftActive={shiftActive}
                    capsLockOn={capsLockOn}
                    onShiftPress={handleShiftPress}
                    heldModifiers={heldModifiers}
                    onModifierToggle={toggleHeldModifier}
                    language={language}
                    onLanguageChange={handleLanguageChange}
                    themeColors={themeColors}
                  />
                ) : symbolModeStatus === 1 ? (
                  <SymbolKeys
                    onNext={handleSymbolNext}
                    onKeyPress={handleKeyPress}
                    onBackspace={handleBackspace}
                    onEnter={handleEnter}
                    onSpecialKey={handleSpecialKey}
                    shiftActive={shiftActive}
                    onShiftPress={handleShiftPress}
                    heldModifiers={heldModifiers}
                    onModifierToggle={toggleHeldModifier}
                    themeColors={themeColors}
                  />
                ) : (
                  <SystemKeys
                    onPrev={handleSymbolPrev}
                    onBackspace={handleBackspace}
                    onEnter={handleEnter}
                    onSpecialKey={handleSpecialKey}
                    shiftActive={shiftActive}
                    onShiftPress={handleShiftPress}
                    heldModifiers={heldModifiers}
                    onModifierToggle={toggleHeldModifier}
                    themeColors={themeColors}
                  />
                )
              ) : null}
            </>
          ) : (
            <View style={styles.touchpadArea}>
              <Touchpad
                onScrollPage={handleScrollPage}
                onScrollRepeatStart={handleScrollRepeatStart}
                onScrollRepeatEnd={handleScrollRepeatEnd}
                onNavigateHistory={handleNavigateHistory}
                onMouseClick={handleMouseClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                tapToClick={tapToClick}
                onPointerShow={handlePointerShow}
                onPointerHide={handlePointerHide}
                onPointerMove={handlePointerMove}
                onRequestPointerPermission={handleRequestPointerPermission}
                themeColors={themeColors}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
