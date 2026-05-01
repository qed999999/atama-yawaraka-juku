import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };

type Answer = "left" | "equal" | "right";

type Question = {
  left: number;
  right: number;
  answer: Answer;
};

const GAME_SECONDS = 60;
const FEEDBACK_MS = 1000;

export default function DotCompareGame({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<"ready" | "playing" | "result">("ready");
  const [initialBest] = useState(() => prevBest);

  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<null | { ok: boolean; answer: Answer }>(null);

  const feedbackTimerRef = useRef<number | null>(null);
  const prevAnswerRef = useRef("");

  // ===== タイマー =====
  useEffect(() => {
    if (phase !== "playing") return;

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
    // eslint-disable-next-line
  }, [phase]);

  useEffect(() => {
    if (phase === "result") onScore?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ===== 出題 =====
  useEffect(() => {
    if (phase !== "playing") return;
    const q = makeQuestion(correctCount, prevAnswerRef.current);
    prevAnswerRef.current = q.answer;
    setQuestion(q);
  }, [phase, correctCount]);

  const startGame = () => {
    clearFeedbackTimer();
    setScore(0);
    setCorrectCount(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    setPhase("playing");
  };

  const pick = (picked: Answer) => {
    if (!question || feedback) return;

    const ok = picked === question.answer;
    if (ok) {
      setScore((s) => s + 10);
      setCorrectCount((c) => c + 1);
    } else {
      setScore((s) => Math.max(0, s - 5));
    }

    setFeedback({ ok, answer: question.answer });

    clearFeedbackTimer();
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      const nextQ = makeQuestion(correctCount + (ok ? 1 : 0), prevAnswerRef.current);
      prevAnswerRef.current = nextQ.answer;
      setQuestion(nextQ);
    }, FEEDBACK_MS);
  };

  const clearFeedbackTimer = () => {
    if (feedbackTimerRef.current != null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  };

  // ===== UI =====

  const goResult = () => { clearFeedbackTimer(); setFeedback(null); setPhase("result"); };

  if (phase === "ready") {
    return (
      <KidShell title="かずあそび" onExit={onExit}>
        <div style={{ ...kidPanel, textAlign: "left" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚖️</div>
          <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 8 }}>どちらが おおきい？</div>
          <div style={{ fontSize: 15, fontWeight: 900, opacity: 0.8, marginBottom: 16, lineHeight: 1.7 }}>
            ●のかずをくらべて えらぼう！<br />60びょうで どれだけ できるかな？
          </div>
          <button style={kidPrimaryBtn} onClick={startGame}>スタート</button>
        </div>
      </KidShell>
    );
  }

  if (phase === "result") {
    return (
      <KidShell title="けっか" onExit={onExit}>
        <div style={kidPanel}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎊</div>
          <div style={{ fontSize: 28, fontWeight: 1000, marginBottom: 8 }}>スコア：{score}てん</div>
          <RecordBanner score={score} prevBest={initialBest} unit={unit} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button style={kidPrimaryBtn} onClick={startGame}>もういっかい</button>
            <button style={kidSecondaryBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
      </KidShell>
    );
  }

  // playing
  const seconds = Math.ceil(timeLeftMs / 1000);

  return (
    <KidShell title="かずあそび" onExit={onExit} rightExtra={<button style={kidSecondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={screenCol}>
        <div style={kidTopBarOneLine}>
          <span style={pillBlue}>のこり {seconds}びょう</span>
          <span style={pillPink}>{score}てん</span>
          <span style={pillPurple}>せいかい {correctCount}</span>
        </div>

        <div style={kidPanelFlex}>
          {question && (
            <>
              {/* 出題エリア */}
              <div style={silhouetteWrap}>
                <div style={dotFrame}>
                  <DotRow count={question.left} />
                  <div style={{ fontSize: 32, fontWeight: 1000 }}>?</div>
                  <DotRow count={question.right} />
                </div>
              </div>

              {/* 3択 */}
              <div style={choicesRowOneLine}>
                <ChoiceBtn label="←" onClick={() => pick("left")} disabled={!!feedback} />
                <ChoiceBtn label="＝" onClick={() => pick("equal")} disabled={!!feedback} />
                <ChoiceBtn label="→" onClick={() => pick("right")} disabled={!!feedback} />
              </div>

              {feedback && (
                <div style={kidOverlay}>
                  <div style={kidFeedbackCard(feedback.ok)}>
                    <div style={{ fontSize: 64, fontWeight: 1000, color: feedback.ok ? "#22c55e" : "#ef4444" }}>{feedback.ok ? "○" : "×"}</div>
                    <div style={{ fontSize: 22, fontWeight: 1000 }}>
                      {feedback.ok ? "せいかい！" : "ざんねん！"}
                    </div>
                    {!feedback.ok && question && (
                      <div style={{ fontSize: 16, opacity: 0.85, marginTop: 6 }}>
                        こたえ：{question.left} {feedback.answer === "left" ? ">" : feedback.answer === "right" ? "<" : "="} {question.right}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </KidShell>
  );
}

// ===== helpers =====

function makeQuestion(level: number, prev = ""): Question {
  let left: number, right: number, answer: Answer;
  let tries = 0;
  do {
    const max = Math.min(3 + Math.floor(level / 3), 9);
    left = rand(1, max);
    right = rand(1, max);

    // 初期は同数を避ける
    if (level < 8) {
      while (left === right) right = rand(1, max);
    }

    answer = left > right ? "left" : left < right ? "right" : "equal";
    tries++;
  } while (answer === prev && tries < 20);

  return { left, right, answer };
}

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function DotRow({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#333",
          }}
        />
      ))}
    </div>
  );
}

function ChoiceBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...kidChoiceBtnCompact,
        fontSize: 36,
        fontWeight: 1000,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}


// ------ Kid UI (no-scroll, one-screen) ------
function KidShell({
    title,
    onExit,
    children,
    rightExtra,
  }: {
    title: string;
    onExit: () => void;
    children: React.ReactNode;
    rightExtra?: React.ReactNode;
  }) {
    return (
      <div style={stageFixedNoScroll}>
        <div style={sparkles} />
  
        <div style={cardNoScroll}>
          <div style={headerRowNoWrap}>
            <div style={titleNoWrap}>{title}</div>
  
            <div style={headerBtnsNoWrap}>
              {rightExtra}
              <button style={kidHeaderBtn} onClick={onExit}>
                メニューへ
              </button>
            </div>
          </div>
  
          <div style={contentNoScroll}>{children}</div>
        </div>
      </div>
    );
  }
  
  /** ✅ 画面固定 & スクロール禁止（iPhoneでも） */
  const stageFixedNoScroll: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    overflow: "hidden",
    padding:
      "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
    boxSizing: "border-box",
    background:
      "radial-gradient(circle at 15% 20%, rgba(255, 230, 109, 0.35), transparent 40%)," +
      "radial-gradient(circle at 85% 25%, rgba(255, 140, 189, 0.28), transparent 42%)," +
      "radial-gradient(circle at 20% 85%, rgba(120, 214, 255, 0.25), transparent 45%)," +
      "linear-gradient(180deg, #fff7fe 0%, #f1fbff 55%, #fffdf2 100%)",
    fontFamily:
      "ui-rounded, system-ui, -apple-system, 'Hiragino Maru Gothic ProN', 'M PLUS Rounded 1c', 'Noto Sans JP', sans-serif",
    color: "#1b1b1b",
    display: "grid",
    placeItems: "center",
  };
  
  const sparkles: React.CSSProperties = {
    position: "absolute",
    inset: -40,
    pointerEvents: "none",
    backgroundImage:
      "radial-gradient(circle, rgba(255, 255, 255, 0.95) 0 2px, transparent 3px), " +
      "radial-gradient(circle, rgba(255, 255, 255, 0.85) 0 1.5px, transparent 3px)",
    backgroundSize: "110px 110px, 160px 160px",
    backgroundPosition: "0 0, 40px 60px",
    opacity: 0.25,
  };
  
  const cardNoScroll: React.CSSProperties = {
    width: "min(980px, 100%)",
    height: "100%",
    maxHeight: "100%",
    borderRadius: 22,
    padding: 10,
    boxSizing: "border-box",
    background: "rgba(255, 255, 255, 0.86)",
    border: "3px solid rgba(255, 170, 220, 0.55)",
    boxShadow: "0 18px 44px rgba(255, 120, 180, 0.18)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };
  
  const headerRowNoWrap: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "nowrap",
    minWidth: 0,
  };
  
  const titleNoWrap: React.CSSProperties = {
    fontWeight: 1000,
    fontSize: 22,
    color: "#ff3fa7",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
  };
  
  const headerBtnsNoWrap: React.CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "nowrap",
    flexShrink: 0,
  };
  
  const kidHeaderBtn: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 16,
    border: "2px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    fontWeight: 1000,
    fontSize: 14,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  
  const contentNoScroll: React.CSSProperties = {
    marginTop: 8,
    minHeight: 0,
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };
  
  const screenCol: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 0,
    flex: 1,
  };
  
  const kidTopBarOneLine: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "nowrap",
    padding: "8px 10px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.75)",
    border: "2px solid rgba(0,0,0,0.06)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
    overflow: "hidden",
  };
  
  const pillBase: React.CSSProperties = {
    fontWeight: 1000,
    borderRadius: 999,
    padding: "6px 10px",
    border: "2px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.6)",
    whiteSpace: "nowrap",
    fontSize: 13,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  
  const pillBlue: React.CSSProperties = {
    ...pillBase,
    background: "rgba(26, 168, 255, 0.10)",
    border: "2px solid rgba(26, 168, 255, 0.18)",
  };
  const pillPink: React.CSSProperties = {
    ...pillBase,
    background: "rgba(255, 63, 167, 0.10)",
    border: "2px solid rgba(255, 63, 167, 0.18)",
  };
  const pillPurple: React.CSSProperties = {
    ...pillBase,
    background: "rgba(124, 58, 237, 0.10)",
    border: "2px solid rgba(124, 58, 237, 0.18)",
  };
  
  const kidPanel: React.CSSProperties = {
    padding: 12,
    borderRadius: 18,
    border: "3px solid rgba(80, 200, 255, 0.25)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 12px 22px rgba(0, 160, 255, 0.10)",
    boxSizing: "border-box",
  };
  
  const kidPanelFlex: React.CSSProperties = {
    ...kidPanel,
    minHeight: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflow: "hidden",
  };
  
  const silhouetteWrap: React.CSSProperties = {
    display: "grid",
    placeItems: "center",
    flex: 1,
    minHeight: 0,
  };
  
  const choicesRowOneLine: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    flexShrink: 0,
  };
  
  const kidChoiceBtnCompact: React.CSSProperties = {
    padding: 8,
    borderRadius: 18,
    border: "3px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.90)",
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
    display: "grid",
    gap: 6,
    overflow: "hidden",
    minWidth: 0,
  };
  
  const kidPrimaryBtn: React.CSSProperties = {
    padding: "12px 24px",
    borderRadius: 18,
    border: "none",
    background: "linear-gradient(180deg, #ff73c6 0%, #ff3fa7 100%)",
    color: "#fff",
    fontWeight: 1000,
    fontSize: 16,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  const kidSecondaryBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 14, border: "2px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" };
  
  const kidOverlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.25)",
    zIndex: 9999,
    padding:
      "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
    boxSizing: "border-box",
    overflow: "hidden",
  };
  
  const kidFeedbackCard = (ok: boolean): React.CSSProperties => ({
    width: "min(420px, 92vw)",
    maxWidth: "calc(100vw - 32px)",
    boxSizing: "border-box",
    borderRadius: 22,
    border: `3px solid ${ok ? "rgba(34,197,94,0.35)" : "rgba(255,99,177,0.35)"}`,
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
    padding: 16,
    textAlign: "center",
    color: "#1b1b1b",
    overflow: "hidden",
  });
  
  const dotFrame: React.CSSProperties = {
    width: "100%",
    maxWidth: 560,
    height: "clamp(220px, 42vh, 360px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    gap: 12,
    borderRadius: 18,
    border: "2px dashed rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.80)",
    boxSizing: "border-box",
  };