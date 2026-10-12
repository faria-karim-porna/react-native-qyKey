// ============================================================
// FeatheredArrowKey.tsx — ported from qykey.
// Renders the same feathered arrow SVG shape used in the original
// qykey component: a "feathered" arrow (M12 4L4 20L12 16L20 20L12 4Z)
// rendered via react-native-svg, rotated per direction.
// ============================================================

import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const ROTATION: Record<'up' | 'down' | 'left' | 'right', string> = {
  up: '0deg',
  down: '180deg',
  left: '-90deg',
  right: '90deg',
};

const FeatheredArrowKeyComponent = ({
  direction,
  color = '#444',
}: {
  direction: 'up' | 'down' | 'left' | 'right';
  color?: string;
}) => {
  return (
    <View style={{ transform: [{ rotate: ROTATION[direction] }] }}>
      <Svg width="14" height="14" viewBox="0 0 24 24">
        <Path d="M12 4L4 20L12 16L20 20L12 4Z" fill={color} />
      </Svg>
    </View>
  );
};

export const FeatheredArrowKey = React.memo(FeatheredArrowKeyComponent);
