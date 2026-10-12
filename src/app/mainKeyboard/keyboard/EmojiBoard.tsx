// ============================================================
// EmojiBoard.tsx — ported from qykey.
// Now accepts themeColors for dynamic styling.
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { Key } from '../Key';
import { emojis, emojiCategories } from '../../../data/emojiData';
import { FA5Icon, MDIIcon } from './KeyIcons';
import {
  createKeyboardStyles,
  ROW_GAP_V,
} from '../../../../assets/styles/dynamicStyles';
import type { KeyboardThemeColors } from '../../../hooks/useKeyboardTheme';

type EmojiBoardProps = {
  onEmojiSelect?: (emoji: string) => void;
  /** Backspace — same handler as the other keyboard pages. */
  onBackspace?: () => void;
  onRepeatStart?: () => void;
  onRepeatEnd?: () => void;
  themeColors: KeyboardThemeColors;
};

const COLUMNS = 6;
// Actual rendered row height = emoji key height + vertical row gap.
// Must match the `row` style (marginBottom: ROW_GAP_V) in dynamicStyles.ts
// so FlatList `getItemLayout` scroll estimates stay accurate.
const rowHeightFor = (keyHeight: number) => keyHeight + ROW_GAP_V;

interface EmojiItemProps {
  item: string;
  onSelect?: (emoji: string) => void;
  keyStyle: any;
  keyPressedStyle: any;
  textStyle: any;
}

const EmojiItem = React.memo(({ item, onSelect, keyStyle, keyPressedStyle, textStyle }: EmojiItemProps) => {
  const handlePress = useCallback(() => {
    onSelect?.(item);
  }, [item, onSelect]);

  return (
    <Pressable
      onPress={handlePress}
      unstable_pressDelay={60}
      style={({ pressed }) => [keyStyle, pressed && keyPressedStyle]}
    >
      <Text style={textStyle}>{item}</Text>
    </Pressable>
  );
});

const EmojiBoardComponent = ({
  onEmojiSelect,
  onBackspace,
  onRepeatStart,
  onRepeatEnd,
  themeColors,
}: EmojiBoardProps) => {
  const styles = useMemo(() => createKeyboardStyles(themeColors), [themeColors]);
  const ROW_HEIGHT = useMemo(() => rowHeightFor(themeColors.keyHeight), [themeColors.keyHeight]);
  const [activeTab, setActiveTab] = useState('people');
  const [containerWidth, setContainerWidth] = useState(
    () => Dimensions.get('window').width - 8,
  );
  const rightOffset = Math.max(0, (containerWidth - 348.25) / 2);
  const topOffset = 4 * (themeColors.keyHeight + ROW_GAP_V);

  const currentEmojis = useMemo(() => emojis()[activeTab] || [], [activeTab]);

  const keyStyle = useMemo(
    () => [styles.key, styles.emojiKey],
    [styles.key, styles.emojiKey],
  );

  const renderEmojiItem = useCallback(
    ({ item }: { item: string }) => (
      <EmojiItem
        item={item}
        onSelect={onEmojiSelect}
        keyStyle={keyStyle}
        keyPressedStyle={styles.keyPressed}
        textStyle={styles.emojiText}
      />
    ),
    [onEmojiSelect, keyStyle, styles.keyPressed, styles.emojiText],
  );

  const [showTooltipId, setShowTooltipId] = useState<string | null>(null);
  const tooltipTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTabPress = (tabId: string) => {
    setActiveTab(tabId);
    setShowTooltipId(tabId);
    if (tooltipTimer.current) {
      clearTimeout(tooltipTimer.current);
    }
    tooltipTimer.current = setTimeout(() => {
      setShowTooltipId(null);
    }, 500);
  };

  const renderTabItem = (tab: ReturnType<typeof emojiCategories>[0]) => {
    const isActive = activeTab === tab.id;
    const isTooltipVisible = showTooltipId === tab.id;
    return (
      <View key={tab.id} style={styles.tabContainer}>
        {isTooltipVisible && (
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>{tab.title}</Text>
            <View style={styles.tooltipArrow} />
          </View>
        )}

        <Pressable
          onPress={() => handleTabPress(tab.id)}
          style={[styles.tabButton, isActive && styles.activeTabButton]}
        >
          {tab.lib === 'FontAwesome5' ? (
            <FA5Icon
              name={tab.icon}
              size={isActive ? 14 : 16}
              color={isActive ? '#fff' : themeColors.keyText}
            />
          ) : (
            <MDIIcon
              name={tab.icon}
              size={isActive ? 16 : 18}
              color={isActive ? '#fff' : themeColors.keyText}
            />
          )}
          {isActive && (
            <View
              style={[styles.tabActiveIndicator, { borderColor: '#fff' }]}
            />
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.emojiBoardInset}>
        <View style={styles.tabBar}>{emojiCategories().map(renderTabItem)}</View>
      </View>

      <View style={styles.emojiGridContainer}>
        <FlatList
          data={currentEmojis}
          renderItem={renderEmojiItem}
          keyExtractor={(item, index) => `${index}-${item}`}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          getItemLayout={(_, index) => ({
            length: ROW_HEIGHT,
            offset: ROW_HEIGHT * Math.floor(index / COLUMNS),
            index,
          })}
          initialNumToRender={COLUMNS * 5}
          maxToRenderPerBatch={COLUMNS * 4}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          overScrollMode="never"
        />
      </View>

      {/* Fixed backspace key — matches width and position of SymbolKeys row 4 */}
      <View
        pointerEvents="box-none"
        style={[
          styles.emojiFixedBackspace,
          {
            top: topOffset,
            right: rightOffset,
          },
        ]}
      >
        <Key
          special
          style={styles.wider}
          isIcon
          onPressHandler={onBackspace}
          onRepeatStart={onRepeatStart}
          onRepeatEnd={onRepeatEnd}
          themeColors={themeColors}
        >
          <MDIIcon name="backspace-outline" size={16} color={themeColors.keyText} />
        </Key>
      </View>
    </View>
  );
};

export const EmojiBoard = React.memo(EmojiBoardComponent);
