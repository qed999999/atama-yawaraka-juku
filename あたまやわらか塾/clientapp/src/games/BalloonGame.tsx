import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };
type Phase = "ready" | "playing" | "result";

const GAME_SECONDS = 60;
const CLEAR_BONUS = 10;
const MISS_PENALTY = 5;
const SUCCESS_MS = 700;

const BALLOON_COLORS = [
  "#ff6b9d", "#ff9a56", "#6bcb77",
  "#4d96ff", "#9b59b6", "#ff73c6", "#1aa8ff",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Balloon = { num: number; size: number; color: string; x: number; y: number };

// round: 0-based (round 0 = 2個, round 1 = 3個, ...)
function makeBalloons(count: number, round: number): Balloon[] {
  // 難易度: ラウンドに応じて数字の範囲を拡大
  let max: number;
  if (round <= 1)      max = 9;     // 1〜9
  else if (round <= 3) max = 19;    // 1〜19
  else if (round <= 5) max = 50;    // 1〜50
  else if (round <= 8) max = 99;    // 1〜99
  else if (round <= 11) max = 200;  // 1〜200
  else                  max = 999;  // 1〜999

  const nums = new Set<number>();
  while (nums.size < count) nums.add(Math.floor(Math.random() * max) + 1);

  // グリッド配置: セルの中心に配置するので見切れない
  const cols = Math.ceil(Math.sqrt(count * 1.5));
  const rows = Math.ceil(count / cols);
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  const maxSize = Math.min(cellW * 2.5, cellH * 2, 90);
  const minSize = Math.max(maxSize * 0.55, 36);

  const cells: { col: number; row: number }[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({ col: c, row: r });
  const chosen = shuffle(cells).slice(0, count);

  const numArr = shuffle([...nums]);
  return numArr.map((num, i) => {
    const { col, row } = chosen[i];
    const size = minSize + Math.random() * (maxSize - minSize);
    // セル中央 ± 少しランダムずらし（中心配置なので見切れない）
    const jitterX = (Math.random() - 0.5) * cellW * 0.3;
    const jitterY = (Math.random() - 0.5) * cellH * 0.3;
    const cx = (col + 0.5) * cellW + jitterX;
    const cy = (row + 0.5) * cellH + jitterY;
    // 端に寄りすぎないようクランプ（バルーン半分が見える余裕）
    const margin = 8;
    const x = Math.max(margin, Math.min(100 - margin, cx));
    const y = Math.max(margin, Math.min(100 - margin, cy));
    return {
      num,
      size,
      color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
      x, y,
    };
  });
}

export default function BalloonGame({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [initialBest] = useState(() => prevBest);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [balloonCount, setBalloonCount] = useState(2);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [popped, setPopped] = useState<number[]>([]); // indices of popped balloons
  const [flashOk, setFlashOk] = useState(false);
  const [flashNg, setFlashNg] = useState<number | null>(null);
  const [popAnim, setPopAnim] = useState<number | null>(null); // index being animated

  const timerRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;

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

  const [round, setRound] = useState(0);

  const startRound = useCallback((count: number, r: number) => {
    setBalloons(makeBalloons(count, r));
    setPopped([]);
    setFlashOk(false);
    setFlashNg(null);
    setPopAnim(null);
  }, []);

  const start = useCallback(() => {
    setScore(0);
    setBalloonCount(2);
    setRound(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    startRound(2, 0);
    setPhase("playing");
  }, [startRound]);

  function tap(idx: number) {
    if (phase !== "playing") return;
    if (popped.includes(idx)) return;
    if (flashOk || flashNg !== null || popAnim !== null) return;

    const remaining = balloons.filter((_, i) => !popped.includes(i));
    const smallest = Math.min(...remaining.map(b => b.num));

    if (balloons[idx].num === smallest) {
      // Correct! Pop animation
      setPopAnim(idx);
      timerRef.current = window.setTimeout(() => {
        if (phaseRef.current !== "playing") return;
        setPopAnim(null);
        const next = [...popped, idx];
        setPopped(next);

        if (next.length === balloons.length) {
          // All popped!
          setFlashOk(true);
          setScore(s => s + CLEAR_BONUS);
          timerRef.current = window.setTimeout(() => {
            if (phaseRef.current !== "playing") return;
            const nc = balloonCount + 1;
            const nr = round + 1;
            setBalloonCount(nc);
            setRound(nr);
            startRound(nc, nr);
          }, SUCCESS_MS);
        }
      }, 300);
    } else {
      // Wrong!
      setFlashNg(idx);
      setScore(s => Math.max(0, s - MISS_PENALTY));
      timerRef.current = window.setTimeout(() => {
        if (phaseRef.current !== "playing") return;
        setFlashNg(null);
        startRound(balloonCount, round);
      }, 600);
    }
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (phase === "ready") return (
    <KidShell title="バルーンわり" onExit={onExit}>
      <div style={{ ...kidPanel, textAlign: "left" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎈</div>
        <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 8 }}>
          ちいさい じゅんに バルーンを われ！
        </div>
        <div style={{ fontSize: 15, fontWeight: 900, opacity: 0.8, marginBottom: 16, lineHeight: 1.7 }}>
          いちばん ちいさい かずの バルーンを タップ！<br />
          ぜんぶ われたら 10てん ゲット！
        </div>
        <button style={kidPrimaryBtn} onClick={start}>スタート</button>
      </div>
    </KidShell>
  );

  if (phase === "result") return (
    <KidShell title="けっか" onExit={onExit}>
      <div style={kidPanel}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎊</div>
        <div style={{ fontSize: 28, fontWeight: 1000, marginBottom: 8 }}>{score}てん</div>
        <div style={{ fontSize: 16, fontWeight: 900, opacity: 0.85, marginBottom: 16 }}>
          さいだい {balloonCount}この バルーンまで ちょうせんしたよ！
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
    <KidShell title="バルーンわり" onExit={onExit}
      rightExtra={<button style={kidSecondaryBtn} onClick={() => setPhase("result")}>けっかへ</button>}>
      <div style={screenCol}>
        <div style={kidTopBar}>
          <span style={pillBlue}>のこり {seconds}びょう</span>
          <span style={pillPink}>{score}てん</span>
          <span style={pillPurple}>🎈×{balloonCount}</span>
        </div>

        {/* Balloon area */}
        <div style={balloonArea}>
          {balloons.map((b, idx) => {
            const isPopped = popped.includes(idx);
            const isPopping = popAnim === idx;
            const isWrong = flashNg === idx;
            if (isPopped) return null;

            // 小さい数字ほど上に表示（z-index大）
            const maxNum = Math.max(...balloons.map(bl => bl.num));
            const baseZ = maxNum - b.num + 1;

            return (
              <button
                key={idx}
                onClick={() => tap(idx)}
                style={{
                  position: "absolute",
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  width: b.size,
                  height: b.size * 1.2,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  transition: "transform 0.2s, opacity 0.2s",
                  transform: `translate(-50%, -50%) ${isPopping ? "scale(1.5)" : isWrong ? "scale(0.9)" : "scale(1)"}`,
                  opacity: isPopping ? 0 : 1,
                  zIndex: isWrong ? 1000 : baseZ,
                }}
              >
                {/* Balloon body */}
                <div style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50% 50% 50% 50% / 45% 45% 55% 55%",
                  background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), ${b.color} 60%)`,
                  boxShadow: `0 4px 14px ${b.color}66`,
                  display: "grid",
                  placeItems: "center",
                  position: "relative",
                }}>
                  {/* Shine */}
                  <div style={{
                    position: "absolute", top: "12%", left: "22%",
                    width: "22%", height: "18%",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.6)",
                    transform: "rotate(-30deg)",
                  }} />
                  {/* Number */}
                  <span style={{
                    fontSize: b.size * 0.32,
                    fontWeight: 1000,
                    color: "#fff",
                    textShadow: `0 1px 3px ${b.color}`,
                    position: "relative",
                  }}>{b.num}</span>
                </div>
                {/* Balloon knot */}
                <div style={{
                  width: 0, height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: `8px solid ${b.color}`,
                  margin: "0 auto",
                }} />
                {/* String */}
                <div style={{
                  width: 1, height: 14,
                  background: "#aaa",
                  margin: "0 auto",
                }} />
                {/* Wrong mark */}
                {isWrong && (
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "grid", placeItems: "center",
                    fontSize: b.size * 0.7,
                    pointerEvents: "none",
                  }}>❌</div>
                )}
              </button>
            );
          })}

          {/* Pop effect */}
          {popAnim !== null && (
            <div style={{
              position: "absolute",
              left: `${balloons[popAnim].x}%`,
              top: `${balloons[popAnim].y}%`,
              transform: "translate(-50%, -50%)",
              width: balloons[popAnim].size,
              height: balloons[popAnim].size,
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
              fontSize: balloons[popAnim].size * 0.6,
              animation: "none",
            }}>💥</div>
          )}
        </div>
      </div>

      {flashOk && (
        <div style={kidOverlay}>
          <div style={kidFeedbackCard(true)}>
            <div style={{ fontSize: 72, fontWeight: 1000, lineHeight: 1, marginBottom: 6, color: "#22c55e", textShadow: "0 6px 18px rgba(255, 63, 167, 0.25)" }}>○</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>せいかい！</div>
            <div style={{ fontSize: 16, opacity: 0.88 }}>+{CLEAR_BONUS}てん！ つぎは {balloonCount + 1}こ！</div>
          </div>
        </div>
      )}
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
  display: "flex", flexDirection: "column", gap: 8, minHeight: 0, flex: 1,
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
const kidOverlay: React.CSSProperties = {
  position: "fixed", inset: 0, display: "grid", placeItems: "center",
  background: "rgba(0,0,0,0.25)", zIndex: 9999,
  padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
  boxSizing: "border-box", overflow: "hidden",
};
const kidFeedbackCard = (ok: boolean): React.CSSProperties => ({
  width: "min(420px, 92vw)", maxWidth: "calc(100vw - 32px)", boxSizing: "border-box",
  borderRadius: 22, border: `3px solid ${ok ? "rgba(34,197,94,0.35)" : "rgba(255,99,177,0.35)"}`,
  background: "rgba(255,255,255,0.92)", boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
  padding: 16, textAlign: "center", color: "#1b1b1b", overflow: "hidden",
});
const balloonArea: React.CSSProperties = {
  position: "relative",
  flex: 1,
  minHeight: 0,
  borderRadius: 18,
  border: "3px solid rgba(80, 200, 255, 0.25)",
  background: "linear-gradient(180deg, rgba(135,206,250,0.15) 0%, rgba(255,255,255,0.92) 100%)",
  boxShadow: "0 12px 22px rgba(0, 160, 255, 0.10)",
  overflow: "hidden",
};
