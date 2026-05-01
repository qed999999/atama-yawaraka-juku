import RecordBanner from "../RecordBanner";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };

type Item = {
  id: string;
  label: string;
  colorSrc: string;
  silhouetteSrc: string;
};

type Question = {
  answerId: string;
  silhouetteSrc: string;
  choices: Item[];
};

const GAME_SECONDS = 60;
const FEEDBACK_MS = 2000;

const SCORE_CORRECT = 10;
const SCORE_WRONG = -5;

const ROTATE_STEP_DEG_PER_SEC = 50;

const MOVE_START_CORRECT = 5;
const MOVE_SPEED_BASE_PX_PER_SEC = 140;
const MOVE_SPEED_STEP_PX_PER_SEC = 80;

export default function SilhouetteGame({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const items = useMemo<Item[]>(() => demoItems, []);
  const [phase, setPhase] = useState<"ready" | "playing" | "result">("ready");
  const [initialBest] = useState(() => prevBest);

  const [rotation, setRotation] = useState(0);

  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);

  const [question, setQuestion] = useState<Question | null>(null);

  const [feedback, setFeedback] = useState<null | { ok: boolean; answerLabel: string }>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const prevAnswerRef = useRef("");

  const boxRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [movePos, setMovePos] = useState({ x: 0, y: 0 });
  const movePosRef = useRef({ x: 0, y: 0 });
  const moveVelRef = useRef({ vx: MOVE_SPEED_BASE_PX_PER_SEC, vy: MOVE_SPEED_BASE_PX_PER_SEC });

  const isMoving = phase === "playing" && correctCount >= MOVE_START_CORRECT && !feedback;

  const moveLevel =
    correctCount >= MOVE_START_CORRECT ? 1 + Math.floor((correctCount - MOVE_START_CORRECT) / 5) : 0;

  const moveSpeed =
    moveLevel > 0 ? MOVE_SPEED_BASE_PX_PER_SEC + (moveLevel - 1) * MOVE_SPEED_STEP_PX_PER_SEC : 0;

  const randDir = () => (Math.random() < 0.5 ? -1 : 1);

  useEffect(() => {
    if (phase === "result") onScore?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ===== カウントダウン =====
  useEffect(() => {
    if (phase !== "playing") return;

    const startedAt = performance.now();
    const startLeft = timeLeftMs;

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const left = Math.max(0, startLeft - elapsed);
      setTimeLeftMs(left);

      if (left <= 0) {
        setPhase("result");
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ===== 回転 =====
  useEffect(() => {
    if (phase !== "playing") return;

    let rafId: number;
    let last = performance.now();

    const rotate = (now: number) => {
      const deltaMs = now - last;
      last = now;

      const level = Math.floor(correctCount / 3);
      const speedDegPerSec = level * ROTATE_STEP_DEG_PER_SEC;

      if (speedDegPerSec > 0 && !feedback) {
        setRotation((r) => (r + (deltaMs * speedDegPerSec) / 1000) % 360);
      } else {
        setRotation(0);
      }

      rafId = requestAnimationFrame(rotate);
    };

    rafId = requestAnimationFrame(rotate);
    return () => cancelAnimationFrame(rafId);
  }, [phase, correctCount, feedback]);

  useEffect(() => setRotation(0), [questionIndex]);

  // ===== 移動開始時：中央寄せ =====
  useEffect(() => {
    if (!isMoving) return;

    const box = boxRef.current;
    const img = imgRef.current;
    if (!box || !img) return;

    const boxW = box.clientWidth;
    const boxH = box.clientHeight;

    const imgW = img.offsetWidth;
    const imgH = img.offsetHeight;

    const maxX = Math.max(0, boxW - imgW);
    const maxY = Math.max(0, boxH - imgH);

    const startX = maxX / 2;
    const startY = maxY / 2;

    movePosRef.current = { x: startX, y: startY };
    setMovePos({ x: startX, y: startY });

    const dirX = randDir();
    const dirY = randDir();

    moveVelRef.current = { vx: dirX * moveSpeed, vy: dirY * moveSpeed };
  }, [isMoving, questionIndex, moveSpeed]);

  // レベルアップ時：速度だけ更新
  useEffect(() => {
    if (!isMoving) return;
    const { vx, vy } = moveVelRef.current;
    const sx = Math.sign(vx) || randDir();
    const sy = Math.sign(vy) || randDir();
    moveVelRef.current = { vx: sx * moveSpeed, vy: sy * moveSpeed };
  }, [isMoving, moveSpeed]);

  // ===== 枠内移動 =====
  useEffect(() => {
    if (phase !== "playing") return;
    if (!isMoving) return;

    let rafId: number;
    let last = performance.now();

    const step = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;

      if (!feedback) {
        const box = boxRef.current;
        const img = imgRef.current;

        if (box && img) {
          const boxW = box.clientWidth;
          const boxH = box.clientHeight;

          const imgW = img.offsetWidth;
          const imgH = img.offsetHeight;

          const maxX = Math.max(0, boxW - imgW);
          const maxY = Math.max(0, boxH - imgH);

          let { x, y } = movePosRef.current;
          let { vx, vy } = moveVelRef.current;

          x += vx * delta;
          y += vy * delta;

          if (x <= 0) {
            x = 0;
            vx = Math.abs(vx);
          } else if (x >= maxX) {
            x = maxX;
            vx = -Math.abs(vx);
          }

          if (y <= 0) {
            y = 0;
            vy = Math.abs(vy);
          } else if (y >= maxY) {
            y = maxY;
            vy = -Math.abs(vy);
          }

          moveVelRef.current = { vx, vy };
          movePosRef.current = { x, y };
          setMovePos({ x, y });
        }
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [phase, isMoving, feedback]);

  const clearFeedbackTimer = () => {
    if (feedbackTimerRef.current != null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  };

  useEffect(() => () => clearFeedbackTimer(), []);

  const startGame = () => {
    clearFeedbackTimer();
    setScore(0);
    setCorrectCount(0);
    setQuestionIndex(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    prevAnswerRef.current = "";
    setPhase("playing");

    movePosRef.current = { x: 0, y: 0 };
    setMovePos({ x: 0, y: 0 });
    moveVelRef.current = { vx: MOVE_SPEED_BASE_PX_PER_SEC, vy: MOVE_SPEED_BASE_PX_PER_SEC };
  };

  const goResult = () => {
    clearFeedbackTimer();
    setFeedback(null);
    setPhase("result");
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const q = makeQuestion(items, prevAnswerRef.current);
    prevAnswerRef.current = q.answerId;
    setQuestion(q);
  }, [phase, questionIndex, items]);

  const pick = (pickedId: string) => {
    if (phase !== "playing") return;
    if (!question) return;
    if (feedback) return;

    const ok = pickedId === question.answerId;
    const answerItem =
      question.choices.find((c) => c.id === question.answerId) ?? items.find((i) => i.id === question.answerId);

    if (ok) {
      setScore((s) => s + SCORE_CORRECT);
      setCorrectCount((c) => c + 1);
    } else {
      setScore((s) => Math.max(0, s + SCORE_WRONG));
    }

    setFeedback({ ok, answerLabel: answerItem?.label ?? "" });

    clearFeedbackTimer();
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      setQuestionIndex((i) => i + 1);
    }, FEEDBACK_MS);
  };

  // ========= UI =========

  if (phase === "ready") {
    return (
      <KidShell title="シルエットあて" onExit={onExit}>
        <div style={{ ...kidPanel, textAlign: "left" }}>
          <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 8 }}>シルエットは なにかな？</div>
          <div style={{ fontSize: 16, fontWeight: 900, opacity: 0.95, marginBottom: 10 }}>
            {GAME_SECONDS}びょうで どれだけ あてられる？
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "nowrap" }}>
            <button style={kidPrimaryBtn} onClick={startGame}>
              スタート
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 900, opacity: 0.9 }}>
            せいかい：+{SCORE_CORRECT} / まちがい：{SCORE_WRONG}
          </div>
        </div>
      </KidShell>
    );
  }

  if (phase === "result") {
    return (
      <KidShell title="けっか" onExit={onExit}>
        <div style={kidPanel}>
          <div style={{ fontSize: 24, fontWeight: 1000, marginBottom: 6 }}>おつかれさま！</div>
          <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 6 }}>スコア：{score}</div>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>せいかい：{correctCount}</div>

          <RecordBanner score={score} prevBest={initialBest} unit={unit} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "nowrap" }}>
            <button style={kidPrimaryBtn} onClick={startGame}>
              もういっかい
            </button>
          </div>
        </div>
      </KidShell>
    );
  }

  // playing
  const seconds = Math.ceil(timeLeftMs / 1000);

  // ✅ “1画面固定”のため、縦に応じて自動で縮む高さにする
  const frameHeight = "clamp(220px, 42vh, 360px)";
  const frameMaxWidth = 560;

  // ✅ 選択肢が1行で入るように小さめに（縦も詰める）
  const choiceImgHeight = "clamp(72px, 12vh, 108px)";

  // 移動時は画像を少し小さめ
  const normalImgMax = 180;
  const movingImgMax = 150;

  return (
    <KidShell
      title="シルエットあて"
      onExit={onExit}
      rightExtra={
        <button style={kidHeaderBtn} onClick={goResult}>
          けっかへ
        </button>
      }
    >
      <div style={screenCol}>
        <div style={kidTopBarOneLine}>
          <span style={pillBlue}>のこり：{seconds}秒</span>
          <span style={pillPink}>スコア：{score}</span>
          <span style={pillPurple}>せいかい：{correctCount}</span>
        </div>

        <div style={kidPanelFlex}>
          {!question ? (
            <div style={{ fontWeight: 900 }}>よみこみ中…</div>
          ) : (
            <>
              <div style={silhouetteWrap}>
                <div
                  ref={boxRef}
                  style={{
                    width: "100%",
                    maxWidth: frameMaxWidth,
                    height: frameHeight,
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: 18,
                    border: "2px dashed rgba(0,0,0,0.10)",
                    background: "rgba(255,255,255,0.80)",
                    boxSizing: "border-box",
                  }}
                >
                  <img
                    ref={imgRef}
                    src={question.silhouetteSrc}
                    alt="silhouette"
                    style={{
                      width: "auto",
                      height: "auto",
                      maxWidth: isMoving ? movingImgMax : normalImgMax,
                      maxHeight: isMoving ? movingImgMax : normalImgMax,
                      position: "absolute",
                      left: isMoving ? 0 : "50%",
                      top: isMoving ? 0 : "50%",
                      objectFit: "contain",
                      transform: isMoving
                        ? `translate(${movePos.x}px, ${movePos.y}px) rotate(${feedback ? 0 : rotation}deg)`
                        : `translate(-50%, -50%) rotate(${feedback ? 0 : rotation}deg)`,
                      transition: feedback ? "transform 0.2s ease-out" : "none",
                      transformOrigin: "50% 50%",
                      userSelect: "none",
                      pointerEvents: "none",
                      display: "block",
                      margin: 0,
                      filter: "drop-shadow(0 10px 12px rgba(0,0,0,0.15))",
                    }}
                  />
                </div>
              </div>

              {/* ✅ 必ず1行（3列固定）。入らない場合は“縮めてでも”入れる */}
              <div style={choicesRowOneLine}>
                {question.choices.map((c, idx) => (
                  <button
                    key={c.id}
                    onClick={() => pick(c.id)}
                    style={{
                      ...kidChoiceBtnCompact,
                      borderColor: choiceBorderColors[idx % choiceBorderColors.length],
                      opacity: feedback ? 0.6 : 1,
                      pointerEvents: feedback ? "none" : "auto",
                    }}
                  >
                    <img
                      src={c.colorSrc}
                      alt={c.label}
                      style={{
                        width: "100%",
                        height: choiceImgHeight,
                        objectFit: "contain",
                        pointerEvents: "none",
                      }}
                    />
                    <div style={choiceLabelOneLine}>{c.label}</div>
                  </button>
                ))}
              </div>

              {feedback && (
                <div style={kidOverlay}>
                  <div style={kidFeedbackCard(feedback.ok)}>
                    <div style={{ fontSize: 72, fontWeight: 1000, lineHeight: 1, marginBottom: 6, color: feedback.ok ? "#22c55e" : "#ef4444", textShadow: "0 6px 18px rgba(255, 63, 167, 0.25)" }}>
                      {feedback.ok ? "○" : "×"}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
                      {feedback.ok ? "せいかい！" : "ざんねん！"}
                    </div>
                    {feedback.answerLabel && (
                      <div style={{ opacity: 0.9, fontSize: 15, fontWeight: 900, whiteSpace: "nowrap" }}>
                        こたえ：{feedback.answerLabel}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </KidShell>
  );
}

// ------ helpers ------
function makeQuestion(items: Item[], prev = ""): Question {
  let answer: Item;
  let tries = 0;
  do {
    answer = items[Math.floor(Math.random() * items.length)];
    tries++;
  } while (answer.id === prev && tries < 20);
  const others = shuffle(items.filter((i) => i.id !== answer.id)).slice(0, 2);
  const choices = shuffle([answer, ...others]);
  return { answerId: answer.id, silhouetteSrc: answer.silhouetteSrc, choices };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------ Kid UI (no-scroll, one-screen) ------
function KidShell({
  title,
  onExit,
  children,
  rightExtra,
}: {
  title: string;
  onExit: () => void;
  children: React.ReactNode;
  rightExtra?: React.ReactNode;
}) {
  return (
    <div style={stageFixedNoScroll}>
      <div style={sparkles} />

      <div style={cardNoScroll}>
        <div style={headerRowNoWrap}>
          <div style={titleNoWrap}>{title}</div>

          <div style={headerBtnsNoWrap}>
            {rightExtra}
            <button style={kidHeaderBtn} onClick={onExit}>
              メニューへ
            </button>
          </div>
        </div>

        <div style={contentNoScroll}>{children}</div>
      </div>
    </div>
  );
}

/** ✅ 画面固定 & スクロール禁止（iPhoneでも） */
const stageFixedNoScroll: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  overflow: "hidden",
  padding:
    "max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))",
  boxSizing: "border-box",
  background:
    "radial-gradient(circle at 15% 20%, rgba(255, 230, 109, 0.35), transparent 40%)," +
    "radial-gradient(circle at 85% 25%, rgba(255, 140, 189, 0.28), transparent 42%)," +
    "radial-gradient(circle at 20% 85%, rgba(120, 214, 255, 0.25), transparent 45%)," +
    "linear-gradient(180deg, #fff7fe 0%, #f1fbff 55%, #fffdf2 100%)",
  fontFamily:
    "ui-rounded, system-ui, -apple-system, 'Hiragino Maru Gothic ProN', 'M PLUS Rounded 1c', 'Noto Sans JP', sans-serif",
  color: "#1b1b1b",
  display: "grid",
  placeItems: "center",
};

const sparkles: React.CSSProperties = {
  position: "absolute",
  inset: -40,
  pointerEvents: "none",
  backgroundImage:
    "radial-gradient(circle, rgba(255, 255, 255, 0.95) 0 2px, transparent 3px), " +
    "radial-gradient(circle, rgba(255, 255, 255, 0.85) 0 1.5px, transparent 3px)",
  backgroundSize: "110px 110px, 160px 160px",
  backgroundPosition: "0 0, 40px 60px",
  opacity: 0.25,
};

const cardNoScroll: React.CSSProperties = {
  width: "min(980px, 100%)",
  height: "100%",
  maxHeight: "100%",
  borderRadius: 22,
  padding: 10,
  boxSizing: "border-box",
  background: "rgba(255, 255, 255, 0.86)",
  border: "3px solid rgba(255, 170, 220, 0.55)",
  boxShadow: "0 18px 44px rgba(255, 120, 180, 0.18)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerRowNoWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "nowrap",
  minWidth: 0,
};

const titleNoWrap: React.CSSProperties = {
  fontWeight: 1000,
  fontSize: 22,
  color: "#ff3fa7",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};

const headerBtnsNoWrap: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "nowrap",
  flexShrink: 0,
};

const kidHeaderBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 16,
  border: "2px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)",
  fontWeight: 1000,
  fontSize: 14,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const contentNoScroll: React.CSSProperties = {
  marginTop: 8,
  minHeight: 0,
  flex: 1,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const screenCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minHeight: 0,
  flex: 1,
};

const kidTopBarOneLine: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "nowrap",
  padding: "8px 10px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.75)",
  border: "2px solid rgba(0,0,0,0.06)",
  boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
  overflow: "hidden",
};

const pillBase: React.CSSProperties = {
  fontWeight: 1000,
  borderRadius: 999,
  padding: "6px 10px",
  border: "2px solid rgba(0,0,0,0.06)",
  background: "rgba(255,255,255,0.6)",
  whiteSpace: "nowrap",
  fontSize: 13,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const pillBlue: React.CSSProperties = {
  ...pillBase,
  background: "rgba(26, 168, 255, 0.10)",
  border: "2px solid rgba(26, 168, 255, 0.18)",
};
const pillPink: React.CSSProperties = {
  ...pillBase,
  background: "rgba(255, 63, 167, 0.10)",
  border: "2px solid rgba(255, 63, 167, 0.18)",
};
const pillPurple: React.CSSProperties = {
  ...pillBase,
  background: "rgba(124, 58, 237, 0.10)",
  border: "2px solid rgba(124, 58, 237, 0.18)",
};

const kidPanel: React.CSSProperties = {
  padding: 12,
  borderRadius: 18,
  border: "3px solid rgba(80, 200, 255, 0.25)",
  background: "rgba(255,255,255,0.92)",
  boxShadow: "0 12px 22px rgba(0, 160, 255, 0.10)",
  boxSizing: "border-box",
};

const kidPanelFlex: React.CSSProperties = {
  ...kidPanel,
  minHeight: 0,
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  overflow: "hidden",
};

const silhouetteWrap: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  flex: 1,
  minHeight: 0,
};

const choicesRowOneLine: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  flexShrink: 0,
};

const kidChoiceBtnCompact: React.CSSProperties = {
  padding: 8,
  borderRadius: 18,
  border: "3px solid rgba(0,0,0,0.06)",
  background: "rgba(255,255,255,0.90)",
  cursor: "pointer",
  boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  display: "grid",
  gap: 6,
  overflow: "hidden",
  minWidth: 0,
};

const choiceLabelOneLine: React.CSSProperties = {
  fontWeight: 1000,
  fontSize: 13,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const choiceBorderColors = ["rgba(255,99,177,0.35)", "rgba(26,168,255,0.35)", "rgba(245,158,11,0.35)"];

const kidPrimaryBtn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 18,
  border: "none",
  background: "linear-gradient(180deg, #ff73c6 0%, #ff3fa7 100%)",
  color: "#fff",
  fontWeight: 1000,
  fontSize: 16,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

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

// ------ demo data ------
const BASE = import.meta.env.BASE_URL;
declare const __BUILD_VERSION__: string;
const IMG_VER = __BUILD_VERSION__;

const demoItems: Item[] = [
  {
    id: "apple",
    label: "りんご",
    colorSrc: `${BASE}img/apple_color.png?v=${IMG_VER}`,
    silhouetteSrc: `${BASE}img/apple_silhouette.png?v=${IMG_VER}`,
  },
  {
    id: "car",
    label: "くるま",
    colorSrc: `${BASE}img/car_color.png?v=${IMG_VER}`,
    silhouetteSrc: `${BASE}img/car_silhouette.png?v=${IMG_VER}`,
  },
  {
    id: "fish",
    label: "さかな",
    colorSrc: `${BASE}img/fish_color.png?v=${IMG_VER}`,
    silhouetteSrc: `${BASE}img/fish_silhouette.png?v=${IMG_VER}`,
  },
  {
    id: "cat",
    label: "ねこ",
    colorSrc: `${BASE}img/cat_color.png?v=${IMG_VER}`,
    silhouetteSrc: `${BASE}img/cat_silhouette.png?v=${IMG_VER}`,
  },
  {
    id: "dog",
    label: "いぬ",
    colorSrc: `${BASE}img/dog_color.png?v=${IMG_VER}`,
    silhouetteSrc: `${BASE}img/dog_silhouette.png?v=${IMG_VER}`,
  },
  {
    id: "bus",
    label: "バス",
    colorSrc: `${BASE}img/bus_color.png?v=${IMG_VER}`,
    silhouetteSrc: `${BASE}img/bus_silhouette.png?v=${IMG_VER}`,
  },
  {
    id: "shark",
    label: "サメ",
    colorSrc: `${BASE}img/shark_color.png?v=${IMG_VER}`,
    silhouetteSrc: `${BASE}img/shark_silhouette.png?v=${IMG_VER}`,
  },
  {
    id: "bird",
    label: "とり",
    colorSrc: `${BASE}img/bird_color.png?v=${IMG_VER}`,
    silhouetteSrc: `${BASE}img/bird_silhouette.png?v=${IMG_VER}`,
  },
  {
    id: "airplane",
    label: "ひこうき",
    colorSrc: `${BASE}img/airplane_color.png?v=${IMG_VER}`,
    silhouetteSrc: `${BASE}img/airplane_silhouette.png?v=${IMG_VER}`,
  },
];
