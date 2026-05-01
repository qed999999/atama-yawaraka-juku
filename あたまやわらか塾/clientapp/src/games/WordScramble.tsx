import RecordBanner from "../RecordBanner";
import { useEffect, useState, useCallback, useRef } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };
type Phase = "intro" | "playing" | "feedback" | "result";

/* ─── word data ─── */
interface WordEntry {
  word: string;
  hint: string;
  category: string;
}

const ALL_WORDS: WordEntry[] = [
  { word: "りんご", hint: "🍎", category: "くだもの" },
  { word: "ねこ", hint: "🐱", category: "どうぶつ" },
  { word: "いぬ", hint: "🐶", category: "どうぶつ" },
  { word: "さくら", hint: "🌸", category: "しぜん" },
  { word: "ほし", hint: "⭐", category: "そら" },
  { word: "くるま", hint: "🚗", category: "のりもの" },
  { word: "でんしゃ", hint: "🚃", category: "のりもの" },
  { word: "ひこうき", hint: "✈️", category: "のりもの" },
  { word: "さかな", hint: "🐟", category: "いきもの" },
  { word: "とり", hint: "🐦", category: "いきもの" },
  { word: "はな", hint: "🌷", category: "しぜん" },
  { word: "つき", hint: "🌙", category: "そら" },
  { word: "かさ", hint: "☂️", category: "もちもの" },
  { word: "くつ", hint: "👟", category: "もちもの" },
  { word: "ぼうし", hint: "🎩", category: "もちもの" },
  { word: "うさぎ", hint: "🐰", category: "どうぶつ" },
  { word: "かめ", hint: "🐢", category: "どうぶつ" },
  { word: "ぞう", hint: "🐘", category: "どうぶつ" },
  { word: "きりん", hint: "🦒", category: "どうぶつ" },
  { word: "ぱんだ", hint: "🐼", category: "どうぶつ" },
  { word: "すいか", hint: "🍉", category: "くだもの" },
  { word: "ぶどう", hint: "🍇", category: "くだもの" },
  { word: "もも", hint: "🍑", category: "くだもの" },
  { word: "たいよう", hint: "☀️", category: "そら" },
  { word: "にじ", hint: "🌈", category: "そら" },
  { word: "やま", hint: "⛰️", category: "しぜん" },
  { word: "うみ", hint: "🌊", category: "しぜん" },
  { word: "かに", hint: "🦀", category: "いきもの" },
  { word: "たこ", hint: "🐙", category: "いきもの" },
  { word: "ちょう", hint: "🦋", category: "いきもの" },
  { word: "とけい", hint: "⏰", category: "もちもの" },
  { word: "えんぴつ", hint: "✏️", category: "もちもの" },
  { word: "ふね", hint: "🚢", category: "のりもの" },
  { word: "ろけっと", hint: "🚀", category: "のりもの" },
  { word: "ぺんぎん", hint: "🐧", category: "どうぶつ" },
];

const TOTAL_ROUNDS = 10;
const GAME_SECONDS = 60;

/* ─── helpers ─── */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const HIRAGANA_POOL =
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん" +
  "がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ";

function randomDecoys(exclude: string[], count: number): string[] {
  const pool = HIRAGANA_POOL.split("").filter((c) => !exclude.includes(c));
  const out: string[] = [];
  const used = new Set(exclude);
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    const c = pool[idx];
    if (!used.has(c)) {
      out.push(c);
      used.add(c);
    }
    pool.splice(idx, 1);
  }
  return out;
}

interface RoundData {
  entry: WordEntry;
  pool: { char: string; id: number }[];
  wordLen: number;
}

function generateRounds(): RoundData[] {
  const picked = shuffle(ALL_WORDS).slice(0, TOTAL_ROUNDS);
  return picked.map((entry, roundIdx) => {
    const chars = entry.word.split("");
    const addDecoys = roundIdx >= 5 && chars.length >= 3;
    const decoyCount = addDecoys ? (chars.length >= 4 ? 2 : 1) : 0;
    const decoys = randomDecoys(chars, decoyCount);
    const allChars = shuffle([...chars, ...decoys]);
    return {
      entry,
      pool: allChars.map((c, i) => ({ char: c, id: i })),
      wordLen: chars.length,
    };
  });
}

/* ─── styles ─── */
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

const emojiHint: React.CSSProperties = {
  fontSize: "clamp(64px, 18vw, 100px)",
  lineHeight: 1,
  margin: "8px 0 0",
  animation: "wsEmojiPulse 1.8s ease-in-out infinite",
};

const categoryBadge: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(124, 58, 237, 0.12)",
  color: "#7c3aed",
  borderRadius: 14,
  padding: "4px 16px",
  fontWeight: 800,
  fontSize: "clamp(13px, 3.5vw, 16px)",
  margin: "8px 0 4px",
};

const slotRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "center",
  flexWrap: "wrap",
  margin: "12px 0",
  minHeight: 56,
};

const slotBox = (filled: boolean): React.CSSProperties => ({
  width: "clamp(44px, 12vw, 54px)",
  height: "clamp(44px, 12vw, 54px)",
  borderRadius: 12,
  border: filled ? "2.5px solid #7c3aed" : "2.5px dashed rgba(124,58,237,0.35)",
  background: filled ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.5)",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  fontSize: "clamp(20px, 5.5vw, 28px)",
  color: "#7c3aed",
  cursor: filled ? "pointer" : "default",
  transition: "all 0.15s ease",
  boxShadow: filled ? "0 2px 8px rgba(124,58,237,0.15)" : "none",
});

const poolGrid: React.CSSProperties = {
  display: "flex",
  gap: 10,
  justifyContent: "center",
  flexWrap: "wrap",
  margin: "8px 0",
  maxWidth: 400,
};

const poolBlock = (used: boolean): React.CSSProperties => ({
  width: "clamp(46px, 12vw, 56px)",
  height: "clamp(46px, 12vw, 56px)",
  borderRadius: 14,
  background: used ? "rgba(200,200,200,0.3)" : "#fff",
  border: used ? "2px solid transparent" : "2px solid rgba(124,58,237,0.2)",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  fontSize: "clamp(20px, 5.5vw, 28px)",
  color: used ? "rgba(160,160,160,0.5)" : "#1b1b1b",
  cursor: used ? "default" : "pointer",
  boxShadow: used ? "none" : "0 3px 12px rgba(0,0,0,0.08)",
  transition: "all 0.15s ease",
  transform: used ? "scale(0.9)" : "scale(1)",
  userSelect: "none",
});

const actionBtn = (
  bg: string,
  color: string,
  disabled = false
): React.CSSProperties => ({
  background: disabled ? "#ccc" : bg,
  color: disabled ? "#888" : color,
  border: "none",
  borderRadius: 18,
  padding: "10px 28px",
  fontWeight: 900,
  fontSize: "clamp(15px, 4vw, 19px)",
  cursor: disabled ? "default" : "pointer",
  boxShadow: disabled ? "none" : "0 4px 16px rgba(0,0,0,0.12)",
  transition: "all 0.15s ease",
  margin: "0 6px",
});

const stageFixed: React.CSSProperties = {
  position: "fixed", inset: 0, overflow: "hidden",
  padding: "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
  boxSizing: "border-box",
  background: "radial-gradient(circle at 15% 20%, rgba(255,230,109,0.35), transparent 40%),radial-gradient(circle at 85% 25%, rgba(255,140,189,0.28), transparent 42%),radial-gradient(circle at 20% 85%, rgba(120,214,255,0.25), transparent 45%),linear-gradient(180deg, #fff7fe 0%, #f1fbff 55%, #fffdf2 100%)",
  fontFamily: "ui-rounded, system-ui, -apple-system, 'Hiragino Maru Gothic ProN', 'M PLUS Rounded 1c', 'Noto Sans JP', sans-serif",
  color: "#1b1b1b", display: "grid", placeItems: "center",
};
const sparkles: React.CSSProperties = { position: "absolute", inset: -40, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.95) 0 2px, transparent 3px), radial-gradient(circle, rgba(255,255,255,0.85) 0 1.5px, transparent 3px)", backgroundSize: "110px 110px, 160px 160px", backgroundPosition: "0 0, 40px 60px", opacity: 0.25 };
const cardStyle: React.CSSProperties = { width: "min(980px, 100%)", height: "100%", maxHeight: "100%", borderRadius: 22, padding: 10, boxSizing: "border-box", background: "rgba(255,255,255,0.86)", border: "3px solid rgba(255,170,220,0.55)", boxShadow: "0 18px 44px rgba(255,120,180,0.18)", display: "flex", flexDirection: "column", overflow: "hidden" };
const headerRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap", minWidth: 0 };
const titleStyle: React.CSSProperties = { margin: 0, fontWeight: 1000, fontSize: "clamp(18px, 4.5vw, 22px)", color: "#ff3fa7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };
const kidHeaderBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 14, border: "2px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" };
const panelStyle: React.CSSProperties = { padding: 16, borderRadius: 18, border: "3px solid rgba(80,200,255,0.25)", background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0,160,255,0.10)", boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { padding: "12px 24px", borderRadius: 18, border: "none", background: "linear-gradient(180deg, #ff73c6 0%, #ff3fa7 100%)", color: "#fff", fontWeight: 1000, fontSize: 18, cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 14, border: "2px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" };

/* ─── keyframes (injected once) ─── */
const KEYFRAMES_ID = "ws-scramble-keyframes";
function injectKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes wsEmojiPulse {
      0%, 100% { transform: scale(1) rotate(0deg); }
      25% { transform: scale(1.08) rotate(-4deg); }
      50% { transform: scale(1) rotate(0deg); }
      75% { transform: scale(1.08) rotate(4deg); }
    }
    @keyframes wsFadeIn {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes wsPopIn {
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes wsCelebrate {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15) rotate(3deg); }
    }
  `;
  document.head.appendChild(style);
}

/* ─── Shell wrapper ─── */
function Shell({ title, onExit, children, rightExtra }: {
  title: string; onExit: () => void; children: React.ReactNode; rightExtra?: React.ReactNode;
}) {
  return (
    <div style={stageFixed}>
      <div style={sparkles} aria-hidden />
      <div style={cardStyle}>
        <div style={headerRow}>
          <h1 style={titleStyle}>{title}</h1>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "nowrap" }}>
            {rightExtra}
            <button style={kidHeaderBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
        <div style={{ marginTop: 8, minHeight: 0, flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── component ─── */
export default function WordScramble({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [initialBest] = useState(() => prevBest);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [roundIdx, setRoundIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [placed, setPlaced] = useState<{ char: string; poolId: number }[]>([]);
  const [usedIds, setUsedIds] = useState<Set<number>>(new Set());
  const [feedbackOk, setFeedbackOk] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // inject keyframes on mount
  useEffect(() => {
    injectKeyframes();
  }, []);

  // report score
  useEffect(() => {
    if (phase === "result") onScore?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // cleanup feedback timer
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Countdown timer
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
  const seconds = Math.ceil(timeLeftMs / 1000);

  const startGame = useCallback(() => {
    const r = generateRounds();
    setRounds(r);
    setRoundIdx(0);
    setScore(0);
    setCorrectCount(0);
    setPlaced([]);
    setUsedIds(new Set());
    setTimeLeftMs(GAME_SECONDS * 1000);
    setPhase("playing");
  }, []);

  const goResult = () => setPhase("result");

  const currentRound = rounds[roundIdx] as RoundData | undefined;

  /* place a character from pool into answer slots */
  const placeChar = useCallback(
    (poolId: number, char: string) => {
      if (!currentRound) return;
      if (usedIds.has(poolId)) return;
      if (placed.length >= currentRound.wordLen) return;

      const newPlaced = [...placed, { char, poolId }];
      const newUsed = new Set(usedIds);
      newUsed.add(poolId);
      setPlaced(newPlaced);
      setUsedIds(newUsed);

      // auto-submit when all slots filled
      if (newPlaced.length === currentRound.wordLen) {
        const answer = newPlaced.map((p) => p.char).join("");
        const ok = answer === currentRound.entry.word;
        if (ok) { setScore((s) => s + 10); setCorrectCount((c) => c + 1); }
        else setScore((s) => Math.max(0, s - 5));
        setFeedbackOk(ok);
        setPhase("feedback");

        feedbackTimerRef.current = setTimeout(() => {
          const nextIdx = roundIdx + 1;
          if (nextIdx >= TOTAL_ROUNDS) {
            setPhase("result");
          } else {
            setRoundIdx(nextIdx);
            setPlaced([]);
            setUsedIds(new Set());
            setPhase("playing");
          }
        }, 1800);
      }
    },
    [currentRound, placed, usedIds, roundIdx]
  );

  /* remove a placed character back to pool */
  const removeChar = useCallback(
    (slotIdx: number) => {
      if (phase !== "playing") return;
      const item = placed[slotIdx];
      if (!item) return;
      const newPlaced = placed.filter((_, i) => i !== slotIdx);
      const newUsed = new Set(usedIds);
      newUsed.delete(item.poolId);
      setPlaced(newPlaced);
      setUsedIds(newUsed);
    },
    [placed, usedIds, phase]
  );

  /* manual submit (when not all slots filled) */
  const handleSubmit = useCallback(() => {
    if (!currentRound) return;
    if (placed.length === 0) return;
    const answer = placed.map((p) => p.char).join("");
    const ok = answer === currentRound.entry.word;
    if (ok) { setScore((s) => s + 10); setCorrectCount((c) => c + 1); }
    else setScore((s) => Math.max(0, s - 5));
    setFeedbackOk(ok);
    setPhase("feedback");

    feedbackTimerRef.current = setTimeout(() => {
      const nextIdx = roundIdx + 1;
      if (nextIdx >= TOTAL_ROUNDS) {
        setPhase("result");
      } else {
        setRoundIdx(nextIdx);
        setPlaced([]);
        setUsedIds(new Set());
        setPhase("playing");
      }
    }, 1800);
  }, [currentRound, placed, roundIdx]);

  /* reset current attempt */
  const handleReset = useCallback(() => {
    setPlaced([]);
    setUsedIds(new Set());
  }, []);

  /* ─── INTRO ─── */
  if (phase === "intro") {
    return (
      <Shell title="もじならべ" onExit={onExit}>
        <div style={{ ...panelStyle, textAlign: "left", width: "100%" }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🔤</div>
          <div style={{ fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 1000, color: "#ff3fa7", marginBottom: 8 }}>もじならべ</div>
          <div style={{ fontSize: "clamp(14px, 3.5vw, 17px)", fontWeight: 800, opacity: 0.8, lineHeight: 1.7, marginBottom: 16 }}>
            バラバラのひらがなを<br />ただしいじゅんばんに ならべよう！<br />60びょう いないに たくさん とこう 🎯
          </div>
          <button style={primaryBtn} onClick={startGame}>スタート！</button>
        </div>
      </Shell>
    );
  }

  /* ─── RESULT ─── */
  if (phase === "result") {
    const emoji = correctCount >= 8 ? "🎉" : correctCount >= 5 ? "😊" : "💪";
    const msg = correctCount === TOTAL_ROUNDS ? "パーフェクト！" : correctCount >= 8 ? "すばらしい！" : correctCount >= 5 ? "よくできました！" : "つぎは がんばろう！";
    return (
      <Shell title="けっか" onExit={onExit}>
        <div style={{ display: "grid", placeItems: "center", flex: 1, padding: 16, boxSizing: "border-box" }}>
          <div style={{ ...panelStyle, maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>{emoji}</div>
            <div style={{ fontSize: "clamp(22px, 6vw, 32px)", fontWeight: 1000, color: "#ff3fa7", marginBottom: 8 }}>{score}てん</div>
            <div style={{ fontSize: "clamp(14px, 3.5vw, 16px)", opacity: 0.8, marginBottom: 4 }}>{correctCount} / {TOTAL_ROUNDS} もん せいかい</div>
            <div style={{ fontSize: "clamp(16px, 4vw, 20px)", fontWeight: 800, marginBottom: 16 }}>{msg}</div>
            <RecordBanner score={score} prevBest={initialBest} unit={unit} />
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button style={primaryBtn} onClick={startGame}>もういっかい</button>
              <button style={secondaryBtn} onClick={onExit}>メニューへ</button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  /* ─── PLAYING (and feedback overlay) ─── */
  return (
    <Shell title="もじならべ" onExit={onExit} rightExtra={<button style={secondaryBtn} onClick={goResult}>けっかへ</button>}>
      {/* top info bar */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", marginBottom: 4, borderRadius: 14, background: "rgba(255,255,255,0.9)", border: "2px solid rgba(120,214,255,0.25)", fontSize: "clamp(12px, 3vw, 15px)", fontWeight: 900, width: "100%", maxWidth: 500, boxSizing: "border-box" }}>
        <span>のこり {seconds}びょう</span>
        <span>{roundIdx + 1}/{TOTAL_ROUNDS}</span>
        <span>{score}てん</span>
      </div>

      {currentRound && (
        <div
          key={roundIdx}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px 24px",
            maxWidth: 500,
            width: "100%",
            boxSizing: "border-box",
            animation: "wsFadeIn 0.35s ease",
          }}
        >
          {/* emoji hint */}
          <div style={emojiHint}>{currentRound.entry.hint}</div>

          {/* category badge */}
          <div style={categoryBadge}>ヒント: {currentRound.entry.category}</div>

          {/* answer slots */}
          <div style={slotRow}>
            {Array.from({ length: currentRound.wordLen }).map((_, i) => {
              const p = placed[i];
              return (
                <div
                  key={i}
                  style={slotBox(!!p)}
                  onClick={() => p && removeChar(i)}
                >
                  {p ? p.char : ""}
                </div>
              );
            })}
          </div>

          {/* scrambled pool */}
          <div style={poolGrid}>
            {currentRound.pool.map((item) => {
              const used = usedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  style={poolBlock(used)}
                  onClick={() => !used && placeChar(item.id, item.char)}
                >
                  {item.char}
                </div>
              );
            })}
          </div>

          {/* action buttons */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              style={actionBtn("rgba(124,58,237,0.1)", "#7c3aed")}
              onClick={handleReset}
              disabled={placed.length === 0}
            >
              リセット
            </button>
            <button
              style={actionBtn(
                "#7c3aed",
                "#fff",
                placed.length === 0
              )}
              onClick={handleSubmit}
              disabled={placed.length === 0}
            >
              こたえる！
            </button>
          </div>
        </div>
      )}

      {/* feedback overlay */}
      {phase === "feedback" && currentRound && (
        <div style={kidOverlay}>
          <div
            style={{
              ...kidFeedbackCard(feedbackOk),
              animation: "wsPopIn 0.3s ease",
            }}
          >
            <div
              style={{
                fontSize: "clamp(56px, 16vw, 80px)",
                fontWeight: 1000,
                margin: "4px 0",
                color: feedbackOk ? "#22c55e" : "#ef4444",
              }}
            >
              {feedbackOk ? "○" : "×"}
            </div>
            <p
              style={{
                fontWeight: 900,
                fontSize: "clamp(18px, 5vw, 24px)",
                margin: "4px 0",
                color: feedbackOk ? "#16a34a" : "#e11d48",
              }}
            >
              {feedbackOk ? "せいかい！" : "ざんねん！"}
            </p>
            <div
              style={{
                display: "flex",
                gap: 6,
                justifyContent: "center",
                margin: "10px 0 4px",
              }}
            >
              {currentRound.entry.word.split("").map((c, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: "clamp(38px, 10vw, 48px)",
                    height: "clamp(38px, 10vw, 48px)",
                    borderRadius: 10,
                    background: feedbackOk
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(225,29,72,0.08)",
                    border: `2px solid ${feedbackOk ? "rgba(34,197,94,0.3)" : "rgba(225,29,72,0.25)"}`,
                    fontWeight: 900,
                    fontSize: "clamp(18px, 5vw, 24px)",
                    color: feedbackOk ? "#16a34a" : "#e11d48",
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
            <p
              style={{
                fontWeight: 700,
                fontSize: "clamp(13px, 3.5vw, 16px)",
                color: "#888",
                margin: "6px 0 0",
              }}
            >
              {feedbackOk ? "" : "こたえ："}{currentRound.entry.hint} {currentRound.entry.word}（{currentRound.entry.category}）
            </p>
          </div>
        </div>
      )}
    </Shell>
  );
}
