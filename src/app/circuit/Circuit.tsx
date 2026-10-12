// ============================================================
// Circuit.tsx — ported from qykey/components/Circuit/Circuit.tsx.
//
// Generates a circuit-board pattern of wires (grid walk with
// crossing avoidance) rendered as an SVG layer. The keyboard's
// translucent base sits on top of it, so the wires glow through
// behind the keys — the qykey look.
//
// Now accepts themeColors for dark mode support.
// ============================================================

import React, { useEffect, useState, useMemo } from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { createKeyboardStyles } from '../../../assets/styles/dynamicStyles';
import { config } from './config';
import { Cell } from './Cell';
import { Wire } from './Wire';
import { PathWithAnimation } from './PathWithAnimation';
import type { KeyboardThemeColors } from '../../hooks/useKeyboardTheme';

const { floor, random } = Math;

type WireShape = {
  pathData: string;
  startDot: { cx: number; cy: number };
  endDot: { cx: number; cy: number };
  isAnimated: boolean;
  pathLength: number;
  animationTime: number;
  radius: number;
  isFill: boolean;
};

type CircuitProps = {
  /** Set false to freeze the wires (e.g. while the emoji board is open). */
  animated?: boolean;
  /** Theme colors for dark mode support. */
  themeColors: KeyboardThemeColors;
  /** Optional custom grid cell size. */
  cellSize?: number;
};

const CircuitComponent = ({ animated = true, themeColors, cellSize }: CircuitProps) => {
  const [wires, setWires] = useState<WireShape[]>([]);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => {
    const win = Dimensions.get('window');
    return { width: win.width, height: win.height };
  });

  const cfg = useMemo(() => config(themeColors), [themeColors]);
  const styles = useMemo(() => createKeyboardStyles(themeColors), [themeColors]);

  useEffect(() => {
    generateWires();
  }, [dimensions, cfg, cellSize]);

  const generateWires = () => {
    const { width, height } = dimensions;
    if (width < 100 || height < 100) return;

    // Use larger cell size for full-screen background layouts so generation is instant
    const effectiveCellSize = cellSize ?? (height > 500 ? 14 : cfg.cellSize);

    const allCells: Cell[] = [];
    const cellLookup: { [key: string]: Cell } = {};
    const allWires: Wire[] = [];

    const totalRows = floor(height / effectiveCellSize);
    const totalCols = floor(width / effectiveCellSize);
    if (totalRows === 0 || totalCols === 0) return;

    let freeCellCount = totalRows * totalCols;

    for (let y = 0; y < totalRows; y += 1) {
      for (let x = 0; x < totalCols; x += 1) {
        const cell = new Cell(x, y);
        allCells.push(cell);
        cellLookup[`${x},${y}`] = cell;
      }
    }

    const newWires: WireShape[] = [];
    let attempts = 0;
    const maxAttempts = Math.min(totalRows * totalCols, 500);

    while (allWires.length < freeCellCount && attempts < maxAttempts) {
      attempts++;
      const randomIndex = floor(random() * allCells.length);
      const cell = allCells[randomIndex];
      if (!cell || !cell.isFree) continue;

      const wire = new Wire(cell);
      freeCellCount--;

      wire.grow(totalRows, totalCols, allCells, cellLookup);

      if (wire.pathCells.length >= 2) {
        const pathData = wire.getPathData(effectiveCellSize);
        const startDot = wire.getStartDot(effectiveCellSize);
        const endDot = wire.getEndDot(effectiveCellSize);

        let pathLength = 0;
        for (let i = 1; i < wire.pathCells.length; i++) {
          const prev = wire.pathCells[i - 1];
          const curr = wire.pathCells[i];
          const dx = Math.abs(curr.x - prev.x) * effectiveCellSize;
          const dy = Math.abs(curr.y - prev.y) * effectiveCellSize;
          pathLength += Math.sqrt(dx * dx + dy * dy);
        }

        const animationTime = pathLength / cfg.glowSpeed;
        const isAnimated = random() > 0.5;
        const radius = random() * (effectiveCellSize / 6) + effectiveCellSize / 12;
        const isFill = random() > 0.5;

        newWires.push({
          pathData,
          startDot,
          endDot,
          isAnimated,
          pathLength,
          animationTime,
          radius,
          isFill,
        });

        allWires.push(wire);
      } else {
        cell.isFree = true;
        freeCellCount++;
      }
    }

    setWires(newWires);
  };

  return (
    <View
      style={[styles.circuitContainer, { backgroundColor: cfg.bgColor }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0 && (width !== dimensions.width || height !== dimensions.height)) {
          setDimensions({ width, height });
        }
      }}
    >
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <Svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        >
          {wires.map((wire, index) => (
            <React.Fragment key={index}>
              {wire.isAnimated && (
                <Path
                  d={wire.pathData}
                  stroke={cfg.wireColor}
                  strokeWidth={wire.radius * 2}
                  fill="none"
                />
              )}

              <PathWithAnimation
                d={wire.pathData}
                color={wire.isAnimated ? cfg.glowBgColor : cfg.wireColor}
                width={wire.radius * 2}
                isAnimated={wire.isAnimated}
                pathLength={wire.pathLength}
                animationTime={wire.animationTime}
                paused={!animated}
              />

              <Circle
                cx={wire.startDot.cx}
                cy={wire.startDot.cy}
                r={wire.radius}
                stroke={cfg.wireColor}
                strokeWidth={wire.radius / 4}
                fill={wire.isFill ? cfg.wireColor : cfg.bgColor}
              />

              <Circle
                cx={wire.endDot.cx}
                cy={wire.endDot.cy}
                r={wire.radius}
                stroke={cfg.wireColor}
                strokeWidth={wire.radius / 2}
                fill={wire.isFill ? cfg.wireColor : cfg.bgColor}
              />
            </React.Fragment>
          ))}
        </Svg>
      ) : null}
    </View>
  );
};

export const Circuit = React.memo(CircuitComponent);
