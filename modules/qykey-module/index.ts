import { NativeModules } from 'react-native';

const { QyKey } = NativeModules;

export default {
  // ── Phase 1 ───────────────────────────────────────────────────────────────
  isDefaultKeyboard:    (): Promise<boolean>            => QyKey.isDefaultKeyboard(),
  isKeyboardEnabled:    (): Promise<boolean>            => QyKey.isKeyboardEnabled(),
  openKeyboardSettings: (): void                        => QyKey.openKeyboardSettings(),

  /** Shows the system "Choose input method" picker to set the current keyboard. */
  showInputMethodPicker: (): void                       => QyKey.showInputMethodPicker(),

  // ── Phase 2 ───────────────────────────────────────────────────────────────
  commitKey:       (code: string, language: string): Promise<void> => QyKey.commitKey(code, language),
  sendBackspace:   (): Promise<void>                               => QyKey.sendBackspace(),
  commitSpace:     (): Promise<void>                               => QyKey.commitSpace(),
  sendEnter:       (): Promise<void>                               => QyKey.sendEnter(),
  sendSpecialKey:  (key: string): Promise<void>                    => QyKey.sendSpecialKey(key),
  getPreferences:  (): Promise<Record<string, any>>               => QyKey.getPreferences(),
  savePreferences: (p: Record<string, any>): Promise<void>        => QyKey.savePreferences(p),

  // ── Phase 3 ───────────────────────────────────────────────────────────────
  flushBanglaBuffer: (): Promise<void>              => QyKey.flushBanglaBuffer(),
  setBanglaEnabled:  (e: boolean): Promise<void>    => QyKey.setBanglaEnabled(e),

  // ── Phase 4 ───────────────────────────────────────────────────────────────

  /**
   * Replaces the current partial word with [word] + space.
   * Records the choice in UserWordModel for future frequency boosting.
   * Called when the user taps a suggestion chip in SuggestionBar.
   */
  commitSuggestion: (word: string): Promise<void> =>
    QyKey.commitSuggestion(word),

  // ── Phase 5: Custom dictionary ─────────────────────────────────────────────

  /** Replaces the entire custom dictionary with [words]. */
  setDictionaryWords: (words: string[]): Promise<void> =>
    QyKey.setDictionaryWords(words),

  /** Returns the current custom dictionary word list. */
  getDictionaryWords: (): Promise<string[]> =>
    QyKey.getDictionaryWords(),

  /** Removes a single word from the custom dictionary. */
  removeDictionaryWord: (word: string): Promise<void> =>
    QyKey.removeDictionaryWord(word),

  /** Stores per-language custom dictionaries. */
  setCustomDictionary: (enWords: string[], bnWords: string[]): Promise<void> =>
    QyKey.setCustomDictionary(enWords, bnWords),

  /** Returns custom dictionary words for a specific language ('en' or 'bn'). */
  getCustomDictionary: (lang: string): Promise<string[]> =>
    QyKey.getCustomDictionary(lang),

  // ── Phase 6: Clipboard & Emoji history ───────────────────────────────────────

  /** Returns clipboard history, most recent first. */
  getClipboardHistory: (): Promise<string[]> =>
    QyKey.getClipboardHistory(),

  /** Clears the entire clipboard history. */
  clearClipboardHistory: (): Promise<void> =>
    QyKey.clearClipboardHistory(),

  /** Removes a single clipboard history entry. */
  removeClipboardItem: (text: string): Promise<void> =>
    QyKey.removeClipboardItem(text),

  /** Returns the recently used emoji list, most recent first. */
  getRecentEmojis: (): Promise<string[]> =>
    QyKey.getRecentEmojis(),

  /** Records that the user selected an emoji, for recent-tray ordering. */
  recordEmojiUsed: (emoji: string): Promise<void> =>
    QyKey.recordEmojiUsed(emoji),

  // ── Touchpad ──────────────────────────────────────────────────────────────

  /**
   * Moves the text cursor one step in the given direction using DPAD key events.
   * Call repeatedly (throttled) while the user drags on the touchpad surface.
   * direction: "left" | "right" | "up" | "down"
   */
  moveCursor: (direction: 'left' | 'right' | 'up' | 'down'): Promise<void> =>
    QyKey.moveCursor(direction),

  /**
   * Sends a PAGE_UP or PAGE_DOWN key event to scroll the focused view.
   * direction: "up" | "down"
   */
  scrollPage: (direction: 'up' | 'down'): Promise<void> =>
    QyKey.scrollPage(direction),

  /**
   * Back/Forward navigation.
   * - "backward" → system Back (GLOBAL_ACTION_BACK). Resolves true.
   * - "forward"  → best-effort scroll-forward on the focused node; resolves
   *   false when unsupported (no a11y API for Forward — pro mode in M4).
   */
  navigateHistory: (direction: 'backward' | 'forward'): Promise<boolean> =>
    QyKey.navigateHistory(direction),

  /**
   * Mouse button click at the current cursor position.
   * "left"  → real tap (dispatchGesture) via the accessibility service;
   *           text-field DPAD fallback when the service is off.
   * "right" → long-press at the cursor (context-menu equivalent).
   */
  mouseClick: (button: 'left' | 'right'): Promise<void> =>
    QyKey.mouseClick(button),

  // ── Touchpad: on-screen mouse pointer overlay ────────────────────────────────

  /**
   * Shows a desktop-style mouse pointer over the app screen (TYPE_APPLICATION_OVERLAY).
   * Resolves true when the pointer is visible. Requires "Display over other apps"
   * (SYSTEM_ALERT_WINDOW) — resolves false when the permission is not granted.
   */
  pointerShow: (): Promise<boolean> => QyKey.pointerShow(),

  /** Hides the on-screen mouse pointer overlay. */
  pointerHide: (): Promise<void> => QyKey.pointerHide(),

  /**
   * Moves the on-screen pointer by a RELATIVE (dx, dy) delta, clamped to the
   * visible app area. Called repeatedly while the user drags on the touchpad.
   */
  pointerMove: (dx: number, dy: number): Promise<void> =>
    QyKey.pointerMove(dx, dy),

  /**
   * Re-snaps the red touchpad overlay's bottom edge to the keyboard container's
   * real measured top (native measures it itself; [yPx] is unused). Safe to call
   * after layout changes (e.g. row-gap adjustments) to force an immediate re-snap.
   */
  pointerSetOverlayTopY: (yPx: number): Promise<void> =>
    QyKey.pointerSetOverlayTopY(yPx),

  /** Returns true when "Display over other apps" (SYSTEM_ALERT_WINDOW) is granted. */
  isOverlayGranted: (): Promise<boolean> => QyKey.isOverlayGranted(),

  /** Opens the system "Display over other apps" settings for this app. */
  openOverlaySettings: (): Promise<void> => QyKey.openOverlaySettings(),

  // ── Touchpad: IME strip mode + drag (M3) ────────────────────────────────

  /** Shrinks the IME window to a thin strip while touchpad mode is active. */
  setTouchpadMode: (on: boolean): Promise<void> => QyKey.setTouchpadMode(on),

  /** L button pressed — arm a drag at the cursor. */
  dragStart: (): Promise<void> => QyKey.dragStart(),

  /** L button released — dispatch a drag stroke (or a tap if nothing moved). */
  dragEnd: (): Promise<void> => QyKey.dragEnd(),

  // ── Accessibility service (M1) ──────────────────────────────────────────

  /** True when QyKeyAccessibilityService is enabled in system accessibility settings. */
  isAccessibilityEnabled: (): Promise<boolean> => QyKey.isAccessibilityEnabled(),

  /** Deep-links to the system accessibility settings screen. */
  openAccessibilitySettings: (): Promise<void> => QyKey.openAccessibilitySettings(),

  /** Shows the floating QyKey panel (a11y service process only). */
  showFloatingPanel: (): Promise<void> => QyKey.showFloatingPanel(),

  /** Hides the floating QyKey panel (used by the panel's close button). */
  hideFloatingPanel: (): Promise<void> => QyKey.hideFloatingPanel(),
};
