import { describe, it, expect } from "vitest";
import { initialBoard, flipsForMove, legalMoves, applyMove, count, bestAIMove, afterMove } from "../logic";
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

  it("hands the turn to the opponent normally", () => {
    const b = initialBoard();
    const nb = applyMove(b, 2, 3, 1, flipsForMove(b, 2, 3, 1));
    expect(afterMove(nb, 1)).toEqual({ turn: 2, passed: null, over: false });
  });

  it("reports a pass when the opponent has no moves", () => {
    // Black can flank white from 0,2; white has nothing to flank black with.
    const b = empty();
    b[0]![0] = 1; b[0]![1] = 2;
    expect(legalMoves(b, 2).size).toBe(0);
    expect(afterMove(b, 1)).toEqual({ turn: 1, passed: 2, over: false });
  });

  it("ends the game when neither side can move", () => {
    const b = empty();
    b[0]![0] = 1; b[7]![7] = 2;
    expect(afterMove(b, 1).over).toBe(true);
  });
});
