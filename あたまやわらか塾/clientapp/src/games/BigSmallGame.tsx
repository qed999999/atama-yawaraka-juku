import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };
type Phase = "ready" | "playing" | "result";
type Mode = "big" | "small";
type Side = "left" | "right";

const GAME_SECONDS = 60;
const FEEDBACK_MS = 1000;

type Item = { emoji: string; name: string; rank: number };

// 同じカテゴリ内で大小をくらべる（4さい児にも直感的にわかるように）
const ANIMALS: Item[] = [
  { emoji: "🐜", name: "あり", rank: 1 },
  { emoji: "🐝", name: "はち", rank: 2 },
  { emoji: "🐞", name: "てんとうむし", rank: 2 },
  { emoji: "🦋", name: "ちょうちょ", rank: 2 },
  { emoji: "🐭", name: "ねずみ", rank: 3 },
  { emoji: "🐸", name: "かえる", rank: 4 },
  { emoji: "🐤", name: "ひよこ", rank: 4 },
  { emoji: "🐰", name: "うさぎ", rank: 5 },
  { emoji: "🐱", name: "ねこ", rank: 5 },
  { emoji: "🐶", name: "いぬ", rank: 6 },
  { emoji: "🐧", name: "ペンギン", rank: 5 },
  { emoji: "🐷", name: "ぶた", rank: 7 },
  { emoji: "🦌", name: "しか", rank: 8 },
  { emoji: "🐴", name: "うま", rank: 8 },
  { emoji: "🦁", name: "ライオン", rank: 8 },
  { emoji: "🐮", name: "うし", rank: 9 },
  { emoji: "🐻", name: "くま", rank: 9 },
  { emoji: "🦒", name: "きりん", rank: 11 },
  { emoji: "🐘", name: "ぞう", rank: 11 },
  { emoji: "🐳", name: "くじら", rank: 12 },
  { emoji: "🦖", name: "きょうりゅう", rank: 12 },
];

const VEHICLES: Item[] = [
  { emoji: "🛴", name: "キックボード", rank: 2 },
  { emoji: "🚲", name: "じてんしゃ", rank: 3 },
  { emoji: "🏍️", name: "バイク", rank: 4 },
  { emoji: "🚗", name: "じどうしゃ", rank: 5 },
  { emoji: "🚙", name: "ジープ", rank: 6 },
  { emoji: "🚌", name: "バス", rank: 8 },
  { emoji: "🚚", name: "トラック", rank: 8 },
  { emoji: "🚂", name: "きかんしゃ", rank: 10 },
  { emoji: "🚄", name: "しんかんせん", rank: 10 },
  { emoji: "✈️", name: "ひこうき", rank: 11 },
  { emoji: "🚢", name: "ふね", rank: 12 },
];

const FOODS: Item[] = [
  { emoji: "🫐", name: "ブルーベリー", rank: 1 },
  { emoji: "🍒", name: "さくらんぼ", rank: 2 },
  { emoji: "🍓", name: "いちご", rank: 2 },
  { emoji: "🍇", name: "ぶどう", rank: 3 },
  { emoji: "🥝", name: "キウイ", rank: 3 },
  { emoji: "🍋", name: "レモン", rank: 4 },
  { emoji: "🍊", name: "みかん", rank: 4 },
  { emoji: "🍎", name: "りんご", rank: 5 },
  { emoji: "🍑", name: "もも", rank: 5 },
  { emoji: "🥭", name: "マンゴー", rank: 5 },
  { emoji: "🍌", name: "バナナ", rank: 6 },
  { emoji: "🍐", name: "なし", rank: 6 },
  { emoji: "🍍", name: "パイナップル", rank: 8 },
  { emoji: "🍈", name: "メロン", rank: 9 },
  { emoji: "🎃", name: "かぼちゃ", rank: 10 },
  { emoji: "🍉", name: "すいか", rank: 11 },
];

const CATEGORIES = [ANIMALS, VEHICLES, FOODS];

function pickPair(prevKey: string): { left: Item; right: Item; bigger: Side; key: string } {
  for (let tries = 0; tries < 30; tries++) {
    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const i = Math.floor(Math.random() * cat.length);
    let j = Math.floor(Math.random() * cat.length);
    if (i === j) j = (j + 1) % cat.length;
    const a = cat[i];
    const b = cat[j];
    if (Math.abs(a.rank - b.rank) < 2) continue; // 差が大きいペアにする
    // 左右をランダム化
    const leftIsA = Math.random() < 0.5;
    const left = leftIsA ? a : b;
    const right = leftIsA ? b : a;
    const bigger: Side = left.rank > right.rank ? "left" : "right";
    const key = `${left.emoji}-${right.emoji}`;
    if (key === prevKey) continue;
    return { left, right, bigger, key };
  }
  // 最終フォールバック
  return { left: ANIMALS[0], right: ANIMALS[ANIMALS.length - 1], bigger: "right", key: "fallback" };
}

export default function BigSmallGame({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [initialBest] = useState(() => prevBest);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [mode, setMode] = useState<Mode>("big");
  const [pair, setPair] = useState(() => pickPair(""));
  const [feedback, setFeedback] = useState<{ ok: boolean; picked: Side } | null>(null);
  const timerRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;
  const prevKeyRef = useRef("");

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

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  const start = useCallback(() => {
    setScore(0); setRound(0); setTimeLeftMs(GAME_SECONDS * 1000);
    setFeedback(null);
    const m: Mode = Math.random() < 0.5 ? "big" : "small";
    setMode(m);
    const p = pickPair(prevKeyRef.current);
    prevKeyRef.current = p.key;
    setPair(p);
    setPhase("playing");
  }, []);

  const goResult = () => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    setFeedback(null);
    setPhase("result");
  };

  function pick(side: Side) {
    if (phase !== "playing" || feedback) return;
    const ok = mode === "big" ? side === pair.bigger : side !== pair.bigger;
    setFeedback({ ok, picked: side });
    if (ok) setScore(s => s + 10);
    else setScore(s => Math.max(0, s - 5));
    timerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "result") return;
      setFeedback(null);
      setRound(r => r + 1);
      const nextMode: Mode = Math.random() < 0.5 ? "big" : "small";
      setMode(nextMode);
      const p = pickPair(prevKeyRef.current);
      prevKeyRef.current = p.key;
      setPair(p);
    }, FEEDBACK_MS);
  }

  if (phase === "ready") return (
    <KidShell title="どっちがおおきい？" onExit={onExit}>
      <div style={{ ...kidPanel, textAlign: "left" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🐘</div>
        <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 8 }}>おおきい・ちいさいを えらぼう！</div>
        <div style={{ fontSize: 15, fontWeight: 900, opacity: 0.8, marginBottom: 16, lineHeight: 1.7 }}>
          ふたつの えを みて、<br />
          おおきいほう（または ちいさいほう）を タップしてね！
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
        <div style={{ fontSize: 16, fontWeight: 900, opacity: 0.85, marginBottom: 16 }}>{round} もん ちょうせんしたよ！</div>
        <RecordBanner score={score} prevBest={initialBest} unit={unit} />
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={kidPrimaryBtn} onClick={start}>もういっかい</button>
          <button style={kidSecondaryBtn} onClick={onExit}>メニューへ</button>
        </div>
      </div>
    </KidShell>
  );

  const seconds = Math.ceil(timeLeftMs / 1000);
  const correctSide: Side = mode === "big" ? pair.bigger : (pair.bigger === "left" ? "right" : "left");
  const askColor = mode === "big" ? "#ef4444" : "#1aa8ff";

  const cellStyle = (side: Side): React.CSSProperties => {
    let bg = "rgba(255,255,255,0.95)";
    let border = "3px solid rgba(0,0,0,0.08)";
    if (feedback) {
      if (feedback.picked === side) {
        bg = feedback.ok ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)";
        border = `3px solid ${feedback.ok ? "#22c55e" : "#ef4444"}`;
      } else if (side === correctSide) {
        bg = "rgba(34,197,94,0.18)";
        border = "3px solid #22c55e";
      }
    }
    return {
      flex: 1,
      minWidth: 0,
      padding: "16px 8px",
      borderRadius: 22,
      border,
      background: bg,
      cursor: feedback ? "default" : "pointer",
      transition: "background 0.2s, border 0.2s",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    };
  };

  return (
    <KidShell title="どっちがおおきい？" onExit={onExit} rightExtra={<button style={kidSecondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={screenCol}>
        <div style={kidTopBar}>
          <span style={pillBlue}>のこり {seconds}びょう</span>
          <span style={pillPink}>せいかい {score}</span>
          <span style={pillPurple}>{round + 1}もんめ</span>
        </div>

        <div style={{ ...kidPanelFlex, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 1000, fontSize: "clamp(18px, 5vw, 24px)", color: askColor, textAlign: "center" }}>
            {mode === "big" ? "おおきいのは どっち？" : "ちいさいのは どっち？"}
          </div>

          <div style={{ display: "flex", gap: 12, width: "100%", flex: 1, alignItems: "stretch" }}>
            <button onClick={() => pick("left")} disabled={!!feedback} style={cellStyle("left")}>
              <div style={{ fontSize: "clamp(64px, 18vw, 110px)", lineHeight: 1 }}>{pair.left.emoji}</div>
              <div style={{ fontSize: "clamp(13px, 3.5vw, 16px)", fontWeight: 1000, opacity: 0.85 }}>{pair.left.name}</div>
            </button>
            <button onClick={() => pick("right")} disabled={!!feedback} style={cellStyle("right")}>
              <div style={{ fontSize: "clamp(64px, 18vw, 110px)", lineHeight: 1 }}>{pair.right.emoji}</div>
              <div style={{ fontSize: "clamp(13px, 3.5vw, 16px)", fontWeight: 1000, opacity: 0.85 }}>{pair.right.name}</div>
            </button>
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
                こたえ：{(correctSide === "left" ? pair.left : pair.right).name} {(correctSide === "left" ? pair.left : pair.right).emoji}
              </div>
            )}
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
const kidPanelFlex: React.CSSProperties = { padding: 12, borderRadius: 18, border: "3px solid rgba(80,200,255,0.25)", background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0,160,255,0.10)", boxSizing: "border-box", minHeight: 0, flex: 1, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" };
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
