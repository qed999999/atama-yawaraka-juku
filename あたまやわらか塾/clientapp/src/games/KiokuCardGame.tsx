import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState } from "react";

type Props = { onExit: () => void; onScore?: (score: number, difficulty?: string) => void; difficultyBests?: Record<string, number>; unit?: string };

const EMOJIS = ["🐶", "🐱", "🐸", "🦊", "🐻", "🐰", "🐼", "🦁", "🐧", "🐮", "🐷", "🐵"];

type Card = { id: number; emoji: string; flipped: boolean; matched: boolean };

const GAME_SECONDS = 60;

const CARD_CSS = `
@keyframes kioku-flip-in {
  0%   { transform: rotateY(90deg) scale(0.85); opacity: 0.4; }
  60%  { transform: rotateY(-8deg) scale(1.06); opacity: 1; }
  100% { transform: rotateY(0deg) scale(1); opacity: 1; }
}
@keyframes kioku-flip-out {
  0%   { transform: rotateY(0deg) scale(1); }
  100% { transform: rotateY(-90deg) scale(0.85); opacity: 0.4; }
}
@keyframes kioku-match-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.18); }
  70%  { transform: scale(0.93); }
  100% { transform: scale(1); }
}
@keyframes kioku-shake {
  0%,100% { transform: translateX(0); }
  25%      { transform: translateX(-4px) rotate(-2deg); }
  75%      { transform: translateX(4px) rotate(2deg); }
}
@keyframes kioku-star-spin {
  from { transform: rotate(0deg) scale(1); }
  50%  { transform: rotate(180deg) scale(1.3); }
  to   { transform: rotate(360deg) scale(1); }
}
@keyframes kioku-confetti-pop {
  0%   { transform: scale(0.5) rotate(-10deg); opacity: 0; }
  60%  { transform: scale(1.15) rotate(4deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
.kioku-card-back {
  background: linear-gradient(145deg, #a78bfa 0%, #7c3aed 40%, #6366f1 70%, #818cf8 100%);
  position: relative;
  overflow: hidden;
}
.kioku-card-back::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle, rgba(255,255,255,0.18) 1.5px, transparent 2px),
    radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1.5px);
  background-size: 18px 18px, 9px 9px;
  background-position: 0 0, 9px 9px;
  pointer-events: none;
}
.kioku-card-back::after {
  content: "✦";
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: clamp(22px, 5.5vw, 34px);
  color: rgba(255,255,255,0.55);
  pointer-events: none;
  text-shadow: 0 0 8px rgba(255,255,255,0.4);
}
.kioku-card-flip-in  { animation: kioku-flip-in  0.28s cubic-bezier(.4,0,.2,1) both; }
.kioku-card-flip-out { animation: kioku-flip-out 0.2s  cubic-bezier(.4,0,.2,1) both; }
.kioku-card-match    { animation: kioku-match-pop 0.45s cubic-bezier(.4,0,.2,1) both; }
.kioku-card-shake    { animation: kioku-shake 0.35s ease both; }
.kioku-result-pop    { animation: kioku-confetti-pop 0.5s cubic-bezier(.4,0,.2,1) both; }
`;

export default function KiokuCardGame({ onExit, onScore, difficultyBests, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<"ready" | "playing" | "result">("ready");
  const [frozenBest, setFrozenBest] = useState<number | undefined>(undefined);
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matched, setMatched] = useState(0);
  const [pairCount, setPairCount] = useState(6);
  const [lockBoard, setLockBoard] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [resultSec, setResultSec] = useState(0);
  // Animation states: cardId -> class name
  const [cardAnims, setCardAnims] = useState<Record<number, string>>({});
  const timeLeftMsRef = useRef(GAME_SECONDS * 1000);

  timeLeftMsRef.current = timeLeftMs;
  const totalPairs = pairCount;
  const matchedRef = useRef(0);
  matchedRef.current = matched;

  // Inject CSS once
  useEffect(() => {
    const id = "kioku-card-css";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = CARD_CSS;
      document.head.appendChild(s);
    }
    return () => { /* keep style alive */ };
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (phase !== "playing") return;
    const start = performance.now() - elapsed;
    const tick = () => {
      setElapsed(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "playing") return;
    const startedAt = performance.now();
    const startLeft = timeLeftMs;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const left = Math.max(0, startLeft - elapsed);
      setTimeLeftMs(left);
      if (left <= 0) { setResultSec(GAME_SECONDS); setPhase("result"); return; }
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const seconds = Math.ceil(timeLeftMs / 1000);
  const timerWarning = seconds <= 10;

  // Report score (elapsed seconds) — only when all pairs are matched (game completed)
  useEffect(() => {
    if (phase === "result" && matchedRef.current >= totalPairs) {
      const diffLabel = pairCount === 4 ? "かんたん（4ペア）" : pairCount === 6 ? "ふつう（6ペア）" : "むずかしい（8ペア）";
      onScore?.(resultSec, diffLabel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const goResult = () => { setResultSec(Math.round((GAME_SECONDS * 1000 - timeLeftMsRef.current) / 1000)); setPhase("result"); };

  const startGame = (pairs: number) => {
    const diffLabel = pairs === 4 ? "かんたん（4ペア）" : pairs === 6 ? "ふつう（6ペア）" : "むずかしい（8ペア）";
    setFrozenBest(difficultyBests?.[diffLabel]);
    setPairCount(pairs);
    const selected = shuffle(EMOJIS).slice(0, pairs);
    const deck = shuffle([...selected, ...selected].map((emoji, i) => ({
      id: i, emoji, flipped: false, matched: false,
    })));
    setCards(deck);
    setFlippedIds([]);
    setMoves(0);
    setMatched(0);
    setElapsed(0);
    setResultSec(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    setLockBoard(false);
    setCardAnims({});
    setPhase("playing");
  };

  const triggerAnim = (ids: number[], cls: string) => {
    setCardAnims(prev => {
      const next = { ...prev };
      ids.forEach(id => { next[id] = ""; });
      return next;
    });
    requestAnimationFrame(() => {
      setCardAnims(prev => {
        const next = { ...prev };
        ids.forEach(id => { next[id] = cls; });
        return next;
      });
    });
    setTimeout(() => {
      setCardAnims(prev => {
        const next = { ...prev };
        ids.forEach(id => { if (next[id] === cls) delete next[id]; });
        return next;
      });
    }, 600);
  };

  const flipCard = (id: number) => {
    if (lockBoard) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.flipped || card.matched) return;

    triggerAnim([id], "kioku-card-flip-in");

    const newCards = cards.map((c) => c.id === id ? { ...c, flipped: true } : c);
    setCards(newCards);

    const newFlipped = [...flippedIds, id];

    if (newFlipped.length === 2) {
      setLockBoard(true);
      setMoves((m) => m + 1);

      const [first, second] = newFlipped.map((fid) => newCards.find((c) => c.id === fid)!);

      if (first.emoji === second.emoji) {
        setTimeout(() => {
          triggerAnim([first.id, second.id], "kioku-card-match");
          setCards((prev) =>
            prev.map((c) => c.id === first.id || c.id === second.id ? { ...c, matched: true } : c)
          );
          setMatched((m) => {
            const next = m + 1;
            if (next >= totalPairs) {
              const sec = Math.round((GAME_SECONDS * 1000 - timeLeftMsRef.current) / 1000);
              setTimeout(() => { setResultSec(sec); setPhase("result"); }, 600);
            }
            return next;
          });
          setFlippedIds([]);
          setLockBoard(false);
        }, 400);
      } else {
        setTimeout(() => {
          triggerAnim([first.id, second.id], "kioku-card-shake");
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) => c.id === first.id || c.id === second.id ? { ...c, flipped: false } : c)
            );
            setFlippedIds([]);
            setLockBoard(false);
          }, 350);
        }, 500);
      }
    } else {
      setFlippedIds(newFlipped);
    }
  };

  const sec = Math.floor(elapsed / 1000);

  // Grid columns
  const cols = pairCount <= 4 ? 4 : pairCount <= 6 ? 4 : 4;

  if (phase === "ready") {
    return (
      <KidShell title="きおくカード" onExit={onExit}>
        <div style={{ ...kidPanel, textAlign: "left" }}>
          {/* Hero icon */}
          <div style={{ textAlign: "center", fontSize: 52, marginBottom: 6, filter: "drop-shadow(0 4px 8px rgba(124,58,237,0.25))" }}>
            🃏
          </div>
          <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 6, textAlign: "center", color: "#7c3aed" }}>
            おなじ カードを みつけよう！
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, opacity: 0.7, marginBottom: 18, textAlign: "center" }}>
            カードを めくって ペアを さがそう
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <DiffButton emoji="⭐" label="かんたん" sub="4ペア" color="#22c55e" onClick={() => startGame(4)} />
            <DiffButton emoji="🌟" label="ふつう" sub="6ペア" color="#f59e0b" onClick={() => startGame(6)} />
            <DiffButton emoji="💫" label="むずかしい" sub="8ペア" color="#ef4444" onClick={() => startGame(8)} />
          </div>
        </div>
      </KidShell>
    );
  }

  if (phase === "result") {
    const perfect = matched >= totalPairs;
    const good = matched >= totalPairs * 0.5;
    const resultEmoji = perfect ? "🎊" : good ? "😊" : "💪";
    const resultMsg = perfect ? "パーフェクト！" : good ? "よくできました！" : "つぎは がんばろう！";
    const resultColor = perfect ? "#ff3fa7" : good ? "#f59e0b" : "#7c3aed";
    return (
      <KidShell title="けっか" onExit={onExit}>
        <div style={kidPanel}>
          <div className="kioku-result-pop" style={{ fontSize: 64, marginBottom: 4, textAlign: "center",
            filter: "drop-shadow(0 4px 12px rgba(255,63,167,0.3))" }}>{resultEmoji}</div>
          <div className="kioku-result-pop" style={{ animationDelay: "0.08s",
            fontSize: 22, fontWeight: 1000, color: resultColor, marginBottom: 8, textAlign: "center" }}>{resultMsg}</div>

          {/* Score box */}
          <div className="kioku-result-pop" style={{ animationDelay: "0.16s",
            margin: "0 auto 10px", padding: "10px 20px", borderRadius: 18,
            background: `${resultColor}18`, border: `2.5px solid ${resultColor}44`,
            textAlign: "center", maxWidth: 280 }}>
            <div style={{ fontSize: "clamp(28px, 7vw, 38px)", fontWeight: 1000, color: resultColor, lineHeight: 1.1 }}>
              {matched} / {totalPairs} ペア
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.7, marginTop: 4 }}>
              {moves}かい めくった　・　{resultSec}びょう
            </div>
          </div>

          {matched >= totalPairs && (
            <div className="kioku-result-pop" style={{ animationDelay: "0.24s" }}>
              <RecordBanner score={resultSec} prevBest={frozenBest} unit={unit} lowerIsBetter />
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 14 }}>
            <button style={{ ...kidPrimaryBtn, fontSize: 16, padding: "13px 22px" }} onClick={() => startGame(pairCount)}>
              もういっかい
            </button>
            <button style={kidSecondaryBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
      </KidShell>
    );
  }

  return (
    <KidShell title="きおくカード" onExit={onExit} rightExtra={<button style={kidSecondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={screenCol}>
        {/* Top bar */}
        <div style={kidTopBar}>
          <span style={{ ...pillBlue, ...(timerWarning ? pillTimerWarn : {}) }}>
            {timerWarning ? "⏰ " : "⏱ "}{seconds}びょう
          </span>
          <span style={pillPink}>🖐 {moves}かい</span>
          <span style={pillPurple}>✅ {matched}/{totalPairs}</span>
        </div>

        {/* Card grid */}
        <div style={{ ...kidPanelFlex, justifyContent: "center", alignItems: "center" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: "clamp(6px, 1.5vw, 10px)",
            width: "100%",
            maxWidth: 480,
          }}>
            {cards.map((card) => {
              const animClass = cardAnims[card.id] || "";
              return (
                <button
                  key={card.id}
                  className={`${card.flipped && !card.matched ? "kioku-card-flip-in" : ""} ${animClass}`}
                  onClick={() => flipCard(card.id)}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 14,
                    border: card.matched
                      ? "3px solid rgba(34, 197, 94, 0.5)"
                      : card.flipped
                        ? "3px solid rgba(124, 58, 237, 0.35)"
                        : "3px solid rgba(124, 58, 237, 0.2)",
                    background: card.matched
                      ? "linear-gradient(135deg, #d1fae5 0%, #bbf7d0 100%)"
                      : card.flipped
                        ? "linear-gradient(135deg, #fdf4ff 0%, #f5f3ff 100%)"
                        : undefined,
                    cursor: card.matched ? "default" : "pointer",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "clamp(22px, 5.5vw, 38px)",
                    boxShadow: card.matched
                      ? "0 4px 12px rgba(34,197,94,0.25), 0 0 0 2px rgba(34,197,94,0.1)"
                      : card.flipped
                        ? "0 6px 18px rgba(124,58,237,0.2), inset 0 1px 2px rgba(255,255,255,0.8)"
                        : "0 6px 16px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.3)",
                    opacity: card.matched ? 0.75 : 1,
                    transition: "box-shadow 0.2s, border-color 0.2s",
                    userSelect: "none",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  {...(!card.flipped && !card.matched ? { className: `kioku-card-back ${animClass}` } : {})}
                >
                  {card.matched && (
                    <span style={{
                      position: "absolute", top: 2, right: 4,
                      fontSize: "clamp(10px, 2.5vw, 14px)", lineHeight: 1, opacity: 0.7,
                    }}>✓</span>
                  )}
                  {card.flipped || card.matched ? card.emoji : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </KidShell>
  );
}

// ── Difficulty button ──────────────────────────────────────────────────────
function DiffButton({ emoji, label, sub, color, onClick }: {
  emoji: string; label: string; sub: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 16px", borderRadius: 18, border: `2.5px solid ${color}44`,
        background: `${color}12`,
        cursor: "pointer", width: "100%", textAlign: "left",
        transition: "transform 0.15s, box-shadow 0.15s",
        boxShadow: `0 4px 12px ${color}22`,
      }}
      onPointerDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
      onPointerUp={e => (e.currentTarget.style.transform = "scale(1)")}
      onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    >
      <span style={{ fontSize: 28, filter: `drop-shadow(0 2px 4px ${color}44)` }}>{emoji}</span>
      <span>
        <span style={{ display: "block", fontSize: 17, fontWeight: 1000, color }}>{label}</span>
        <span style={{ display: "block", fontSize: 12, fontWeight: 900, opacity: 0.6 }}>{sub}</span>
      </span>
    </button>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  background: "rgba(255,255,255,0.86)", border: "3px solid rgba(255, 170, 220, 0.55)",
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
  transition: "background 0.3s, border-color 0.3s",
};
const pillBlue: React.CSSProperties = { ...pillBase, background: "rgba(26, 168, 255, 0.10)", border: "2px solid rgba(26, 168, 255, 0.18)" };
const pillTimerWarn: React.CSSProperties = { background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.35)", color: "#dc2626" };
const pillPink: React.CSSProperties = { ...pillBase, background: "rgba(255, 63, 167, 0.10)", border: "2px solid rgba(255, 63, 167, 0.18)" };
const pillPurple: React.CSSProperties = { ...pillBase, background: "rgba(124, 58, 237, 0.10)", border: "2px solid rgba(124, 58, 237, 0.18)" };
const kidPanel: React.CSSProperties = {
  padding: 12, borderRadius: 18, border: "3px solid rgba(80, 200, 255, 0.25)",
  background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0, 160, 255, 0.10)", boxSizing: "border-box",
};
const kidPanelFlex: React.CSSProperties = {
  ...kidPanel, minHeight: 0, flex: 1, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden",
};
const kidPrimaryBtn: React.CSSProperties = {
  padding: "12px 16px", borderRadius: 18, border: "none",
  background: "linear-gradient(180deg, #ff73c6 0%, #ff3fa7 100%)",
  color: "#fff", fontWeight: 1000, fontSize: 16, cursor: "pointer", whiteSpace: "nowrap",
  boxShadow: "0 4px 12px rgba(255,63,167,0.35)",
};
const kidSecondaryBtn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 14, border: "2px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
};
