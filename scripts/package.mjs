// vite build の成果物（dist/）に、Standard Notes へ導入するための配布物を追加する。
//   ext.json         プラグインのマニフェスト（Install Custom Plugin で読ませる）
//   latest.zip       デスクトップ版が download_url から取得し、ローカルサーバーで配信する本体
//   install-code.txt ext.json を data: URL にして base64 化したもの。Install Custom Plugin に URL の代わりに貼る予備の手段。
//                    ext.json の URL 取得は credentials: 'include' 付きで、ACAO: * の GitHub Pages からの取得が
//                    CORS で失敗する環境がある。data: URL の取得は CORS の対象外
//                    （PluginsService.getPluginDetailsFromUrl は base64 として復号できた入力を URL として扱う）
// 使い方: PLUGIN_URL=https://<user>.github.io/<repo>/ node scripts/package.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'

const DIST = 'dist'
const OUTPUTS = ['ext.json', 'latest.zip', 'install-code.txt']

const pluginUrl = process.env.PLUGIN_URL
if (!pluginUrl) {
  throw new Error('PLUGIN_URL（プラグインを公開する URL。例: https://<user>.github.io/<repo>/）を指定してください')
}
const base = new URL(pluginUrl.endsWith('/') ? pluginUrl : `${pluginUrl}/`)
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

const manifest = {
  identifier: 'net.yuzneri.sn-markdown',
  name: 'Markdown Studio',
  content_type: 'SN|Component',
  area: 'editor-editor',
  version: pkg.version,
  description: pkg.description,
  url: new URL('index.html', base).href,
  // デスクトップ版は HTTP キャッシュ付きで zip を取得する（Pages は max-age=600）。バージョンごとに URL を変え、
  // 新しい ext.json と古い zip を組み合わせて取り込む（以後そのバージョンのまま更新されない）のを防ぐ
  download_url: new URL(`latest.zip?v=${pkg.version}`, base).href,
  latest_url: new URL('ext.json', base).href,
  note_type: 'markdown',
  file_type: 'md',
}

const files = {}
for (const entry of readdirSync(DIST, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue
  const path = join(entry.parentPath, entry.name)
  const name = path.slice(DIST.length + 1).replaceAll('\\', '/')
  if (OUTPUTS.includes(name)) continue
  files[name] = readFileSync(path)
}
// デスクトップ版は zip 内 package.json の sn.main を入口にし、version を更新判定に使う
files['package.json'] = strToU8(JSON.stringify({ name: pkg.name, version: pkg.version, sn: { main: 'index.html' } }, null, 2))

writeFileSync(join(DIST, 'latest.zip'), zipSync(files, { level: 9 }))
writeFileSync(join(DIST, 'ext.json'), `${JSON.stringify(manifest, null, 2)}\n`)
const dataUrl = `data:application/json,${encodeURIComponent(JSON.stringify(manifest))}`
// 末尾に改行を付けない。SN は libsodium の from_base64（ORIGINAL）で復号し、改行を不正な文字として扱う
writeFileSync(join(DIST, 'install-code.txt'), Buffer.from(dataUrl).toString('base64'))

console.log(`packaged ${manifest.identifier}@${manifest.version} for ${base.href}`)
