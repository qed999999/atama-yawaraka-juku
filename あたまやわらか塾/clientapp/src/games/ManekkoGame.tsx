import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState } from "react";

type Props = { onExit: () => void; onScore?: (score: number, difficulty?: string) => void; difficultyBests?: Record<string, number>; unit?: string };
type Phase = "ready" | "show" | "input" | "result";
type Speed = "slow" | "normal" | "fast";

interface PadDef { id: number; color: string; lit: string; glow: string; }

const PADS: PadDef[] = [
  { id: 0, color: "#dc2626", lit: "#f87171", glow: "rgba(220,38,38,0.52)" },
  { id: 1, color: "#2563eb", lit: "#60a5fa", glow: "rgba(37,99,235,0.52)" },
  { id: 2, color: "#16a34a", lit: "#4ade80", glow: "rgba(22,163,74,0.52)" },
  { id: 3, color: "#d97706", lit: "#fcd34d", glow: "rgba(217,119,6,0.52)" },
];

const MAX_LEVEL    = 20;
const GAME_SECONDS = 60;

function showMsFor(s: Speed) { return s === "slow" ? 800 : s === "normal" ? 550 : 380; }
function gapMsFor (s: Speed) { return s === "slow" ? 320 : s === "normal" ? 210 : 140; }

const MK_CSS = `
@keyframes mk-wrong {
  0%,100% { transform: translateX(0) rotate(0deg); }
  18%     { transform: translateX(-12px) rotate(-5deg); }
  36%     { transform: translateX(12px)  rotate(5deg); }
  54%     { transform: translateX(-8px)  rotate(-2deg); }
  72%     { transform: translateX(8px)   rotate(2deg); }
}
@keyframes mk-pop {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.22); }
  65%  { transform: scale(0.91); }
  100% { transform: scale(1); }
}
@keyframes mk-result-in {
  0%   { transform: scale(0.5) rotate(-8deg); opacity: 0; }
  60%  { transform: scale(1.1) rotate(3deg);  opacity: 1; }
  100% { transform: scale(1)   rotate(0deg);  opacity: 1; }
}
@keyframes mk-label-fade {
  0%   { opacity: 0; transform: translateY(6px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0)   scale(1); }
}
.mk-wrong     { animation: mk-wrong  0.55s ease both; }
.mk-pop       { animation: mk-pop    0.4s  cubic-bezier(.4,0,.2,1) both; }
.mk-res-in    { animation: mk-result-in 0.48s cubic-bezier(.4,0,.2,1) both; }
.mk-label-in  { animation: mk-label-fade 0.22s ease both; }
`;

function diffLabel(s: Speed) {
  return s === "slow" ? "かんたん" : s === "normal" ? "ふつう" : "むずかしい";
}

export default function ManekkoGame({ onExit, onScore, difficultyBests, unit = "てん" }: Props) {
  const [phase,      setPhase]      = useState<Phase>("ready");
  const [sequence,   setSequence]   = useState<number[]>([]);
  const [litPad,     setLitPad]     = useState<number | null>(null);
  const [playerPos,  setPlayerPos]  = useState(0);
  const [score,      setScore]      = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [popPad,     setPopPad]     = useState<number | null>(null);
  const [speed,      setSpeed]      = useState<Speed>("normal");
  const [locked,     setLocked]     = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [frozenBest, setFrozenBest] = useState<number | undefined>(undefined);

  // Refs for stale-closure safety
  const phaseRef  = useRef<Phase>("ready");
  const speedRef  = useRef<Speed>("normal");
  const seqRef    = useRef<number[]>([]);
  const posRef    = useRef(0);
  const scoreRef  = useRef(0);
  const lockedRef = useRef(false);
  const tlRef     = useRef(GAME_SECONDS * 1000);

  phaseRef.current  = phase;
  speedRef.current  = speed;
  seqRef.current    = sequence;
  posRef.current    = playerPos;
  scoreRef.current  = score;
  lockedRef.current = locked;
  tlRef.current     = timeLeftMs;

  // Inject CSS once
  useEffect(() => {
    const id = "mk-css";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id; s.textContent = MK_CSS;
      document.head.appendChild(s);
    }
  }, []);

  // Countdown timer — runs during show + input phases
  useEffect(() => {
    if (phase !== "show" && phase !== "input") return;
    const startedAt  = performance.now();
    const startLeft  = tlRef.current;
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

  // Report score on result
  useEffect(() => {
    if (phase === "result") onScore?.(scoreRef.current, diffLabel(speedRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const playSequence = (seq: number[], spd: Speed) => {
    const showMs = showMsFor(spd);
    const gapMs  = gapMsFor(spd);
    setPhase("show");
    setLitPad(null);
    setLocked(true);
    lockedRef.current = true;
    setPlayerPos(0);
    posRef.current = 0;

    let t = 420;
    seq.forEach(padId => {
      setTimeout(() => {
        if (phaseRef.current === "result") return;
        setLitPad(padId);
      }, t);
      t += showMs;
      setTimeout(() => setLitPad(null), t);
      t += gapMs;
    });

    setTimeout(() => {
      if (phaseRef.current === "result") return;
      setPhase("input");
      setLocked(false);
      lockedRef.current = false;
    }, t + 100);
  };

  const startGame = (spd: Speed) => {
    setFrozenBest(difficultyBests?.[diffLabel(spd)]);
    setSpeed(spd);
    setScore(0);
    scoreRef.current = 0;
    setTimeLeftMs(GAME_SECONDS * 1000);
    tlRef.current = GAME_SECONDS * 1000;
    setWrongFlash(false);
    const first = Math.floor(Math.random() * 4);
    const seq = [first];
    setSequence(seq);
    playSequence(seq, spd);
  };

  const handlePadTap = (padId: number) => {
    if (phaseRef.current !== "input" || lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true);

    const curPos = posRef.current;
    const curSeq = seqRef.current;
    const expected = curSeq[curPos];

    if (padId !== expected) {
      // Wrong!
      setWrongFlash(true);
      setTimeout(() => {
        setWrongFlash(false);
        setPhase("result");
      }, 650);
      return;
    }

    // Correct tap — show this position filled immediately
    const nextPos = curPos + 1;
    setPlayerPos(nextPos);
    posRef.current = nextPos;

    setPopPad(padId);
    setTimeout(() => setPopPad(null), 380);

    if (nextPos >= curSeq.length) {
      // Completed this round — wait for last dot to be visible, then next level
      const newScore = scoreRef.current + 10;
      setScore(newScore);
      scoreRef.current = newScore;

      if (curSeq.length >= MAX_LEVEL) {
        setTimeout(() => setPhase("result"), 600);
        return;
      }

      // Extend sequence after a beat (so user sees all dots filled)
      setTimeout(() => {
        if (phaseRef.current === "result") return;
        const nextPad = Math.floor(Math.random() * 4);
        const newSeq = [...curSeq, nextPad];
        setSequence(newSeq);
        playSequence(newSeq, speedRef.current);
      }, 850);
    } else {
      lockedRef.current = false;
      setLocked(false);
    }
  };

  const goResult = () => setPhase("result");

  const seconds      = Math.ceil(timeLeftMs / 1000);
  const timerWarning = seconds <= 10 && (phase === "show" || phase === "input");
  const isShowPhase  = phase === "show";

  // ── Ready ──────────────────────────────────────────────────────────────────
  if (phase === "ready") {
    return (
      <KidShell title="まねっこゲーム" onExit={onExit}>
        <div style={{ ...kidPanel, textAlign: "left" }}>
          <div style={{ textAlign: "center", fontSize: 52, marginBottom: 6,
            filter: "drop-shadow(0 4px 8px rgba(124,58,237,0.25))" }}>🎵</div>
          <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 6, textAlign: "center", color: "#7c3aed" }}>
            ひかった じゅんに タップ！
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, opacity: 0.7, marginBottom: 18, textAlign: "center" }}>
            みてて、おぼえて、まねしてね！
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <SpeedBtn emoji="⭐" label="かんたん"   sub="ゆっくり"       color="#22c55e" best={difficultyBests?.["かんたん"]}   unit={unit} onClick={() => startGame("slow")} />
            <SpeedBtn emoji="🌟" label="ふつう"     sub="ふつうのはやさ"  color="#f59e0b" best={difficultyBests?.["ふつう"]}     unit={unit} onClick={() => startGame("normal")} />
            <SpeedBtn emoji="💫" label="むずかしい" sub="はやい！"        color="#ef4444" best={difficultyBests?.["むずかしい"]} unit={unit} onClick={() => startGame("fast")} />
          </div>
        </div>
      </KidShell>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  if (phase === "result") {
    const levelReached = Math.max(seqRef.current.length - 1, 0);
    const s = score;
    const resultEmoji = s >= 100 ? "🏆" : s >= 50 ? "🎊" : s >= 20 ? "😊" : "💪";
    const resultMsg   = s >= 100 ? "パーフェクト！"
                      : s >= 50  ? "よくできました！"
                      : s >= 20  ? "がんばったね！"
                      : "つぎは がんばろう！";
    const rc = s >= 50 ? "#ff3fa7" : "#7c3aed";
    return (
      <KidShell title="けっか" onExit={onExit}>
        <div style={kidPanel}>
          <div className="mk-res-in" style={{ fontSize: 64, marginBottom: 4, textAlign: "center",
            filter: "drop-shadow(0 4px 12px rgba(255,63,167,0.3))" }}>{resultEmoji}</div>
          <div className="mk-res-in" style={{ animationDelay: "0.08s",
            fontSize: 22, fontWeight: 1000, color: rc, marginBottom: 8, textAlign: "center" }}>{resultMsg}</div>
          <div className="mk-res-in" style={{ animationDelay: "0.16s",
            margin: "0 auto 10px", padding: "10px 20px", borderRadius: 18,
            background: `${rc}18`, border: `2.5px solid ${rc}44`,
            textAlign: "center", maxWidth: 280 }}>
            <div style={{ fontSize: "clamp(28px,7vw,38px)", fontWeight: 1000, color: rc, lineHeight: 1.1 }}>
              {s} {unit}
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.7, marginTop: 4 }}>
              レベル {levelReached} まで クリア！
            </div>
          </div>
          <div className="mk-res-in" style={{ animationDelay: "0.24s" }}>
            <RecordBanner score={s} prevBest={frozenBest} unit={unit} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 14 }}>
            <button style={{ ...kidPrimaryBtn, fontSize: 16, padding: "13px 22px" }}
              onClick={() => setPhase("ready")}>もういっかい</button>
            <button style={kidSecondaryBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
      </KidShell>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────
  return (
    <KidShell title="まねっこゲーム" onExit={onExit}
      rightExtra={<button style={kidSecondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={screenCol}>

        {/* Top bar: timer / level / score */}
        <div style={kidTopBar}>
          <span style={{ ...pillBlue, ...(timerWarning ? pillTimerWarn : {}) }}>
            {timerWarning ? "⏰ " : "⏱ "}{seconds}びょう
          </span>
          <span style={pillPurple}>🎵 レベル {sequence.length}</span>
          <span style={pillPink}>⭐ {score} てん</span>
        </div>

        {/* Phase label — directly above pads */}
        <div key={phase} className="mk-label-in" style={{
          textAlign: "center",
          padding: "10px 16px",
          borderRadius: 16,
          fontWeight: 1000,
          fontSize: "clamp(16px, 4vw, 20px)",
          background: isShowPhase
            ? "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.10))"
            : "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(22,163,74,0.12))",
          border: `2.5px solid ${isShowPhase ? "rgba(239,68,68,0.30)" : "rgba(34,197,94,0.35)"}`,
          color: isShowPhase ? "#dc2626" : "#16a34a",
          letterSpacing: "0.03em",
        }}>
          {isShowPhase ? "👀　みてて！" : `👆　タップして！（${playerPos + 1} / ${sequence.length}）`}
        </div>

        {/* Pad grid 2×2 */}
        <div style={{ ...kidPanelFlex, justifyContent: "center", alignItems: "center" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "clamp(12px, 3vw, 22px)",
            width: "100%", maxWidth: 320,
            padding: "8px 10px",
          }}>
            {PADS.map(pad => {
              const isLit   = litPad === pad.id;
              const isWrong = wrongFlash;
              const isPop   = popPad === pad.id;
              return (
                <button
                  key={pad.id}
                  className={isWrong ? "mk-wrong" : isPop ? "mk-pop" : ""}
                  onClick={() => handlePadTap(pad.id)}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 24,
                    border: "none",
                    background: isLit ? pad.lit : pad.color,
                    boxShadow: isLit
                      ? `0 0 0 8px ${pad.glow}, 0 14px 36px ${pad.glow}, inset 0 3px 7px rgba(255,255,255,0.45)`
                      : `0 7px 22px ${pad.glow}55, inset 0 2px 4px rgba(255,255,255,0.18)`,
                    transform: isLit ? "scale(1.1)" : "scale(1)",
                    transition: "transform 0.1s, box-shadow 0.12s, background 0.1s",
                    cursor: phase === "input" && !locked ? "pointer" : "default",
                    opacity: isShowPhase && litPad !== null && litPad !== pad.id ? 0.6 : 1,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 5, flexWrap: "wrap",
          padding: "2px 12px", minHeight: 22 }}>
          {sequence.slice(0, 15).map((padId, i) => (
            <div key={i} style={{
              width: 13, height: 13, borderRadius: "50%",
              background: i < playerPos ? PADS[padId].color : "rgba(0,0,0,0.11)",
              border: `2px solid ${i < playerPos ? PADS[padId].color : "rgba(0,0,0,0.14)"}`,
              transition: "background 0.15s, border-color 0.15s",
              flexShrink: 0,
            }} />
          ))}
          {sequence.length > 15 && (
            <span style={{ fontSize: 11, fontWeight: 900, opacity: 0.4, lineHeight: "13px" }}>…</span>
          )}
        </div>

      </div>
    </KidShell>
  );
}

// ── Speed button ───────────────────────────────────────────────────────────────
function SpeedBtn({ emoji, label, sub, color, best, unit = "てん", onClick }: {
  emoji: string; label: string; sub: string; color: string;
  best?: number; unit?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 16px", borderRadius: 18, border: `2.5px solid ${color}44`,
        background: `${color}12`, cursor: "pointer", width: "100%", textAlign: "left",
        transition: "transform 0.15s, box-shadow 0.15s",
        boxShadow: `0 4px 12px ${color}22`,
      }}
      onPointerDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
      onPointerUp={e => (e.currentTarget.style.transform = "scale(1)")}
      onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    >
      <span style={{ fontSize: 28, filter: `drop-shadow(0 2px 4px ${color}44)` }}>{emoji}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 17, fontWeight: 1000, color }}>{label}</span>
        <span style={{ display: "block", fontSize: 12, fontWeight: 900, opacity: 0.6 }}>{sub}</span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 900, color, opacity: 0.8, whiteSpace: "nowrap" }}>
        {best != null ? `🏆 ${best}${unit}` : `--- ${unit}`}
      </span>
    </button>
  );
}

// ── KidShell ───────────────────────────────────────────────────────────────────
function KidShell({ title, onExit, children, rightExtra }: {
  title: string; onExit: () => void; children: React.ReactNode; rightExtra?: React.ReactNode;
}) {
  return (
    <div style={stageFixed}>
      <div style={sparkles} aria-hidden />
      <div style={card}>
        <div style={headerRow}>
          <div style={titleStyle}>{title}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", flexShrink: 0 }}>
            {rightExtra}
            <button style={kidHeaderBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
        <div style={content}>{children}</div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const stageFixed: React.CSSProperties = {
  position: "fixed", inset: 0, overflow: "hidden",
  padding: "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
  boxSizing: "border-box",
  background:
    "radial-gradient(circle at 15% 20%, rgba(255,230,109,0.35), transparent 40%)," +
    "radial-gradient(circle at 85% 25%, rgba(255,140,189,0.28), transparent 42%)," +
    "radial-gradient(circle at 20% 85%, rgba(120,214,255,0.25), transparent 45%)," +
    "linear-gradient(180deg, #fff7fe 0%, #f1fbff 55%, #fffdf2 100%)",
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
  boxShadow: "0 18px 44px rgba(255,120,180,0.18)",
  display: "flex", flexDirection: "column", overflow: "hidden",
};
const headerRow: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap", minWidth: 0,
};
const titleStyle: React.CSSProperties = {
  fontWeight: 1000, fontSize: 22, color: "#ff3fa7",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
};
const kidHeaderBtn: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 16, border: "2px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
};
const content: React.CSSProperties = {
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
const pillBlue:      React.CSSProperties = { ...pillBase, background: "rgba(26,168,255,0.10)",   border: "2px solid rgba(26,168,255,0.18)" };
const pillTimerWarn: React.CSSProperties = { background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.35)", color: "#dc2626" };
const pillPink:      React.CSSProperties = { ...pillBase, background: "rgba(255,63,167,0.10)",   border: "2px solid rgba(255,63,167,0.18)" };
const pillPurple:    React.CSSProperties = { ...pillBase, background: "rgba(124,58,237,0.10)",   border: "2px solid rgba(124,58,237,0.18)" };
const kidPanel: React.CSSProperties = {
  padding: 12, borderRadius: 18, border: "3px solid rgba(80,200,255,0.25)",
  background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0,160,255,0.10)", boxSizing: "border-box",
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
