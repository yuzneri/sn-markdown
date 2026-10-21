import MarkdownIt, { type Token } from 'markdown-it'
import { tasklist } from '@mdit/plugin-tasklist'
import DOMPurify from 'dompurify'
import { highlightToHtml } from './highlight'

// breaks: メモでは 1 行ずつ改行して書くことが多いので、段落内の改行もそのまま改行として表示する
const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  highlight: (code: string, lang: string): string => highlightToHtml(code, lang, md.utils.escapeHtml),
}).use(tasklist, { label: false })

// スクロール同期でエディタの行とプレビューの要素を対応させるため、ブロック要素に元の行番号（0 始まり）を付ける
md.core.ruler.push('data_line', (state) => {
  for (const token of state.tokens) {
    if (token.map && token.nesting !== -1 && token.type !== 'inline') token.attrSet('data-line', String(token.map[0]))
  }
})

// Mermaid のコードブロックは、図の描画（diagram.ts）が後から図に置き換える目印にする。
// 中身はソースのまま入れておき、図を読み込む前や図にできないときにも読めるようにする
const renderFence = md.renderer.rules.fence!
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  if (!isMermaid(token)) return renderFence(tokens, idx, options, env, self)
  return `<div class="mermaid-block"${self.renderAttrs(token)}><pre><code>${md.utils.escapeHtml(token.content)}</code></pre></div>\n`
}

function isMermaid(token: Token): boolean {
  return token.type === 'fence' && token.info.trim().split(/\s+/)[0].toLowerCase() === 'mermaid'
}

// プレビューのリンクは新しいタブで開く（index.html の <base target="_blank">）。opener を渡すと、開いた先のページが
// window.opener 経由で偽の component-registered を送って sessionKey を差し替え、以後の保存を親アプリに拒否させられる
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // <base> の target は画像マップのリンク（<area>）にも効くので、両方に付ける
  if ((node.nodeName === 'A' || node.nodeName === 'AREA') && node.hasAttribute('href')) node.setAttribute('rel', 'noopener noreferrer')
})

/** Markdown をサニタイズ済みの HTML にする。ノート中の生の HTML も表示するが、スクリプトにつながるものは除く */
export function renderHtml(markdown: string): string {
  // <style> はノートの CSS がプラグインの画面全体（ツールバーやエディタ）に効いてしまうので除く。
  // <form> はプレビューでは使い道がなく、送信すると新しいタブで外部へ送られるだけなので除く
  return DOMPurify.sanitize(md.render(markdown), { FORBID_TAGS: ['style', 'form'] })
}

const PREVIEW_LENGTH = 90
// ノート一覧に出すのは先頭の数行だけ。入力のたびに呼ぶので、長いノートでも先頭だけを解析する
const PREVIEW_SOURCE_LENGTH = 2000

/** ノート一覧に表示するプレビュー（preview_plain）。記法の記号を除いた本文の先頭 */
export function previewText(markdown: string): string {
  const parts: string[] = []
  for (const token of md.parse(markdown.slice(0, PREVIEW_SOURCE_LENGTH), {})) {
    if (token.type === 'inline') parts.push(inlineText(token.children ?? []))
    // Mermaid のソースは一覧では図にならず、記号の羅列になるだけなので除く
    else if ((token.type === 'fence' && !isMermaid(token)) || token.type === 'code_block') parts.push(token.content)
  }
  // 絵文字などのサロゲートペアを途中で切らないよう、コードポイント単位で数える
  const chars = Array.from(parts.join(' ').replace(/\s+/g, ' ').trim())
  return chars.length <= PREVIEW_LENGTH ? chars.join('') : `${chars.slice(0, PREVIEW_LENGTH).join('')}…`
}

function inlineText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'text':
        case 'code_inline':
          return token.content
        case 'softbreak':
        case 'hardbreak':
          return ' '
        case 'image':
          return inlineText(token.children ?? [])
        default:
          // 生の HTML（html_inline）やリンクの開閉タグは文字を持たない
          return ''
      }
    })
    .join('')
}
