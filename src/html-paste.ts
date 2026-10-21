import { gfm } from '@joplin/turndown-plugin-gfm'
import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import TurndownService from 'turndown'

// 書式の要素。これを含まない HTML（コードエディタからのコピーなど、div / span / br だけのもの）は、文字のまま貼る
const FORMATTING = /<(?:h[1-6]|strong|b|em|i|a|ul|ol|li|table|img|blockquote|pre|code|s|del|strike|hr)\b/i

// 記法は、このエディタの書式のボタンに合わせる（見出しは #、箇条書きは -、斜体は _、コードブロックは ```）
const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
})
turndown.use(gfm)
turndown.remove(['script', 'style', 'title'])
// 箇条書きの記号の後の空白は 1 つにする（turndown の既定は「-   」で、書式のボタンで入れる行とそろわない）。
// 項目の続きの行は、記号の幅だけ字下げする（turndown の既定の規則と同じ考え方）
turndown.addRule('listItem', {
  filter: 'li',
  replacement: (content, node, options) => {
    const parent = node.parentNode as HTMLElement | null
    let prefix = `${options.bulletListMarker} `
    if (parent?.nodeName === 'OL') {
      const start = parent.getAttribute('start')
      const index = Array.prototype.indexOf.call(parent.children, node)
      prefix = `${start ? Number(start) + index : index + 1}. `
    }
    const paragraph = /\n$/.test(content)
    // タスクの記号（GFM のプラグインが入れる「[x] 」）の後ろに、項目の文字の先頭の空白が続くので、1 つにまとめる
    const body = content.replace(/^\n+/, '').replace(/\n+$/, '').replace(/^(\[[ x]\]) +/, '$1 ') + (paragraph ? '\n' : '')
    return prefix + body.replace(/\n/g, `\n${' '.repeat(prefix.length)}`) + (node.nextSibling ? '\n' : '')
  },
})
// Google ドキュメントは、コピーした全体を <b style="font-weight:normal"> で包む。そのまま変換すると、全体が太字になる
turndown.addRule('notBold', {
  filter: (node) => node.nodeName === 'B' && /font-weight:\s*normal/i.test(node.getAttribute('style') ?? ''),
  replacement: (content) => content,
})

/**
 * 貼り付けた HTML を Markdown にする。書式の要素を含まないとき、変換して空になるときは null（文字のまま貼る）。
 * HTML は turndown が DOMParser の文書で読むので、スクリプトも画像の読み込みも動かない
 */
export function htmlToMarkdown(html: string): string | null {
  if (!FORMATTING.test(html)) return null
  return turndown.turndown(html).trim() || null
}

// カーソルがコードの中なら、HTML を変換せずに文字のまま貼る（コードの中の Markdown は記法にならない）
function inCode(state: EditorState): boolean {
  let node = syntaxTree(state).resolveInner(state.selection.main.head, -1)
  for (;;) {
    if (/^(?:FencedCode|CodeBlock|InlineCode)$/.test(node.name)) return true
    if (!node.parent) return false
    node = node.parent
  }
}

export const pasteHtmlAsMarkdown = EditorView.domEventHandlers({
  paste(event, view) {
    const data = event.clipboardData
    const html = data?.getData('text/html')
    if (!data || !html || inCode(view.state)) return false
    // ブラウザで画像をコピーすると、画像のファイルと <img> の HTML が入り、文字は入らない。それは画像の埋め込み（image-insert.ts）に任せる
    if (data.files.length > 0 && !data.getData('text/plain')) return false
    const markdown = htmlToMarkdown(html)
    if (!markdown) return false
    view.dispatch(view.state.replaceSelection(markdown), { userEvent: 'input.paste', scrollIntoView: true })
    return true
  },
})
