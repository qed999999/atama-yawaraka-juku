import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };
type Phase = "ready" | "playing" | "result";

const GAME_SECONDS = 60;
const FEEDBACK_MS = 1000;

type Question = {
  hint: string;       // emoji or image hint
  display: string;    // word with □ for blank e.g. "り□ご"
  answer: string;     // the missing character e.g. "ん"
  choices: string[];  // 4 choices
};

const ALL_QUESTIONS: Question[] = [
  { hint: "🍎", display: "り□ご", answer: "ん", choices: ["ん", "い", "え", "お"] },
  { hint: "🍌", display: "□なな", answer: "ば", choices: ["ば", "は", "か", "ま"] },
  { hint: "🍊", display: "みか□", answer: "ん", choices: ["ん", "い", "う", "り"] },
  { hint: "🐶", display: "い□", answer: "ぬ", choices: ["ぬ", "む", "ふ", "る"] },
  { hint: "🐱", display: "ね□", answer: "こ", choices: ["こ", "そ", "と", "の"] },
  { hint: "🐸", display: "か□る", answer: "え", choices: ["え", "あ", "い", "お"] },
  { hint: "🌸", display: "さ□ら", answer: "く", choices: ["く", "す", "し", "せ"] },
  { hint: "⭐", display: "ほ□", answer: "し", choices: ["し", "ち", "に", "み"] },
  { hint: "🌙", display: "つ□", answer: "き", choices: ["き", "ぎ", "け", "げ"] },
  { hint: "🚂", display: "で□しゃ", answer: "ん", choices: ["ん", "ー", "あ", "い"] },
  { hint: "✈️", display: "ひこう□", answer: "き", choices: ["き", "ぎ", "け", "げ"] },
  { hint: "🚗", display: "く□ま", answer: "る", choices: ["る", "ら", "り", "れ"] },
  { hint: "🌈", display: "に□", answer: "じ", choices: ["じ", "し", "ち", "き"] },
  { hint: "⛄", display: "ゆ□だるま", answer: "き", choices: ["き", "ぎ", "け", "く"] },
  { hint: "🏠", display: "い□", answer: "え", choices: ["え", "あ", "い", "お"] },
  { hint: "🌊", display: "う□", answer: "み", choices: ["み", "に", "り", "き"] },
  { hint: "🍙", display: "お□すび", answer: "に", choices: ["に", "ね", "の", "な"] },
  { hint: "🎂", display: "ケー□", answer: "キ", choices: ["キ", "ク", "コ", "カ"] },
  { hint: "🍜", display: "ラー□ン", answer: "メ", choices: ["メ", "テ", "ネ", "レ"] },
  { hint: "🐘", display: "ぞ□", answer: "う", choices: ["う", "お", "あ", "い"] },
  { hint: "🦊", display: "き□ね", answer: "つ", choices: ["つ", "て", "と", "た"] },
  { hint: "🐰", display: "う□ぎ", answer: "さ", choices: ["さ", "し", "す", "そ"] },
  { hint: "🍓", display: "いち□", answer: "ご", choices: ["ご", "げ", "ぐ", "が"] },
  { hint: "🎃", display: "か□ちゃ", answer: "ぼ", choices: ["ぼ", "べ", "び", "ば"] },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function HiraganaGame({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [initialBest] = useState(() => prevBest);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [pool, setPool] = useState<Question[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; picked: string } | null>(null);

  const timerRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;
  const prevAnswerRef = useRef("");

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

  const goResult = () => setPhase("result");

  const start = useCallback(() => {
    setScore(0);
    setRound(0);
    setQIdx(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    setFeedback(null);
    setPool(shuffle(ALL_QUESTIONS));
    setPhase("playing");
  }, []);

  function pick(choice: string) {
    if (phase !== "playing" || feedback) return;
    const q = pool[qIdx % pool.length];
    const ok = choice === q.answer;
    setFeedback({ ok, picked: choice });
    if (ok) setScore(s => s + 10);
    else setScore(s => Math.max(0, s - 5));

    timerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "result") return;
      setFeedback(null);
      setRound(r => r + 1);
      setQIdx(i => {
        let next = i + 1;
        if (pool.length > 1 && pool[next % pool.length].answer === prevAnswerRef.current) next++;
        prevAnswerRef.current = pool[next % pool.length].answer;
        return next;
      });
    }, FEEDBACK_MS);
  }

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    if (phase === "result") onScore?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "ready") return (
    <KidShell title="ひらがなあて" onExit={onExit}>
      <div style={{ ...kidPanel, textAlign: "left" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>📝</div>
        <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 8 }}>
          □に はいる もじを えらぼう！
        </div>
        <div style={{ fontSize: 15, fontWeight: 900, opacity: 0.8, marginBottom: 16, lineHeight: 1.7 }}>
          えを みて、たりない もじを タップ！
        </div>
        <button style={kidPrimaryBtn} onClick={start}>スタート</button>
      </div>
    </KidShell>
  );

  if (phase === "result") return (
    <KidShell title="けっか" onExit={onExit}>
      <div style={kidPanel}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎊</div>
        <div style={{ fontSize: 28, fontWeight: 1000, marginBottom: 8 }}>スコア：{score}てん</div>
        <div style={{ fontSize: 16, fontWeight: 900, opacity: 0.85, marginBottom: 16 }}>
          {round} もん ちょうせんしたよ！
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
  const q = pool[qIdx % pool.length];

  // Render the display word with □ highlighted
  const renderWord = (display: string, filled?: string) => {
    return display.split("").map((ch, i) => {
      if (ch === "□") {
        return (
          <span key={i} style={{
            display: "inline-block",
            minWidth: "1.1em", textAlign: "center",
            borderBottom: "3px solid #ff3fa7",
            color: feedback ? (feedback.ok ? "#22c55e" : "#ef4444") : "#ff3fa7",
            fontWeight: 1000,
          }}>
            {feedback ? filled : "□"}
          </span>
        );
      }
      return <span key={i}>{ch}</span>;
    });
  };

  return (
    <KidShell title="ひらがなあて" onExit={onExit} rightExtra={<button style={kidSecondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={screenCol}>
        <div style={kidTopBar}>
          <span style={pillBlue}>のこり {seconds}びょう</span>
          <span style={pillPink}>せいかい {score}</span>
          <span style={pillPurple}>{round + 1}もんめ</span>
        </div>

        <div style={{ ...kidPanelFlex, justifyContent: "space-between" }}>
          {/* Emoji hint */}
          <div style={{ textAlign: "center", fontSize: "clamp(52px, 14vw, 72px)", lineHeight: 1 }}>
            {q?.hint}
          </div>

          {/* Word with blank */}
          <div style={{ textAlign: "center", fontSize: "clamp(28px, 8vw, 44px)", fontWeight: 1000, letterSpacing: "0.1em" }}>
            {q && renderWord(q.display, feedback?.picked)}
          </div>

          {/* Choices */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {q?.choices.map((c) => {
              let bg = "rgba(255,255,255,0.95)";
              let border = "3px solid rgba(0,0,0,0.08)";
              if (feedback?.picked === c) {
                bg = feedback.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
                border = `3px solid ${feedback.ok ? "#22c55e" : "#ef4444"}`;
              } else if (feedback && c === q.answer) {
                bg = "rgba(34,197,94,0.15)";
                border = "3px solid #22c55e";
              }
              return (
                <button key={c} onClick={() => pick(c)} disabled={!!feedback}
                  style={{
                    padding: "14px 8px", borderRadius: 18, border, background: bg,
                    fontWeight: 1000, fontSize: "clamp(22px, 6vw, 30px)",
                    cursor: feedback ? "default" : "pointer",
                    transition: "background 0.2s, border 0.2s",
                  }}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {feedback && (
        <div style={kidOverlay}>
          <div style={kidFeedbackCard(feedback.ok)}>
            <div style={{ fontSize: 64, lineHeight: 1, color: feedback.ok ? "#22c55e" : "#ef4444" }}>
              {feedback.ok ? "○" : "×"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 1000 }}>
              {feedback.ok ? "せいかい！" : "ざんねん！"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 1000, color: feedback.ok ? "#22c55e" : "#ef4444", marginTop: 2 }}>
              {feedback.ok ? "+10" : "-5"}
            </div>
            {!feedback.ok && (
              <div style={{ fontSize: 16, opacity: 0.85, marginTop: 6 }}>
                こたえ：「{q.answer}」
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
