import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState } from "react";

type Props = { onExit: () => void; onScore?: (score: number, difficulty?: string) => void; difficultyBests?: Record<string, number>; unit?: string };
const GAME_SECONDS = 60;
const FEEDBACK_MS = 1200;
const SCORE_CORRECT = 10;
const SCORE_WRONG = -5;

type Difficulty = "easy" | "normal" | "hard";
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy:   "かんたん（こたえ 1〜9）",
  normal: "ふつう（こたえ 1〜19）",
  hard:   "むずかしい（こたえ 1〜49）",
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeQuestion(diff: Difficulty, prev = "") {
  let a: number, b: number;
  let tries = 0;
  do {
    if (diff === "easy") { b = randInt(1, 9); a = b + randInt(1, 9); }
    else if (diff === "normal") { b = randInt(1, 9); a = b + randInt(1, 19); }
    else { b = randInt(1, 49); a = b + randInt(1, 49); }
    tries++;
  } while (String(a - b) === prev && tries < 20);
  return { a, b, answer: a - b };
}

export default function SubtractionQuiz({ onExit, onScore, difficultyBests, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<"ready" | "playing" | "result">("ready");
  const [frozenBest, setFrozenBest] = useState<number | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [question, setQuestion] = useState(() => makeQuestion("normal"));
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<null | { ok: boolean; correct: number; your: string }>(null);
  const timerRef = useRef<number | null>(null);
  const phaseRef = useRef<"ready" | "playing" | "result">("ready");
  phaseRef.current = phase;
  const prevAnswerRef = useRef("");

  const clearTimer = () => { if (timerRef.current != null) { window.clearTimeout(timerRef.current); timerRef.current = null; } };
  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (phase === "result") onScore?.(score, DIFFICULTY_LABELS[difficulty]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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

  const startGame = (diff: Difficulty = difficulty) => {
    setFrozenBest(difficultyBests?.[DIFFICULTY_LABELS[diff]]);
    clearTimer();
    setScore(0); setCorrectCount(0); setAnsweredCount(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    setFeedback(null); setInput("");
    setDifficulty(diff);
    const q = makeQuestion(diff, prevAnswerRef.current);
    prevAnswerRef.current = String(q.answer);
    setQuestion(q);
    setPhase("playing");
  };

  const goResult = () => {
    clearTimer();
    setFeedback(null);
    setPhase("result");
  };

  const pushDigit = (d: number) => {
    if (phase !== "playing" || feedback) return;
    setInput(prev => prev === "0" ? String(d) : prev.length >= 6 ? prev : prev + d);
  };
  const clearInput = () => { if (phase !== "playing" || feedback) return; setInput(""); };
  const submit = () => {
    if (phase !== "playing" || !question || feedback || input.trim() === "") return;
    const your = input.trim();
    const ok = Number(your) === question.answer;
    setAnsweredCount(c => c + 1);
    if (ok) { setScore(s => s + SCORE_CORRECT); setCorrectCount(c => c + 1); }
    else setScore(s => Math.max(0, s + SCORE_WRONG));
    setFeedback({ ok, correct: question.answer, your });
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "result") return;
      const nextQ = makeQuestion(difficulty, prevAnswerRef.current);
      prevAnswerRef.current = String(nextQ.answer);
      setFeedback(null); setQuestion(nextQ); setInput("");
    }, FEEDBACK_MS);
  };

  if (phase === "ready") return (
    <KidShell title="ひきざんクイズ" onExit={onExit}>
      <div style={{ ...panel, textAlign: "left" }}>
        <p style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 1000 }}>➖ ひきざんクイズ</p>
        <p style={{ margin: "0 0 14px", fontSize: 14, opacity: 0.85 }}>
          60びょうで どれだけ できる？<br />
          せいかい +{SCORE_CORRECT}点 / まちがい {SCORE_WRONG}点
        </p>
        <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 1000 }}>むずかしさを えらんでね：</p>
        <div style={{ display: "grid", gap: 10 }}>
          {(["easy", "normal", "hard"] as Difficulty[]).map(d => (
            <button key={d} style={{ ...diffBtn,
              background: "linear-gradient(180deg, rgba(255,120,200,0.95), rgba(255,63,167,0.92))",
              color: "#fff",
              border: "3px solid rgba(255,63,167,0.18)",
              boxShadow: "0 4px 12px rgba(255,63,167,0.18)",
            }} onClick={() => startGame(d)}>
              <span style={{ fontSize: 18 }}>{d === "easy" ? "🌱" : d === "normal" ? "⭐" : "🔥"}</span>
              <span style={{ fontWeight: 1000, fontSize: 15 }}>{DIFFICULTY_LABELS[d]}</span>
            </button>
          ))}
        </div>
      </div>
    </KidShell>
  );

  if (phase === "result") return (
    <KidShell title="けっか" onExit={onExit}>
      <div style={panel}>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>{DIFFICULTY_LABELS[difficulty]}</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>スコア：{score}</div>
        <div style={{ fontSize: 18, marginBottom: 8 }}>せいかい：{correctCount} もん</div>
        <div style={{ fontSize: 16, opacity: 0.85, marginBottom: 16 }}>こたえた もん：{answeredCount} もん</div>
        <RecordBanner score={score} prevBest={frozenBest} unit={unit} />
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={primaryBtn} onClick={() => startGame(difficulty)}>もういっかい</button>
          <button style={secondaryBtn} onClick={() => setPhase("ready")}>むずかしさを かえる</button>
          <button style={secondaryBtn} onClick={onExit}>メニューへ</button>
        </div>
      </div>
    </KidShell>
  );

  const seconds = Math.ceil(timeLeftMs / 1000);
  const markColor = feedback?.ok ? "#22c55e" : "#ef4444";

  return (
    <KidShell title="ひきざんクイズ" onExit={onExit} rightExtra={<button style={secondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={topBar}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>のこり：{seconds}秒</div>
          <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.75 }}>
            {difficulty === "easy" ? "🌱かんたん" : difficulty === "normal" ? "⭐ふつう" : "🔥むずかしい"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>スコア：{score}</div>
        </div>
        <div style={panel}>
          {/* 問題 */}
          <div style={{ display: "grid", placeItems: "center", marginBottom: 12 }}>
            <div style={{ width: "min(560px, 100%)", height: 180, display: "grid", placeItems: "center",
              borderRadius: 16, border: "3px dashed rgba(255,63,167,0.22)",
              background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(255,63,167,0.10)",
              boxSizing: "border-box", padding: 12 }}>
              <div style={{ fontSize: "clamp(52px, 14vw, 80px)", fontWeight: 1000, lineHeight: 1, userSelect: "none" }}>
                {question.a} − {question.b}
              </div>
            </div>
          </div>
          {/* 入力欄 */}
          <div style={{ width: "min(560px, 100%)", margin: "0 auto 12px", borderRadius: 16,
            border: "3px solid rgba(120,214,255,0.25)", background: "rgba(255,255,255,0.92)",
            boxShadow: "0 10px 18px rgba(0,160,255,0.10)", padding: "12px 14px",
            boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0ea5e9", opacity: 0.9 }}>こたえ</div>
            <div style={{ fontSize: 32, fontWeight: 1000, height: 44, lineHeight: "44px",
              minWidth: 120, textAlign: "right", padding: "2px 6px", borderRadius: 10,
              background: "rgba(255,63,167,0.06)", border: "2px solid rgba(255,63,167,0.10)" }}>
              {input === "" ? " " : input}
            </div>
          </div>
          {/* キー */}
          <div style={{ width: "min(560px, 100%)", margin: "0 auto", display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(d => (
                <button key={d} onClick={() => pushDigit(d)}
                  style={{ ...keyBtn, opacity: feedback ? 0.6 : 1, pointerEvents: feedback ? "none" : "auto" }}>{d}</button>
              ))}
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <button onClick={clearInput} style={{ ...dangerBtn, opacity: feedback ? 0.6 : 1, pointerEvents: feedback ? "none" : "auto" }}>クリア</button>
              <button onClick={() => pushDigit(0)} style={{ ...keyBtn, opacity: feedback ? 0.6 : 1, pointerEvents: feedback ? "none" : "auto" }}>0</button>
              <button onClick={submit} style={{ ...primaryBtn, padding: "12px 10px", fontSize: 18,
                opacity: feedback || input.trim() === "" ? 0.6 : 1,
                pointerEvents: feedback || input.trim() === "" ? "none" : "auto" }}>OK</button>
            </div>
          </div>
          {/* フィードバック */}
          {feedback && (
            <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center",
              background: "rgba(255,255,255,0.65)", zIndex: 9999, padding: 16, boxSizing: "border-box" }}>
              <div style={{ width: "min(520px, 92vw)", borderRadius: 22,
                border: "3px solid rgba(255,170,220,0.55)", background: "rgba(255,255,255,0.95)",
                boxShadow: "0 20px 60px rgba(255,63,167,0.18)", padding: "20px 18px",
                textAlign: "center", boxSizing: "border-box" }}>
                <div style={{ fontSize: 72, fontWeight: 1000, lineHeight: 1, marginBottom: 6, color: markColor }}>{feedback.ok ? "○" : "×"}</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>{feedback.ok ? "せいかい！" : "ざんねん！"}</div>
                <div style={{ fontSize: 16, opacity: 0.88 }}>ただしい こたえ：{feedback.correct}<br />あなたの こたえ：{feedback.your}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </KidShell>
  );
}

function KidShell({ title, onExit, children, rightExtra }: { title: string; onExit: () => void; children: React.ReactNode; rightExtra?: React.ReactNode }) {
  return (
    <div style={stage}>
      <div style={sparkles} aria-hidden />
      <div style={card}>
        <div style={headerRow}>
          <div style={titleStyle}>{title}</div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "nowrap" }}>
            {rightExtra}
            <button style={headerBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
        <div style={{ marginTop: 10, minHeight: 0, flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>{children}</div>
      </div>
    </div>
  );
}
const stage: React.CSSProperties = {
  position: "fixed", inset: 0, overflow: "hidden",
  padding: "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
  boxSizing: "border-box",
  background: "radial-gradient(circle at 15% 20%, rgba(255,230,109,0.35), transparent 40%), radial-gradient(circle at 85% 25%, rgba(255,140,189,0.28), transparent 42%), radial-gradient(circle at 20% 85%, rgba(120,214,255,0.25), transparent 45%), linear-gradient(180deg, #fff7fe 0%, #f1fbff 55%, #fffdf2 100%)",
  fontFamily: "ui-rounded, system-ui, -apple-system, 'Hiragino Maru Gothic ProN', 'M PLUS Rounded 1c', 'Noto Sans JP', sans-serif",
  color: "#1b1b1b", display: "grid", placeItems: "center",
};
const sparkles: React.CSSProperties = {
  position: "absolute", inset: -40, pointerEvents: "none",
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.95) 0 2px, transparent 3px), radial-gradient(circle, rgba(255,255,255,0.85) 0 1.5px, transparent 3px)",
  backgroundSize: "110px 110px, 160px 160px", backgroundPosition: "0 0, 40px 60px", opacity: 0.25,
};
const card: React.CSSProperties = {
  width: "min(980px, 100%)", height: "100%", maxHeight: "100%",
  borderRadius: 22, padding: 10, boxSizing: "border-box",
  background: "rgba(255,255,255,0.86)", border: "3px solid rgba(255,170,220,0.55)",
  boxShadow: "0 18px 44px rgba(255,120,180,0.18)", display: "flex", flexDirection: "column", overflow: "hidden",
};
const headerRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap", minWidth: 0 };
const titleStyle: React.CSSProperties = { fontWeight: 1000, fontSize: 22, color: "#ff3fa7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };
const headerBtn: React.CSSProperties = { padding: "10px 12px", borderRadius: 16, border: "2px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 };
const topBar: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 16, background: "rgba(255,255,255,0.92)", border: "3px solid rgba(120,214,255,0.25)", boxShadow: "0 10px 18px rgba(0,160,255,0.10)" };
const panel: React.CSSProperties = { padding: 16, borderRadius: 18, border: "3px solid rgba(80,200,255,0.25)", background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0,160,255,0.10)", boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { padding: "12px 16px", borderRadius: 18, border: "3px solid rgba(255,63,167,0.18)", background: "linear-gradient(180deg, rgba(255,120,200,0.95), rgba(255,63,167,0.92))", color: "#fff", fontWeight: 1000, fontSize: 18, cursor: "pointer", boxShadow: "0 12px 22px rgba(255,63,167,0.18)" };
const secondaryBtn: React.CSSProperties = { padding: "10px 14px", borderRadius: 18, border: "3px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.85)", fontWeight: 1000, cursor: "pointer" };
const keyBtn: React.CSSProperties = { padding: "14px 12px", borderRadius: 18, border: "3px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.92)", cursor: "pointer", boxShadow: "0 10px 18px rgba(0,0,0,0.08)", fontSize: 26, fontWeight: 1000, userSelect: "none" };
const dangerBtn: React.CSSProperties = { padding: "14px 12px", borderRadius: 18, border: "3px solid rgba(239,68,68,0.18)", background: "linear-gradient(180deg, rgba(255,180,180,0.95), rgba(239,68,68,0.86))", color: "#fff", fontWeight: 1000, fontSize: 16, cursor: "pointer", boxShadow: "0 12px 22px rgba(239,68,68,0.18)" };
const diffBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 18, border: "3px solid rgba(0,0,0,0.08)", cursor: "pointer", fontWeight: 1000, fontSize: 15, transition: "all 0.15s", textAlign: "left" };
