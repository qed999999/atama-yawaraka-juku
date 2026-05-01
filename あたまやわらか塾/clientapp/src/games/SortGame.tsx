import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };
type Phase = "ready" | "playing" | "result";

const GAME_SECONDS = 60;
const SUCCESS_MS = 800;
const SCORE_CORRECT = 10;
const SCORE_WRONG = -5;
const FEEDBACK_MS = 800;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeNumbers(round: number, prev = ""): number[] {
  let result: number[];
  let tries = 0;
  do {
    const count = round < 3 ? 4 : round < 6 ? 5 : 6;
    const max = round < 3 ? 20 : round < 6 ? 50 : 99;
    const nums = new Set<number>();
    while (nums.size < count) nums.add(Math.floor(Math.random() * max) + 1);
    result = shuffle([...nums]);
    tries++;
  } while ([...result].sort((a, b) => a - b).join(",") === prev && tries < 20);
  return result!;
}

export default function SortGame({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [initialBest] = useState(() => prevBest);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]); // indices in tap order
  const [flashOk, setFlashOk] = useState(false);
  const [flashNg, setFlashNg] = useState<number | null>(null);

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

  useEffect(() => {
    if (phase === "result") onScore?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startRound = useCallback((r: number) => {
    const nums = makeNumbers(r, prevAnswerRef.current);
    prevAnswerRef.current = [...nums].sort((a, b) => a - b).join(",");
    setNumbers(nums);
    setSelected([]);
    setFlashOk(false);
    setFlashNg(null);
  }, []);

  const start = useCallback(() => {
    setScore(0);
    setRound(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    startRound(0);
    setPhase("playing");
  }, [startRound]);

  const goResult = () => setPhase("result");

  function tap(idx: number) {
    if (phase !== "playing") return;
    if (selected.includes(idx)) return;
    if (flashOk || flashNg !== null) return;

    const sorted = [...numbers].sort((a, b) => a - b);
    const tapOrder = [...selected, idx];
    const expectedIdx = tapOrder.length - 1;

    if (numbers[idx] === sorted[expectedIdx]) {
      const next = [...selected, idx];
      setSelected(next);

      if (next.length === numbers.length) {
        // All correct!
        setFlashOk(true);
        setScore(s => s + SCORE_CORRECT);
        timerRef.current = window.setTimeout(() => {
          if (phaseRef.current === "result") return;
          const nextRound = round + 1;
          setRound(nextRound);
          startRound(nextRound);
          setFlashOk(false);
        }, SUCCESS_MS);
      }
    } else {
      // Wrong tap
      setFlashNg(idx);
      setScore(s => Math.max(0, s + SCORE_WRONG));
      timerRef.current = window.setTimeout(() => {
        setFlashNg(null);
        setSelected([]);
      }, 500);
    }
  }

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  if (phase === "ready") return (
    <KidShell title="ならびかえ" onExit={onExit}>
      <div style={{ ...kidPanel, textAlign: "left" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🔢</div>
        <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 8 }}>
          かずを ちいさい じゅんに おそう！
        </div>
        <div style={{ fontSize: 15, fontWeight: 900, opacity: 0.8, marginBottom: 16, lineHeight: 1.7 }}>
          1→2→3 のじゅんに タップしてね<br />
          ぜんぶ せいれつできたら +{SCORE_CORRECT}てん！<br />
          まちがい {SCORE_WRONG}てん
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
          60びょう で {round} もん クリアしたよ！
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

  return (
    <KidShell title="ならびかえ" onExit={onExit}
      rightExtra={<button style={kidSecondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={screenCol}>
        <div style={kidTopBar}>
          <span style={pillBlue}>のこり {seconds}びょう</span>
          <span style={pillPink}>{score}てん</span>
          <span style={pillPurple}>{round + 1}もんめ</span>
        </div>

        <div style={{ ...kidPanelFlex, justifyContent: "space-between" }}>
          <div style={{ fontWeight: 1000, fontSize: 16, textAlign: "center", opacity: 0.8 }}>
            ちいさい じゅんに タップ！
          </div>

          {/* Progress: how many selected */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.7, marginBottom: 4 }}>
              {flashOk ? "🎉" : `${selected.length} / ${numbers.length}`}
            </div>
          </div>

          {/* Number buttons */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", alignItems: "center",
          }}>
            {numbers.map((n, idx) => {
              const tapPos = selected.indexOf(idx);
              const isDone = tapPos >= 0;
              const isWrong = flashNg === idx;

              let bg = "rgba(255,255,255,0.95)";
              let border = "3px solid rgba(0,0,0,0.10)";
              let color = "#1b1b1b";

              if (flashOk && isDone) {
                bg = "rgba(34,197,94,0.15)";
                border = "3px solid #22c55e";
                color = "#22c55e";
              } else if (isDone) {
                bg = "rgba(34,197,94,0.10)";
                border = "3px solid rgba(34,197,94,0.4)";
                color = "#16a34a";
              } else if (isWrong) {
                bg = "rgba(239,68,68,0.12)";
                border = "3px solid #ef4444";
                color = "#ef4444";
              }

              return (
                <button key={idx} onClick={() => tap(idx)}
                  disabled={isDone || flashOk || flashNg !== null}
                  style={{
                    width: "clamp(60px, 18vw, 90px)",
                    height: "clamp(60px, 18vw, 90px)",
                    borderRadius: 20, border, background: bg, color,
                    fontWeight: 1000, fontSize: "clamp(20px, 5.5vw, 30px)",
                    cursor: isDone ? "default" : "pointer",
                    transition: "all 0.18s", boxSizing: "border-box",
                    position: "relative",
                  }}>
                  {isDone && (
                    <span style={{
                      position: "absolute", top: 2, right: 6,
                      fontSize: "clamp(10px, 2.5vw, 14px)", fontWeight: 1000, opacity: 0.7,
                    }}>
                      {tapPos + 1}
                    </span>
                  )}
                  {n}
                </button>
              );
            })}
          </div>

        </div>
      </div>
      {flashOk && (
        <div style={kidOverlay}>
          <div style={kidFeedbackCard(true)}>
            <div style={{ fontSize: 72, fontWeight: 1000, lineHeight: 1, marginBottom: 6, color: "#22c55e", textShadow: "0 6px 18px rgba(255, 63, 167, 0.25)" }}>○</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>せいかい！</div>
            <div style={{ fontSize: 16, opacity: 0.88 }}>+{SCORE_CORRECT}てん</div>
          </div>
        </div>
      )}
      {flashNg !== null && (
        <div style={kidOverlay}>
          <div style={kidFeedbackCard(false)}>
            <div style={{ fontSize: 72, fontWeight: 1000, lineHeight: 1, marginBottom: 6, color: "#ef4444", textShadow: "0 6px 18px rgba(255, 63, 167, 0.25)" }}>×</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>ざんねん！</div>
            <div style={{ fontSize: 16, opacity: 0.88 }}>ちいさい じゅんに タップしてね</div>
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
