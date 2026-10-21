// @vitest-environment jsdom
// Android の Gboard のクリップボードの候補から貼ると、paste イベントではなく、選択範囲を置き換える文字の入力として届く。
// エディタ（createEditor）の inputHandler に、EditorView が入力を受けたときと同じ形で渡して確かめる
import { afterEach, describe, expect, it } from 'vitest'
import { EditorView } from '@codemirror/view'
import { createEditor } from './editor'
import './jsdom-range'

const parents: HTMLElement[] = []
afterEach(() => parents.splice(0).forEach((parent) => parent.remove()))

/** doc の selected を選び、text を入力として渡した後の本文 */
function input(doc: string, selected: string, text: string): string {
  const parent = document.body.appendChild(document.createElement('div'))
  parents.push(parent)
  const editor = createEditor(parent, { text: doc, locked: false }, { onChange: () => {}, onError: () => {}, onTableChange: () => {} })
  const view = EditorView.findFromDOM(parent)!
  const from = doc.indexOf(selected)
  const to = from + selected.length
  view.dispatch({ selection: { anchor: from, head: to } })
  const insert = () => view.state.update({ changes: { from, to, insert: text }, userEvent: 'input.type' })
  if (!view.state.facet(EditorView.inputHandler).some((handler) => handler(view, from, to, text, insert))) view.dispatch(insert())
  return editor.text
}

describe('URL の入力（Android のクリップボードの候補）', () => {
  it('選択範囲を URL で置き換える入力は、リンクにする', () => {
    expect(input('see the docs here', 'docs', 'https://example.com')).toBe('see the [docs](https://example.com) here')
  })

  it('1 文字ずつ打つ入力は、ふつうに置き換える', () => {
    expect(input('see the docs here', 'docs', 'h')).toBe('see the h here')
  })
})
