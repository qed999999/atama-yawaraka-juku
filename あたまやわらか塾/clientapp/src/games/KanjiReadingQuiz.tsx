import RecordBanner from "../RecordBanner";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = { onExit: () => void; onScore?: (score: number) => void; prevBest?: number; unit?: string };

type Item = {
  id: string;
  kanji: string;   // 出題する漢字
  yomi: string;    // こたえ（ひらがな）
  hint?: string;   // ヒント（任意）
};

type Question = {
  answerId: string;
  kanji: string;
  hint?: string;
  choices: Item[]; // 3つ
};

const GAME_SECONDS = 60;
const FEEDBACK_MS = 2000;

const SCORE_CORRECT = 10;
const SCORE_WRONG = -5;

export default function KanjiReadingQuiz({ onExit, onScore, prevBest, unit = "てん" }: Props) {
  const items = useMemo<Item[]>(() => demoItems, []);
  const [phase, setPhase] = useState<"ready" | "playing" | "result">("ready");
  const [initialBest] = useState(() => prevBest);

  const [timeLeftMs, setTimeLeftMs] = useState(GAME_SECONDS * 1000);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [deck, setDeck] = useState<string[]>([]);
  const [deckPos, setDeckPos] = useState(0);
  const prevAnswerRef = useRef("");

  const [question, setQuestion] = useState<Question | null>(null);

  // ヒント：出題から5秒後に表示
  const [showHint, setShowHint] = useState(false);
  const hintTimerRef = useRef<number | null>(null);

  // フィードバック表示（正解/不正解）
  const [feedback, setFeedback] = useState<null | { ok: boolean; answerLabel: string }>(null);
  const feedbackTimerRef = useRef<number | null>(null);

    const clearHintTimer = () => {
        if (hintTimerRef.current != null) {
          window.clearTimeout(hintTimerRef.current);
          hintTimerRef.current = null;
        }
      };
    
      useEffect(() => {
        // 問題が変わったらヒントを隠して5秒後に表示
        clearHintTimer();
        setShowHint(false);
        if (phase !== "playing") return;
        if (!question) return;
        hintTimerRef.current = window.setTimeout(() => {
          setShowHint(true);
        }, 5000);
    
        return () => clearHintTimer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [question, phase]);
    
  useEffect(() => {
    if (phase === "result") onScore?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // カウントダウン（常に減り続ける）
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

  // phase開始時の初期化
  const startGame = () => {
    clearFeedbackTimer();
    setScore(0);
    setCorrectCount(0);
    setTimeLeftMs(GAME_SECONDS * 1000);
    prevAnswerRef.current = "";
    setPhase("playing");

    // 1ゲーム内で重複しないよう、開始時に全問題をシャッフルして順に出す
    const ids = shuffle(items.map((i) => i.id));
    setDeck(ids);
    setDeckPos(0);
  };

  const goResult = () => {
    clearFeedbackTimer();
    setFeedback(null);
    setPhase("result");
  };

  // 問題生成（indexが変わったら作る）
  useEffect(() => {
    if (phase !== "playing") return;
    if (deck.length === 0) return; // startGame直後など
    if (deckPos >= deck.length) {
        setPhase("result");
        return;
    }
    let pos = deckPos;
    if (deck[pos] === prevAnswerRef.current && pos + 1 < deck.length) {
      pos += 1;
      setDeckPos(pos);
      return;
    }
    const answerId = deck[pos];
    prevAnswerRef.current = answerId;
    setQuestion(makeQuestion(items, answerId));
  }, [phase, deck, deckPos, items]);

  const pick = (pickedId: string) => {
    if (phase !== "playing") return;
    if (!question) return;
    if (feedback) return; // フィードバック中は入力不可

    // ✅ クリックした瞬間にヒントを消して、次の問題のヒントが一瞬見えるのを防ぐ
    clearHintTimer();
    setShowHint(false);

    const ok = pickedId === question.answerId;
    const answerItem =
      question.choices.find((c) => c.id === question.answerId) ?? items.find((i) => i.id === question.answerId);

    if (ok) {
      setScore((s) => s + SCORE_CORRECT);
      setCorrectCount((c) => c + 1);
    } else {
      setScore((s) => Math.max(0, s + SCORE_WRONG));
    }

    setFeedback({ ok, answerLabel: answerItem?.yomi ?? "" });

    // 1秒後に次の問題
    clearFeedbackTimer();
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      setDeckPos((p) => p + 1);
    }, FEEDBACK_MS);
  };

  const clearFeedbackTimer = () => {
    if (feedbackTimerRef.current != null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  };

  useEffect(() => {
        return () => {
              clearFeedbackTimer();
              clearHintTimer();
            };    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI
  if (phase === "ready") {
    return (
      <Shell title="かんじ よみかた" onExit={onExit}>
        <div style={{ ...panel, width: "100%", maxWidth: "none", textAlign: "left" }}>
          <p style={{ margin: 0, fontSize: 18 }}>60びょうで どれだけ よめる？</p>
          <ul style={{ marginTop: 10, marginBottom: 18, lineHeight: 1.7 }}>
            <li>せいかい：+{SCORE_CORRECT}点</li>
            <li>まちがい：{SCORE_WRONG}点</li>
          </ul>
          <button style={primaryBtn} onClick={startGame}>
            スタート
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === "result") {
    return (
      <Shell title="けっか" onExit={onExit}>
        <div style={{ ...panel, width: "100%", maxWidth: "none" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>スコア：{score}</div>
          <div style={{ fontSize: 18, marginBottom: 16 }}>せいかい：{correctCount} もん</div>

          <RecordBanner score={score} prevBest={initialBest} unit={unit} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={primaryBtn} onClick={startGame}>
              もういっかい
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // playing
  const seconds = Math.ceil(timeLeftMs / 1000);

  const okColor = "#22c55e"; // green
  const ngColor = "#ef4444"; // red
  const markColor = feedback?.ok ? okColor : ngColor;

  return (
    <Shell
      title="かんじ よみかた"
      onExit={onExit}
      rightExtra={
        <button style={secondaryBtn} onClick={goResult}>
          けっかへ
        </button>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={topBar}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>のこり：{seconds}秒</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>スコア：{score}</div>
        </div>

        <div style={panel}>
          {!question ? (
            <div>読み込み中…</div>
          ) : (
            <>
              {/* ===== 漢字表示 ===== */}
              <div style={{ display: "grid", placeItems: "center", marginBottom: 12 }}>
                <div
                  style={{
                    width: "min(560px, 100%)",
                    height: 260,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 16,
                    border: "3px dashed rgba(255, 63, 167, 0.22)",
                    background: "rgba(255,255,255,0.92)",
                    boxShadow: "0 12px 22px rgba(255, 63, 167, 0.10)",
                    boxSizing: "border-box",
                    padding: 12,
                    textShadow: "0 10px 26px rgba(255, 63, 167, 0.18)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 110,
                      fontWeight: 1000,
                      lineHeight: 1,
                      textShadow: "0 12px 40px rgba(0,0,0,0.45)",
                      userSelect: "none",
                    }}
                    aria-label={`出題漢字: ${question.kanji}`}
                  >
                    {question.kanji}
                  </div>

                  {question.hint && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 14,
                        opacity: showHint ? 0.85 : 0,
                        transition: "opacity 400ms ease",
                      }}
                      aria-label="ヒント"
                    >
                      ヒント：{question.hint}
                    </div>
                  )}
                </div>
              </div>

              {/* ===== choices ===== */}
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                {question.choices.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pick(c.id)}
                    style={{
                      ...choiceBtn,
                      opacity: feedback ? 0.6 : 1,
                      pointerEvents: feedback ? "none" : "auto",
                      textAlign: "center",
                      padding: 14,
                    }}
                  >
                    <div style={{ fontSize: 28, fontWeight: 900 }}>{c.yomi}</div>
                  </button>
                ))}
              </div>

              {/* ===== ポップアップ（正解/不正解） ===== */}
              {feedback && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(255, 255, 255, 0.65)",
                    zIndex: 9999,
                    padding: 16,
                    boxSizing: "border-box",
                  }}
                >
<div
  style={{
    width: "min(520px, 92vw)",
    maxWidth: "calc(100vw - 32px)",
    borderRadius: 22,
    border: "3px solid rgba(255, 170, 220, 0.55)",
    background: "rgba(255,255,255,0.95)",
    boxShadow: "0 20px 60px rgba(255, 63, 167, 0.18)",
    padding: "20px 18px",
    textAlign: "center",
    color: "#1b1b1b",
    boxSizing: "border-box",
  }}
>
  <div
    style={{
      fontSize: 72,
      fontWeight: 1000,
      lineHeight: 1,
      marginBottom: 6,
      color: markColor,
      textShadow: "0 6px 18px rgba(255, 63, 167, 0.25)",
    }}
  >
    {feedback.ok ? "○" : "×"}
  </div>
  <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
    {feedback.ok ? "せいかい！" : "ざんねん！"}
  </div>
  <div style={{ fontSize: 16, opacity: 0.85 }}>
    こたえ：{feedback.answerLabel}
  </div>
</div>

                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

// ------ helpers ------

function makeQuestion(items: Item[], answerId: string): Question {
    const answer = items.find((i) => i.id === answerId) ?? items[0];

    // 選択肢が同じ読みにならないように（例: 木=き, 気=き）
    const othersPool = items.filter((i) => i.id !== answer.id && i.yomi !== answer.yomi);
    const others = shuffle(othersPool).slice(0, 2);
    const choices = shuffle([answer, ...others]);

  return {
    answerId: answer.id,
    kanji: answer.kanji,
    hint: answer.hint,
    choices,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------ UI wrappers ------

// ------ UI wrappers (KidShell: match SilhouetteGame theme) ------

function Shell({
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
        <div style={sparkles} aria-hidden />
        <div style={cardNoScroll}>
          <div style={headerRowNoWrap}>
            <h1 style={titleNoWrap}>{title}</h1>
  
            <div style={headerBtnsNoWrap}>
              {rightExtra}
              <button style={kidHeaderBtn} onClick={onExit}>
                メニューへ
              </button>
            </div>
          </div>
  
          <div style={{ marginTop: 10, minHeight: 0, flex: 1, overflow: "hidden" }}>{children}</div>
        </div>
      </div>
    );
  }
  
  // ===== Kid theme styles (copy from SilhouetteGame) =====
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
    margin: 0,
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
  

  const topBar: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.92)",
    border: "3px solid rgba(120, 214, 255, 0.25)",
    boxShadow: "0 10px 18px rgba(0, 160, 255, 0.10)",
  };
  
  const panel: React.CSSProperties = {
    padding: 16,
    borderRadius: 18,
    border: "3px solid rgba(80, 200, 255, 0.25)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 12px 22px rgba(0, 160, 255, 0.10)",
    boxSizing: "border-box",
  };
  
  const choiceBtn: React.CSSProperties = {
    padding: 12,
    borderRadius: 18,
    border: "3px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
  };
  
  const primaryBtn: React.CSSProperties = {
    padding: "12px 16px",
    borderRadius: 18,
    border: "3px solid rgba(255, 63, 167, 0.18)",
    background: "linear-gradient(180deg, rgba(255, 120, 200, 0.95), rgba(255, 63, 167, 0.92))",
    color: "#fff",
    fontWeight: 1000,
    fontSize: 18,
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(255, 63, 167, 0.18)",
  };
  
  const secondaryBtn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 18,
    border: "3px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.85)",
    fontWeight: 1000,
    cursor: "pointer",
  };
  

// ------ demo data ------
// ここを実データに差し替え（小1漢字を増やす）
// 読みは「このゲーム用の代表例」だけ入れてます（複数読みを扱いたいなら拡張可能）
const demoItems: Item[] = [
// 数字（OKだが統一感のため少し抽象化）
{ id: "ichi", kanji: "一", yomi: "いち", hint: "かずの はじめ" },
{ id: "ni", kanji: "二", yomi: "に", hint: "1の つぎ" },
{ id: "san", kanji: "三", yomi: "さん", hint: "ゆびを 3ぼん" },
{ id: "yon", kanji: "四", yomi: "よん", hint: "つくえの あし" },
{ id: "go", kanji: "五", yomi: "ご", hint: "ての ゆび ぜんぶ" },
{ id: "roku", kanji: "六", yomi: "ろく", hint: "サイコロの め" },
{ id: "nana", kanji: "七", yomi: "なな", hint: "にじの いろの かず" },
{ id: "hachi", kanji: "八", yomi: "はち", hint: "たこ の あし" },
{ id: "kyu", kanji: "九", yomi: "きゅう", hint: "10の ひとつ まえ" },
{ id: "ju", kanji: "十", yomi: "じゅう", hint: "ゆび ぜんぶ" },

// 自然・身の回り
{ id: "hi", kanji: "日", yomi: "ひ", hint: "あさに のぼる" },
{ id: "tsuki", kanji: "月", yomi: "つき", hint: "よるの そら" },
{ id: "yama", kanji: "山", yomi: "やま", hint: "たかい ばしょ" },
{ id: "kawa", kanji: "川", yomi: "かわ", hint: "みずが ながれる" },
{ id: "ta", kanji: "田", yomi: "た", hint: "おこめを つくる ばしょ" },
{ id: "hito", kanji: "人", yomi: "ひと", hint: "わたし や あなた" },

// 大小・位置
{ id: "oo", kanji: "大", yomi: "おお", hint: "ちいさい の はんたい" },
{ id: "chii", kanji: "小", yomi: "ちい", hint: "おおきい の はんたい" },
{ id: "ue", kanji: "上", yomi: "うえ", hint: "そらに ちかい" },
{ id: "shita", kanji: "下", yomi: "した", hint: "じめんに ちかい" },
{ id: "naka", kanji: "中", yomi: "なか", hint: "まわりに かこまれる" },

// からだ
{ id: "kuchi", kanji: "口", yomi: "くち", hint: "たべものが はいる" },
{ id: "me", kanji: "目", yomi: "め", hint: "えを みる" },
{ id: "mimi", kanji: "耳", yomi: "みみ", hint: "おとが はいる" },
{ id: "te", kanji: "手", yomi: "て", hint: "ものを もつ" },
{ id: "ashi", kanji: "足", yomi: "あし", hint: "あるく とき つかう" },

// 天気・生きもの
{ id: "ame", kanji: "雨", yomi: "あめ", hint: "くもから おちる" },
{ id: "hana", kanji: "花", yomi: "はな", hint: "はるに さく" },
{ id: "in", kanji: "犬", yomi: "いぬ", hint: "ワンワン なく" },
{ id: "neko", kanji: "猫", yomi: "ねこ", hint: "ニャーと なく" },

{ id: "ki", kanji: "木", yomi: "き", hint: "つくえや いすの ざいりょう" },
{ id: "mizu", kanji: "水", yomi: "みず", hint: "のどが かわいたら のむ" },
{ id: "hi2", kanji: "火", yomi: "ひ", hint: "あぶないので さわらない" },
{ id: "tsuchi", kanji: "土", yomi: "つち", hint: "はたけの じめん" },

{ id: "kane", kanji: "金", yomi: "かね", hint: "おさいふに いれる" },
{ id: "sora", kanji: "空", yomi: "そら", hint: "くもや とりが いる" },

{ id: "onna", kanji: "女", yomi: "おんな", hint: "おかあさん みたい" },
{ id: "otoko", kanji: "男", yomi: "おとこ", hint: "おとうさん みたい" },
{ id: "ko", kanji: "子", yomi: "こ", hint: "おとな じゃない" },

{ id: "miru", kanji: "見", yomi: "みる", hint: "テレビを みる" },
{ id: "kiku", kanji: "聞", yomi: "きく", hint: "おとを きく" },

{ id: "iku", kanji: "行", yomi: "いく", hint: "がっこうへ ○○" },
{ id: "deru", kanji: "出", yomi: "でる", hint: "へやから そとへ" },
{ id: "hairu", kanji: "入", yomi: "はいる", hint: "はこの なかへ" },

{ id: "tatsu", kanji: "立", yomi: "たつ", hint: "すわる の はんたい" },
{ id: "yasumu", kanji: "休", yomi: "やすむ", hint: "つかれたら する" },

{ id: "saki", kanji: "先", yomi: "さき", hint: "まえの ほう" },
{ id: "sei", kanji: "生", yomi: "せい", hint: "いきている こと" },

{ id: "tadashii", kanji: "正", yomi: "ただしい", hint: "まちがい じゃない" },
{ id: "hayai", kanji: "早", yomi: "はやい", hint: "おそい の はんたい" },

{ id: "aka", kanji: "赤", yomi: "あか", hint: "しんごうの とまれ" },
{ id: "ao", kanji: "青", yomi: "あお", hint: "そらの いろ" },
{ id: "shiro", kanji: "白", yomi: "しろ", hint: "ゆきの いろ" },

{ id: "kusa", kanji: "草", yomi: "くさ", hint: "はらっぱに はえてる" },
{ id: "mushi", kanji: "虫", yomi: "むし", hint: "ちいさくて うごく いきもの" },

{ id: "mori", kanji: "森", yomi: "もり", hint: "きが たくさん ある" },
{ id: "hayashi", kanji: "林", yomi: "はやし", hint: "もりより きが すくない" },

{ id: "mura", kanji: "村", yomi: "むら", hint: "ちいさな まち" },
{ id: "machi", kanji: "町", yomi: "まち", hint: "みせや いえが ある" },

{ id: "hon", kanji: "本", yomi: "ほん", hint: "よむ もの" },
{ id: "bun", kanji: "文", yomi: "ぶん", hint: "ことばの ならび" },
{ id: "na", kanji: "名", yomi: "な", hint: "なまえ の こと" },

{ id: "sen", kanji: "千", yomi: "せん", hint: "1000" },
{ id: "hyaku", kanji: "百", yomi: "ひゃく", hint: "100" },

{ id: "chikara", kanji: "力", yomi: "ちから", hint: "つよさ" },

// 方向（覚えやすい）
{ id: "migi", kanji: "右", yomi: "みぎ", hint: "みぎて の ほう" },
{ id: "hidari", kanji: "左", yomi: "ひだり", hint: "ひだりて の ほう" },

// 身の回り（読みがシンプル）
{ id: "kado", kanji: "角", yomi: "かど", hint: "つくえの すみ" },
{ id: "oto", kanji: "音", yomi: "おと", hint: "きこえる もの" },
{ id: "mado", kanji: "窓", yomi: "まど", hint: "そとが みえる ところ" },
{ id: "ishi", kanji: "石", yomi: "いし", hint: "かたい つぶ" },

];
