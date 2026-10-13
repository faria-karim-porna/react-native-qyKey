import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQyKeyBridge } from './useQyKeyBridge';

interface SetupStatus {
  isEnabled: boolean;
  isDefault: boolean;
  isOverlayGranted: boolean;
  /** True when the QyKey Accessibility service is enabled in system settings.
   *  Mandatory: the touchpad's cross-app actions (tap/click/scroll, Back/Forward)
   *  run through the accessibility service. */
  isAccessibilityEnabled: boolean;
  isFullySetUp: boolean;
  /** True until the first async bridge check has completed. */
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 2000;

export function useSetupStatus(): SetupStatus {
  const {
    isKeyboardEnabled,
    isDefaultKeyboard,
    isOverlayGranted: checkOverlay,
    isAccessibilityEnabled: checkA11y,
  } = useQyKeyBridge();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [isOverlayGranted, setIsOverlayGranted] = useState(false);
  const [isAccessibility, setIsAccessibility] = useState(false);
  // Start true so callers don't act on stale false values before the first check resolves.
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    const [enabled, def, overlay, a11y] = await Promise.all([
      isKeyboardEnabled(),
      isDefaultKeyboard(),
      checkOverlay(),
      checkA11y(),
    ]);
    setIsEnabled(enabled);
    setIsDefault(def);
    setIsOverlayGranted(overlay);
    setIsAccessibility(a11y);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refresh();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, []);

  return {
    isEnabled,
    isDefault,
    isOverlayGranted,
    isAccessibilityEnabled: isAccessibility,
    // A11y service is part of full setup (mandatory); overlay stays optional.
    isFullySetUp: isEnabled && isDefault && isAccessibility,
    isLoading,
    refresh,
  };
}
