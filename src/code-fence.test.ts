// @vitest-environment jsdom
// inputHandler は EditorView の上で働くので jsdom で動かす。打った文字を、EditorView が入力を受けたときと同じ順で inputHandler に渡す
import { afterEach, describe, expect, it } from 'vitest'
import { history, undo } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { closeCodeFence } from './code-fence'
import { parsed } from './parse-all'

const views: EditorView[] = []
afterEach(() => views.splice(0).forEach((view) => view.destroy()))

function create(doc: string): EditorView {
  const pos = doc.indexOf('|')
  const view = new EditorView({
    parent: document.body,
    state: parsed(EditorState.create({ doc: doc.replace('|', ''), selection: { anchor: pos }, extensions: [markdown(), history(), closeCodeFence] })),
  })
  views.push(view)
  return view
}

function input(view: EditorView, text: string): void {
  const pos = view.state.selection.main.head
  const insert = () => view.state.update({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length }, userEvent: 'input.type' })
  if (!view.state.facet(EditorView.inputHandler).some((handler) => handler(view, pos, pos, text, insert))) view.dispatch(insert())
}

/** `|` をカーソルとして書いた文書で text を打ち、同じ書き方で結果を返す */
function type(doc: string, text = '`'): string {
  const view = create(doc)
  input(view, text)
  const head = view.state.selection.main.head
  const result = view.state.doc.toString()
  return result.slice(0, head) + '|' + result.slice(head)
}

describe('closeCodeFence', () => {
  it('空の行で ``` を打つと、次の行に閉じるフェンスを入れる', () => {
    expect(type('``|')).toBe('```|\n```')
    expect(type('para\n\n``|')).toBe('para\n\n```|\n```')
    expect(type('  ~~|', '~')).toBe('  ~~~|\n  ~~~')
  })

  it('次の行が空行なら入れ、文字があれば入れない', () => {
    expect(type('``|\n\nnext')).toBe('```|\n```\n\nnext')
    expect(type('``|\nexisting text')).toBe('```|\nexisting text')
  })

  it('閉じていないコードブロックの中では、閉じるフェンスを打っているので入れない', () => {
    expect(type('```js\ncode\n``|')).toBe('```js\ncode\n```|')
  })

  it('閉じたコードブロックの上で新しく打つときは入れる', () => {
    expect(type('``|\n\n```py\ncode\n```')).toBe('```|\n```\n\n```py\ncode\n```')
  })

  it('3 つちょうどのときだけ入れる（4 つ目、後ろの文字、インデントのコードブロック）', () => {
    expect(type('```|\n```')).toBe('````|\n```')
    expect(type('``|x')).toBe('```|x')
    expect(type('    ``|')).toBe('    ```|')
  })

  it('1 回の取り消しで、打った文字と閉じるフェンスの両方を消す', () => {
    const view = create('``|')
    input(view, '`')
    undo(view)
    expect(view.state.doc.toString()).toBe('``')
  })
})
