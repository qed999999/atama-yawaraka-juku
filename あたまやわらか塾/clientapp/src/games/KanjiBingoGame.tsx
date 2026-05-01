import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState } from "react";

type KanjiEntry = { kanji: string; readings: string[] };
type Props = {
  onExit: () => void;
  onScore?: (score: number, difficulty?: string) => void;
  difficultyBests?: Record<string, number>;
  unit?: string;
};
type Difficulty = "grade1" | "grade2";
type Cell = { entry: KanjiEntry; marked: boolean };
type Question = { reading: string; validIndices: number[] };

// ===== Kanji Data =====
const GRADE1: KanjiEntry[] = [
  { kanji: "一", readings: ["いち"] },
  { kanji: "二", readings: ["に"] },
  { kanji: "三", readings: ["さん"] },
  { kanji: "四", readings: ["よん"] },
  { kanji: "五", readings: ["ご"] },
  { kanji: "六", readings: ["ろく"] },
  { kanji: "七", readings: ["なな"] },
  { kanji: "八", readings: ["はち"] },
  { kanji: "九", readings: ["きゅう"] },
  { kanji: "十", readings: ["じゅう"] },
  { kanji: "百", readings: ["ひゃく"] },
  { kanji: "千", readings: ["せん"] },
  { kanji: "山", readings: ["やま", "さん"] },
  { kanji: "川", readings: ["かわ"] },
  { kanji: "空", readings: ["そら"] },
  { kanji: "海", readings: ["うみ"] },
  { kanji: "田", readings: ["た"] },
  { kanji: "林", readings: ["はやし"] },
  { kanji: "森", readings: ["もり"] },
  { kanji: "花", readings: ["はな"] },
  { kanji: "草", readings: ["くさ"] },
  { kanji: "虫", readings: ["むし"] },
  { kanji: "犬", readings: ["いぬ"] },
  { kanji: "石", readings: ["いし"] },
  { kanji: "竹", readings: ["たけ"] },
  { kanji: "日", readings: ["ひ", "にち"] },
  { kanji: "月", readings: ["つき", "がつ"] },
  { kanji: "火", readings: ["か", "ひ"] },
  { kanji: "水", readings: ["みず", "すい"] },
  { kanji: "木", readings: ["き", "もく"] },
  { kanji: "金", readings: ["かね", "きん"] },
  { kanji: "土", readings: ["つち", "ど"] },
  { kanji: "目", readings: ["め"] },
  { kanji: "口", readings: ["くち"] },
  { kanji: "耳", readings: ["みみ"] },
  { kanji: "手", readings: ["て"] },
  { kanji: "足", readings: ["あし"] },
  { kanji: "力", readings: ["ちから"] },
  { kanji: "玉", readings: ["たま"] },
  { kanji: "糸", readings: ["いと"] },
  { kanji: "車", readings: ["くるま"] },
  { kanji: "音", readings: ["おと"] },
  { kanji: "雨", readings: ["あめ"] },
  { kanji: "上", readings: ["うえ"] },
  { kanji: "下", readings: ["した"] },
  { kanji: "中", readings: ["なか"] },
  { kanji: "大", readings: ["おおきい"] },
  { kanji: "小", readings: ["ちいさい"] },
  { kanji: "右", readings: ["みぎ"] },
  { kanji: "左", readings: ["ひだり"] },
  { kanji: "男", readings: ["おとこ"] },
  { kanji: "女", readings: ["おんな"] },
  { kanji: "子", readings: ["こ"] },
  { kanji: "人", readings: ["ひと"] },
  { kanji: "王", readings: ["おう"] },
  { kanji: "白", readings: ["しろ"] },
  { kanji: "本", readings: ["ほん"] },
  { kanji: "先", readings: ["さき"] },
  { kanji: "年", readings: ["とし", "ねん"] },
  { kanji: "今", readings: ["いま"] },
];

const GRADE2_EXTRA: KanjiEntry[] = [
  { kanji: "朝", readings: ["あさ"] },
  { kanji: "昼", readings: ["ひる"] },
  { kanji: "夜", readings: ["よる"] },
  { kanji: "春", readings: ["はる"] },
  { kanji: "夏", readings: ["なつ"] },
  { kanji: "秋", readings: ["あき"] },
  { kanji: "冬", readings: ["ふゆ"] },
  { kanji: "父", readings: ["ちち"] },
  { kanji: "母", readings: ["はは"] },
  { kanji: "兄", readings: ["あに"] },
  { kanji: "姉", readings: ["あね"] },
  { kanji: "弟", readings: ["おとうと"] },
  { kanji: "妹", readings: ["いもうと"] },
  { kanji: "友", readings: ["とも"] },
  { kanji: "魚", readings: ["さかな"] },
  { kanji: "鳥", readings: ["とり"] },
  { kanji: "馬", readings: ["うま"] },
  { kanji: "牛", readings: ["うし"] },
  { kanji: "米", readings: ["こめ"] },
  { kanji: "茶", readings: ["ちゃ"] },
  { kanji: "絵", readings: ["え"] },
  { kanji: "紙", readings: ["かみ"] },
  { kanji: "道", readings: ["みち"] },
  { kanji: "池", readings: ["いけ"] },
  { kanji: "星", readings: ["ほし"] },
  { kanji: "雲", readings: ["くも"] },
  { kanji: "雪", readings: ["ゆき"] },
  { kanji: "風", readings: ["かぜ"] },
  { kanji: "北", readings: ["きた"] },
  { kanji: "南", readings: ["みなみ"] },
  { kanji: "東", readings: ["ひがし"] },
  { kanji: "西", readings: ["にし"] },
  { kanji: "長", readings: ["ながい", "ちょう"] },
  { kanji: "強", readings: ["つよい"] },
  { kanji: "弱", readings: ["よわい"] },
  { kanji: "広", readings: ["ひろい"] },
  { kanji: "近", readings: ["ちかい"] },
  { kanji: "遠", readings: ["とおい"] },
  { kanji: "高", readings: ["たかい"] },
  { kanji: "明", readings: ["あかるい"] },
  { kanji: "多", readings: ["おおい"] },
  { kanji: "少", readings: ["すくない"] },
  { kanji: "古", readings: ["ふるい"] },
  { kanji: "新", readings: ["あたらしい"] },
  { kanji: "読", readings: ["よむ"] },
  { kanji: "書", readings: ["かく"] },
  { kanji: "言", readings: ["いう"] },
  { kanji: "聞", readings: ["きく"] },
  { kanji: "歩", readings: ["あるく"] },
  { kanji: "走", readings: ["はしる"] },
  { kanji: "来", readings: ["くる"] },
  { kanji: "帰", readings: ["かえる"] },
  { kanji: "食", readings: ["たべる"] },
  { kanji: "飲", readings: ["のむ"] },
  { kanji: "見", readings: ["みる"] },
  { kanji: "話", readings: ["はなし"] },
  { kanji: "買", readings: ["かう"] },
  { kanji: "売", readings: ["うる"] },
  { kanji: "色", readings: ["いろ"] },
  { kanji: "形", readings: ["かたち"] },
  { kanji: "体", readings: ["からだ"] },
  { kanji: "顔", readings: ["かお"] },
  { kanji: "頭", readings: ["あたま"] },
  { kanji: "国", readings: ["くに"] },
  { kanji: "電", readings: ["でんき"] },
  { kanji: "室", readings: ["へや"] },
];

// ===== Constants =====
const BINGO_LINES = [
  [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
  [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
  [0,6,12,18,24], [4,8,12,16,20],
];
const FREE_IDX = 12;
const GAME_SECONDS = 60;
const DIFF_LABELS: Record<Difficulty, string> = { grade1: "小1", grade2: "小2" };

// ===== Helpers =====
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeBoard(pool: KanjiEntry[]): Cell[] {
  const selected = shuffle(pool).slice(0, 24);
  const cells: Cell[] = selected.map(entry => ({ entry, marked: false }));
  cells.splice(FREE_IDX, 0, { entry: { kanji: "★", readings: [] }, marked: true });
  return cells;
}

function makeQuestion(cells: Cell[]): Question | null {
  const unmarked = cells.map((_, i) => i).filter(i => i !== FREE_IDX && !cells[i].marked);
  if (unmarked.length === 0) return null;
  const targetIdx = unmarked[Math.floor(Math.random() * unmarked.length)];
  const readings = cells[targetIdx].entry.readings;
  if (!readings.length) return null;
  const reading = readings[Math.floor(Math.random() * readings.length)];
  const validIndices = cells
    .map((_, i) => i)
    .filter(i => i !== FREE_IDX && !cells[i].marked && cells[i].entry.readings.includes(reading));
  return { reading, validIndices };
}

function getCompletedLines(cells: Cell[]): number[][] {
  const marked = new Set(cells.map((c, i) => c.marked ? i : -1).filter(i => i >= 0));
  return BINGO_LINES.filter(line => line.every(i => marked.has(i)));
}

// ===== Component =====
export default function KanjiBingoGame({ onExit, onScore, difficultyBests, unit = "びょう" }: Props) {
  const [phase, setPhase] = useState<"ready" | "playing" | "result">("ready");
  const [difficulty, setDifficulty] = useState<Difficulty>("grade1");
  const [cells, setCells] = useState<Cell[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [completedLines, setCompletedLines] = useState<number[][]>([]);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [resultSec, setResultSec] = useState(0);
  const [frozenBest, setFrozenBest] = useState<number | undefined>(undefined);
  const timeLeftMsRef = useRef(GAME_SECONDS * 1000);
  timeLeftMsRef.current = timeLeftMs;

  useEffect(() => {
    if (phase !== "playing") return;
    const startedAt = performance.now();
    const startLeft = timeLeftMs;
    const tick = () => {
      const left = Math.max(0, startLeft - (performance.now() - startedAt));
      setTimeLeftMs(left);
      if (left <= 0) {
        setResultSec(GAME_SECONDS);
        setPhase("result");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === "result") onScore?.(resultSec, DIFF_LABELS[difficulty]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startGame = (diff: Difficulty) => {
    const pool = diff === "grade1" ? GRADE1 : [...GRADE1, ...GRADE2_EXTRA];
    const newCells = makeBoard(pool);
    const q = makeQuestion(newCells);
    setDifficulty(diff);
    setFrozenBest(difficultyBests?.[DIFF_LABELS[diff]]);
    setCells(newCells);
    setQuestion(q);
    setCompletedLines([]);
    setTimeLeftMs(GAME_SECONDS * 1000);
    setResultSec(0);
    setWrongIdx(null);
    setPhase("playing");
  };

  const handleCellClick = (idx: number) => {
    if (phase !== "playing" || !question || cells[idx].marked || idx === FREE_IDX) return;
    if (question.validIndices.includes(idx)) {
      const newCells = cells.map((c, i) => i === idx ? { ...c, marked: true } : c);
      const lines = getCompletedLines(newCells);
      setCells(newCells);
      setCompletedLines(lines);
      if (lines.length > 0) {
        const elapsed = Math.round((GAME_SECONDS * 1000 - timeLeftMsRef.current) / 1000);
        setResultSec(elapsed);
        setPhase("result");
      } else {
        setQuestion(makeQuestion(newCells));
      }
    } else {
      setWrongIdx(idx);
      setTimeout(() => setWrongIdx(null), 600);
    }
  };

  const goResult = () => {
    const elapsed = Math.round((GAME_SECONDS * 1000 - timeLeftMsRef.current) / 1000);
    setResultSec(elapsed);
    setPhase("result");
  };

  const seconds = Math.ceil(timeLeftMs / 1000);
  const bingoSet = new Set(completedLines.flat());

  if (phase === "ready") {
    return (
      <KidShell title="かんじビンゴ" onExit={onExit}>
        <div style={{ ...kidPanel, textAlign: "left" }}>
          <div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 8 }}>🀄 かんじビンゴ</div>
          <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 16, lineHeight: 1.7 }}>
            よみをきいて かんじをさがそう！<br />
            5つならんだら ビンゴ！🎉
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 1000 }}>がくねんを えらんでね：</p>
          <div style={{ display: "grid", gap: 10 }}>
            <button style={{ ...kidPrimaryBtn, width: "100%" }} onClick={() => startGame("grade1")}>
              🌱 小学1年生
            </button>
            <button style={{ ...kidPrimaryBtn, width: "100%" }} onClick={() => startGame("grade2")}>
              ⭐ 小学2年生
            </button>
          </div>
        </div>
      </KidShell>
    );
  }

  if (phase === "result") {
    const isBingo = completedLines.length > 0;
    return (
      <KidShell title="けっか" onExit={onExit}>
        <div style={{ ...kidPanel, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{isBingo ? "🎊" : "⏰"}</div>
          <div style={{ fontSize: 22, fontWeight: 1000, color: "#ff3fa7", marginBottom: 8 }}>
            {isBingo ? "ビンゴ！やったね！" : "じかんきれ！またチャレンジ！"}
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, opacity: 0.8, marginBottom: 4 }}>
            かかったじかん：{resultSec}びょう
          </div>
          <RecordBanner score={resultSec} prevBest={frozenBest} unit={unit} lowerIsBetter />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
            <button style={kidPrimaryBtn} onClick={() => startGame(difficulty)}>もういっかい</button>
            <button style={kidSecondaryBtn} onClick={() => setPhase("ready")}>がくねんをかえる</button>
          </div>
        </div>
      </KidShell>
    );
  }

  return (
    <KidShell title="かんじビンゴ" onExit={onExit} rightExtra={
      <button style={kidSecondaryBtn} onClick={goResult}>けっかへ</button>
    }>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0, flex: 1 }}>
        {/* Top bar */}
        <div style={topBar}>
          <span style={pillBlue}>のこり {seconds}びょう</span>
          <span style={pillPurple}>{DIFF_LABELS[difficulty]}</span>
        </div>

        {/* Question */}
        <div style={questionBox}>
          {question
            ? <><span style={{ opacity: 0.75, fontSize: 14 }}>よみ：</span>「<b style={{ fontSize: "clamp(18px, 5vw, 26px)", color: "#ff3fa7" }}>{question.reading}</b>」の かんじは どれ？</>
            : <span style={{ opacity: 0.6 }}>もんだいなし</span>
          }
        </div>

        {/* Grid */}
        <div style={{ ...gridWrap, flex: 1, minHeight: 0 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 4,
            width: "100%",
            maxWidth: 440,
            margin: "0 auto",
          }}>
            {cells.map((cell, idx) => {
              const isCenter = idx === FREE_IDX;
              const isMarked = cell.marked;
              const isWrong = wrongIdx === idx;
              const isBingoCell = bingoSet.has(idx);
              let bg = "rgba(255,255,255,0.92)";
              let border = "2px solid rgba(0,0,0,0.08)";
              if (isCenter) {
                bg = "rgba(255,220,50,0.35)";
                border = "2px solid rgba(255,180,50,0.55)";
              } else if (isBingoCell) {
                bg = "linear-gradient(135deg, rgba(255,100,180,0.45), rgba(255,220,50,0.45))";
                border = "2px solid rgba(255,63,167,0.7)";
              } else if (isMarked) {
                bg = "rgba(200,255,210,0.65)";
                border = "2px solid rgba(34,197,94,0.45)";
              } else if (isWrong) {
                bg = "rgba(255,100,100,0.3)";
                border = "2px solid rgba(239,68,68,0.6)";
              }
              return (
                <button
                  key={idx}
                  onClick={() => handleCellClick(idx)}
                  disabled={isMarked || isCenter}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 8,
                    border,
                    background: bg,
                    fontWeight: 1000,
                    fontSize: "clamp(15px, 4vw, 24px)",
                    cursor: isMarked || isCenter ? "default" : "pointer",
                    display: "grid",
                    placeItems: "center",
                    position: "relative",
                    transition: "background 0.15s, border 0.15s",
                    userSelect: "none",
                    padding: 0,
                    color: "#1b1b1b",
                  }}
                >
                  {isCenter ? "★" : cell.entry.kanji}
                  {isMarked && !isCenter && (
                    <span style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      fontSize: "clamp(18px, 5vw, 30px)",
                      color: isBingoCell ? "#ff3fa7" : "#22c55e",
                      fontWeight: 1000,
                    }}>○</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </KidShell>
  );
}

function KidShell({ title, onExit, children, rightExtra }: {
  title: string; onExit: () => void; children: React.ReactNode; rightExtra?: React.ReactNode;
}) {
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
        <div style={{ marginTop: 8, minHeight: 0, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
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
const headerBtn: React.CSSProperties = { padding: "10px 12px", borderRadius: 16, border: "2px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" };
const topBar: React.CSSProperties = {
  display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between",
  padding: "8px 10px", borderRadius: 14, background: "rgba(255,255,255,0.75)",
  border: "2px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
};
const pillBase: React.CSSProperties = { fontWeight: 1000, borderRadius: 999, padding: "5px 10px", border: "2px solid rgba(0,0,0,0.06)", whiteSpace: "nowrap", fontSize: 13 };
const pillBlue: React.CSSProperties = { ...pillBase, background: "rgba(26,168,255,0.12)", border: "2px solid rgba(26,168,255,0.2)" };
const pillPurple: React.CSSProperties = { ...pillBase, background: "rgba(124,58,237,0.10)", border: "2px solid rgba(124,58,237,0.2)" };
const questionBox: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 14,
  background: "rgba(255,255,255,0.92)", border: "2px solid rgba(255,63,167,0.22)",
  boxShadow: "0 4px 12px rgba(255,63,167,0.10)",
  fontSize: "clamp(14px, 3.5vw, 17px)", fontWeight: 900, textAlign: "center", flexShrink: 0,
};
const gridWrap: React.CSSProperties = {
  padding: "6px 0", borderRadius: 14, display: "flex", alignItems: "flex-start",
  background: "rgba(255,255,255,0.6)",
};
const kidPanel: React.CSSProperties = {
  padding: 14, borderRadius: 18, border: "3px solid rgba(80,200,255,0.25)",
  background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0,160,255,0.10)", boxSizing: "border-box",
};
const kidPrimaryBtn: React.CSSProperties = {
  padding: "12px 16px", borderRadius: 18, border: "none",
  background: "linear-gradient(180deg, #ff73c6 0%, #ff3fa7 100%)",
  color: "#fff", fontWeight: 1000, fontSize: 16, cursor: "pointer",
};
const kidSecondaryBtn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 14, border: "2px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
};
