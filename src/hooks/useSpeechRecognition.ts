// ============================================================
// useSpeechRecognition.ts — mic-button bridge for the keyboard bundle.
//
// Uses the SAME native module as qykey (`expo-speech-recognition`),
// but imports it from `expo-modules-core` directly instead of the
// `expo` package — importing 'expo' would run Expo.fx, which pulls
// in the winter runtime + expo-asset side effects that this custom
// IME ReactHost does not need (and that risk breaking the bundle).
//
// Bootstrap note: `requireOptionalNativeModule` calls
// `ensureNativeModulesAreInstalled()` first, which creates the
// `ExpoModulesCore` TurboModule and installs the `globalThis.expo`
// JSI host object (module registry + EventEmitter). Because of that,
// `globalThis.expo.EventEmitter` must only be read lazily — AFTER
// the module has been required — never at module scope.
// ============================================================

import { useEffect, useRef } from 'react';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * The native ExpoSpeechRecognition module, or null when the native
 * module is not available in this process (degrades gracefully to the
 * old "not available" stub behavior instead of crashing the keyboard).
 */
export const ExpoSpeechRecognitionModule: any =
  requireOptionalNativeModule('ExpoSpeechRecognition');

function getEventEmitter(): any {
  const expoGlobal = (globalThis as any).expo;
  if (!expoGlobal?.EventEmitter) {
    throw new Error('[QyKey] expo-modules-core EventEmitter is not available');
  }
  return new expoGlobal.EventEmitter(ExpoSpeechRecognitionModule);
}

/**
 * Subscribes to a native speech-recognition event ('start' | 'result' |
 * 'error' | 'end'). Mirrors expo-speech-recognition's
 * useSpeechRecognitionEvent (listener kept in a ref so the subscription
 * is not torn down on every render).
 */
export function useSpeechRecognitionEvent(
  eventName: string,
  listener: (event: any) => void,
) {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!ExpoSpeechRecognitionModule) return;
    const emitter = getEventEmitter();
    const subscription = emitter.addListener(eventName, (event: any) =>
      listenerRef.current(event),
    );
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName]);
}
