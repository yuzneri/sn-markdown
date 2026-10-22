// @vitest-environment jsdom
// 変換（htmlToMarkdown）と、エディタ（createEditor）への貼り付けを確かめる。jsdom には DataTransfer がないので、
// paste イベントに clipboardData を持たせて contentDOM に送る（CodeMirror は、そのイベントを貼り付けの処理に渡す）
import { afterEach, describe, expect, it } from 'vitest'
import { EditorView } from '@codemirror/view'
import { createEditor } from './editor'
import { htmlToMarkdown } from './html-paste'
import './jsdom-range'
import { parseAll } from './parse-all'

describe('htmlToMarkdown', () => {
  it('見出し、強調、リンク、リスト、引用、取り消し線を、書式のボタンと同じ記法にする', () => {
    const html =
      '<h2>Title</h2><p>Some <strong>bold</strong>, <em>italic</em>, <del>gone</del> and <a href="https://example.com">a link</a>.</p>' +
      '<ul><li>one<ul><li>nested</li></ul></li><li>two</li></ul><ol start="3"><li>third</li><li>fourth</li></ol><blockquote><p>quote</p></blockquote>'
    expect(htmlToMarkdown(html)).toBe(
      [
        '## Title',
        '',
        'Some **bold**, _italic_, ~~gone~~ and [a link](https://example.com).',
        '',
        '- one',
        '  - nested',
        '- two',
        '',
        '3. third',
        '4. fourth',
        '',
        '> quote',
      ].join('\n'),
    )
  })

  it('表（列の幅をそろえる）、コードブロック、画像、タスクを変換する', () => {
    const html =
      '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>' +
      '<pre><code class="language-js">const a = 1</code></pre><p><img src="https://example.com/x.png" alt="pic"></p>' +
      '<ul><li><input type="checkbox" checked> done</li></ul>'
    expect(htmlToMarkdown(html)).toBe(
      ['| a   | b   |', '| --- | --- |', '| 1   | 2   |', '', '```js', 'const a = 1', '```', '', '![pic](https://example.com/x.png)', '', '- [x] done'].join('\n'),
    )
  })

  it('書式の要素がない HTML（コードエディタからのコピーなど）は変換しない', () => {
    expect(htmlToMarkdown('<div style="color: red"><span>const</span> <span>a = 1</span></div><div><br></div>')).toBeNull()
  })

  it('Google ドキュメントの全体を包む <b style="font-weight:normal"> は太字にしない。script と style は捨てる', () => {
    expect(htmlToMarkdown('<b style="font-weight:normal;" id="docs-internal-guid-1"><p><span>plain</span> <b>bold</b></p></b>')).toBe('plain **bold**')
    expect(htmlToMarkdown('<style>p{}</style><script>alert(1)</script><p><b>x</b></p>')).toBe('**x**')
  })
})

const parents: HTMLElement[] = []
afterEach(() => parents.splice(0).forEach((parent) => parent.remove()))

/** `«` `»` を選択範囲、`‸` をカーソルとして書いた文書に、clipboard の内容を貼った後の本文 */
function paste(doc: string, clipboard: Record<string, string>, files: File[] = []): string {
  const parent = document.body.appendChild(document.createElement('div'))
  parents.push(parent)
  const anchor = doc.includes('‸') ? doc.indexOf('‸') : doc.indexOf('«')
  const head = doc.includes('‸') ? anchor : doc.indexOf('»') - 1
  const text = doc.replace(/[‸«»]/g, '')
  const editor = createEditor(parent, { text, locked: false }, { onChange: () => {}, onError: () => {}, onContextChange: () => {}, onFoldsChange: () => {} })
  const view = EditorView.findFromDOM(parent)!
  parseAll(view)
  view.dispatch({ selection: { anchor, head } })
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => clipboard[type] ?? '', files, types: Object.keys(clipboard) } })
  view.contentDOM.dispatchEvent(event)
  return editor.text
}

describe('HTML の貼り付け', () => {
  it('書式のある HTML は、Markdown にして選択範囲を置き換える', () => {
    expect(paste('see «X» here', { 'text/html': '<b>bold</b> text', 'text/plain': 'bold text' })).toBe('see **bold** text here')
  })

  it('コードブロックとインラインコードの中では、文字のまま貼る', () => {
    expect(paste('```\n‸\n```', { 'text/html': '<b>bold</b>', 'text/plain': 'bold' })).toBe('```\nbold\n```')
    expect(paste('`co‸de`', { 'text/html': '<b>bold</b>', 'text/plain': 'bold' })).toBe('`coboldde`')
  })

  it('URL を選択範囲に貼る処理が先に効く', () => {
    expect(paste('see «docs» here', { 'text/html': '<a href="https://example.com">https://example.com</a>', 'text/plain': 'https://example.com' })).toBe(
      'see [docs](https://example.com) here',
    )
  })

  it('画像のファイルがあって文字がないときは、画像の埋め込みに任せる（変換しない）', () => {
    const image = new File([new Uint8Array([137, 80, 78, 71])], 'x.png', { type: 'image/png' })
    expect(paste('text‸', { 'text/html': '<img src="https://example.com/x.png">' }, [image])).toBe('text')
  })
})
