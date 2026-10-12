// keyboard.index.js — Keyboard Bundle Entry Point
//
// This is the entry point for the keyboard-only bundle loaded inside
// QyKeyInputMethodService. It must import NOTHING from the companion app.
//
// ⚠️  This file MUST remain .js — React Native's bundler resolves
//     keyboard.index.js as the entry file for the keyboard bundle.

import React, { useEffect, useState } from 'react';
import { AppRegistry, LogBox, NativeModules, NativeEventEmitter } from 'react-native';
import KeyboardScreen from './src/app/mainKeyboard/KeyboardScreen';
import FloatingPanel from './src/app/mainKeyboard/FloatingPanel';
import PointerRoot from './src/app/mainKeyboard/touchpad/PointerRoot';

// Suppress non-critical warnings in the keyboard bundle
LogBox.ignoreLogs([
  'NativeEventEmitter',
  'new NativeEventEmitter()',
]);

// Global error handler — logs to logcat so bundle-level crashes are diagnosable
const defaultHandler =
  global.ErrorUtils?.getGlobalHandler?.() ?? (() => {});

global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
  console.error(`[QyKey JS ${isFatal ? 'FATAL' : 'ERROR'}]`, error?.message, error?.stack);
  defaultHandler(error, isFatal);
});

// Catch unhandled promise rejections
if (global.HermesInternal == null) {
  // Non-Hermes fallback (shouldn't happen, but just in case)
} else if (typeof global.Promise !== 'undefined') {
  const origReject = global.Promise.reject;
  if (!global.__qykeyPromisePatched) {
    global.__qykeyPromisePatched = true;
    global.Promise.reject = function (reason) {
      console.error('[QyKey] Unhandled promise rejection:', reason);
      return origReject.call(this, reason);
    };
  }
}

/**
 * Fabric mount-pipeline pump — THE fix for the "jsReady=true children=0" black keyboard.
 *
 * Verified against the RN 0.86.2 sources in node_modules:
 *  - Every C++ mount transaction produced by a React commit is queued by
 *    `RuntimeScheduler_Modern::scheduleRenderingUpdate()` into
 *    `pendingRenderingUpdates_` (RuntimeScheduler_Modern.cpp).
 *  - That queue is drained ONLY inside `RuntimeScheduler_Modern::updateRendering()`,
 *    which runs exclusively at the END of a JS event-loop task (executeEventLoopTask).
 *  - A normal app's JS keeps scheduling work (timers, rAF, animations, ...), so the
 *    mount transaction is flushed on the next task and `FabricMountingManager::
 *    executeMount()` → `FabricUIManager.scheduleMountItem()` delivers the items to Java.
 *  - The keyboard bundle is STATIC: after the initial runApplication + commit there is
 *    nothing left on the JS event loop, so the mount transaction is never executed and
 *    the ReactSurfaceView keeps 0 children forever — while JS (jsReady=true), the
 *    ReactHost lifecycle (RESUMED), the ReactContext (RESUMED) and the Choreographer
 *    frame pump (framePump=alive) are all perfectly healthy.
 *
 * This interval is a no-op callback that keeps ONE event-loop task in flight at all
 * times. Every tick ends with `updateRendering()`, which drains any pending mount
 * transactions and delivers them to Java, where the (jsReady-gated) resumed
 * DispatchUIFrameCallback applies them to the surface view. 33ms ≈ 30fps is plenty for
 * a keyboard, and the same mechanism guarantees every LATER commit (key presses, layout
 * switches, suggestions) is flushed promptly instead of silently stalling again.
 */
const MOUNT_PUMP_INTERVAL_MS = 16; // ~60fps — flush Fabric mount transactions promptly

// ── Early mount-pipeline pump ─────────────────────────────────────────────────
// Start the pump at MODULE LOAD time (before React renders) so the very first
// Fabric commit's mount transactions are flushed immediately, without waiting
// for a useEffect to register the interval after React mount.
// See the comment above for a full explanation of WHY this pump is necessary.
const _mountPumpId = setInterval(() => {
  // No-op by design — the mere existence of this callback keeps the JS event
  // loop alive; updateRendering() runs at the end of each task and drains the
  // pending Fabric mount-transaction queue.
}, MOUNT_PUMP_INTERVAL_MS);

// Remount counter: bumped to force a REAL remount (via the `key` below) so React emits
// a complete set of CREATE/INSERT mount mutations — a guaranteed-fresh Fabric transaction.
// A plain re-render with an identical tree produces NO mutations at all, which is why the
// previous tick-based forceRerender did nothing.
let _rerenderCounter = 0;

function QyKeyKeyboardRoot() {
  // Used as the `key` of the KeyboardScreen subtree. Bumping it UNMOUNTS and REMOUNTS
  // the whole keyboard, generating a brand-new mount transaction.
  const [mountNonce, setMountNonce] = useState(0);

  // Tell the native IME service that the JS keyboard actually mounted and is
  // rendering. The native watchdog uses this to distinguish a working keyboard
  // from a surface that started but never mounted (blank keyboard).
  useEffect(() => {
    try {
      const p = NativeModules.QyKey?.keyboardReady?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
      console.warn('[QyKey] keyboardReady failed:', e);
    }
  }, []);

  // ── Mount-pipeline pump diagnostic ──────────────────────────────────────────
  // The pump itself is started at module scope (above) so it fires before the
  // first React commit. Here we just notify native that the pump is active so
  // the watchdog error text can distinguish "JS fix not deployed" from
  // "pipeline still blocked downstream".
  useEffect(() => {
    try {
      const p = NativeModules.QyKey?.notifyPumpActive?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
      console.warn('[QyKey] notifyPumpActive failed:', e);
    }
  }, []);

  // Listen for the native forceRerender event. This is emitted by the IME watchdog
  // while the JS has mounted but Fabric still reports children=0. We respond with a
  // REAL remount (key change) so a complete new set of CREATE/INSERT mount mutations
  // is generated for the (now pumping) event loop to flush — fixing any case where the
  // very first commit's mount transaction was lost before the surface was fully up.
  useEffect(() => {
    if (!NativeModules.QyKey) return;
    const emitter = new NativeEventEmitter(NativeModules.QyKey);
    const sub = emitter.addListener('qykey_forceRerender', () => {
      _rerenderCounter++;
      setMountNonce(_rerenderCounter);
    });
    return () => sub.remove();
  }, []);

  return <KeyboardScreen key={mountNonce} />;
}

/**
 * Register the keyboard UI component.
 * The name 'QyKeyKeyboard' MUST match the second argument of
 * host.createSurface() in QyKeyInputMethodService.kt
 */
AppRegistry.registerComponent('QyKeyKeyboard', () => QyKeyKeyboardRoot);

/**
 * Register the floating-panel component for the accessibility service.
 * The name 'QyKeyOverlay' MUST match the second argument of
 * host.createSurface() in QyKeyAccessibilityService.kt
 */
AppRegistry.registerComponent('QyKeyOverlay', () => FloatingPanel);

/**
 * Register the cursor component for the system-wide pointer.
 * The name 'QyKeyPointer' MUST match the second argument of
 * host.createSurface() in PointerOverlay.kt
 */
AppRegistry.registerComponent('QyKeyPointer', () => PointerRoot);
