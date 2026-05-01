import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };
type Phase = "ready" | "playing" | "result";

const GAME_SECONDS = 60;
const FEEDBACK_MS = 1000;

type ClockTime = { hour: number; minute: number };

function timeLabel(t: ClockTime): string {
  if (t.minute === 0) return `${t.hour}じ`;
  return `${t.hour}じはん`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeQuestion(prev = "") {
  let correct: ClockTime, choices: ClockTime[], correctIdx: number;
  let tries = 0;
  do {
    const hour = Math.floor(Math.random() * 12) + 1;
    const minute = Math.random() < 0.5 ? 0 : 30;
    correct = { hour, minute };
    const wrong: ClockTime[] = [];
    while (wrong.length < 3) {
      const wh = Math.floor(Math.random() * 12) + 1;
      const wm = Math.random() < 0.5 ? 0 : 30;
      if (wh === hour && wm === minute) continue;
      if (wrong.some(w => w.hour === wh && w.minute === wm)) continue;
      wrong.push({ hour: wh, minute: wm });
    }
    const shuffled = shuffle([correct, ...wrong]);
    correctIdx = shuffled.findIndex(c => c.hour === correct.hour && c.minute === correct.minute);
    choices = shuffled;
    tries++;
  } while (timeLabel(correct) === prev && tries < 20);
  return { correct: correct!, choices: choices!, correctIdx: correctIdx! };
}

function ClockFace({ time }: { time: ClockTime }) {
  const cx = 50, cy = 50;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const hourAngle = ((time.hour % 12) + time.minute / 60) / 12 * 360 - 90;
  const minAngle = (time.minute / 60) * 360 - 90;
  const hx = cx + 24 * Math.cos(toRad(hourAngle));
  const hy = cy + 24 * Math.sin(toRad(hourAngle));
  const mx = cx + 34 * Math.cos(toRad(minAngle));
  const my = cy + 34 * Math.sin(toRad(minAngle));

  return (
    <svg viewBox="0 0 100 100" style={{ width: "clamp(120px, 35vw, 160px)", height: "clamp(120px, 35vw, 160px)" }}>
      <circle cx={cx} cy={cy} r={46} fill="white" stroke="#ff3fa7" strokeWidth="3.5" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * 360 - 90;
        const x1 = cx + 39 * Math.cos(toRad(a));
        const y1 = cy + 39 * Math.sin(toRad(a));
        const x2 = cx + 44 * Math.cos(toRad(a));
        const y2 = cy + 44 * Math.sin(toRad(a));
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#555" strokeWidth={i % 3 === 0 ? 2.5 : 1.2} />;
      })}
      {[{ n: 12, a: -90 }, { n: 3, a: 0 }, { n: 6, a: 90 }, { n: 9, a: 180 }].map(({ n, a }) => (
        <text key={n} x={cx + 30 * Math.cos(toRad(a))} y={cy + 30 * Math.sin(toRad(a))}
          textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="bold" fill="#333">{n}</text>
      ))}
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="#1b1b1b" strokeWidth="4.5" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={mx} y2={my} stroke="#ff3fa7" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3.5" fill="#1b1b1b" />
    </svg>
  );
}

export default function ClockGame({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [initialBest] = useState(() => prevBest);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [question, setQuestion] = useState(makeQuestion);
  const [feedback, setFeedback] = useState<{ ok: boolean; picked: number } | null>(null);

  const timerRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;
  const prevAnswerRef = useRef("");

  useEffect(() => {
    if (phase === "result") onScore?.(score);
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

  const start = useCallback(() => {
    setScore(0);
    setRound(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    setFeedback(null);
    const q = makeQuestion(prevAnswerRef.current);
    prevAnswerRef.current = timeLabel(q.correct);
    setQuestion(q);
    setPhase("playing");
  }, []);

  function pick(idx: number) {
    if (phase !== "playing" || feedback) return;
    const ok = idx === question.correctIdx;
    setFeedback({ ok, picked: idx });
    if (ok) setScore(s => s + 10);
    else setScore(s => Math.max(0, s - 5));
    timerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "result") return;
      setFeedback(null);
      setRound(r => r + 1);
      const q = makeQuestion(prevAnswerRef.current);
      prevAnswerRef.current = timeLabel(q.correct);
      setQuestion(q);
    }, FEEDBACK_MS);
  }

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  if (phase === "ready") return (
    <KidShell title="なんじかな？" onExit={onExit}>
      <div style={{ ...kidPanel, textAlign: "left" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🕐</div>
        <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 8 }}>
          とけいをよんで じかんをあてよう！
        </div>
        <div style={{ fontSize: 15, fontWeight: 900, opacity: 0.8, marginBottom: 16, lineHeight: 1.7 }}>
          みじかいはり＝じかん<br />
          ながいはり＝ふん
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

  const goResult = () => setPhase("result");
  const seconds = Math.ceil(timeLeftMs / 1000);

  return (
    <KidShell title="なんじかな？" onExit={onExit}
      rightExtra={<button style={kidSecondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={screenCol}>
        <div style={kidTopBar}>
          <span style={pillBlue}>のこり {seconds}びょう</span>
          <span style={pillPink}>せいかい {score}</span>
          <span style={pillPurple}>{round + 1}もんめ</span>
        </div>
        <div style={{ ...kidPanelFlex, alignItems: "center" }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>なんじ？</div>
          <ClockFace time={question.correct} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", boxSizing: "border-box" }}>
            {question.choices.map((c, i) => {
              let bg = "rgba(255,255,255,0.95)";
              let border = "3px solid rgba(0,0,0,0.08)";
              if (feedback?.picked === i) {
                bg = feedback.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
                border = `3px solid ${feedback.ok ? "#22c55e" : "#ef4444"}`;
              } else if (feedback && i === question.correctIdx) {
                bg = "rgba(34,197,94,0.15)";
                border = "3px solid #22c55e";
              }
              return (
                <button key={i} onClick={() => pick(i)} disabled={!!feedback}
                  style={{
                    padding: "14px 8px", borderRadius: 18, border, background: bg,
                    fontWeight: 1000, fontSize: "clamp(15px, 4vw, 18px)",
                    cursor: feedback ? "default" : "pointer",
                    transition: "background 0.2s, border 0.2s", boxSizing: "border-box",
                  }}>
                  {timeLabel(c)}
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
                こたえ：{timeLabel(question.choices[question.correctIdx])}
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
  background: "linear-gradient(180deg, rgba(255, 120, 200, 0.95), rgba(255, 63, 167, 0.92))",
  color: "#fff", fontWeight: 1000, fontSize: 18, cursor: "pointer",
  boxShadow: "0 8px 20px rgba(255, 63, 167, 0.18)",
};
const kidSecondaryBtn: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 18, border: "3px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)", fontWeight: 1000, cursor: "pointer", fontSize: 16,
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
