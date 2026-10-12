// ============================================================
// KeyboardScreen.tsx — root of the QyKey keyboard bundle.
//
// Renders the qykey-style "chocolate bar" keyboard (fixed light
// look, compact keys) wired to the native QyKey IME module.
// ============================================================

import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import Keyboard from './keyboard/Keyboard';

export default function KeyboardScreen() {
  return (
    <ErrorBoundary>
      <Keyboard />
    </ErrorBoundary>
  );
}
