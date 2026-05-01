import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };

type Question = {
  a: number;
  b: number;
  answer: number;
};

const GAME_SECONDS = 60;
const FEEDBACK_MS = 1200;
const SCORE_CORRECT = 10;
const SCORE_WRONG = -5;

export default function TashizanQuiz({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<"ready" | "playing" | "result">("ready");
  const [initialBest] = useState(() => prevBest);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<null | { ok: boolean; correct: number; your: string }>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const prevAnswerRef = useRef("");

  const clearFeedbackTimer = () => {
    if (feedbackTimerRef.current != null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  };

  useEffect(() => () => clearFeedbackTimer(), []);

  useEffect(() => {
    if (phase === "result") onScore?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const startedAt = performance.now();
    const startLeft = timeLeftMs;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const left = Math.max(0, startLeft - elapsed);
      setTimeLeftMs(left);
      if (left <= 0) { setPhase("result"); return; }
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const newQuestion = () => {
    let a: number, b: number;
    let tries = 0;
    do {
      a = randInt(1, 9);
      b = randInt(1, 9);
      tries++;
    } while (String(a + b) === prevAnswerRef.current && tries < 20);
    prevAnswerRef.current = String(a + b);
    setQuestion({ a, b, answer: a + b });
    setInput("");
  };

  const startGame = () => {
    clearFeedbackTimer();
    setScore(0);
    setCorrectCount(0);
    setAnsweredCount(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    setFeedback(null);
    setPhase("playing");
    newQuestion();
  };

  const goResult = () => {
    clearFeedbackTimer();
    setFeedback(null);
    setPhase("result");
  };

  const pushDigit = (d: number) => {
    if (phase !== "playing" || feedback) return;
    setInput((prev) => {
      if (prev === "0") return String(d);
      if (prev.length >= 4) return prev;
      return prev + String(d);
    });
  };

  const clearInput = () => {
    if (phase !== "playing" || feedback) return;
    setInput("");
  };

  const submit = () => {
    if (phase !== "playing" || !question || feedback) return;
    if (input.trim() === "") return;

    const your = input.trim();
    const yourNum = Number(your);
    const ok = Number.isFinite(yourNum) && yourNum === question.answer;

    setAnsweredCount((c) => c + 1);
    if (ok) {
      setScore((s) => s + SCORE_CORRECT);
      setCorrectCount((c) => c + 1);
    } else {
      setScore((s) => Math.max(0, s + SCORE_WRONG));
    }

    setFeedback({ ok, correct: question.answer, your });
    clearFeedbackTimer();
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      newQuestion();
    }, FEEDBACK_MS);
  };

  if (phase === "ready") {
    return (
      <Shell title="たしざんクイズ" onExit={onExit}>
        <div style={{ ...panel, width: "100%", maxWidth: "none", textAlign: "left" }}>
          <p style={{ margin: 0, fontSize: 18 }}>60びょうで どれだけ できる？</p>
          <ul style={{ marginTop: 10, marginBottom: 18, lineHeight: 1.7 }}>
            <li>せいかい：+{SCORE_CORRECT}てん</li>
            <li>まちがい：{SCORE_WRONG}てん</li>
            <li>こたえは「でんたく」みたいに にゅうりょく</li>
          </ul>
          <button style={primaryBtn} onClick={startGame}>スタート</button>
        </div>
      </Shell>
    );
  }

  if (phase === "result") {
    return (
      <Shell title="けっか" onExit={onExit}>
        <div style={{ ...panel, width: "100%", maxWidth: "none" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>スコア：{score}</div>
          <div style={{ fontSize: 18, marginBottom: 8 }}>せいかい：{correctCount} もん</div>
          <div style={{ fontSize: 16, opacity: 0.85, marginBottom: 16 }}>こたえた：{answeredCount} もん</div>
          <RecordBanner score={score} prevBest={initialBest} unit={unit} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button style={primaryBtn} onClick={startGame}>もういっかい</button>
            <button style={secondaryBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
      </Shell>
    );
  }

  const seconds = Math.ceil(timeLeftMs / 1000);
  const okColor = "#22c55e";
  const ngColor = "#ef4444";
  const markColor = feedback?.ok ? okColor : ngColor;

  return (
    <Shell title="たしざんクイズ" onExit={onExit}
      rightExtra={<button style={secondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={topBar}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>のこり：{seconds}秒</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>スコア：{score}</div>
        </div>

        <div style={panel}>
          {!question ? <div>よみこみちゅう…</div> : (
            <>
              <div style={{ display: "grid", placeItems: "center", marginBottom: 12 }}>
                <div style={{
                  width: "min(560px, 100%)", height: 200,
                  display: "grid", placeItems: "center",
                  borderRadius: 16, border: "3px dashed rgba(34, 197, 94, 0.28)",
                  background: "rgba(255,255,255,0.92)",
                  boxShadow: "0 12px 22px rgba(34, 197, 94, 0.10)",
                  boxSizing: "border-box", padding: 12,
                }}>
                  <div style={{
                    fontSize: 92, fontWeight: 1000, lineHeight: 1,
                    textShadow: "0 12px 40px rgba(0,0,0,0.25)", userSelect: "none",
                  }}
                    aria-label={`もんだい: ${question.a} たす ${question.b}`}
                  >
                    {question.a} + {question.b}
                  </div>
                </div>
              </div>

              <div style={{
                width: "min(560px, 100%)", margin: "0 auto 12px",
                borderRadius: 16, border: "3px solid rgba(120, 214, 255, 0.25)",
                background: "rgba(255,255,255,0.92)",
                boxShadow: "0 10px 18px rgba(0, 160, 255, 0.10)",
                padding: "12px 14px", boxSizing: "border-box",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0ea5e9", opacity: 0.9 }}>こたえ</div>
                <div style={{
                  fontSize: 32, fontWeight: 1000, letterSpacing: 1,
                  height: 44, lineHeight: "44px", minWidth: 120, textAlign: "right",
                  padding: "2px 6px", borderRadius: 10,
                  background: "rgba(34, 197, 94, 0.06)", border: "2px solid rgba(34, 197, 94, 0.10)",
                }}>
                  {input === "" ? " " : input}
                </div>
              </div>

              <div style={{ width: "min(560px, 100%)", margin: "0 auto", display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                  {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => (
                    <button key={d} onClick={() => pushDigit(d)} style={{
                      ...keyBtn, opacity: feedback ? 0.6 : 1,
                      pointerEvents: feedback ? "none" : "auto",
                    }}>{d}</button>
                  ))}
                </div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                  <button onClick={clearInput} style={{
                    ...dangerBtn, opacity: feedback ? 0.6 : 1,
                    pointerEvents: feedback ? "none" : "auto",
                  }}>クリア</button>
                  <button onClick={() => pushDigit(0)} style={{
                    ...keyBtn, opacity: feedback ? 0.6 : 1,
                    pointerEvents: feedback ? "none" : "auto",
                  }}>0</button>
                  <button onClick={submit} style={{
                    ...primaryBtn, padding: "12px 10px", fontSize: 18,
                    opacity: feedback || input.trim() === "" ? 0.6 : 1,
                    pointerEvents: feedback || input.trim() === "" ? "none" : "auto",
                  }}>OK</button>
                </div>
              </div>

              {feedback && (
                <div style={{
                  position: "fixed", inset: 0, display: "grid", placeItems: "center",
                  background: "rgba(255, 255, 255, 0.65)", zIndex: 9999,
                  padding: 16, boxSizing: "border-box",
                }}>
                  <div style={{
                    width: "min(520px, 92vw)", maxWidth: "calc(100vw - 32px)",
                    borderRadius: 22, border: "3px solid rgba(255, 170, 220, 0.55)",
                    background: "rgba(255,255,255,0.95)",
                    boxShadow: "0 20px 60px rgba(255, 63, 167, 0.18)",
                    padding: "20px 18px", textAlign: "center", color: "#1b1b1b", boxSizing: "border-box",
                  }}>
                    <div style={{
                      fontSize: 72, fontWeight: 1000, lineHeight: 1, marginBottom: 6,
                      color: markColor, textShadow: "0 6px 18px rgba(255, 63, 167, 0.25)",
                    }}>
                      {feedback.ok ? "○" : "×"}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
                      {feedback.ok ? "せいかい！" : "ざんねん！"}
                    </div>
                    <div style={{ fontSize: 16, opacity: 0.88 }}>
                      ただしい こたえ：{feedback.correct}<br />
                      あなたの こたえ：{feedback.your}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function Shell({ title, onExit, children, rightExtra }: {
  title: string; onExit: () => void; children: React.ReactNode; rightExtra?: React.ReactNode;
}) {
  return (
    <div style={stageFixedNoScroll}>
      <div style={sparkles} aria-hidden />
      <div style={cardNoScroll}>
        <div style={headerRowNoWrap}>
          <h1 style={titleNoWrap}>{title}</h1>
          <div style={headerBtnsNoWrap}>
            {rightExtra}
            <button style={kidHeaderBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
        <div style={{ marginTop: 10, minHeight: 0, flex: 1, overflow: "hidden" }}>{children}</div>
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
  background: "rgba(255, 255, 255, 0.86)", border: "3px solid rgba(255, 170, 220, 0.55)",
  boxShadow: "0 18px 44px rgba(255, 120, 180, 0.18)",
  display: "flex", flexDirection: "column", overflow: "hidden",
};
const headerRowNoWrap: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap", minWidth: 0,
};
const titleNoWrap: React.CSSProperties = {
  margin: 0, fontWeight: 1000, fontSize: 22, color: "#ff3fa7",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
};
const headerBtnsNoWrap: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "nowrap", flexShrink: 0 };
const kidHeaderBtn: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 16, border: "2px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
};
const topBar: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "10px 12px", borderRadius: 16, background: "rgba(255,255,255,0.92)",
  border: "3px solid rgba(120, 214, 255, 0.25)", boxShadow: "0 10px 18px rgba(0, 160, 255, 0.10)",
};
const panel: React.CSSProperties = {
  padding: 16, borderRadius: 18, border: "3px solid rgba(80, 200, 255, 0.25)",
  background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0, 160, 255, 0.10)", boxSizing: "border-box",
};
const primaryBtn: React.CSSProperties = {
  padding: "12px 16px", borderRadius: 18, border: "3px solid rgba(255, 63, 167, 0.18)",
  background: "linear-gradient(180deg, rgba(255, 120, 200, 0.95), rgba(255, 63, 167, 0.92))",
  color: "#fff", fontWeight: 1000, fontSize: 18, cursor: "pointer",
  boxShadow: "0 12px 22px rgba(255, 63, 167, 0.18)",
};
const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 18, border: "3px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)", fontWeight: 1000, cursor: "pointer", fontSize: 16,
};
const keyBtn: React.CSSProperties = {
  padding: "14px 12px", borderRadius: 18, border: "3px solid rgba(0,0,0,0.06)",
  background: "rgba(255,255,255,0.92)", cursor: "pointer", boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
  fontSize: 26, fontWeight: 1000, userSelect: "none",
};
const dangerBtn: React.CSSProperties = {
  padding: "14px 12px", borderRadius: 18, border: "3px solid rgba(239, 68, 68, 0.18)",
  background: "linear-gradient(180deg, rgba(255, 180, 180, 0.95), rgba(239, 68, 68, 0.86))",
  color: "#fff", fontWeight: 1000, fontSize: 16, cursor: "pointer",
  boxShadow: "0 12px 22px rgba(239, 68, 68, 0.18)",
};
