// =========================================
// WIRE CLASS (ported from qykey/helper/Wire.ts)
// =========================================

import { Cell } from './Cell';
import { config, directions } from './config';

const { floor, random } = Math;
export class Wire {
  pathCells: Cell[] = [];

  constructor(startCell: Cell) {
    startCell.isFree = false;
    this.pathCells.push(startCell);
  }

  canMoveWithoutCrossing(
    currentCell: Cell,
    targetDirIndex: number,
    cellLookup: { [key: string]: Cell },
  ): boolean {
    const straightDirections = [0, 2, 4, 6];
    if (straightDirections.includes(targetDirIndex)) return true;

    if (targetDirIndex === 1) {
      const topCell =
        cellLookup[`${currentCell.x},${currentCell.y - 1}`]?.isFree ?? true;
      const rightCell =
        cellLookup[`${currentCell.x + 1},${currentCell.y}`]?.isFree ?? true;
      return topCell && rightCell;
    }
    if (targetDirIndex === 3) {
      const bottomCell =
        cellLookup[`${currentCell.x},${currentCell.y + 1}`]?.isFree ?? true;
      const rightCell =
        cellLookup[`${currentCell.x + 1},${currentCell.y}`]?.isFree ?? true;
      return bottomCell && rightCell;
    }
    if (targetDirIndex === 5) {
      const bottomCell =
        cellLookup[`${currentCell.x},${currentCell.y + 1}`]?.isFree ?? true;
      const leftCell =
        cellLookup[`${currentCell.x - 1},${currentCell.y}`]?.isFree ?? true;
      return bottomCell && leftCell;
    }
    if (targetDirIndex === 7) {
      const topCell =
        cellLookup[`${currentCell.x},${currentCell.y - 1}`]?.isFree ?? true;
      const leftCell =
        cellLookup[`${currentCell.x - 1},${currentCell.y}`]?.isFree ?? true;
      return topCell && leftCell;
    }
    return false;
  }

  grow(
    totalRows: number,
    totalCols: number,
    allCells: Cell[],
    cellLookup: { [key: string]: Cell },
  ): void {
    let currentWireLength = this.pathCells.length;
    while (currentWireLength < config().maxWireLength) {
      const lastCellInWire = this.pathCells[this.pathCells.length - 1];
      const directionChoices = random() < 0.5 ? [0, 1, -1] : [0, -1, 1];
      let hasAnyDirectionChoices = directionChoices.length > 0;

      while (hasAnyDirectionChoices) {
        const totalChoices = directionChoices.length;
        const randomValue = random();
        const biasedRandom = Math.pow(randomValue, config().straightBias);
        const randomIndex = floor(biasedRandom * totalChoices);
        const directionOffset = directionChoices.splice(randomIndex, 1)[0];

        let nextDirectionIndex =
          lastCellInWire.directionIndex + directionOffset;
        nextDirectionIndex =
          nextDirectionIndex < 0
            ? 8 + nextDirectionIndex
            : nextDirectionIndex % 8;
        hasAnyDirectionChoices = directionChoices.length > 0;

        const nextDirection = directions()[nextDirectionIndex];
        const nextX = lastCellInWire.x + nextDirection[0];
        const nextY = lastCellInWire.y + nextDirection[1];
        const nextCellIndex = nextY * totalCols + nextX;
        const nextCell =
          nextCellIndex >= 0 && nextCellIndex < allCells.length
            ? allCells[nextCellIndex]
            : null;

        if (
          nextX < 0 ||
          nextX >= totalCols ||
          nextY < 0 ||
          nextY >= totalRows ||
          !nextCell ||
          !nextCell.isFree ||
          !this.canMoveWithoutCrossing(
            lastCellInWire,
            nextDirectionIndex,
            cellLookup,
          )
        ) {
          continue;
        }

        nextCell.isFree = false;
        nextCell.directionIndex = nextDirectionIndex;
        this.pathCells.push(nextCell);
        currentWireLength++;
        break;
      }

      if (directionChoices.length === 0) {
        break;
      }
    }
  }

  getPathData(cellSize: number): string {
    if (this.pathCells.length === 0) return '';

    let pathString = '';
    for (let i = 0; i < this.pathCells.length; i += 1) {
      const cur = this.pathCells[i];
      const x = cur.x * cellSize + cellSize / 2;
      const y = cur.y * cellSize + cellSize / 2;

      if (i === 0) {
        pathString = `M ${x} ${y}`;
      } else {
        pathString += ` L ${x} ${y}`;
      }
    }
    return pathString;
  }

  getStartDot(cellSize: number): { cx: number; cy: number } {
    const cur = this.pathCells[0];
    return {
      cx: cur.x * cellSize + cellSize / 2,
      cy: cur.y * cellSize + cellSize / 2,
    };
  }

  getEndDot(cellSize: number): { cx: number; cy: number } {
    const cur = this.pathCells[this.pathCells.length - 1];
    return {
      cx: cur.x * cellSize + cellSize / 2,
      cy: cur.y * cellSize + cellSize / 2,
    };
  }
}
