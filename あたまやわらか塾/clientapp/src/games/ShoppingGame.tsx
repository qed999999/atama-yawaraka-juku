import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };

type Phase = "intro" | "shopping" | "change" | "feedback" | "result";

type Item = { emoji: string; name: string; price: number };

const ALL_ITEMS: Item[] = [
  { emoji: "🍎", name: "りんご", price: 50 },
  { emoji: "🍌", name: "バナナ", price: 30 },
  { emoji: "🥚", name: "たまご", price: 60 },
  { emoji: "🍞", name: "パン", price: 80 },
  { emoji: "🥛", name: "ぎゅうにゅう", price: 90 },
  { emoji: "🍩", name: "ドーナツ", price: 70 },
  { emoji: "🍰", name: "ケーキ", price: 120 },
  { emoji: "🧁", name: "カップケーキ", price: 100 },
  { emoji: "🍪", name: "クッキー", price: 40 },
  { emoji: "🍬", name: "あめ", price: 20 },
  { emoji: "🧃", name: "ジュース", price: 60 },
  { emoji: "🍙", name: "おにぎり", price: 80 },
  { emoji: "🍡", name: "だんご", price: 50 },
  { emoji: "🥕", name: "にんじん", price: 40 },
  { emoji: "🍅", name: "トマト", price: 30 },
  { emoji: "🌽", name: "とうもろこし", price: 70 },
  { emoji: "🍓", name: "いちご", price: 90 },
  { emoji: "🍊", name: "みかん", price: 40 },
  { emoji: "🥐", name: "クロワッサン", price: 110 },
  { emoji: "🍫", name: "チョコレート", price: 60 },
];

const TOTAL_ROUNDS = 5;
const FEEDBACK_MS = 1500;

type RoundData = {
  shelf: Item[];
  shoppingList: Item[];
  budget: number;
  correctChange: number;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRound(roundIndex: number): RoundData {
  const shuffled = shuffle(ALL_ITEMS);
  const shelf = shuffled.slice(0, 6);
  const listCount = roundIndex < 3 ? 2 : 3;
  const shoppingList = shuffle(shelf).slice(0, listCount);
  const totalPrice = shoppingList.reduce((s, it) => s + it.price, 0);
  const extra = Math.round(randInt(30, 100) / 10) * 10;
  const budget = totalPrice + extra;
  const correctChange = budget - totalPrice;
  return { shelf, shoppingList, budget, correctChange };
}

function generateChoices(correct: number): number[] {
  const offsets = [20, 40, -20, -40, 10, 30, -10, -30, 50, 60];
  const choices = new Set<number>([correct]);
  const shuffledOffsets = shuffle(offsets);
  for (const off of shuffledOffsets) {
    if (choices.size >= 3) break;
    const v = correct + off;
    if (v > 0 && !choices.has(v)) choices.add(v);
  }
  // fallback if we somehow don't have 3
  let fallback = 10;
  while (choices.size < 3) {
    if (!choices.has(fallback) && fallback > 0) choices.add(fallback);
    fallback += 10;
  }
  return shuffle([...choices]);
}

const GAME_SECONDS = 60;

export default function ShoppingGame({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [initialBest] = useState(() => prevBest);
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [roundData, setRoundData] = useState<RoundData>(() => generateRound(0));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [choices, setChoices] = useState<number[]>([]);
  const [feedbackOk, setFeedbackOk] = useState(false);
  const [pickedAnswer, setPickedAnswer] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const feedbackTimer = useRef<number | null>(null);

  const clearTimer = () => {
    if (feedbackTimer.current != null) {
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }
  };
  useEffect(() => () => clearTimer(), []);

  // Countdown timer
  useEffect(() => {
    if (phase === "intro" || phase === "result") return;
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

  useEffect(() => {
    if (phase === "result") onScore?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startGame = () => {
    setScore(0);
    setCorrectCount(0);
    setRoundIndex(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    const rd = generateRound(0);
    setRoundData(rd);
    setSelected(new Set());
    setPhase("shopping");
  };

  const goResult = () => { clearTimer(); setPhase("result"); };

  const startRound = (idx: number) => {
    const rd = generateRound(idx);
    setRoundData(rd);
    setRoundIndex(idx);
    setSelected(new Set());
    setPhase("shopping");
  };

  const toggleItem = (idx: number) => {
    if (phase !== "shopping") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectedItems = [...selected].map((i) => roundData.shelf[i]);
  const totalCost = selectedItems.reduce((s, it) => s + it.price, 0);
  const listNames = new Set(roundData.shoppingList.map((it) => it.name));
  const isCorrectSelection =
    selected.size === roundData.shoppingList.length &&
    selectedItems.every((it) => listNames.has(it.name));

  const checkout = () => {
    if (!isCorrectSelection) return;
    setChoices(generateChoices(roundData.correctChange));
    setPhase("change");
  };

  const answerChange = (val: number) => {
    if (phase !== "change") return;
    const ok = val === roundData.correctChange;
    if (ok) { setScore((s) => s + 10); setCorrectCount((c) => c + 1); }
    else setScore((s) => Math.max(0, s - 5));
    setFeedbackOk(ok);
    setPickedAnswer(val);
    setPhase("feedback");
    clearTimer();
    feedbackTimer.current = window.setTimeout(() => {
      const nextIdx = roundIndex + 1;
      if (nextIdx >= TOTAL_ROUNDS) {
        setPhase("result");
      } else {
        startRound(nextIdx);
      }
    }, FEEDBACK_MS);
  };

  // --- INTRO ---
  if (phase === "intro") {
    return (
      <Shell title="おかいものゲーム" onExit={onExit}>
        <div style={{ ...panelStyle, textAlign: "left", width: "100%" }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>🛒</div>
          <h2 style={{ margin: "0 0 12px", fontWeight: 1000, fontSize: "clamp(20px, 5vw, 26px)", color: "#ff3fa7" }}>
            おかいものゲーム
          </h2>
          <p style={{ margin: "0 0 8px", fontSize: "clamp(14px, 3.5vw, 17px)", lineHeight: 1.7 }}>
            おかいものリストの ものを えらんで<br />
            おつりを けいさん しよう！
          </p>
          <ul style={{ margin: "0 0 16px", textAlign: "left", lineHeight: 1.8, fontSize: "clamp(13px, 3.2vw, 15px)", paddingLeft: 20 }}>
            <li>ぜんぶで <b>5かい</b> おかいもの</li>
            <li>リストの ものを タップして えらぶ</li>
            <li>おつりを あてよう！</li>
          </ul>
          <button style={primaryBtn} onClick={startGame}>スタート！</button>
        </div>
      </Shell>
    );
  }

  // --- RESULT ---
  if (phase === "result") {
    const emoji =
      correctCount === TOTAL_ROUNDS ? "🎉" : correctCount >= 3 ? "😊" : correctCount >= 1 ? "🙂" : "😢";
    const msg =
      correctCount === TOTAL_ROUNDS
        ? "パーフェクト！ すごい！"
        : correctCount >= 3
        ? "よく できました！"
        : correctCount >= 1
        ? "もう すこし がんばろう！"
        : "つぎは がんばろう！";
    return (
      <Shell title="けっか" onExit={onExit}>
        <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 16, boxSizing: "border-box" }}>
          <div style={{ ...panelStyle, maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 72, marginBottom: 8 }}>{emoji}</div>
            <div style={{ fontSize: "clamp(22px, 6vw, 32px)", fontWeight: 1000, color: "#ff3fa7", marginBottom: 8 }}>
              {score}てん
            </div>
            <div style={{ fontSize: "clamp(16px, 4vw, 20px)", fontWeight: 800, marginBottom: 4 }}>
              {msg}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
              {Array.from({ length: TOTAL_ROUNDS }, (_, i) => (
                <span key={i} style={{ fontSize: 28 }}>{i < correctCount ? "⭕" : "❌"}</span>
              ))}
            </div>
            <RecordBanner score={score} prevBest={initialBest} unit={unit} />
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
              <button style={primaryBtn} onClick={startGame}>もういっかい</button>
              <button style={secondaryBtn} onClick={onExit}>メニューへ</button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // --- FEEDBACK POPUP ---
  if (phase === "feedback") {
    const okColor = "#22c55e";
    const ngColor = "#ef4444";
    return (
      <Shell title={`おかいもの ${roundIndex + 1}/${TOTAL_ROUNDS}`} onExit={onExit} rightExtra={<button style={secondaryBtn} onClick={goResult}>けっかへ</button>}>
        <ShoppingView roundData={roundData} selected={selected} phase={phase} />
        <div style={kidOverlay}>
          <div style={{
            ...panelStyle, maxWidth: 400, textAlign: "center",
            border: `3px solid ${feedbackOk ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}`,
          }}>
            <div style={{
              fontSize: 72, fontWeight: 1000, lineHeight: 1, marginBottom: 6,
              color: feedbackOk ? okColor : ngColor,
            }}>
              {feedbackOk ? "○" : "×"}
            </div>
            <div style={{ fontSize: "clamp(18px, 5vw, 24px)", fontWeight: 1000, marginBottom: 8 }}>
              {feedbackOk ? "せいかい！" : "ざんねん！"}
            </div>
            {!feedbackOk && (
              <div style={{ fontSize: "clamp(14px, 3.5vw, 17px)", opacity: 0.88 }}>
                こたえ：<b>{roundData.correctChange}えん</b><br />
                <span style={{ opacity: 0.7 }}>（あなたのこたえ: {pickedAnswer}えん）</span>
              </div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // --- CHANGE PHASE ---
  if (phase === "change") {
    return (
      <Shell title={`おかいもの ${roundIndex + 1}/${TOTAL_ROUNDS}`} onExit={onExit} rightExtra={<button style={secondaryBtn} onClick={goResult}>けっかへ</button>}>
        <div style={{ display: "grid", gap: 10, height: "100%", overflow: "auto", padding: "4px 0", boxSizing: "border-box" }}>
          <div style={{
            ...panelStyle, textAlign: "center",
            background: "linear-gradient(180deg, rgba(255,250,230,0.95), rgba(255,255,255,0.95))",
          }}>
            <div style={{ fontSize: "clamp(14px, 3.5vw, 17px)", fontWeight: 800, marginBottom: 10, color: "#b45309" }}>
              おつりは いくら？
            </div>
            <div style={{
              display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, alignItems: "center",
              fontSize: "clamp(14px, 3.5vw, 18px)", fontWeight: 900, marginBottom: 14,
            }}>
              <span style={{ background: "rgba(255,200,100,0.3)", padding: "4px 10px", borderRadius: 12 }}>
                🛒 おかいけい: {totalCost}えん
              </span>
              <span style={{ fontSize: "clamp(18px, 4vw, 24px)" }}>→</span>
              <span style={{ background: "rgba(255,220,100,0.4)", padding: "4px 10px", borderRadius: 12 }}>
                💰 おさいふ: {roundData.budget}えん
              </span>
              <span style={{ fontSize: "clamp(18px, 4vw, 24px)" }}>→</span>
              <span style={{ background: "rgba(120,214,255,0.3)", padding: "4px 10px", borderRadius: 12 }}>
                おつりは？
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {choices.map((val) => (
                <button
                  key={val}
                  onClick={() => answerChange(val)}
                  style={choiceBtn}
                >
                  {val}えん
                </button>
              ))}
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // --- SHOPPING PHASE ---
  return (
    <Shell title={`おかいもの ${roundIndex + 1}/${TOTAL_ROUNDS}`} onExit={onExit} rightExtra={<button style={secondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={{ display: "grid", gap: 8, height: "100%", overflow: "auto", padding: "4px 0", boxSizing: "border-box", gridTemplateRows: "auto auto auto 1fr auto" }}>
        {/* Timer + score bar */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderRadius: 14, background: "rgba(255,255,255,0.9)", border: "2px solid rgba(120,214,255,0.25)", fontSize: "clamp(12px, 3vw, 15px)", fontWeight: 900 }}>
          <span>のこり {seconds}びょう</span>
          <span>{score}てん</span>
        </div>
        {/* Shopping list */}
        <div style={{
          ...panelStyle, padding: "8px 12px",
          background: "linear-gradient(180deg, rgba(255,240,245,0.95), rgba(255,255,255,0.95))",
          border: "3px solid rgba(255,170,220,0.4)",
        }}>
          <div style={{ fontSize: "clamp(12px, 3vw, 14px)", fontWeight: 900, color: "#ff3fa7", marginBottom: 4 }}>
            📝 おかいものリスト
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {roundData.shoppingList.map((item, i) => {
              const bought = selectedItems.some((si) => si.name === item.name);
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 14,
                  background: bought ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.8)",
                  border: bought ? "2px solid rgba(34,197,94,0.4)" : "2px solid rgba(0,0,0,0.06)",
                  textDecoration: bought ? "line-through" : "none",
                  opacity: bought ? 0.7 : 1,
                  fontSize: "clamp(13px, 3.2vw, 16px)", fontWeight: 800,
                }}>
                  <span style={{ fontSize: "clamp(18px, 4.5vw, 24px)" }}>{item.emoji}</span>
                  {item.name}
                </div>
              );
            })}
          </div>
        </div>

        {/* Budget + cart */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{
            ...panelStyle, padding: "6px 14px", flex: 1, minWidth: 150, textAlign: "center",
            background: "linear-gradient(180deg, rgba(255,250,200,0.95), rgba(255,255,240,0.95))",
            border: "3px solid rgba(255,200,50,0.4)",
          }}>
            <span style={{ fontSize: "clamp(15px, 4vw, 20px)", fontWeight: 1000 }}>
              💰 おさいふ: <span style={{ color: "#b45309" }}>{roundData.budget}えん</span>
            </span>
          </div>
          <div style={{
            ...panelStyle, padding: "6px 14px",
            background: "rgba(255,255,255,0.92)",
          }}>
            <span style={{ fontSize: "clamp(15px, 4vw, 20px)", fontWeight: 1000 }}>
              🛒 {selected.size}こ
            </span>
          </div>
        </div>

        {/* Store shelf */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "clamp(6px, 1.5vw, 10px)",
          alignContent: "start", overflow: "auto", padding: 2,
        }}>
          {roundData.shelf.map((item, idx) => {
            const isSel = selected.has(idx);
            return (
              <button
                key={idx}
                onClick={() => toggleItem(idx)}
                style={{
                  display: "grid", placeItems: "center", gap: 2,
                  padding: "clamp(8px, 2vw, 14px) 4px",
                  borderRadius: 18,
                  border: isSel ? "3px solid #ff6bb5" : "3px solid rgba(0,0,0,0.06)",
                  background: isSel
                    ? "linear-gradient(180deg, rgba(255,200,230,0.6), rgba(255,230,245,0.9))"
                    : "rgba(255,255,255,0.92)",
                  boxShadow: isSel
                    ? "0 0 16px rgba(255,107,181,0.35), 0 8px 20px rgba(255,63,167,0.12)"
                    : "0 6px 14px rgba(0,0,0,0.06)",
                  transform: isSel ? "scale(1.04)" : "scale(1)",
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <span style={{ fontSize: "clamp(32px, 8vw, 48px)", lineHeight: 1 }}>{item.emoji}</span>
                <span style={{ fontSize: "clamp(11px, 2.8vw, 14px)", fontWeight: 900 }}>{item.name}</span>
                <span style={{
                  fontSize: "clamp(12px, 3vw, 15px)", fontWeight: 1000, color: "#b45309",
                  background: "rgba(255,230,150,0.5)", padding: "2px 8px", borderRadius: 10,
                }}>
                  {item.price}えん
                </span>
              </button>
            );
          })}
        </div>

        {/* Checkout button */}
        <button
          onClick={checkout}
          disabled={!isCorrectSelection}
          style={{
            ...primaryBtn,
            width: "100%",
            fontSize: "clamp(18px, 5vw, 24px)",
            padding: "12px 16px",
            opacity: isCorrectSelection ? 1 : 0.45,
            pointerEvents: isCorrectSelection ? "auto" : "none",
            background: isCorrectSelection
              ? "linear-gradient(180deg, rgba(255,180,50,0.95), rgba(255,120,30,0.92))"
              : "linear-gradient(180deg, rgba(200,200,200,0.6), rgba(180,180,180,0.5))",
            border: isCorrectSelection
              ? "3px solid rgba(255,150,0,0.3)"
              : "3px solid rgba(0,0,0,0.06)",
            boxShadow: isCorrectSelection
              ? "0 12px 22px rgba(255,120,30,0.25)"
              : "none",
          }}
        >
          おかいけい！
        </button>
      </div>
    </Shell>
  );
}

// Sub-component: shows the shopping shelf behind feedback overlay
function ShoppingView({ roundData, selected, phase: _phase }: {
  roundData: RoundData; selected: Set<number>; phase: Phase;
}) {
  return (
    <div style={{ display: "grid", gap: 8, height: "100%", overflow: "hidden", padding: "4px 0", boxSizing: "border-box", opacity: 0.3, pointerEvents: "none" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
        alignContent: "start", padding: 2,
      }}>
        {roundData.shelf.map((item, idx) => {
          const isSel = selected.has(idx);
          return (
            <div
              key={idx}
              style={{
                display: "grid", placeItems: "center", gap: 2,
                padding: "clamp(8px, 2vw, 14px) 4px",
                borderRadius: 18,
                border: isSel ? "3px solid #ff6bb5" : "3px solid rgba(0,0,0,0.06)",
                background: isSel
                  ? "linear-gradient(180deg, rgba(255,200,230,0.6), rgba(255,230,245,0.9))"
                  : "rgba(255,255,255,0.92)",
              }}
            >
              <span style={{ fontSize: "clamp(32px, 8vw, 48px)", lineHeight: 1 }}>{item.emoji}</span>
              <span style={{ fontSize: "clamp(11px, 2.8vw, 14px)", fontWeight: 900 }}>{item.name}</span>
              <span style={{
                fontSize: "clamp(12px, 3vw, 15px)", fontWeight: 1000, color: "#b45309",
                background: "rgba(255,230,150,0.5)", padding: "2px 8px", borderRadius: 10,
              }}>
                {item.price}えん
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Shell wrapper (consistent with other games) ---

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
        <div style={{ marginTop: 8, minHeight: 0, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Styles ---

const kidOverlay: React.CSSProperties = {
  position: "fixed", inset: 0, display: "grid", placeItems: "center",
  background: "rgba(0,0,0,0.25)", zIndex: 9999,
  padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
  boxSizing: "border-box", overflow: "hidden",
};

const stageFixed: React.CSSProperties = {
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

const cardStyle: React.CSSProperties = {
  width: "min(980px, 100%)", height: "100%", maxHeight: "100%",
  borderRadius: 22, padding: 10, boxSizing: "border-box",
  background: "rgba(255, 255, 255, 0.86)", border: "3px solid rgba(255, 170, 220, 0.55)",
  boxShadow: "0 18px 44px rgba(255, 120, 180, 0.18)",
  display: "flex", flexDirection: "column", overflow: "hidden",
};

const headerRow: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap", minWidth: 0,
};

const titleStyle: React.CSSProperties = {
  margin: 0, fontWeight: 1000, fontSize: "clamp(18px, 4.5vw, 22px)", color: "#ff3fa7",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
};

const kidHeaderBtn: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 16, border: "2px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
};

const panelStyle: React.CSSProperties = {
  padding: 16, borderRadius: 18, border: "3px solid rgba(80, 200, 255, 0.25)",
  background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0, 160, 255, 0.10)", boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 16px", borderRadius: 18, border: "3px solid rgba(255, 63, 167, 0.18)",
  background: "linear-gradient(180deg, rgba(255, 120, 200, 0.95), rgba(255, 63, 167, 0.92))",
  color: "#fff", fontWeight: 1000, fontSize: 18, cursor: "pointer",
  boxShadow: "0 12px 22px rgba(255, 63, 167, 0.18)", outline: "none",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 18, border: "3px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)", fontWeight: 1000, cursor: "pointer", fontSize: 16, outline: "none",
};

const choiceBtn: React.CSSProperties = {
  padding: "14px 28px", borderRadius: 22, border: "3px solid rgba(255,170,50,0.35)",
  background: "linear-gradient(180deg, rgba(255,230,150,0.95), rgba(255,200,80,0.92))",
  color: "#7c3a00", fontWeight: 1000, fontSize: "clamp(18px, 5vw, 26px)", cursor: "pointer",
  boxShadow: "0 10px 20px rgba(255,160,30,0.18)", outline: "none",
  transition: "transform 0.1s ease",
};
