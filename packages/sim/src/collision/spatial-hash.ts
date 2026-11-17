import type { Box } from '../types.ts';

const OFFSET = 1024;
const key = (cx: number, cy: number) => (cx + OFFSET) * 4096 + (cy + OFFSET);

/**
 * Uniform grid over static boxes (walls). A query returns the indices of boxes whose cells
 * overlap the query rectangle, sorted ascending so callers iterate deterministically.
 */
export class StaticBoxHash {
  private readonly cells = new Map<number, number[]>();
  private readonly stamp: Uint32Array;
  private queryId = 0;

  constructor(
    readonly boxes: readonly Box[],
    private readonly cellSize = 4,
  ) {
    this.stamp = new Uint32Array(boxes.length);
    boxes.forEach((b, i) => {
      const [x0, y0, x1, y1] = this.range(b.x, b.y, b.x + b.w, b.y + b.h);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const k = key(cx, cy);
          let cell = this.cells.get(k);
          if (!cell) this.cells.set(k, (cell = []));
          cell.push(i);
        }
      }
    });
  }

  query(minX: number, minY: number, maxX: number, maxY: number): number[] {
    const out: number[] = [];
    const id = ++this.queryId;
    const [x0, y0, x1, y1] = this.range(minX, minY, maxX, maxY);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.cells.get(key(cx, cy));
        if (!cell) continue;
        for (const i of cell) {
          if (this.stamp[i] === id) continue;
          this.stamp[i] = id;
          out.push(i);
        }
      }
    }
    return out.sort((a, b) => a - b);
  }

  private range(minX: number, minY: number, maxX: number, maxY: number): [number, number, number, number] {
    const s = this.cellSize;
    return [Math.floor(minX / s), Math.floor(minY / s), Math.floor(maxX / s), Math.floor(maxY / s)];
  }
}
