// Bot pathfinding: a 1-unit grid of where a plush can walk (walls too tall to hop are blocked,
// widened by a plush's radius), and A* over it. Built once per map; paths are short lists of
// waypoints the bot walks between. Deterministic, like everything in the sim.
import { config } from '../config.ts';
import type { MapData, Vec2 } from '../types.ts';
import type { World } from '../world.ts';

const CELL = 1;
/** A wall at least this tall can't be hopped (a jump clears about 1.5). */
const TALL = 1.4;
/** Walls are widened by this much: a plush's radius plus a little room. */
const CLEARANCE = config.player.radius + 0.15;
/** Give up searching after this many cells (an unreachable goal shouldn't cost much). */
const MAX_EXPANDED = 9000;

interface Grid {
  cols: number;
  rows: number;
  blocked: Uint8Array;
}

const grids = new WeakMap<MapData, Grid>();

function gridFor(map: MapData): Grid {
  let g = grids.get(map);
  if (g) return g;
  const cols = Math.ceil(map.width / CELL);
  const rows = Math.ceil(map.height / CELL);
  const blocked = new Uint8Array(cols * rows);
  for (const w of map.walls) {
    // Beach balls roll out of the way; only fixed walls block a path.
    if (w.height < TALL || w.kind === 'ball') continue;
    const x0 = Math.max(0, Math.floor((w.x - CLEARANCE) / CELL));
    const x1 = Math.min(cols - 1, Math.floor((w.x + w.w + CLEARANCE) / CELL));
    const y0 = Math.max(0, Math.floor((w.y - CLEARANCE) / CELL));
    const y1 = Math.min(rows - 1, Math.floor((w.y + w.h + CLEARANCE) / CELL));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // The cell's center must be within the widened box to count as blocked.
        const cx = (x + 0.5) * CELL;
        const cy = (y + 0.5) * CELL;
        if (cx > w.x - CLEARANCE && cx < w.x + w.w + CLEARANCE && cy > w.y - CLEARANCE && cy < w.y + w.h + CLEARANCE) {
          blocked[y * cols + x] = 1;
        }
      }
    }
  }
  g = { cols, rows, blocked };
  grids.set(map, g);
  return g;
}

function cellOf(g: Grid, p: Vec2): number {
  const x = Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / CELL)));
  const y = Math.min(g.rows - 1, Math.max(0, Math.floor(p.y / CELL)));
  return y * g.cols + x;
}

/** The nearest open cell to `cell` (a goal or start just inside a widened wall). */
function nearestOpen(g: Grid, cell: number): number {
  if (!g.blocked[cell]) return cell;
  const cx = cell % g.cols;
  const cy = Math.floor(cell / g.cols);
  for (let r = 1; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) continue;
        if (!g.blocked[y * g.cols + x]) return y * g.cols + x;
      }
    }
  }
  return cell;
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
] as const;

/**
 * Waypoints from `from` to `to` around tall walls (the goal itself last), or null when there's
 * no way (or it's too far to search). Corners are cut: only the turning points are kept.
 */
export function findPath(world: World, from: Vec2, to: Vec2): Vec2[] | null {
  const g = gridFor(world.map);
  // Off the map (out in the water): no grid there; go straight.
  if (from.x < 0 || from.y < 0 || from.x >= world.map.width || from.y >= world.map.height) return [to];
  const start = nearestOpen(g, cellOf(g, from));
  const goal = nearestOpen(g, cellOf(g, to));
  if (start === goal) return [to];
  const n = g.cols * g.rows;
  const cost = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const gx = goal % g.cols;
  const gy = Math.floor(goal / g.cols);
  const h = (c: number) => {
    const dx = Math.abs((c % g.cols) - gx);
    const dy = Math.abs(Math.floor(c / g.cols) - gy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  // A small binary heap of [priority, cell].
  const heap: number[] = [];
  const push = (pri: number, c: number) => {
    heap.push(pri, c);
    let i = heap.length / 2 - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p * 2]! <= heap[i * 2]!) break;
      [heap[p * 2], heap[i * 2]] = [heap[i * 2]!, heap[p * 2]!];
      [heap[p * 2 + 1], heap[i * 2 + 1]] = [heap[i * 2 + 1]!, heap[p * 2 + 1]!];
      i = p;
    }
  };
  const pop = (): number => {
    const top = heap[1]!;
    const lastPri = heap[heap.length - 2]!;
    const lastCell = heap[heap.length - 1]!;
    heap.length -= 2;
    if (heap.length > 0) {
      heap[0] = lastPri;
      heap[1] = lastCell;
      let i = 0;
      const size = heap.length / 2;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < size && heap[l * 2]! < heap[m * 2]!) m = l;
        if (r < size && heap[r * 2]! < heap[m * 2]!) m = r;
        if (m === i) break;
        [heap[m * 2], heap[i * 2]] = [heap[i * 2]!, heap[m * 2]!];
        [heap[m * 2 + 1], heap[i * 2 + 1]] = [heap[i * 2 + 1]!, heap[m * 2 + 1]!];
        i = m;
      }
    }
    return top;
  };

  cost[start] = 0;
  push(h(start), start);
  let expanded = 0;
  while (heap.length > 0) {
    const c = pop();
    if (c === goal) break;
    if (++expanded > MAX_EXPANDED) return null;
    const cx = c % g.cols;
    const cy = Math.floor(c / g.cols);
    for (const [dx, dy, step] of DIRS) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) continue;
      const nb = y * g.cols + x;
      if (g.blocked[nb]) continue;
      // No squeezing diagonally between two blocked cells.
      if (dx !== 0 && dy !== 0 && (g.blocked[cy * g.cols + x] || g.blocked[y * g.cols + cx])) continue;
      const nc = cost[c]! + step;
      if (nc < cost[nb]!) {
        cost[nb] = nc;
        came[nb] = c;
        push(nc + h(nb), nb);
      }
    }
  }
  if (came[goal] === -1) return null;

  // Walk back, keeping only cells where the direction changes.
  const cells: number[] = [];
  for (let c = goal; c !== start; c = came[c]!) cells.push(c);
  cells.reverse();
  const points: Vec2[] = [];
  let prevDir = -1;
  let prev = start;
  for (const c of cells) {
    const dir = (c - prev) | 0;
    if (dir !== prevDir && prev !== start) points.push(center(g, prev));
    prevDir = dir;
    prev = c;
  }
  points.push({ x: to.x, y: to.y });
  return points;
}

function center(g: Grid, c: number): Vec2 {
  return { x: ((c % g.cols) + 0.5) * CELL, y: (Math.floor(c / g.cols) + 0.5) * CELL };
}

/** Whether a plush can walk straight from `a` to `b` without meeting a tall wall (grid check). */
export function clearWalk(world: World, a: Vec2, b: Vec2): boolean {
  const g = gridFor(world.map);
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.ceil(d / (CELL * 0.5));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (p.x < 0 || p.y < 0 || p.x >= world.map.width || p.y >= world.map.height) continue;
    if (g.blocked[cellOf(g, p)]) return false;
  }
  return true;
}
