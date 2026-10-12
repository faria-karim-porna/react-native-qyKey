// =========================================
// CELL CLASS (ported from qykey/helper/Cell.ts)
// =========================================
const { floor, random } = Math;
export class Cell {
  x: number;
  y: number;
  isFree: boolean;
  directionIndex: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.isFree = true;
    this.directionIndex = floor(random() * 8);
  }
}
