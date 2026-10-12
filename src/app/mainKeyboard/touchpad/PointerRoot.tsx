// ============================================================
// PointerRoot.tsx — the "QyKeyPointer" React surface.
//
// A small static mouse arrow rendered in its own overlay window.
// It NEVER re-renders while moving: native (PointerOverlay) owns
// the position and only calls WindowManager.updateViewLayout().
//
// preserveAspectRatio="xMinYMin meet" pins the arrow's tip to the
// window's top-left corner — that corner is the cursor hotspot
// (where M3 will dispatch clicks).
// ============================================================

import React, { useEffect } from 'react';
import { View, StyleSheet, NativeModules } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// FontAwesome 5 solid "mouse-pointer" (viewBox 0 0 320 512)
const ARROW_D =
  'M302.189 329.126H196.105l55.831 135.993c3.889 9.428-.555 19.999-9.444 23.999l-49.165 21.427c-9.165 4-19.443-.571-23.332-9.714l-53.053-129.136-86.664 89.138C18.729 472.71 0 463.554 0 447.977V18.299C0 1.899 19.921-6.096 30.277 5.443l284.412 292.542c11.472 11.179 3.007 31.141-12.5 31.141z';

export default function PointerRoot() {
  // Same readiness signal the IME and floating-panel roots send: lets native
  // resume the keyboard ReactHost so Fabric applies this surface's mount
  // items (see PointerOverlay.resumeHostWhenReady).
  useEffect(() => {
    try {
      const p = NativeModules.QyKey?.keyboardReady?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
      console.warn('[QyKey] PointerRoot keyboardReady failed:', e);
    }
  }, []);

  return (
    <View style={styles.root} pointerEvents="none">
      <Svg
        width={32}
        height={32}
        viewBox="0 0 320 512"
        preserveAspectRatio="xMinYMin meet"
      >
        {/* drop shadow (offset slightly, drawn first) */}
        <Path d={ARROW_D} fill="rgba(0,0,0,0.35)" transform="translate(12,14)" />
        {/* white body + thin dark outline */}
        <Path d={ARROW_D} fill="#ffffff" stroke="#1a1a2e" strokeWidth={14} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent', // nothing but the arrow
  },
});
