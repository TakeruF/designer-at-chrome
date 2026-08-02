# UI Lens — Design Inspector

実際のWebサイトを見ながらUIデザインを学ぶための、ローカル完結型Chrome拡張機能です。ページ上の要素を選択すると、そのUIパターン、タイポグラフィ、色、余白、外観、レイアウト、HTML構造をChrome Side Panelで確認できます。気に入った要素はスクリーンショットとメモを付けて保存し、自分専用のUIリファレンス集として検索・閲覧できます。

## 主な機能

- Chrome Side Panel内の `Inspect` / `Bookmarks` タブ
- ページ要素のホバー強調、クリック選択、`Escape` による終了
- 選択要素から親要素への移動と、履歴を使った子要素への復帰
- Basic、Typography、Colors、Spacing、Appearance、Layout、Structureの抽出
- HTML・ARIA・CSS・位置・子要素を使うローカルのルールベースUIパターン判定
- 選択要素の表示範囲だけをWebPで切り抜く高DPI対応スクリーンショット
- `video` または動画を含む領域を、現在フレーム／プレイヤー全体／選択範囲から選んで記録
- 動画のタイムコード、解像度、字幕・コントロール情報と撮影上の制約を保存
- カスタムプレイヤー範囲の推定、撮影範囲の親子移動、任意の一時停止と状態復元
- 保護動画らしい黒／透明フレームの検出と、周辺UI／プレースホルダーによる代替保存
- タイトル、カテゴリ、タグ、メモ付きローカルブックマーク
- 検索、カテゴリフィルター、新旧順ソート、詳細、編集、削除
- ZIPによるブックマーク・元画像・サムネイルのエクスポート／インポート
- OS設定に追従するライト／ダークモードと手動切り替え
- 日本語／英語の表示切り替え（初回はChromeのUI言語を使用）
- 初心者向けCSS用語説明とUI判定理由の日英ローカル辞書

## 技術構成

- Chrome Extension Manifest V3
- React 19 / TypeScript（strict mode）
- Vite（Side Panel）+ esbuild（Service Worker / Content Scriptの自己完結バンドル）
- Chrome Side Panel API / Content Scripts / Service Worker
- `chrome.storage.local`（メタデータ・UI状態）
- IndexedDB（元スクリーンショット・サムネイルのBlob）
- JSZip（ZIPエクスポート／インポート）
- Vitest / jsdom / ESLint / Prettier

## セットアップ

Node.js 20以降を推奨します。

```bash
npm install
```

## 開発サーバー

```bash
npm run dev
```

Viteの開発サーバーはSide Panel UIのスタイル開発用です。Chrome APIを利用する選択・撮影・保存の統合動作は、下記のビルド済み拡張をChromeへ読み込んで確認してください。

## ビルド

```bash
npm run build
```

`dist/` に、展開して読み込めるManifest V3拡張が生成されます。

## Chromeへの読み込み

1. `npm run build` を実行します。
2. Chromeで `chrome://extensions` を開きます。
3. 右上の「デベロッパー モード」を有効にします。
4. 「パッケージ化されていない拡張機能を読み込む」を選びます。
5. このリポジトリの `dist/` フォルダを指定します。
6. 通常の `http://` または `https://` ページを開き、ツールバーのUI Lensアイコンをクリックします。
7. 必要に応じて「このサイトを許可」を押します。許可は現在のサイト単位で、Chromeの確認後に保存されます。
8. Side Panelの「要素を選択」を押し、ページ上の要素を選択します。

コード変更後は再度 `npm run build` を実行し、`chrome://extensions` で拡張を再読み込みしてください。

## テストと品質チェック

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```

ユニットテストは次を対象にしています。

- RGB / RGBA / CSS Color 4からHEXへの変換と透明度
- UIパターンのルールベース判定
- CSS Selector生成
- ブックマークおよびインポートデータのバリデーション
- インポート時のID重複解決
- 動画フレーム時刻の表示、プレイヤー範囲スコアリング、保護コンテンツ候補のピクセル判定

## 使用権限と理由

| 権限        | 理由                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `sidePanel` | 拡張アイコンからChrome Side Panelを開くため                              |
| `storage`   | ブックマークメタデータ、設定、UI状態をローカル保存するため               |
| `activeTab` | ユーザーが拡張を開いた現在のタブだけを検査・撮影するため                 |
| `scripting` | ユーザー操作後、現在のタブへInspector Content Scriptを注入するため       |
| `tabs`      | アクティブタブの取得、表示領域の撮影、保存元ページを新しいタブで開くため |

`optional_host_permissions` には `http://*/*` と `https://*/*` を宣言していますが、インストール時に全サイトへのアクセスは要求しません。通常はツールバー操作で得る一時的な `activeTab` 権限を使います。別ドメインへ移動してSide Panelを使い続ける場合だけ、ユーザーが「このサイトを許可」を押した時点で、現在のoriginに限定した権限をChromeへ要求します。

常時アクセスする `host_permissions` と `<all_urls>` は設定していません。Content Scriptはmanifestで全ページに常駐させず、ユーザー操作後の現在タブへだけ注入します。許可済みサイトはChromeの拡張機能設定からいつでも取り消せます。

## ローカル保存の仕組み

### `chrome.storage.local`

- ブックマークのメタデータ
- 抽出したスタイル、構造、UIパターン判定結果
- テーマ、表示言語、最後に開いたタブ

### IndexedDB (`ui-lens-images`)

`screenshots` オブジェクトストアに次を保存します。

- `fullImageBlob`: `image/webp`、quality 0.85の元画像
- `thumbnailBlob`: 最大幅400pxの一覧用画像
- 画像サイズ、MIME type、保存日時、bookmark ID

画像をBase64へ変換して `chrome.storage.local` に保存することはありません。撮影時の一時的なPNG data URLはService Worker内でCanvasへ読み込むためだけに利用し、保存前にWebP Blobへ変換します。

削除時はIndexedDBの画像と `chrome.storage.local` のメタデータを両方削除します。エクスポートZIPは次の構造です。

```text
bookmarks.json
images/{bookmarkId}.webp
thumbnails/{bookmarkId}.webp
```

インポート時はJSONを検証し、既存または同一アーカイブ内でIDが重複した場合に新しいUUIDを発行します。画像が欠けたレコードはスキップされ、不正なJSONで既存データを置き換えません。MVPではZIPを250MB、1回のインポートを1,000件に制限し、途中失敗時はその処理で追加した画像をロールバックします。

## スクリーンショット処理

1. Content Scriptで選択要素の `getBoundingClientRect()` と `devicePixelRatio` を取得
2. 動画を含む場合は撮影範囲と現在位置を記録し、設定に応じて再生中の動画を一時停止
3. 選択／ホバーオーバーレイを一時的に非表示
4. `chrome.tabs.captureVisibleTab()` で現在のviewportを撮影
5. Service Workerの `OffscreenCanvas` でDPRを考慮して切り抜き
6. WebP（quality 0.85）と最大幅400pxのサムネイルを生成
7. BlobをIndexedDBへ保存し、オーバーレイと元の動画再生状態を復元

要素がviewport外へはみ出す場合は見えている範囲だけを保存し、`clippedToViewport` フラグとUI上の注記を残します。動画は現在フレーム、プレイヤーUI全体、選択中のセクションから範囲を選べます。撮影中だけ一時停止した動画は、撮影完了後に元の再生状態へ戻します。

動画の撮影にも `video` をCanvasへ直接描く方式は使いません。通常要素と同じくタブ全体を撮影して切り抜くため、現在フレーム、字幕、カスタムコントロール、周辺レイアウトを表示どおりに保存できます。`Include player controls` はDOM属性を書き換えず、マウス移動イベントで既存コントロールの表示だけを試みます。動画URLや動画ファイルは保存しません。

動画領域の大部分が黒または透明の場合は保護コンテンツの可能性を警告し、プレイヤー周辺UIだけを保存、動画領域をプレースホルダーにして保存、またはキャンセルを選べます。DRMやEncrypted Media Extensionsを回避する処理は行いません。

## プライバシー方針

- 閲覧ページの内容を外部へ送信しません。
- スクリーンショットはユーザーのブラウザ内にのみ保存します。
- アカウント登録は不要です。
- 外部解析ツール、広告SDK、クラウドAPIを使用しません。
- 拡張機能自身から外部ネットワークへ通信する処理は実装していません。
- ページのfavicon URLはメタデータとして記録しますが、拡張UIから再取得・表示しません。

## 現在の制約

- iframe内の要素選択はMVP対象外です。トップフレーム内だけを検査します。
- open Shadow DOMはイベントのcomposed pathとShadow Root単位のセレクタ表現で可能な範囲に対応します。closed Shadow DOM内部はWebプラットフォームの制約により完全には取得できません。
- 複数回スクロールして結合するフル要素／フルページ撮影は行いません。
- `chrome://`、Chrome Web Store、ブラウザ内部ページ、他の拡張ページなど、スクリプト注入が禁止されたページは検査できません。Side Panelに理由を表示します。
- 通常のHTML動画は現在フレーム、タイムコード、動画解像度、表示サイズ、再生・ミュート状態、字幕検出結果などを保存します。複数動画を含む選択範囲では先頭の表示動画を主要対象にします。
- DRM保護動画、Encrypted Media Extensions、ハードウェアオーバーレイ、WebGL合成動画などは映像自体を取得できない場合があります。黒画面検出はヒューリスティックのため、暗い映像を保護コンテンツと判定することがあります。
- 非表示のネイティブ／カスタムコントロールはサイト側の実装によって表示できない場合があります。ページDOMを強引に変更せず、動画フレームの保存を続行します。
- 一時停止前の `currentTime`、volume、mutedは変更しません。自動再生制限で撮影後の再開に失敗した場合は、保存メタデータに制限事項として記録します。
- ルールベース判定は最も可能性の高い候補を返すヒューリスティックです。曖昧な要素ではconfidenceを低く表示します。
- ブラウザ同期は行わず、データはChromeプロフィール単位です。移行にはZIPエクスポートを利用してください。
- SPAのURL変更ではContent Scriptを再登録せず現在のDOMを継続して検査しますが、選択要素自体が再描画で破棄された場合は再選択が必要です。

## 今後の拡張案

- スクロールを伴う大きな要素の結合撮影
- iframe対応とShadow DOM横断セレクタの強化
- 2つのブックマークのスタイル比較
- CSS tokenの自動クラスタリングとパレット表示
- JSON／Markdown形式の学習ノート出力
- キーボードだけでの要素ツリー移動
- ローカルのみで動く類似デザイン検索

## ライセンス

このプロジェクトは [MIT License](./LICENSE) のもとで公開されています。

## 主なファイル構成

```text
src/
  background/
    service-worker.ts       # Side Panel連携、権限境界、Content Script注入
    screenshot.ts           # viewport撮影、DPR切り抜き、WebP生成
    protected-content.ts    # 黒／透明な動画領域の保護コンテンツ推定
  content/
    inspector.ts            # 選択モード、イベント、親子履歴、メッセージ処理
    overlay.ts              # Shadow DOM内のホバー／固定アウトライン
    element-analyzer.ts     # Basic・computed style抽出
    pattern-detector.ts     # ルールベースUI名称推定
    selector-generator.ts   # CSS Selector生成
    video-analyzer.ts       # 動画メタデータ抽出とプレイヤー範囲推定
  sidepanel/
    App.tsx                 # タブ、テーマ、言語、選択イベント連携
    i18n.tsx                # 日本語／英語のローカル辞書とContext
    host-permissions.ts     # 現在サイトに限定した任意権限要求
    components/             # Summary、詳細、カード、保存フォーム
    pages/                  # Inspect / Bookmarks
    hooks/                  # IndexedDB Blob用Object URL
    styles.css              # design tokensとレスポンシブUI
  storage/
    bookmark-storage.ts     # chrome.storage.local CRUD
    screenshot-db.ts        # IndexedDB CRUD
    export-import.ts        # ZIP入出力
    validation.ts           # 防御的データ検証とID重複解決
  shared/
    types.ts                # 型定義とdiscriminated unionメッセージ
    messages.ts             # 型付きメッセージ送信
    color-utils.ts          # CSS色変換
    media-utils.ts          # 動画タイムコード表示
    glossary.ts             # 初心者向けローカル辞書
```
