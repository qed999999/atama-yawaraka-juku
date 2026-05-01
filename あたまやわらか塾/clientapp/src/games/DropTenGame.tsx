import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };
type Phase = "ready" | "playing" | "result";

const COLS = 7;
const ROWS = 12;
const GAME_SECONDS = 60;
const INITIAL_FILL_ROWS = 4;
const DROP_INTERVAL_MS = 1800;

const NUM_COLORS: Record<number, string> = {
  1: "#4d96ff", 2: "#6bcb77", 3: "#ff9a56", 4: "#ff6b9d",
  5: "#9b59b6", 6: "#1aa8ff", 7: "#ff73c6", 8: "#e74c3c", 9: "#2ecc71",
};

function randNum(): number { return Math.floor(Math.random() * 9) + 1; }

function makeInitialGrid(): (number | null)[][] {
  const grid: (number | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (let r = ROWS - INITIAL_FILL_ROWS; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) grid[r][c] = randNum();
  return grid;
}

function applyGravity(grid: (number | null)[][]): (number | null)[][] {
  const g = grid.map(r => [...r]);
  for (let c = 0; c < COLS; c++) {
    const vals = [];
    for (let r = 0; r < ROWS; r++) if (g[r][c] !== null) vals.push(g[r][c]!);
    for (let r = 0; r < ROWS; r++) g[r][c] = r < ROWS - vals.length ? null : vals[r - (ROWS - vals.length)];
  }
  return g;
}

// 消滅チェック: 落としたピースの真下だけチェックし、合計10なら2つだけ消す
function eliminate(grid: (number | null)[][], placedRow: number, placedCol: number): { grid: (number | null)[][]; count: number } {
  const g = grid.map(r => [...r]);
  const val = g[placedRow][placedCol];
  if (val === null) return { grid: g, count: 0 };

  // 下のマスとチェック
  if (placedRow + 1 < ROWS && g[placedRow + 1][placedCol] !== null && val + g[placedRow + 1][placedCol]! === 10) {
    g[placedRow][placedCol] = null;
    g[placedRow + 1][placedCol] = null;
    return { grid: applyGravity(g), count: 2 };
  }
  return { grid: g, count: 0 };
}

export default function DropTenGame({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [initialBest] = useState(() => prevBest);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [grid, setGrid] = useState<(number | null)[][]>(makeInitialGrid);
  const [fallingNum, setFallingNum] = useState(randNum());
  const [fallingCol, setFallingCol] = useState(Math.floor(COLS / 2));
  const [fallingRow, setFallingRow] = useState(0);
  const [flashCells, setFlashCells] = useState<Set<string>>(new Set());
  const [gameOver, setGameOver] = useState(false);

  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const fallingColRef = useRef(fallingCol);
  fallingColRef.current = fallingCol;
  const fallingRowRef = useRef(fallingRow);
  fallingRowRef.current = fallingRow;
  const fallingNumRef = useRef(fallingNum);
  fallingNumRef.current = fallingNum;

  // Timer
  useEffect(() => {
    if (phase !== "playing") return;
    const startedAt = performance.now();
    const startLeft = timeLeftMs;
    const tick = () => {
      const left = Math.max(0, startLeft - (performance.now() - startedAt));
      setTimeLeftMs(left);
      if (left <= 0) { setPhase("result"); return; }
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === "result") onScore?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // 列のてっぺん (landing row) を求める
  const getLandingRow = useCallback((g: (number | null)[][], col: number): number => {
    for (let r = 0; r < ROWS; r++) {
      if (g[r][col] !== null) return r - 1;
    }
    return ROWS - 1;
  }, []);

  // ピースを落下させて固定
  const placePiece = useCallback(() => {
    const g = gridRef.current;
    const col = fallingColRef.current;
    const num = fallingNumRef.current;
    const landRow = getLandingRow(g, col);
    if (landRow < 0) {
      // ゲームオーバー（列が満杯）
      setGameOver(true);
      setPhase("result");
      return;
    }
    const newGrid = g.map(r => [...r]);
    newGrid[landRow][col] = num;

    // 消滅チェック
    const { grid: afterGrid, count } = eliminate(newGrid, landRow, col);
    if (count > 0) {
      // フラッシュ演出用: 消えたセルを特定
      const flash = new Set<string>();
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (newGrid[r][c] !== null && afterGrid[r][c] === null) flash.add(`${r},${c}`);
      // まず配置を見せる
      setGrid(newGrid);
      setFlashCells(flash);
      setScore(s => s + 10);
      setTimeout(() => {
        if (phaseRef.current !== "playing") return;
        setGrid(afterGrid);
        setFlashCells(new Set());
      }, 300);
    } else {
      setGrid(newGrid);
    }

    // 次のピース
    const nextNum = randNum();
    const nextCol = Math.floor(COLS / 2);
    setFallingNum(nextNum);
    setFallingCol(nextCol);
    setFallingRow(0);
  }, [getLandingRow]);

  // 自動落下
  useEffect(() => {
    if (phase !== "playing") return;
    const iv = setInterval(() => {
      if (phaseRef.current !== "playing") return;
      const g = gridRef.current;
      const col = fallingColRef.current;
      const row = fallingRowRef.current;
      const landRow = getLandingRow(g, col);
      if (row >= landRow) {
        placePiece();
      } else {
        setFallingRow(r => r + 1);
      }
    }, DROP_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [phase, getLandingRow, placePiece]);

  const moveLeft = () => setFallingCol(c => Math.max(0, c - 1));
  const moveRight = () => setFallingCol(c => Math.min(COLS - 1, c + 1));
  const hardDrop = useCallback(() => { placePiece(); }, [placePiece]);

  const start = useCallback(() => {
    const g = makeInitialGrid();
    setGrid(g);
    setScore(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    setFallingNum(randNum());
    setFallingCol(Math.floor(COLS / 2));
    setFallingRow(0);
    setFlashCells(new Set());
    setGameOver(false);
    setPhase("playing");
  }, []);

  // キーボード操作
  useEffect(() => {
    if (phase !== "playing") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") moveLeft();
      else if (e.key === "ArrowRight") moveRight();
      else if (e.key === "ArrowDown" || e.key === " ") hardDrop();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, hardDrop]);

  // Landing preview row
  const landingRow = getLandingRow(grid, fallingCol);

  if (phase === "ready") return (
    <KidShell title="テンでけす" onExit={onExit}>
      <div style={{ ...kidPanel, textAlign: "left" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🔟</div>
        <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 8 }}>
          あわせて 10で けそう！
        </div>
        <div style={{ fontSize: 15, fontWeight: 900, opacity: 0.8, marginBottom: 16, lineHeight: 1.7 }}>
          うえから おちてくる すうじを よこにうごかして<br />
          たて に くっついた すうじと たして<br />
          <span style={{ color: "#ff3fa7", fontSize: 18 }}>10</span> になれば きえるよ！
        </div>
        <button style={kidPrimaryBtn} onClick={start}>スタート</button>
      </div>
    </KidShell>
  );

  if (phase === "result") return (
    <KidShell title="けっか" onExit={onExit}>
      <div style={kidPanel}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{gameOver ? "😵" : "🎊"}</div>
        <div style={{ fontSize: 28, fontWeight: 1000, marginBottom: 8 }}>{score}てん</div>
        <div style={{ fontSize: 16, fontWeight: 900, opacity: 0.85, marginBottom: 16 }}>
          {gameOver ? "つみあがっちゃった！" : "60びょう おつかれさま！"}
        </div>
        <RecordBanner score={score} prevBest={initialBest} unit={unit} />
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={kidPrimaryBtn} onClick={start}>もういっかい</button>
          <button style={kidSecondaryBtn} onClick={onExit}>メニューへ</button>
        </div>
      </div>
    </KidShell>
  );

  const seconds = Math.ceil(timeLeftMs / 1000);

  return (
    <KidShell title="テンでけす" onExit={onExit}
      rightExtra={<button style={kidSecondaryBtn} onClick={() => setPhase("result")}>けっかへ</button>}>
      <div style={screenCol}>
        <div style={kidTopBar}>
          <span style={pillBlue}>のこり {seconds}びょう</span>
          <span style={pillPink}>{score}てん</span>
          <span style={pillPurple}>つぎ: {fallingNum}</span>
        </div>

        {/* Grid */}
        <div style={gridWrapper}>
          <div style={gridContainer}>
            {Array.from({ length: ROWS }).map((_, r) => (
              Array.from({ length: COLS }).map((_, c) => {
                const val = grid[r][c];
                const isFalling = r === fallingRow && c === fallingCol && val === null;
                const isGhost = c === fallingCol && r === landingRow && val === null && landingRow !== fallingRow;
                const isFlash = flashCells.has(`${r},${c}`);
                const displayVal = isFalling ? fallingNum : val;
                const color = displayVal ? NUM_COLORS[displayVal] : undefined;

                return (
                  <div key={`${r}-${c}`} style={{
                    gridColumn: c + 1, gridRow: r + 1,
                    borderRadius: 4,
                    border: isFlash ? "2px solid #fff" : "1px solid rgba(0,0,0,0.06)",
                    background: isFlash ? "#ffd93d"
                      : isFalling ? color
                      : isGhost ? `${NUM_COLORS[fallingNum]}33`
                      : val !== null ? color
                      : "rgba(255,255,255,0.4)",
                    display: "grid", placeItems: "center",
                    fontSize: "clamp(11px, 3.5vw, 18px)",
                    fontWeight: 1000,
                    color: (isFalling || val !== null) ? "#fff" : isGhost ? `${NUM_COLORS[fallingNum]}88` : "transparent",
                    textShadow: (isFalling || val !== null) ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
                    transition: isFlash ? "background 0.15s" : "none",
                    opacity: isFlash ? 0.6 : 1,
                    boxSizing: "border-box",
                  }}>
                    {displayVal ?? (isGhost ? fallingNum : "")}
                  </div>
                );
              })
            ))}
          </div>
        </div>

        {/* Controls */}
        <div style={controlRow}>
          <button style={controlBtn} onClick={moveLeft}>◀</button>
          <button style={{ ...controlBtn, flex: 2, background: "rgba(255,63,167,0.12)", border: "2px solid rgba(255,63,167,0.25)" }} onClick={hardDrop}>▼ おとす</button>
          <button style={controlBtn} onClick={moveRight}>▶</button>
        </div>
      </div>
    </KidShell>
  );
}

// ===== Shell =====
function KidShell({ title, onExit, children, rightExtra }: {
  title: string; onExit: () => void; children: React.ReactNode; rightExtra?: React.ReactNode;
}) {
  return (
    <div style={stageFixedNoScroll}>
      <div style={sparkles} aria-hidden />
      <div style={cardNoScroll}>
        <div style={headerRowNoWrap}>
          <div style={titleNoWrap}>{title}</div>
          <div style={headerBtnsNoWrap}>
            {rightExtra}
            <button style={kidHeaderBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
        <div style={contentNoScroll}>{children}</div>
      </div>
    </div>
  );
}

// ===== Styles =====
const stageFixedNoScroll: React.CSSProperties = {
  position: "fixed", inset: 0, overflow: "hidden",
  padding: "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
  boxSizing: "border-box",
  background:
    "radial-gradient(circle at 15% 20%, rgba(255, 230, 109, 0.35), transparent 40%)," +
    "radial-gradient(circle at 85% 25%, rgba(255, 140, 189, 0.28), transparent 42%)," +
    "radial-gradient(circle at 20% 85%, rgba(120, 214, 255, 0.25), transparent 45%)," +
    "linear-gradient(180deg, #fff7fe 0%, #f1fbff 55%, #fffdf2 100%)",
  fontFamily: "ui-rounded, system-ui, -apple-system, 'Hiragino Maru Gothic ProN', 'M PLUS Rounded 1c', 'Noto Sans JP', sans-serif",
  color: "#1b1b1b", display: "grid", placeItems: "center",
};
const sparkles: React.CSSProperties = {
  position: "absolute", inset: -40, pointerEvents: "none",
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.95) 0 2px, transparent 3px), radial-gradient(circle, rgba(255,255,255,0.85) 0 1.5px, transparent 3px)",
  backgroundSize: "110px 110px, 160px 160px", backgroundPosition: "0 0, 40px 60px", opacity: 0.25,
};
const cardNoScroll: React.CSSProperties = {
  width: "min(980px, 100%)", height: "100%", maxHeight: "100%",
  borderRadius: 22, padding: 10, boxSizing: "border-box",
  background: "rgba(255, 255, 255, 0.86)", border: "3px solid rgba(255, 170, 220, 0.55)",
  boxShadow: "0 18px 44px rgba(255, 120, 180, 0.18)",
  display: "flex", flexDirection: "column", overflow: "hidden",
};
const headerRowNoWrap: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap", minWidth: 0,
};
const titleNoWrap: React.CSSProperties = {
  fontWeight: 1000, fontSize: 22, color: "#ff3fa7",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
};
const headerBtnsNoWrap: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "nowrap", flexShrink: 0 };
const kidHeaderBtn: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 16, border: "2px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
};
const contentNoScroll: React.CSSProperties = {
  marginTop: 8, minHeight: 0, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column",
};
const screenCol: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6, minHeight: 0, flex: 1,
};
const kidTopBar: React.CSSProperties = {
  display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap",
  padding: "8px 10px", borderRadius: 18, background: "rgba(255,255,255,0.75)",
  border: "2px solid rgba(0,0,0,0.06)", boxShadow: "0 10px 18px rgba(0,0,0,0.08)", overflow: "hidden",
};
const pillBase: React.CSSProperties = {
  fontWeight: 1000, borderRadius: 999, padding: "6px 10px",
  border: "2px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.6)",
  whiteSpace: "nowrap", fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
};
const pillBlue: React.CSSProperties = { ...pillBase, background: "rgba(26, 168, 255, 0.10)", border: "2px solid rgba(26, 168, 255, 0.18)" };
const pillPink: React.CSSProperties = { ...pillBase, background: "rgba(255, 63, 167, 0.10)", border: "2px solid rgba(255, 63, 167, 0.18)" };
const pillPurple: React.CSSProperties = { ...pillBase, background: "rgba(124, 58, 237, 0.10)", border: "2px solid rgba(124, 58, 237, 0.18)" };
const kidPanel: React.CSSProperties = {
  padding: 16, borderRadius: 18, border: "3px solid rgba(80, 200, 255, 0.25)",
  background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0, 160, 255, 0.10)",
  boxSizing: "border-box", textAlign: "center",
};
const kidPrimaryBtn: React.CSSProperties = {
  padding: "12px 24px", borderRadius: 18, border: "none",
  background: "linear-gradient(180deg, #ff73c6 0%, #ff3fa7 100%)",
  color: "#fff", fontWeight: 1000, fontSize: 16, cursor: "pointer", whiteSpace: "nowrap",
};
const kidSecondaryBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 14, border: "2px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" };
const gridWrapper: React.CSSProperties = {
  flex: 1, minHeight: 0, display: "flex", justifyContent: "center", alignItems: "stretch",
  overflow: "hidden",
};
const gridContainer: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: `repeat(${COLS}, 1fr)`,
  gridTemplateRows: `repeat(${ROWS}, 1fr)`,
  gap: 2,
  width: "min(100%, 50vh)",
  borderRadius: 12,
  padding: 4,
  background: "rgba(0,0,0,0.04)",
  border: "2px solid rgba(0,0,0,0.08)",
  boxSizing: "border-box",
};
const controlRow: React.CSSProperties = {
  display: "flex", gap: 8, padding: "4px 0",
};
const controlBtn: React.CSSProperties = {
  flex: 1, padding: "12px 8px", borderRadius: 16,
  border: "2px solid rgba(26,168,255,0.25)",
  background: "rgba(26,168,255,0.10)",
  fontWeight: 1000, fontSize: 18, cursor: "pointer",
  color: "#0369a1", textAlign: "center",
};
