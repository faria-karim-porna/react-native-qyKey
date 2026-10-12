import { NativeModules } from 'react-native';

/**
 * Plays the optional key-click sound.
 * Silently does nothing if sound is disabled (the Kotlin side checks the preference).
 * Called from useKeyboardState.handleKeyPress() alongside hapticManager.vibrate().
 */
export function playKeySound(): void {
  try {
    NativeModules.QyKey?.playKeySound();
  } catch {
    // Ignore — sound is optional and should never crash the keyboard
  }
}
