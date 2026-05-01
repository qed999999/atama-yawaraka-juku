import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };

type Phase = "ready" | "show" | "shuffle" | "answer" | "feedback" | "result";

const GAME_SECONDS = 60;
const SHOW_MS = 1200;
const FEEDBACK_MS = 1000;
const SHUFFLE_STEP_MS = 400;

export default function KagoGame({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [initialBest] = useState(() => prevBest);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [round, setRound] = useState(0);

  // 3 cages: positions[i] = which visual slot cage i occupies
  const [positions, setPositions] = useState<number[]>([0, 1, 2]);
  // which cage id has the bird
  const [birdCage, setBirdCage] = useState(0);
  // for feedback
  const [picked, setPicked] = useState<number | null>(null);
  const [lastOk, setLastOk] = useState(false);

  const timerRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;
  const prevAnswerRef = useRef("");

  useEffect(() => {
    if (phase === "result") onScore?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Countdown timer
  useEffect(() => {
    if (phase === "ready" || phase === "result") return;

    const startedAt = performance.now();
    const startLeft = timeLeftMs;

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const left = Math.max(0, startLeft - elapsed);
      setTimeLeftMs(left);
      if (left <= 0) {
        setPhase("result");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startGame = useCallback(() => {
    setScore(0);
    setCorrectCount(0);
    setRound(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    setPicked(null);
    prevAnswerRef.current = "";
    nextRound(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nextRound(currentRound: number) {
    const pos = [0, 1, 2];
    setPositions(pos);
    let bird: number;
    let tries = 0;
    do {
      bird = Math.floor(Math.random() * 3);
      tries++;
    } while (String(bird) === prevAnswerRef.current && tries < 20);
    prevAnswerRef.current = String(bird);
    setBirdCage(bird);
    setPicked(null);
    setPhase("show");

    // After showing, start shuffle
    timerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "result") return;
      setPhase("shuffle");
      doShuffle(pos, bird, currentRound);
    }, SHOW_MS);
  }

  function doShuffle(startPos: number[], bird: number, currentRound: number) {
    // More shuffles as rounds progress
    const steps = Math.min(2 + Math.floor(currentRound / 2), 8);
    const swaps: Array<[number, number]> = [];

    for (let i = 0; i < steps; i++) {
      const a = Math.floor(Math.random() * 3);
      let b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
      swaps.push([a, b]);
    }

    let pos = [...startPos];
    let stepIdx = 0;

    function doStep() {
      if (phaseRef.current === "result") return;
      if (stepIdx >= swaps.length) {
        setPhase("answer");
        return;
      }

      const [a, b] = swaps[stepIdx];
      const slotA = pos[a];
      const slotB = pos[b];

      // Perform the swap
      pos[a] = slotB;
      pos[b] = slotA;
      setPositions([...pos]);

      stepIdx++;
      timerRef.current = window.setTimeout(doStep, SHUFFLE_STEP_MS);
    }

    timerRef.current = window.setTimeout(doStep, 200);
  }

  function pickCage(cageId: number) {
    if (phase !== "answer") return;

    const ok = cageId === birdCage;
    setPicked(cageId);
    setLastOk(ok);

    if (ok) {
      setScore((s) => s + 10);
      setCorrectCount((c) => c + 1);
    } else {
      setScore((s) => Math.max(0, s - 5));
    }

    setPhase("feedback");

    timerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "result") return;
      const next = round + 1;
      setRound(next);
      nextRound(next);
    }, FEEDBACK_MS);
  }

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // === READY ===
  if (phase === "ready") {
    return (
      <KidShell title="かごのとりあて" onExit={onExit}>
        <div style={{ ...kidPanel, textAlign: "left" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🧺🐦🧺</div>
          <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 8 }}>
            とりが どの かごに はいったか あてよう！
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, opacity: 0.8, marginBottom: 16, lineHeight: 1.7 }}>
            とりが かごに はいるよ<br />
            かごが うごいたら、とりの かごを えらぼう！
          </div>
          <button style={kidPrimaryBtn} onClick={startGame}>スタート</button>
        </div>
      </KidShell>
    );
  }

  // === RESULT ===
  if (phase === "result") {
    return (
      <KidShell title="けっか" onExit={onExit}>
        <div style={kidPanel}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎊</div>
          <div style={{ fontSize: 28, fontWeight: 1000, marginBottom: 8 }}>
            せいかい：{correctCount}
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, opacity: 0.85, marginBottom: 16 }}>
            {round} もん ちょうせんしたよ！
          </div>
          <RecordBanner score={score} prevBest={initialBest} unit={unit} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button style={kidPrimaryBtn} onClick={startGame}>もういっかい</button>
            <button style={kidSecondaryBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
      </KidShell>
    );
  }

  // === PLAYING ===
  const goResult = () => setPhase("result");
  const seconds = Math.ceil(timeLeftMs / 1000);
  const isShowPhase = phase === "show";
  const isFeedback = phase === "feedback";
  const isAnswer = phase === "answer";
  const shuffleCount = Math.min(2 + Math.floor(round / 2), 8);

  return (
    <KidShell title="かごのとりあて" onExit={onExit} rightExtra={<button style={kidSecondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={screenCol}>
        <div style={kidTopBar}>
          <span style={pillBlue}>のこり {seconds}びょう</span>
          <span style={pillPink}>せいかい {score}</span>
          <span style={pillPurple}>レベル {shuffleCount}</span>
        </div>

        <div style={kidPanelFlex}>
          {/* Status message */}
          <div style={{
            textAlign: "center", fontWeight: 1000, padding: "4px 0",
            fontSize: 18,
          }}>
            {isShowPhase && "とりを よく みてね！"}
            {phase === "shuffle" && "かごが うごくよ…"}
            {isAnswer && "どの かごに いるかな？"}
          </div>

          {/* Cage area - absolute positioning with animation */}
          <div style={cageArea}>
            <div style={cageContainer}>
              {[0, 1, 2].map((cageId) => {
                const slot = positions[cageId];
                const showBird = isShowPhase && cageId === birdCage;
                const revealBird = isFeedback && cageId === birdCage;
                const wasPicked = isFeedback && cageId === picked;

                return (
                  <div
                    key={cageId}
                    style={{
                      position: "absolute",
                      width: "30%",
                      left: `${slot * 35}%`,
                      top: 0,
                      bottom: 0,
                      display: "grid",
                      placeItems: "center",
                      transition: phase === "shuffle"
                        ? `left ${SHUFFLE_STEP_MS * 0.8}ms cubic-bezier(0.4, 0, 0.2, 1)`
                        : "left 0.15s",
                    }}
                  >
                    <button
                      onClick={() => pickCage(cageId)}
                      disabled={!isAnswer}
                      style={{
                        ...cageBtn,
                        cursor: isAnswer ? "pointer" : "default",
                        border: wasPicked && !lastOk
                          ? "4px solid #ef4444"
                          : revealBird
                            ? "4px solid #22c55e"
                            : "4px solid rgba(0,0,0,0.08)",
                        transform: isAnswer ? "scale(1)" : "scale(0.95)",
                        boxShadow: isAnswer
                          ? "0 12px 28px rgba(0,0,0,0.18)"
                          : "0 8px 16px rgba(0,0,0,0.10)",
                      }}
                    >
                      {(showBird || revealBird) && (
                        <div style={{ fontSize: "clamp(28px, 8vw, 42px)", marginBottom: -8 }}>
                          🐦
                        </div>
                      )}
                      <div style={{
                        fontSize: "clamp(48px, 14vw, 72px)",
                        lineHeight: 1,
                        filter: phase === "shuffle" ? "blur(0.5px)" : "none",
                        transition: "filter 0.15s",
                      }}>
                        🧺
                      </div>
                      {wasPicked && !lastOk && (
                        <div style={{ fontSize: 24, fontWeight: 1000, color: "#ef4444" }}>✕</div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Answer prompt */}
          {isAnswer && (
            <div style={{ textAlign: "center", fontSize: 14, fontWeight: 900, opacity: 0.7, padding: "4px 0" }}>
              かごを タップしてね！
            </div>
          )}
        </div>
      </div>
          {isFeedback && (
            <div style={kidOverlay}>
              <div style={kidFeedbackCard(lastOk)}>
                <div style={{ fontSize: 64, fontWeight: 1000, color: lastOk ? "#22c55e" : "#ef4444" }}>{lastOk ? "○" : "×"}</div>
                <div style={{ fontSize: 22, fontWeight: 1000 }}>
                  {lastOk ? "せいかい！" : "ざんねん！"}
                </div>
                {!lastOk && (
                  <div style={{ fontSize: 16, opacity: 0.85, marginTop: 6 }}>
                    こたえ：{birdCage + 1}ばんめの かご
                  </div>
                )}
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
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "nowrap" }}>
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
const kidPanelFlex: React.CSSProperties = {
  padding: 12, borderRadius: 18, border: "3px solid rgba(80, 200, 255, 0.25)",
  background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0, 160, 255, 0.10)",
  boxSizing: "border-box",
  minHeight: 0, flex: 1, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden",
};
const kidPrimaryBtn: React.CSSProperties = {
  padding: "12px 24px", borderRadius: 18, border: "none",
  background: "linear-gradient(180deg, #ff73c6 0%, #ff3fa7 100%)",
  color: "#fff", fontWeight: 1000, fontSize: 16, cursor: "pointer", whiteSpace: "nowrap",
};
const kidSecondaryBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 14, border: "2px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" };
// Game-specific styles
const cageArea: React.CSSProperties = {
  display: "grid", placeItems: "center", flex: 1, minHeight: 0,
};
const cageContainer: React.CSSProperties = {
  position: "relative",
  width: "min(480px, 100%)",
  height: "clamp(140px, 28vh, 220px)",
};
const cageBtn: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1",
  borderRadius: 22,
  background: "rgba(255,255,255,0.95)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  transition: "transform 0.2s, box-shadow 0.2s, border 0.2s",
  userSelect: "none",
  padding: 4,
};
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
