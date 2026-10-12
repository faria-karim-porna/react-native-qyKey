// ============================================================
// MicrophoneIcon.tsx — the exact FontAwesome 5 "microphone" (solid)
// glyph that qykey renders via @expo/vector-icons FontAwesome5.
//
// qykey renders it at size 12 (#444), shrinking to 10 while the mic is
// active. Icon fonts can't be loaded in the IME process, so the same
// glyph (identical path data, viewBox 0 0 352 512, from FontAwesome
// Free 5.15.4 / CC BY 4.0) is drawn with react-native-svg instead.
//
// The fill color is passed in by the caller (themeColors.keyText) so the
// icon stays visible on dark keyboard themes; #444 is only the fallback.
// ============================================================

import React from 'react';
import Svg, { Path } from 'react-native-svg';

// FontAwesome Free 5.15.4 — svgs/solid/microphone.svg path data.
const MICROPHONE_PATH =
  'M176 352c53.02 0 96-42.98 96-96V96c0-53.02-42.98-96-96-96S80 42.98 80 96v160c0 53.02 42.98 96 96 96zm160-160h-16c-8.84 0-16 7.16-16 16v48c0 74.8-64.49 134.82-140.79 127.38C96.71 376.89 48 317.11 48 250.3V208c0-8.84-7.16-16-16-16H16c-8.84 0-16 7.16-16 16v40.16c0 89.64 63.97 169.55 152 181.69V464H96c-8.84 0-16 7.16-16 16v16c0 8.84 7.16 16 16 16h160c8.84 0 16-7.16 16-16v-16c0-8.84-7.16-16-16-16h-56v-33.77C285.71 418.47 352 344.9 352 256v-48c0-8.84-7.16-16-16-16z';

export default function MicrophoneIcon({
  active = false,
  color = '#444',
}: {
  active?: boolean;
  color?: string;
}) {
  const size = active ? 12 : 15;
  return (
    <Svg width={size * (352 / 512)} height={size} viewBox="0 0 352 512">
      <Path d={MICROPHONE_PATH} fill={color} />
    </Svg>
  );
}
