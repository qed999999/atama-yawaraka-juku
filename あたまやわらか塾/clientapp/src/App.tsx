import React, { useState, useEffect, useCallback, useRef } from "react";
import SilhouetteGame from "./games/SilhouetteGame";
import KanjiReadingQuiz from "./games/KanjiReadingQuiz";
import Kakezan from "./games/Kakezan";
import SpotTheDifferenceGame from "./games/SpotTheDifferenceGame";
import Ikutuarukana from "./games/Ikutuarukana";
import DotCompareGame from "./games/DotCompareGame";
import KagoGame from "./games/KagoGame";
import TashizanQuiz from "./games/TashizanQuiz";
import IroateGame from "./games/IroateGame";
import KiokuCardGame from "./games/KiokuCardGame";
import ClockGame from "./games/ClockGame";
import MaruBatsuQuiz from "./games/MaruBatsuQuiz";
import SortGame from "./games/SortGame";
import AnimalQuiz from "./games/AnimalQuiz";
import HiraganaGame from "./games/HiraganaGame";
import SubtractionQuiz from "./games/SubtractionQuiz";
import PositionMemory from "./games/PositionMemory";
import ShapeQuiz from "./games/ShapeQuiz";
import ColorMixGame from "./games/ColorMixGame";
import OddOneOut from "./games/OddOneOut";
import ShoppingGame from "./games/ShoppingGame";
import WordScramble from "./games/WordScramble";
import BalloonGame from "./games/BalloonGame";
import DropTenGame from "./games/DropTenGame";
import KanjiBingoGame from "./games/KanjiBingoGame";
import ManekkoGame from "./games/ManekkoGame";
import HissanGame from "./games/HissanGame";
import BigSmallGame from "./games/BigSmallGame";

const APP_VERSION = "v1.1.1";

type Screen =
  | "home"
  | "silhouette"
  | "kanjiReadingQuiz"
  | "kakezan"
  | "spotTheDifference"
  | "ikutuarukana"
  | "dotCompareGame"
  | "kago"
  | "tashizan"
  | "iroate"
  | "kiokuCard"
  | "clock"
  | "maruBatsu"
  | "sort"
  | "animalQuiz"
  | "hiragana"
  | "subtraction"
  | "positionMemory"
  | "shapeQuiz"
  | "colorMix"
  | "oddOneOut"
  | "shopping"
  | "wordScramble"
  | "balloon"
  | "dropTen"
  | "kanjiBingo"
  | "manekko"
  | "hissan"
  | "bigSmall";

// ===== Player Management =====
type Player = { id: string; name: string; age?: number };
const GUEST_PLAYER: Player = { id: "guest", name: "ゲスト" };
const LS_PLAYERS = "atamayawaraka_players";
const LS_ACTIVE = "atamayawaraka_activePlayer";

function loadPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(LS_PLAYERS);
    if (raw) {
      const arr = JSON.parse(raw) as Player[];
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch { /* ignore */ }
  return [GUEST_PLAYER];
}
function savePlayers(players: Player[]) {
  localStorage.setItem(LS_PLAYERS, JSON.stringify(players));
}
function loadActiveId(): string {
  return localStorage.getItem(LS_ACTIVE) ?? "guest";
}
function saveActiveId(id: string) {
  localStorage.setItem(LS_ACTIVE, id);
}

// ===== Score Management =====
type ScoreEntry = { score: number; ts: number; difficulty?: string };
type ScoreMap = Record<string, ScoreEntry[]>;
type AllScores = Record<string, ScoreMap>; // playerId -> ScoreMap
const LS_SCORES = "atamayawaraka_scores";

function loadScores(): AllScores {
  try {
    const raw = localStorage.getItem(LS_SCORES);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const result: AllScores = {};
    for (const [pid, gameMap] of Object.entries(parsed as Record<string, unknown>)) {
      result[pid] = {};
      if (gameMap && typeof gameMap === "object") {
        for (const [gid, val] of Object.entries(gameMap as Record<string, unknown>)) {
          if (Array.isArray(val)) {
            result[pid][gid] = val as ScoreEntry[];
          } else if (typeof val === "number") {
            result[pid][gid] = [{ score: val, ts: 0 }];
          }
        }
      }
    }
    return result;
  } catch { return {}; }
}
function saveScores(scores: AllScores) {
  localStorage.setItem(LS_SCORES, JSON.stringify(scores));
}

// ゲームごとの得点単位
const SCORE_UNITS: Partial<Record<Screen, string>> = {
  kiokuCard: "びょう",
  kanjiBingo: "びょう",
};
const LOWER_IS_BETTER = new Set<Screen>(["kiokuCard", "kanjiBingo"]);
function getScoreUnit(s: Screen): string { return SCORE_UNITS[s] ?? "てん"; }
const DIFFICULTY_GAMES = new Set<Screen>(["kakezan", "subtraction", "kiokuCard", "kanjiBingo", "manekko", "hissan"]);
const DIFFICULTY_LABEL_MAP: Partial<Record<Screen, string[]>> = {
  kanjiBingo: ["小1", "小2"],
};

// ===== Game Definitions (年齢順) =====
type GameDef = { screen: Screen; icon: string; title: string; sub: string; minAge: number; maxAge: number };
type GenreDef = { icon: string; label: string; color: string; borderColor: string; games: GameDef[] };

const GENRES: GenreDef[] = [
  {
    icon: "🔢", label: "かず・けいさん",
    color: "rgba(26,168,255,0.12)", borderColor: "rgba(26,168,255,0.3)",
    games: [
      { screen: "ikutuarukana", icon: "🔢", title: "いくつあるかな？", sub: "かぞえてみよう", minAge: 4, maxAge: 6 },
      { screen: "dotCompareGame", icon: "⚖️", title: "かずあそび", sub: "どちらがおおきい？", minAge: 4, maxAge: 6 },
      { screen: "balloon", icon: "🎈", title: "バルーンわり", sub: "ちいさいじゅんにわれ！", minAge: 4, maxAge: 7 },
      { screen: "sort", icon: "📊", title: "ならびかえ", sub: "ちいさいじゅんに！", minAge: 5, maxAge: 7 },
      { screen: "clock", icon: "🕐", title: "なんじかな？", sub: "とけいをよもう", minAge: 6, maxAge: 7 },
      { screen: "tashizan", icon: "➕", title: "たしざんクイズ", sub: "たせるかな？", minAge: 6, maxAge: 8 },
      { screen: "subtraction", icon: "➖", title: "ひきざんクイズ", sub: "ひけるかな？", minAge: 6, maxAge: 8 },
      { screen: "dropTen", icon: "🔟", title: "テンでけす", sub: "あわせて10でけそう！", minAge: 6, maxAge: 9 },
      { screen: "shopping", icon: "🛒", title: "おかいものゲーム", sub: "おつりをけいさん！", minAge: 6, maxAge: 9 },
      { screen: "kakezan", icon: "✖️", title: "かけざんクイズ", sub: "九九をといてみよう", minAge: 7, maxAge: 9 },
      { screen: "hissan",  icon: "✏️", title: "ひっさんゲーム", sub: "たてに かいた けいさん！", minAge: 6, maxAge: 9 },
    ],
  },
  {
    icon: "🧠", label: "きおく・はんだん",
    color: "rgba(124,58,237,0.10)", borderColor: "rgba(124,58,237,0.28)",
    games: [
      { screen: "bigSmall", icon: "🐘", title: "どっちがおおきい？", sub: "おおきさをくらべよう", minAge: 4, maxAge: 6 },
      { screen: "kiokuCard", icon: "🃏", title: "きおくカード", sub: "おなじペアをさがそう！", minAge: 4, maxAge: 6 },
      { screen: "manekko",  icon: "🎵", title: "まねっこゲーム", sub: "ひかったじゅんに タップ！", minAge: 4, maxAge: 7 },
      { screen: "silhouette", icon: "🕵️", title: "シルエットあて", sub: "これ、なーんだ？", minAge: 4, maxAge: 7 },
      { screen: "positionMemory", icon: "⭐", title: "どこかな？", sub: "ひかったマスをおぼえよう", minAge: 5, maxAge: 7 },
      { screen: "kago", icon: "🧺", title: "かごのとりあて", sub: "どのかごにはいってる？", minAge: 5, maxAge: 8 },
      { screen: "maruBatsu", icon: "⭕", title: "○×クイズ", sub: "ただしい？まちがい？", minAge: 6, maxAge: 9 },
    ],
  },
  {
    icon: "🔎", label: "かんさつ・さがす",
    color: "rgba(34,197,94,0.10)", borderColor: "rgba(34,197,94,0.28)",
    games: [
      { screen: "shapeQuiz", icon: "🔷", title: "かたちあて", sub: "このかたちはなに？", minAge: 4, maxAge: 6 },
      { screen: "spotTheDifference", icon: "🔎", title: "まちがいさがし", sub: "どこがちがう？", minAge: 5, maxAge: 8 },
      { screen: "iroate", icon: "🎨", title: "いろあてゲーム", sub: "いろを あてよう！", minAge: 5, maxAge: 8 },
      { screen: "colorMix", icon: "🎨", title: "いろまぜ", sub: "まぜると なにいろ？", minAge: 6, maxAge: 9 },
    ],
  },
  {
    icon: "📚", label: "ことば・ちしき",
    color: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.28)",
    games: [
      { screen: "hiragana", icon: "📝", title: "ひらがなあて", sub: "□に はいる もじは？", minAge: 4, maxAge: 6 },
      { screen: "wordScramble", icon: "🔤", title: "もじならべ", sub: "ならべて ことばを つくろう", minAge: 4, maxAge: 7 },
      { screen: "oddOneOut", icon: "🔍", title: "なかまはずれ", sub: "ちがう ひとつは どれ？", minAge: 5, maxAge: 7 },
      { screen: "animalQuiz", icon: "🐾", title: "どうぶつクイズ", sub: "どうぶつのことを しろう", minAge: 5, maxAge: 8 },
      { screen: "kanjiReadingQuiz", icon: "📖", title: "漢字の読みクイズ", sub: "よめるかな？", minAge: 7, maxAge: 9 },
      { screen: "kanjiBingo", icon: "🀄", title: "かんじビンゴ", sub: "よみをきいてかんじをさがそう", minAge: 6, maxAge: 9 },
    ],
  },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [players, setPlayers] = useState<Player[]>(loadPlayers);
  const [activePlayerId, setActivePlayerId] = useState<string>(loadActiveId);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerAge, setNewPlayerAge] = useState<number>(5);
  const [editPlayer, setEditPlayer] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState<number>(5);
  const [deleteConfirmInEdit, setDeleteConfirmInEdit] = useState(false);
  const [scores, setScores] = useState<AllScores>(loadScores);

  // Persist changes
  useEffect(() => { savePlayers(players); }, [players]);
  useEffect(() => { saveActiveId(activePlayerId); }, [activePlayerId]);
  useEffect(() => { saveScores(scores); }, [scores]);

  // スコア報告ハンドラ
  const reportScore = useCallback((game: Screen, value: number, difficulty?: string) => {
    setScores(prev => {
      const playerScores = prev[activePlayerId] ?? {};
      const entries = playerScores[game] ?? [];
      const newEntry: ScoreEntry = { score: value, ts: Date.now(), ...(difficulty ? { difficulty } : {}) };
      return { ...prev, [activePlayerId]: { ...playerScores, [game]: [newEntry, ...entries] } };
    });
  }, [activePlayerId]);

  const getBest = (game: Screen): number | undefined => {
    const entries = scores[activePlayerId]?.[game];
    if (!entries || entries.length === 0) return undefined;
    return LOWER_IS_BETTER.has(game)
      ? Math.min(...entries.map(e => e.score))
      : Math.max(...entries.map(e => e.score));
  };

  const getDifficultyBestMap = (game: Screen): Record<string, number> => {
    if (!DIFFICULTY_GAMES.has(game)) return {};
    const entries = scores[activePlayerId]?.[game] ?? [];
    const lower = LOWER_IS_BETTER.has(game);
    const map: Record<string, number> = {};
    for (const entry of entries) {
      if (!entry.difficulty) continue;
      const cur = map[entry.difficulty];
      if (cur === undefined || (lower ? entry.score < cur : entry.score > cur)) {
        map[entry.difficulty] = entry.score;
      }
    }
    return map;
  };

  const getDifficultyBests = (game: Screen): { label: string; best: number | undefined }[] => {
    if (!DIFFICULTY_GAMES.has(game)) return [];
    const entries = scores[activePlayerId]?.[game] ?? [];
    const lower = LOWER_IS_BETTER.has(game);
    const labels = DIFFICULTY_LABEL_MAP[game] ?? ["かんたん", "ふつう", "むずかしい"];
    return labels.map(label => {
      const matching = entries.filter(e => e.difficulty?.startsWith(label));
      const best = matching.length > 0
        ? (lower ? Math.min(...matching.map(e => e.score)) : Math.max(...matching.map(e => e.score)))
        : undefined;
      return { label, best };
    });
  };

  // Ensure active player exists in list
  useEffect(() => {
    if (!players.find(p => p.id === activePlayerId)) {
      setActivePlayerId(players[0]?.id ?? "guest");
    }
  }, [players, activePlayerId]);

  const activePlayer = players.find(p => p.id === activePlayerId) ?? players[0] ?? GUEST_PLAYER;

  const addPlayer = useCallback(() => {
    const name = newPlayerName.trim();
    if (!name) return;
    const id = "player_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    const np: Player = { id, name, age: newPlayerAge };
    setPlayers(prev => [...prev, np]);
    setActivePlayerId(id);
    setNewPlayerName("");
    setNewPlayerAge(5);
    setShowAddPlayer(false);
  }, [newPlayerName, newPlayerAge]);

  const updatePlayer = useCallback((id: string, name: string, age: number) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: trimmed, age } : p));
    setEditPlayer(null);
    setDeleteConfirmInEdit(false);
  }, []);

  const removePlayer = useCallback((id: string) => {
    if (id === "guest") return;
    setPlayers(prev => prev.filter(p => p.id !== id));
    if (activePlayerId === id) setActivePlayerId("guest");
    setEditPlayer(null);
    setDeleteConfirmInEdit(false);
  }, [activePlayerId]);

  // 長押し検出用（スワイプ時はキャンセル）
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const LONG_PRESS_MS = 600;
  const SWIPE_THRESHOLD = 10;

  const openEditPlayer = useCallback((id: string) => {
    const p = players.find(pl => pl.id === id);
    if (!p || id === "guest") return;
    setEditPlayer(id);
    setEditName(p.name);
    setEditAge(p.age ?? 5);
    setDeleteConfirmInEdit(false);
  }, [players]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    touchStartPos.current = null;
  }, []);

  const startLongPress = useCallback((id: string, x: number, y: number) => {
    longPressTriggered.current = false;
    touchStartPos.current = { x, y };
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      openEditPlayer(id);
    }, LONG_PRESS_MS);
  }, [openEditPlayer]);

  const onTouchMovePlayer = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartPos.current.x;
    const dy = t.clientY - touchStartPos.current.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_THRESHOLD) {
      cancelLongPress();
    }
  }, [cancelLongPress]);

  const [historyModal, setHistoryModal] = useState<{ screen: Screen; title: string } | null>(null);

  const deleteEntry = useCallback((game: Screen, ts: number) => {
    setScores(prev => {
      const playerScores = prev[activePlayerId] ?? {};
      const entries = playerScores[game] ?? [];
      return { ...prev, [activePlayerId]: { ...playerScores, [game]: entries.filter(e => e.ts !== ts) } };
    });
  }, [activePlayerId]);

  // データ引き継ぎ
  const [showDataModal, setShowDataModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [dataMsg, setDataMsg] = useState("");

  const exportData = useCallback(() => {
    const data = { players, scores, activePlayerId };
    const json = JSON.stringify(data);
    const code = btoa(unescape(encodeURIComponent(json)));
    // iOS Safari対応: textarea経由でコピー
    const ta = document.createElement("textarea");
    ta.value = code;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, code.length);
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* ignore */ }
    document.body.removeChild(ta);
    if (ok) {
      setDataMsg("コピーしました！");
    } else {
      setImportText(code);
      setDataMsg("じどうコピーできませんでした。コードをぜんぶせんたくしてコピーしてね");
    }
  }, [players, scores, activePlayerId]);

  const importData = useCallback(() => {
    try {
      const json = decodeURIComponent(escape(atob(importText.trim())));
      const data = JSON.parse(json);
      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
      }
      if (data.scores) {
        setScores(data.scores);
      }
      if (data.activePlayerId) {
        setActivePlayerId(data.activePlayerId);
      }
      setDataMsg("よみこみ できました！");
      setImportText("");
    } catch {
      setDataMsg("コードが ただしくないよ");
    }
  }, [importText]);

  const exit = () => setScreen("home");
  const sc = (g: Screen) => (v: number, d?: string) => reportScore(g, v, d);
  const pb = (g: Screen) => getBest(g);
  const un = (g: Screen) => getScoreUnit(g);

  if (screen === "silhouette") return <SilhouetteGame onExit={exit} onScore={sc("silhouette")} prevBest={pb("silhouette")} unit={un("silhouette")} />;
  if (screen === "spotTheDifference") return <SpotTheDifferenceGame onExit={exit} onScore={sc("spotTheDifference")} prevBest={pb("spotTheDifference")} unit={un("spotTheDifference")} />;
  if (screen === "dotCompareGame") return <DotCompareGame onExit={exit} onScore={sc("dotCompareGame")} prevBest={pb("dotCompareGame")} unit={un("dotCompareGame")} />;
  if (screen === "kanjiReadingQuiz") return <KanjiReadingQuiz onExit={exit} onScore={sc("kanjiReadingQuiz")} prevBest={pb("kanjiReadingQuiz")} unit={un("kanjiReadingQuiz")} />;
  if (screen === "kakezan") return <Kakezan onExit={exit} onScore={sc("kakezan")} difficultyBests={getDifficultyBestMap("kakezan")} unit={un("kakezan")} />;
  if (screen === "ikutuarukana") return <Ikutuarukana onExit={exit} onScore={sc("ikutuarukana")} prevBest={pb("ikutuarukana")} unit={un("ikutuarukana")} />;
  if (screen === "kago") return <KagoGame onExit={exit} onScore={sc("kago")} prevBest={pb("kago")} unit={un("kago")} />;
  if (screen === "tashizan") return <TashizanQuiz onExit={exit} onScore={sc("tashizan")} prevBest={pb("tashizan")} unit={un("tashizan")} />;
  if (screen === "iroate") return <IroateGame onExit={exit} onScore={sc("iroate")} prevBest={pb("iroate")} unit={un("iroate")} />;
  if (screen === "kiokuCard") return <KiokuCardGame onExit={exit} onScore={sc("kiokuCard")} difficultyBests={getDifficultyBestMap("kiokuCard")} unit={un("kiokuCard")} />;
  if (screen === "clock") return <ClockGame onExit={exit} onScore={sc("clock")} prevBest={pb("clock")} unit={un("clock")} />;
  if (screen === "maruBatsu") return <MaruBatsuQuiz onExit={exit} onScore={sc("maruBatsu")} prevBest={pb("maruBatsu")} unit={un("maruBatsu")} />;
  if (screen === "sort") return <SortGame onExit={exit} onScore={sc("sort")} prevBest={pb("sort")} unit={un("sort")} />;
  if (screen === "animalQuiz") return <AnimalQuiz onExit={exit} onScore={sc("animalQuiz")} prevBest={pb("animalQuiz")} unit={un("animalQuiz")} />;
  if (screen === "hiragana") return <HiraganaGame onExit={exit} onScore={sc("hiragana")} prevBest={pb("hiragana")} unit={un("hiragana")} />;
  if (screen === "subtraction") return <SubtractionQuiz onExit={exit} onScore={sc("subtraction")} difficultyBests={getDifficultyBestMap("subtraction")} unit={un("subtraction")} />;
  if (screen === "positionMemory") return <PositionMemory onExit={exit} onScore={sc("positionMemory")} prevBest={pb("positionMemory")} unit={un("positionMemory")} />;
  if (screen === "shapeQuiz") return <ShapeQuiz onExit={exit} onScore={sc("shapeQuiz")} prevBest={pb("shapeQuiz")} unit={un("shapeQuiz")} />;
  if (screen === "colorMix") return <ColorMixGame onExit={exit} onScore={sc("colorMix")} prevBest={pb("colorMix")} unit={un("colorMix")} />;
  if (screen === "oddOneOut") return <OddOneOut onExit={exit} onScore={sc("oddOneOut")} prevBest={pb("oddOneOut")} unit={un("oddOneOut")} />;
  if (screen === "shopping") return <ShoppingGame onExit={exit} onScore={sc("shopping")} prevBest={pb("shopping")} unit={un("shopping")} />;
  if (screen === "wordScramble") return <WordScramble onExit={exit} onScore={sc("wordScramble")} prevBest={pb("wordScramble")} unit={un("wordScramble")} />;
  if (screen === "balloon") return <BalloonGame onExit={exit} onScore={sc("balloon")} prevBest={pb("balloon")} unit={un("balloon")} />;
  if (screen === "dropTen") return <DropTenGame onExit={exit} onScore={sc("dropTen")} prevBest={pb("dropTen")} unit={un("dropTen")} />;
  if (screen === "kanjiBingo") return <KanjiBingoGame onExit={exit} onScore={sc("kanjiBingo")} difficultyBests={getDifficultyBestMap("kanjiBingo")} unit={un("kanjiBingo")} />;
  if (screen === "manekko")   return <ManekkoGame onExit={exit} onScore={sc("manekko")} difficultyBests={getDifficultyBestMap("manekko")} unit={un("manekko")} />;
  if (screen === "hissan")    return <HissanGame  onExit={exit} onScore={sc("hissan")}  difficultyBests={getDifficultyBestMap("hissan")}  unit={un("hissan")} />;
  if (screen === "bigSmall")  return <BigSmallGame onExit={exit} onScore={sc("bigSmall")} prevBest={pb("bigSmall")} unit={un("bigSmall")} />;

  return (
    <div style={stageFixedNoScroll}>
      <div style={sparkles} />

      <div style={cardNoScroll}>
        {/* ヘッダー */}
        <div style={headerRowNoWrap}>
          <div style={titleNoWrap}>
            メニュー
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 900, color: "#999", letterSpacing: "0.04em" }}>{APP_VERSION}</span>
          </div>
          <div style={headerBtnsNoWrap}>
            <button style={kidHeaderBtn} onClick={() => { setShowDataModal(true); setDataMsg(""); setImportText(""); }}>
              📦 データ
            </button>
            <button style={kidHeaderBtn} onClick={() => location.reload()}>
              こうしん
            </button>
          </div>
        </div>

        {/* プレイヤータブ */}
        <div style={playerTabBar}>
          <div style={playerTabScroll}>
            {players.map(p => (
              <button
                key={p.id}
                style={p.id === activePlayerId ? playerTabActive : playerTab}
                onClick={() => { if (!longPressTriggered.current) setActivePlayerId(p.id); }}
                onContextMenu={(e) => { e.preventDefault(); }}
                onTouchStart={(e) => { const t = e.touches[0]; startLongPress(p.id, t.clientX, t.clientY); }}
                onTouchMove={onTouchMovePlayer}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onMouseDown={(e) => startLongPress(p.id, e.clientX, e.clientY)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
              >
                <span style={{ fontSize: 14 }}>{p.id === "guest" ? "👤" : "🧒"}</span>
                <span style={playerTabName}>{p.name}</span>
              </button>
            ))}
            <button style={playerAddBtn} onClick={() => { setShowAddPlayer(true); setNewPlayerName(""); setNewPlayerAge(5); }}>
              ＋
            </button>
          </div>
        </div>

        {/* プレイヤー追加モーダル */}
        {showAddPlayer && (
          <div style={modalOverlay} onClick={() => setShowAddPlayer(false)}>
            <div style={modalCard} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>🧒 プレイヤーを ついか</div>
              <input
                style={modalInput}
                type="text"
                placeholder="なまえを いれてね"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addPlayer(); }}
                maxLength={10}
                autoFocus
              />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 1000, marginBottom: 6 }}>🎂 ねんれい</div>
                <select
                  style={ageSelect}
                  value={newPlayerAge}
                  onChange={e => setNewPlayerAge(Number(e.target.value))}
                >
                  {Array.from({ length: 101 }, (_, i) => (
                    <option key={i} value={i}>{i}さい</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button style={modalCancelBtn} onClick={() => setShowAddPlayer(false)}>やめる</button>
                <button
                  style={{ ...modalOkBtn, opacity: newPlayerName.trim() ? 1 : 0.5 }}
                  onClick={addPlayer}
                  disabled={!newPlayerName.trim()}
                >ついか</button>
              </div>
            </div>
          </div>
        )}

        {/* プレイヤー編集モーダル（長押しで表示） */}
        {editPlayer && !deleteConfirmInEdit && (
          <div style={modalOverlay} onClick={() => setEditPlayer(null)}>
            <div style={modalCard} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>🧒 プレイヤーを へんしゅう</div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 1000, marginBottom: 6, textAlign: "left" }}>📝 なまえ</div>
                <input
                  style={modalInput}
                  type="text"
                  placeholder="なまえを いれてね"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={10}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 1000, marginBottom: 6, textAlign: "left" }}>🎂 ねんれい</div>
                <select
                  style={ageSelect}
                  value={editAge}
                  onChange={e => setEditAge(Number(e.target.value))}
                >
                  {Array.from({ length: 101 }, (_, i) => (
                    <option key={i} value={i}>{i}さい</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button style={modalDangerBtn} onClick={() => setDeleteConfirmInEdit(true)}>🗑 けす</button>
                <button style={modalCancelBtn} onClick={() => setEditPlayer(null)}>やめる</button>
                <button
                  style={{ ...modalOkBtn, opacity: editName.trim() ? 1 : 0.5 }}
                  onClick={() => updatePlayer(editPlayer, editName, editAge)}
                  disabled={!editName.trim()}
                >ほぞん</button>
              </div>
            </div>
          </div>
        )}

        {/* 削除確認（編集モーダル内から遷移） */}
        {editPlayer && deleteConfirmInEdit && (
          <div style={modalOverlay} onClick={() => setDeleteConfirmInEdit(false)}>
            <div style={modalCard} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>
                「{players.find(p => p.id === editPlayer)?.name}」を けす？
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>スコアは のこります</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button style={modalCancelBtn} onClick={() => setDeleteConfirmInEdit(false)}>やめる</button>
                <button style={modalDangerBtn} onClick={() => removePlayer(editPlayer)}>けす</button>
              </div>
            </div>
          </div>
        )}

        {/* データ引き継ぎモーダル */}
        {showDataModal && (
          <div style={modalOverlay} onClick={() => setShowDataModal(false)}>
            <div style={{ ...modalCard, textAlign: "left" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 12, textAlign: "center" }}>📦 データの ひきつぎ</div>

              <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.7, marginBottom: 10, lineHeight: 1.6, textAlign: "center" }}>
                Safari → ホームがめんアプリ など<br/>データを うつせるよ
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 1000, marginBottom: 6 }}>📤 かきだし</div>
                <button style={{ ...modalOkBtn, width: "100%" }} onClick={exportData}>
                  コードを コピー
                </button>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 1000, marginBottom: 6 }}>📥 よみこみ</div>
                <textarea
                  style={{ ...modalInput, minHeight: 60, resize: "vertical", fontSize: 13, fontWeight: 700, textAlign: "left" }}
                  placeholder="コードを はりつけてね"
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                />
                <button
                  style={{ ...modalOkBtn, width: "100%", marginTop: 6, opacity: importText.trim() ? 1 : 0.5 }}
                  onClick={importData}
                  disabled={!importText.trim()}
                >
                  よみこみ
                </button>
              </div>

              {dataMsg && (
                <div style={{ textAlign: "center", fontSize: 14, fontWeight: 1000, color: "#16a34a", marginBottom: 6 }}>
                  {dataMsg}
                </div>
              )}

              <button style={{ ...modalCancelBtn, width: "100%", marginTop: 4 }} onClick={() => setShowDataModal(false)}>
                とじる
              </button>
            </div>
          </div>
        )}

        {/* 中身（スクロール可） */}
        <div style={contentScroll}>
          {/* タイトルバナー */}
          <div style={titleBanner}>
            <div style={titleBannerRow}>
              <span style={{ fontSize: "clamp(22px, 6vw, 28px)" }}>🧠</span>
              <span style={titleBannerText}>あたまやわらか塾</span>
              <span style={{ fontSize: "clamp(22px, 6vw, 28px)" }}>✨</span>
            </div>
            <div style={titleBannerSub}>
              {activePlayer.name}
              {activePlayer.age != null && `（${activePlayer.age}さい）`}
              、きょうは なにして あそぶ？
            </div>
          </div>

          {/* ===== ジャンル別ゲーム一覧（年齢フィルター適用） ===== */}
          {GENRES.map(genre => {
            const playerAge = activePlayer.age;
            const filtered = playerAge != null
              ? genre.games.filter(g => playerAge >= g.minAge)
              : genre.games;
            if (filtered.length === 0) return null;
            return (
              <GenreSection key={genre.label} icon={genre.icon} label={genre.label} color={genre.color} borderColor={genre.borderColor}>
                {filtered.map(g => (
                  <GameButton
                    key={g.screen}
                    icon={g.icon}
                    title={g.title}
                    sub={g.sub}
                    age={`${g.minAge}〜${g.maxAge}さい`}
                    onClick={() => setScreen(g.screen)}
                    best={getBest(g.screen)}
                    unit={getScoreUnit(g.screen)}
                    difficultyBests={getDifficultyBests(g.screen)}
                    onLongPress={() => setHistoryModal({ screen: g.screen, title: g.title })}
                  />
                ))}
              </GenreSection>
            );
          })}

          {/* 余白 */}
          <div style={{ height: 12 }} />
        </div>

        {historyModal && (() => {
          const entries = scores[activePlayerId]?.[historyModal.screen] ?? [];
          const isLower   = LOWER_IS_BETTER.has(historyModal.screen);
          const isDiffGame = DIFFICULTY_GAMES.has(historyModal.screen);
          // 難易度別ベストマップ（難易度ゲームは難易度キー、それ以外は "__all__"）
          const bestMap: Record<string, number> = {};
          for (const e of entries) {
            const key = isDiffGame ? (e.difficulty ?? "") : "__all__";
            const cur = bestMap[key];
            if (cur === undefined || (isLower ? e.score < cur : e.score > cur)) bestMap[key] = e.score;
          }
          const isBestEntry = (entry: ScoreEntry) => {
            const key = isDiffGame ? (entry.difficulty ?? "") : "__all__";
            return bestMap[key] === entry.score;
          };
          return (
            <div style={modalOverlay} onClick={() => setHistoryModal(null)}>
              <div style={{ ...modalCard, maxWidth: 400, maxHeight: "75vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 4 }}>📊 {historyModal.title}</div>
                <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>{activePlayer.name} の きろく</div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {entries.length === 0
                    ? <div style={{ textAlign: "center", opacity: 0.6, padding: 16 }}>きろくがありません</div>
                    : entries.map((entry, i) => {
                        const d = entry.ts > 0 ? new Date(entry.ts) : null;
                        const dateStr = d
                          ? `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
                          : "（日時不明）";
                        const isBest = isBestEntry(entry);
                        return (
                          <div key={`${entry.ts}-${i}`} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "8px 4px",
                            borderBottom: "1px solid rgba(0,0,0,0.07)",
                            background: isBest ? "rgba(255,220,50,0.12)" : "transparent",
                            borderRadius: 8,
                          }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 1000, fontSize: 16 }}>{isBest ? "🏆 " : ""}{entry.score}{getScoreUnit(historyModal.screen)}</span>
                              {entry.difficulty && <span style={{ marginLeft: 6, fontSize: 11, padding: "1px 6px", borderRadius: 8, background: "rgba(124,58,237,0.10)", color: "#7c3aed", fontWeight: 900 }}>{entry.difficulty}</span>}
                              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>{dateStr}</span>
                            </div>
                            <button
                              style={{ padding: "4px 10px", borderRadius: 10, border: "1.5px solid rgba(239,68,68,0.3)", background: "rgba(255,100,100,0.1)", color: "#e00", fontWeight: 1000, fontSize: 13, cursor: "pointer" }}
                              onClick={() => deleteEntry(historyModal.screen, entry.ts)}
                            >削除</button>
                          </div>
                        );
                      })
                  }
                </div>
                <button style={{ marginTop: 12, padding: "10px", borderRadius: 14, border: "2px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.85)", fontWeight: 1000, cursor: "pointer" }} onClick={() => setHistoryModal(null)}>とじる</button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ===== Genre Section Component =====
function GenreSection({
  icon, label, color, borderColor, children,
}: {
  icon: string; label: string; color: string; borderColor: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 8, paddingLeft: 4,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 12,
          background: color, border: `2px solid ${borderColor}`,
          display: "grid", placeItems: "center", fontSize: 16, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ fontWeight: 1000, fontSize: "clamp(15px, 4vw, 18px)", color: "#333" }}>
          {label}
        </div>
        <div style={{ flex: 1, height: 2, borderRadius: 1, background: borderColor, opacity: 0.5 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

// ===== Game Button Component =====
function GameButton({
  icon, title, sub, age, onClick, best, unit, difficultyBests, onLongPress,
}: {
  icon: string; title: string; sub: string; age: string; onClick: () => void;
  best?: number; unit?: string; difficultyBests?: { label: string; best: number | undefined }[]; onLongPress?: () => void;
}) {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = React.useRef(false);
  const startPosRef = React.useRef<{ x: number; y: number } | null>(null);

  const startLP = (x: number, y: number) => {
    triggeredRef.current = false;
    startPosRef.current = { x, y };
    timerRef.current = setTimeout(() => { triggeredRef.current = true; onLongPress?.(); }, 600);
  };
  const cancelLP = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    startPosRef.current = null;
  };
  const moveLP = (x: number, y: number) => {
    if (!startPosRef.current) return;
    if (Math.abs(x - startPosRef.current.x) > 10 || Math.abs(y - startPosRef.current.y) > 10) cancelLP();
  };

  return (
    <button
      style={menuBtn}
      onClick={() => { if (!triggeredRef.current) onClick(); }}
      onTouchStart={(e) => { const t = e.touches[0]; startLP(t.clientX, t.clientY); }}
      onTouchMove={(e) => { const t = e.touches[0]; moveLP(t.clientX, t.clientY); }}
      onTouchEnd={cancelLP} onTouchCancel={cancelLP}
      onMouseDown={(e) => startLP(e.clientX, e.clientY)}
      onMouseUp={cancelLP} onMouseLeave={cancelLP}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center" }}>
        <div style={menuIcon}>{icon}</div>
        <div style={{ minWidth: 0, width: "100%" }}>
          <div style={menuTitle}>{title}</div>
          <div style={menuSub}>{sub}</div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
          <div style={ageBadge}>{age}</div>
          {difficultyBests && difficultyBests.length > 0 ? (
            <div style={{ ...scoreBadge, textAlign: "left", lineHeight: 1.6 }}>
              {difficultyBests.map(({ label, best: db }) => (
                <div key={label} style={{ whiteSpace: "nowrap" }}>
                  <span style={{ opacity: 0.75 }}>{label}：</span>
                  <span style={{ fontWeight: 900 }}>{db != null ? `🏆${db}${unit ?? "てん"}` : `---${unit ?? "てん"}`}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={scoreBadge}>{best != null ? `🏆 ${best}${unit ?? "てん"}` : `--- ${unit ?? "てん"}`}</div>
          )}
        </div>
      </div>
    </button>
  );
}

// ===== Styles =====

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

// スクロール可能なコンテンツエリア（iOSも対応）
const contentScroll: React.CSSProperties = {
  marginTop: 8,
  minHeight: 0,
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
  display: "flex",
  flexDirection: "column",
  paddingBottom: 8,
};

const kidPanel: React.CSSProperties = {
  padding: 12,
  borderRadius: 18,
  border: "3px solid rgba(80, 200, 255, 0.25)",
  background: "rgba(255,255,255,0.92)",
  boxShadow: "0 12px 22px rgba(0, 160, 255, 0.10)",
  boxSizing: "border-box",
};

const titleBanner: React.CSSProperties = {
  marginTop: 4,
  padding: "10px 14px",
  borderRadius: 20,
  background: "linear-gradient(135deg, rgba(255,115,198,0.18) 0%, rgba(26,168,255,0.14) 60%, rgba(255,230,109,0.18) 100%)",
  border: "2.5px solid rgba(255,100,180,0.25)",
  boxShadow: "0 8px 20px rgba(255,100,180,0.12)",
  textAlign: "center",
  boxSizing: "border-box",
};

const titleBannerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const titleBannerText: React.CSSProperties = {
  fontSize: "clamp(20px, 5.5vw, 28px)",
  fontWeight: 1000,
  background: "linear-gradient(90deg, #ff3fa7 0%, #1aa8ff 60%, #ffb800 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  letterSpacing: "0.02em",
};

const titleBannerSub: React.CSSProperties = {
  marginTop: 3,
  fontSize: "clamp(11px, 3vw, 13px)",
  fontWeight: 900,
  opacity: 0.75,
  letterSpacing: "0.04em",
};

// ===== Home menu button styles =====

const menuBtn: React.CSSProperties = {
  padding: "8px 4px",
  borderRadius: 18,
  border: "3px solid rgba(0,0,0,0.06)",
  background: "rgba(255,255,255,0.90)",
  cursor: "pointer",
  boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  textAlign: "center",
  width: "100%",
  minWidth: 0,
  overflow: "hidden",
  boxSizing: "border-box",
};

const menuIcon: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(255, 63, 167, 0.10)",
  border: "2px solid rgba(255, 63, 167, 0.18)",
  fontSize: 18,
  flexShrink: 0,
};

const menuTitle: React.CSSProperties = {
  fontWeight: 1000,
  fontSize: "clamp(10px, 2.8vw, 14px)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const menuSub: React.CSSProperties = {
  fontWeight: 900,
  fontSize: "clamp(8px, 2.2vw, 11px)",
  opacity: 0.75,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const ageBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(26,168,255,0.12)",
  border: "1.5px solid rgba(26,168,255,0.28)",
  color: "#0369a1",
  fontSize: "clamp(9px, 2.2vw, 11px)",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const scoreBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(255,184,0,0.15)",
  border: "1.5px solid rgba(255,184,0,0.35)",
  color: "#92400e",
  fontSize: "clamp(9px, 2.2vw, 11px)",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

// ===== Player Tab Styles =====
const playerTabBar: React.CSSProperties = {
  marginTop: 6,
  flexShrink: 0,
};
const playerTabScroll: React.CSSProperties = {
  display: "flex",
  gap: 6,
  overflowX: "auto",
  overflowY: "hidden",
  WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
  paddingBottom: 2,
  scrollbarWidth: "none",
};
const playerTabBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 12px",
  borderRadius: 999,
  border: "2px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.75)",
  fontWeight: 1000,
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  transition: "all 0.15s",
};
const playerTab: React.CSSProperties = { ...playerTabBase };
const playerTabActive: React.CSSProperties = {
  ...playerTabBase,
  background: "linear-gradient(180deg, #ff73c6 0%, #ff3fa7 100%)",
  color: "#fff",
  border: "2px solid rgba(255,63,167,0.3)",
  boxShadow: "0 4px 12px rgba(255,63,167,0.25)",
};
const playerTabName: React.CSSProperties = {
  maxWidth: 80,
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const playerAddBtn: React.CSSProperties = {
  ...playerTabBase,
  fontSize: 16,
  padding: "6px 14px",
  background: "rgba(26,168,255,0.10)",
  border: "2px solid rgba(26,168,255,0.25)",
  color: "#0369a1",
};

// ===== Modal Styles =====
const modalOverlay: React.CSSProperties = {
  position: "fixed", inset: 0, display: "grid", placeItems: "center",
  background: "rgba(0,0,0,0.3)", zIndex: 9999,
  padding: 16, boxSizing: "border-box",
};
const modalCard: React.CSSProperties = {
  width: "min(380px, 90vw)", borderRadius: 22,
  border: "3px solid rgba(255,170,220,0.55)",
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 20px 60px rgba(255,63,167,0.18)",
  padding: "20px 18px", textAlign: "center",
  boxSizing: "border-box",
};
const modalInput: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: 16,
  border: "3px solid rgba(255,63,167,0.2)",
  background: "rgba(255,255,255,0.95)",
  color: "#1b1b1b",
  fontSize: 18, fontWeight: 900, textAlign: "center",
  boxSizing: "border-box", outline: "none",
};
const modalCancelBtn: React.CSSProperties = {
  flex: 1, padding: "12px 14px", borderRadius: 16,
  border: "2px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.85)",
  fontWeight: 1000, fontSize: 15, cursor: "pointer",
};
const modalOkBtn: React.CSSProperties = {
  flex: 1, padding: "12px 14px", borderRadius: 16, border: "none",
  background: "linear-gradient(180deg, #ff73c6 0%, #ff3fa7 100%)",
  color: "#fff", fontWeight: 1000, fontSize: 15, cursor: "pointer",
};
const modalDangerBtn: React.CSSProperties = {
  flex: 1, padding: "12px 14px", borderRadius: 16, border: "none",
  background: "linear-gradient(180deg, #f87171 0%, #ef4444 100%)",
  color: "#fff", fontWeight: 1000, fontSize: 15, cursor: "pointer",
};

// ===== Age Select Style =====
const ageSelect: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 16,
  border: "3px solid rgba(255,63,167,0.2)",
  background: "rgba(255,255,255,0.95)",
  color: "#1b1b1b",
  fontSize: 16, fontWeight: 900, textAlign: "center",
  boxSizing: "border-box", outline: "none",
  appearance: "auto",
};

