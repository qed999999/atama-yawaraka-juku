# あたまやわらか塾 - Claude 作業ルール

## プロジェクト構成

- **ソースコード**: `あたまやわらか塾/clientapp/src/`
- **ビルド出力**: `あたまやわらか塾/wwwroot/` （本番配信先）
- **ビルドコマンド**: `cd あたまやわらか塾/clientapp && npm run build`

## 必須ルール：バージョンを毎回更新

**コード修正のたびに `App.tsx` の `APP_VERSION` を更新すること。**

- 場所：`あたまやわらか塾/clientapp/src/App.tsx` 上部の `const APP_VERSION = "vX.Y.Z";`
- 表示位置：ホームメニュー「メニュー」ヘッダ右の小さな文字
- インクリメント方針（セマンティックバージョニング）：
  - **patch（v1.1.0 → v1.1.1）**：バグ修正・小さな表示調整
  - **minor（v1.1.0 → v1.2.0）**：新ゲーム追加・新機能追加
  - **major（v1.1.0 → v2.0.0）**：大きなUI刷新・破壊的変更
- 修正コミットには新バージョンを含める

## 必須ルール：バックアップは作らない

**`bk/` フォルダへのバックアップは作成しない。**

GitHub 管理になったため、履歴は git に任せる。`bk/` フォルダは作らず、直接編集する。

## 必須ルール：コード変更後は必ずビルド

**`src/` 以下のファイルを変更したら、毎回必ず `npm run build` を実行すること。**

ビルドしないと `http://100.66.177.36/AtamaYawa/` に変更が反映されない。
ユーザーに指摘されるまで待たず、コード変更のたびに自動でビルドする。

```bash
cd "D:/知育アプリ/あたまやわらか塾/clientapp" && npm run build
```

## 必須ルール：ゲーム修正後のデグレチェック

**ゲームファイルを修正したら、以下の項目を必ず自分でチェックすること。**
ユーザーに「画面が真っ暗」と言わせない。

### よくある黒画面バグのパターン

1. **useRef/useCallback 等の import 漏れ**
   - 新しいフック（`useRef`, `useCallback`, `useMemo` 等）を追加したら、必ず import 行に追加されているか確認する
   - チェック方法：`grep -n "^import.*react" ファイル名` で import を確認

2. **フックの条件付き呼び出し（early return の後にフックを置く）**
   - `if (phase === "xxx") return (...)` より**後ろ**に `useEffect`/`useState` 等を置いてはいけない
   - すべてのフックは early return より**前**に配置すること
   - チェック方法：ファイル内の `useEffect`/`useState`/`useRef` がすべて最初の `if (phase` より前にあるか確認

3. **Props のデストラクチャリング漏れ**
   - `prevBest`/`unit` 等を Props 型に定義しても、関数引数で受け取っていないと `initialBest` が undefined になり黒画面になる
   - チェック方法：`export default function XxxGame({ onExit, onScore, prevBest, unit }` に全 Props が含まれているか確認

### チェックコマンド（ゲームファイル修正後に実行）

```bash
# 修正したファイルの import 確認（useRef/useCallback 使用時）
grep -n "useRef\|useCallback\|useMemo" ファイル名
grep -n "^import" ファイル名

# early return 後にフックがないか確認
# （手動で目視：最初の `if (phase` より後に useState/useEffect がないことを確認）
```

## プロジェクト仕様（詳細は memory/project_atamayawaraka.md 参照）

- React + TypeScript + Vite、24本のゲーム
- スコア単位：`App.tsx` の `SCORE_UNITS` で管理（デフォルト「てん」）
  - `kiokuCard`: 「びょう」（残り秒数）
  - それ以外：デフォルト「てん」（+10/-5 点数制）
- 未プレイ表示は `--- {unit}` で unit に従う（「--- てん」「--- びょう」等）
- Ready/Intro 画面：パネルを Shell/KidShell 直下に配置、`textAlign: "left"` を指定
  - KidShell 系：`<div style={{ ...kidPanel, textAlign: "left" }}>`
  - Shell 系：`<div style={{ ...panel, width: "100%", maxWidth: "none", textAlign: "left" }}>`
  - ShoppingGame / WordScramble は外側ラッパーを `<div style={{ padding: 16, boxSizing: "border-box" }}>` にする（`placeItems: "center"` 不可）

## スコア・フィードバック（全ゲーム共通）

- 正解: **+10点** / 不正解: **-5点**（最低0点、`Math.max(0, score + SCORE_WRONG)` を使う）
- フィードバックオーバーレイ：○/× ＋ せいかい/ざんねん ＋ 不正解時は答え表示

## PWA・iOS 対応

- ホーム画面アイコン：`clientapp/public/apple-touch-icon.png`（sharp で SVG→PNG 生成済み）
- iOS Safari ↔ スタンドアロン間のデータ引き継ぎ機能あり（App.tsx 内）
- クリップボードは `navigator.clipboard.writeText` **不可**、`document.execCommand('copy')` を使う

## ゲーム固有メモ

### BalloonGame
- グリッドベースで配置（重複なし）、`transform: translate(-50%, -50%)` で中央配置
- 難易度はラウンド数で自動スケール：1-9 → 1-19 → 1-50 → 1-99 → 1-200 → 1-999

### DropTenGame
- 7列×12行、縦隣接の合計10で消滅
- 消滅は「置いたピース直下の1組のみ」チェック（全走査しない）
- DROP_INTERVAL_MS = 1800

### SortGame
- ヒント非表示（答えが見えてしまうため）
- 進捗表示のみ：`${selected.length} / ${numbers.length}`
