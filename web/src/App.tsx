import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { GameShell, GameTopbar, GameAuth, GameButton, useGameSounds } from "@freegamestore/games";
import { useHighScore } from "./hooks/useHighScore";
import { N, initialBoard, flipsForMove, legalMoves, applyMove, count, bestAIMove, afterMove } from "./logic";
import type { Board, Player } from "./logic";

type SoundsApi = ReturnType<typeof useGameSounds>;

function AudioBridge({ apiRef }: { apiRef: React.MutableRefObject<SoundsApi | null> }) {
  const sounds = useGameSounds();
  apiRef.current = sounds;
  return null;
}

export default function App() {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [turn, setTurn] = useState<Player>(1);
  const [gameOver, setGameOver] = useState(false);
  /** The player whose turn was just skipped for lack of moves, for the status line. */
  const [passed, setPassed] = useState<Player | null>(null);
  const { highScore: bestMargin, updateHighScore } = useHighScore("reversi-best-margin");
  const audioRef = useRef<SoundsApi | null>(null);

  const moves = useMemo(() => legalMoves(board, turn), [board, turn]);
  const { black, white } = useMemo(() => count(board), [board]);

  const play = useCallback((nb: Board, mover: Player) => {
    const next = afterMove(nb, mover);
    setBoard(nb);
    setTurn(next.turn);
    setPassed(next.passed);
    setGameOver(next.over);
    audioRef.current?.playMove();
  }, []);

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (gameOver || turn !== 1) return;
      const flips = moves.get(`${r},${c}`);
      if (!flips) return;
      play(applyMove(board, r, c, 1, flips), 1);
    },
    [board, turn, moves, gameOver, play],
  );

  // AI turn (passes and game over are resolved by afterMove when a move is made)
  useEffect(() => {
    if (gameOver || turn !== 2) return;
    const t = setTimeout(() => {
      const move = bestAIMove(board);
      if (!move) return;
      const [r, c] = move;
      play(applyMove(board, r, c, 2, flipsForMove(board, r, c, 2)), 2);
    }, 450);
    return () => clearTimeout(t);
  }, [turn, board, gameOver, play]);

  // Update best margin on game over
  useEffect(() => {
    if (!gameOver) return;
    const margin = black - white;
    if (margin > 0) updateHighScore(margin);
  }, [gameOver, black, white, updateHighScore]);

  const reset = useCallback(() => {
    setBoard(initialBoard());
    setTurn(1);
    setPassed(null);
    setGameOver(false);
  }, []);

  const status = gameOver
    ? black > white ? `You win ${black}–${white}` : black < white ? `AI wins ${white}–${black}` : `Draw ${black}–${white}`
    : passed === 2 ? "AI has no moves — your move again"
    : passed === 1 ? "You have no moves — AI plays again…"
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
      <AudioBridge apiRef={audioRef} />
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
