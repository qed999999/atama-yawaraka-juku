import React from "react";
import { createPortal } from "react-dom";
import RecordBanner from "../RecordBanner";
import { useEffect, useRef, useState } from "react";

type Props = {
  onExit: () => void;
  onScore?: (score: number, difficulty?: string) => void;
  difficultyBests?: Record<string, number>;
  unit?: string;
};
type Phase      = "ready" | "playing" | "result";
type Op         = "+" | "-";
type Difficulty = "かんたん" | "ふつう" | "むずかしい";

// Box kinds:
//   pdigit_a = digit of operand a (in 筆算 board row a)
//   pop      = operator +/- (in 筆算 board row b, leftmost cell)
//   pdigit_b = digit of operand b (in 筆算 board row b)
//   adigit   = answer digit (in 筆算 board answer row)
//   acarry   = carry/borrow memo box (small, between answer columns)
//   fanswer  = full answer box on hint line (LAST active cell)
type BoxKind = "pdigit_a" | "pop" | "pdigit_b" | "adigit" | "acarry" | "fanswer";
interface Box { kind: BoxKind; label: string; correct: string; }

interface Question { a: number; b: number; op: Op; answer: number; }

const GAME_SECONDS  = 60;
const SCORE_CORRECT = 10;
const SCORE_WRONG   = -5;
const FEEDBACK_MS   = 1400;

// ── Helpers ───────────────────────────────────────────────────────────────────
function randInt(lo: number, hi: number) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
function getDigit(n: number, col: number): number {
  return Math.floor(n / Math.pow(10, col)) % 10;
}

// ── Problem generator ─────────────────────────────────────────────────────────
function makeQuestion(diff: Difficulty, prevAns = ""): Question {
  let a = 0, b = 0, op: Op = "+", answer = 0, tries = 0;
  do {
    if (diff === "かんたん") {
      // 2桁 ± 1桁、繰り上がり/繰り下がりなし
      // canAdd/canSub を先に判定してからopを選ぶ（逐次書き換えすると矛盾が生じるため）
      a = randInt(11, 99);
      b = randInt(1, 9);
      const onesA  = a % 10;
      const canAdd = onesA + b <= 9;
      const canSub = onesA >= b && a - b >= 1;
      if      (canAdd && canSub) op = Math.random() < 0.5 ? "+" : "-";
      else if (canAdd)           op = "+";
      else if (canSub)           op = "-";
      // else: どちらも不可 → whileで再試行
    } else if (diff === "ふつう") {
      a = randInt(11, 99); b = randInt(11, 99);
      op = Math.random() < 0.55 ? "+" : "-";
      if (op === "-" && a <= b) { const t = a; a = b; b = t; }
      if (op === "-" && a === b) a += randInt(1, 9);
    } else {
      a = randInt(101, 999); b = randInt(11, 99);
      op = Math.random() < 0.55 ? "+" : "-";
      if (op === "-" && a - b < 100) op = "+";
    }
    answer = op === "+" ? a + b : a - b;
    tries++;
  } while ((String(answer) === prevAns ||
            // かんたんの繰り上がり/繰り下がりチェック（再試行ガード）
            (diff === "かんたん" && op === "+" && (a % 10) + b > 9) ||
            (diff === "かんたん" && op === "-" && ((a % 10) < b || a - b < 1))
           ) && tries < 30);
  return { a, b, op, answer };
}

// ── Box computation ───────────────────────────────────────────────────────────
const DIGIT_LABELS = ["いちのくらい", "じゅうのくらい", "ひゃくのくらい", "せんのくらい"];

// Returns all boxes in this order:
//   [a digits L→R]  [op]  [b digits L→R]  [ans digits/carry L→R]  [fanswer]
// pCount = aLen + 1 + bLen  (fanswer is NOT part of pCount; it's the final box)
function computeAllBoxes(q: Question, showCarry: boolean): { boxes: Box[]; pCount: number } {
  const { a, b, op, answer } = q;
  const aStr = String(a);
  const bStr = String(b);
  const ansStr = String(answer);
  const n = ansStr.length;

  const colCarries = new Array<number>(n).fill(0);
  if (showCarry) {
    if (op === "+") {
      let carry = 0;
      for (let col = 0; col < n; col++) {
        const s = getDigit(a, col) + getDigit(b, col) + carry;
        carry = Math.floor(s / 10);
        if (col < n - 1) colCarries[col + 1] = carry;
      }
    } else {
      let borrow = 0;
      for (let col = 0; col < n; col++) {
        const d = getDigit(a, col) - getDigit(b, col) - borrow;
        borrow = d < 0 ? 1 : 0;
        if (col < n - 1) colCarries[col + 1] = borrow;
      }
    }
  }

  const boxes: Box[] = [];

  // a digits
  for (let i = 0; i < aStr.length; i++) {
    const col = aStr.length - 1 - i;
    boxes.push({ kind: "pdigit_a", label: DIGIT_LABELS[col] ?? `${col + 1}けため`, correct: aStr[i] });
  }
  // operator
  boxes.push({ kind: "pop", label: "きごう", correct: op });
  // b digits
  for (let i = 0; i < bStr.length; i++) {
    const col = bStr.length - 1 - i;
    boxes.push({ kind: "pdigit_b", label: DIGIT_LABELS[col] ?? `${col + 1}けため`, correct: bStr[i] });
  }
  const pCount = boxes.length; // aLen + 1 + bLen

  // answer digits with interleaved carry boxes
  for (let i = 0; i < n; i++) {
    const col = n - 1 - i;
    boxes.push({ kind: "adigit", label: DIGIT_LABELS[col] ?? `${col + 1}けため`, correct: ansStr[i] });
    if (showCarry && i < n - 1) {
      boxes.push({ kind: "acarry", label: op === "+" ? "くりあがり" : "くりさがり", correct: String(colCarries[col]) });
    }
  }

  // Final answer box — LAST (multi-digit, accumulates all digits of answer)
  boxes.push({ kind: "fanswer", label: "こたえ", correct: ansStr });

  return { boxes, pCount };
}

// A box is "filled" when it has a complete value
function isBoxFilled(bx: Box, val: string): boolean {
  if (bx.kind === "fanswer") return val.length === bx.correct.length;
  return val !== "";
}

// Traversal order:
//   problem L→R (0..pCount-1)
//   answer right-to-left (pCount..pCount+aBoxCount-1)
//   fanswer last (index = total-1)
// aBoxCount = total - 1 - pCount
function getOrder(pCount: number, aBoxCount: number, fanswerIdx: number): number[] {
  const prob    = Array.from({ length: pCount }, (_, i) => i);
  const ans     = Array.from({ length: aBoxCount }, (_, i) => pCount + aBoxCount - 1 - i);
  return [...prob, ...ans, fanswerIdx];
}

// ── HissanBoard: all cells interactive ───────────────────────────────────────
//
//   [5][4]          ← row a: interactive digit boxes
//   [+][2][7]       ← row b: interactive op box + digit boxes
//   ──────────
//   [8][¹][1]       ← answer row: digit boxes with carry spacers
//
function HissanBoard({ a, b, op, allBoxes, allValues, selIdx, allFbs, pCount, onSel }: {
  a: number; b: number; op: Op;
  allBoxes:  Box[];
  allValues: string[];
  selIdx:    number | null;
  allFbs:    (boolean | null)[];
  pCount:    number;
  onSel:     (globalIdx: number) => void;
}) {
  const aLen = String(a).length;
  const bLen = String(b).length;

  // Answer boxes are everything between pCount and the fanswer (last box)
  const fanswerIdx = allBoxes.length - 1;
  const ansBoxes   = allBoxes.slice(pCount, fanswerIdx); // adigit + acarry only
  const ansDigitList: { ansIdx: number }[] = [];
  ansBoxes.forEach((bx, ansIdx) => { if (bx.kind === "adigit") ansDigitList.push({ ansIdx }); });
  const ansDigitCount = ansDigitList.length;

  const cols   = Math.max(aLen, bLen, ansDigitCount);
  const padA   = cols - aLen;
  const padB   = cols - bLen;
  const padAns = cols - ansDigitCount;

  const CS  = "clamp(36px, 9vw, 52px)";
  const FS  = "clamp(27px, 6.8vw, 44px)";
  const KS  = "clamp(18px, 4.5vw, 24px)";
  const KF  = "clamp(12px, 3vw, 18px)";
  const GAP = "clamp(26px, 6.5vw, 34px)";

  const getC = (fb: boolean | null | undefined, isSel: boolean) => {
    const f = fb ?? null;
    return {
      bg:  f === true  ? "rgba(34,197,94,0.15)"
         : f === false ? "rgba(239,68,68,0.12)"
         : isSel       ? "rgba(37,99,235,0.10)" : "#fff",
      bdr: f === true  ? "#22c55e"
         : f === false ? "#ef4444"
         : isSel       ? "#2563eb" : "#bbb",
      txt: f === true  ? "#16a34a"
         : f === false ? "#dc2626"
         : isSel       ? "#2563eb" : "#1b1b1b",
    };
  };

  const emptyCell = <div style={{ width: CS, height: CS, flexShrink: 0, boxSizing: "border-box" as const }} />;
  const gapOnly   = <div style={{ width: GAP, flexShrink: 0 }} />;

  const renderDigitBox = (globalIdx: number, fs = FS) => {
    const val  = allValues[globalIdx] ?? "";
    const isSel = selIdx === globalIdx;
    const { bg, bdr, txt } = getC(allFbs[globalIdx], isSel);
    return (
      <div onClick={() => onSel(globalIdx)} style={{
        width: CS, height: CS, lineHeight: CS,
        textAlign: "center", fontWeight: 1000, fontSize: fs,
        fontFamily: "'M PLUS Rounded 1c', monospace",
        border: `3px ${!val ? "dashed" : "solid"} ${bdr}`,
        borderRadius: 10, background: bg,
        cursor: "pointer", flexShrink: 0,
        color: !val ? "transparent" : txt,
        userSelect: "none", boxSizing: "border-box",
        transition: "border-color 0.12s, background 0.12s",
        WebkitTapHighlightColor: "transparent",
      }}>
        {val || "0"}
      </div>
    );
  };

  return (
    <div style={{
      display: "inline-flex", flexDirection: "column", alignItems: "flex-end",
      background: "rgba(255,255,255,0.97)", borderRadius: 22,
      border: "3px solid rgba(124,58,237,0.18)",
      boxShadow: "0 12px 32px rgba(124,58,237,0.12)",
      padding: "14px 18px", boxSizing: "border-box",
    }}>

      {/* ── Row A ── */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {emptyCell}
        {Array.from({ length: cols }, (_, colIdx) => {
          const localIdx = colIdx - padA;
          const isLast   = colIdx === cols - 1;
          return (
            <React.Fragment key={colIdx}>
              {localIdx < 0 ? emptyCell : renderDigitBox(localIdx /* a digits at 0..aLen-1 */)}
              {!isLast && gapOnly}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Row B (op + b digits) ── */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {/* Op interactive box */}
        {(() => {
          const gi  = aLen;
          const val = allValues[gi] ?? "";
          const isSel = selIdx === gi;
          const { bg, bdr, txt } = getC(allFbs[gi], isSel);
          return (
            <div onClick={() => onSel(gi)} style={{
              width: CS, height: CS, lineHeight: CS,
              textAlign: "center", fontWeight: 1000,
              fontSize: "clamp(22px, 5.5vw, 38px)",
              fontFamily: "'M PLUS Rounded 1c', monospace",
              border: `3px ${!val ? "dashed" : "solid"} ${bdr}`,
              borderRadius: 10, background: bg,
              cursor: "pointer", flexShrink: 0,
              color: !val ? "transparent" : txt,
              userSelect: "none", boxSizing: "border-box",
              transition: "border-color 0.12s, background 0.12s",
              WebkitTapHighlightColor: "transparent",
            }}>
              {val || op}
            </div>
          );
        })()}
        {/* B digit boxes */}
        {Array.from({ length: cols }, (_, colIdx) => {
          const localIdx = colIdx - padB;
          const isLast   = colIdx === cols - 1;
          const gi       = aLen + 1 + localIdx; // b digits at aLen+1..aLen+bLen
          return (
            <React.Fragment key={colIdx}>
              {localIdx < 0 ? emptyCell : renderDigitBox(gi)}
              {!isLast && gapOnly}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Dividing line ── */}
      <div style={{ height: 4, width: "100%", background: "#444", borderRadius: 2, margin: "6px 0" }} />

      {/* ── Answer row ── */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {emptyCell}
        {/* Padding cells */}
        {Array.from({ length: padAns }, (_, i) => (
          <React.Fragment key={`pa${i}`}>{emptyCell}{gapOnly}</React.Fragment>
        ))}
        {/* Answer digit boxes with carry spacers */}
        {ansDigitList.map(({ ansIdx }, j) => {
          const globalI = pCount + ansIdx;
          const isLast  = j === ansDigitList.length - 1;
          const val     = allValues[globalI] ?? "";
          const isSel   = selIdx === globalI;
          const { bg, bdr, txt } = getC(allFbs[globalI], isSel);

          const nextInAns = ansBoxes[ansIdx + 1];
          const cBx      = !isLast && nextInAns?.kind === "acarry" ? nextInAns : null;
          const cGlobalI = pCount + ansIdx + 1;
          const cVal     = cBx ? (allValues[cGlobalI] ?? "") : "";
          const cSel     = cBx !== null && selIdx === cGlobalI;
          const { bg: cBg, bdr: cBdr, txt: cTxt } = getC(cBx ? allFbs[cGlobalI] : null, cSel);

          return (
            <React.Fragment key={j}>
              <div onClick={() => onSel(globalI)} style={{
                width: CS, height: CS, lineHeight: CS,
                textAlign: "center", fontWeight: 1000, fontSize: FS,
                fontFamily: "'M PLUS Rounded 1c', monospace",
                border: `3px ${!val ? "dashed" : "solid"} ${bdr}`,
                borderRadius: 10, background: bg,
                cursor: "pointer", flexShrink: 0,
                color: !val ? "transparent" : txt,
                userSelect: "none", boxSizing: "border-box",
                transition: "border-color 0.12s, background 0.12s",
                WebkitTapHighlightColor: "transparent",
              }}>
                {val || "0"}
              </div>
              {!isLast && (
                <div style={{
                  width: GAP, flexShrink: 0, alignSelf: "stretch",
                  display: "flex", alignItems: "flex-start", justifyContent: "center",
                }}>
                  {cBx && (
                    <div onClick={() => onSel(cGlobalI)} style={{
                      width: KS, height: KS, lineHeight: KS,
                      textAlign: "center", fontWeight: 1000, fontSize: KF,
                      fontFamily: "'M PLUS Rounded 1c', monospace",
                      border: `2.5px ${!cVal ? "dashed" : "solid"} ${cBdr}`,
                      borderRadius: 7, background: cBg, cursor: "pointer",
                      color: !cVal ? "transparent" : cTxt,
                      userSelect: "none", boxSizing: "border-box",
                      transition: "border-color 0.12s, background 0.12s",
                      WebkitTapHighlightColor: "transparent",
                    }}>
                      {cVal || "0"}
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HissanGame({ onExit, onScore, difficultyBests, unit = "てん" }: Props) {
  const [phase,         setPhase]         = useState<Phase>("ready");
  const [diff,          setDiff]          = useState<Difficulty>("ふつう");
  const [frozenBest,    setFrozenBest]    = useState<number | undefined>(undefined);
  const [timeLeftMs,    setTimeLeftMs]    = useState(GAME_SECONDS * 1000);
  const [score,         setScore]         = useState(0);
  const [correctCount,  setCorrectCount]  = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [question,      setQuestion]      = useState<Question | null>(null);
  const [allBoxes,      setAllBoxes]      = useState<Box[]>([]);
  const [allValues,     setAllValues]     = useState<string[]>([]);
  const [selIdx,        setSelIdx]        = useState<number | null>(null);
  const [allFbs,        setAllFbs]        = useState<(boolean | null)[]>([]);
  const [pCount,        setPCount]        = useState(0);
  const [feedback,      setFeedback]      = useState<{ ok: boolean; correct: number } | null>(null);

  const feedbackTimerRef = useRef<number | null>(null);
  const prevAnsRef       = useRef("");
  const phaseRef         = useRef<Phase>("ready");
  const scoreRef         = useRef(0);
  const diffRef          = useRef<Difficulty>("ふつう");

  phaseRef.current = phase;
  scoreRef.current = score;
  diffRef.current  = diff;

  const clearFB = () => {
    if (feedbackTimerRef.current != null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  };
  useEffect(() => () => clearFB(), []);

  // Timer
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

  // Report score
  useEffect(() => {
    if (phase === "result") onScore?.(scoreRef.current, diffRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const loadQuestion = (d: Difficulty, prevAns = "") => {
    const q         = makeQuestion(d, prevAns);
    prevAnsRef.current = String(q.answer);
    const showCarry = d !== "かんたん";
    const { boxes, pCount: pc } = computeAllBoxes(q, showCarry);
    setQuestion(q);
    setAllBoxes(boxes);
    setPCount(pc);
    setAllValues(new Array(boxes.length).fill(""));
    setAllFbs(new Array(boxes.length).fill(null));
    setSelIdx(0);
  };

  const nextQuestion = () => loadQuestion(diffRef.current, prevAnsRef.current);

  const startGame = (d: Difficulty) => {
    clearFB();
    setFrozenBest(difficultyBests?.[d]);
    setDiff(d);
    diffRef.current = d;
    const newScore = 0;
    setScore(newScore);
    scoreRef.current = newScore;
    setCorrectCount(0);
    setAnsweredCount(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    setFeedback(null);
    prevAnsRef.current = "";
    setPhase("playing");
    loadQuestion(d, "");
  };

  const goResult = () => { clearFB(); setFeedback(null); setPhase("result"); };

  const pushValue = (v: string) => {
    if (phase !== "playing" || feedback || selIdx === null) return;
    const bx = allBoxes[selIdx];
    if (!bx) return;

    const newVals = [...allValues];

    if (bx.kind === "fanswer") {
      // Accumulate digits up to correct answer length
      const n = parseInt(v, 10);
      if (isNaN(n)) return;
      const current = allValues[selIdx] || "";
      if (current.length >= bx.correct.length) return;
      newVals[selIdx] = current + v;
      setAllValues(newVals);
      // Auto-advance only after fully entered
      if (newVals[selIdx].length === bx.correct.length) {
        const fanswerIdx = allBoxes.length - 1;
        const aBoxCount  = fanswerIdx - pCount;
        const order      = getOrder(pCount, aBoxCount, fanswerIdx);
        const pos        = order.indexOf(selIdx);
        const next       = [...order.slice(pos + 1), ...order.slice(0, pos)]
          .find(i => !isBoxFilled(allBoxes[i], newVals[i] || ""));
        if (next !== undefined) setSelIdx(next);
      }
      return;
    }

    if (bx.kind === "pop") {
      if (v !== "+" && v !== "-") return;
    } else {
      const n = parseInt(v, 10);
      if (isNaN(n)) return;
      if (bx.kind === "acarry" && n > 1) return;
    }

    newVals[selIdx] = v;
    setAllValues(newVals);

    const fanswerIdx = allBoxes.length - 1;
    const aBoxCount  = fanswerIdx - pCount;
    const order      = getOrder(pCount, aBoxCount, fanswerIdx);
    const pos        = order.indexOf(selIdx);
    const next       = [...order.slice(pos + 1), ...order.slice(0, pos)]
      .find(i => !isBoxFilled(allBoxes[i], newVals[i] || ""));
    if (next !== undefined) setSelIdx(next);
  };

  const backspace = () => {
    if (phase !== "playing" || feedback || selIdx === null) return;
    const bx = allBoxes[selIdx];
    if (!bx) return;
    const newVals = [...allValues];
    if (bx.kind === "fanswer") {
      newVals[selIdx] = (allValues[selIdx] || "").slice(0, -1);
    } else {
      newVals[selIdx] = "";
    }
    setAllValues(newVals);
  };

  const submit = () => {
    if (phase !== "playing" || feedback || !question) return;
    const allFilled = allBoxes.length > 0 && allBoxes.every((bx, i) => isBoxFilled(bx, allValues[i] || ""));
    if (!allFilled) {
      const fanswerIdx = allBoxes.length - 1;
      const aBoxCount  = fanswerIdx - pCount;
      const order      = getOrder(pCount, aBoxCount, fanswerIdx);
      const firstEmpty = order.find(i => !isBoxFilled(allBoxes[i], allValues[i] || ""));
      if (firstEmpty !== undefined) setSelIdx(firstEmpty);
      return;
    }
    const newFbs = allBoxes.map((bx, i) => allValues[i] === bx.correct);
    const ok     = newFbs.every(f => f === true);
    const newScore = ok
      ? scoreRef.current + SCORE_CORRECT
      : Math.max(0, scoreRef.current + SCORE_WRONG);
    scoreRef.current = newScore;
    setScore(newScore);
    setAnsweredCount(c => c + 1);
    if (ok) setCorrectCount(c => c + 1);
    setAllFbs(newFbs);
    setFeedback({ ok, correct: question.answer });
    clearFB();
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      setAllFbs([]);
      nextQuestion();
    }, FEEDBACK_MS);
  };

  // ── Ready ──────────────────────────────────────────────────────────────────
  if (phase === "ready") {
    return (
      <Shell title="ひっさんゲーム" onExit={onExit}>
        <div style={{ ...panel, width: "100%", maxWidth: "none", textAlign: "left" }}>
          <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8, filter: "drop-shadow(0 4px 8px rgba(124,58,237,0.2))" }}>✏️</div>
          <div style={{ fontSize: 18, fontWeight: 1000, textAlign: "center", color: "#7c3aed", marginBottom: 4 }}>
            ますを えらんで すうじを いれよう！
          </div>
          <div style={{ fontSize: 13, opacity: 0.7, textAlign: "center", marginBottom: 18 }}>
            せいかい +{SCORE_CORRECT}{unit}　まちがい {SCORE_WRONG}{unit}　60びょう
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {(["かんたん", "ふつう", "むずかしい"] as Difficulty[]).map((d, i) => {
              const colors = ["#22c55e", "#f59e0b", "#ef4444"];
              const emojis = ["⭐", "🌟", "💫"];
              const subs   = ["2けた ± 1けた  くりあがりなし", "2けた ± 2けた  くりあがりあり", "3けた ± 2けた  くりあがりあり"];
              const color  = colors[i];
              const best   = difficultyBests?.[d];
              return (
                <button key={d} onClick={() => startGame(d)} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 16px", borderRadius: 18, border: `2.5px solid ${color}44`,
                  background: `${color}12`, cursor: "pointer", width: "100%", textAlign: "left",
                  boxShadow: `0 4px 12px ${color}22`,
                }}
                  onPointerDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                  onPointerUp={e => (e.currentTarget.style.transform = "scale(1)")}
                  onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <span style={{ fontSize: 28 }}>{emojis[i]}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 17, fontWeight: 1000, color }}>{d}</span>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 900, opacity: 0.6 }}>{subs[i]}</span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 900, color, opacity: 0.85, whiteSpace: "nowrap" }}>
                    {best != null ? `🏆 ${best}${unit}` : `--- ${unit}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Shell>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  if (phase === "result") {
    const s = score;
    const resultEmoji = s >= 100 ? "🏆" : s >= 50 ? "🎊" : s >= 20 ? "😊" : "💪";
    const resultMsg   = s >= 100 ? "パーフェクト！" : s >= 50 ? "よくできました！" : s >= 20 ? "がんばったね！" : "つぎは がんばろう！";
    return (
      <Shell title="けっか" onExit={onExit}>
        <div style={{ ...panel, width: "100%", maxWidth: "none", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 4 }}>{resultEmoji}</div>
          <div style={{ fontSize: 22, fontWeight: 1000, color: "#7c3aed", marginBottom: 12 }}>{resultMsg}</div>
          <div style={{ fontSize: 28, fontWeight: 1000, marginBottom: 4 }}>{s} {unit}</div>
          <div style={{ fontSize: 16, opacity: 0.8, marginBottom: 16 }}>
            せいかい {correctCount} もん　／　こたえた {answeredCount} もん
          </div>
          <RecordBanner score={s} prevBest={frozenBest} unit={unit} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
            <button style={primaryBtn} onClick={() => startGame(diff)}>もういっかい</button>
            <button style={secondaryBtn} onClick={() => setPhase("ready")}>むずかしさを えらぶ</button>
            <button style={secondaryBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────
  const seconds      = Math.ceil(timeLeftMs / 1000);
  const timerWarning = seconds <= 10;
  const blocked      = !!feedback;
  const allFilled    = allBoxes.length > 0 && allBoxes.every((bx, i) => isBoxFilled(bx, allValues[i] || ""));
  const selBox       = selIdx !== null ? allBoxes[selIdx] : null;
  const isCarrySel   = selBox?.kind === "acarry";
  const isOpSel      = selBox?.kind === "pop";

  // fanswer box index and value (always the last box)
  const fanswerIdx  = allBoxes.length - 1;
  const fanswerBx   = allBoxes[fanswerIdx];
  const fanswerVal  = allValues[fanswerIdx] || "";
  const fanswerSel  = !blocked && selIdx === fanswerIdx;
  const fanswerFb   = allFbs[fanswerIdx] ?? null;
  const fanswerGetC = () => {
    const f = fanswerFb;
    return {
      bg:  f === true  ? "rgba(34,197,94,0.15)"
         : f === false ? "rgba(239,68,68,0.12)"
         : fanswerSel  ? "rgba(37,99,235,0.10)" : "#fff",
      bdr: f === true  ? "#22c55e"
         : f === false ? "#ef4444"
         : fanswerSel  ? "#2563eb" : "#bbb",
      txt: f === true  ? "#16a34a"
         : f === false ? "#dc2626"
         : fanswerSel  ? "#2563eb" : "#1b1b1b",
    };
  };

  const getHint = () => {
    if (blocked || !selBox) return "";
    if (selBox.kind === "pop")     return "「＋」か「－」を えらんでね";
    if (selBox.kind === "fanswer") return "さいごに こたえを いれよう";
    return `「${selBox.label}」に すうじを いれよう`;
  };

  return (
    <Shell title="ひっさんゲーム" onExit={onExit}
      rightExtra={<button style={secondaryBtn} onClick={goResult}>けっかへ</button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>

        {/* Top bar */}
        <div style={topBar}>
          <div style={{ fontSize: 17, fontWeight: 1000, color: timerWarning ? "#ef4444" : undefined }}>
            {timerWarning ? "⏰ " : "⏱ "}{seconds}びょう
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, opacity: 0.7 }}>{diff}</div>
          <div style={{ fontSize: 17, fontWeight: 1000 }}>⭐ {score}{unit}</div>
        </div>

        {/* ── Hint line: {a} {op} {b} ＝ [fanswer_box] ── */}
        {question && fanswerBx && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <div style={{ fontSize: 22, fontWeight: 1000, color: "#7c3aed", letterSpacing: "0.06em", userSelect: "none" }}>
              {question.a} {question.op} {question.b} ＝
            </div>
            {/* Final answer box — wider to hold multi-digit answer */}
            {(() => {
              const { bg, bdr, txt } = fanswerGetC();
              const maxLen = fanswerBx.correct.length;
              // width scales with answer digit count
              const boxW = `clamp(${36 + (maxLen - 1) * 28}px, ${9 + (maxLen - 1) * 7}vw, ${52 + (maxLen - 1) * 40}px)`;
              return (
                <div onClick={() => !blocked && setSelIdx(fanswerIdx)} style={{
                  width: boxW, height: "clamp(36px, 9vw, 52px)",
                  lineHeight: "clamp(36px, 9vw, 52px)",
                  textAlign: "center", fontWeight: 1000,
                  fontSize: "clamp(22px, 5.5vw, 38px)",
                  fontFamily: "'M PLUS Rounded 1c', monospace",
                  border: `3px ${!fanswerVal ? "dashed" : "solid"} ${bdr}`,
                  borderRadius: 10, background: bg,
                  cursor: blocked ? "default" : "pointer", flexShrink: 0,
                  color: !fanswerVal ? "transparent" : txt,
                  userSelect: "none", boxSizing: "border-box",
                  transition: "border-color 0.12s, background 0.12s",
                  WebkitTapHighlightColor: "transparent",
                }}>
                  {fanswerVal || "0".repeat(maxLen)}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Unified 筆算 board ── */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {question && (
            <HissanBoard
              a={question.a} b={question.b} op={question.op}
              allBoxes={allBoxes}
              allValues={allValues}
              selIdx={blocked ? null : selIdx}
              allFbs={allFbs}
              pCount={pCount}
              onSel={blocked ? () => {} : (i) => setSelIdx(i)}
            />
          )}
        </div>

        {/* Hint */}
        <div style={{
          textAlign: "center", fontSize: 13, fontWeight: 900,
          color: selBox ? "#2563eb" : "#aaa", minHeight: 20,
        }}>
          {getHint()}
        </div>

        {/* Keypad */}
        {isOpSel ? (
          <div style={{ display: "grid", gap: 7 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {([["＋", "+"], ["－", "-"]] as const).map(([label, v]) => (
                <button key={v} onClick={() => pushValue(v)}
                  style={{ ...keyBtn, fontSize: 40, opacity: blocked ? 0.3 : 1, pointerEvents: blocked ? "none" : "auto" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
              <button onClick={backspace}
                style={{ ...keyBtn, fontSize: 22, opacity: blocked ? 0.3 : 1, pointerEvents: blocked ? "none" : "auto" }}>⌫</button>
              <div />
              <button onClick={submit}
                style={{ ...primaryBtn, padding: "12px 10px", fontSize: 16,
                  opacity: blocked || !allFilled ? 0.4 : 1,
                  pointerEvents: blocked || !allFilled ? "none" : "auto" }}>
                こたえる
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 7 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
              {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(d => {
                const invalid = isCarrySel && d > 1;
                return (
                  <button key={d} onClick={() => pushValue(String(d))}
                    style={{ ...keyBtn,
                      opacity: blocked || invalid ? 0.3 : 1,
                      pointerEvents: blocked || invalid ? "none" : "auto" }}>
                    {d}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
              <button onClick={backspace}
                style={{ ...keyBtn, fontSize: 22, opacity: blocked ? 0.3 : 1, pointerEvents: blocked ? "none" : "auto" }}>⌫</button>
              <button onClick={() => pushValue("0")}
                style={{ ...keyBtn, opacity: blocked ? 0.3 : 1, pointerEvents: blocked ? "none" : "auto" }}>0</button>
              <button onClick={submit}
                style={{ ...primaryBtn, padding: "12px 10px", fontSize: 16,
                  opacity: blocked || !allFilled ? 0.4 : 1,
                  pointerEvents: blocked || !allFilled ? "none" : "auto" }}>
                こたえる
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feedback overlay */}
      {feedback && createPortal(
        <>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(255,255,255,0.65)", zIndex: 99998 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 99999, width: "min(380px, 86vw)",
            borderRadius: 22, border: "3px solid rgba(255,170,220,0.55)",
            background: "rgba(255,255,255,0.97)",
            boxShadow: "0 20px 60px rgba(255,63,167,0.22)",
            padding: "24px 20px", textAlign: "center",
            fontFamily: "ui-rounded, system-ui, 'Hiragino Maru Gothic ProN', 'M PLUS Rounded 1c', sans-serif",
          }}>
            <div style={{ fontSize: 72, fontWeight: 1000, lineHeight: 1, marginBottom: 10,
              color: feedback.ok ? "#22c55e" : "#ef4444" }}>
              {feedback.ok ? "○" : "×"}
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#1b1b1b", marginBottom: 10 }}>
              {feedback.ok ? "せいかい！" : "ざんねん…"}
            </div>
            {!feedback.ok && (
              <div style={{ fontSize: 17, color: "#555" }}>
                こたえ：<strong style={{ color: "#ef4444" }}>{feedback.correct}</strong>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </Shell>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────────
function Shell({ title, onExit, children, rightExtra }: {
  title: string; onExit: () => void; children: React.ReactNode; rightExtra?: React.ReactNode;
}) {
  return (
    <div style={stageFixed}>
      <div style={sparkles} aria-hidden />
      <div style={card}>
        <div style={headerRow}>
          <h1 style={titleSt}>{title}</h1>
          <div style={headerBtns}>
            {rightExtra}
            <button style={kidHeaderBtn} onClick={onExit}>メニューへ</button>
          </div>
        </div>
        <div style={{ marginTop: 10, minHeight: 0, flex: 1, overflow: "auto" }}>{children}</div>
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
  width: "min(560px, 100%)", height: "100%", maxHeight: "100%",
  borderRadius: 22, padding: 10, boxSizing: "border-box",
  background: "rgba(255,255,255,0.86)", border: "3px solid rgba(255,170,220,0.55)",
  boxShadow: "0 18px 44px rgba(255,120,180,0.18)",
  display: "flex", flexDirection: "column", overflow: "hidden",
};
const headerRow: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap", minWidth: 0,
};
const titleSt: React.CSSProperties = {
  margin: 0, fontWeight: 1000, fontSize: 22, color: "#ff3fa7",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
};
const headerBtns: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "nowrap", flexShrink: 0 };
const kidHeaderBtn: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 16, border: "2px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)", fontWeight: 1000, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
};
const topBar: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "10px 12px", borderRadius: 16, background: "rgba(255,255,255,0.92)",
  border: "3px solid rgba(120,214,255,0.25)", boxShadow: "0 10px 18px rgba(0,160,255,0.10)",
};
const panel: React.CSSProperties = {
  padding: 14, borderRadius: 18, border: "3px solid rgba(80,200,255,0.25)",
  background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 22px rgba(0,160,255,0.10)", boxSizing: "border-box",
};
const primaryBtn: React.CSSProperties = {
  padding: "12px 16px", borderRadius: 18, border: "3px solid rgba(255,63,167,0.18)",
  background: "linear-gradient(180deg, rgba(255,120,200,0.95), rgba(255,63,167,0.92))",
  color: "#fff", fontWeight: 1000, fontSize: 18, cursor: "pointer",
  boxShadow: "0 12px 22px rgba(255,63,167,0.18)",
};
const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 18, border: "3px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)", fontWeight: 1000, cursor: "pointer", fontSize: 14,
};
const keyBtn: React.CSSProperties = {
  padding: "14px 12px", borderRadius: 18, border: "3px solid rgba(0,0,0,0.06)",
  background: "rgba(255,255,255,0.92)", cursor: "pointer", boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
  fontSize: 26, fontWeight: 1000, userSelect: "none",
};
