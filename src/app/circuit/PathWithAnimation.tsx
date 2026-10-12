// ============================================================
// PathWithAnimation.tsx — exact port of qykey/components/Circuit/
// PathWithAnimation.tsx.
//
// Uses react-native-reanimated (UI thread) to animate
// strokeDashoffset: a bright glow travels along animated wires
// (looping), static wires draw themselves in once. Reanimated 4
// needs the react-native-worklets babel plugin (babel.config.js)
// and the worklets TurboModule, which autolinks into the keyboard
// ReactHost's PackageList.
//
// `paused` freezes the wire in place (cancelAnimation) — used while
// the emoji board is open so the per-frame SVG redraw behind the
// translucent shell doesn't compete with the emoji FlatList scroll
// on the UI thread.
// ============================================================

import React, { useEffect } from 'react';
import { Path } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { config } from './config';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const PathWithAnimationComponent = ({
  d,
  color,
  width,
  isAnimated,
  pathLength,
  animationTime,
  paused,
}: {
  d: string;
  color: string;
  width: number;
  isAnimated: boolean;
  pathLength: number;
  animationTime: number;
  paused?: boolean;
}) => {
  const offset = useSharedValue(isAnimated ? 0 : pathLength);

  useEffect(() => {
    if (paused) {
      // Freeze the wire where it is. When unpaused the effect re-runs and
      // restarts the animation from the current value.
      cancelAnimation(offset);
      return;
    }

    if (isAnimated) {
      offset.value = withRepeat(
        withTiming(-(pathLength + config().glowLength), {
          duration: animationTime * 1000,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    } else {
      offset.value = withDelay(
        100,
        withTiming(0, {
          duration: 500,
          easing: Easing.in(Easing.ease),
        }),
      );
    }

    return () => {
      cancelAnimation(offset);
    };
  }, [isAnimated, animationTime, pathLength, offset, paused]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={width}
      fill="none"
      strokeDasharray={isAnimated ? [pathLength, 10] : [pathLength, pathLength]}
      animatedProps={animatedProps}
    />
  );
};

export const PathWithAnimation = React.memo(PathWithAnimationComponent);
