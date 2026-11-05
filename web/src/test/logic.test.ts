import { describe, it, expect } from "vitest";
import { initialBoard, flipsForMove, legalMoves, applyMove, count, bestAIMove } from "../logic";
import type { Board } from "../logic";

const empty = (): Board => Array.from({ length: 8 }, () => Array(8).fill(0));

describe("reversi rules", () => {
  it("black has four opening moves", () => {
    expect([...legalMoves(initialBoard(), 1).keys()].sort()).toEqual(["2,3", "3,2", "4,5", "5,4"]);
  });

  it("flips the flanked line", () => {
    const b = initialBoard();
    const flips = flipsForMove(b, 2, 3, 1);
    expect(flips).toEqual([[3, 3]]);
    const nb = applyMove(b, 2, 3, 1, flips);
    expect(count(nb)).toEqual({ black: 4, white: 1 });
  });

  it("occupied squares are never legal", () => {
    expect(flipsForMove(initialBoard(), 3, 3, 1)).toEqual([]);
  });

  it("AI grabs an available corner", () => {
    const b = empty();
    b[0]![1] = 1; b[0]![2] = 2; // white can take the corner at 0,0
    b[4]![4] = 1; b[4]![5] = 2; // ...or play 4,3
    expect(bestAIMove(b)).toEqual([0, 0]);
  });
});
