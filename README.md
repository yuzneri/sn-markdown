# Markdown Studio

Standard Notes 用の Markdown エディタプラグイン。

## 機能

- 表示: Edit / Split / Preview を切り替える。前回のモードを Web・デスクトップ・モバイルごとに覚える。横幅が狭いと、Split は上下に並ぶ。
- エディタ: Markdown とコードブロックの中の言語をハイライトする（CodeMirror 6）。色は SN のテーマに合わせて変わる。
- プレビュー: GFM（表、取り消し線、タスクリスト）とコードブロックのハイライト。Split では、エディタとプレビューのスクロール位置を合わせる。
- Mermaid: ` ```mermaid ` のコードブロックを図にする。図をクリックすると、拡大表示（ホイールやピンチで拡大縮小、ドラッグで移動）を開く。
- 書式のボタン: 見出し、太字、斜体、取り消し線、コード、リンク、引用、リスト、タスク、コードブロック、表、水平線、Mermaid のひな形、画像。ショートカットは Mod-B（太字）、Mod-I（斜体）、Mod-K（リンク）。
- 画像: 貼り付け、ドラッグ＆ドロップ、Image ボタンで、ノートの本文に埋め込む（data: URL。PNG・JPEG・GIF・WebP）。エディタでは短い表示に折りたたむ。
- ロックしたノートは読み取り専用になる。

## 既知の制約

- 画像は縮小せずに埋め込むので、大きい画像を入れるとノートが大きくなり、入力が重くなる（SN の保存は、ノート全体を送る）。
- Mermaid 12 は Safari 17.4（iOS 17.4）未満で動かない。その場合は、図の代わりにソースとエラーを表示する。
- Web 版では、プレビューのリンクを開いたタブにも iframe の sandbox が掛かるので、正しく動かないサイトがある。デスクトップ版は、システムのブラウザで開く。

## 導入

**デスクトップ版かモバイル版で導入する。Web 版（app.standardnotes.com）からは導入できない。**
導入したプラグインはアカウントで同期されるので、そのあとは Web 版でも使える。

1. デスクトップ版かモバイル版で Preferences > Plugins > Install Custom Plugin を開く。
2. `https://yuzneri.github.io/sn-markdown/ext.json` を貼り、確認画面で Install する。
3. ノートのエディタ選択メニューから「Markdown Studio」を選ぶ。

上の手順で "Error downloading package details" と表示されたら、2 で URL の代わりに [install-code.txt](https://yuzneri.github.io/sn-markdown/install-code.txt) の中身を貼る。
これは ext.json を data: URL にして base64 化したもので、ネットワーク越しに ext.json を取得しない。

Web 版で導入できない理由: Install Custom Plugin は ext.json を `credentials: 'include'` 付きで取得する。
Web 版の CSP は `connect-src` を SN のドメインなどに限っており、GitHub Pages への接続はそもそも許可されていない。
許可されている raw.githubusercontent.com も `Access-Control-Allow-Origin: *` を返すので、credentials 付きの取得は CORS で拒否される。

## 開発

Node.js 22.12 以上が必要。

```sh
npm install
npm run dev      # http://localhost:5173/dev/harness.html を開く
npm test
npm run typecheck
```

`dev/harness.html` は Standard Notes の親アプリの代役で、プラグインを SN と同じ sandbox 属性の iframe で読み込む。
ノートの読み込みと保存、同期エコー、他端末からの変更、ロック、テーマ、全体設定の往復を SN なしで確認できる。
`?src=<URL>` を付けると、ビルド済みのプラグインを読み込める（例: `npm run build && npx vite preview` のあと `?src=http://localhost:4173/index.html`）。

## ビルドと配布物

```sh
npm run build
PLUGIN_URL=https://<user>.github.io/<repo>/ npm run package
```

`dist/` に次のファイルができる。

| ファイル | 用途 |
|---|---|
| `index.html`, `assets/` | プラグイン本体（`url` で iframe に読み込まれる） |
| `ext.json` | マニフェスト |
| `latest.zip` | デスクトップ版がダウンロードしてローカルで配信する本体 |
| `install-code.txt` | ext.json を data: URL にして base64 化したもの |

main ブランチへの push で、`.github/workflows/deploy.yml` が GitHub Pages にデプロイする（リポジトリの Settings > Pages で Source を GitHub Actions にしておく）。

## ライセンス

MIT
