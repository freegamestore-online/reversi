import { useState, useCallback, useEffect, useMemo } from "react";
import { GameShell, GameTopbar, GameAuth, GameButton } from "@freegamestore/games";
import { useHighScore } from "./hooks/useHighScore";

type Player = 1 | 2; // 1 = black (you), 2 = white (AI)
type Cell = 0 | Player;
type Board = Cell[][];

const N = 8;
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

function initialBoard(): Board {
  const b: Board = Array.from({ length: N }, () => Array<Cell>(N).fill(0));
  b[3]![3] = 2; b[3]![4] = 1; b[4]![3] = 1; b[4]![4] = 2;
  return b;
}

function flipsForMove(b: Board, r: number, c: number, p: Player): [number, number][] {
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

function legalMoves(b: Board, p: Player): Map<string, [number, number][]> {
  const m = new Map<string, [number, number][]>();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const f = flipsForMove(b, r, c, p);
    if (f.length > 0) m.set(`${r},${c}`, f);
  }
  return m;
}

function applyMove(b: Board, r: number, c: number, p: Player, flips: [number, number][]): Board {
  const nb = b.map((row) => row.slice());
  nb[r]![c] = p;
  for (const [i, j] of flips) nb[i]![j] = p;
  return nb;
}

function count(b: Board): { black: number; white: number } {
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

function bestAIMove(b: Board): [number, number] | null {
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

export default function App() {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [turn, setTurn] = useState<Player>(1);
  const [gameOver, setGameOver] = useState(false);
  const { highScore: bestMargin, updateHighScore } = useHighScore("reversi-best-margin");

  const moves = useMemo(() => legalMoves(board, turn), [board, turn]);
  const { black, white } = useMemo(() => count(board), [board]);

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (gameOver || turn !== 1) return;
      const flips = moves.get(`${r},${c}`);
      if (!flips) return;
      const nb = applyMove(board, r, c, 1, flips);
      setBoard(nb);
      setTurn(2);
    },
    [board, turn, moves, gameOver],
  );

  // AI turn + pass detection + game over
  useEffect(() => {
    if (gameOver) return;
    if (turn === 2) {
      const m = legalMoves(board, 2);
      if (m.size === 0) {
        // White passes; if black can also not move → game over
        if (legalMoves(board, 1).size === 0) {
          setGameOver(true);
        } else {
          setTurn(1);
        }
        return;
      }
      const t = setTimeout(() => {
        const move = bestAIMove(board);
        if (!move) return;
        const [r, c] = move;
        const flips = flipsForMove(board, r, c, 2);
        setBoard(applyMove(board, r, c, 2, flips));
        setTurn(1);
      }, 450);
      return () => clearTimeout(t);
    }
    // Player's turn
    if (turn === 1 && moves.size === 0) {
      if (legalMoves(board, 2).size === 0) {
        setGameOver(true);
      } else {
        setTurn(2);
      }
    }
  }, [turn, board, gameOver, moves]);

  // Update best margin on game over
  useEffect(() => {
    if (!gameOver) return;
    const margin = black - white;
    if (margin > 0) updateHighScore(margin);
  }, [gameOver, black, white, updateHighScore]);

  const reset = useCallback(() => {
    setBoard(initialBoard());
    setTurn(1);
    setGameOver(false);
  }, []);

  const status = gameOver
    ? black > white ? `You win ${black}–${white}` : black < white ? `AI wins ${white}–${black}` : `Draw ${black}–${white}`
    : turn === 1 ? "Your move (black)" : "AI thinking…";

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Reversi"
          stats={[
            { label: "You", value: black, accent: true },
            { label: "AI", value: white },
            { label: "Best+", value: bestMargin },
          ]}
          rules={
            <div>
              <h3 style={{ marginBottom: "0.5rem", fontWeight: 700 }}>Reversi (Othello)</h3>
              <p>Flank your opponent's discs to flip them. Most discs at the end wins.</p>
              <h4 style={{ marginTop: "0.75rem", fontWeight: 600 }}>Controls</h4>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
                <li>Tap a highlighted square to place a black disc</li>
                <li>Discs caught between your new piece and another black disc flip to black</li>
              </ul>
              <h4 style={{ marginTop: "0.75rem", fontWeight: 600 }}>Rules</h4>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
                <li>You must flank at least one opposing disc to play</li>
                <li>If you have no legal moves, your turn is skipped</li>
                <li>AI weights corners heavily — they're permanent</li>
              </ul>
            </div>
          }
          actions={<GameAuth />}
        />
      }
    >
      <div className="flex flex-col items-center h-full gap-3 p-2 overflow-hidden">
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{status}</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${N}, clamp(2rem, 10vmin, 3rem))`,
            gridTemplateRows: `repeat(${N}, clamp(2rem, 10vmin, 3rem))`,
            gap: "2px",
            padding: "6px",
            background: "var(--line-strong)",
            borderRadius: "0.5rem",
            touchAction: "manipulation",
          }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const playable = turn === 1 && !gameOver && moves.has(`${r},${c}`);
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => handleCellClick(r, c)}
                  disabled={!playable}
                  aria-label={`square ${r + 1},${c + 1}`}
                  style={{
                    background: "#0c8a4a",
                    border: "none",
                    padding: 0,
                    cursor: playable ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  {cell !== 0 && (
                    <span
                      style={{
                        width: "78%",
                        height: "78%",
                        borderRadius: "50%",
                        background: cell === 1 ? "#0a0a0a" : "#f8fafc",
                        boxShadow:
                          cell === 1
                            ? "inset -2px -2px 4px rgba(255,255,255,0.18)"
                            : "inset -2px -2px 4px rgba(0,0,0,0.18)",
                      }}
                    />
                  )}
                  {playable && cell === 0 && (
                    <span
                      style={{
                        width: "32%",
                        height: "32%",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.35)",
                      }}
                    />
                  )}
                </button>
              );
            }),
          )}
        </div>

        <GameButton size="sm" variant={gameOver ? "primary" : "ghost"} onClick={reset}>
          {gameOver ? "New Game" : "Reset"}
        </GameButton>

        <a
          href="https://freegamestore.online"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--muted)", fontSize: "0.7rem", textDecoration: "none" }}
        >
          Part of FreeGameStore — free forever
        </a>
      </div>
    </GameShell>
  );
}
