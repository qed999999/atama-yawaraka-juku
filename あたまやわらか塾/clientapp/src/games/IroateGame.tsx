import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };

const GAME_SECONDS = 60;
const FEEDBACK_MS = 1000;

type ColorEntry = { name: string; hex: string };

const COLORS: ColorEntry[] = [
  { name: "あか", hex: "#ef4444" },
  { name: "あお", hex: "#3b82f6" },
  { name: "きいろ", hex: "#eab308" },
  { name: "みどり", hex: "#22c55e" },
  { name: "むらさき", hex: "#a855f7" },
  { name: "オレンジ", hex: "#f97316" },
  { name: "ピンク", hex: "#ec4899" },
  { name: "みずいろ", hex: "#06b6d4" },
];

type Question = {
  colorName: string;
  displayHex: string; // the text color (misleading)
  correctHex: string;
  choices: ColorEntry[];
  correctIndex: number;
};

export default function IroateGame({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<"ready" | "playing" | "result">("ready");
  const [initialBest] = useState(() => prevBest);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<null | { ok: boolean }>(null);
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

  const makeQuestion = (): Question => {
    let correctIdx: number;
    let tries = 0;
    do {
      correctIdx = randInt(0, COLORS.length - 1);
      tries++;
    } while (COLORS[correctIdx].name === prevAnswerRef.current && tries < 20);
    prevAnswerRef.current = COLORS[correctIdx].name;
    const correct = COLORS[correctIdx];

    // Pick a different color for misleading display
    let displayIdx = correctIdx;
    while (displayIdx === correctIdx) displayIdx = randInt(0, COLORS.length - 1);
    const displayHex = COLORS[displayIdx].hex;

    // Build 4 choices including the correct one
    const choiceSet = new Set<number>([correctIdx]);
    while (choiceSet.size < 4) choiceSet.add(randInt(0, COLORS.length - 1));
    const choiceIndices = shuffle([...choiceSet]);
    const choices = choiceIndices.map((i) => COLORS[i]);
    const correctIndex = choices.findIndex((c) => c.hex === correct.hex);

    return { colorName: correct.name, displayHex, correctHex: correct.hex, choices, correctIndex };
  };

  const startGame = () => {
    clearFeedbackTimer();
    setScore(0);
    setCorrectCount(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    setFeedback(null);
    setPhase("playing");
    setQuestion(makeQuestion());
  };

  const pick = (idx: number) => {
    if (!question || feedback) return;
    const ok = idx === question.correctIndex;
    if (ok) {
      setScore((s) => s + 10);
      setCorrectCount((c) => c + 1);
    } else {
      setScore((s) => Math.max(0, s - 5));
    }
    setFeedback({ ok });
    clearFeedbackTimer();
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      setQuestion(makeQuestion());
    }, FEEDBACK_MS);
  };

  if (phase === "ready") {
    return (
      <KidShell title="いろあてゲーム" onExit={onExit}>
        <div style={{ ...kidPanel, textAlign: "left" }}>
          <div style={{ fontSize: 24, fontWeight: 1000, marginBottom: 8 }}>
            もじの いろに まどわされないで！
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, opacity: 0.8, marginBottom: 16 }}>
            「いろの なまえ」に あう いろを えらぼう
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
          <div style={{ fontSize: 36, fontWeight: 1000, marginBottom: 8 }}>
            せいかい：{correctCount}
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

  const goResult = () => setPhase("result");
  const seconds = Math.ceil(timeLeftMs / 1000);

  return (
    <KidShell title="いろあてゲーム" onExit={onExit} rightExtra={<button style={kidSecondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={screenCol}>
        <div style={kidTopBar}>
          <span style={pillBlue}>のこり {seconds}びょう</span>
          <span style={pillPink}>せいかい {score}</span>
        </div>

        <div style={kidPanelFlex}>
          {question && (
            <>
              {/* Color name shown in misleading color */}
              <div style={{
                display: "grid", placeItems: "center", flex: 1, minHeight: 0,
              }}>
                <div style={{
                  fontSize: "clamp(60px, 16vw, 120px)", fontWeight: 1000,
                  color: question.displayHex,
                  textShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  userSelect: "none",
                }}>
                  {question.colorName}
                </div>
              </div>

              {/* 4 color buttons */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10, flexShrink: 0,
              }}>
                {question.choices.map((c, i) => (
                  <button key={i} onClick={() => pick(i)} disabled={!!feedback} style={{
                    padding: "18px 8px", borderRadius: 18,
                    border: "3px solid rgba(0,0,0,0.08)",
                    background: c.hex, cursor: "pointer",
                    boxShadow: "0 10px 18px rgba(0,0,0,0.12)",
                    opacity: feedback ? 0.7 : 1,
                    transition: "opacity 0.15s",
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 1000, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>
                      {c.name}
                    </div>
                  </button>
                ))}
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
                        こたえ：<span style={{ color: question.correctHex, fontWeight: 1000 }}>{question.colorName}</span>
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

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
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
};
const pillBlue: React.CSSProperties = { ...pillBase, background: "rgba(26, 168, 255, 0.10)", border: "2px solid rgba(26, 168, 255, 0.18)" };
const pillPink: React.CSSProperties = { ...pillBase, background: "rgba(255, 63, 167, 0.10)", border: "2px solid rgba(255, 63, 167, 0.18)" };
const kidPanel: React.CSSProperties = {
  padding: 12, borderRadius: 18, border: "3px solid rgba(80, 200, 255, 0.25)",
  background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0, 160, 255, 0.10)", boxSizing: "border-box",
};
const kidPanelFlex: React.CSSProperties = {
  ...kidPanel, minHeight: 0, flex: 1, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden",
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
