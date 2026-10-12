// ============================================================
// dynamicStyles.ts — theme-aware keyboard styles.
// Shared keyboard-bundle StyleSheet generator (consumed by both the
// keyboard bundle and companion app via relative/alias imports).
// ============================================================

import { Dimensions, StyleSheet } from 'react-native';
import type { KeyboardThemeColors } from '../../src/hooks/useKeyboardTheme';

const { width } = Dimensions.get('window');

function isDarkTheme(colors: KeyboardThemeColors): boolean {
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

// Vertical gap between key rows (was 3px → 7.5px → 15px, doubled each spacing pass).
// Shared by every keyboard surface: letter/symbol/system rows (`line`), emoji rows
// (`row`), and row-dependent heights (emoji grid, touchpad area).
export const ROW_GAP_V = 15;

export function createKeyboardStyles(colors: KeyboardThemeColors) {
  // Derive secondary colors from the theme
  const isDark = isDarkTheme(colors);
  const keyShadowTL = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.2)';
  const keyShadowBR = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)';
  const keyBorderColorTL = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.2)';
  const keyBorderColorBR = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)';
  const pressedBg = isDark ? '#4c566a' : '#dcdde1';
  const functionKeyBg = isDark ? '#4c566a' : '#8a8a8a';
  const borderColor = isDark ? '#434c5e' : '#abb2b9';
  const insetTL = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.15)';
  const insetBR = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)';
  const suggestionSep = isDark ? '#434c5e' : '#bbb';
  const navBtnBg = colors.specialKeyBg;
  const scrollBtnBg = functionKeyBg;
  const mouseBtnBg = isDark ? '#3b4252' : '#c8ccd0';
  const tooltipBg = isDark ? '#2e3440' : '#2c2b2b';
  const tabBtnBg = isDark ? '#3b4252' : '#d1d1d1';
  const activeTabBg = functionKeyBg;
  const emojiKeyBg = colors.keyBg;
  const knobBg = colors.keyBg;

  return StyleSheet.create({
    // Wrapper that layers the circuit board BEHIND the keyboard shell.
    // Must NOT use flex:1 — the keyboard must wrap its content height so that
    // `base`'s onLayout reports the true content height (not the clamped IME
    // window height). Native uses that report to resize the window.
    keyboardContainer: {
      position: 'relative',
      alignSelf: 'stretch',
      width: '100%',
      backgroundColor: 'transparent',
    },
    circuitContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 12,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    base: {
      alignSelf: 'flex-start',
      zIndex: 1,
      width: '100%',
      paddingTop: 4,
      paddingRight: 4,
      // Bottom padding = base (28, 2x of previous 14) + navigation-bar inset reported by the host
      // window. The shell still reaches the screen bottom (Gboard-style); the
      // keys sit above the nav bar. 0 when nothing overlaps the keyboard.
      paddingBottom: 28 + colors.navBarBottomInset,
      paddingLeft: 4,
      backgroundColor: colors.keyboardBg + 'cc',
      borderRadius: 12,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderWidth: 1,
      borderColor,
      shadowColor: '#000',
      shadowOffset: { width: -5, height: -5 },
      shadowOpacity: 0.6,
      shadowRadius: 10,
      elevation: 10,
    },
    mainKeysContainer: {},
    line: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: ROW_GAP_V,
      gap: 3,
      width: '100%',
    },
    key: {
      height: colors.keyHeight,
      backgroundColor: colors.keyBg,
      borderRadius: colors.keyBorderRadius,
      justifyContent: 'center',
      alignItems: 'center',
      borderTopWidth: 1.5,
      borderLeftWidth: 1.5,
      borderTopColor: keyBorderColorTL,
      borderLeftColor: keyBorderColorTL,
      borderBottomWidth: 2,
      borderRightWidth: 2,
      borderBottomColor: keyBorderColorBR,
      borderRightColor: keyBorderColorBR,
      shadowColor: '#000',
      shadowOffset: { width: -3, height: -3 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 6,
    },
    keyPressed: {
      backgroundColor: pressedBg,
      transform: [{ translateY: 1 }],
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderBottomWidth: 0,
      borderRightWidth: 0,
      borderTopColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.25)',
      borderLeftColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.25)',
    },
    keyActive: {
      fontSize: Math.max(9, Math.round(colors.fontSize * 0.75)),
    },
    keyText: {
      fontSize: colors.fontSize,
      color: colors.keyText,
      fontWeight: '700',
      includeFontPadding: false,
    },
    specialKey: { backgroundColor: colors.specialKeyBg },
    functionKey: { backgroundColor: functionKeyBg },
    wider: {
      width: 44,
    },
    spaceInner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    spaceText: {
      color: colors.keyText,
      fontSize: Math.max(10, Math.round(colors.fontSize * 0.92)),
      fontWeight: '700',
      textAlign: 'center',
      includeFontPadding: false,
    },
    toggleContainer: {
      backgroundColor: colors.specialKeyBg,
      borderRadius: Math.max(0, colors.keyBorderRadius + 1),
      marginRight: 2,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderTopColor: insetTL,
      borderLeftColor: insetTL,
      borderBottomWidth: 1,
      borderRightWidth: 1,
      borderBottomColor: insetBR,
      borderRightColor: insetBR,
    },
    slider: {
      width: 78,
      height: colors.keyHeight,
      position: 'relative',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    knob: {
      position: 'absolute',
      height: Math.max(16, colors.keyHeight - 4),
      width: 36,
      top: 0,
      backgroundColor: knobBg,
      borderRadius: Math.max(0, colors.keyBorderRadius - 2),
      zIndex: 1,
      borderTopWidth: 1.5,
      borderLeftWidth: 1.5,
      borderTopColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)',
      borderLeftColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)',
      borderBottomWidth: 2,
      borderRightWidth: 2,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
      borderRightColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
      shadowColor: '#000',
      shadowOffset: { width: -2, height: -2 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 4,
    },
    iconLayer: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      zIndex: 2,
    },
    // One glyph per half of the toggle track. Each slot centres its OWN glyph,
    // so the keyboard icon lines up with the knob: `space-around` used to space
    // the glyphs by their own widths and pushed the wider keyboard glyph right.
    iconSlot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionsContainer: {
      flex: 1,
      height: colors.keyHeight,
      backgroundColor: colors.keyBg,
      borderRadius: colors.keyBorderRadius,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      overflow: 'hidden',
    },
    suggestionText: {
      fontSize: Math.max(10, Math.round(colors.fontSize * 0.92)),
      color: colors.keyText,
      fontWeight: '600',
      flexShrink: 1,
      textAlign: 'center' as const,
      // Match the key labels: Android's default font padding adds uneven space
      // above/below the glyphs, which pushed the suggestion words off-centre.
      includeFontPadding: false,
    },
    // Suggestion row: stretches to the full height of the strip so each word's
    // touch target spans the strip and the label centres inside it (the old
    // `height: '100%'` on each word resolved against an auto-height parent and
    // left the words sitting above the strip's vertical centre).
    suggestionRow: {
      flex: 1,
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
    },
    // Each word gets the full strip height as its touch target while the label
    // itself stays centred inside that box.
    suggestionItem: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionSeparator: {
      width: 1,
      height: Math.max(12, colors.keyHeight - 8),
      backgroundColor: suggestionSep,
    },
    touchpadArea: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      width: '100%',
      height: 6 * colors.keyHeight + 6 * ROW_GAP_V,
    },
    activeIndicator: {
      borderWidth: 0.5,
      borderRadius: 10,
      height: 2,
      width: '70%',
    },

    container: {
      width: '100%',
    },

    symNextLine: {
      justifyContent: 'space-between',
      paddingLeft: 44,
      paddingRight: 3.75,
    },
    symNextLineInner: {
      display: 'flex',
      flexDirection: 'row',
      gap: 3,
    },
    lastLine: { justifyContent: 'space-between' },
    lastLineInner: {
      display: 'flex',
      flexDirection: 'row',
      gap: 3,
    },

    moreWider: {
      width: 60,
    },

    largeKeyLine: {
      justifyContent: 'flex-start',
    },
    // Utility row (System page): shift | brightness/search/settings/power | backspace.
    // The icon band is fixed to the exact width of SymbolKeys' F1–F7 band
    // (7 keys × 33.75 + 6 gaps × 3 = 254.25) so the row's total content
    // (44 + 254.25 + 44 + 2 row gaps × 3 = 348.25) matches SymbolKeys row 4.
    // Both rows are centered `line`s, so the shift and backspace keys land at
    // identical x positions on the two pages on every device width. The icons
    // stay centered in the band (same on-screen spot as before).
    utilityLineInner: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 3,
      width: 254.25,
    },
    extraWider: {
      // System-page large keys (PrtSc/ScrLck/Pause, Insert/Home/Pg Up,
      // Del/End/Pg Dn): 100dp whenever the row has room, shrinking
      // proportionally on narrow screens so the Prev key always fits
      // at the row's right edge without clipping.
      flex: 1,
      maxWidth: 100,
    },
    pageBtn: {
      // Prev key: same width and right-edge position as the sym page's
      // Next key (moreWider + symNextLine's paddingRight) so Prev on the
      // system page aligns exactly with Next on the symbol page.
      width: 60,
      marginLeft: 'auto', // push to the row's right edge
      marginRight: 3.75, // matches symNextLine's paddingRight
      backgroundColor: functionKeyBg,
    },

    touchpadContainer: {
      width: width * 0.92,
      height: '100%',
      maxWidth: 440,
      padding: 8,
      borderRadius: 16,
      backgroundColor: colors.keyboardBg,
      borderWidth: 1,
      borderColor,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: -5, height: -5 },
      shadowOpacity: 0.6,
      shadowRadius: 10,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    },
    touchpadSurface: {
      width: '100%',
      height: '56%',
      backgroundColor: isDark ? '#3b4252' : '#d1d9e6',
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderTopColor: insetTL,
      borderLeftColor: insetTL,
      borderBottomWidth: 1,
      borderRightWidth: 1,
      borderBottomColor: insetBR,
      borderRightColor: insetBR,
    },
    touchpadButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      height: '40%',
      width: '100%',
    },
    touchpadButtonArea: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: '42%',
    },
    navBtn: {
      width: '100%',
      height: '32%',
      backgroundColor: navBtnBg,
      borderRadius: 7,
    },
    scrollStack: {
      width: '12%',
      gap: 4,
      height: '100%',
    },
    scrollBtn: {
      flex: 1,
      height: undefined,
      backgroundColor: scrollBtnBg,
      borderRadius: 7,
    },
    mouseBtn: {
      height: '62%',
      marginTop: 6,
      borderRadius: 9,
      width: '100%',
    },
    btnText: {
      color: isDark ? '#d8dee9' : '#888',
      fontWeight: 'bold',
      fontSize: 13,
    },
    touchpadButtonContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabContainer: {
      flex: 1,
      minWidth: 30,
      maxWidth: 46,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      height: colors.keyHeight,
    },
    tooltip: {
      position: 'absolute',
      top: -35,
      left: '50%',
      transform: [{ translateX: -35 }],
      width: 70,
      backgroundColor: tooltipBg,
      paddingVertical: 4,
      borderRadius: 6,
      zIndex: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tooltipText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
      textAlign: 'center',
      width: '100%',
    },
    tooltipArrow: {
      position: 'absolute',
      bottom: -6,
      left: '50%',
      marginLeft: -6,
      width: 0,
      height: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 6,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: tooltipBg,
    },
    tabBar: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      marginBottom: Math.max(4, ROW_GAP_V - 7),
      backgroundColor: colors.specialKeyBg,
      borderRadius: Math.max(0, colors.keyBorderRadius + 2),
      paddingHorizontal: 2,
      paddingVertical: 2,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderTopColor: insetTL,
      borderLeftColor: insetTL,
      borderBottomWidth: 1,
      borderRightWidth: 1,
      borderBottomColor: insetBR,
      borderRightColor: insetBR,
    },
    tabButton: {
      flex: 1,
      minWidth: 30,
      maxWidth: 44,
      height: colors.keyHeight,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: colors.keyBorderRadius,
      backgroundColor: tabBtnBg,
      borderTopWidth: 1.5,
      borderLeftWidth: 1.5,
      borderTopColor: keyBorderColorTL,
      borderLeftColor: keyBorderColorTL,
      borderBottomWidth: 2,
      borderRightWidth: 2,
      borderBottomColor: keyBorderColorBR,
      borderRightColor: keyBorderColorBR,
    },
    activeTabButton: {
      backgroundColor: activeTabBg,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderBottomWidth: 0,
      borderRightWidth: 0,
      borderTopColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.25)',
      borderLeftColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.25)',
      transform: [{ translateY: 1 }],
    },
    tabActiveIndicator: {
      borderWidth: 1,
      borderRadius: 10,
      height: 2,
      width: '70%',
      position: 'absolute',
      bottom: 2,
    },
    // Emoji board side inset: equal left/right padding around the board's
    // content (tab bar + grid). Responsive, clamped so an 8-column emoji
    // row (8 × 42 + 7 × 3 = 357dp) still fits on narrow screens — it never
    // clips more than the old 2dp grid padding did.
    emojiBoardInset: {
      paddingHorizontal: Math.max(2, Math.min(12, (width - 357) / 2)),
    },
    emojiGridContainer: {
      width: 254.25,
      alignSelf: 'center',
      // 5 rows: the emoji board's height matches the 6-row keyboard (1 tab bar + 5 grid rows = 6 rows).
      height: 5 * colors.keyHeight + 5 * ROW_GAP_V,
    },
    emojiFixedBackspace: {
      position: 'absolute',
      zIndex: 20,
      elevation: 20,
    },
    // Places the emoji board's backspace key at the exact same x range as
    // the backspace keys on the letter/symbol/system pages: as wide as
    // those pages' key rows (2 × 44 + 254.25 + 2 × 3 = 348.25) with the
    // key right-aligned inside it, inside the centered `line` row.
    emojiBackspaceRow: {
      width: 348.25,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    scrollContent: {
      paddingBottom: 5,
    },
    row: {
      justifyContent: 'center',
      gap: 3,
      marginBottom: ROW_GAP_V,
    },
    emojiKey: {
      width: 39.5,
      height: colors.keyHeight,
      borderRadius: colors.keyBorderRadius,
      backgroundColor: emojiKeyBg,
    },
    emojiText: {
      fontSize: 22,
      includeFontPadding: false,
      fontFamily: 'NotoColorEmoji',
    },
  });
}
