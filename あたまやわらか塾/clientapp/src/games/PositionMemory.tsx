import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };
type Phase = "ready" | "show" | "input" | "feedback" | "result";

const GAME_SECONDS = 60;
const SHOW_MS = 2000; // how long to show the lit cells
const FEEDBACK_MS = 800;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeProblem(round: number, prev = "") {
  let target: Set<number>;
  let tries = 0;
  do {
    const count = Math.min(2 + Math.floor(round / 2), 6); // 2→3→4→5→6
    const all = Array.from({ length: 9 }, (_, i) => i);
    const selected = shuffle(all).slice(0, count);
    target = new Set(selected);
    tries++;
  } while ([...target].sort((a, b) => a - b).join(",") === prev && tries < 20);
  return target;
}

export default function PositionMemory({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [initialBest] = useState(() => prevBest);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastOk, setLastOk] = useState(false);

  const timerRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;
  const prevAnswerRef = useRef("");

  useEffect(() => {
    if (phase === "result") onScore?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === "ready" || phase === "result") return;
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

  const startRound = useCallback((r: number) => {
    const t = makeProblem(r, prevAnswerRef.current);
    prevAnswerRef.current = [...t].sort((a, b) => a - b).join(",");
    setTarget(t);
    setSelected(new Set());
    setPhase("show");
    timerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "result") return;
      setPhase("input");
    }, SHOW_MS);
  }, []);

  const start = useCallback(() => {
    setScore(0);
    setRound(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    startRound(0);
  }, [startRound]);

  function tap(idx: number) {
    if (phase !== "input") return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function submit() {
    if (phase !== "input") return;
    // compare selected vs target
    const ok = target.size === selected.size && [...target].every(i => selected.has(i));
    setLastOk(ok);
    if (ok) setScore(s => s + 10);
    else setScore(s => Math.max(0, s - 5));
    setPhase("feedback");
    timerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "result") return;
      const next = round + 1;
      setRound(next);
      startRound(next);
    }, FEEDBACK_MS + (ok ? 0 : 600));
  }

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  if (phase === "ready") return (
    <KidShell title="どこかな？" onExit={onExit}>
      <div style={{ ...kidPanel, textAlign: "left" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌟</div>
        <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 8 }}>ひかったマスを おぼえよう！</div>
        <div style={{ fontSize: 15, fontWeight: 900, opacity: 0.8, marginBottom: 16, lineHeight: 1.7 }}>
          ⭐がひかったマスを みてね<br />
          きえたら、どこにあったか タップ！
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
  const count = target.size;

  return (
    <KidShell title="どこかな？" onExit={onExit} rightExtra={<button style={kidSecondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={screenCol}>
        <div style={kidTopBar}>
          <span style={pillBlue}>のこり {seconds}びょう</span>
          <span style={pillPink}>せいかい {score}</span>
          <span style={pillPurple}>{round + 1}もんめ</span>
        </div>

        <div style={{ ...kidPanelFlex, alignItems: "center", justifyContent: "space-between" }}>
          {/* instruction */}
          <div style={{ textAlign: "center", fontWeight: 1000, fontSize: "clamp(15px, 4vw, 18px)" }}>
            {phase === "show" && `⭐ ${count}つ おぼえてね！`}
            {phase === "input" && `タップして えらぼう（${count}つ）`}
            {phase === "feedback" && "　"}
          </div>

          {/* 3x3 Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: "min(300px, 85vw)" }}>
            {Array.from({ length: 9 }, (_, i) => {
              const isTarget = target.has(i);
              const isSelected = selected.has(i);
              const isFeedback = phase === "feedback";

              let bg = "rgba(255,255,255,0.90)";
              let border = "3px solid rgba(0,0,0,0.08)";
              let content: React.ReactNode = null;

              if (phase === "show" && isTarget) {
                bg = "rgba(255,220,50,0.25)";
                border = "3px solid rgba(255,200,0,0.6)";
                content = <span style={{ fontSize: "clamp(24px,8vw,36px)" }}>⭐</span>;
              } else if (isFeedback) {
                if (isTarget && isSelected) {
                  bg = "rgba(34,197,94,0.18)"; border = "3px solid #22c55e";
                  content = <span style={{ fontSize: "clamp(22px,7vw,32px)" }}>✅</span>;
                } else if (isTarget && !isSelected) {
                  bg = "rgba(255,200,0,0.18)"; border = "3px solid #f59e0b";
                  content = <span style={{ fontSize: "clamp(22px,7vw,32px)" }}>⭐</span>;
                } else if (!isTarget && isSelected) {
                  bg = "rgba(239,68,68,0.12)"; border = "3px solid #ef4444";
                  content = <span style={{ fontSize: "clamp(22px,7vw,32px)" }}>❌</span>;
                }
              } else if (phase === "input" && isSelected) {
                bg = "rgba(26,168,255,0.15)"; border = "3px solid #1aa8ff";
                content = <span style={{ fontSize: "clamp(22px,7vw,32px)" }}>👆</span>;
              }

              return (
                <button key={i} onClick={() => tap(i)} disabled={phase !== "input"}
                  style={{ aspectRatio: "1", borderRadius: 18, border, background: bg,
                    display: "grid", placeItems: "center", cursor: phase === "input" ? "pointer" : "default",
                    transition: "all 0.15s", boxSizing: "border-box" }}>
                  {content}
                </button>
              );
            })}
          </div>

          {/* submit */}
          <button onClick={submit} style={{ ...kidPrimaryBtn, visibility: phase === "input" ? "visible" : "hidden" }}>
            これで かいとう！（{selected.size}/{count}）
          </button>
        </div>
      </div>
      {phase === "feedback" && (
        <div style={kidOverlay}>
          <div style={kidFeedbackCard(lastOk)}>
            <div style={{ fontSize: 48 }}>{lastOk ? "🎉" : "💦"}</div>
            <div style={{ fontSize: 22, fontWeight: 1000 }}>
              {lastOk ? "せいかい！" : "ざんねん！"}
            </div>
          </div>
        </div>
      )}
    </KidShell>
  );
}

function KidShell({ title, onExit, children, rightExtra }: { title: string; onExit: () => void; children: React.ReactNode; rightExtra?: React.ReactNode }) {
  return (
    <div style={stage}><div style={sparkles} aria-hidden />
      <div style={card}>
        <div style={headerRow}>
          <div style={titleStyle}>{title}</div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "nowrap" }}>
            {rightExtra}
            <button style={headerBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
        <div style={contentCol}>{children}</div>
      </div>
    </div>
  );
}
const stage: React.CSSProperties = { position: "fixed", inset: 0, overflow: "hidden", padding: "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))", boxSizing: "border-box", background: "radial-gradient(circle at 15% 20%, rgba(255,230,109,0.35), transparent 40%), radial-gradient(circle at 85% 25%, rgba(255,140,189,0.28), transparent 42%), radial-gradient(circle at 20% 85%, rgba(120,214,255,0.25), transparent 45%), linear-gradient(180deg, #fff7fe 0%, #f1fbff 55%, #fffdf2 100%)", fontFamily: "ui-rounded, system-ui, -apple-system, 'Hiragino Maru Gothic ProN', 'M PLUS Rounded 1c', 'Noto Sans JP', sans-serif", color: "#1b1b1b", display: "grid", placeItems: "center" };
const sparkles: React.CSSProperties = { position: "absolute", inset: -40, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.95) 0 2px, transparent 3px), radial-gradient(circle, rgba(255,255,255,0.85) 0 1.5px, transparent 3px)", backgroundSize: "110px 110px, 160px 160px", backgroundPosition: "0 0, 40px 60px", opacity: 0.25 };
const card: React.CSSProperties = { width: "min(980px, 100%)", height: "100%", maxHeight: "100%", borderRadius: 22, padding: 10, boxSizing: "border-box", background: "rgba(255,255,255,0.86)", border: "3px solid rgba(255,170,220,0.55)", boxShadow: "0 18px 44px rgba(255,120,180,0.18)", display: "flex", flexDirection: "column", overflow: "hidden" };
const headerRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap", minWidth: 0 };
const titleStyle: React.CSSProperties = { fontWeight: 1000, fontSize: 22, color: "#ff3fa7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };
const headerBtn: React.CSSProperties = { padding: "10px 12px", borderRadius: 16, border: "2px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 };
const contentCol: React.CSSProperties = { marginTop: 8, minHeight: 0, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" };
const screenCol: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8, minHeight: 0, flex: 1 };
const kidTopBar: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap", padding: "8px 10px", borderRadius: 18, background: "rgba(255,255,255,0.75)", border: "2px solid rgba(0,0,0,0.06)", boxShadow: "0 10px 18px rgba(0,0,0,0.08)", overflow: "hidden" };
const pillBase: React.CSSProperties = { fontWeight: 1000, borderRadius: 999, padding: "6px 10px", border: "2px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" };
const pillBlue: React.CSSProperties = { ...pillBase, background: "rgba(26,168,255,0.10)", border: "2px solid rgba(26,168,255,0.18)" };
const pillPink: React.CSSProperties = { ...pillBase, background: "rgba(255,63,167,0.10)", border: "2px solid rgba(255,63,167,0.18)" };
const pillPurple: React.CSSProperties = { ...pillBase, background: "rgba(124,58,237,0.10)", border: "2px solid rgba(124,58,237,0.18)" };
const kidPanel: React.CSSProperties = { padding: 16, borderRadius: 18, border: "3px solid rgba(80,200,255,0.25)", background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0,160,255,0.10)", boxSizing: "border-box", textAlign: "center" };
const kidPanelFlex: React.CSSProperties = { padding: 12, borderRadius: 18, border: "3px solid rgba(80,200,255,0.25)", background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0,160,255,0.10)", boxSizing: "border-box", minHeight: 0, flex: 1, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" };
const kidPrimaryBtn: React.CSSProperties = { padding: "12px 24px", borderRadius: 18, border: "none", background: "linear-gradient(180deg, #ff73c6 0%, #ff3fa7 100%)", color: "#fff", fontWeight: 1000, fontSize: 16, cursor: "pointer", whiteSpace: "nowrap" };
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
