import React, { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { View, Text, ScrollView, StyleSheet, AppState, Pressable, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SvgProps } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { useSettingsStore, DEFAULT_CURSOR_COLOR } from '@/store/settingsStore';
import type { CursorType } from '@/store/settingsStore';
import ToggleRow from '@/app/mainApp/ToggleRow';
import QyKey from '@modules/qykey-module';
import { useAppColors } from '@/hooks/useAppColors';
import { useTranslation } from '@/hooks/useTranslation';

// ─── SVG component map ─────────────────────────────────────────────────────
// react-native-svg-transformer (metro.config.js) turns each .svg require()
// below into a ready-to-render react-native-svg component — no runtime
// fetch/parse step, so previews always render.
// NOTE: Metro's require() returns the module namespace object; the component
// itself is the module's default export, so every entry must read `.default`.
// Rendering the bare module object crashes with "Element type is invalid".

const CURSOR_SVG_COMPONENTS: Record<CursorType, ComponentType<SvgProps>> = {
  'cursor-alt-thick-pointer':         require('@assets/svg/cursor-alt-thick-pointer.svg').default,
  'cursor-pointer-classic':           require('@assets/svg/cursor-pointer-classic.svg').default,
  'cursor-pointer-nested':            require('@assets/svg/cursor-pointer-nested.svg').default,
  'cursor-pointer-small':             require('@assets/svg/cursor-pointer-small.svg').default,
  'cursor-pointer-standard':          require('@assets/svg/cursor-pointer-standard.svg').default,
  'cursor-simple-triangle':           require('@assets/svg/cursor-simple-triangle.svg').default,
  'pointer-cursor-detailed':          require('@assets/svg/pointer-cursor-detailed.svg').default,
  'pointer-cursor-settings':          require('@assets/svg/pointer-cursor-settings.svg').default,
  'pointer-hand-cursor':              require('@assets/svg/pointer-hand-cursor.svg').default,
  'hand-click-cursor':                require('@assets/svg/hand-click-cursor.svg').default,
  'hand-grab-closed':                 require('@assets/svg/hand-grab-closed.svg').default,
  'hand-grab-cursor':                 require('@assets/svg/hand-grab-cursor.svg').default,
  'hand-open-fingers':                require('@assets/svg/hand-open-fingers.svg').default,
  'hand-open-palm':                   require('@assets/svg/hand-open-palm.svg').default,
  'hand-pointing-index':              require('@assets/svg/hand-pointing-index.svg').default,
  'cursor-click-burst-fill':          require('@assets/svg/cursor-click-burst-fill.svg').default,
  'cursor-click-crosshair':           require('@assets/svg/cursor-click-crosshair.svg').default,
  'cursor-click-lines':               require('@assets/svg/cursor-click-lines.svg').default,
  'cursor-click-sparkle-crosshair':   require('@assets/svg/cursor-click-sparkle-crosshair.svg').default,
  'cursor-click-sparkle-dots':        require('@assets/svg/cursor-click-sparkle-dots.svg').default,
  'cursor-click-target-corners':      require('@assets/svg/cursor-click-target-corners.svg').default,
  'cursor-edit-pencil':               require('@assets/svg/cursor-edit-pencil.svg').default,
  'edit-pen-cursor-filled':           require('@assets/svg/edit-pen-cursor-filled.svg').default,
  'edit-pen-cursor-outline':          require('@assets/svg/edit-pen-cursor-outline.svg').default,
  'pencil-edit-cursor':               require('@assets/svg/pencil-edit-cursor.svg').default,
  'text-cursor-i-beam-round':         require('@assets/svg/text-cursor-i-beam-round.svg').default,
  'text-cursor-i-beam-serif':         require('@assets/svg/text-cursor-i-beam-serif.svg').default,
  'cursor-move-diagonal-down':        require('@assets/svg/cursor-move-diagonal-down.svg').default,
  'drag-drop-arrows':                 require('@assets/svg/drag-drop-arrows.svg').default,
  'move-arrows-4way':                 require('@assets/svg/move-arrows-4way.svg').default,
  'move-arrows-cross':                require('@assets/svg/move-arrows-cross.svg').default,
  'move-arrows-cross-circle':         require('@assets/svg/move-arrows-cross-circle.svg').default,
  'move-arrows-horizontal':           require('@assets/svg/move-arrows-horizontal.svg').default,
  'move-arrows-large':                require('@assets/svg/move-arrows-large.svg').default,
  'cursor-arrow-scroll-wheel':        require('@assets/svg/cursor-arrow-scroll-wheel.svg').default,
  'cursor-arrow-scroll-wheel-gray':   require('@assets/svg/cursor-arrow-scroll-wheel-gray.svg').default,
  'scroll-arrows-4way':               require('@assets/svg/scroll-arrows-4way.svg').default,
  'scroll-arrows-down':               require('@assets/svg/scroll-arrows-down.svg').default,
  'scroll-arrows-horizontal':         require('@assets/svg/scroll-arrows-horizontal.svg').default,
  'scroll-arrows-vertical':           require('@assets/svg/scroll-arrows-vertical.svg').default,
  'scroll-arrows-vertical-outline':   require('@assets/svg/scroll-arrows-vertical-outline.svg').default,
  'cursor-diagonal-line':             require('@assets/svg/cursor-diagonal-line.svg').default,
  'cursor-gps-location':              require('@assets/svg/cursor-gps-location.svg').default,
  'cursor-pixel-block':               require('@assets/svg/cursor-pixel-block.svg').default,
  'cursor-plus-add':                  require('@assets/svg/cursor-plus-add.svg').default,
  'cursor-plus-cross':                require('@assets/svg/cursor-plus-cross.svg').default,
  'cursor-rays-light':                require('@assets/svg/cursor-rays-light.svg').default,
  'keyboard-arrows-icon':             require('@assets/svg/keyboard-arrows-icon.svg').default,
  'magic-wand-sparkle':               require('@assets/svg/magic-wand-sparkle.svg').default,
};

const DEFAULT_CURSOR_TYPE: CursorType = 'cursor-pointer-classic';

function getCursorSvg(type: CursorType): ComponentType<SvgProps> {
  // A persisted cursorType from an older app version may not exist any more,
  // so never index the component map without a fallback.
  return CURSOR_SVG_COMPONENTS[type] ?? CURSOR_SVG_COMPONENTS[DEFAULT_CURSOR_TYPE];
}

// Fixed icon size for the cursor-type grid — deliberate: the cursor-size slider
// must affect the preview box only, not every tile in the list.
const CURSOR_LIST_ICON_SIZE = 26;

// ─── Cursor categories ──────────────────────────────────────────────────────

interface CursorEntry {
  type: CursorType;
  label: string;
}

interface CursorCategory {
  name: string;
  entries: CursorEntry[];
}

const CURSOR_CATEGORIES: CursorCategory[] = [
  {
    name: 'Pointers',
    entries: [
      { type: 'cursor-pointer-classic',     label: 'Classic' },
      { type: 'cursor-pointer-standard',    label: 'Standard' },
      { type: 'cursor-pointer-nested',      label: 'Nested' },
      { type: 'cursor-pointer-small',       label: 'Small' },
      { type: 'cursor-alt-thick-pointer',   label: 'Alt Thick' },
      { type: 'cursor-simple-triangle',     label: 'Triangle' },
      { type: 'pointer-cursor-detailed',    label: 'Detailed' },
      { type: 'pointer-cursor-settings',    label: 'Settings' },
      { type: 'pointer-hand-cursor',        label: 'Hand Cursor' },
    ],
  },
  {
    name: 'Hands',
    entries: [
      { type: 'hand-pointing-index',  label: 'Pointing' },
      { type: 'hand-open-palm',       label: 'Open Palm' },
      { type: 'hand-open-fingers',    label: 'Open Fingers' },
      { type: 'hand-grab-cursor',     label: 'Grab' },
      { type: 'hand-grab-closed',     label: 'Grab Closed' },
      { type: 'hand-click-cursor',    label: 'Click' },
    ],
  },
  {
    name: 'Click Effects',
    entries: [
      { type: 'cursor-click-crosshair',         label: 'Crosshair' },
      { type: 'cursor-click-target-corners',    label: 'Target' },
      { type: 'cursor-click-burst-fill',        label: 'Burst' },
      { type: 'cursor-click-lines',             label: 'Lines' },
      { type: 'cursor-click-sparkle-crosshair', label: 'Sparkle Cross' },
      { type: 'cursor-click-sparkle-dots',      label: 'Sparkle Dots' },
    ],
  },
  {
    name: 'Text & Edit',
    entries: [
      { type: 'text-cursor-i-beam-round',  label: 'I-Beam Round' },
      { type: 'text-cursor-i-beam-serif',  label: 'I-Beam Serif' },
      { type: 'pencil-edit-cursor',         label: 'Pencil' },
      { type: 'cursor-edit-pencil',         label: 'Edit Pencil' },
      { type: 'edit-pen-cursor-filled',     label: 'Pen Filled' },
      { type: 'edit-pen-cursor-outline',    label: 'Pen Outline' },
    ],
  },
  {
    name: 'Movement',
    entries: [
      { type: 'move-arrows-4way',           label: '4-Way' },
      { type: 'move-arrows-cross',          label: 'Cross' },
      { type: 'move-arrows-cross-circle',   label: 'Cross Circle' },
      { type: 'move-arrows-horizontal',     label: 'Horizontal' },
      { type: 'move-arrows-large',          label: 'Large' },
      { type: 'cursor-move-diagonal-down',  label: 'Diagonal' },
      { type: 'drag-drop-arrows',           label: 'Drag Drop' },
    ],
  },
  {
    name: 'Scroll',
    entries: [
      { type: 'scroll-arrows-vertical',         label: 'Vertical' },
      { type: 'scroll-arrows-vertical-outline', label: 'Vertical Outline' },
      { type: 'scroll-arrows-horizontal',       label: 'Horizontal' },
      { type: 'scroll-arrows-down',             label: 'Down' },
      { type: 'scroll-arrows-4way',             label: '4-Way' },
      { type: 'cursor-arrow-scroll-wheel',      label: 'Scroll Wheel' },
      { type: 'cursor-arrow-scroll-wheel-gray', label: 'Scroll Gray' },
    ],
  },
  {
    name: 'Special',
    entries: [
      { type: 'magic-wand-sparkle',      label: 'Magic Wand' },
      { type: 'cursor-rays-light',       label: 'Rays' },
      { type: 'cursor-gps-location',     label: 'GPS' },
      { type: 'cursor-pixel-block',      label: 'Pixel' },
      { type: 'cursor-plus-add',         label: 'Plus Add' },
      { type: 'cursor-plus-cross',       label: 'Plus Cross' },
      { type: 'cursor-diagonal-line',    label: 'Diagonal Line' },
      { type: 'keyboard-arrows-icon',    label: 'Keyboard' },
    ],
  },
];

// Selectable cursor colours. The fresh-install default (the app accent) has to
// be one of them, otherwise a new install shows a cursor colour that matches no
// swatch and the palette renders with nothing marked as selected.
const CURSOR_COLORS = [
  '#2c2b2b', '#444', '#8a8a8a', '#ffffff',
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#3498db', '#9b59b6', '#e91e63', '#00bcd4',
  DEFAULT_CURSOR_COLOR,
];




// ─── Small shared pieces ───────────────────────────────────────────────────

/** Material checkmark — used by selected tiles and color swatches. */
function CheckIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill={color} />
    </Svg>
  );
}

/** Display label for a cursor type, e.g. 'cursor-pointer-classic' → 'Classic'. */
function cursorTypeLabel(type: CursorType): string {
  for (const category of CURSOR_CATEGORIES) {
    const hit = category.entries.find((e) => e.type === type);
    if (hit) return hit.label;
  }
  return type;
}

/** Relative luminance of a hex color: 0 (black) → 1 (white). */
function hexLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Checkmark color for a color swatch: dark ink on light swatches, white on
 * dark ones — keeps the selection mark readable on all 12 palette entries.
 */
function swatchCheckColor(hex: string): string {
  return hexLuminance(hex) > 0.55 ? '#2c2b2b' : '#ffffff';
}

/**
 * Scrim disc color behind the swatch checkmark: a translucent overlay that
 * darkens light swatches and lightens dark ones, so the check sits on a
 * high-contrast disc no matter the swatch fill.
 */
function swatchScrimColor(hex: string): string {
  return hexLuminance(hex) > 0.55 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';
}

// ─── SliderRow (reusable) ──────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, onChange, unit, colors,
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; unit: string;
  colors: ReturnType<typeof useAppColors>;
}) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.sliderValue, { color: colors.accent }]}>{Math.round(value)}{unit}</Text>
      </View>
      <Slider
        style={{ width: '100%', height: 32 }}
        minimumValue={min}
        maximumValue={max}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.inputBg}
        thumbTintColor={colors.accent}
      />
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useAppColors();
  const t = useTranslation();
  const [a11yEnabled, setA11yEnabled] = useState<boolean | null>(null);
  const [overlayGranted, setOverlayGranted] = useState<boolean | null>(null);

  const checkA11yStatus = () => {
    QyKey.isAccessibilityEnabled()
      .then((ok) => setA11yEnabled(ok))
      .catch(() => {});
  };

  const checkOverlayStatus = () => {
    QyKey.isOverlayGranted()
      .then((ok) => setOverlayGranted(ok))
      .catch(() => {});
  };

  useEffect(() => {
    checkA11yStatus();
    checkOverlayStatus();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkA11yStatus();
        checkOverlayStatus();
      }
    });
    return () => sub.remove();
  }, []);

  const hapticEnabled    = useSettingsStore((s) => s.hapticEnabled);
  const soundEnabled      = useSettingsStore((s) => s.soundEnabled);
  const toggleHaptic        = useSettingsStore((s) => s.toggleHaptic);
  const toggleSound          = useSettingsStore((s) => s.toggleSound);

  const autoCorrect        = useSettingsStore((s) => s.autoCorrect);
  const showSuggestions    = useSettingsStore((s) => s.showSuggestions);
  const toggleAutoCorrect     = useSettingsStore((s) => s.toggleAutoCorrect);
  const toggleShowSuggestions  = useSettingsStore((s) => s.toggleShowSuggestions);

  const keyHeight             = useSettingsStore((s) => s.keyHeight);
  const setKeyHeight           = useSettingsStore((s) => s.setKeyHeight);
  const keyBorderRadius         = useSettingsStore((s) => s.keyBorderRadius);
  const setKeyBorderRadius       = useSettingsStore((s) => s.setKeyBorderRadius);
  const fontSize                   = useSettingsStore((s) => s.fontSize);
  const setFontSize                 = useSettingsStore((s) => s.setFontSize);

  const cursorType            = useSettingsStore((s) => s.cursorType);
  const cursorColor           = useSettingsStore((s) => s.cursorColor);
  const cursorSize            = useSettingsStore((s) => s.cursorSize);
  const setCursorType           = useSettingsStore((s) => s.setCursorType);
  const setCursorColor          = useSettingsStore((s) => s.setCursorColor);
  const setCursorSize            = useSettingsStore((s) => s.setCursorSize);

  const CursorPreview = getCursorSvg(cursorType);

  const cardStyle = {
    backgroundColor: colors.card,
    borderTopColor: colors.cardBorderTL,
    borderLeftColor: colors.cardBorderTL,
    borderBottomColor: colors.cardBorderBR,
    borderRightColor: colors.cardBorderBR,
    shadowColor: colors.cardShadow,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.settingsTitle}</Text>

        {/* ── Feedback ──────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>{t.feedback}</Text>
        <View style={[styles.card, cardStyle]}>
          <ToggleRow label={t.hapticFeedback} description={t.hapticDescription} value={hapticEnabled} onValueChange={toggleHaptic} />
          <ToggleRow label={t.keySounds} description={t.keySoundsDescription} value={soundEnabled} onValueChange={toggleSound} />
        </View>

        {/* ── Typing ───────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>{t.typing}</Text>
        <View style={[styles.card, cardStyle]}>
          <ToggleRow label={t.autoCorrect} description={t.autoCorrectDescription} value={autoCorrect} onValueChange={toggleAutoCorrect} />
          <ToggleRow label={t.showSuggestions} description={t.showSuggestionsDescription} value={showSuggestions} onValueChange={toggleShowSuggestions} />
        </View>

        {/* ── Key Size ─────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>{t.keySize}</Text>
        <View style={[styles.card, cardStyle]}>
          <SliderRow label={t.keyHeight} value={keyHeight} min={24} max={60} onChange={setKeyHeight} unit="dp" colors={colors} />
          <SliderRow label={t.cornerRadius} value={keyBorderRadius} min={0} max={16} onChange={setKeyBorderRadius} unit="dp" colors={colors} />
          <SliderRow label={t.fontSize} value={fontSize} min={12} max={22} onChange={setFontSize} unit="sp" colors={colors} />
        </View>

        {/* ── Cursor ───────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>{t.cursorType}</Text>
        {CURSOR_CATEGORIES.map((category) => (
          <View key={category.name}>
            <Text style={[styles.categoryLabel, { color: colors.textMuted }]}>{category.name}</Text>
            <View style={styles.cursorTypeGrid}>
              {category.entries.map(({ type, label }) => {
                const Svg = getCursorSvg(type);
                const isSelected = cursorType === type;
                return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.cursorTypeCard,
                    { backgroundColor: colors.card, borderTopColor: colors.cardBorderTL, borderLeftColor: colors.cardBorderTL, borderBottomColor: colors.cardBorderBR, borderRightColor: colors.cardBorderBR, shadowColor: colors.cardShadow },
                    isSelected
                      ? { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.inputBg }
                      : undefined,
                  ]}
                  onPress={() => setCursorType(type)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${category.name}: ${label}`}
                  accessibilityState={isSelected ? { selected: true } : {}}
                >
                  {/* Icon layer: absolutely positioned over the tile's padding box
                      and centred on both axes, so the glyph lands in the exact
                      middle of its container box instead of depending on how the
                      tile flex-lays-out a fixed-size child. */}
                  <View style={styles.cursorTypeIcon}>
                    <Svg
                      width={CURSOR_LIST_ICON_SIZE}
                      height={CURSOR_LIST_ICON_SIZE}
                      color={isSelected ? colors.accent : colors.textMuted}
                    />
                  </View>
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: colors.accent }]}>
                      <CheckIcon size={10} color={colors.buttonText} />
                    </View>
                  )}
                </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>
          {t.cursorColor}
          <Text style={[styles.selectedInline, { color: colors.accent }]}>
            {'  '}{cursorColor.toUpperCase()}
          </Text>
        </Text>
        <View style={styles.colorPalette}>
          {CURSOR_COLORS.map((c) => {
            const isSelected = cursorColor === c;
            return (
              // Selection ring cell: the outer wrapper carries the accent ring
              // with a transparent gap between it and the swatch, so the ring
              // stays visible even when the swatch fill matches the accent.
              <View
                key={c}
                style={[styles.swatchRingCell, isSelected && { borderColor: colors.accent }]}
              >
                <TouchableOpacity
                  style={[styles.colorSwatch, { backgroundColor: c }]}
                  onPress={() => setCursorColor(c)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={c}
                  accessibilityState={isSelected ? { selected: true } : {}}
                >
                  {isSelected && (
                    // Scrim disc behind the check keeps it readable on any
                    // of the 12 palette fills.
                    <View style={[styles.swatchCheckScrim, { backgroundColor: swatchScrimColor(c) }]}>
                      <CheckIcon size={14} color={swatchCheckColor(c)} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>{t.cursorSize}</Text>
        <View style={[styles.card, cardStyle]}>
          <View style={styles.previewMetaRow}>
            <Text style={[styles.previewMetaLabel, { color: colors.textMuted }]}>{t.preview}</Text>
            <View style={styles.previewMetaRight}>
              <Text style={[styles.previewMetaValue, { color: colors.accent }]}>{cursorTypeLabel(cursorType)} · {t.selected}</Text>
              <View style={[styles.previewMetaSwatch, { backgroundColor: cursorColor, borderColor: colors.cardBorderTL }]} />
              <Text style={[styles.previewMetaValue, { color: colors.accent }]}>{cursorColor.toUpperCase()}</Text>
            </View>
          </View>
          <View style={[styles.cursorSizePreview, { backgroundColor: colors.inputBg, borderTopColor: colors.cardBorderTL, borderLeftColor: colors.cardBorderTL, borderBottomColor: colors.cardBorderBR, borderRightColor: colors.cardBorderBR }]}>
            <CursorPreview width={cursorSize} height={cursorSize} color={cursorColor} />
          </View>
          <SliderRow label={t.size} value={cursorSize} min={12} max={48} onChange={setCursorSize} unit="px" colors={colors} />
        </View>

        {/* ── Display over other apps ─────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>{t.displayOverOtherApps}</Text>
        <View style={[styles.card, cardStyle]}>
          <View style={[styles.a11yRow, { borderBottomColor: colors.separator }]}>
            <Text style={[styles.a11yLabel, { color: colors.textSecondary }]}>{t.overlayPermission}</Text>
            <Text style={[styles.a11yValue, { color: overlayGranted ? colors.accent : colors.textMuted }]}>
              {overlayGranted === null ? t.checking : overlayGranted ? t.granted : t.notGranted}
            </Text>
          </View>
          <Pressable style={({ pressed }) => [styles.a11yButton, { backgroundColor: colors.accent, borderTopColor: colors.cardBorderTL, borderLeftColor: colors.cardBorderTL, borderBottomColor: colors.cardBorderBR, borderRightColor: colors.cardBorderBR, shadowColor: colors.cardShadow }, pressed && styles.a11yButtonPressed]} onPress={() => QyKey.openOverlaySettings()}>
            <Text style={[styles.a11yButtonText, { color: colors.buttonText }]}>{t.openOverlaySettings}</Text>
          </Pressable>
          {overlayGranted === false && <Text style={[styles.a11yHint, { color: colors.textMuted }]}>{t.overlayHint}</Text>}
        </View>

        {/* ── Accessibility ────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>{t.accessibility}</Text>
        <View style={[styles.card, cardStyle]}>
          <View style={[styles.a11yRow, { borderBottomColor: colors.separator }]}>
            <Text style={[styles.a11yLabel, { color: colors.textSecondary }]}>{t.accessibilityService}</Text>
            <Text style={[styles.a11yValue, { color: a11yEnabled ? colors.accent : colors.textMuted }]}>
              {a11yEnabled === null ? t.checking : a11yEnabled ? t.enabled : t.disabled}
            </Text>
          </View>
          <Pressable style={({ pressed }) => [styles.a11yButton, { backgroundColor: colors.accent, borderTopColor: colors.cardBorderTL, borderLeftColor: colors.cardBorderTL, borderBottomColor: colors.cardBorderBR, borderRightColor: colors.cardBorderBR, shadowColor: colors.cardShadow }, pressed && styles.a11yButtonPressed]} onPress={() => QyKey.openAccessibilitySettings()}>
            <Text style={[styles.a11yButtonText, { color: colors.buttonText }]}>{t.openAccessibilitySettings}</Text>
          </Pressable>
          {a11yEnabled === false && <Text style={[styles.a11yHint, { color: colors.textMuted }]}>{t.accessibilityHint}</Text>}
        </View>

        <Text style={[styles.footnote, { color: colors.textMuted }]}>{t.settingsFootnote}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { padding: 20, paddingTop: 12 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 20 },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginTop: 16, letterSpacing: 0.5 },
  card: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderBottomWidth: 2, borderRightWidth: 2, shadowOffset: { width: -3, height: -3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
  sliderRow: { marginBottom: 16 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sliderLabel: { fontSize: 13 },
  sliderValue: { fontSize: 13, fontWeight: '600' },
  categoryLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 2 },
  cursorTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 0 },
  // Icon layer fills the whole tile and centres the glyph on both axes, so the
  // SVG always sits in the middle of its container box.
  cursorTypeIcon: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  selectedBadge: { position: 'absolute', top: -7, right: -7, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  selectedInline: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  previewMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  previewMetaLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewMetaRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewMetaValue: { fontSize: 12, fontWeight: '600' },
  previewMetaSwatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  // Fixed height (was a 30%-wide square): the tile now hugs its icon, so the
  // icons of a group stay close together and the next group's label sits right
  // below them instead of after a tall band of empty tile.
  cursorTypeCard: { width: '30%', height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderBottomWidth: 2, borderRightWidth: 2, shadowOffset: { width: -2, height: -2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 4 },
  colorPalette: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 4 },
  swatchRingCell: { padding: 4, borderRadius: 22, borderWidth: 2, borderColor: 'transparent' },
  swatchCheckScrim: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopColor: 'rgba(0,0,0,0.12)', borderLeftColor: 'rgba(0,0,0,0.12)', borderBottomWidth: 2, borderRightWidth: 2, borderBottomColor: 'rgba(255,255,255,0.6)', borderRightColor: 'rgba(255,255,255,0.6)', shadowColor: '#000', shadowOffset: { width: -2, height: -2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  cursorSizePreview: { alignItems: 'center', justifyContent: 'center', height: 56, marginBottom: 4, borderRadius: 8, borderTopWidth: 2, borderLeftWidth: 2, borderBottomWidth: 1, borderRightWidth: 1 },
  a11yRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  a11yLabel: { fontSize: 15 },
  a11yValue: { fontSize: 13, fontWeight: '600' },
  a11yButton: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderBottomWidth: 2, borderRightWidth: 2, shadowOffset: { width: -2, height: -2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
  a11yButtonPressed: { transform: [{ translateY: 1 }], borderTopWidth: 2, borderLeftWidth: 2, borderBottomWidth: 0, borderRightWidth: 0, shadowOffset: { width: 1, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1, elevation: 2 },
  a11yButtonText: { fontSize: 14, fontWeight: '700' },
  a11yHint: { fontSize: 12, lineHeight: 17, paddingBottom: 12 },
  footnote: { fontSize: 12, textAlign: 'center', marginTop: 24 },
});

