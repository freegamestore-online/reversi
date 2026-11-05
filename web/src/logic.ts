export type Player = 1 | 2; // 1 = black (you), 2 = white (AI)
export type Cell = 0 | Player;
export type Board = Cell[][];

export const N = 8;
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

// Positional weights — corners are gold, X-squares (next to corners) are poison
const WEIGHTS: ReadonlyArray<ReadonlyArray<number>> = [
  [100, -20, 10,  5,  5, 10, -20, 100],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [ 10,  -2,  1,  1,  1,  1,  -2,  10],
  [  5,  -2,  1,  1,  1,  1,  -2,   5],
  [  5,  -2,  1,  1,  1,  1,  -2,   5],
  [ 10,  -2,  1,  1,  1,  1,  -2,  10],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [100, -20, 10,  5,  5, 10, -20, 100],
];

export function initialBoard(): Board {
  const b: Board = Array.from({ length: N }, () => Array<Cell>(N).fill(0));
  b[3]![3] = 2; b[3]![4] = 1; b[4]![3] = 1; b[4]![4] = 2;
  return b;
}

export function flipsForMove(b: Board, r: number, c: number, p: Player): [number, number][] {
  if (b[r]![c] !== 0) return [];
  const opp = (p === 1 ? 2 : 1) as Player;
  const flips: [number, number][] = [];
  for (const [dr, dc] of DIRS) {
    let i = r + dr, j = c + dc;
    const line: [number, number][] = [];
    while (i >= 0 && i < N && j >= 0 && j < N && b[i]![j] === opp) {
      line.push([i, j]);
      i += dr; j += dc;
    }
    if (line.length > 0 && i >= 0 && i < N && j >= 0 && j < N && b[i]![j] === p) {
      flips.push(...line);
    }
  }
  return flips;
}

export function legalMoves(b: Board, p: Player): Map<string, [number, number][]> {
  const m = new Map<string, [number, number][]>();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const f = flipsForMove(b, r, c, p);
    if (f.length > 0) m.set(`${r},${c}`, f);
  }
  return m;
}

export function applyMove(b: Board, r: number, c: number, p: Player, flips: [number, number][]): Board {
  const nb = b.map((row) => row.slice());
  nb[r]![c] = p;
  for (const [i, j] of flips) nb[i]![j] = p;
  return nb;
}

export function count(b: Board): { black: number; white: number } {
  let black = 0, white = 0;
  for (const row of b) for (const v of row) {
    if (v === 1) black++;
    else if (v === 2) white++;
  }
  return { black, white };
}

function aiScore(b: Board): number {
  let s = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (b[r]![c] === 2) s += WEIGHTS[r]![c]!;
    else if (b[r]![c] === 1) s -= WEIGHTS[r]![c]!;
  }
  return s;
}

export function bestAIMove(b: Board): [number, number] | null {
  const moves = legalMoves(b, 2);
  if (moves.size === 0) return null;
  let best = -Infinity;
  let pick: [number, number] | null = null;
  for (const [key, flips] of moves) {
    const [r, c] = key.split(",").map(Number) as [number, number];
    const nb = applyMove(b, r, c, 2, flips);
    // Mobility bonus: count opponent's response options
    const oppMoves = legalMoves(nb, 1).size;
    const score = aiScore(nb) - oppMoves * 2;
    if (score > best) { best = score; pick = [r, c]; }
  }
  return pick;
}

/**
 * Who plays after `mover` has moved: the opponent if they can, otherwise
 * `mover` again (the opponent passes), otherwise the game is over.
 */
export function afterMove(b: Board, mover: Player): { turn: Player; passed: Player | null; over: boolean } {
  const opp: Player = mover === 1 ? 2 : 1;
  if (legalMoves(b, opp).size > 0) return { turn: opp, passed: null, over: false };
  if (legalMoves(b, mover).size > 0) return { turn: mover, passed: opp, over: false };
  return { turn: opp, passed: null, over: true };
}
