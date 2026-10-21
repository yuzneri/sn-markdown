# Markdown Studio

Standard Notes 用の Markdown エディタプラグイン。

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
