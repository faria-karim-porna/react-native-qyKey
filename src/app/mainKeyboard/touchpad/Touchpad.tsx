// ============================================================
// Touchpad.tsx — Multi-touch trackpad surface.
// Now accepts themeColors for dynamic styling.
// ============================================================

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, PanResponder, Pressable, NativeSyntheticEvent, NativeTouchEvent, PixelRatio } from 'react-native';
import { createKeyboardStyles } from '../../../../assets/styles/dynamicStyles';
import { FA5Icon } from '../keyboard/KeyIcons';
import type { KeyboardThemeColors } from '../../../hooks/useKeyboardTheme';

export interface TouchpadProps {
  onScrollPage?: (direction: 'up' | 'down') => void;
  onScrollRepeatStart?: (direction: 'up' | 'down') => void;
  onScrollRepeatEnd?: () => void;
  onNavigateHistory?: (direction: 'backward' | 'forward') => Promise<boolean> | boolean;
  onMouseClick?: (button: 'left' | 'right') => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  tapToClick?: boolean;
  onPointerShow?: () => Promise<boolean> | boolean;
  onPointerHide?: () => void;
  onPointerMove?: (dx: number, dy: number) => void;
  onRequestPointerPermission?: () => void;
  themeColors: KeyboardThemeColors;
}

interface TouchPoint {
  id: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
}

const PX_PER_DP = PixelRatio.get();

export default function Touchpad({
  onScrollPage,
  onScrollRepeatStart,
  onScrollRepeatEnd,
  onNavigateHistory,
  onMouseClick,
  onDragStart,
  onDragEnd,
  tapToClick = true,
  onPointerShow,
  onPointerHide,
  onPointerMove,
  onRequestPointerPermission,
  themeColors,
}: TouchpadProps) {
  const styles = useMemo(() => createKeyboardStyles(themeColors), [themeColors]);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [forwardHint, setForwardHint] = useState(false);
  const [touchIndicator, setTouchIndicator] = useState<{ x: number; y: number } | null>(null);

  const onScrollPageRef = useRef(onScrollPage);
  const onNavigateHistoryRef = useRef(onNavigateHistory);
  const onMouseClickRef = useRef(onMouseClick);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const onPointerMoveRef = useRef(onPointerMove);
  const onPointerShowRef = useRef(onPointerShow);
  const onPointerHideRef = useRef(onPointerHide);
  const onRequestPointerPermissionRef = useRef(onRequestPointerPermission);
  const tapToClickRef = useRef(tapToClick);

  useEffect(() => {
    onScrollPageRef.current = onScrollPage;
    onNavigateHistoryRef.current = onNavigateHistory;
    onMouseClickRef.current = onMouseClick;
    onDragStartRef.current = onDragStart;
    onDragEndRef.current = onDragEnd;
    onPointerMoveRef.current = onPointerMove;
    onPointerShowRef.current = onPointerShow;
    onPointerHideRef.current = onPointerHide;
    onRequestPointerPermissionRef.current = onRequestPointerPermission;
    tapToClickRef.current = tapToClick;
  }, [onScrollPage, onScrollRepeatStart, onScrollRepeatEnd, onNavigateHistory,
      onMouseClick, onDragStart, onDragEnd, tapToClick,
      onPointerMove, onPointerShow, onPointerHide, onRequestPointerPermission]);

  const touchDownRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);
  const twoFingerTapRef = useRef<{
    time: number;
    startX1: number;
    startY1: number;
    startX2: number;
    startY2: number;
    moved: boolean;
  } | null>(null);

  const TAP_MAX_MS = 350;
  const TAP_MAX_DP = 10;

  const touchesRef = useRef<Map<string, TouchPoint>>(new Map());
  const lastSingleTouchPosRef = useRef<{ pageX: number; pageY: number } | null>(null);
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const scrollAccumulatorRef = useRef({ x: 0, y: 0 });
  const pendingDelta = useRef({ x: 0, y: 0 });
  const rafPending = useRef(false);

  const SCROLL_THRESHOLD_PX = 18;
  const SENSITIVITY = 1.25;

  // ── Touchpad button handlers ─────────────────────────────────────────
  // All five physical buttons route through here. Every handler touches its
  // prop through a ref so the handlers stay referentially stable (the Key
  // components are memoized and the pan-responder path reads stale closures
  // otherwise).

  /** Nav ◀ — history back. Uses the a11y service (GLOBAL_ACTION_BACK); falls
   *  back to a DPAD-left key event on the focused text field. */
  const handleNavBackward = useCallback(() => {
    onNavigateHistoryRef.current?.('backward');
  }, []);

  /** Nav ▶ — history forward. Resolves false when unsupported (a11y off);
   *  shows the transient hint in that case. */
  const handleNavForward = useCallback(() => {
    const result = onNavigateHistoryRef.current?.('forward');
    Promise.resolve(result)
      .then((handled) => {
        // `false` = native said unsupported; `null`/`undefined` = prop absent.
        // In all falsy cases show the hint so the user knows something failed.
        if (!handled) {
          setForwardHint(true);
          setTimeout(() => setForwardHint(false), 1500);
        }
      })
      .catch(() => {});
  }, []);

  /** Scroll ▲ — one page up; long-press auto-repeats via useKeyboardState. */
  const handleScrollUp = useCallback(() => {
    onScrollPageRef.current?.('up');
  }, []);
  const handleScrollUpRepeatStart = useCallback(() => {
    onScrollRepeatStart?.('up');
  }, [onScrollRepeatStart]);

  /** Scroll ▼ — one page down; long-press auto-repeats via useKeyboardState. */
  const handleScrollDown = useCallback(() => {
    onScrollPageRef.current?.('down');
  }, []);
  const handleScrollDownRepeatStart = useCallback(() => {
    onScrollRepeatStart?.('down');
  }, [onScrollRepeatStart]);
  const handleScrollRepeatEnd = useCallback(() => {
    onScrollRepeatEnd?.();
  }, [onScrollRepeatEnd]);

  /** L button press — arm a native drag at the cursor (tap on release if the
   *  pointer never moved → plain left click). */
  const handleLButtonDown = useCallback(() => {
    onDragStartRef.current?.();
  }, []);

  /** L button release — dispatch the accumulated drag stroke (or tap). */
  const handleLButtonUp = useCallback(() => {
    onDragEndRef.current?.();
  }, []);

  /** R button — right click: long-press at the cursor (context menu). */
  const handleRightClick = useCallback(() => {
    onMouseClickRef.current?.('right');
  }, []);

  const flushPointerMove = useCallback(() => {
    rafPending.current = false;
    const { x, y } = pendingDelta.current;
    pendingDelta.current = { x: 0, y: 0 };
    if (x !== 0 || y !== 0) {
      onPointerMoveRef.current?.(x, y);
    }
  }, []);

  const showPointerAndCheck = useCallback(() => {
    const result = onPointerShowRef.current?.();
    Promise.resolve(result)
      .then((ok) => setShowPermissionBanner(ok === false))
      .catch(() => setShowPermissionBanner(false));
  }, []);

  useEffect(() => {
    showPointerAndCheck();
    return () => onPointerHideRef.current?.();
  }, [showPointerAndCheck]);

  const cleanupTouchpadGesture = useCallback(() => {
    touchesRef.current.clear();
    touchDownRef.current = null;
    hasMovedRef.current = false;
    lastSingleTouchPosRef.current = null;
    lastCenterRef.current = null;
    scrollAccumulatorRef.current = { x: 0, y: 0 };
    setTouchIndicator(null);
    twoFingerTapRef.current = null;
    pendingDelta.current = { x: 0, y: 0 };
    rafPending.current = false;
  }, []);

  const surfacePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: (evt: NativeSyntheticEvent<NativeTouchEvent>) => {
        const { touches, changedTouches } = evt.nativeEvent;
        const activeTouches = (touches && touches.length > 0)
          ? touches
          : (changedTouches && changedTouches.length > 0)
            ? changedTouches
            : [{ identifier: 0, locationX: evt.nativeEvent.locationX, locationY: evt.nativeEvent.locationY, pageX: evt.nativeEvent.pageX, pageY: evt.nativeEvent.pageY }];
        const now = Date.now();

        hasMovedRef.current = false;
        touchesRef.current.clear();
        activeTouches.forEach((t) => {
          const id = String(t.identifier ?? 0);
          touchesRef.current.set(id, { id, x: t.locationX, y: t.locationY, startX: t.locationX, startY: t.locationY, startTime: now });
        });

        const touchCount = activeTouches.length;

        if (touchCount === 1) {
          const touch = activeTouches[0];
          touchDownRef.current = {
            time: now,
            x: touch.locationX ?? touch.pageX,
            y: touch.locationY ?? touch.pageY,
          };
          setTouchIndicator({ x: touch.locationX, y: touch.locationY });
          lastSingleTouchPosRef.current = { pageX: touch.pageX, pageY: touch.pageY };
          pendingDelta.current = { x: 0, y: 0 };
          rafPending.current = false;
          twoFingerTapRef.current = null;
        } else if (touchCount === 2) {
          const t1 = activeTouches[0];
          const t2 = activeTouches[1];
          lastCenterRef.current = {
            x: (t1.pageX + t2.pageX) / 2,
            y: (t1.pageY + t2.pageY) / 2,
          };
          scrollAccumulatorRef.current = { x: 0, y: 0 };
          lastSingleTouchPosRef.current = null;
          setTouchIndicator(null);
          twoFingerTapRef.current = {
            time: now,
            startX1: t1.pageX,
            startY1: t1.pageY,
            startX2: t2.pageX,
            startY2: t2.pageY,
            moved: false,
          };
        } else {
          lastSingleTouchPosRef.current = null;
          setTouchIndicator(null);
          twoFingerTapRef.current = null;
        }
      },

      onPanResponderMove: (evt: NativeSyntheticEvent<NativeTouchEvent>) => {
        const { touches, changedTouches } = evt.nativeEvent;
        const activeTouches = (touches && touches.length > 0)
          ? touches
          : (changedTouches && changedTouches.length > 0)
            ? changedTouches
            : [{ identifier: 0, locationX: evt.nativeEvent.locationX, locationY: evt.nativeEvent.locationY, pageX: evt.nativeEvent.pageX, pageY: evt.nativeEvent.pageY }];
        const touchCount = activeTouches.length;

        if (touchCount === 1) {
          const touch = activeTouches[0];
          setTouchIndicator({ x: touch.locationX, y: touch.locationY });

          const prev = lastSingleTouchPosRef.current;
          if (prev) {
            const dx = (touch.pageX - prev.pageX) * SENSITIVITY * PX_PER_DP;
            const dy = (touch.pageY - prev.pageY) * SENSITIVITY * PX_PER_DP;

            pendingDelta.current.x += dx;
            pendingDelta.current.y += dy;

            if (!rafPending.current) {
              rafPending.current = true;
              requestAnimationFrame(flushPointerMove);
            }

            if (!hasMovedRef.current) {
              const id = String(touch.identifier ?? 0);
              const initial = touchesRef.current.get(id);
              if (initial) {
                const travelled = Math.hypot(touch.locationX - initial.startX, touch.locationY - initial.startY);
                if (travelled > TAP_MAX_DP) hasMovedRef.current = true;
              } else if (touchDownRef.current) {
                const travelled = Math.hypot((touch.locationX ?? touch.pageX) - touchDownRef.current.x, (touch.locationY ?? touch.pageY) - touchDownRef.current.y);
                if (travelled > TAP_MAX_DP) hasMovedRef.current = true;
              }
            }
          }
          lastSingleTouchPosRef.current = { pageX: touch.pageX, pageY: touch.pageY };
        } else if (touchCount === 2) {
          setTouchIndicator(null);
          hasMovedRef.current = true;
          lastSingleTouchPosRef.current = null;
          const t1 = activeTouches[0];
          const t2 = activeTouches[1];
          const center = { x: (t1.pageX + t2.pageX) / 2, y: (t1.pageY + t2.pageY) / 2 };

          if (twoFingerTapRef.current) {
            const disp1 = Math.hypot(t1.pageX - twoFingerTapRef.current.startX1, t1.pageY - twoFingerTapRef.current.startY1);
            const disp2 = Math.hypot(t2.pageX - twoFingerTapRef.current.startX2, t2.pageY - twoFingerTapRef.current.startY2);
            if (disp1 > TAP_MAX_DP * 2 || disp2 > TAP_MAX_DP * 2) {
              twoFingerTapRef.current.moved = true;
            }
          }

          if (lastCenterRef.current) {
            const deltaY = center.y - lastCenterRef.current.y;
            scrollAccumulatorRef.current.y += deltaY;

            while (scrollAccumulatorRef.current.y >= SCROLL_THRESHOLD_PX) {
              onScrollPageRef.current?.('down');
              scrollAccumulatorRef.current.y -= SCROLL_THRESHOLD_PX;
            }
            while (scrollAccumulatorRef.current.y <= -SCROLL_THRESHOLD_PX) {
              onScrollPageRef.current?.('up');
              scrollAccumulatorRef.current.y += SCROLL_THRESHOLD_PX;
            }
          }
          lastCenterRef.current = center;
        } else {
          setTouchIndicator(null);
          lastSingleTouchPosRef.current = null;
        }
      },

      onPanResponderRelease: (evt: NativeSyntheticEvent<NativeTouchEvent>) => {
        const { changedTouches, touches } = evt.nativeEvent;
        const now = Date.now();

        // 1. Two-finger tap → right click
        if (twoFingerTapRef.current) {
          const { time, moved } = twoFingerTapRef.current;
          twoFingerTapRef.current = null;
          if (!moved && now - time < 400) {
            onMouseClickRef.current?.('right');
            cleanupTouchpadGesture();
            return;
          }
        }

        // 2. Single-finger tap → left click
        const trackedCount = touchesRef.current.size;
        if (trackedCount === 1 && tapToClickRef.current && !hasMovedRef.current) {
          const down = touchDownRef.current;
          const touch = (changedTouches && changedTouches.length > 0)
            ? changedTouches[0]
            : (touches && touches.length > 0)
              ? touches[0]
              : null;
          if (down && touch) {
            const duration = now - down.time;
            const endX = touch.locationX ?? touch.pageX;
            const endY = touch.locationY ?? touch.pageY;
            const dist = Math.hypot(endX - down.x, endY - down.y);
            if (duration <= TAP_MAX_MS && dist <= TAP_MAX_DP) {
              onMouseClickRef.current?.('left');
            }
          }
        }

        cleanupTouchpadGesture();
      },

      onPanResponderTerminate: () => {
        cleanupTouchpadGesture();
      },
    }),
  ).current;

  return (
    <View style={styles.touchpadContainer}>
      <View
        style={[styles.touchpadSurface, { overflow: 'hidden', position: 'relative' }]}
        {...surfacePanResponder.panHandlers}
      >
        {touchIndicator && (
          <View
            style={{
              position: 'absolute',
              left: touchIndicator.x - 12,
              top: touchIndicator.y - 12,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: `${themeColors.themePrimary}26`,
              borderWidth: 1,
              borderColor: `${themeColors.themePrimary}66`,
              pointerEvents: 'none',
            }}
          />
        )}
      </View>

      {showPermissionBanner && (
        <View
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            zIndex: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 6,
          }}
        >
          <Pressable onPress={showPointerAndCheck}>
            <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>
              Mouse pointer hidden — enable "Display over other apps"
            </Text>
          </Pressable>
          <Pressable onPress={() => onRequestPointerPermissionRef.current?.()}>
            <Text style={{ color: themeColors.themePrimary, fontSize: 9, fontWeight: 'bold', textAlign: 'center', marginTop: 4 }}>
              GRANT →
            </Text>
          </Pressable>
        </View>
      )}

      {forwardHint && (
        <View
          style={{
            position: 'absolute',
            bottom: 78,
            alignSelf: 'center',
            zIndex: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>
            Forward not available — tap a text field first
          </Text>
        </View>
      )}

      <View style={styles.touchpadButtons}>
        <View style={styles.touchpadButtonArea}>
          <TouchpadButton
            variant="nav"
            themeColors={themeColors}
            label="Back"
            onPress={handleNavBackward}
          >
            <FA5Icon name="chevron-left" size={12} color={themeColors.keyText} />
          </TouchpadButton>
          <TouchpadButton
            variant="mouse"
            themeColors={themeColors}
            label="Left click (hold and move on the pad to drag)"
            onPress={handleLButtonDown}
            onPressOut={handleLButtonUp}
          >
            <Text style={[styles.btnText, { color: themeColors.keyText }]}>L</Text>
          </TouchpadButton>
        </View>

        <View style={styles.scrollStack}>
          <TouchpadButton
            variant="scroll"
            themeColors={themeColors}
            label="Scroll up"
            onPress={handleScrollUp}
            repeatStart={handleScrollUpRepeatStart}
            repeatEnd={handleScrollRepeatEnd}
          >
            <FA5Icon name="caret-up" size={14} color={themeColors.keyText} />
          </TouchpadButton>
          <TouchpadButton
            variant="scroll"
            themeColors={themeColors}
            label="Scroll down"
            onPress={handleScrollDown}
            repeatStart={handleScrollDownRepeatStart}
            repeatEnd={handleScrollRepeatEnd}
          >
            <FA5Icon name="caret-down" size={14} color={themeColors.keyText} />
          </TouchpadButton>
        </View>

        <View style={styles.touchpadButtonArea}>
          <TouchpadButton
            variant="nav"
            themeColors={themeColors}
            label="Forward"
            onPress={handleNavForward}
          >
            <FA5Icon name="chevron-right" size={12} color={themeColors.keyText} />
          </TouchpadButton>
          <TouchpadButton
            variant="mouse"
            themeColors={themeColors}
            label="Right click"
            onPress={handleRightClick}
          >
            <Text style={[styles.btnText, { color: themeColors.keyText }]}>R</Text>
          </TouchpadButton>
        </View>
      </View>
    </View>
  );
}

// ─── TouchpadButton ─────────────────────────────────────────────────────────

interface TouchpadButtonProps {
  variant: 'nav' | 'scroll' | 'mouse';
  themeColors: KeyboardThemeColors;
  /** Accessibility label announced by screen readers. */
  label: string;
  /** Fired on press-in (immediate, like a physical mouse button). */
  onPress: () => void;
  /** Fired on release (used by the L button to end a drag). */
  onPressOut?: () => void;
  /** Long-press auto-repeat start (scroll keys). */
  repeatStart?: () => void;
  /** Long-press auto-repeat end. */
  repeatEnd?: () => void;
  children?: React.ReactNode;
}

/**
 * A single touchpad control button.
 *
 * Presses are handled on PRESS-IN (not press-release) so actions fire the
 * moment the finger lands — matching physical mouse-button feel and avoiding
 * the dead zone a Pressable-onPress can hit when a parent pan-responder
 * claims the gesture. Press-out still fires repeat-end / drag-end so held
 * interactions terminate correctly even if the finger slides off the button.
 */
function TouchpadButton({
  variant,
  themeColors,
  label,
  onPress,
  onPressOut,
  repeatStart,
  repeatEnd,
  children,
}: TouchpadButtonProps) {
  const styles = useMemo(() => createKeyboardStyles(themeColors), [themeColors]);
  const pressRef = useRef(onPress);
  const pressOutRef = useRef(onPressOut);
  const repeatStartRef = useRef(repeatStart);
  const repeatEndRef = useRef(repeatEnd);

  useEffect(() => {
    pressRef.current = onPress;
    pressOutRef.current = onPressOut;
    repeatStartRef.current = repeatStart;
    repeatEndRef.current = repeatEnd;
  }, [onPress, onPressOut, repeatStart, repeatEnd]);

  return (
    <Pressable
      unstable_pressDelay={0}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      onPressIn={() => {
        pressRef.current?.();
        repeatStartRef.current?.();
      }}
      onPressOut={() => {
        repeatEndRef.current?.();
        pressOutRef.current?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.key,
        typeVariantStyle(variant, styles),
        pressed && styles.keyPressed,
      ]}
    >
      {({ pressed }) => (
        <View style={styles.touchpadButtonContent} pointerEvents="none">
          {children}
        </View>
      )}
    </Pressable>
  );
}

function typeVariantStyle(
  variant: 'nav' | 'scroll' | 'mouse',
  styles: ReturnType<typeof createKeyboardStyles>
) {
  switch (variant) {
    case 'nav':
      return styles.navBtn;
    case 'scroll':
      return styles.scrollBtn;
    case 'mouse':
      return styles.mouseBtn;
  }
}
