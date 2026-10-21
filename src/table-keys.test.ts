// @vitest-environment jsdom
// エディタと同じ拡張の並びで、表のキーが lang-markdown のキーマップ（リストの続きの Enter）と字下げの Tab より先に効き、
// 表の外では今までどおりに譲ることを確かめる。runScopeHandlers でキーイベントをキーマップに通す
import { afterEach, describe, expect, it } from 'vitest'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { createEditor, type MarkdownEditor } from './editor'
import './jsdom-range'

const parents: HTMLElement[] = []
afterEach(() => parents.splice(0).forEach((parent) => parent.remove()))

function press(doc: string, key: string, shiftKey = false): MarkdownEditor {
  const parent = document.body.appendChild(document.createElement('div'))
  parents.push(parent)
  const editor = createEditor(parent, { text: doc.replace('‸', ''), locked: false }, { onChange: () => {}, onError: () => {} })
  const view = EditorView.findFromDOM(parent)!
  view.dispatch({ selection: { anchor: doc.indexOf('‸') } })
  runScopeHandlers(view, new KeyboardEvent('keydown', { key, shiftKey }), 'editor')
  return editor
}

describe('表のキー', () => {
  // lang-markdown の Enter は、引用やリストの外では何もせずに譲るので、先に効くかは引用の中の表で確かめる
  it('引用の中の表の Enter は、引用の続きではなく下の行への移動になる', () => {
    expect(press('> | a‸ |\n> |---|', 'Enter').text).toBe('> | a   |\n> | --- |\n> |     |')
  })

  it('表の中の Tab は、字下げではなく次のセルへの移動になる', () => {
    expect(press('| a‸ | b |\n|---|---|', 'Tab').text).toBe('| a   | b   |\n| --- | --- |')
  })

  it('表の外では、今までどおり Enter でリストを続け、Tab で字下げする', () => {
    expect(press('- item‸', 'Enter').text).toBe('- item\n- ')
    expect(press('- item‸', 'Tab').text).toBe('  - item')
  })
})
